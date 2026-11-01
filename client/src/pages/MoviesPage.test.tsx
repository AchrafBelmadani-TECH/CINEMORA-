import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MoviesPage } from './catalog/MoviesPage';
import { testProviders } from '@/test/testProviders';

// Hoisted top-level mock — echo the requested page so URL-driven
// pagination is observable in assertions.

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
  fetchByGenre: vi.fn(() => Promise.resolve({ page: 1, totalPages: 1, totalResults: 0, items: [] })),
  fetchGenres: vi.fn(() => Promise.resolve([{ id: 28, name: 'Action' }])),
}));

describe('MoviesPage', () => {
  it('renders the catalog grid with page metadata', async () => {
    render(testProviders(<MoviesPage />, { route: '/movies' }));

    expect(screen.getByRole('heading', { name: 'Movies' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText(/Movie \d+/).length).toBeGreaterThan(0));
    expect(screen.getByText(/Page 1 of 3/)).toBeInTheDocument();
  });

  it('moves to the next page through the URL', async () => {
    const user = userEvent.setup();
    render(testProviders(<MoviesPage />, { route: '/movies' }));

    await waitFor(() => expect(screen.getByRole('button', { name: /next/i })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: /next/i }));

    // URL-driven pagination — page 2 requested
    await waitFor(() => expect(screen.getByText(/Page 2 of 3/)).toBeInTheDocument());
  });
});
