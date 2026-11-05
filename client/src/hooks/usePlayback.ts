import { useQuery } from '@tanstack/react-query';
import { playbackApi } from '@/services/playbackApi';
import { apiClient } from '@/services/apiClient';

/** Resolves playability for a title (used by detail pages + player links). */
export function useStreamInfo(mediaType: 'movie' | 'tv', tmdbId: number | undefined, episodeNumber?: number) {
  return useQuery({
    queryKey: ['stream-info', mediaType, tmdbId, episodeNumber ?? null],
    queryFn: () => playbackApi.streamInfo(mediaType, tmdbId!, episodeNumber),
    enabled: tmdbId !== undefined && Number.isFinite(tmdbId),
    staleTime: 60_000,
  });
}

/** Public watchable TMDB id sets — usable without authentication. */
export function useWatchableIds(enabled = true) {
  return useQuery<{ movies: number[]; tvShows: number[] }>({
    queryKey: ['watchable-ids'],
    queryFn: () => apiClient.get<{ movies: number[]; tvShows: number[] }>('/library/watchable-ids'),
    enabled,
    staleTime: 5 * 60_000,
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
