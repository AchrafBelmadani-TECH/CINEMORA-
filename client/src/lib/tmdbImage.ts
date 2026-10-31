/** Public TMDB image CDN — paths only, never an API key. */
const IMAGE_BASE = 'https://image.tmdb.org/t/p';

type PosterSize = 'w185' | 'w342' | 'w500';
type BackdropSize = 'w780' | 'w1280';
type ProfileSize = 'w185';
type StillSize = 'w300';

export function posterUrl(path: string | null, size: PosterSize = 'w342'): string | null {
  return path ? `${IMAGE_BASE}/${size}${path}` : null;
}

export function backdropUrl(path: string | null, size: BackdropSize = 'w1280'): string | null {
  return path ? `${IMAGE_BASE}/${size}${path}` : null;
}

export function profileUrl(path: string | null, size: ProfileSize = 'w185'): string | null {
  return path ? `${IMAGE_BASE}/${size}${path}` : null;
}

export function stillUrl(path: string | null, size: StillSize = 'w300'): string | null {
  return path ? `${IMAGE_BASE}/${size}${path}` : null;
}
