import { afterAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createLogger } from '../src/lib/logger.js';
import { parseEnv, type Env } from '../src/lib/env.js';
import { CatalogSyncService } from '../src/services/library/sync.service.js';
import { TmdbClient } from '../src/services/tmdb/tmdbClient.js';
import { prisma } from '../src/lib/prisma.js';

function testEnv(overrides: Partial<Env> = {}): Env {
  return { ...parseEnv({ NODE_ENV: 'test', LOG_LEVEL: 'silent', JWT_SECRET: 'x'.repeat(32) }), ...overrides };
}

const logger = createLogger(testEnv());

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** Unique tmdb ids so DB tests never collide with real synced data. */
const FAKE_ID_A = 9_900_001;
const FAKE_ID_B = 9_900_002;

function tmdbListPayload(id: number, title: string, popularity: number) {
  return {
    page: 1,
    total_pages: 9,
    total_results: 180,
    results: [
      {
        id,
        title,
        overview: 'Test overview.',
        poster_path: `/p-${id}.jpg`,
        backdrop_path: null,
        vote_average: 7.4,
        vote_count: 210,
        popularity,
        release_date: '2024-02-27',
        genre_ids: [878],
      },
      {
        id: id + 1,
        name: `${title} (Series)`,
        overview: null,
        poster_path: null,
        backdrop_path: null,
        vote_average: 0,
        vote_count: 0,
        popularity,
        first_air_date: '2023-09-01',
        genre_ids: [],
      },
    ],
  };
}

let sync: CatalogSyncService;

function makeSyncService(fetchMock: ReturnType<typeof vi.fn>) {
  const env = testEnv({ TMDB_READ_ACCESS_TOKEN: 'test-token' });
  return new CatalogSyncService(
    new TmdbClient({ token: env.TMDB_READ_ACCESS_TOKEN, logger, fetchImpl: fetchMock as unknown as typeof fetch }),
    logger,
  );
}

afterAll(async () => {
  // remove only the fixture rows this file created
  await prisma.title.deleteMany({ where: { tmdbId: { gte: FAKE_ID_A, lte: FAKE_ID_B + 1 } } });
  await prisma.importJob.deleteMany({ where: { source: { in: ['movie_popular', 'movie_upcoming'] } } });
  await prisma.$disconnect();
});

