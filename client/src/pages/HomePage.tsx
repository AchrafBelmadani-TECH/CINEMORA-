import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCatalogGenre, useCatalogList, useGenres } from '@/hooks/useCatalog';
import { MediaRow } from '@/components/media/MediaRow';
import { Hero } from '@/components/media/Hero';
import { HeroSkeleton, RowSkeleton } from '@/components/media/skeletons';
import { ErrorState } from '@/components/ui/ErrorState';
import type { Paginated, CatalogListItem } from '@/types/catalog';

interface RowQuery {
  isPending: boolean;
  isError: boolean;
  refetch: () => void;
  data?: Paginated<CatalogListItem>;
}

function RowSection({
  title,
  link,
  query,
  genreNameFor,
}: {
  title: string;
  link?: { to: string; label: string };
  query: RowQuery;
  genreNameFor?: (genreId: number) => string | undefined;
}) {
  return (
    <section className="mb-8 sm:mb-10">
      <div className="mb-3 flex items-center justify-between px-4 sm:px-6">
        <h2 className="font-display text-lg font-bold tracking-wide text-ink sm:text-xl">{title}</h2>
        {link && (
          <Link
            to={link.to}
            className="inline-flex items-center gap-1 text-xs font-medium text-muted transition-colors hover:text-gold sm:text-sm"
          >
            {link.label}
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
        )}
      </div>

      {query.isPending ? (
        <RowSkeleton />
      ) : query.isError ? (
        <div className="px-4 sm:px-6">
          <ErrorState
            compact
            title="Could not load this collection"
            message="The catalog service did not respond. This usually recovers on retry."
            onRetry={query.refetch}
          />
        </div>
      ) : (
        <MediaRow title={title} items={query.data?.items ?? []} genreNameFor={genreNameFor} />
      )}
    </section>
  );
}

/**
 * Phase 2 homepage: cinematic hero + the curated collection rows.
 * "Recommended For You" and "Continue Watching" arrive with personalization
 * (Phases 5–6) and are intentionally absent until they can be real.
 */
export function HomePage() {
  const hero = useCatalogList({ mediaType: 'movie', kind: 'trending', window: 'day' });
  const genres = useGenres('movie');
  const genreNameFor = (genreId: number) => genres.data?.find((g) => g.id === genreId)?.name;

  const trending = useCatalogList({ mediaType: 'movie', kind: 'trending', window: 'week' });
  const popular = useCatalogList({ mediaType: 'movie', kind: 'popular' });
  const topRated = useCatalogList({ mediaType: 'movie', kind: 'top-rated' });
  const latest = useCatalogList({ mediaType: 'movie', kind: 'latest' });
  const popularTv = useCatalogList({ mediaType: 'tv', kind: 'popular' });

  // Fixed genre rows (TMDB's stable genre ids), one hook each.
  const action = useCatalogGenre('movie', 28);
  const sciFi = useCatalogGenre('movie', 878);
  const drama = useCatalogGenre('movie', 18);
  const horror = useCatalogGenre('movie', 27);
  const comedy = useCatalogGenre('movie', 35);

  return (
    <div>
      {hero.isPending ? (
        <HeroSkeleton />
      ) : hero.isError ? (
        <div className="px-4 pt-10 sm:px-6">
          <ErrorState
            title="The premieres are delayed"
            message="We could not reach the movie catalog. Verify your connection — or ask the operator to configure TMDB access — and try again."
            onRetry={hero.refetch}
          />
        </div>
      ) : (
        <Hero items={(hero.data?.items ?? []).slice(0, 5)} />
      )}

      <div className="mx-auto max-w-7xl pt-8 sm:pt-10">
        <RowSection title="Trending Now" link={{ to: '/movies', label: 'Browse movies' }} query={trending} genreNameFor={genreNameFor} />
        <RowSection title="Popular Movies" link={{ to: '/movies', label: 'Browse movies' }} query={popular} genreNameFor={genreNameFor} />
        <RowSection title="Top Rated" query={topRated} genreNameFor={genreNameFor} />
        <RowSection title="Latest Releases" query={latest} genreNameFor={genreNameFor} />
        <RowSection title="Action Movies" query={action} genreNameFor={genreNameFor} />
        <RowSection title="Science Fiction" query={sciFi} genreNameFor={genreNameFor} />
        <RowSection title="Drama" query={drama} genreNameFor={genreNameFor} />
        <RowSection title="Horror" query={horror} genreNameFor={genreNameFor} />
        <RowSection title="Comedy" query={comedy} genreNameFor={genreNameFor} />
        <RowSection
          title="Popular TV Series"
          link={{ to: '/series', label: 'Browse series' }}
          query={popularTv}
          genreNameFor={genreNameFor}
        />
      </div>
    </div>
  );
}
