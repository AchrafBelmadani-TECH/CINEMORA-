import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PersonPage } from './PersonPage';
import { makePerson } from '@/test/fixtures';
import { testProviders } from '@/test/testProviders';

vi.mock('@/services/catalogApi', () => ({
  fetchPerson: vi.fn(() => Promise.resolve(makePerson())),
  fetchMovieDetail: vi.fn(),
  fetchTvDetail: vi.fn(),
  fetchSeason: vi.fn(),
  fetchGenres: vi.fn(),
  fetchList: vi.fn(),
  fetchByGenre: vi.fn(),
  fetchSearch: vi.fn(),
  fetchDiscover: vi.fn(),
        discoverParams: vi.fn((filters) => ({ ...filters })),
  }));

describe('PersonPage', () => {
  it('shows profile facts, biography, known-for grid and filmography', async () => {
    render(testProviders(<PersonPage />, { route: '/person/525', path: '/person/:id' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Denis Villeneuve' })).toBeInTheDocument();
    expect(screen.getByText('Directing')).toBeInTheDocument();
    expect(screen.getByText('Born Oct 3, 1967')).toBeInTheDocument();
    expect(screen.getByText('Canadian film director.')).toBeInTheDocument();
    expect(screen.getAllByText('Known for').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole('link', { name: /Dune: Part Two \(2024\)/ })).toHaveAttribute('href', '/movie/693134');

    // filmography entries link to detail pages
    const filmography = screen.getByRole('region', { name: 'Filmography' });
    expect(filmography).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Dune: Part Two' }).length).toBeGreaterThan(0);
  });

  it('shows an error state with retry when the person cannot load', async () => {
    vi.resetModules();
    vi.doMock('@/services/catalogApi', () => ({
      fetchPerson: vi.fn(() => Promise.reject(new Error('boom'))),
            discoverParams: vi.fn((filters) => ({ ...filters })),
    }));
    const { PersonPage: FailingPersonPage } = await import('./PersonPage');
    const user = userEvent.setup();

    render(testProviders(<FailingPersonPage />, { route: '/person/525', path: '/person/:id' }));

    await screen.findByText("We couldn't find this person");
    await user.click(screen.getByRole('button', { name: /try again/i }));
  });
});

describe('search result linking', () => {
  it('waits for data before rendering (no crash on missing person)', async () => {
    render(testProviders(<PersonPage />, { route: '/person/525', path: '/person/:id' }));
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument());
  });
});
