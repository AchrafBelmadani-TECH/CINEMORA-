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

export interface VideoDto {
  key: string;
  site: string;
  type: string;
  name: string;
}

export interface CastMember {
  personId: number;
  name: string;
  character: string | null;
  profilePath: string | null;
}

export interface CrewMember {
  personId: number;
  name: string;
  job: string;
  department: string;
}

export interface SeasonSummary {
  seasonNumber: number;
  name: string;
  overview: string | null;
  posterPath: string | null;
  airDate: string | null;
  episodeCount: number;
}

export interface Episode {
  episodeNumber: number;
  name: string;
  overview: string | null;
  stillPath: string | null;
  airDate: string | null;
  runtimeMinutes: number | null;
  voteAverage: number;
}

export interface SeasonDetail {
  seasonNumber: number;
  name: string;
  overview: string | null;
  posterPath: string | null;
  airDate: string | null;
  episodes: Episode[];
}

export interface TitleDetail {
  mediaType: MediaType;
  tmdbId: number;
  title: string;
  tagline: string | null;
  overview: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  voteAverage: number;
  voteCount: number;
  releaseDate: string | null;
  status: string | null;
  originalLanguage: string | null;
  genres: Genre[];
  runtimeMinutes: number | null;
  episodeRunTimeMinutes: number[];
  numberOfSeasons: number | null;
  numberOfEpisodes: number | null;
  seasons: SeasonSummary[];
  directors: CrewMember[];
  cast: CastMember[];
  videos: VideoDto[];
  recommendations: Paginated<CatalogListItem>;
}

export interface PersonDetail {
  personId: number;
  name: string;
  biography: string | null;
  birthday: string | null;
  deathday: string | null;
  placeOfBirth: string | null;
  knownForDepartment: string | null;
  profilePath: string | null;
  knownFor: CatalogListItem[];
  filmography: CatalogListItem[];
}

export interface PersonSearchItem {
  mediaType: 'person';
  personId: number;
  name: string;
  profilePath: string | null;
  knownForDepartment: string | null;
}

export type SearchResultItem =
  | (CatalogListItem & { mediaType: MediaType })
  | PersonSearchItem;

export function isPerson(item: SearchResultItem): item is PersonSearchItem {
  return item.mediaType === 'person';
}

export interface DiscoverFilters {
  mediaType: MediaType;
  genres: number[];
  yearFrom?: number;
  yearTo?: number;
  voteAverageGte?: number;
  language?: string;
  sortBy: 'popularity.desc' | 'vote_average.desc' | 'release_date.desc';
  page: number;
}
