import { Router } from 'express';
import type { Env } from '../lib/env.js';
import { AppError } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';
import { CatalogSyncService, isSyncSourceKey, SYNC_SOURCES } from '../services/library/sync.service.js';
import { LibraryService } from '../services/library/library.service.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { z } from 'zod';
import { mediaTypeSchema } from '../validators/catalog.js';

const syncBodySchema = z.object({
  source: z.string(),
  pages: z.coerce.number().int().min(1).max(500).default(1),
});
const deepSyncBodySchema = z.object({
  mediaType: mediaTypeSchema,
  tmdbId: z.coerce.number().int().min(1),
});

export function libraryRoutes(services: { sync: CatalogSyncService; library: LibraryService; env: Env }): Router {
  const router = Router();
  const { sync, library, env } = services;

  // Public — truthful reporting
  router.get('/library/stats', async (_req, res) => {
    res.json(await library.stats());
  });

  router.get('/library/watchable-ids', async (_req, res) => {
    const rows = await prisma.title.findMany({
      where: { availability: 'AVAILABLE', isPublished: true },
      select: { tmdbId: true, tmdbType: true, kind: true },
    });
    res.json({
      movies: rows.filter((r) => r.kind === 'MOVIE').map((r) => r.tmdbId),
      tvShows: rows.filter((r) => r.kind === 'TV').map((r) => r.tmdbId),
    });
  });

  router.get('/titles/:tmdbType/:tmdbId/availability', async (req, res, next) => {
    try {
      const { tmdbType } = z.object({ tmdbType: mediaTypeSchema }).parse(req.params);
      const { tmdbId } = z.object({ tmdbId: z.coerce.number().int().min(1) }).parse(req.params);
      res.json(await library.availabilityFor(tmdbType, tmdbId));
    } catch (err) {
      next(err);
    }
  });

  // Admin — proper RBAC (requireAuth → requireRole), replacing the interim
  // bootstrap token (Phase 5).
  const admin = Router();
  admin.use(requireAuth(env));
  admin.use(requireRole('ADMIN'));

  admin.post('/sync', async (req, res, next) => {
    try {
      const { source, pages } = syncBodySchema.parse(req.body);
      if (!isSyncSourceKey(source)) {
        throw AppError.badRequest(`Unknown sync source "${source}"`, {
          known: Object.keys(SYNC_SOURCES),
        });
      }
      const summary = await sync.runImport(source, pages);
      res.status(202).json({ job: summary });
    } catch (err) {
      next(err);
    }
  });

  admin.post('/titles/deep-sync', async (req, res, next) => {
    try {
      const { mediaType, tmdbId } = deepSyncBodySchema.parse(req.body);
      const result = await sync.deepSyncTitle(mediaType, tmdbId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  admin.get('/import-jobs', async (_req, res) => {
    const jobs = await prisma.importJob.findMany({
      orderBy: { startedAt: 'desc' },
      take: 20,
    });
    res.json({ jobs });
  });

  router.use('/admin', admin);
  return router;
}
