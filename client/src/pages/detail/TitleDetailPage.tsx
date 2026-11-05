import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Calendar, Clock, Clapperboard, Layers, ListVideo, Play, PlayCircle, Users } from 'lucide-react';
import { useMovieDetail, useTvDetail } from '@/hooks/useCatalog';
import { useStreamInfo } from '@/hooks/usePlayback';
import { useAuthStore } from '@/stores/authStore';import { backdropUrl, posterUrl } from '@/lib/tmdbImage';
import { formatDate, formatYear, titleRuntimeLine } from '@/lib/formatters';
import { RatingRing } from '@/components/media/RatingRing';
import { CastRow } from '@/components/media/CastRow';
import { MediaRow } from '@/components/media/MediaRow';
import { SeasonBrowser } from '@/components/media/SeasonBrowser';
import { TrailerModal } from '@/components/media/TrailerModal';
import { ErrorState } from '@/components/ui/ErrorState';
import { Button } from '@/components/ui/Button';
import { DetailSkeleton } from '@/components/media/skeletons';
import { cn } from '@/lib/cn';

function titleFor(mediaType: 'movie' | 'tv', id: number | undefined): { key: 'movie' | 'tv'; id?: number } {
  if (id === undefined || Number.isNaN(id)) return { key: mediaType };
  return { key: mediaType, id };
}

/**
 * Shared movie & TV detail page: cinematic backdrop, poster, metadata, cast,
 * trailer modal, recommendations — plus the season/episode browser for TV.
 */
