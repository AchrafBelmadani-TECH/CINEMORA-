/**
 * Bounded incremental catalog sync — run manually or via cron/CI:
 *   node scripts/sync-catalog.mjs --pages=2
 *   node scripts/sync-catalog.mjs --source=movie_popular --pages=5
 * Never downloads the whole TMDB catalog in one operation: each source is
 * bounded by --pages and paced by the sync service.
 */
import 'dotenv/config';
import { CatalogSyncService, isSyncSourceKey, SYNC_SOURCES } from '../src/services/library/sync.service.js';
import { TmdbClient } from '../src/services/tmdb/tmdbClient.js';
import { parseEnv } from '../src/lib/env.js';
import { createLogger } from '../src/lib/logger.js';
import { prisma } from '../src/lib/prisma.js';

const env = parseEnv(process.env);
const logger = createLogger(env);

function arg(name: string): string | undefined {
  const match = process.argv.find((a) => a.startsWith(`--${name}=`));
  return match?.split('=')[1];
}

const pages = Math.max(1, Math.min(Number.parseInt(arg('pages') ?? '1', 10) || 1, 500));
const sourceArg = arg('source');

const tmdb = new TmdbClient({ token: env.TMDB_READ_ACCESS_TOKEN, logger });
const sync = new CatalogSyncService(tmdb, logger);

const sources = sourceArg ? [sourceArg] : Object.keys(SYNC_SOURCES);
for (const source of sources) {
  if (!isSyncSourceKey(source)) {
    console.error(`unknown source "${source}" — known: ${Object.keys(SYNC_SOURCES).join(', ')}`);
    process.exit(1);
  }
  const summary = await sync.runImport(source, pages);
  console.log(
    `[${summary.source}] ${summary.status} — pages ${summary.pagesCompleted}, created ${summary.itemsCreated}, updated ${summary.itemsUpdated}`,
  );
}

await prisma.$disconnect();
