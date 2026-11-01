import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HomePage } from './HomePage';
import { testProviders } from '@/test/testProviders';

// Top-level (hoisted) mock: applies to the static imports of the whole
// module graph. Self-contained — vi.mock factories cannot close over
// regular top-level variables.

vi.mock('@/services/authApi', () => ({
  authApi: {
    refresh: vi.fn(() => Promise.reject(new Error('no session in tests'))),
    login: vi.fn(), register: vi.fn(), logout: vi.fn(), me: vi.fn(),
    listProfiles: vi.fn(() => Promise.resolve({ profiles: [] })),
    createProfile: vi.fn(), updateProfile: vi.fn(), deleteProfile: vi.fn(), activateProfile: vi.fn(),
  },
  AVATAR_PRESETS: ['aurora'],
  bindSessionHandlers: vi.fn(() => () => {}),
  setAccessToken: vi.fn(),
}));

vi.mock('@/services/catalogApi', () => ({
  fetchList: vi.fn((params: { page?: number }) =>
    Promise.resolve({
      page: params?.page ?? 1,
      totalPages: 3,
      totalResults: 30,
      items: Array.from({ length: 12 }, (_, i) => ({
        mediaType: 'movie',
        tmdbId: 100 + i,
        title: `Movie ${i + 1}`,
        overview: 'An overview.',
        posterPath: `/poster-${i}.jpg`,
        backdropPath: `/backdrop-${i}.jpg`,
        voteAverage: 7.5,
        releaseDate: '2024-02-27',
        genreIds: [28],
      })),
    }),
  ),
  fetchByGenre: vi.fn(() =>
    Promise.resolve({
      page: 1,
      totalPages: 1,
      totalResults: 6,
      items: Array.from({ length: 6 }, (_, i) => ({
        mediaType: 'movie',
        tmdbId: 200 + i,
        title: `Genre Movie ${i + 1}`,
        overview: 'An overview.',
        posterPath: `/genre-${i}.jpg`,
        backdropPath: null,
        voteAverage: 6.8,
        releaseDate: '2023-11-03',
        genreIds: [28],
      })),
    }),
  ),
  fetchGenres: vi.fn(() =>
    Promise.resolve([
      { id: 28, name: 'Action' },
      { id: 878, name: 'Science Fiction' },
      { id: 18, name: 'Drama' },
    ]),
  ),
  fetchMovieDetail: vi.fn(),
  fetchTvDetail: vi.fn(),
  fetchSeason: vi.fn(),
  fetchPerson: vi.fn(),
  fetchSearch: vi.fn(),
  fetchDiscover: vi.fn(),
        discoverParams: vi.fn((filters) => ({ ...filters })),
  }));

describe('HomePage (Phase 2)', () => {
  it('renders the hero and the curated collection rows from real API data', async () => {
    render(testProviders(<HomePage />));

    // hero shows the first trending movie; rows render their headings
    await waitFor(() => expect(screen.getAllByText('Movie 1').length).toBeGreaterThan(0));

    expect(screen.getByText('FEATURED TODAY')).toBeInTheDocument();
    for (const row of [
      'Trending Now',
      'Popular Movies',
      'Top Rated',
      'Latest Releases',
      'Action Movies',
      'Science Fiction',
      'Drama',
      'Horror',
      'Comedy',
      'Popular TV Series',
    ]) {
      expect(screen.getAllByRole('heading', { name: row }).length).toBeGreaterThan(0);
    }
  });

  it('exposes browse links that exist in Phase 2 and no personal rows yet', async () => {
    render(testProviders(<HomePage />));

    await waitFor(() => expect(screen.getAllByText('Movie 1').length).toBeGreaterThan(0));
    expect(screen.getAllByRole('link', { name: /Browse movies/i }).length).toBe(2);
    expect(screen.getByRole('link', { name: /Browse series/i })).toBeInTheDocument();
    // personalization rows arrive in Phases 5–6 — absent, not faked
    expect(screen.queryByText('Recommended For You')).toBeNull();
    expect(screen.queryByText('Continue Watching')).toBeNull();
  });

  it('shows a designed error state with retry when the catalog fails', async () => {
    vi.resetModules();
    vi.doMock('@/services/catalogApi', () => ({
      fetchList: vi.fn(() => Promise.reject(new Error('boom'))),
      fetchByGenre: vi.fn(() => Promise.reject(new Error('boom'))),
      fetchGenres: vi.fn(() => Promise.reject(new Error('boom'))),
            discoverParams: vi.fn((filters) => ({ ...filters })),
    }));
    const { HomePage: FailingHomePage } = await import('./HomePage');
    const user = userEvent.setup();

    render(testProviders(<FailingHomePage />));

    const retryButtons = await screen.findAllByRole('button', { name: /try again/i });
    expect(retryButtons.length).toBeGreaterThan(0);
    await user.click(retryButtons[0]!);
  });
});
