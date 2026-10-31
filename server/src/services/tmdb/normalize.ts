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

export interface VideoDto {
  key: string;
  site: string;
  type: string;
  name: string;
}

export interface CastMemberDto {
  personId: number;
  name: string;
  character: string | null;
  profilePath: string | null;
  sortIndex: number;
}

export interface CrewMemberDto {
  personId: number;
  name: string;
  job: string;
  department: string;
}

export interface SeasonSummaryDto {
  seasonNumber: number;
  name: string;
  overview: string | null;
  posterPath: string | null;
  airDate: string | null;
  episodeCount: number;
}

export interface EpisodeDto {
  episodeNumber: number;
  name: string;
  overview: string | null;
  stillPath: string | null;
  airDate: string | null;
  runtimeMinutes: number | null;
  voteAverage: number;
}

export interface SeasonDetailDto {
  seasonNumber: number;
  name: string;
  overview: string | null;
  posterPath: string | null;
  airDate: string | null;
  episodes: EpisodeDto[];
}

/** What the client needs from a title detail — shared shape for movies and TV. */
export interface TitleDetailDto {
  mediaType: 'movie' | 'tv';
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
  genres: GenreDto[];
  runtimeMinutes: number | null; // movie runtime
  episodeRunTimeMinutes: number[]; // tv
  numberOfSeasons: number | null;
  numberOfEpisodes: number | null;
  seasons: SeasonSummaryDto[];
  directors: CrewMemberDto[]; // movie Directors / tv Creators
  cast: CastMemberDto[];
  videos: VideoDto[];
  recommendations: Paginated<CatalogListItem>;
}

