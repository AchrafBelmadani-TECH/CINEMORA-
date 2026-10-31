import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { Skeleton } from './Skeleton';

describe('Skeleton', () => {
  it('renders as a hidden decorative placeholder with pulse', () => {
    const { container } = render(<Skeleton className="h-4 w-32" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el).toHaveAttribute('aria-hidden', 'true');
    expect(el.className).toContain('animate-pulse');
    expect(el.className).toContain('h-4');
    expect(el.className).toContain('w-32');
  });
});