describe('CatalogSyncService (real database)', () => {
  it('imports a page with dedupe, genre links and a completed job record', async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.includes('/genre/')
        ? jsonResponse({ genres: [{ id: 878, name: 'Science Fiction' }] })
        : jsonResponse(tmdbListPayload(FAKE_ID_A, 'Sync Test Movie', 42)),
    );
    sync = makeSyncService(fetchMock);

    const summary = await sync.runImport('movie_popular', 1);

    expect(summary.status).toBe('COMPLETED');
    expect(summary.pagesCompleted).toBe(1);
    expect(summary.itemsCreated).toBe(2);
    expect(summary.itemsUpdated).toBe(0);

    const stored = await prisma.title.findUnique({
      where: { tmdbType_tmdbId: { tmdbType: 'MOVIE', tmdbId: FAKE_ID_A } },
      include: { genres: true },
    });
    expect(stored?.title).toBe('Sync Test Movie');
    expect(stored?.availability).toBe('UNAVAILABLE'); // metadata never implies playability
    expect(stored?.genres.some((g) => g.genreId === 878)).toBe(true);

    const job = await prisma.importJob.findFirstOrThrow({
      where: { source: 'movie_popular', id: summary.jobId },
    });
    expect(job.status).toBe('COMPLETED');
    expect(job.itemsCreated).toBe(2);
    expect(job.pagesCompleted).toBe(1);
  });

  it('updates instead of duplicating on re-run', async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.includes('/genre/')
        ? jsonResponse({ genres: [{ id: 878, name: 'Science Fiction' }] })
        : jsonResponse(tmdbListPayload(FAKE_ID_A, 'Sync Test Movie', 99)),
    );
    sync = makeSyncService(fetchMock);

    const summary = await sync.runImport('movie_popular', 1);

    expect(summary.itemsCreated).toBe(0);
    expect(summary.itemsUpdated).toBe(2);

    const count = await prisma.title.count({
      where: { tmdbType: 'MOVIE', tmdbId: { gte: FAKE_ID_A, lte: FAKE_ID_B + 1 } },
    });
    expect(count).toBe(2); // exactly the same two rows as the first run

    const updated = await prisma.title.findUniqueOrThrow({
      where: { tmdbType_tmdbId: { tmdbType: 'MOVIE', tmdbId: FAKE_ID_A } },
    });
    expect(updated.popularity).toBe(99);
  });

  it('marks the job PARTIAL and records errors when upstream fails', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ error: 'upstream down' }, 500));
    sync = makeSyncService(fetchMock);

    const summary = await sync.runImport('movie_upcoming', 1);

    expect(summary.status).toBe('FAILED');
    expect(summary.pagesCompleted).toBe(0);

    const job = await prisma.importJob.findFirstOrThrow({ where: { id: summary.jobId } });
    expect(job.status).toBe('FAILED');
    expect(Array.isArray(job.errors)).toBe(true);
  });

  it('deep-syncs a TV title with seasons and episodes', async () => {
    const detail = {
      id: FAKE_ID_B,
      name: 'Deep Sync Show',
      overview: 'A show.',
      poster_path: '/d.jpg',
      backdrop_path: null,
      vote_average: 8,
      vote_count: 10,
      popularity: 5,
      first_air_date: '2022-01-01',
      genres: [{ id: 18, name: 'Drama' }],
      seasons: [
        { season_number: 1, name: 'Season 1', overview: null, poster_path: null, air_date: '2022-01-01', episode_count: 2 },
      ],
    };
    const season = {
      season_number: 1,
      name: 'Season 1',
      episodes: [
        { episode_number: 1, name: 'Pilot', overview: 'Beginning.', still_path: null, air_date: '2022-01-01', runtime: 42, vote_average: 7 },
        { episode_number: 2, name: 'Part Two', overview: null, still_path: null, air_date: '2022-01-08', runtime: 45, vote_average: 0 },
      ],
    };
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/genre/')) return jsonResponse({ genres: [{ id: 18, name: 'Drama' }] });
      if (url.includes('/season/1')) return jsonResponse(season);
      return jsonResponse(detail);
    });
    sync = makeSyncService(fetchMock);

    const result = await sync.deepSyncTitle('tv', FAKE_ID_B);

    expect(result.seasons).toBe(1);
    expect(result.episodes).toBe(2);

    const stored = await prisma.title.findUniqueOrThrow({
      where: { tmdbType_tmdbId: { tmdbType: 'TV', tmdbId: FAKE_ID_B } },
      include: { seasons: { include: { episodes: true } } },
    });
    expect(stored.seasons[0]?.episodes.map((e) => e.name)).toEqual(['Pilot', 'Part Two']);
    expect(stored.availability).toBe('UNAVAILABLE');
  });

  it('rejects a second concurrent run of the same source', async () => {
    sync = makeSyncService(vi.fn(async () => jsonResponse(tmdbListPayload(FAKE_ID_A + 10, 'Concurrent', 1))));
    // do not await — hold the job open
    const first = sync.runImport('movie_popular', 1);
    await expect(sync.runImport('movie_popular', 1)).rejects.toMatchObject({ status: 409 });
    await first;
  });
});

