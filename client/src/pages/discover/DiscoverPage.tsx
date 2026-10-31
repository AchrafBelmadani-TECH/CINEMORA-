import { useSearchParams } from 'react-router-dom';
import { SlidersHorizontal, X } from 'lucide-react';
import { useDiscover, useGenres } from '@/hooks/useCatalog';
import type { DiscoverFilters } from '@/types/catalog';
import { MediaCard } from '@/components/media/MediaCard';
import { GridSkeleton } from '@/components/media/skeletons';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { cn } from '@/lib/cn';

const SORTS = [
  { value: 'popularity.desc', label: 'Most popular' },
  { value: 'vote_average.desc', label: 'Highest rated' },
  { value: 'release_date.desc', label: 'Newest releases' },
] as const;

const RATINGS = [
  { value: '', label: 'Any rating' },
  { value: '5', label: '5.0+' },
  { value: '6', label: '6.0+' },
  { value: '7', label: '7.0+' },
  { value: '8', label: '8.0+' },
] as const;

const LANGUAGES = [
  { value: '', label: 'Any language' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
  { value: 'fr', label: 'French' },
  { value: 'es', label: 'Spanish' },
  { value: 'de', label: 'German' },
  { value: 'it', label: 'Italian' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'zh', label: 'Chinese' },
  { value: 'hi', label: 'Hindi' },
] as const;

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR + 1 - 1950 }, (_, i) => CURRENT_YEAR + 1 - i);

/** Reads all filters from the URL (?type=&genres=&yearFrom=&yearTo=&rating=&lang=&sort=&page=). */
function filtersFromParams(params: URLSearchParams): DiscoverFilters {
  const type = params.get('type') === 'tv' ? 'tv' : 'movie';
  const genres = (params.get('genres') ?? '')
    .split(',')
    .map((g) => Number.parseInt(g, 10))
    .filter((n) => Number.isFinite(n) && n > 0);
  const num = (key: string) => {
    const raw = params.get(key);
    if (raw === null || raw === '') return undefined;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : undefined;
  };
  const sort = params.get('sort');
  return {
    mediaType: type,
    genres,
    yearFrom: num('yearFrom'),
    yearTo: num('yearTo'),
    voteAverageGte: num('rating'),
    language: params.get('lang') || undefined,
    sortBy: sort === 'vote_average.desc' || sort === 'release_date.desc' ? sort : 'popularity.desc',
    page: Math.max(1, Math.min(Number.parseInt(params.get('page') ?? '1', 10) || 1, 500)),
  };
}

function hasActiveFilters(f: DiscoverFilters): boolean {
  return (
    f.genres.length > 0 ||
    f.yearFrom !== undefined ||
    f.yearTo !== undefined ||
    f.voteAverageGte !== undefined ||
    f.language !== undefined ||
    f.sortBy !== 'popularity.desc'
  );
}

