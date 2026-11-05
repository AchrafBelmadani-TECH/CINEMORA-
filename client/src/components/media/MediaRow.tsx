import { useRef, useState, type KeyboardEvent } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { MediaCard } from './MediaCard';
import type { CatalogListItem } from '@/types/catalog';

export interface MediaRowProps {
  title: string;
  items: CatalogListItem[];
  /** Resolves a genre name for the card sub-line. */
  genreNameFor?: (genreId: number) => string | undefined;
  watchableSet?: Set<number>;
  /** Suppress the built-in heading when the parent already renders one. */
  hideHeading?: boolean;
}

/**
 * Horizontally scrollable collection row: swipeable on touch, arrow-key
 * scrollable when focused, with scroll buttons on desktop that appear only
 * when there is something to scroll toward.
 */
export function MediaRow({ title, items, genreNameFor, hideHeading = false, watchableSet }: MediaRowProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(true);

  if (items.length === 0) return null;

  function updateArrows() {
    const el = scrollerRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }

  function scrollBy(direction: -1 | 1) {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.85, behavior: 'smooth' });
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      scrollBy(1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      scrollBy(-1);
    }
  }

  return (
    <section aria-label={title} className="group/row relative">
      {!hideHeading && (
        <h2 className="mb-3 px-4 font-display text-lg font-bold tracking-wide text-ink sm:px-6 sm:text-xl">
          {title}
        </h2>
      )}

      <div className="relative">
        {canLeft && (
          <button
            type="button"
            aria-label={`Scroll ${title} left`}
            onClick={() => scrollBy(-1)}
            className="absolute left-1 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-base/80 text-ink backdrop-blur-sm transition-opacity hover:bg-card sm:flex"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>
        )}

        <div
          ref={scrollerRef}
          onScroll={updateArrows}
          onKeyDown={onKeyDown}
          tabIndex={0}
          role="region"
          aria-label={`${title} — use arrow keys to scroll`}
          className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-4 pb-3 sm:gap-4 sm:px-6
                     [scrollbar-width:none] [&::-webkit-scrollbar]:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
        >
          {items.map((item) => (
            <div key={`${item.mediaType}-${item.tmdbId}`} className="snap-start">
              <MediaCard item={item} genreName={genreNameFor?.(item.genreIds[0] ?? -1)} watchable={watchableSet?.has(item.tmdbId) ?? false} />
            </div>
          ))}
        </div>

        {canRight && (
          <button
            type="button"
            aria-label={`Scroll ${title} right`}
            onClick={() => scrollBy(1)}
            className="absolute right-1 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-base/80 text-ink backdrop-blur-sm transition-opacity hover:bg-card sm:flex"
          >
            <ChevronRight className="h-5 w-5" aria-hidden />
          </button>
        )}
      </div>
    </section>
  );
}
