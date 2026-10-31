import type { ReactElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

interface TestProvidersOptions {
  /** Initial URL. */
  route?: string;
  /**
   * Route pattern the UI is rendered under. Required when the page reads
   * useParams (:id, :genreId) — "*" is fine for search-param-only pages.
   */
  path?: string;
}

/** Test harness: fresh QueryClient (no retries) + optional router location. */
export function testProviders(ui: ReactElement, { route = '/', path = '*' }: TestProvidersOptions = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
    },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path={path} element={ui} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}
