import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '@/App';
import { testProviders } from '@/test/testProviders';

// Hoisted top-level mock for the whole catalog API surface.

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
  fetchList: vi.fn(() =>
    Promise.resolve({
      page: 1,
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
  fetchByGenre: vi.fn(() => Promise.resolve({ page: 1, totalPages: 1, totalResults: 6, items: [] })),
  fetchGenres: vi.fn(() => Promise.resolve([{ id: 28, name: 'Action' }])),
  fetchMovieDetail: vi.fn(),
  fetchTvDetail: vi.fn(),
  fetchSeason: vi.fn(),
  fetchPerson: vi.fn(),
  fetchSearch: vi.fn(),
  fetchDiscover: vi.fn(),
        discoverParams: vi.fn((filters) => ({ ...filters })),
  }));

describe('App shell', () => {
  it('renders navbar with the full Phase 2 navigation and footer', async () => {
    render(testProviders(<App />));

    // bootstrap resolves asynchronously — wait for the shell
    expect(await screen.findByRole('link', { name: 'Skip to content' })).toBeInTheDocument();
    expect(screen.getAllByText('CINEM').length).toBeGreaterThan(0);
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
    for (const link of ['Home', 'Movies', 'Series', 'Genres', 'Discover']) {
      expect(screen.getAllByRole('link', { name: link }).length).toBeGreaterThan(0);
    }
    expect(screen.getByText(/© 2026 CINEMORA/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Skip to content' })).toBeInTheDocument();
    // Required TMDB attribution
    expect(screen.getByText(/uses the TMDB API but is not endorsed or certified by/i)).toBeInTheDocument();
  });

  it('navigates to the movies catalog via the navbar', async () => {
    const user = userEvent.setup();
    render(testProviders(<App />));

    const moviesLinks = await screen.findAllByRole('link', { name: 'Movies' });
    await user.click(moviesLinks[0]!);
    expect(await screen.findByRole('heading', { name: 'Movies' })).toBeInTheDocument();
  });
});
