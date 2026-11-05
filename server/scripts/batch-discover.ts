/**
 * Batch-discovers public-domain films from Archive.org's feature_films
 * collection, matches them to TMDB titles, probes URLs, and registers
 * playable sources. Processes in batches with pacing and dedup.
 *
 * Run: npx tsx scripts/batch-discover.ts [--page=1] [--limit=50]
 */
import 'dotenv/config';
import { CatalogSyncService } from '../src/services/library/sync.service.js';
import { TmdbClient } from '../src/services/tmdb/tmdbClient.js';
import { parseEnv } from '../src/lib/env.js';
import { createLogger } from '../src/lib/logger.js';
import { prisma } from '../src/lib/prisma.js';

const env = parseEnv(process.env);
const logger = createLogger({ ...env, LOG_LEVEL: 'silent' });
const tmdb = new TmdbClient({ token: env.TMDB_READ_ACCESS_TOKEN, logger });
const sync = new CatalogSyncService(tmdb, logger);

const page = Number(process.argv.find((a) => a.startsWith('--page='))?.split('=')[1] ?? 1);
const limit = Number(process.argv.find((a) => a.startsWith('--limit='))?.split('=')[1] ?? 50);

// Films with explicit PD/CC licenses and known well-known titles
const SKIP_PATTERNS = [
  /nudist|molester|sex|madness|reefer|nazi|concentration/i,
];

interface ArchiveDoc {
  identifier: string;
  title: string;
  year?: string;
  licenseurl?: string;
}

interface ArchiveFile {
  name: string;
  format?: string;
  size?: string;
}

async function searchArchive(page: number): Promise<ArchiveDoc[]> {
  const url = `https://archive.org/advancedsearch.php?q=collection%3Afeature_films+AND+format%3AMPEG4&fl%5B%5D=identifier&fl%5B%5D=title&fl%5B%5D=year&fl%5B%5D=licenseurl&rows=${limit}&page=${page}&output=json`;
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  const body = (await res.json()) as { response?: { docs?: ArchiveDoc[] } };
  return body.response?.docs ?? [];
}

async function getMp4File(identifier: string): Promise<{ name: string; size: number } | null> {
  const url = `https://archive.org/metadata/${identifier}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  const body = (await res.json()) as { files?: ArchiveFile[] };
  // Prefer the largest MP4 (usually the main feature)
  const mp4s = (body.files ?? []).filter((f) => /\.mp4$/i.test(f.name)).sort((a, b) => Number(b.size ?? 0) - Number(a.size ?? 0));
  return mp4s[0] ?? null;
}

function cleanTitle(raw: string): string {
  return raw
    .replace(/\s*\(\d{4}\)\s*$/, '')
    .replace(/\s*\[.*?\]\s*$/, '')
    .trim();
}

async function searchTmdb(title: string, year?: string) {
  const res = await tmdb.getJson<{ results?: Array<{ id: number; title: string; release_date?: string }> }>(
    '/search/movie', { query: cleanTitle(title) },
  );
  const results = res.results ?? [];
  if (year) {
    const yearMatch = results.find((r) => (r.release_date ?? '').startsWith(year));
    if (yearMatch) return yearMatch;
  }
  return results[0] ?? null;
}

let created = 0;
let skipped = 0;
let errors = 0;
let processed = 0;

console.log(`Batch discovery — page ${page}, limit ${limit}`);
const docs = await searchArchive(page);
console.log(`Archive.org returned ${docs.length} films`);

for (const doc of docs) {
  processed += 1;
  try {
    // Skip adult/explicit content
    if (SKIP_PATTERNS.some((p) => p.test(doc.title))) {
      skipped += 1;
      continue;
    }

    // Check if already published by this archive identifier
    const existingSource = await prisma.videoSource.findFirst({
      where: { externalUrl: { contains: `archive.org/download/${doc.identifier}/` } },
    });
    if (existingSource) {
      skipped += 1;
      continue;
    }

    // Get the MP4 file
    const mp4 = await getMp4File(doc.identifier);
    if (!mp4 || Number(mp4.size ?? 0) < 50_000_000) {
      skipped += 1;
      continue; // skip tiny files (not full features)
    }

    // Build URL and probe
    const url = `https://archive.org/download/${doc.identifier}/${encodeURIComponent(mp4.name)}`;
    const range = await fetch(url, { headers: { Range: 'bytes=0-256' }, signal: AbortSignal.timeout(20_000) }).catch(() => null);
    if (!range?.ok) {
      skipped += 1;
      continue;
    }

    // Match to TMDB
    const tmdbMatch = await searchTmdb(cleanTitle(doc.title), doc.year);
    if (!tmdbMatch) {
      skipped += 1;
      continue;
    }

    // Check if already published
    const existingTitle = await prisma.title.findUnique({
      where: { tmdbType_tmdbId: { tmdbType: 'MOVIE', tmdbId: tmdbMatch.id } },
    });
    if (existingTitle?.isPublished) {
      skipped += 1;
      continue;
    }

    // Deep-sync the TMDB title
    await sync.deepSyncTitle('movie', tmdbMatch.id);
    const title = await prisma.title.findUniqueOrThrow({
      where: { tmdbType_tmdbId: { tmdbType: 'MOVIE', tmdbId: tmdbMatch.id } },
    });

    // Register source
    const license = doc.licenseurl?.includes('publicdomain') ? 'PUBLIC_DOMAIN'
      : doc.licenseurl?.includes('creativecommons') ? 'CREATIVE_COMMONS'
      : 'PUBLIC_DOMAIN';

    await prisma.videoSource.create({
      data: {
        titleId: title.id,
        provider: 'archive.org',
        externalUrl: url,
        format: 'MP4',
        licenseType: license,
        licenseRef: `https://archive.org/details/${doc.identifier}`,
        territories: ['ALL'],
        status: 'ACTIVE',
      },
    });

    // Create READY asset for progress
    await prisma.videoAsset.create({
      data: {
        titleId: title.id,
        status: 'READY',
        licenseType: license,
        licenseRef: `https://archive.org/details/${doc.identifier}`,
        sourceKey: url,
        qualities: ['source'],
      },
    });

    // Publish
    await prisma.title.update({
      where: { id: title.id },
      data: { isPublished: true, availability: 'AVAILABLE' },
    });

    created += 1;
    console.log(`✓ [${processed}] "${title.title}" (${doc.year ?? '?'}) — ${license}`);
    await new Promise((r) => setTimeout(r, 400)); // pacing
  } catch (err) {
    errors += 1;
    const msg = err instanceof Error ? err.message.slice(0, 80) : String(err).slice(0, 80);
    console.log(`✗ [${processed}] ${msg}`);
    await new Promise((r) => setTimeout(r, 1000));
  }
}

const watchable = await prisma.title.count({ where: { availability: 'AVAILABLE' } });
console.log(`\nDONE: processed ${processed} | created ${created} | skipped ${skipped} | errors ${errors}`);
console.log(`TOTAL WATCHABLE: ${watchable}`);
await prisma.$disconnect();