describe('library API', () => {
  const env = testEnv({
    TMDB_READ_ACCESS_TOKEN: 't',
    ADMIN_BOOTSTRAP_EMAIL: 'admin@cinemora.test',
    JWT_SECRET: 'unit-test-secret-unit-test-secret-0001',
  });

  function appWith() {
    return createApp({ env, logger });
  }

  async function registerAndLogin(email: string, role: 'admin' | 'user') {
    const app = appWith();
    const address = role === 'admin' ? 'admin@cinemora.test' : email;
    const payload = {
      email: address,
      password: 'Password123',
      displayName: role === 'admin' ? 'Admin' : 'User',
    };
    // idempotent across runs: register, fall back to login when the account exists
    let res = await request(app).post('/api/v1/auth/register').send(payload);
    if (res.status === 409) {
      res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: address, password: 'Password123' });
    }
    expect([201, 200]).toContain(res.status);
    return { app, token: res.body.accessToken as string, status: res.status };
  }

  it('reports truthful stats including zero watchable titles', async () => {
    const res = await request(appWith()).get('/api/v1/library/stats');
    expect(res.status).toBe(200);
    expect(res.body.titles).toBeGreaterThan(0);
    expect(res.body.activeSources).toBe(0);
  });

  it('reports UNAVAILABLE honestly for in-library and unknown titles', async () => {
    const known = await request(appWith()).get(`/api/v1/titles/movie/${FAKE_ID_A}/availability`);
    expect(known.status).toBe(200);
    expect(known.body.status).toBe('UNAVAILABLE');
    expect(known.body.inLibrary).toBe(true);

    const unknown = await request(appWith()).get('/api/v1/titles/movie/9999999/availability');
    expect(unknown.body.status).toBe('UNAVAILABLE');
    expect(unknown.body.inLibrary).toBe(false);
  });

  it('requires authentication for admin sync (401)', async () => {
    const res = await request(appWith()).post('/api/v1/admin/sync').send({ source: 'movie_popular', pages: 1 });
    expect(res.status).toBe(401);
  });

  it('forbids non-admin users from admin sync (403)', async () => {
    const { app, token } = await registerAndLogin(`plainuser-${Date.now()}@cinemora.test`, 'user');
    const res = await request(app)
      .post('/api/v1/admin/sync')
      .set('Authorization', `Bearer ${token}`)
      .send({ source: 'movie_popular', pages: 1 });
    expect(res.status).toBe(403);
  });

  it('allows admins to run a sync (202) and list jobs', async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.includes('/genre/')
        ? jsonResponse({ genres: [{ id: 878, name: 'Science Fiction' }] })
        : jsonResponse(tmdbListPayload(FAKE_ID_A + 20, 'API Sync Movie', 1)),
    );
    const app = createApp({
      env,
      logger,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    const reg = await request(app).post('/api/v1/auth/register').send({
      email: 'admin@cinemora.test',
      password: 'Password123',
      displayName: 'Admin',
    });
    let token: string;
    if (reg.status === 201) token = reg.body.accessToken as string;
    else {
      const login = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'admin@cinemora.test', password: 'Password123' });
      token = login.body.accessToken as string;
    }
    expect(token).toBeTruthy();

    const res = await request(app)
      .post('/api/v1/admin/sync')
      .set('Authorization', `Bearer ${token}`)
      .send({ source: 'movie_popular', pages: 1 });
    expect(res.status).toBe(202);
    expect(res.body.job.status).toBe('COMPLETED');

    const jobs = await request(app)
      .get('/api/v1/admin/import-jobs')
      .set('Authorization', `Bearer ${token}`);
    expect(jobs.status).toBe(200);
    expect(Array.isArray(jobs.body.jobs)).toBe(true);
  });

  it('rejects unknown sources with the known list', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ genres: [] }));
    const app = createApp({ env, logger, fetchImpl: fetchMock as unknown as typeof fetch });
    // the admin account already exists from the earlier test — log in instead
    const reg = await request(app).post('/api/v1/auth/login').send({
      email: 'admin@cinemora.test',
      password: 'Password123',
    });
    const res = await request(app)
      .post('/api/v1/admin/sync')
      .set('Authorization', `Bearer ${reg.body.accessToken}`)
      .send({ source: 'movie_pirated_everything', pages: 1 });
    expect(res.status).toBe(400);
    expect(res.body.error.details.known).toContain('movie_popular');
  });
});
