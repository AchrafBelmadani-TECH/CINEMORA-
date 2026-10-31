import { prisma } from '../../lib/prisma.js';


export interface LibraryStats {
  titles: number;
  movies: number;
  tvShows: number;
  seasons: number;
  episodes: number;
  watchable: number;
  activeSources: number;
  lastSyncAt: string | null;
}

/** Truthful library reporting — watchable counts ONLY genuinely sourced titles. */
export class LibraryService {
  async stats(): Promise<LibraryStats> {
    const [titles, movies, tvShows, seasons, episodes, watchable, activeSources, lastJob] =
      await Promise.all([
        prisma.title.count(),
        prisma.title.count({ where: { kind: 'MOVIE' } }),
        prisma.title.count({ where: { kind: 'TV' } }),
        prisma.season.count(),
        prisma.episode.count(),
        prisma.title.count({ where: { availability: 'AVAILABLE' } }),
        prisma.videoSource.count({ where: { status: 'ACTIVE' } }),
        prisma.importJob.findFirst({ where: { finishedAt: { not: null } }, orderBy: { startedAt: 'desc' } }),
      ]);

    return {
      titles,
      movies,
      tvShows,
      seasons,
      episodes,
      watchable,
      activeSources,
      lastSyncAt: lastJob?.finishedAt?.toISOString() ?? null,
    };
  }

  /** Honest availability for any TMDB title — including titles we don't have. */
  async availabilityFor(mediaType: 'movie' | 'tv', tmdbId: number) {
    const title = await prisma.title.findUnique({
      where: { tmdbType_tmdbId: { tmdbType: mediaType === 'movie' ? 'MOVIE' : 'TV', tmdbId } },
      select: {
        id: true,
        title: true,
        availability: true,
        isPublished: true,
        _count: { select: { videoSources: true, seasons: true } },
      },
    });

    if (!title) {
      return {
        status: 'UNAVAILABLE',
        inLibrary: false,
        message: 'This title has no local catalog entry and no authorized video source.',
      };
    }

    return {
      status: title.availability,
      inLibrary: true,
      published: title.isPublished,
      title: title.title,
      sources: title._count.videoSources,
      message:
        title.availability === 'AVAILABLE'
          ? 'An authorized video source exists for this title.'
          : 'No authorized video source exists for this title yet.',
    };
  }
}
