import type { Request, Response, RequestHandler } from 'express';
import type { CatalogService } from '../services/tmdb/catalog.service.js';
import {
  genreQuerySchema,
  genreRowSchema,
  pageQuerySchema,
  trendingQuerySchema,
} from '../validators/catalog.js';

/** Thin HTTP layer: parse+validate, delegate to CatalogService, respond. */
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  trending: RequestHandler = async (req, res) => {
    const { window, page } = trendingQuerySchema.parse(req.query);
    const result = await this.catalog.trending('movie', window, page);
    res.json(result);
  };

  trendingTv: RequestHandler = async (req, res) => {
    const { window, page } = trendingQuerySchema.parse(req.query);
    const result = await this.catalog.trending('tv', window, page);
    res.json(result);
  };

  popular: RequestHandler = async (req, res) => {
    const { page } = pageQuerySchema.parse(req.query);
    res.json(await this.catalog.popular('movie', page));
  };

  topRated: RequestHandler = async (req, res) => {
    const { page } = pageQuerySchema.parse(req.query);
    res.json(await this.catalog.topRated('movie', page));
  };

  latest: RequestHandler = async (req, res) => {
    const { page } = pageQuerySchema.parse(req.query);
    res.json(await this.catalog.latest('movie', page));
  };

  popularTv: RequestHandler = async (req, res) => {
    const { page } = pageQuerySchema.parse(req.query);
    res.json(await this.catalog.popular('tv', page));
  };

  topRatedTv: RequestHandler = async (req, res) => {
    const { page } = pageQuerySchema.parse(req.query);
    res.json(await this.catalog.topRated('tv', page));
  };

  latestTv: RequestHandler = async (req, res) => {
    const { page } = pageQuerySchema.parse(req.query);
    res.json(await this.catalog.latest('tv', page));
  };

  genre: RequestHandler = async (req, res) => {
    const { mediaType, genreId, page } = genreRowSchema.parse({ ...req.params, ...req.query });
    res.json(await this.catalog.byGenre(mediaType, genreId, page));
  };

  genres: RequestHandler = async (req, res) => {
    const { mediaType } = genreQuerySchema.parse(req.query);
    res.json({ genres: await this.catalog.genres(mediaType) });
  };

  /** Exposed for tests: confirm a cache hit does not re-fetch upstream. */
  cacheStats(_req: Request, res: Response) {
    res.json(this.catalog.cacheStats());
  }
}
