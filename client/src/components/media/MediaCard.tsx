import { Film, Star } from 'lucide-react';
import { posterUrl } from '@/lib/tmdbImage';
import type { CatalogListItem } from '@/types/catalog';
import { cn } from '@/lib/cn';

export interface MediaCardProps {
  item: CatalogListItem;
  /** Genre name lookup for the sub-line (optional). */
  genreName?: string;
  /** Full-width layout for grids (rows use the fixed poster width). */
  fluid?: boolean;
  className?: string;
}

function yearOf(releaseDate: string | null): string | null {
  return releaseDate ? releaseDate.slice(0, 4) : null;
}

/**
 * Poster card: title, year, rating, optional genre.
 * Deliberately NOT a link/button yet — detail pages arrive in Phase 3
 * (no dead navigation).
 */
export function MediaCard({ item, genreName, fluid = false, className }: MediaCardProps) {
  const url = posterUrl(item.posterPath);
  const year = yearOf(item.releaseDate);
  const rating = item.voteAverage > 0 ? item.voteAverage.toFixed(1) : null;

  return (
    <article
      className={cn(
        'group relative overflow-hidden rounded-xl border border-white/5 bg-card transition-all duration-300',
        fluid ? 'w-full' : 'w-[9.5rem] shrink-0 sm:w-[11rem]',
        'hover:-translate-y-1 hover:border-gold/25 hover:shadow-glow',
        className,
      )}
    >
      <div className="relative aspect-2/3 w-full overflow-hidden bg-surface">
        {url ? (
          <img
            src={url}
            alt=""
            loading="lazy"
            decoding="async"
            width={342}
            height={513}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div
            aria-hidden
            className="flex h-full w-full items-center justify-center bg-gradient-to-br from-surface via-card to-primary/20"
          >
            <Film className="h-10 w-10 text-muted/50" aria-hidden />
          </div>
        )}

        {rating && (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-base/80 px-1.5 py-0.5 text-xs font-semibold text-gold backdrop-blur-sm">
            <Star className="h-3 w-3 fill-gold" aria-hidden />
            {rating}
          </span>
        )}
      </div>

      <div className="p-3">
        <h3 className="line-clamp-2 min-h-10 text-sm font-semibold leading-snug text-ink" title={item.title}>
          {item.title}
        </h3>
        <p className="mt-1 text-xs text-muted">
          {[year, genreName ?? (item.mediaType === 'tv' ? 'Series' : 'Movie')].filter(Boolean).join(' · ')}
        </p>
      </div>
    </article>
  );
}
