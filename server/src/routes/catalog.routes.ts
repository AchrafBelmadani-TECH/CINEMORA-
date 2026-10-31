import { Router } from 'express';
import type { CatalogController } from '../controllers/catalog.controller.js';

/**
 * Catalog routes (Phase 2). Controllers parse/validate their own inputs —
 * Zod failures surface as 400 VALIDATION_ERROR via the central handler, and
 * Express 5 forwards async rejections to it as well.
 */
export function catalogRoutes(controller: CatalogController): Router {
  const router = Router();

  // Movies — static paths before parameterized /:id
  router.get('/movies/trending', controller.trending);
  router.get('/movies/popular', controller.popular);
  router.get('/movies/top-rated', controller.topRated);
  router.get('/movies/upcoming', controller.latest);
  router.get('/movies/genre/:genreId', controller.genre);

  // TV — static paths before parameterized /:id
  router.get('/tv/trending', controller.trendingTv);
  router.get('/tv/popular', controller.popularTv);
  router.get('/tv/top-rated', controller.topRatedTv);
  router.get('/tv/on-the-air', controller.latestTv);
  router.get('/tv/genre/:genreId', controller.genre);

  // Details (Phase 3)
  router.get('/movies/:id', controller.movieDetail);
  router.get('/tv/:id', controller.tvDetail);
  router.get('/tv/:id/season/:seasonNumber', controller.seasonDetail);
  router.get('/people/:id', controller.personDetail);

  // Search & discovery (Phase 3)
  router.get('/search/multi', controller.search);
  router.get('/discover', controller.discover);

  // Shared
  router.get('/genres', controller.genres);

  return router;
}
