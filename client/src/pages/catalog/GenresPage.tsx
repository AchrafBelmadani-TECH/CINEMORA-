import { Link } from 'react-router-dom';
import { useGenres } from '@/hooks/useCatalog';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';

function GenreSection({ mediaType }: { mediaType: 'movie' | 'tv' }) {
  const { data, isPending, isError, refetch } = useGenres(mediaType);
  const heading = mediaType === 'movie' ? 'Movie genres' : 'Series genres';

  return (
    <section aria-label={heading} className="mb-12">
      <h2 className="mb-4 font-display text-lg font-bold tracking-wide text-ink sm:text-xl">{heading}</h2>
      {isPending ? (
        <div className="flex flex-wrap gap-3">
          {Array.from({ length: 10 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-28 rounded-full" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState compact title="Could not load genres" message="The catalog did not respond." onRetry={refetch} />
      ) : (
        <ul className="flex flex-wrap gap-3">
          {data.map((genre) => (
            <li key={genre.id}>
              <Link
                to={`/genre/${genre.id}?type=${mediaType}`}
                className="inline-flex h-10 items-center rounded-full border border-white/10 bg-card px-5 text-sm font-medium text-ink transition-all duration-200 hover:border-gold/40 hover:text-gold hover:shadow-gold"
              >
                {genre.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** /genres — the full genre taxonomy, linking into genre catalogs. */
export function GenresPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <header className="mb-10">
        <h1 className="font-display text-2xl font-bold tracking-wide text-ink sm:text-3xl">Genres</h1>
        <p className="mt-1 text-sm text-muted">Pick a genre to browse its catalog.</p>
      </header>
      <GenreSection mediaType="movie" />
      <GenreSection mediaType="tv" />
    </div>
  );
}
