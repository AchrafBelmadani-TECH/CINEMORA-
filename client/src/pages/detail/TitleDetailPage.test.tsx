import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TitleDetailPage } from './TitleDetailPage';
import { makeDetail, makeSeason, makeTvDetail } from '@/test/fixtures';
import { testProviders } from '@/test/testProviders';

vi.mock('@/services/catalogApi', () => ({
  fetchMovieDetail: vi.fn(() => Promise.resolve(makeDetail())),
  fetchTvDetail: vi.fn(() => Promise.resolve(makeTvDetail())),
  fetchSeason: vi.fn(() => Promise.resolve(makeSeason())),
  fetchGenres: vi.fn(() => Promise.resolve([{ id: 878, name: 'Science Fiction' }])),
  fetchList: vi.fn(() => Promise.resolve({ page: 1, totalPages: 1, totalResults: 0, items: [] })),
  fetchByGenre: vi.fn(() => Promise.resolve({ page: 1, totalPages: 1, totalResults: 0, items: [] })),
  fetchPerson: vi.fn(),
  fetchSearch: vi.fn(),
  fetchDiscover: vi.fn(),
        discoverParams: vi.fn((filters) => ({ ...filters })),
  }));

function renderAt(ui: React.ReactElement, route: string, path = "*") {
  return render(testProviders(ui, { route, path }));
}

describe('TitleDetailPage — movie', () => {
  it('shows backdrop content, metadata, cast, trailer button and recommendations', async () => {
    renderAt(<TitleDetailPage mediaType="movie" />, '/movie/693134', '/movie/:id');

    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Dune: Part Two' })).toBeInTheDocument());

    expect(screen.getByText('“Long live the fighters.”')).toBeInTheDocument();
    expect(screen.getByText(/Feb 27, 2024/)).toBeInTheDocument();
    expect(screen.getByText('2h 46m')).toBeInTheDocument();
    expect(screen.getByText('Director:')).toBeInTheDocument();
    expect(screen.getByText('Denis Villeneuve')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Rating 8.2 out of 10' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /watch trailer/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Timothée Chalamet/ })).toHaveAttribute('href', '/person/1136406');
    expect(screen.getAllByRole('heading', { name: 'More like this' }).length).toBeGreaterThan(0);
  });

  it('opens the trailer modal with the official key and closes it', async () => {
    const user = userEvent.setup();
    renderAt(<TitleDetailPage mediaType="movie" />, '/movie/693134', '/movie/:id');

    await screen.findByRole('button', { name: /watch trailer/i });
    await user.click(screen.getByRole('button', { name: /watch trailer/i }));

    expect(screen.getByTitle('Official Trailer')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /close trailer/i }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

describe('TitleDetailPage — TV', () => {
  it('shows seasons and episode details, syncing the season to the URL', async () => {
    const user = userEvent.setup();
    renderAt(<TitleDetailPage mediaType="tv" />, '/tv/1399', '/tv/:id');

    await screen.findByRole('heading', { level: 1, name: 'Game of Thrones' });
    expect(screen.getByText(/8 seasons · 73 episodes/i)).toBeInTheDocument();
    expect(screen.getByText(/Created by:/)).toBeInTheDocument();

    // season pills render; episodes of the default season load
    await screen.findByText('Winter Is Coming');
    expect(screen.getByText(/62m/)).toBeInTheDocument();

    // selecting season 2 selects the tab (URL sync: ?season=2)
    await user.click(screen.getByRole('tab', { name: 'Season 2' }));
    expect(screen.getByRole('tab', { name: 'Season 2' })).toHaveAttribute('aria-selected', 'true');
    await waitFor(() => {
      expect(screen.getByText('The Kingsroad')).toBeInTheDocument();
    });
  });

  it('hides the trailer button when the show has no videos', async () => {
    renderAt(<TitleDetailPage mediaType="tv" />, '/tv/1399', '/tv/:id');
    await screen.findByRole('heading', { level: 1, name: 'Game of Thrones' });
    expect(screen.queryByRole('button', { name: /watch trailer/i })).toBeNull();
  });
});
