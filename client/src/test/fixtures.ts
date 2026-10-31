import type {
  CatalogListItem,
  Genre,
  Paginated,
  PersonDetail,
  SeasonDetail,
  SearchResultItem,
  TitleDetail,
} from '@/types/catalog';

export function makeItem(overrides: Partial<CatalogListItem> = {}, index = 0): CatalogListItem {
  return {
    mediaType: 'movie',
    tmdbId: 100 + index,
    title: `Movie ${index + 1}`,
    overview: 'An overview.',
    posterPath: `/poster-${index}.jpg`,
    backdropPath: `/backdrop-${index}.jpg`,
    voteAverage: 7.5,
    releaseDate: '2024-02-27',
    genreIds: [28],
    ...overrides,
  };
}

export function makePage(count = 12, overrides: Partial<Paginated<CatalogListItem>> = {}): Paginated<CatalogListItem> {
  return {
    page: 1,
    totalPages: 3,
    totalResults: 30,
    items: Array.from({ length: count }, (_, i) => makeItem({}, i)),
    ...overrides,
  };
}

export const testGenres: Genre[] = [
  { id: 28, name: 'Action' },
  { id: 878, name: 'Science Fiction' },
  { id: 18, name: 'Drama' },
];

/** Full detail fixture, switchable between movie and TV shapes. */
export function makeDetail(overrides: Partial<TitleDetail> = {}): TitleDetail {
  return {
    mediaType: 'movie',
    tmdbId: 693134,
    title: 'Dune: Part Two',
    tagline: 'Long live the fighters.',
    overview: 'Paul Atreides unites with the Fremen.',
    posterPath: '/poster.jpg',
    backdropPath: '/backdrop.jpg',
    voteAverage: 8.2,
    voteCount: 4600,
    releaseDate: '2024-02-27',
    status: 'Released',
    originalLanguage: 'en',
    genres: [{ id: 878, name: 'Science Fiction' }],
    runtimeMinutes: 166,
    episodeRunTimeMinutes: [],
    numberOfSeasons: null,
    numberOfEpisodes: null,
    seasons: [],
    directors: [{ personId: 525, name: 'Denis Villeneuve', job: 'Director', department: 'Directing' }],
    cast: [
      { personId: 1136406, name: 'Timothée Chalamet', character: 'Paul Atreides', profilePath: '/timo.jpg' },
      { personId: 11892, name: 'Rebecca Ferguson', character: 'Lady Jessica', profilePath: null },
    ],
    videos: [{ key: 'Way9Dexny3w', site: 'YouTube', type: 'Trailer', name: 'Official Trailer' }],
    recommendations: makePage(6),
    ...overrides,
  };
}

export function makeTvDetail(overrides: Partial<TitleDetail> = {}): TitleDetail {
  return makeDetail({
    mediaType: 'tv',
    tmdbId: 1399,
    title: 'Game of Thrones',
    tagline: 'Winter is coming.',
    releaseDate: '2011-04-17',
    runtimeMinutes: null,
    episodeRunTimeMinutes: [57],
    numberOfSeasons: 8,
    numberOfEpisodes: 73,
    status: 'Ended',
    genres: [{ id: 18, name: 'Drama' }],
    seasons: [
      { seasonNumber: 1, name: 'Season 1', overview: 'Ned arrives.', posterPath: '/s1.jpg', airDate: '2011-04-17', episodeCount: 10 },
      { seasonNumber: 2, name: 'Season 2', overview: null, posterPath: null, airDate: '2012-04-01', episodeCount: 10 },
    ],
    directors: [{ personId: 22970, name: 'David Benioff', job: 'Creator', department: 'Production' }],
    videos: [],
    ...overrides,
  });
}

export function makeSeason(): SeasonDetail {
  return {
    seasonNumber: 1,
    name: 'Season 1',
    overview: 'Ned arrives.',
    posterPath: '/s1.jpg',
    airDate: '2011-04-17',
    episodes: [
      { episodeNumber: 1, name: 'Winter Is Coming', overview: 'Eddard is torn.', stillPath: '/e1.jpg', airDate: '2011-04-17', runtimeMinutes: 62, voteAverage: 7.8 },
      { episodeNumber: 2, name: 'The Kingsroad', overview: null, stillPath: null, airDate: '2011-04-24', runtimeMinutes: 56, voteAverage: 0 },
    ],
  };
}

export function makePerson(): PersonDetail {
  return {
    personId: 525,
    name: 'Denis Villeneuve',
    biography: 'Canadian film director.',
    birthday: '1967-10-03',
    deathday: null,
    placeOfBirth: 'Gentilly, Québec, Canada',
    knownForDepartment: 'Directing',
    profilePath: '/denis.jpg',
    knownFor: [makeItem({ title: 'Dune: Part Two', tmdbId: 693134 }, 0), makeItem({ title: 'Arrival', tmdbId: 329865 }, 1)],
    filmography: [makeItem({ title: 'Dune: Part Two', tmdbId: 693134, releaseDate: '2024-02-27' }, 0), makeItem({ title: 'Arrival', tmdbId: 329865, releaseDate: '2016-11-10' }, 1)],
  };
}

export function makeSearchResults(): Paginated<SearchResultItem> {
  return {
    page: 1,
    totalPages: 2,
    totalResults: 12,
    items: [
      makeItem({ title: 'Dune: Part Two', tmdbId: 693134 }, 0),
      { mediaType: 'person', personId: 525, name: 'Denis Villeneuve', profilePath: '/v.jpg', knownForDepartment: 'Directing' },
    ],
  };
}
