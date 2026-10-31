import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DiscoverPage } from './DiscoverPage';
import { makePage } from '@/test/fixtures';
import { testProviders } from '@/test/testProviders';

const fetchDiscover = vi.fn(() =>
  Promise.resolve({ ...makePage(6), totalResults: 240, totalPages: 20 }),
);

vi.mock('@/services/catalogApi', () => ({
  fetchDiscover: (...args: unknown[]) => fetchDiscover(...(args as [])),
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
  fetchList: vi.fn(),
  fetchByGenre: vi.fn(),
  fetchSearch: vi.fn(),
        discoverParams: vi.fn((filters) => ({ ...filters })),
  }));

describe('DiscoverPage', () => {
  it('renders the filter panel and results', async () => {
    render(testProviders(<DiscoverPage />, { route: '/discover' }));

    await screen.findByText(/240 titles · page 1 of 20/i);
    expect(screen.getByRole('heading', { name: 'Discover' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Sort results' })).toBeInTheDocument();
    expect(screen.getAllByText(/Movie \d/).length).toBe(6);
  });

  it('applies genre filters as URL state and composes them', async () => {
    const user = userEvent.setup();
    render(testProviders(<DiscoverPage />, { route: '/discover' }));

    await user.click(await screen.findByRole('button', { name: 'Action' }));
    await user.click(screen.getByRole('button', { name: 'Science Fiction' }));

    await waitFor(() => {
      expect(fetchDiscover).toHaveBeenLastCalledWith(
        expect.objectContaining({ genres: [28, 878] }),
      );
    });

    // rating filter composes on top of genres
    await user.selectOptions(screen.getByRole('combobox', { name: 'Minimum rating' }), '7');
    await waitFor(() => {
      expect(fetchDiscover).toHaveBeenLastCalledWith(
        expect.objectContaining({ genres: [28, 878], voteAverageGte: 7 }),
      );
    });
  });

  it('switching media type clears genres and requests TV', async () => {
    const user = userEvent.setup();
    render(testProviders(<DiscoverPage />, { route: '/discover?genres=28' }));

    await screen.findByRole('button', { name: 'Action' });
    await user.click(screen.getByRole('button', { name: 'Series' }));

    await waitFor(() => {
      expect(fetchDiscover).toHaveBeenLastCalledWith(
        expect.objectContaining({ mediaType: 'tv', genres: [] }),
      );
    });
  });

  it('shows the empty state with clear-all when nothing matches', async () => {
    fetchDiscover.mockImplementationOnce(() =>
      Promise.resolve({ page: 1, totalPages: 0, totalResults: 0, items: [] }),
    );
    const user = userEvent.setup();
    render(testProviders(<DiscoverPage />, { route: '/discover?genres=28&rating=9' }));

    await screen.findByText('Nothing matches these filters');
    // both the header and the empty state offer clear-all; use the empty-state one
    const clearButtons = screen.getAllByRole('button', { name: /clear all filters/i });
    await user.click(clearButtons[clearButtons.length - 1]!);
    await waitFor(() => {
      expect(fetchDiscover).toHaveBeenLastCalledWith(
        expect.objectContaining({ genres: [], voteAverageGte: undefined, page: 1 }),
      );
    });
  });
});
