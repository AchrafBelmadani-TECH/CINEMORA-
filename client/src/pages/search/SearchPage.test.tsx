import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SearchPage } from './SearchPage';
import { makeSearchResults } from '@/test/fixtures';
import { testProviders } from '@/test/testProviders';

vi.mock('@/services/catalogApi', () => ({
  fetchSearch: vi.fn(() => Promise.resolve(makeSearchResults())),
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

describe('SearchPage', () => {
  it('renders movie and person results with pagination metadata', async () => {
    render(testProviders(<SearchPage />, { route: '/search?q=dune' }));

    await screen.findByRole('heading', { name: /results for “dune”/i });
    // poll for data — the header renders before the query resolves
    await screen.findByText(/12 results · page 1 of 2/i);
    expect(screen.getByRole('link', { name: /Dune: Part Two \(2024\)/ })).toHaveAttribute('href', '/movie/693134');
    expect(screen.getByRole('link', { name: /Denis Villeneuve/ })).toHaveAttribute('href', '/person/525');
    expect(screen.getByRole('button', { name: /next/i })).toBeEnabled();
  });

  it('shows a guidance state when no query is present', async () => {
    render(testProviders(<SearchPage />, { route: '/search' }));
    expect(await screen.findByText('What are you looking for?')).toBeInTheDocument();
  });
});

describe('search empty state', () => {
  it('shows the designed empty state when nothing matches', async () => {
    vi.resetModules();
    vi.doMock('@/services/catalogApi', () => ({
      fetchSearch: vi.fn(() =>
        Promise.resolve({ page: 1, totalPages: 0, totalResults: 0, items: [] }),
      ),
            discoverParams: vi.fn((filters) => ({ ...filters })),
    }));
    const { SearchPage: EmptySearchPage } = await import('./SearchPage');

    render(testProviders(<EmptySearchPage />, { route: '/search?q=zzzznope' }));
    await screen.findByText(/no matches for “zzzznope”/i);
  });
});
