import { useQuery } from '@tanstack/react-query';
import { playbackApi } from '@/services/playbackApi';

/** Resolves playability for a title (used by detail pages + player links). */
export function useStreamInfo(mediaType: 'movie' | 'tv', tmdbId: number | undefined, episodeId?: string) {
  return useQuery({
    queryKey: ['stream-info', mediaType, tmdbId, episodeId ?? null],
    queryFn: () => playbackApi.streamInfo(mediaType, tmdbId!, episodeId),
    enabled: tmdbId !== undefined && Number.isFinite(tmdbId),
    staleTime: 60_000,
  });
}

/** Continue-watching feed for the active profile (authenticated only). */
export function useContinueWatching(enabled: boolean) {
  return useQuery({
    queryKey: ['continue-watching'],
    queryFn: () => playbackApi.continueWatching(),
    enabled,
    staleTime: 30_000,
  });
}
