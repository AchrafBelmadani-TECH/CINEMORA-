import { Router } from 'express';
import type { CatalogController } from '../controllers/catalog.controller.js';

/**
 * Catalog routes (Phase 2). Controllers parse/validate their own inputs —
 * Zod failures surface as 400 VALIDATION_ERROR via the central handler, and
 * Express 5 forwards async rejections to it as well.
 */
export function catalogRoutes(controller: CatalogController): Router {
  const router = Router();

  // Movies
  router.get('/movies/trending', controller.trending);
  router.get('/movies/popular', controller.popular);
  router.get('/movies/top-rated', controller.topRated);
  router.get('/movies/upcoming', controller.latest);
  router.get('/movies/genre/:genreId', controller.genre);

  // TV
  router.get('/tv/trending', controller.trendingTv);
  router.get('/tv/popular', controller.popularTv);
  router.get('/tv/top-rated', controller.topRatedTv);
  router.get('/tv/on-the-air', controller.latestTv);
  router.get('/tv/genre/:genreId', controller.genre);

  // Shared
  router.get('/discover', controller.genre);
  router.get('/genres', controller.genres);

  return router;
}
