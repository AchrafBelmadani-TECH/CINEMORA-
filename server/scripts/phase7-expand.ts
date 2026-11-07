/**
 * Phase 7 — Batch discovery using the ArchiveOrgProvider across multiple
 * Archive.org collections. Matches to TMDB, registers sources, publishes.
 * Run: npx tsx scripts/phase7-expand.ts [--start-page=N] [--end-page=N] [--limit=N]
 */
import 'dotenv/config';
import { CatalogSyncService } from '../src/services/library/sync.service.js';
import { TmdbClient } from '../src/services/tmdb/tmdbClient.js';
import { ArchiveOrgProvider } from '../src/services/media/providers/archive-org.js';
import { parseEnv } from '../src/lib/env.js';
import { createLogger } from '../src/lib/logger.js';
import { prisma } from '../src/lib/prisma.js';

const env = parseEnv(process.env);
const logger = createLogger({ ...env, LOG_LEVEL: 'silent' });
const tmdb = new TmdbClient({ token: env.TMDB_READ_ACCESS_TOKEN, logger });
const sync = new CatalogSyncService(tmdb, logger);
const provider = new ArchiveOrgProvider();

const startPage = Number(process.argv.find((a) => a.startsWith('--start-page='))?.split('=')[1] ?? 17);
const endPage = Number(process.argv.find((a) => a.startsWith('--end-page='))?.split('=')[1] ?? 22);
const limit = Number(process.argv.find((a) => a.startsWith('--limit='))?.split('=')[1] ?? 50);

function cleanTitle(raw: string): string {
  return raw.replace(/\s*\(\d{4}\)\s*$/, '').replace(/\s*\[.*?\]\s*$/, '').trim();
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

for (let page = startPage; page <= endPage; page++) {
  console.log(`\n=== Archive.org feature_films page ${page} ===`);
  const sources = await provider.search('feature_films', page, limit).catch((err) => {
    console.log(`  search error: ${err instanceof Error ? err.message.slice(0, 80) : err}`);
    return [];
  });

  for (const source of sources) {
    try {
      // Dedupe by URL
      const existingSource = await prisma.videoSource.findFirst({
        where: { externalUrl: source.url },
      });
      if (existingSource) { skipped += 1; continue; }

      // Skip adult content
      if (/nudist|molester|sex|madness|reefer|nazi|concentration/i.test(source.title)) {
        skipped += 1; continue;
      }

      // Skip tiny files
      if (source.sizeBytes !== undefined && source.sizeBytes < 50_000_000) { skipped += 1; continue; }

      // Verify the URL is live
      const live = await provider.verify(source.url);
      if (!live) { skipped += 1; continue; }

      // Match to TMDB
      const tmdbMatch = await searchTmdb(source.title, source.year);
      if (!tmdbMatch) { skipped += 1; continue; }

      // Check if already published
      const existingTitle = await prisma.title.findUnique({
        where: { tmdbType_tmdbId: { tmdbType: 'MOVIE', tmdbId: tmdbMatch.id } },
      });
      if (existingTitle?.isPublished) { skipped += 1; continue; }

      // Deep-sync
      await sync.deepSyncTitle('movie', tmdbMatch.id);
      const title = await prisma.title.findUniqueOrThrow({
        where: { tmdbType_tmdbId: { tmdbType: 'MOVIE', tmdbId: tmdbMatch.id } },
      });

      // Register source + asset
      await prisma.videoSource.create({
        data: {
          titleId: title.id, provider: source.provider, externalUrl: source.url,
          format: 'MP4', licenseType: source.licenseType, licenseRef: source.licenseRef,
          territories: ['ALL'], status: 'ACTIVE',
        },
      });
      await prisma.videoAsset.create({
        data: {
          titleId: title.id, status: 'READY', licenseType: source.licenseType,
          licenseRef: source.licenseRef, sourceKey: source.url, qualities: ['source'],
        },
      });
      await prisma.title.update({
        where: { id: title.id }, data: { isPublished: true, availability: 'AVAILABLE' },
      });

      created += 1;
      console.log(`  ✓ "${title.title}" (${source.year ?? '?'}) — ${source.licenseType}`);
      await new Promise((r) => setTimeout(r, 400));
    } catch (err) {
      errors += 1;
      const msg = err instanceof Error ? err.message.slice(0, 80) : String(err).slice(0, 80);
      console.log(`  ✗ ${msg}`);
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  console.log(`  page ${page} done: created ${created} total, skipped ${skipped}, errors ${errors}`);
  await new Promise((r) => setTimeout(r, 1000));
}

const watchable = await prisma.title.count({ where: { availability: 'AVAILABLE' } });
console.log(`\nDONE: pages ${startPage}-${endPage} | created ${created} | skipped ${skipped} | errors ${errors}`);
console.log(`TOTAL WATCHABLE: ${watchable}`);
await prisma.$disconnect();
