export interface TmdbListRaw {
  page?: number;
  results?: Array<Record<string, unknown>>;
  total_pages?: number;
  total_results?: number;
}

export interface CatalogListItem {
  mediaType: 'movie' | 'tv';
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

export interface GenreDto {
  id: number;
  name: string;
}

/** TMDB raw result fields differ between movie (title/release_date) and tv (name/first_air_date). */
export function normalizeListItem(raw: Record<string, unknown>, fallbackType: 'movie' | 'tv'): CatalogListItem {
  // Trending/search payloads stamp each item with its own media_type.
  const mediaType = raw.media_type === 'tv' || raw.media_type === 'movie' ? raw.media_type : fallbackType;
  const title = mediaType === 'movie' ? raw.title : raw.name;
  const date = mediaType === 'movie' ? raw.release_date : raw.first_air_date;

  return {
    mediaType,
    tmdbId: typeof raw.id === 'number' ? raw.id : 0,
    title: typeof title === 'string' ? title : 'Untitled',
    overview: typeof raw.overview === 'string' && raw.overview.length > 0 ? raw.overview : null,
    posterPath: typeof raw.poster_path === 'string' ? raw.poster_path : null,
    backdropPath: typeof raw.backdrop_path === 'string' ? raw.backdrop_path : null,
    voteAverage: typeof raw.vote_average === 'number' ? Math.round(raw.vote_average * 10) / 10 : 0,
    releaseDate: typeof date === 'string' && date.length > 0 ? date : null,
    genreIds: Array.isArray(raw.genre_ids) ? raw.genre_ids.filter((g): g is number => typeof g === 'number') : [],
  };
}

export function normalizeList(raw: TmdbListRaw, mediaType: 'movie' | 'tv', fallbackPage = 1): Paginated<CatalogListItem> {
  const results = Array.isArray(raw.results) ? raw.results : [];
  // TMDB caps list pages at 500
  const totalPages = Math.min(typeof raw.total_pages === 'number' ? raw.total_pages : 1, 500);

  return {
    page: typeof raw.page === 'number' ? raw.page : fallbackPage,
    totalPages,
    totalResults: typeof raw.total_results === 'number' ? raw.total_results : results.length,
    items: results.map((item) => normalizeListItem(item, mediaType)),
  };
}

export interface TmdbGenresRaw {
  genres?: Array<{ id?: number; name?: string }>;
}

export function normalizeGenres(raw: TmdbGenresRaw): GenreDto[] {
  return (raw.genres ?? [])
    .filter((g): g is { id: number; name: string } => typeof g.id === 'number' && typeof g.name === 'string')
    .map((g) => ({ id: g.id, name: g.name }));
}
