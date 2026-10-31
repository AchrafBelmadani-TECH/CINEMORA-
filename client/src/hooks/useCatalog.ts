import { useQuery } from '@tanstack/react-query';
import {
  discoverParams,
  fetchByGenre,
  fetchDiscover,
  fetchGenres,
  fetchList,
  fetchMovieDetail,
  fetchPerson,
  fetchSearch,
  fetchSeason,
  fetchTvDetail,
  type ListKind,
  type ListParams,
} from '@/services/catalogApi';
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

/** Central query-key factory — predictable caching and invalidation. */
export const catalogKeys = {
  list: (mediaType: MediaType, kind: ListKind, page: number, window: 'day' | 'week') =>
    ['catalog', mediaType, kind, page, window] as const,
  genre: (mediaType: MediaType, genreId: number, page: number) =>
    ['catalog', 'genre', mediaType, genreId, page] as const,
  genres: (mediaType: MediaType) => ['genres', mediaType] as const,
  detail: (mediaType: MediaType, id: number) => ['detail', mediaType, id] as const,
  season: (tvId: number, seasonNumber: number) => ['season', tvId, seasonNumber] as const,
  person: (id: number) => ['person', id] as const,
  search: (query: string, page: number) => ['search', query.toLowerCase(), page] as const,
  discover: (filters: DiscoverFilters) => ['discover', discoverParams(filters)] as const,
};

const LIST_STALE_MS = 5 * 60_000; // mirrors the server TTL
const DETAIL_STALE_MS = 60 * 60_000;
const SEARCH_STALE_MS = 2 * 60_000;
const GENRES_STALE_MS = 24 * 60 * 60_000;

export function useCatalogList(params: ListParams) {
  const { mediaType, kind, page = 1, window = 'day' } = params;
  return useQuery<Paginated<CatalogListItem>>({
    queryKey: catalogKeys.list(mediaType, kind, page, window),
    queryFn: () => fetchList({ mediaType, kind, page, window }),
    staleTime: LIST_STALE_MS,
  });
}

export function useCatalogGenre(mediaType: MediaType, genreId: number, page = 1) {
  return useQuery<Paginated<CatalogListItem>>({
    queryKey: catalogKeys.genre(mediaType, genreId, page),
    queryFn: () => fetchByGenre(mediaType, genreId, page),
    staleTime: LIST_STALE_MS,
  });
}

export function useGenres(mediaType: MediaType) {
  return useQuery<Genre[]>({
    queryKey: catalogKeys.genres(mediaType),
    queryFn: () => fetchGenres(mediaType),
    staleTime: GENRES_STALE_MS,
  });
}

function useTitleDetail(mediaType: MediaType, id: number | undefined) {
  return useQuery<TitleDetail>({
    queryKey: catalogKeys.detail(mediaType, id ?? 0),
    queryFn: () => (mediaType === 'movie' ? fetchMovieDetail(id!) : fetchTvDetail(id!)),
    enabled: id !== undefined && Number.isFinite(id),
    staleTime: DETAIL_STALE_MS,
  });
}

export const useMovieDetail = (id: number | undefined) => useTitleDetail('movie', id);
export const useTvDetail = (id: number | undefined) => useTitleDetail('tv', id);

export function useSeason(tvId: number | undefined, seasonNumber: number | undefined) {
  return useQuery<SeasonDetail>({
    queryKey: catalogKeys.season(tvId ?? 0, seasonNumber ?? 0),
    queryFn: () => fetchSeason(tvId!, seasonNumber!),
    enabled: tvId !== undefined && seasonNumber !== undefined,
    staleTime: DETAIL_STALE_MS,
  });
}

export function usePerson(id: number | undefined) {
  return useQuery<PersonDetail>({
    queryKey: catalogKeys.person(id ?? 0),
    queryFn: () => fetchPerson(id!),
    enabled: id !== undefined && Number.isFinite(id),
    staleTime: DETAIL_STALE_MS,
  });
}

export function useSearch(query: string | undefined, page = 1) {
  return useQuery<Paginated<SearchResultItem>>({
    queryKey: catalogKeys.search(query ?? '', page),
    queryFn: () => fetchSearch(query!, page),
    enabled: query !== undefined && query.trim().length > 0,
    staleTime: SEARCH_STALE_MS,
  });
}

export function useDiscover(filters: DiscoverFilters) {
  return useQuery<Paginated<CatalogListItem>>({
    queryKey: catalogKeys.discover(filters),
    queryFn: () => fetchDiscover(filters),
    staleTime: LIST_STALE_MS,
  });
}
