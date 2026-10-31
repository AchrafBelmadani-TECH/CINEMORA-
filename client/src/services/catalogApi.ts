import { apiClient } from './apiClient';
import type { CatalogListItem, Genre, MediaType, Paginated } from '@/types/catalog';

export type ListKind =
  | 'trending'
  | 'popular'
  | 'top-rated'
  | 'latest';

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
