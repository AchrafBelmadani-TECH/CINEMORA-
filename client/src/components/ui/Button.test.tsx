import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';

describe('Button', () => {
  it('renders its label and default variant classes', () => {
    render(<Button>Play</Button>);
    const button = screen.getByRole('button', { name: 'Play' });
    expect(button).toBeInTheDocument();
    expect(button.className).toContain('from-primary');
    expect(button.className).toContain('to-accent');
  });

  it('applies variant and size classes', () => {
    render(
      <Button variant="gold" size="lg">
        Watch
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Watch' });
    expect(button.className).toContain('bg-gold');
    expect(button.className).toContain('h-12');
  });

  it('fires click handlers', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click</Button>);
    await user.click(screen.getByRole('button', { name: 'Click' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('is disabled and does not fire when disabled', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        No
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'No' });
    expect(button).toBeDisabled();
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('shows a spinner and blocks clicks while loading', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Saving
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Saving' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button.querySelector('.animate-spin')).not.toBeNull();
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});
