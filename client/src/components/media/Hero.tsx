import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Info, Star } from 'lucide-react';
import { backdropUrl } from '@/lib/tmdbImage';
import { titlePath } from '@/lib/formatters';
import type { CatalogListItem } from '@/types/catalog';

export interface HeroProps {
  items: CatalogListItem[];
}

const ROTATE_MS = 8_000;

/**
 * Cinematic full-bleed hero rotating through the day's trending movies.
 * Auto-advances (unless reduced motion is requested) with manual slide dots;
 * no action buttons — detail navigation arrives with Phase 3.
 */
export function Hero({ items }: HeroProps) {
  const [index, setIndex] = useState(0);
  const reduceMotion = useReducedMotion();
  const featured = items[index];

  useEffect(() => {
    if (reduceMotion || items.length <= 1) return;
    const timer = window.setInterval(() => {
      setIndex((i) => (i + 1) % items.length);
    }, ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [items.length, reduceMotion]);

  useEffect(() => {
    if (index >= items.length) setIndex(0);
  }, [items.length, index]);

  if (!featured) return null;
  const backdrop = backdropUrl(featured.backdropPath ?? featured.posterPath, 'w1280');
  const year = featured.releaseDate?.slice(0, 4);
  const rating = featured.voteAverage > 0 ? featured.voteAverage.toFixed(1) : null;

  return (
    <section aria-label="Featured today" className="relative h-[68vh] min-h-105 w-full overflow-hidden sm:h-[78vh]">
      <AnimatePresence mode="sync">
        <div key={featured.tmdbId} className="absolute inset-0">
          {backdrop && (
            <motion.img
              src={backdrop}
              alt=""
              initial={{ opacity: 0, scale: reduceMotion ? 1 : 1.04 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.9, ease: 'easeOut' }}
              className="h-full w-full object-cover"
              width={1280}
              height={720}
            />
          )}
        </div>
      </AnimatePresence>

      {/* cinematic scrims */}
      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-base via-base/55 to-base/10" />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-base/85 via-base/25 to-transparent" />

      <div className="absolute inset-x-0 bottom-0 px-4 pb-10 sm:px-8 sm:pb-14 lg:px-16">
        <AnimatePresence mode="wait">
          <motion.div
            key={featured.tmdbId}
            initial={{ opacity: 0, y: reduceMotion ? 0 : 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="max-w-2xl"
          >
            <p className="text-xs font-medium tracking-[0.35em] text-gold">FEATURED TODAY</p>
            <h1 className="mt-3 text-4xl font-bold leading-tight text-ink drop-shadow-lg sm:text-5xl lg:text-6xl">
              {featured.title}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
              {year && <span>{year}</span>}
              {rating && (
                <span className="inline-flex items-center gap-1 font-semibold text-gold">
                  <Star className="h-4 w-4 fill-gold" aria-hidden />
                  {rating}
                </span>
              )}
              <span className="capitalize">{featured.mediaType === 'tv' ? 'Series' : 'Movie'}</span>
            </div>
            <p className="mt-4 line-clamp-3 max-w-xl text-sm leading-relaxed text-ink/80 sm:text-base">
              {featured.overview}
            </p>
            <Link
              to={titlePath(featured.mediaType, featured.tmdbId)}
              className="mt-6 inline-flex h-11 items-center gap-2 rounded-lg bg-gradient-to-r from-primary to-accent px-6 text-sm font-semibold text-white shadow-glow transition-all duration-200 hover:brightness-110"
            >
              <Info className="h-4 w-4" aria-hidden />
              More information
            </Link>
          </motion.div>
        </AnimatePresence>

        {items.length > 1 && (
          <div className="mt-6 flex gap-2" role="tablist" aria-label="Featured slides">
            {items.map((item, i) => (
              <button
                key={item.tmdbId}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`Show ${item.title}`}
                onClick={() => setIndex(i)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === index ? 'w-8 bg-gold' : 'w-4 bg-white/25 hover:bg-white/50'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
