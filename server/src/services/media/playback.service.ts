import { prisma } from '../../lib/prisma.js';
import { signMediaToken } from './mediaToken.js';
import type { Env } from '../../lib/env.js';

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
  format?: 'HLS' | 'MP4';
  qualities?: string[];
  durationSeconds?: number;
  subtitles?: StreamSubtitle[];
  resumePositionSeconds?: number | null;
  episode?: { episodeId: string; seasonNumber: number; episodeNumber: number; name: string } | null;
  nextEpisode?: { episodeId: string; label: string } | null;
  prevEpisode?: { episodeId: string; label: string } | null;
}

const assetSelect = {
  id: true,
  status: true,
  hlsPrefix: true,
  sourceKey: true,
  durationSeconds: true,
  qualities: true,
  subtitleTracks: { select: { id: true, language: true, label: true, isDefault: true } },
  episode: {
    select: { id: true, episodeNumber: true, name: true, season: { select: { seasonNumber: true } } },
  },
} as const;

type AssetRow = {
  id: string;
  status: string;
  hlsPrefix: string | null;
  sourceKey: string | null;
  durationSeconds: number | null;
  qualities: string[];
  subtitleTracks: ReadonlyArray<{ id: string; language: string; label: string; isDefault: boolean }>;
  episode: { id: string; episodeNumber: number; name: string; season: { seasonNumber: number } } | null;
};

/**
 * Resolves what (if anything) can legally and technically play right now.
 * Availability is derived only from sources/assets — never from metadata.
 */
export class PlaybackService {
  constructor(private readonly env: Env) {}

  private hlsUrl(assetId: string): string {
    return `/api/v1/media/hls/${assetId}/master.m3u8?token=${signMediaToken(assetId, this.env.JWT_SECRET)}`;
  }

  private subtitleUrl(trackId: string): string {
    return `/api/v1/media/subtitles/${trackId}.vtt?token=${signMediaToken(trackId, this.env.JWT_SECRET)}`;
  }

  private async toStreamInfo(
    asset: AssetRow,
    titleId: string,
    title: string,
    userId: string | null,
    profileId: string | null,
  ): Promise<StreamInfo> {
    if (asset.status !== 'READY') {
      return { available: false, reason: 'NOT_YET_READY', titleId, title };
    }

    // Remote-source assets play directly from the external URL (no HLS).
    const isRemote = !asset.hlsPrefix && asset.sourceKey?.startsWith('https://');
    const url = isRemote ? asset.sourceKey! : this.hlsUrl(asset.id);

    const resume =
      userId && profileId
        ? await prisma.playbackProgress.findUnique({
            where: { profileId_videoAssetId: { profileId, videoAssetId: asset.id } },
            select: { positionSeconds: true, completed: true },
          })
        : null;

    return {
      available: true,
      titleId,
      title,
      videoAssetId: asset.id,
      url,
      format: isRemote ? 'MP4' : 'HLS',
      qualities: asset.qualities,
      durationSeconds: asset.durationSeconds ?? undefined,
      subtitles: asset.subtitleTracks.map((t) => ({
        id: t.id,
        language: t.language,
        label: t.label,
        url: this.subtitleUrl(t.id),
        isDefault: t.isDefault,
      })),
      resumePositionSeconds: resume && !resume.completed ? resume.positionSeconds : null,
      episode: asset.episode
        ? {
            episodeId: asset.episode.id,
            seasonNumber: asset.episode.season.seasonNumber,
            episodeNumber: asset.episode.episodeNumber,
            name: asset.episode.name,
          }
        : null,
      ...(asset.episode ? await this.neighbours(titleId, asset.episode.id) : {}),
    };
  }

  /** Next/prev READY episode relative to the current one (season order). */
  private async neighbours(
    titleId: string,
    episodeId: string,
  ): Promise<{ nextEpisode?: { episodeId: string; label: string }; prevEpisode?: { episodeId: string; label: string } }> {
    const siblings = await prisma.videoAsset.findMany({
      where: { episode: { season: { titleId } }, status: 'READY' },
      orderBy: [{ episode: { season: { seasonNumber: 'asc' } } }, { episode: { episodeNumber: 'asc' } }],
      select: {
        episode: { select: { id: true, episodeNumber: true, season: { select: { seasonNumber: true } } } },
      },
    });
    const index = siblings.findIndex((s) => s.episode?.id === episodeId);
    const label = (s: (typeof siblings)[number]) =>
      `S${s.episode!.season.seasonNumber}E${s.episode!.episodeNumber}`;
    return {
      nextEpisode:
        index >= 0 && index < siblings.length - 1
          ? { episodeId: siblings[index + 1]!.episode!.id, label: label(siblings[index + 1]!) }
          : undefined,
      prevEpisode:
        index > 0
          ? { episodeId: siblings[index - 1]!.episode!.id, label: label(siblings[index - 1]!) }
          : undefined,
    };
  }

