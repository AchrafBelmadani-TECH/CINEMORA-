import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { NotFoundPage } from './NotFoundPage';

describe('NotFoundPage', () => {
  it('shows 404 messaging with a working link home', () => {
    render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('404')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /this reel doesn’t exist/i })).toBeInTheDocument();
    const home = screen.getByRole('link', { name: 'Back to home' });
    expect(home).toBeInTheDocument();
    expect(home).toHaveAttribute('href', '/');
  });
});