export function TitleDetailPage({ mediaType }: { mediaType: 'movie' | 'tv' }) {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [trailerKey, setTrailerKey] = useState<string | null>(null);
  const { key, id: titleId } = titleFor(mediaType, id ? Number.parseInt(id, 10) : undefined);

  const movieQuery = useMovieDetail(key === 'movie' ? titleId : undefined);
  const tvQuery = useTvDetail(key === 'tv' ? titleId : undefined);
  const query = key === 'movie' ? movieQuery : tvQuery;
  const detail = query.data;

  // Playability (authenticated): Watch Now only when a verified source exists.
  const authStatus = useAuthStore((st) => st.status);
  const streamQuery = useStreamInfo(mediaType, titleId);
  const canWatch = authStatus === 'authenticated' && streamQuery.data?.available === true;

  // Season selection lives in the URL (?season=n) for shareable deep links.
  const activeSeasonParam = searchParams.get('season');
  const seasons = detail?.seasons.filter((s) => s.episodeCount > 0 || s.seasonNumber === 0) ?? [];
  const paramSeason =
    activeSeasonParam !== null && seasons.some((s) => s.seasonNumber === Number(activeSeasonParam))
      ? Number(activeSeasonParam)
      : null;
  const activeSeason =
    paramSeason ?? (seasons.find((s) => s.seasonNumber > 0) ?? seasons[0])?.seasonNumber;

  if (query.isPending) return <DetailSkeleton />;

  if (query.isError || !detail) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <ErrorState
          title="We couldn't find this title"
          message="It may not exist, or the catalog service is unreachable right now."
          onRetry={query.refetch}
        />
        <div className="mt-6 text-center">
          <Link to="/" className="text-sm text-gold hover:underline">
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  const poster = posterUrl(detail.posterPath);
  const backdrop = backdropUrl(detail.backdropPath);
  const runtimeLine = titleRuntimeLine(detail);
  const trailer = detail.videos[0];

  // Playability (authenticated): Watch Now only when a verified source exists.
  const year = formatYear(detail.releaseDate);
  const genreNames = detail.genres.map((g) => g.name);

  return (
    <div>
      {/* Backdrop hero */}
      <section className="relative">
        <div className="absolute inset-0 h-105 overflow-hidden sm:h-130">
          {backdrop && (
            <img src={backdrop} alt="" width={1280} height={720} className="h-full w-full object-cover" />
          )}
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-base via-base/70 to-base/20" />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-base/80 via-transparent to-transparent" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 pt-40 sm:px-6 sm:pt-56">
          <div className="flex flex-col gap-8 sm:flex-row sm:items-end">
            <div className="w-40 shrink-0 overflow-hidden rounded-xl border border-white/10 shadow-glow sm:w-56">
              {poster ? (
                <img src={poster} alt={`${detail.title} poster`} width={342} height={513} className="w-full" />
              ) : (
                <div aria-hidden className="flex aspect-2/3 items-center justify-center bg-card text-muted/40">
                  <Clapperboard className="h-12 w-12" />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1 pb-1">
              <h1 className="text-3xl font-bold leading-tight text-ink drop-shadow sm:text-4xl lg:text-5xl">
                {detail.title}
              </h1>
              {detail.tagline && <p className="mt-2 text-sm italic text-gold/90">“{detail.tagline}”</p>}

              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted">
                {year && (
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" aria-hidden />
                    {formatDate(detail.releaseDate)}
                  </span>
                )}
                {runtimeLine && (
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="h-4 w-4" aria-hidden />
                    {runtimeLine}
                  </span>
                )}
                {detail.mediaType === 'tv' && detail.numberOfSeasons !== null && (
                  <span className="inline-flex items-center gap-1.5">
                    <Layers className="h-4 w-4" aria-hidden />
                    {detail.numberOfSeasons} season{detail.numberOfSeasons === 1 ? '' : 's'}
                    {detail.numberOfEpisodes !== null ? ` · ${detail.numberOfEpisodes} episodes` : ''}
                  </span>
                )}
                {detail.status && <span className="rounded border border-white/10 px-2 py-0.5 text-xs">{detail.status}</span>}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <RatingRing value={detail.voteAverage} size={58} />
                <span className="text-xs text-muted">{detail.voteCount.toLocaleString()} votes</span>
              </div>

              {genreNames.length > 0 && (
                <ul className="mt-4 flex flex-wrap gap-2" aria-label="Genres">
                  {detail.genres.map((genre) => (
                    <li key={genre.id}>
                      <Link
                        to={`/genre/${genre.id}?type=${detail.mediaType}`}
                        className="inline-flex h-7 items-center rounded-full border border-white/10 bg-card/80 px-3 text-xs font-medium text-muted transition-colors hover:border-gold/40 hover:text-gold"
                      >
                        {genre.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}

              {detail.directors.length > 0 && (
                <p className="mt-4 text-sm text-muted">
                  <span className="text-ink">{detail.mediaType === 'movie' ? 'Director' : 'Created by'}:</span>{' '}
                  {detail.directors.slice(0, 3).map((d) => d.name).join(', ')}
                </p>
              )}

              {trailer && (
                <Button
                  variant="primary"
                  className="mt-5"
                  onClick={() => setTrailerKey(trailer.key)}
                >
                  <Play className="h-4 w-4" aria-hidden />
                  Watch trailer
                </Button>
              )}

              {canWatch && (
                <Link
                  to={`/watch?title=${mediaType}/${detail.tmdbId}`}
                  className={cn(
                    'inline-flex h-10 items-center gap-2 rounded-lg border border-gold/40 bg-gold/10 px-4 text-sm font-semibold text-gold',
                    'transition-all duration-200 hover:bg-gold/20',
                    trailer ? 'ml-3' : 'mt-5',
                  )}
                >
                  <PlayCircle className="h-4 w-4" aria-hidden />
                  Watch now
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
        {detail.overview && (
          <section aria-label="Overview" className="mt-10">
            <h2 className="mb-3 font-display text-lg font-bold tracking-wide text-ink sm:text-xl">Overview</h2>
            <p className="max-w-3xl text-sm leading-relaxed text-muted sm:text-base">{detail.overview}</p>
          </section>
        )}

        {detail.cast.length > 0 && (
          <section aria-label="Cast" className="mt-10">
            <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold tracking-wide text-ink sm:text-xl">
              <Users className="h-4 w-4 text-gold" aria-hidden />
              Top cast
            </h2>
            <CastRow cast={detail.cast} />
          </section>
        )}

        {detail.mediaType === 'tv' && seasons.length > 0 && (
          <SeasonBrowser
            tvId={detail.tmdbId}
            seasons={detail.seasons}
            activeSeason={activeSeason ?? 0}
            onSeasonChange={(seasonNumber) =>
              setSearchParams((prev) => {
                const next = new URLSearchParams(prev);
                next.set('season', String(seasonNumber));
                return next;
              })
            }
          />
        )}

        {detail.recommendations.items.length > 0 && (
          <section aria-label="More like this" className="mt-12">
            <h2 className={cn('mb-4 flex items-center gap-2 font-display text-lg font-bold tracking-wide text-ink sm:text-xl')}>
              <ListVideo className="h-4 w-4 text-gold" aria-hidden />
              More like this
            </h2>
            <MediaRow title="More like this" items={detail.recommendations.items} hideHeading />
          </section>
        )}

        <p className="mt-12 text-center text-xs text-muted/70">
          Metadata &amp; artwork by{' '}
          <a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer" className="underline decoration-gold/40 hover:text-gold">
            TMDB
          </a>
          {' '}· streaming arrives only with licensed sources (Phase 6+).
        </p>
      </div>

      <TrailerModal
        videoKey={trailerKey}
        videoName={detail.videos.find((v) => v.key === trailerKey)?.name}
        onClose={() => setTrailerKey(null)}
      />
    </div>
  );
}
