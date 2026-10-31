import { apiClient } from './apiClient';
import type {
  CatalogListItem,
  DiscoverFilters,
  Genre,
  MediaType,
  Paginated,
  PersonDetail,
  SeasonDetail,
  SearchResultItem,
  TitleDetail,
} from '@/types/catalog';

export type ListKind = 'trending' | 'popular' | 'top-rated' | 'latest';

const listPaths: Record<MediaType, Record<ListKind, string>> = {
  movie: {
    trending: '/movies/trending',
    popular: '/movies/popular',
    'top-rated': '/movies/top-rated',
    latest: '/movies/upcoming',
  },
  tv: {
    trending: '/tv/trending',
    popular: '/tv/popular',
    'top-rated': '/tv/top-rated',
    latest: '/tv/on-the-air',
  },
};

export interface ListParams {
  mediaType: MediaType;
  kind: ListKind;
  page?: number;
  window?: 'day' | 'week';
}

export function fetchList({ mediaType, kind, page = 1, window = 'day' }: ListParams): Promise<Paginated<CatalogListItem>> {
  return apiClient.get<Paginated<CatalogListItem>>(listPaths[mediaType][kind], { page, window });
}

export function fetchByGenre(mediaType: MediaType, genreId: number, page = 1): Promise<Paginated<CatalogListItem>> {
  return apiClient.get<Paginated<CatalogListItem>>('/discover', { mediaType, genreId, page });
}

export async function fetchGenres(mediaType: MediaType): Promise<Genre[]> {
  const body = await apiClient.get<{ genres: Genre[] }>('/genres', { mediaType });
  return body.genres;
}

export function fetchMovieDetail(id: number): Promise<TitleDetail> {
  return apiClient.get<TitleDetail>(`/movies/${id}`);
}

export function fetchTvDetail(id: number): Promise<TitleDetail> {
  return apiClient.get<TitleDetail>(`/tv/${id}`);
}

export function fetchSeason(tvId: number, seasonNumber: number): Promise<SeasonDetail> {
  return apiClient.get<SeasonDetail>(`/tv/${tvId}/season/${seasonNumber}`);
}

export function fetchPerson(id: number): Promise<PersonDetail> {
  return apiClient.get<PersonDetail>(`/people/${id}`);
}

export function fetchSearch(query: string, page = 1): Promise<Paginated<SearchResultItem>> {
  return apiClient.get<Paginated<SearchResultItem>>('/search/multi', { query, page });
}

/** Serializes DiscoverFilters into API params (genre csv, year bounds, etc.). */
export function discoverParams(filters: DiscoverFilters): Record<string, string | number | undefined> {
  return {
    mediaType: filters.mediaType,
    page: filters.page,
    genres: filters.genres.length > 0 ? filters.genres.join(',') : undefined,
    yearFrom: filters.yearFrom,
    yearTo: filters.yearTo,
    voteAverageGte: filters.voteAverageGte,
    language: filters.language,
    sortBy: filters.sortBy,
  };
}

export function fetchDiscover(filters: DiscoverFilters): Promise<Paginated<CatalogListItem>> {
  return apiClient.get<Paginated<CatalogListItem>>('/discover', discoverParams(filters));
}
