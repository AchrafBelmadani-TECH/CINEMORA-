import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, SkipBack, SkipForward } from 'lucide-react';
import { playbackApi } from '@/services/playbackApi';
import { VideoPlayer } from '@/player/VideoPlayer';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/ErrorState';
import { Button } from '@/components/ui/Button';

/**
 * /watch?title=movie/10378&episode=<episodeNumber> — cinematic playback page.
 * Saves progress periodically, resumes where the viewer left off, and
 * navigates between episodes when the title has them.
 */
export function WatchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const titleRef = searchParams.get('title') ?? '';
  const episodeNumber = searchParams.get('episode') ? Number(searchParams.get('episode')) : undefined;

  const [stream, setStream] = useState<Awaited<ReturnType<typeof playbackApi.streamInfo>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastSavedRef = useRef(0);

  const load = useCallback(async () => {
    const match = /^(movie|tv)\/(\d+)$/.exec(titleRef);
    if (!match) {
      setError('No playback target specified.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const info = await playbackApi.streamInfo(
        match[1] as 'movie' | 'tv',
        Number(match[2]),
        episodeNumber,
      );
      setStream(info);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start playback');
    } finally {
      setLoading(false);
    }
  }, [titleRef, episodeNumber]);

  useEffect(() => {
    void load();
  }, [load]);

  // Save progress on unload via keepalive so the last seconds are not lost.
  const assetId = stream?.videoAssetId;
  useEffect(() => {
    if (!assetId) return;
    const save = () => {
      const video = document.querySelector('video');
      if (video && video.duration > 0) {
        void playbackApi
          .saveProgress(assetId, Math.round(video.currentTime), Math.round(video.duration))
          .catch(() => undefined);
      }
    };
    window.addEventListener('pagehide', save);
    return () => {
      window.removeEventListener('pagehide', save);
      save();
    };
  }, [assetId]);

  function handleProgress(positionSeconds: number, durationSeconds: number) {
    if (!assetId) return;
    const now = Date.now();
    if (now - lastSavedRef.current < 9000) return;
    lastSavedRef.current = now;
    void playbackApi.saveProgress(assetId, Math.round(positionSeconds), Math.round(durationSeconds)).catch(() => undefined);
  }

  function switchEpisode(episode: { label: string }) {
    const sxE = /S(\d+)E(\d+)/.exec(episode.label);
    if (!sxE) return;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('episode', sxE[2] ?? '');
      return next;
    });
  }

  function goHome() {
    if (stream?.titleId) {
      const match = /^(movie|tv)\/(\d+)$/.exec(titleRef);
      if (match) navigate(`/${match[1]}/${match[2]}`);
      return;
    }
    navigate('/');
  }

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <Spinner label="Preparing playback" />
      </div>
    );
  }

  if (error || !stream) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <ErrorState title="Playback could not start" message={error ?? 'Unknown error'} onRetry={load} />
        <div className="mt-6 text-center">
          <Link to="/" className="text-sm text-gold hover:underline">
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  if (!stream.available) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <ErrorState
          title="This title isn't watchable yet"
          message={
            stream.reason === 'NOT_YET_READY'
              ? 'The video is still processing. Check back soon.'
              : 'No authorized video source exists for this title. CINEMORA only streams content it is legally allowed to distribute.'
          }
          onRetry={load}
        />
        <div className="mt-6 text-center">
          <Link to="/" className="text-sm text-gold hover:underline">
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <VideoPlayer
        key={stream.videoAssetId}
        src={stream.url!}
        startAt={stream.resumePositionSeconds ?? 0}
        subtitles={(stream.subtitles ?? []).map((s) => ({
          id: s.id,
          label: s.label,
          url: s.url,
          language: s.language,
        }))}
        qualities={stream.qualities ?? []}
        onProgress={handleProgress}
        autoPlay
      />

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-bold tracking-wide text-ink sm:text-2xl">{stream.title}</h1>
          {stream.episode && (
            <p className="mt-1 text-sm text-muted">
              S{stream.episode.seasonNumber}E{stream.episode.episodeNumber} · {stream.episode.name}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {stream.prevEpisode && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => switchEpisode(stream.prevEpisode!)}
              className="inline-flex items-center gap-1.5"
            >
              <SkipBack className="h-3.5 w-3.5" aria-hidden />
              {stream.prevEpisode.label}
            </Button>
          )}
          {stream.nextEpisode && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => switchEpisode(stream.nextEpisode!)}
              className="inline-flex items-center gap-1.5"
            >
              {stream.nextEpisode.label}
              <SkipForward className="h-3.5 w-3.5" aria-hidden />
            </Button>
          )}
        </div>
      </div>

      {stream.resumePositionSeconds != null && stream.resumePositionSeconds > 5 && (
        <p className="mt-2 text-xs text-gold">Resuming from where you left off…</p>
      )}

      <div className="mt-6 flex items-center gap-2 text-xs text-muted">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        <button type="button" onClick={goHome} className="hover:text-gold">
          Back to title
        </button>
        <span>· Licensed content, {stream.format} stream · progress saves automatically</span>
      </div>
    </div>
  );
}
