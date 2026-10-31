import type { TitleDetail } from '@/types/catalog';

/** 167 → "2h 47m"; 45 → "45m". */
export function formatRuntime(minutes: number | null | undefined): string | null {
  if (minutes === null || minutes === undefined || minutes <= 0) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m.toString().padStart(2, '0')}m` : `${m}m`;
}

/** TMDB dates (YYYY-MM-DD) → "Feb 27, 2024". Returns the raw string on parse failure. */
export function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export function formatYear(iso: string | null | undefined): string | null {
  return iso ? iso.slice(0, 4) : null;
}

/** Shared runtime text for a title detail (movie runtime or TV episode range). */
export function titleRuntimeLine(detail: TitleDetail): string | null {
  if (detail.mediaType === 'movie') return formatRuntime(detail.runtimeMinutes);
  const runtimes = detail.episodeRunTimeMinutes.filter((n) => n > 0);
  if (runtimes.length === 0) return null;
  const min = Math.min(...runtimes);
  const max = Math.max(...runtimes);
  return min === max ? `${min}m per episode` : `${min}–${max}m per episode`;
}

/** Title link path by media type. */
export function titlePath(mediaType: 'movie' | 'tv', tmdbId: number): string {
  return `/${mediaType}/${tmdbId}`;
}
