/**
 * Seeds verified, legally authorized playable content into the catalog:
 *  - Deep-syncs real TMDB titles (Blender CC-BY films + one CC0 public-domain film).
 *  - Registers their VERIFIED Archive.org streams as video sources (probed live).
 *  - Publishes the titles so stream-info can serve them.
 * Run: npm run seed:content
 */
import 'dotenv/config';
import { CatalogSyncService } from '../src/services/library/sync.service.js';
import { TmdbClient } from '../src/services/tmdb/tmdbClient.js';
import { parseEnv } from '../src/lib/env.js';
import { createLogger } from '../src/lib/logger.js';
import { prisma } from '../src/lib/prisma.js';

const env = parseEnv(process.env);
const logger = createLogger(env);

interface SeedSource {
  tmdbType: 'movie' | 'tv';
  tmdbId: number;
  url: string;
  licenseType: 'PUBLIC_DOMAIN' | 'CREATIVE_COMMONS';
  licenseRef: string;
  provider: string;
  note: string;
}

/** Every URL below was probed live (HTTP 206, video/mp4) before inclusion. */
const SEEDS: SeedSource[] = [
  {
    tmdbType: 'movie',
    tmdbId: 45745, // Sintel (Blender Foundation)
    url: 'https://archive.org/download/Sintel/sintel-2048-surround.mp4',
    licenseType: 'CREATIVE_COMMONS',
    licenseRef: 'https://durian.blender.org/press/' /* CC-BY 3.0 */,
    provider: 'archive.org',
    note: 'Blender Foundation open movie, CC-BY',
  },
  {
    tmdbType: 'movie',
    tmdbId: 9761, // Elephants Dream (Blender Foundation) — id verified via TMDB search
    url: 'https://archive.org/download/ElephantsDream/ed_1024_512kb.mp4',
    licenseType: 'CREATIVE_COMMONS',
    licenseRef: 'https://www.blender.org/about/projects/elephants-dream/' /* CC-BY 2.5 */,
    provider: 'archive.org',
    note: 'Blender Foundation open movie, CC-BY',
  },
  {
    tmdbType: 'movie',
    tmdbId: 10378, // Big Buck Bunny (Blender Foundation)
    url: 'https://archive.org/download/BigBuckBunny_124/Content/big_buck_bunny_720p_surround.mp4',
    licenseType: 'CREATIVE_COMMONS',
    licenseRef: 'https://peach.blender.org/about/' /* CC-BY 3.0 */,
    provider: 'archive.org',
    note: 'Blender Foundation open movie, CC-BY',
  },
  {
    tmdbType: 'movie',
    tmdbId: 10331, // Night of the Living Dead (1968, public domain) — id verified via TMDB search
    url: 'https://archive.org/download/night-of-the-living-dead-extended-version/Night%20of%20the%20Living%20Dead%20Extended%20Version.mp4',
    licenseType: 'PUBLIC_DOMAIN',
    licenseRef: 'https://archive.org/details/night-of-the-living-dead-extended-version' /* CC0 mark */,
    provider: 'archive.org',
    note: 'Romero 1968 classic — copyright not renewed; Archive.org item marked CC0',
  },
];

async function main() {
  const tmdb = new TmdbClient({ token: env.TMDB_READ_ACCESS_TOKEN, logger });
  const sync = new CatalogSyncService(tmdb, logger);

  for (const seed of SEEDS) {
    console.log(`deep-syncing ${seed.tmdbType}/${seed.tmdbId}…`);
    const result = await sync.deepSyncTitle(seed.tmdbType, seed.tmdbId);
    const title = await prisma.title.findUniqueOrThrow({
      where: { tmdbType_tmdbId: { tmdbType: seed.tmdbType === 'movie' ? 'MOVIE' : 'TV', tmdbId: seed.tmdbId } },
    });

    // Dedupe-safe source registration.
    const existing = await prisma.videoSource.findFirst({
      where: { titleId: title.id, externalUrl: seed.url },
    });
    if (existing) {
      console.log(`  source already registered (${existing.id.slice(0, 8)})`);
    } else {
      await prisma.videoSource.create({
        data: {
          titleId: title.id,
          provider: seed.provider,
          externalUrl: seed.url,
          format: 'MP4',
          licenseType: seed.licenseType,
          licenseRef: seed.licenseRef,
          territories: ['ALL'],
          status: 'ACTIVE',
        },
      });
      console.log(`  source registered: ${seed.note}`);
    }

    // Availability truth: active source => AVAILABLE; publish for playback.
    await prisma.title.update({
      where: { id: title.id },
      data: { availability: 'AVAILABLE', isPublished: true },
    });
    console.log(`  published "${title.title}" — seasons ${result.seasons}, episodes ${result.episodes}`);
  }

  const stats = {
    titles: await prisma.title.count(),
    watchable: await prisma.title.count({ where: { availability: 'AVAILABLE' } }),
    sources: await prisma.videoSource.count({ where: { status: 'ACTIVE' } }),
  };
  console.log(`DONE: ${stats.titles} titles, ${stats.watchable} watchable, ${stats.sources} active sources`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
