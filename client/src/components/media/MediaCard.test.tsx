import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MediaCard } from './MediaCard';
import { makeItem } from '@/test/fixtures';

function renderCard(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

function rerenderCard(rerender: (ui: React.ReactElement) => unknown, ui: React.ReactElement) {
  return rerender(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('MediaCard', () => {
  it('renders title, year, genre and rating', () => {
    renderCard(
      <MediaCard
        item={makeItem({
          title: 'Dune: Part Two',
          releaseDate: '2024-02-27',
          voteAverage: 8.2,
          genreIds: [878],
        })}
        genreName="Science Fiction"
      />,
    );

    expect(screen.getByText('Dune: Part Two')).toBeInTheDocument();
    expect(screen.getByText(/2024 · Science Fiction/)).toBeInTheDocument();
    expect(screen.getByText('8.2')).toBeInTheDocument();
  });

  it('links movies to /movie/:id and series to /tv/:id', () => {
    const { rerender } = renderCard(<MediaCard item={makeItem({ tmdbId: 693134, mediaType: 'movie', title: 'Dune: Part Two' })} />);
    expect(screen.getByRole('link', { name: /Dune/ })).toHaveAttribute('href', '/movie/693134');

    rerenderCard(rerender, <MediaCard item={makeItem({ tmdbId: 1399, mediaType: 'tv', title: 'Thrones' })} />);
    expect(screen.getByRole('link', { name: /Thrones/ })).toHaveAttribute('href', '/tv/1399');
  });

  it('falls back to a placeholder poster when the item has none', () => {
    const { container } = renderCard(<MediaCard item={makeItem({ posterPath: null })} />);
    expect(container.querySelector('img')).toBeNull();
  });

  it('uses the fixed row width by default and full width when fluid', () => {
    const { container, rerender } = renderCard(<MediaCard item={makeItem()} />);
    expect((container.firstElementChild as HTMLElement).className).toContain('w-[9.5rem]');

    rerenderCard(rerender, <MediaCard item={makeItem()} fluid />);
    expect((container.firstElementChild as HTMLElement).className).toContain('w-full');
  });

  it('labels series correctly', () => {
    renderCard(<MediaCard item={makeItem({ mediaType: 'tv' })} />);
    expect(screen.getByText(/Series/)).toBeInTheDocument();
  });
});
