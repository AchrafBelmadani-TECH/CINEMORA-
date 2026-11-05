import Hls from 'hls.js';
import { useEffect, useRef, useState } from 'react';
import { Maximize, Pause, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface PlayerSubtitle {
  id: string;
  label: string;
  url: string;
  language: string;
}

export interface VideoPlayerProps {
  /** HLS master playlist or direct MP4 URL. */
  src: string;
  poster?: string | null;
  /** Position to resume from, in seconds. */
  startAt?: number;
  subtitles?: PlayerSubtitle[];
  qualities?: string[];
  /** Fired at most every 10 s during playback, plus on pause/unmount. */
  onProgress?: (positionSeconds: number, durationSeconds: number) => void;
  onError?: (message: string) => void;
  className?: string;
  autoPlay?: boolean;
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return h > 0
    ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    : `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * CINEMORA player: HTML5 video with HLS.js for adaptive streams. Every control
 * performs its advertised action — keyboard shortcuts included.
 * Shortcuts: space/k play · ←/→ ±10 s · ↑/↓ volume · m mute · f fullscreen.
 */
export function VideoPlayer({
  src,
  poster,
  startAt = 0,
  subtitles = [],
  qualities = [],
  onProgress,
  onError,
  className,
  autoPlay = false,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const lastSavedRef = useRef(0);
  const seekingRef = useRef(false);

  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(true);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeQuality, setActiveQuality] = useState<string>('auto');
  const [activeSubtitle, setActiveSubtitle] = useState<string>('off');

  // ── Stream setup (HLS.js or native) ──────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    setError(null);

    if (Hls.isSupported() && src.includes('.m3u8')) {
      const hls = new Hls({
        // native MP4 fallbacks bypass this path entirely
        maxBufferLength: 30,
      });
      hlsRef.current = hls;
      hls.attachMedia(video);
      hls.on(Hls.Events.MEDIA_ATTACHED, () => hls.loadSource(src));
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad(); // transient network hiccup — recover
              onError?.('Network interruption — reconnecting…');
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              setError('Playback failed. The stream may be temporarily unavailable.');
              setBuffering(false);
              break;
          }
        }
      });
      return () => {
        hls.destroy();
        hlsRef.current = null;
      };
    }

    // Native playback (progressive MP4 from authorized origins).
    video.src = src;
    return () => {
      video.removeAttribute('src');
      video.load();
    };
  }, [src, onError]);

  // ── Resume position ──────────────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video || startAt <= 0) return;
    const onLoaded = () => {
      if (video.duration > 0 && startAt < video.duration - 10) {
        video.currentTime = startAt;
      }
    };
    video.addEventListener('loadedmetadata', onLoaded, { once: true });
    return () => video.removeEventListener('loadedmetadata', onLoaded);
  }, [startAt, src]);

  // ── Media element events ─────────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTime = () => {
      if (!seekingRef.current) setCurrent(video.currentTime);
      const now = Date.now();
      if (onProgress && !video.paused && now - lastSavedRef.current > 10_000 && video.duration > 0) {
        lastSavedRef.current = now;
        onProgress(video.currentTime, video.duration);
      }
    };
    const onLoadedMeta = () => setDuration(video.duration);
    const onPlay = () => setPlaying(true);
    const onPause = () => {
      setPlaying(false);
      if (onProgress && video.duration > 0) onProgress(video.currentTime, video.duration);
    };
    const onWaiting = () => setBuffering(true);
    const onPlaying = () => setBuffering(false);
    const onCanPlay = () => setBuffering(false);
    const onEnded = () => {
      setPlaying(false);
      if (onProgress && video.duration > 0) onProgress(video.duration, video.duration);
    };
    const onVideoError = () => {
      setError('This video could not be played. The source may be offline.');
      setBuffering(false);
    };

    video.addEventListener('timeupdate', onTime);
    video.addEventListener('loadedmetadata', onLoadedMeta);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('canplay', onCanPlay);
    video.addEventListener('ended', onEnded);
    video.addEventListener('error', onVideoError);
    return () => {
      video.removeEventListener('timeupdate', onTime);
      video.removeEventListener('loadedmetadata', onLoadedMeta);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('canplay', onCanPlay);
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('error', onVideoError);
    };
  }, [onProgress]);

  // ── Subtitle tracks ──────────────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    // remove stale tracks
    while (video.firstChild && (video.firstChild as HTMLElement).tagName === 'TRACK') {
      video.removeChild(video.firstChild);
    }
    for (const sub of subtitles) {
      const track = document.createElement('track');
      track.kind = 'subtitles';
      track.src = sub.url;
      track.srclang = sub.language;
      track.label = sub.label;
      if (activeSubtitle === sub.id) {
        track.default = true;
      }
      video.appendChild(track);
    }
    // force re-evaluation of text tracks
    const currentMode = activeSubtitle === 'off' ? 'disabled' : 'showing';
    for (const track of Array.from(video.textTracks)) {
      track.mode = activeSubtitle === 'off' || !track.label ? 'disabled' : currentMode;
    }
  }, [subtitles, activeSubtitle, src]);

  // ── Controls ─────────────────────────────────────────────────────────────
  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play().catch(() => setError('Playback was blocked by the browser.'));
    else video.pause();
  }

  function seekTo(seconds: number) {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration)) return;
    video.currentTime = Math.max(0, Math.min(video.duration - 0.5, seconds));
    setCurrent(video.currentTime);
  }

  function changeVolume(value: number) {
    const video = videoRef.current;
    if (!video) return;
    video.volume = value;
    video.muted = value === 0;
    setVolume(value);
    setMuted(value === 0);
  }

  function toggleMute() {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  }

  function toggleFullscreen() {
    const container = containerRef.current;
    if (!container) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void container.requestFullscreen().catch(() => undefined);
  }

  function changeSpeed(value: number) {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = value;
    setSpeed(value);
  }

  function selectQuality(value: string) {
    const hls = hlsRef.current;
    setActiveQuality(value);
    if (!hls) return;
    if (value === 'auto') {
      hls.currentLevel = -1;
      return;
    }
    const levelIndex = hls.levels.findIndex((l) => l.name === value || `${l.height}p` === value);
    if (levelIndex >= 0) hls.currentLevel = levelIndex;
  }

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onFsChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // ── Keyboard shortcuts ───────────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      switch (event.key.toLowerCase()) {
        case ' ':
        case 'k':
          event.preventDefault();
          togglePlay();
          break;
        case 'arrowright':
          event.preventDefault();
          seekTo((videoRef.current?.currentTime ?? 0) + 10);
          break;
        case 'arrowleft':
          event.preventDefault();
          seekTo((videoRef.current?.currentTime ?? 0) - 10);
          break;
        case 'arrowup':
          event.preventDefault();
          changeVolume(Math.min(1, volume + 0.1));
          break;
        case 'arrowdown':
          event.preventDefault();
          changeVolume(Math.max(0, volume - 0.1));
          break;
        case 'm':
          toggleMute();
          break;
        case 'f':
          toggleFullscreen();
          break;
        default:
          break;
      }
    };
    container.addEventListener('keydown', onKey);
    container.tabIndex = 0;
    return () => container.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [volume]);

  return (
    <div
      ref={containerRef}
      className={cn('group relative w-full overflow-hidden rounded-xl bg-black outline-none', className)}
    >
      <video
        ref={videoRef}
        poster={poster ?? undefined}
        className="aspect-video w-full"
        playsInline
        autoPlay={autoPlay}
        onSeeking={() => (seekingRef.current = true)}
        onSeeked={() => (seekingRef.current = false)}
      >
        {subtitles.map((sub) => (
          <track key={sub.id} kind="subtitles" src={sub.url} srcLang={sub.language} label={sub.label} />
        ))}
      </video>

      {buffering && !error && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
          <div className="h-12 w-12 animate-spin rounded-full border-2 border-gold/30 border-t-gold" />
        </div>
      )}

      {error && (
        <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-base/85 px-6 text-center">
          <p className="max-w-sm text-sm text-red-300">{error}</p>
          <button
            type="button"
            onClick={() => {
              setError(null);
              const video = videoRef.current;
              if (video) {
                const time = video.currentTime;
                video.load();
                video.currentTime = time;
                void video.play().catch(() => undefined);
              }
            }}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 text-sm font-medium text-ink hover:bg-white/10"
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
            Retry playback
          </button>
        </div>
      )}

      {/* Controls */}
      <div className="absolute inset-x-0 bottom-0 translate-y-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-4 pb-3 pt-10 opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-within:opacity-100">
        {/* timeline */}
        <div className="flex items-center gap-3">
          <span className="w-12 text-right text-xs tabular-nums text-white/80">{formatTime(current)}</span>
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={1}
            value={current}
            aria-label="Seek"
            onChange={(e) => seekTo(Number(e.target.value))}
            className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-white/25 accent-gold"
            style={{
              background: `linear-gradient(to right, #d6b36a ${(current / (duration || 1)) * 100}%, rgba(255,255,255,0.25) ${(current / (duration || 1)) * 100}%)`,
            }}
          />
          <span className="w-12 text-xs tabular-nums text-white/80">{formatTime(duration)}</span>
        </div>

        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            onClick={togglePlay}
            aria-label={playing ? 'Pause' : 'Play'}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-gold text-base transition-transform hover:scale-105"
          >
            {playing ? <Pause className="h-5 w-5" aria-hidden /> : <Play className="ml-0.5 h-5 w-5" aria-hidden />}
          </button>

          <div className="group/vol flex items-center gap-2">
            <button
              type="button"
              onClick={toggleMute}
              aria-label={muted ? 'Unmute' : 'Mute'}
              className="text-white/85 hover:text-white"
            >
              {muted || volume === 0 ? <VolumeX className="h-5 w-5" aria-hidden /> : <Volume2 className="h-5 w-5" aria-hidden />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              aria-label="Volume"
              onChange={(e) => changeVolume(Number(e.target.value))}
              className="h-1 w-0 cursor-pointer appearance-none rounded-full bg-white/25 accent-gold transition-all duration-200 group-hover/vol:w-16 sm:w-16"
            />
          </div>

          <div className="ml-auto flex items-center gap-1">
            {subtitles.length > 0 && (
              <select
                aria-label="Subtitles"
                value={activeSubtitle}
                onChange={(e) => setActiveSubtitle(e.target.value)}
                className="h-8 rounded-md border border-white/20 bg-black/60 px-1.5 text-xs text-white"
              >
                <option value="off">Subtitles: off</option>
                {subtitles.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.label}
                  </option>
                ))}
              </select>
            )}

            {hlsRef.current && qualities.length > 0 && (
              <select
                aria-label="Quality"
                value={activeQuality}
                onChange={(e) => selectQuality(e.target.value)}
                className="h-8 rounded-md border border-white/20 bg-black/60 px-1.5 text-xs text-white"
              >
                <option value="auto">Auto</option>
                {qualities.map((q) => (
                  <option key={q} value={q}>
                    {q}
                  </option>
                ))}
              </select>
            )}

            <select
              aria-label="Playback speed"
              value={speed}
              onChange={(e) => changeSpeed(Number(e.target.value))}
              className="h-8 rounded-md border border-white/20 bg-black/60 px-1.5 text-xs text-white"
            >
              {SPEEDS.map((s) => (
                <option key={s} value={s}>
                  {s}×
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              className="flex h-8 w-8 items-center justify-center rounded-md text-white/85 hover:text-white"
            >
              <Maximize className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
