import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HomePage } from './HomePage';

describe('HomePage', () => {
  it('presents the brand wordmark, tagline and three pillars', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { level: 1, name: /cinemora/i })).toBeInTheDocument();
    expect(screen.getByText(/Discover films and series/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Discover' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Your library' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Watch' })).toBeInTheDocument();
  });
});
