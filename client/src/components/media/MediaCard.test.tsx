import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MediaCard } from './MediaCard';
import { makeItem } from '@/test/fixtures';

describe('MediaCard', () => {
  it('renders title, year, genre and rating', () => {
    render(
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

  it('falls back to a placeholder poster when the item has none', () => {
    const { container } = render(<MediaCard item={makeItem({ posterPath: null })} />);
    expect(container.querySelector('img')).toBeNull();
  });

  it('uses the fixed row width by default and full width when fluid', () => {
    const { container, rerender } = render(<MediaCard item={makeItem()} />);
    expect((container.firstElementChild as HTMLElement).className).toContain('w-[9.5rem]');

    rerender(<MediaCard item={makeItem()} fluid />);
    expect((container.firstElementChild as HTMLElement).className).toContain('w-full');
  });

  it('labels series correctly', () => {
    render(<MediaCard item={makeItem({ mediaType: 'tv' })} />);
    expect(screen.getByText(/Series/)).toBeInTheDocument();
  });
});