/** /discover — advanced multi-filter browsing, fully URL-driven. */
export function DiscoverPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = filtersFromParams(searchParams);
  const { data: genres } = useGenres(filters.mediaType);
  const { data, isPending, isError, refetch } = useDiscover(filters);

  function update(patch: Partial<DiscoverFilters>, resetPage = true) {
    setSearchParams((prev) => {
      const next = filtersFromParams(prev);
      const merged: DiscoverFilters = { ...next, ...patch, page: resetPage ? 1 : (patch.page ?? next.page) };
      const out = new URLSearchParams();
      out.set('type', merged.mediaType);
      if (merged.genres.length > 0) out.set('genres', merged.genres.join(','));
      if (merged.yearFrom !== undefined) out.set('yearFrom', String(merged.yearFrom));
      if (merged.yearTo !== undefined) out.set('yearTo', String(merged.yearTo));
      if (merged.voteAverageGte !== undefined) out.set('rating', String(merged.voteAverageGte));
      if (merged.language) out.set('lang', merged.language);
      if (merged.sortBy !== 'popularity.desc') out.set('sort', merged.sortBy);
      if (merged.page > 1) out.set('page', String(merged.page));
      return out;
    });
  }

  function clearAll() {
    setSearchParams({ type: filters.mediaType });
  }

  const activeCount = hasActiveFilters(filters);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-wide text-ink sm:text-3xl">Discover</h1>
          <p className="mt-1 text-sm text-muted">Combine filters to find exactly what you're in the mood for.</p>
        </div>
        {activeCount && (
          <button
            type="button"
            onClick={clearAll}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-muted transition-colors hover:text-ink"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
            Clear all filters
          </button>
        )}
      </header>

      {/* Filter panel */}
      <section aria-label="Filters" className="mb-8 rounded-xl border border-white/5 bg-card/60 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
          {/* Media type */}
          <fieldset>
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink/70">Type</legend>
            <div className="flex overflow-hidden rounded-lg border border-white/10">
              {(['movie', 'tv'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={filters.mediaType === t}
                  onClick={() => update({ mediaType: t, genres: [] })}
                  className={cn(
                    'h-9 px-4 text-sm font-medium transition-colors',
                    filters.mediaType === t ? 'bg-gradient-to-r from-primary/30 to-accent/30 text-ink' : 'text-muted hover:text-ink',
                  )}
                >
                  {t === 'movie' ? 'Movies' : 'Series'}
                </button>
              ))}
            </div>
          </fieldset>

          {/* Sort */}
          <fieldset>
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink/70">Sort by</legend>
            <select
              aria-label="Sort results"
              value={filters.sortBy}
              onChange={(e) => update({ sortBy: e.target.value as DiscoverFilters['sortBy'] })}
              className="h-9 rounded-lg border border-white/10 bg-surface px-3 text-sm text-ink focus:border-gold/40 focus:outline-none"
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </fieldset>

          {/* Min rating */}
          <fieldset>
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink/70">Rating</legend>
            <select
              aria-label="Minimum rating"
              value={filters.voteAverageGte ?? ''}
              onChange={(e) => update({ voteAverageGte: e.target.value === '' ? undefined : Number(e.target.value) })}
              className="h-9 rounded-lg border border-white/10 bg-surface px-3 text-sm text-ink focus:border-gold/40 focus:outline-none"
            >
              {RATINGS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </fieldset>

          {/* Years */}
          <fieldset>
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink/70">Release years</legend>
            <div className="flex items-center gap-2">
              <select
                aria-label="From year"
                value={filters.yearFrom ?? ''}
                onChange={(e) => update({ yearFrom: e.target.value === '' ? undefined : Number(e.target.value) })}
                className="h-9 rounded-lg border border-white/10 bg-surface px-3 text-sm text-ink focus:border-gold/40 focus:outline-none"
              >
                <option value="">From…</option>
                {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
              <span aria-hidden className="text-muted">–</span>
              <select
                aria-label="To year"
                value={filters.yearTo ?? ''}
                onChange={(e) => update({ yearTo: e.target.value === '' ? undefined : Number(e.target.value) })}
                className="h-9 rounded-lg border border-white/10 bg-surface px-3 text-sm text-ink focus:border-gold/40 focus:outline-none"
              >
                <option value="">To…</option>
                {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </fieldset>

          {/* Language */}
          <fieldset>
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink/70">Language</legend>
            <select
              aria-label="Original language"
              value={filters.language ?? ''}
              onChange={(e) => update({ language: e.target.value === '' ? undefined : e.target.value })}
              className="h-9 rounded-lg border border-white/10 bg-surface px-3 text-sm text-ink focus:border-gold/40 focus:outline-none"
            >
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          </fieldset>
        </div>

        {/* Genres */}
        <fieldset className="mt-5">
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink/70">Genres</legend>
          <div className="flex flex-wrap gap-2">
            {(genres ?? []).map((genre) => {
              const selected = filters.genres.includes(genre.id);
              return (
                <button
                  key={genre.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() =>
                    update({
                      genres: selected
                        ? filters.genres.filter((g) => g !== genre.id)
                        : [...filters.genres, genre.id],
                    })
                  }
                  className={cn(
                    'inline-flex h-8 items-center rounded-full border px-3.5 text-xs font-medium transition-all duration-200',
                    selected
                      ? 'border-gold/60 bg-gold/10 text-gold'
                      : 'border-white/10 bg-surface text-muted hover:border-gold/30 hover:text-ink',
                  )}
                >
                  {genre.name}
                </button>
              );
            })}
          </div>
        </fieldset>
      </section>

      {/* Results */}
      {isPending ? (
        <GridSkeleton />
      ) : isError ? (
        <ErrorState title="Could not load results" message="The catalog did not respond. Retry in a moment." onRetry={refetch} />
      ) : data && data.items.length === 0 ? (
        <EmptyState
          icon={SlidersHorizontal}
          title="Nothing matches these filters"
          message="Try widening the year range, lowering the rating, or removing a genre."
          action={
            activeCount ? (
              <button type="button" onClick={clearAll} className="text-sm text-gold hover:underline">
                Clear all filters
              </button>
            ) : undefined
          }
        />
      ) : (
        data && (
          <>
            <p className="mb-4 text-sm text-muted" aria-live="polite">
              {data.totalResults.toLocaleString()} titles · page {data.page} of {data.totalPages.toLocaleString()}
            </p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {data.items.map((item) => (
                <MediaCard key={`${item.mediaType}-${item.tmdbId}`} item={item} fluid />
              ))}
            </div>

            {data.totalPages > 1 && (
              <nav aria-label="Discover result pages" className="mt-10 flex items-center justify-center gap-4">
                <button
                  type="button"
                  disabled={filters.page <= 1}
                  onClick={() => update({ page: filters.page - 1 }, false)}
                  className="inline-flex h-10 items-center rounded-lg border border-white/10 bg-white/5 px-4 text-sm font-medium text-ink transition-colors hover:bg-white/10 disabled:pointer-events-none disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="text-sm text-muted">
                  Page <span className="font-semibold text-ink">{filters.page}</span> of {data.totalPages.toLocaleString()}
                </span>
                <button
                  type="button"
                  disabled={filters.page >= data.totalPages}
                  onClick={() => update({ page: filters.page + 1 }, false)}
                  className="inline-flex h-10 items-center rounded-lg border border-white/10 bg-white/5 px-4 text-sm font-medium text-ink transition-colors hover:bg-white/10 disabled:pointer-events-none disabled:opacity-40"
                >
                  Next
                </button>
              </nav>
            )}
          </>
        )
      )}
    </div>
  );
}
