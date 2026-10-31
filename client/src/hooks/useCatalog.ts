import { useQuery } from '@tanstack/react-query';
import { fetchByGenre, fetchGenres, fetchList, type ListKind, type ListParams } from '@/services/catalogApi';
import type { CatalogListItem, Genre, MediaType, Paginated } from '@/types/catalog';

/** Central query-key factory — predictable caching and invalidation. */
export const catalogKeys = {
  list: (mediaType: MediaType, kind: ListKind, page: number, window: 'day' | 'week') =>
    ['catalog', mediaType, kind, page, window] as const,
  genre: (mediaType: MediaType, genreId: number, page: number) =>
    ['catalog', 'genre', mediaType, genreId, page] as const,
  genres: (mediaType: MediaType) => ['genres', mediaType] as const,
};

const LIST_STALE_MS = 5 * 60_000; // mirrors the server TTL
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
