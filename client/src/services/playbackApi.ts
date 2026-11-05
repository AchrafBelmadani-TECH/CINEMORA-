import { apiClient } from './apiClient';

export interface StreamSubtitle {
  id: string;
  language: string;
  label: string;
  url: string;
  isDefault: boolean;
}

export interface StreamInfo {
  available: boolean;
  reason?: 'NO_AUTHORIZED_SOURCE' | 'NOT_YET_READY' | 'NOT_IN_LIBRARY';
  titleId?: string;
  title?: string;
  videoAssetId?: string;
  url?: string;
  format?: 'HLS';
  qualities?: string[];
  durationSeconds?: number;
  subtitles?: StreamSubtitle[];
  resumePositionSeconds?: number | null;
  episode?: { episodeId: string; seasonNumber: number; episodeNumber: number; name: string } | null;
  nextEpisode?: { episodeId: string; label: string } | null;
  prevEpisode?: { episodeId: string; label: string } | null;
}

export interface ContinueWatchingItem {
  videoAssetId: string;
  label: string;
  posterPath: string | null;
  titleHref: string | null;
  positionSeconds: number;
  durationSeconds: number;
  percent: number;
  updatedAt: string;
}

export const playbackApi = {
  /** Resolves what can play for a title (optionally a specific episode). */
  streamInfo(tmdbType: 'movie' | 'tv', tmdbId: number, episodeId?: string) {
    return apiClient.get<StreamInfo>(`/titles/${tmdbType}/${tmdbId}/stream-info`, {
      episodeId,
    });
  },

  saveProgress(videoAssetId: string, positionSeconds: number, durationSeconds: number) {
    return apiClient.post<{ progress: { positionSeconds: number; completed: boolean } }>(
      '/playback/progress',
      { videoAssetId, positionSeconds, durationSeconds },
    );
  },

  getProgress(videoAssetId: string) {
    return apiClient.get<{ progress: { positionSeconds: number; completed: boolean } | null }>(
      `/playback/progress/${videoAssetId}`,
    );
  },

  continueWatching() {
    return apiClient.get<{ items: ContinueWatchingItem[] }>('/playback/continue-watching');
  },
};
