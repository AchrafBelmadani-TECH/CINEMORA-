import type { CatalogListItem, Genre, Paginated } from '@/types/catalog';

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
