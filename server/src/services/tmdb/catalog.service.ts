import type { Logger } from '../../lib/logger.js';
import type { Env } from '../../lib/env.js';
import { TmdbCache } from './cache.js';
import { TmdbClient } from './tmdbClient.js';
import {
  normalizeGenres,
  normalizeList,
  normalizePerson,
  normalizeSearchResults,
  normalizeSeasonDetail,
  normalizeTitleDetail,
  type CatalogListItem,
  type GenreDto,
  type Paginated,
  type PersonDto,
  type SearchResultItem,
  type SeasonDetailDto,
  type TitleDetailDto,
  type TmdbGenresRaw,
  type TmdbListRaw,
} from './normalize.js';

export type MediaType = 'movie' | 'tv';
export type TrendingWindow = 'day' | 'week';

const LIST_TTL_MS = 5 * 60_000;
const DETAIL_TTL_MS = 60 * 60_000;
const SEARCH_TTL_MS = 2 * 60_000;
const GENRES_TTL_MS = 24 * 60 * 60_000;

/** Whitelisted sort options accepted from the client. */
export const DISCOVER_SORTS = ['popularity.desc', 'vote_average.desc', 'release_date.desc'] as const;
export type DiscoverSort = (typeof DISCOVER_SORTS)[number];

export interface DiscoverParams {
  mediaType: MediaType;
  page: number;
  genresCsv?: string;
  genreId?: number;
  yearFrom?: number;
  yearTo?: number;
  voteAverageGte?: number;
  language?: string;
  sortBy: DiscoverSort;
}

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

  /** Detail with credits, videos and recommendations in a single upstream call. */
  movieDetail(id: number): Promise<TitleDetailDto> {
    return this.cachedDetail('movie', id);
  }

  tvDetail(id: number): Promise<TitleDetailDto> {
    return this.cachedDetail('tv', id);
  }

  season(tvId: number, seasonNumber: number): Promise<SeasonDetailDto> {
    const key = `detail:tv:${tvId}:season:${seasonNumber}`;
    return this.cache.get<SeasonDetailDto>(key, DETAIL_TTL_MS, async () => {
      const raw = await this.client.getJson<Record<string, unknown>>(`/tv/${tvId}/season/${seasonNumber}`);
      return normalizeSeasonDetail(raw);
    });
  }

  person(id: number): Promise<PersonDto> {
    const key = `person:${id}`;
    return this.cache.get<PersonDto>(key, DETAIL_TTL_MS, async () => {
      const raw = await this.client.getJson<{ combined_credits?: { cast?: []; crew?: [] } } & Record<string, unknown>>(
        `/person/${id}`,
        { append_to_response: 'combined_credits' },
      );
      const { combined_credits: credits, ...rest } = raw;
      return normalizePerson(rest, credits ?? {});
    });
  }

  searchMulti(query: string, page = 1): Promise<Paginated<SearchResultItem>> {
    const key = `search:multi:${query.toLowerCase()}:p${page}`;
    return this.cache.get<Paginated<SearchResultItem>>(key, SEARCH_TTL_MS, async () => {
      const raw = await this.client.getJson<TmdbListRaw>('/search/multi', {
        query,
        page,
        include_adult: 'false',
      });
      return normalizeSearchResults(raw);
    });
  }

  discover(params: DiscoverParams): Promise<Paginated<CatalogListItem>> {
    const {
      mediaType, page, genresCsv, genreId, yearFrom, yearTo, voteAverageGte, language, sortBy,
    } = params;

    const upstream: Record<string, string | number | undefined> = {
      page,
      include_adult: 'false',
      sort_by: sortBy === 'release_date.desc'
        ? mediaType === 'movie' ? 'primary_release_date.desc' : 'first_air_date.desc'
        : sortBy,
    };
    const withGenres = genresCsv ?? (genreId !== undefined ? String(genreId) : undefined);
    if (withGenres) upstream.with_genres = withGenres;
    if (voteAverageGte !== undefined) {
      upstream['vote_average.gte'] = voteAverageGte;
      upstream['vote_count.gte'] = 50; // avoid unrated junk inflating the rating filter
    }
    if (language) upstream.with_original_language = language;
    if (yearFrom !== undefined) {
      upstream[mediaType === 'movie' ? 'primary_release_date.gte' : 'first_air_date.gte'] = `${yearFrom}-01-01`;
    }
    if (yearTo !== undefined) {
      upstream[mediaType === 'movie' ? 'primary_release_date.lte' : 'first_air_date.lte'] = `${yearTo}-12-31`;
    }

    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(upstream)) {
      if (v !== undefined) search.set(k, String(v));
    }
    const key = `discover:${mediaType}:${search.toString()}`;
    return this.cache.get<Paginated<CatalogListItem>>(key, LIST_TTL_MS, async () => {
      const raw = await this.client.getJson<TmdbListRaw>(`/discover/${mediaType}`, upstream);
      return normalizeList(raw, mediaType, page);
    });
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

  private cachedDetail(mediaType: MediaType, id: number): Promise<TitleDetailDto> {
    const key = `detail:${mediaType}:${id}`;
    return this.cache.get<TitleDetailDto>(key, DETAIL_TTL_MS, async () => {
      const raw = await this.client.getJson<Record<string, unknown>>(`/${mediaType}/${id}`, {
        append_to_response: 'credits,videos,recommendations,similar',
      });
      const appendRaw = {
        credits: raw.credits as { cast?: []; crew?: [] } | undefined,
        videos: raw.videos as { results?: [] } | undefined,
        recommendations: raw.recommendations as TmdbListRaw | undefined,
        similar: raw.similar as TmdbListRaw | undefined,
      };
      return normalizeTitleDetail(raw, mediaType, appendRaw);
    });
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
