import { AppError } from '../../lib/errors.js';
import type { Logger } from '../../lib/logger.js';
import type { TmdbClient } from '../tmdb/tmdbClient.js';
import { prisma } from '../../lib/prisma.js';

/** TMDB-facing media type (lowercase, as used in TMDB paths). */
type TmdbMediaType = 'movie' | 'tv';

/** TMDB list sources available for incremental catalog synchronization. */
export const SYNC_SOURCES = {
  movie_trending: { mediaType: 'movie', path: '/trending/movie/day' },
  movie_popular: { mediaType: 'movie', path: '/movie/popular' },
  movie_top_rated: { mediaType: 'movie', path: '/movie/top_rated' },
  movie_now_playing: { mediaType: 'movie', path: '/movie/now_playing' },
  movie_upcoming: { mediaType: 'movie', path: '/movie/upcoming' },
  tv_popular: { mediaType: 'tv', path: '/tv/popular' },
  tv_top_rated: { mediaType: 'tv', path: '/tv/top_rated' },
  tv_airing_today: { mediaType: 'tv', path: '/tv/airing_today' },
  tv_on_the_air: { mediaType: 'tv', path: '/tv/on_the_air' },
} as const;

export type SyncSourceKey = keyof typeof SYNC_SOURCES;

export function isSyncSourceKey(value: string): value is SyncSourceKey {
  return Object.prototype.hasOwnProperty.call(SYNC_SOURCES, value);
}

const PAGE_PACING_MS = 250;
const TMDB_MAX_PAGES = 500;

export interface SyncRunSummary {
  jobId: string;
  source: SyncSourceKey;
  status: 'COMPLETED' | 'PARTIAL' | 'FAILED';
  pagesCompleted: number;
  itemsSeen: number;
  itemsCreated: number;
  itemsUpdated: number;
}

interface TmdbListResult {
  results?: Array<{
    id?: number;
    title?: string;
    name?: string;
    overview?: string;
    poster_path?: string | null;
    backdrop_path?: string | null;
    release_date?: string;
    first_air_date?: string;
    vote_average?: number;
    vote_count?: number;
    popularity?: number;
    genre_ids?: number[];
  }>;
  total_pages?: number;
}

/**
 * Incremental, job-tracked TMDB → local-catalog synchronization.
 * Title metadata only — seasons/episodes are deep-synced per title on demand
 * (see deepSyncTitle) so list syncs stay cheap at 100k-title scale.
 */
export class CatalogSyncService {
  private running = new Set<SyncSourceKey>();

  constructor(
    private readonly tmdb: TmdbClient,
    private readonly logger: Logger,
  ) {}