  async titleStreamInfo(
    tmdbType: 'movie' | 'tv',
    tmdbId: number,
    userId: string | null,
    profileId: string | null,
    episodeNumber?: number,
  ): Promise<StreamInfo> {
    const title = await prisma.title.findUnique({
      where: { tmdbType_tmdbId: { tmdbType: tmdbType === 'movie' ? 'MOVIE' : 'TV', tmdbId } },
      select: { id: true, title: true, availability: true, isPublished: true },
    });

    if (!title) {
      return { available: false, reason: 'NOT_IN_LIBRARY' };
    }
    if (!title.isPublished) {
      return { available: false, reason: 'NO_AUTHORIZED_SOURCE', titleId: title.id, title: title.title };
    }

    const baseWhere = episodeNumber != null
      ? { episode: { episodeNumber, season: { titleId: title.id } } }
      : { OR: [{ titleId: title.id }, { episode: { season: { titleId: title.id } } }] };

    // READY asset first; otherwise an in-flight asset explains NOT_YET_READY.
    const ready = await prisma.videoAsset.findFirst({
      where: { ...baseWhere, status: 'READY' },
      orderBy: [{ episode: { season: { seasonNumber: 'asc' } } }, { episode: { episodeNumber: 'asc' } }],
      select: assetSelect,
    });
    const asset: AssetRow | null =
      ready ??
      (await prisma.videoAsset.findFirst({
        where: { ...baseWhere, status: { in: ['VALIDATING', 'TRANSCODING'] } },
        select: assetSelect,
      }));

    if (!asset) {
      // No HLS asset — fall back to a registered remote video source
      // (e.g. a verified Archive.org stream). Remote sources are played
      // natively by the browser; nothing is proxied or rewritten.
      const candidates = await prisma.videoSource.findMany({
        where: episodeNumber != null
          ? { episode: { episodeNumber, season: { titleId: title.id } } }
          : { titleId: title.id },
        orderBy: { createdAt: 'asc' },
      });
      const now = new Date();
      const activeSource = candidates.find(
        (s) => s.status === 'ACTIVE' && (!s.expiresAt || s.expiresAt > now),
      );

      if (activeSource?.externalUrl) {
        // Remote sources have a companion READY videoAsset row (created at
        // registration) so playback progress has a stable key.
        const remoteAsset = await prisma.videoAsset.findFirst({
          where: { titleId: title.id, status: 'READY', sourceKey: activeSource.externalUrl },
          orderBy: { createdAt: 'asc' },
        });
        const resume =
          userId && profileId && remoteAsset
            ? await prisma.playbackProgress.findUnique({
                where: { profileId_videoAssetId: { profileId, videoAssetId: remoteAsset.id } },
                select: { positionSeconds: true, completed: true },
              })
            : null;

        return {
          available: true,
          titleId: title.id,
          title: title.title,
          videoAssetId: remoteAsset?.id,
          url: activeSource.externalUrl,
          format: 'MP4',
          qualities: [],
          durationSeconds: remoteAsset?.durationSeconds ?? undefined,
          subtitles: [],
          resumePositionSeconds: resume && !resume.completed ? resume.positionSeconds : null,
          episode: null,
        };
      }

      return {
        available: false,
        reason: title.availability === 'PROCESSING' ? 'NOT_YET_READY' : 'NO_AUTHORIZED_SOURCE',
        titleId: title.id,
        title: title.title,
      };
    }
    return this.toStreamInfo(asset, title.id, title.title, userId, profileId);
  }

  /** Per-episode playability for a deep-synced TV title (episodeNumber → status). */
  async episodeAvailability(tmdbType: 'movie' | 'tv', tmdbId: number): Promise<Record<string, string>> {
    const title = await prisma.title.findUnique({
      where: { tmdbType_tmdbId: { tmdbType: tmdbType === 'movie' ? 'MOVIE' : 'TV', tmdbId } },
      select: {
        seasons: {
          select: {
            episodes: { select: { episodeNumber: true, videoAssets: { select: { status: true } } } },
          },
        },
      },
    });
    if (!title) return {};

    const map: Record<string, string> = {};
    for (const season of title.seasons) {
      for (const episode of season.episodes) {
        const ready = episode.videoAssets.some((a) => a.status === 'READY');
        const processing = episode.videoAssets.some((a) => a.status === 'TRANSCODING' || a.status === 'VALIDATING');
        map[String(episode.episodeNumber)] = ready ? 'AVAILABLE' : processing ? 'PROCESSING' : 'UNAVAILABLE';
      }
    }
    return map;
  }

  /** Continue-watching feed: recent incomplete progress with title snapshots. */
  async continueWatching(profileId: string) {
    const rows = await prisma.playbackProgress.findMany({
      where: { profileId, completed: false },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    });

    const items = [];
    for (const row of rows) {
      const asset = await prisma.videoAsset.findUnique({
        where: { id: row.videoAssetId },
        select: {
          id: true,
          durationSeconds: true,
          title: { select: { title: true, posterPath: true, tmdbId: true, tmdbType: true } },
          episode: {
            select: {
              id: true,
              name: true,
              episodeNumber: true,
              season: {
                select: {
                  seasonNumber: true,
                  title: { select: { title: true, posterPath: true, tmdbId: true, tmdbType: true } },
                },
              },
            },
          },
        },
      });
      if (!asset) continue;

      const isEpisode = Boolean(asset.episode);
      const show = isEpisode ? asset.episode!.season.title : asset.title;
      if (!show) continue;

      items.push({
        videoAssetId: asset.id,
        episodeId: asset.episode?.id ?? null,
        label: isEpisode
          ? `${show.title} — S${asset.episode!.season.seasonNumber}E${asset.episode!.episodeNumber} · ${asset.episode!.name}`
          : show.title,
        posterPath: show.posterPath,
        titleHref: `/${show.tmdbType === 'MOVIE' ? 'movie' : 'tv'}/${show.tmdbId}`,
        positionSeconds: row.positionSeconds,
        durationSeconds: row.durationSeconds,
        percent:
          row.durationSeconds > 0 ? Math.min(100, Math.round((row.positionSeconds / row.durationSeconds) * 100)) : 0,
        updatedAt: row.updatedAt,
      });
    }
    return { items };
  }
}
