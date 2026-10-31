import { Link } from 'react-router-dom';
import { Clock, Star } from 'lucide-react';
import { useSeason } from '@/hooks/useCatalog';
import { stillUrl } from '@/lib/tmdbImage';
import { formatDate } from '@/lib/formatters';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import type { SeasonSummary } from '@/types/catalog';
import { cn } from '@/lib/cn';

export interface SeasonBrowserProps {
  tvId: number;
  seasons: SeasonSummary[];
  /** Active season, synced from the URL (?season=n). */
  activeSeason: number;
  onSeasonChange: (seasonNumber: number) => void;
}

/** Season pills + episode list with stills, overviews, air dates and runtimes. */
export function SeasonBrowser({ tvId, seasons, activeSeason, onSeasonChange }: SeasonBrowserProps) {
  const visibleSeasons = seasons.filter((s) => s.episodeCount > 0 || s.seasonNumber === 0);
  if (visibleSeasons.length === 0) return null;

  const current = visibleSeasons.find((s) => s.seasonNumber === activeSeason) ?? visibleSeasons[0]!;

  return (
    <section aria-label="Seasons and episodes" className="mt-12">
      <h2 className="mb-4 font-display text-lg font-bold tracking-wide text-ink sm:text-xl">Seasons</h2>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Select season">
        {visibleSeasons.map((season) => (
          <button
            key={season.seasonNumber}
            type="button"
            role="tab"
            aria-selected={season.seasonNumber === current.seasonNumber}
            onClick={() => onSeasonChange(season.seasonNumber)}
            className={cn(
              'inline-flex h-9 items-center rounded-full border px-4 text-sm font-medium transition-all duration-200',
              season.seasonNumber === current.seasonNumber
                ? 'border-gold/60 bg-gold/10 text-gold'
                : 'border-white/10 bg-card text-muted hover:border-gold/30 hover:text-ink',
            )}
          >
            {season.name}
          </button>
        ))}
      </div>

      {current.overview && <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted">{current.overview}</p>}

      <EpisodeList tvId={tvId} seasonNumber={current.seasonNumber} onSeasonChange={onSeasonChange} />
    </section>
  );
}

function EpisodeList({
  tvId,
  seasonNumber,
  onSeasonChange,
}: {
  tvId: number;
  seasonNumber: number;
  onSeasonChange: (n: number) => void;
}) {
  const { data, isPending, isError, refetch } = useSeason(tvId, seasonNumber);

  if (isPending) {
    return (
      <div className="mt-6 space-y-4" aria-hidden>
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="flex gap-4 rounded-xl border border-white/5 bg-card/60 p-4">
            <Skeleton className="aspect-video w-40 shrink-0 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/4" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mt-6">
        <ErrorState
          compact
          title="Could not load episodes"
          message="The catalog did not respond for this season."
          onRetry={() => {
            refetch();
            onSeasonChange(seasonNumber);
          }}
        />
      </div>
    );
  }

  return (
    <ol className="mt-6 space-y-4">
      {data?.episodes.map((episode) => {
        const still = stillUrl(episode.stillPath);
        return (
          <li key={episode.episodeNumber} className="flex flex-col gap-4 rounded-xl border border-white/5 bg-card/60 p-4 sm:flex-row">
            <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-lg bg-surface sm:w-40">
              {still ? (
                <img
                  src={still}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  width={300}
                  height={169}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div aria-hidden className="flex h-full w-full items-center justify-center bg-gradient-to-br from-surface to-primary/15 font-display text-2xl text-muted/40">
                  {episode.episodeNumber}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-ink">
                <span className="text-muted">{episode.episodeNumber}.</span> {episode.name}
              </h3>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                {episode.airDate && <span>{formatDate(episode.airDate)}</span>}
                {episode.runtimeMinutes !== null && episode.runtimeMinutes > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" aria-hidden />
                    {episode.runtimeMinutes}m
                  </span>
                )}
                {episode.voteAverage > 0 && (
                  <span className="inline-flex items-center gap-1 text-gold">
                    <Star className="h-3 w-3 fill-gold" aria-hidden />
                    {episode.voteAverage.toFixed(1)}
                  </span>
                )}
              </p>
              {episode.overview && <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted">{episode.overview}</p>}
            </div>
          </li>
        );
      })}
      <li className="pt-1 text-center text-xs text-muted/60">
        <Link to="/tv" className="hover:text-gold">
          Browse all series
        </Link>
      </li>
    </ol>
  );
}