  private normalizeDate(raw: string | undefined): Date | null {
    if (!raw || !/^\d{4}-\d{2}-\d{2}/.test(raw)) return null;
    const date = new Date(`${raw.slice(0, 10)}T00:00:00Z`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private async ensureGenres(mediaType: 'movie' | 'tv'): Promise<void> {
    const raw = await this.tmdb.getJson<{ genres?: Array<{ id: number; name: string }> }>(
      `/genre/${mediaType}/list`,
    );
    for (const genre of raw.genres ?? []) {
      await prisma.genre.upsert({
        where: { id_tmdbType: { id: genre.id, tmdbType: mediaType === 'movie' ? 'MOVIE' : 'TV' } },
        create: { id: genre.id, name: genre.name, tmdbType: mediaType === 'movie' ? 'MOVIE' : 'TV' },
        update: { name: genre.name },
      });
    }
  }

  /** Upsert one list result. Returns 'created' | 'updated'. */
  private async upsertTitle(
    mediaType: 'movie' | 'tv',
    item: NonNullable<TmdbListResult['results']>[number],
  ): Promise<'created' | 'updated'> {
    const tmdbType = mediaType === 'movie' ? 'MOVIE' : 'TV';
    const tmdbId = item.id;
    if (tmdbId === undefined) throw AppError.badRequest('TMDB list item without id');

    const data = {
      title: (mediaType === 'movie' ? item.title : item.name) ?? 'Untitled',
      overview: item.overview || null,
      posterPath: item.poster_path || null,
      backdropPath: item.backdrop_path || null,
      releaseDate: this.normalizeDate(mediaType === 'movie' ? item.release_date : item.first_air_date),
      voteAverage: item.vote_average ?? 0,
      voteCount: item.vote_count ?? 0,
      popularity: item.popularity ?? 0,
      originalLanguage: null,
      lastSyncedAt: new Date(),
    };

    // update-first gives exact created/updated counts without relying on
    // upsert semantics; the create branch handles the (rare) race.
    const updated = await prisma.title.updateMany({
      where: { tmdbType, tmdbId },
      data,
    });
    if (updated.count > 0) return 'updated';

    try {
      const created = await prisma.title.create({
        data: { ...data, tmdbId, tmdbType, kind: tmdbType },
      });
      await this.connectGenres(created.id, mediaType, item.genre_ids ?? []);
      return 'created';
    } catch (err) {
      if ((err as { code?: string }).code === 'P2002') {
        await prisma.title.updateMany({ where: { tmdbType, tmdbId }, data });
        return 'updated';
      }
      throw err;
    }
  }

  private async connectGenres(titleId: string, mediaType: 'movie' | 'tv', genreIds: number[]): Promise<void> {
    const tmdbType = mediaType === 'movie' ? 'MOVIE' : 'TV';
    for (const genreId of genreIds) {
      const exists = await prisma.genre.findUnique({
        where: { id_tmdbType: { id: genreId, tmdbType } },
      });
      if (!exists) continue; // unknown genres are skipped until the genre sync picks them up
      await prisma.titleGenre.upsert({
        where: { titleId_genreId_tmdbType: { titleId, genreId, tmdbType } },
        create: { titleId, genreId, tmdbType },
        update: {},
      });
    }
  }

  async runImport(sourceKey: SyncSourceKey, maxPages: number): Promise<SyncRunSummary> {
    if (this.running.has(sourceKey)) {
      throw AppError.conflict(`A sync for "${sourceKey}" is already running`);
    }
    this.running.add(sourceKey);

    const source = SYNC_SOURCES[sourceKey];
    const job = await prisma.importJob.create({
      data: { source: sourceKey, status: 'RUNNING', pagesRequested: maxPages },
    });

    let pagesCompleted = 0;
    let itemsSeen = 0;
    let itemsCreated = 0;
    let itemsUpdated = 0;
    const errors: Array<{ page: number; error: string }> = [];
    let lastPage: number | null = null;

    try {
      await this.ensureGenres(source.mediaType);

      for (let page = 1; page <= Math.min(maxPages, TMDB_MAX_PAGES); page++) {
        try {
          const raw = await this.tmdb.getJson<TmdbListResult>(source.path, {
            page,
            include_adult: 'false',
          });
          const results = raw.results ?? [];
          itemsSeen += results.length;
          for (const item of results) {
            const outcome = await this.upsertTitle(source.mediaType, item);
            if (outcome === 'created') itemsCreated += 1;
            else itemsUpdated += 1;
          }
          pagesCompleted += 1;
          lastPage = page;
          await prisma.importJob.update({
            where: { id: job.id },
            data: { pagesCompleted, itemsSeen, itemsCreated, itemsUpdated, lastPage },
          });
          if (page < maxPages) await delay(PAGE_PACING_MS);
        } catch (err) {
          // one retry per page — transient TMDB hiccups should not sink a job
          try {
            await delay(PAGE_PACING_MS);
            const raw = await this.tmdb.getJson<TmdbListResult>(source.path, { page });
            const results = raw.results ?? [];
            itemsSeen += results.length;
            for (const item of results) {
              const outcome = await this.upsertTitle(source.mediaType, item);
              if (outcome === 'created') itemsCreated += 1;
              else itemsUpdated += 1;
            }
            pagesCompleted += 1;
            lastPage = page;
          } catch (retryErr) {
            const message = retryErr instanceof Error ? retryErr.message : String(retryErr);
            errors.push({ page, error: message });
            this.logger.warn({ source: sourceKey, page, err: retryErr }, 'sync page failed after retry');
          }
        }
      }

      const status: SyncRunSummary['status'] =
        pagesCompleted === 0 ? 'FAILED' : errors.length > 0 ? 'PARTIAL' : 'COMPLETED';

      await prisma.importJob.update({
        where: { id: job.id },
        data: {
          status,
          pagesCompleted,
          itemsSeen,
          itemsCreated,
          itemsUpdated,
          errors,
          lastPage,
          finishedAt: new Date(),
          message: errors.length > 0 ? `${errors.length} page(s) failed after retry` : null,
        },
      });

      this.logger.info(
        { source: sourceKey, status, pagesCompleted, itemsCreated, itemsUpdated },
        'catalog sync finished',
      );
      return { jobId: job.id, source: sourceKey, status, pagesCompleted, itemsSeen, itemsCreated, itemsUpdated };
    } catch (err) {
      // catastrophic failure (e.g. genre sync) — record FAILED instead of throwing
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error({ source: sourceKey, err }, 'catalog sync failed');
      await prisma.importJob.update({
        where: { id: job.id },
        data: { status: 'FAILED', errors, message, finishedAt: new Date() },
      });
      return {
        jobId: job.id,
        source: sourceKey,
        status: 'FAILED',
        pagesCompleted,
        itemsSeen,
        itemsCreated,
        itemsUpdated,
      };
    } finally {
      this.running.delete(sourceKey);
    }
  }

  /**
   * Deep-sync one title: metadata detail + seasons + episodes. Used when a
   * title gains a video source (admin flow) or explicitly requested.
   */
  async deepSyncTitle(mediaType: TmdbMediaType, tmdbId: number): Promise<{ titleId: string; seasons: number; episodes: number }> {
    const tmdbType = mediaType === 'movie' ? 'MOVIE' : 'TV';
    const raw = await this.tmdb.getJson<Record<string, unknown>>(`/${mediaType}/${tmdbId}`, {
      append_to_response: 'credits',
    });

    const titleData = {
      title: (raw.title ?? raw.name) as string,
      overview: (raw.overview as string) || null,
      posterPath: (raw.poster_path as string) || null,
      backdropPath: (raw.backdrop_path as string) || null,
      releaseDate: this.normalizeDate((mediaType === 'movie' ? raw.release_date : raw.first_air_date) as string),
      voteAverage: (raw.vote_average as number) ?? 0,
      voteCount: (raw.vote_count as number) ?? 0,
      popularity: (raw.popularity as number) ?? 0,
      runtimeMinutes: mediaType === 'movie' ? ((raw.runtime as number) ?? null) : null,
      status: (raw.status as string) || null,
      originalLanguage: (raw.original_language as string) || null,
      lastSyncedAt: new Date(),
    };

    const title = await prisma.title.upsert({
      where: { tmdbType_tmdbId: { tmdbType, tmdbId } },
      create: { ...titleData, tmdbId, tmdbType, kind: tmdbType },
      update: titleData,
    });

    let episodeCount = 0;
    let seasonCount = 0;

    if (mediaType === 'tv' && Array.isArray(raw.seasons)) {
      for (const rawSeason of raw.seasons as Array<Record<string, unknown>>) {
        const seasonNumber = rawSeason.season_number as number;
        const season = await prisma.season.upsert({
          where: { titleId_seasonNumber: { titleId: title.id, seasonNumber } },
          create: {
            titleId: title.id,
            seasonNumber,
            name: (rawSeason.name as string) ?? `Season ${seasonNumber}`,
            overview: (rawSeason.overview as string) || null,
            posterPath: (rawSeason.poster_path as string) || null,
            airDate: this.normalizeDate(rawSeason.air_date as string),
            episodeCount: (rawSeason.episode_count as number) ?? 0,
            lastSyncedAt: new Date(),
          },
          update: {
            name: (rawSeason.name as string) ?? `Season ${seasonNumber}`,
            overview: (rawSeason.overview as string) || null,
            posterPath: (rawSeason.poster_path as string) || null,
            airDate: this.normalizeDate(rawSeason.air_date as string),
            episodeCount: (rawSeason.episode_count as number) ?? 0,
            lastSyncedAt: new Date(),
          },
        });
        seasonCount += 1;

        const seasonDetail = await this.tmdb.getJson<{ episodes?: Array<Record<string, unknown>> }>(
          `/tv/${tmdbId}/season/${seasonNumber}`,
        );
        for (const ep of seasonDetail.episodes ?? []) {
          const episodeNumber = ep.episode_number as number;
          await prisma.episode.upsert({
            where: { seasonId_episodeNumber: { seasonId: season.id, episodeNumber } },
            create: {
              seasonId: season.id,
              episodeNumber,
              name: (ep.name as string) ?? 'Episode',
              overview: (ep.overview as string) || null,
              stillPath: (ep.still_path as string) || null,
              airDate: this.normalizeDate(ep.air_date as string),
              runtimeMinutes: (ep.runtime as number) ?? null,
              voteAverage: (ep.vote_average as number) ?? 0,
              lastSyncedAt: new Date(),
            },
            update: {
              name: (ep.name as string) ?? 'Episode',
              overview: (ep.overview as string) || null,
              stillPath: (ep.still_path as string) || null,
              airDate: this.normalizeDate(ep.air_date as string),
              runtimeMinutes: (ep.runtime as number) ?? null,
              voteAverage: (ep.vote_average as number) ?? 0,
              lastSyncedAt: new Date(),
            },
          });
          episodeCount += 1;
        }
      }
    }

    await this.connectGenresFromDetail(title.id, mediaType, raw);
    return { titleId: title.id, seasons: seasonCount, episodes: episodeCount };
  }

  private async connectGenresFromDetail(titleId: string, mediaType: 'movie' | 'tv', raw: Record<string, unknown>): Promise<void> {
    const genres = (raw.genres as Array<{ id: number; name: string }> | undefined) ?? [];
    const tmdbType = mediaType === 'movie' ? 'MOVIE' : 'TV';
    for (const genre of genres) {
      await prisma.genre.upsert({
        where: { id_tmdbType: { id: genre.id, tmdbType } },
        create: { id: genre.id, name: genre.name, tmdbType },
        update: { name: genre.name },
      });
      await prisma.titleGenre.upsert({
        where: { titleId_genreId_tmdbType: { titleId, genreId: genre.id, tmdbType } },
        create: { titleId, genreId: genre.id, tmdbType },
        update: {},
      });
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
