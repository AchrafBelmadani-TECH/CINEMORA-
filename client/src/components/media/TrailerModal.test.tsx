import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TrailerModal } from './TrailerModal';

describe('TrailerModal', () => {
  it('renders nothing when there is no trailer key', () => {
    const { container } = render(<TrailerModal videoKey={null} onClose={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('embeds the official YouTube trailer with a close control', () => {
    const onClose = vi.fn();
    render(<TrailerModal videoKey="Way9Dexny3w" videoName="Official Trailer" onClose={onClose} />);

    const dialog = screen.getByRole('dialog', { name: /trailer — official trailer/i });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    const iframe = screen.getByTitle('Official Trailer');
    expect(iframe.getAttribute('src')).toBe('https://www.youtube-nocookie.com/embed/Way9Dexny3w?autoplay=1&rel=0');
    expect(screen.getByRole('button', { name: /close trailer/i })).toBeInTheDocument();
  });

  it('closes on the close button and on Escape', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { rerender } = render(<TrailerModal videoKey="k1" onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: /close trailer/i }));
    expect(onClose).toHaveBeenCalledOnce();

    rerender(<TrailerModal videoKey="k1" onClose={onClose} />);
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
