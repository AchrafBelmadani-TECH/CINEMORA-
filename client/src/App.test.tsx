import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '@/App';
import { testProviders } from '@/test/testProviders';

// Hoisted top-level mock for the whole catalog API surface.
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
}));

describe('App shell', () => {
  it('renders navbar with the full Phase 2 navigation and footer', () => {
    render(testProviders(<App />));

    expect(screen.getAllByText('CINEM').length).toBeGreaterThan(0);
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
    for (const link of ['Home', 'Movies', 'Series', 'Genres']) {
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

    await user.click(screen.getByRole('link', { name: 'Movies' }));
    expect(await screen.findByRole('heading', { name: 'Movies' })).toBeInTheDocument();
  });
});
