import { Link, useSearchParams } from 'react-router-dom';
import { SearchX, User } from 'lucide-react';
import { useSearch } from '@/hooks/useCatalog';
import { profileUrl } from '@/lib/tmdbImage';
import { MediaCard } from '@/components/media/MediaCard';
import { GridSkeleton } from '@/components/media/skeletons';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { isPerson, type PersonSearchItem } from '@/types/catalog';

function PersonResultCard({ item }: { item: PersonSearchItem }) {
  const profile = profileUrl(item.profilePath, 'w185');
  return (
    <Link
      to={`/person/${item.personId}`}
      className="group block overflow-hidden rounded-xl border border-white/5 bg-card transition-all duration-300 hover:-translate-y-1 hover:border-gold/25 hover:shadow-glow"
    >
      <div className="relative aspect-2/3 w-full overflow-hidden bg-surface">
        {profile ? (
          <img src={profile} alt="" loading="lazy" width={185} height={278} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div aria-hidden className="flex h-full w-full items-center justify-center text-muted/40">
            <User className="h-10 w-10" />
          </div>
        )}
      </div>
      <div className="p-3">
        <h3 className="truncate text-sm font-semibold text-ink">{item.name}</h3>
        <p className="mt-1 text-xs text-muted">{item.knownForDepartment ?? 'Person'}</p>
      </div>
    </Link>
  );
}

/** /search?q= — full results page for movies, series and people. */
export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q')?.trim() ?? '';
  const page = Math.max(1, Math.min(Number.parseInt(searchParams.get('page') ?? '1', 10) || 1, 500));
  const { data, isPending, isError, refetch } = useSearch(query || undefined, page);

  function goToPage(next: number) {
    setSearchParams((prev) => {
      const nextParams = new URLSearchParams(prev);
      if (next > 1) nextParams.set('page', String(next));
      else nextParams.delete('page');
      return nextParams;
    });
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <header className="mb-8">
        <h1 className="font-display text-2xl font-bold tracking-wide text-ink sm:text-3xl">
          {query ? <>Results for “{query}”</> : 'Search'}
        </h1>
        {data && (
          <p className="mt-1 text-sm text-muted">
            {data.totalResults.toLocaleString()} results · page {data.page} of {data.totalPages.toLocaleString()}
          </p>
        )}
      </header>

      {!query ? (
        <EmptyState
          icon={SearchX}
          title="What are you looking for?"
          message="Use the search bar above to find movies, TV series and people."
        />
      ) : isPending ? (
        <GridSkeleton />
      ) : isError ? (
        <ErrorState
          title="Search failed"
          message="We could not reach the catalog. Retry in a moment."
          onRetry={refetch}
        />
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title={`No matches for “${query}”`}
          message="Check the spelling, or try a shorter search."
          action={
            <Link to="/" className="text-sm text-gold hover:underline">
              Back to home
            </Link>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {data.items.map((item) =>
              isPerson(item) ? (
                <PersonResultCard key={`p-${item.personId}`} item={item} />
              ) : (
                <MediaCard key={`${item.mediaType}-${item.tmdbId}`} item={item} fluid />
              ),
            )}
          </div>

          {data.totalPages > 1 && (
            <nav aria-label="Search result pages" className="mt-10 flex items-center justify-center gap-4">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => goToPage(page - 1)}
                className="inline-flex h-10 items-center rounded-lg border border-white/10 bg-white/5 px-4 text-sm font-medium text-ink transition-colors hover:bg-white/10 disabled:pointer-events-none disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-sm text-muted">
                Page <span className="font-semibold text-ink">{page}</span> of {data.totalPages.toLocaleString()}
              </span>
              <button
                type="button"
                disabled={page >= data.totalPages}
                onClick={() => goToPage(page + 1)}
                className="inline-flex h-10 items-center rounded-lg border border-white/10 bg-white/5 px-4 text-sm font-medium text-ink transition-colors hover:bg-white/10 disabled:pointer-events-none disabled:opacity-40"
              >
                Next
              </button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
