export type MediaType = 'movie' | 'tv';

export interface CatalogListItem {
  mediaType: MediaType;
  tmdbId: number;
  title: string;
  overview: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  voteAverage: number;
  releaseDate: string | null;
  genreIds: number[];
}

export interface Paginated<T> {
  page: number;
  totalPages: number;
  totalResults: number;
  items: T[];
}

export interface Genre {
  id: number;
  name: string;
}

export interface TrendingWindow {
  window: 'day' | 'week';
}
