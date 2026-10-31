import type { ReactNode } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { MediaCard } from '@/components/media/MediaCard';
import { GridSkeleton } from '@/components/media/skeletons';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import type { CatalogListItem, Paginated } from '@/types/catalog';

export interface CatalogBrowserProps {
  title: string;
  /** Result of a paginated catalog query driven by the URL ?page param. */
  query: UseQueryResult<Paginated<CatalogListItem>>;
  page: number;
  onPageChange: (page: number) => void;
  genreNameFor?: (genreId: number) => string | undefined;
  children?: ReactNode;
}

/**
 * Shared paginated catalog grid for /movies, /series and /genre/:id.
 * Pagination state lives in the URL, so back/forward and reloads behave.
 */
export function CatalogBrowser({ title, query, page, onPageChange, genreNameFor, children }: CatalogBrowserProps) {
  const { data, isPending, isError, refetch } = query;
  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <header className="mb-8">
        <h1 className="font-display text-2xl font-bold tracking-wide text-ink sm:text-3xl">{title}</h1>
        {data && (
          <p className="mt-1 text-sm text-muted">
            Page {data.page} of {totalPages.toLocaleString()} · {data.totalResults.toLocaleString()} titles
          </p>
        )}
      </header>
      {children}

      {isPending ? (
        <GridSkeleton />
      ) : isError ? (
        <ErrorState
          title="Could not load this page"
          message="The catalog service did not respond. Retry in a moment."
          onRetry={refetch}
        />
      ) : data.items.length === 0 ? (
        <EmptyState title="Nothing here yet" message="No titles matched this page of the catalog." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {data.items.map((item) => (
              <MediaCard key={`${item.mediaType}-${item.tmdbId}`} item={item} fluid genreName={genreNameFor?.(item.genreIds[0] ?? -1)} />
            ))}
          </div>

          <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
        </>
      )}
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <nav aria-label="Catalog pages" className="mt-10 flex items-center justify-center gap-4">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-4 text-sm font-medium text-ink transition-colors hover:bg-white/10 disabled:pointer-events-none disabled:opacity-40"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
        Previous
      </button>
      <span aria-current="page" className="text-sm text-muted">
        Page <span className="font-semibold text-ink">{page}</span> of {totalPages.toLocaleString()}
      </span>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-4 text-sm font-medium text-ink transition-colors hover:bg-white/10 disabled:pointer-events-none disabled:opacity-40"
      >
        Next
        <ChevronRight className="h-4 w-4" aria-hidden />
      </button>
    </nav>
  );
}