export interface PersonDto {
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
  | (CatalogListItem & { mediaType: 'movie' | 'tv' })
  | PersonSearchItem;

function asString(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function asNumber(v: unknown): number | null {
  return typeof v === 'number' ? v : null;
}

/** TMDB raw result fields differ between movie (title/release_date) and tv (name/first_air_date). */
export function normalizeListItem(raw: Record<string, unknown>, fallbackType: 'movie' | 'tv'): CatalogListItem {
  // Trending/search payloads stamp each item with its own media_type.
  const mediaType = raw.media_type === 'tv' || raw.media_type === 'movie' ? raw.media_type : fallbackType;
  const title = mediaType === 'movie' ? raw.title : raw.name;
  const date = mediaType === 'movie' ? raw.release_date : raw.first_air_date;

  return {
    mediaType,
    tmdbId: asNumber(raw.id) ?? 0,
    title: typeof title === 'string' ? title : 'Untitled',
    overview: asString(raw.overview),
    posterPath: asString(raw.poster_path),
    backdropPath: asString(raw.backdrop_path),
    voteAverage: typeof raw.vote_average === 'number' ? Math.round(raw.vote_average * 10) / 10 : 0,
    releaseDate: asString(date),
    genreIds: Array.isArray(raw.genre_ids) ? raw.genre_ids.filter((g): g is number => typeof g === 'number') : [],
  };
}

export function normalizeList(raw: TmdbListRaw, mediaType: 'movie' | 'tv', fallbackPage = 1): Paginated<CatalogListItem> {
  const results = Array.isArray(raw.results) ? raw.results : [];
  // TMDB caps list pages at 500
  const totalPages = Math.min(asNumber(raw.total_pages) ?? 1, 500);

  return {
    page: asNumber(raw.page) ?? fallbackPage,
    totalPages,
    totalResults: asNumber(raw.total_results) ?? results.length,
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

export function normalizeVideos(raw: { results?: Array<Record<string, unknown>> }): VideoDto[] {
  return (raw.results ?? [])
    .filter(
      (v): v is { key: string; site: string; type: string; name: string } =>
        v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser') && typeof v.key === 'string',
    )
    .map((v) => ({ key: v.key, site: v.site, type: v.type, name: v.name }));
}

function normalizeCast(raw: { cast?: Array<Record<string, unknown>> }): CastMemberDto[] {
  return (raw.cast ?? [])
    .filter((c): c is { id: number; name: string; character?: unknown; profile_path?: unknown; order?: unknown } =>
      typeof c.id === 'number' && typeof c.name === 'string')
    .map((c, i) => ({
      personId: c.id,
      name: c.name,
      character: asString(c.character),
      profilePath: asString(c.profile_path),
      sortIndex: typeof c.order === 'number' ? c.order : i,
    }))
    .sort((a, b) => a.sortIndex - b.sortIndex);
}

function normalizeCrew(raw: { crew?: Array<Record<string, unknown>> }): CrewMemberDto[] {
  return (raw.crew ?? [])
    .filter((c): c is { id: number; name: string; job: string; department: string } =>
      typeof c.id === 'number' && typeof c.name === 'string' && typeof c.job === 'string')
    .map((c) => ({ personId: c.id, name: c.name, job: c.job, department: typeof c.department === 'string' ? c.department : '' }));
}

export function normalizeSeasonSummary(raw: Record<string, unknown>): SeasonSummaryDto {
  return {
    seasonNumber: asNumber(raw.season_number) ?? 0,
    name: typeof raw.name === 'string' ? raw.name : `Season ${String(raw.season_number ?? '?')}`,
    overview: asString(raw.overview),
    posterPath: asString(raw.poster_path),
    airDate: asString(raw.air_date),
    episodeCount: asNumber(raw.episode_count) ?? 0,
  };
}

/**
 * Movies and TV share one detail DTO; raw shapes differ in field names
 * (title/name, release_date/first_air_date) and extras (runtime vs seasons).
 */
export function normalizeTitleDetail(
  raw: Record<string, unknown>,
  mediaType: 'movie' | 'tv',
  appendRaw: { credits?: { cast?: []; crew?: [] }; videos?: { results?: [] }; recommendations?: TmdbListRaw; similar?: TmdbListRaw },
): TitleDetailDto {
  const title = mediaType === 'movie' ? raw.title : raw.name;
  const releaseDate = mediaType === 'movie' ? raw.release_date : raw.first_air_date;
  const crew = normalizeCrew(appendRaw.credits ?? {});
  const directors =
    mediaType === 'movie'
      ? crew.filter((c) => c.job === 'Director')
      : Array.isArray(raw.created_by)
        ? (raw.created_by as Array<Record<string, unknown>>)
            .filter((c): c is { id: number; name: string; job: string; department: string } =>
              typeof c.id === 'number' && typeof c.name === 'string')
            .map((c) => ({ personId: c.id, name: c.name, job: 'Creator', department: 'Production' }))
        : [];

  const recommendations = appendRaw.recommendations?.results?.length
    ? normalizeList(appendRaw.recommendations, mediaType)
    : normalizeList(appendRaw.similar ?? {}, mediaType);

  return {
    mediaType,
    tmdbId: asNumber(raw.id) ?? 0,
    title: typeof title === 'string' ? title : 'Untitled',
    tagline: asString(raw.tagline),
    overview: asString(raw.overview),
    posterPath: asString(raw.poster_path),
    backdropPath: asString(raw.backdrop_path),
    voteAverage: typeof raw.vote_average === 'number' ? Math.round(raw.vote_average * 10) / 10 : 0,
    voteCount: asNumber(raw.vote_count) ?? 0,
    releaseDate: asString(releaseDate),
    status: asString(raw.status),
    originalLanguage: asString(raw.original_language),
    genres: normalizeGenres({ genres: raw.genres as TmdbGenresRaw['genres'] }),
    runtimeMinutes: mediaType === 'movie' ? asNumber(raw.runtime) : null,
    episodeRunTimeMinutes: mediaType === 'tv' && Array.isArray(raw.episode_run_time)
      ? raw.episode_run_time.filter((n): n is number => typeof n === 'number')
      : [],
    numberOfSeasons: mediaType === 'tv' ? asNumber(raw.number_of_seasons) : null,
    numberOfEpisodes: mediaType === 'tv' ? asNumber(raw.number_of_episodes) : null,
    seasons: mediaType === 'tv' && Array.isArray(raw.seasons)
      ? (raw.seasons as Array<Record<string, unknown>>).map(normalizeSeasonSummary)
      : [],
    directors,
    cast: normalizeCast(appendRaw.credits ?? {}),
    videos: normalizeVideos(appendRaw.videos ?? {}),
    recommendations,
  };
}

export function normalizeSeasonDetail(raw: Record<string, unknown>): SeasonDetailDto {
  return {
    seasonNumber: asNumber(raw.season_number) ?? 0,
    name: typeof raw.name === 'string' ? raw.name : `Season ${String(raw.season_number ?? '?')}`,
    overview: asString(raw.overview),
    posterPath: asString(raw.poster_path),
    airDate: asString(raw.air_date),
    episodes: Array.isArray(raw.episodes)
      ? (raw.episodes as Array<Record<string, unknown>>).map((e) => ({
          episodeNumber: asNumber(e.episode_number) ?? 0,
          name: typeof e.name === 'string' ? e.name : 'Episode',
          overview: asString(e.overview),
          stillPath: asString(e.still_path),
          airDate: asString(e.air_date),
          runtimeMinutes: asNumber(e.runtime),
          voteAverage: typeof e.vote_average === 'number' ? Math.round(e.vote_average * 10) / 10 : 0,
        }))
      : [],
  };
}

export function normalizePerson(raw: Record<string, unknown>, credits: { cast?: Array<Record<string, unknown>>; crew?: Array<Record<string, unknown>> }): PersonDto {
  const combined = [...(credits.cast ?? []), ...(credits.crew ?? [])];

  const titleCredits = combined
    .filter((c) => (c.media_type === 'movie' || c.media_type === 'tv') && typeof c.id === 'number')
    .sort((a, b) => (asNumber(b.popularity) ?? 0) - (asNumber(a.popularity) ?? 0));

  const knownFor: CatalogListItem[] = [];
  const seenKnown = new Set<string>();
  for (const c of titleCredits) {
    const key = `${String(c.media_type)}-${String(c.id)}`;
    if (seenKnown.has(key)) continue;
    seenKnown.add(key);
    knownFor.push(normalizeListItem(c as Record<string, unknown>, c.media_type === 'tv' ? 'tv' : 'movie'));
    if (knownFor.length >= 12) break;
  }

  const seen = new Set<string>();
  const filmography: CatalogListItem[] = [];
  for (const c of combined) {
    if (c.media_type !== 'movie' && c.media_type !== 'tv') continue;
    const key = `${c.media_type}-${String(c.id)}`;
    if (seen.has(key) || typeof c.id !== 'number') continue;
    seen.add(key);
    filmography.push(normalizeListItem(c as Record<string, unknown>, c.media_type === 'tv' ? 'tv' : 'movie'));
  }
  filmography.sort((a, b) => (b.releaseDate ?? '').localeCompare(a.releaseDate ?? ''));

  return {
    personId: asNumber(raw.id) ?? 0,
    name: typeof raw.name === 'string' ? raw.name : 'Unknown',
    biography: asString(raw.biography),
    birthday: asString(raw.birthday),
    deathday: asString(raw.deathday),
    placeOfBirth: asString(raw.place_of_birth),
    knownForDepartment: asString(raw.known_for_department),
    profilePath: asString(raw.profile_path),
    knownFor,
    filmography,
  };
}

export function normalizeSearchResults(raw: TmdbListRaw): Paginated<SearchResultItem> {
  const results = Array.isArray(raw.results) ? raw.results : [];
  const items: SearchResultItem[] = [];
  for (const r of results) {
    if (r.media_type === 'person' && typeof r.id === 'number' && typeof r.name === 'string') {
      items.push({
        mediaType: 'person',
        personId: r.id,
        name: r.name,
        profilePath: asString(r.profile_path),
        knownForDepartment: asString(r.known_for_department),
      });
    } else if (r.media_type === 'movie' || r.media_type === 'tv') {
      items.push(normalizeListItem(r, r.media_type));
    }
  }
  return {
    page: asNumber(raw.page) ?? 1,
    totalPages: Math.min(asNumber(raw.total_pages) ?? 1, 500),
    totalResults: asNumber(raw.total_results) ?? items.length,
    items,
  };
}
