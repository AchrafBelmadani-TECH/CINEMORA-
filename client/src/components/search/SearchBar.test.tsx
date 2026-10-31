import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchBar } from './SearchBar';
import { makeSearchResults } from '@/test/fixtures';
import { testProviders } from '@/test/testProviders';

const fetchSearch = vi.fn();

vi.mock('@/services/catalogApi', () => ({
  fetchSearch: (...args: unknown[]) => fetchSearch(...(args as [])),
  fetchMovieDetail: vi.fn(),
  fetchTvDetail: vi.fn(),
  fetchSeason: vi.fn(),
  fetchPerson: vi.fn(),
  fetchGenres: vi.fn(),
  fetchList: vi.fn(),
  fetchByGenre: vi.fn(),
  fetchDiscover: vi.fn(),
        discoverParams: vi.fn((filters) => ({ ...filters })),
  }));

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  fetchSearch.mockReset();
  fetchSearch.mockResolvedValue(makeSearchResults());
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe('SearchBar', () => {
  it('shows debounced suggestions and navigates on Enter to the results page', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { container } = render(testProviders(<SearchBar />));

    const input = screen.getByRole('combobox', { name: /search movies, series and people/i });
    await user.type(input, 'dune');
    expect(fetchSearch).not.toHaveBeenCalled(); // debounced — nothing yet

    await vi.advanceTimersByTimeAsync(350);
    await waitFor(() => expect(fetchSearch).toHaveBeenCalledWith('dune', 1));
    expect(await screen.findByText('Dune: Part Two')).toBeInTheDocument();
    expect(screen.getByText('Denis Villeneuve')).toBeInTheDocument();

    // full results link + Enter navigation
    await user.click(screen.getByText(/view all results for “dune”/i));
    expect(container).toBeDefined();
  });

  it('does not search for short input and clears with the X button', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(testProviders(<SearchBar />));

    const input = screen.getByRole('combobox', { name: /search movies, series and people/i });
    await user.type(input, 'd');
    await vi.advanceTimersByTimeAsync(400);
    expect(fetchSearch).not.toHaveBeenCalled(); // below the 2-char minimum

    await user.type(input, 'u');
    await vi.advanceTimersByTimeAsync(400);
    await waitFor(() => expect(fetchSearch).toHaveBeenCalledWith('du', 1));

    await user.click(screen.getByRole('button', { name: /clear search/i }));
    expect(input).toHaveValue('');
  });
});
