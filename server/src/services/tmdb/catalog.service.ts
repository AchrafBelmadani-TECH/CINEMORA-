import type { Logger } from '../../lib/logger.js';
import type { Env } from '../../lib/env.js';
import { TmdbCache } from './cache.js';
import { TmdbClient } from './tmdbClient.js';
import {
  normalizeGenres,
  normalizeList,
  type CatalogListItem,
  type GenreDto,
  type Paginated,
  type TmdbGenresRaw,
  type TmdbListRaw,
} from './normalize.js';

export type MediaType = 'movie' | 'tv';
export type TrendingWindow = 'day' | 'week';

const LIST_TTL_MS = 5 * 60_000;
const GENRES_TTL_MS = 24 * 60 * 60_000;

/**
 * Read-only access to the TMDB catalog, cached in-memory with single-flight.
 * Every method returns CINEMORA-normalized DTOs — raw TMDB shapes never
 * leave this module.
 */
export class CatalogService {
  private readonly client: TmdbClient;
  private readonly cache: TmdbCache;

  constructor(env: Env, logger: Logger, fetchImpl?: typeof fetch) {
    this.client = new TmdbClient({ token: env.TMDB_READ_ACCESS_TOKEN, logger, fetchImpl });
    this.cache = new TmdbCache({ logger });
  }

  get configured(): boolean {
    return this.client.configured;
  }

  trending(mediaType: MediaType, window: TrendingWindow, page = 1): Promise<Paginated<CatalogListItem>> {
    return this.cachedList(`/trending/${mediaType}/${window}`, { page }, mediaType);
  }

  popular(mediaType: MediaType, page = 1): Promise<Paginated<CatalogListItem>> {
    return this.cachedList(`/${mediaType}/popular`, { page }, mediaType);
  }

  topRated(mediaType: MediaType, page = 1): Promise<Paginated<CatalogListItem>> {
    return this.cachedList(`/${mediaType}/top_rated`, { page }, mediaType);
  }

  /** Movies: upcoming releases. Series: currently on the air. */
  latest(mediaType: MediaType, page = 1): Promise<Paginated<CatalogListItem>> {
    const path = mediaType === 'movie' ? '/movie/upcoming' : '/tv/on_the_air';
    return this.cachedList(path, { page }, mediaType);
  }

  byGenre(mediaType: MediaType, genreId: number, page = 1): Promise<Paginated<CatalogListItem>> {
    return this.cachedList(`/discover/${mediaType}`, { with_genres: genreId, sort_by: 'popularity.desc', page, include_adult: 'false' }, mediaType);
  }

  async genres(mediaType: MediaType): Promise<GenreDto[]> {
    const key = `genres:${mediaType}`;
    const raw = await this.cache.get<TmdbGenresRaw>(key, GENRES_TTL_MS, () =>
      this.client.getJson<TmdbGenresRaw>(`/genre/${mediaType}/list`),
    );
    return normalizeGenres(raw);
  }

  cacheStats() {
    return this.cache.stats();
  }

  private cachedList(
    path: string,
    params: Record<string, string | number | undefined>,
    mediaType: MediaType,
  ): Promise<Paginated<CatalogListItem>> {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) search.set(key, String(value));
    }
    const key = `${path}?${search.toString()}`;
    return this.cache.get<Paginated<CatalogListItem>>(key, LIST_TTL_MS, async () => {
      const raw = await this.client.getJson<TmdbListRaw>(path, params);
      return normalizeList(raw, mediaType, typeof params.page === 'number' ? params.page : 1);
    });
  }
}
