import type { RequestHandler } from 'express';
import type { CatalogService } from '../services/tmdb/catalog.service.js';
import {
  discoverQuerySchema,
  genreQuerySchema,
  genreRowSchema,
  pageQuerySchema,
  searchQuerySchema,
  seasonParamsSchema,
  titleParamsSchema,
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

  movieDetail: RequestHandler = async (req, res) => {
    const { id } = titleParamsSchema.parse(req.params);
    res.json(await this.catalog.movieDetail(id));
  };

  tvDetail: RequestHandler = async (req, res) => {
    const { id } = titleParamsSchema.parse(req.params);
    res.json(await this.catalog.tvDetail(id));
  };

  seasonDetail: RequestHandler = async (req, res) => {
    const { id, seasonNumber } = seasonParamsSchema.parse(req.params);
    res.json(await this.catalog.season(id, seasonNumber));
  };

  personDetail: RequestHandler = async (req, res) => {
    const { id } = titleParamsSchema.parse(req.params);
    res.json(await this.catalog.person(id));
  };

  search: RequestHandler = async (req, res) => {
    const { query, page } = searchQuerySchema.parse(req.query);
    res.json(await this.catalog.searchMulti(query, page));
  };

  discover: RequestHandler = async (req, res) => {
    const q = discoverQuerySchema.parse({ ...req.params, ...req.query });
    res.json(
      await this.catalog.discover({
        mediaType: q.mediaType,
        page: q.page,
        genreId: q.genreId,
        genresCsv: q.genres,
        yearFrom: q.yearFrom,
        yearTo: q.yearTo,
        voteAverageGte: q.voteAverageGte,
        language: q.language,
        sortBy: q.sortBy,
      }),
    );
  };

  genres: RequestHandler = async (req, res) => {
    const { mediaType } = genreQuerySchema.parse(req.query);
    res.json({ genres: await this.catalog.genres(mediaType) });
  };
}
