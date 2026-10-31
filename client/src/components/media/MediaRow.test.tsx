import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MediaRow } from './MediaRow';
import { makePage } from '@/test/fixtures';

function renderRow(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('MediaRow', () => {
  it('renders its heading and one card per item', () => {
    const items = makePage(4).items;
    renderRow(<MediaRow title="Trending Now" items={items} genreNameFor={(id) => (id === 28 ? 'Action' : undefined)} />);

    expect(screen.getByRole('heading', { name: 'Trending Now' })).toBeInTheDocument();
    expect(screen.getAllByText(/Movie \d/)).toHaveLength(4);
    expect(screen.getAllByText(/Action/).length).toBeGreaterThan(0);
  });

  it('can suppress its own heading when the parent renders one', () => {
    renderRow(<MediaRow title="Trending Now" items={makePage(2).items} hideHeading />);
    expect(screen.queryByRole('heading', { name: 'Trending Now' })).toBeNull();
  });

  it('renders nothing (no fake empty row) when there are no items', () => {
    const { container } = renderRow(<MediaRow title="Empty Row" items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('is keyboard-scrollable via a labeled focusable region', () => {
    renderRow(<MediaRow title="Top Rated" items={makePage(2).items} />);
    const region = screen.getByRole('region', { name: /Top Rated — use arrow keys/i });
    expect(region).toHaveAttribute('tabindex', '0');
  });
});
