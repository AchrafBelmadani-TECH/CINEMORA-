import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createLogger } from '../src/lib/logger.js';
import { parseEnv, type Env } from '../src/lib/env.js';

function testEnv(overrides: Partial<Env> = {}): Env {
  return { ...parseEnv({ NODE_ENV: 'test', LOG_LEVEL: 'silent', JWT_SECRET: 'x'.repeat(32) }), ...overrides };
}

const logger = createLogger(testEnv());

/** Minimal TMDB-shaped payload for list endpoints. */
function tmdbListResponse() {
  return {
    page: 1,
    total_pages: 42,
    total_results: 840,
    results: [
      {
        id: 693134,
        title: 'Dune: Part Two',
        overview: 'Paul Atreides unites with the Fremen.',
        poster_path: '/poster.jpg',
        backdrop_path: '/backdrop.jpg',
        vote_average: 8.217,
        release_date: '2024-02-27',
        genre_ids: [878, 12],
      },
      {
        id: 1399,
        name: 'Game of Thrones',
        media_type: 'tv',
        overview: null,
        poster_path: null,
        backdrop_path: null,
        vote_average: 8.44,
        first_air_date: '2011-04-17',
        genre_ids: [18],
      },
    ],
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function makeApp(fetchMock: ReturnType<typeof vi.fn>, token?: string) {
  return createApp({
    env: testEnv({ TMDB_READ_ACCESS_TOKEN: token }),
    logger,
    fetchImpl: fetchMock as unknown as typeof fetch,
  });
}

describe('catalog routes — happy path (Phase 2)', () => {
  it('GET /movies/trending returns normalized CINEMORA DTOs', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(tmdbListResponse()));
    const res = await request(makeApp(fetchMock, 'test-token')).get('/api/v1/movies/trending?window=week');

    expect(res.status).toBe(200);
    expect(res.body.page).toBe(1);
    expect(res.body.totalPages).toBe(42);
    expect(res.body.items[0]).toEqual({
      mediaType: 'movie',
      tmdbId: 693134,
      title: 'Dune: Part Two',
      overview: 'Paul Atreides unites with the Fremen.',
      posterPath: '/poster.jpg',
      backdropPath: '/backdrop.jpg',
      voteAverage: 8.2,
      releaseDate: '2024-02-27',
      genreIds: [878, 12],
    });
    // tv-shaped raw item (name/first_air_date) normalizes too
    expect(res.body.items[1].title).toBe('Game of Thrones');
    expect(res.body.items[1].releaseDate).toBe('2011-04-17');
    expect(res.body.items[1].posterPath).toBeNull();

    // upstream called with bearer auth and the requested window
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('/3/trending/movie/week');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-token');
  });

  it('GET /genres returns the normalized genre list', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ genres: [{ id: 28, name: 'Action' }] }));
    const res = await request(makeApp(fetchMock, 't')).get('/api/v1/genres?mediaType=movie');

    expect(res.status).toBe(200);
    expect(res.body.genres).toEqual([{ id: 28, name: 'Action' }]);
    expect(fetchMock.mock.calls[0]?.[0]).toContain('/genre/movie/list');
  });

  it('GET /discover forwards genre filters within the whitelist', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(tmdbListResponse()));
    const res = await request(makeApp(fetchMock, 't')).get('/api/v1/discover?mediaType=movie&genreId=28&page=2');

    expect(res.status).toBe(200);
    const url = fetchMock.mock.calls[0]?.[0] as string;
    expect(url).toContain('/discover/movie');
    expect(url).toContain('with_genres=28');
    expect(url).toContain('page=2');
  });

  it('serves a second identical request from cache (one upstream hit)', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(tmdbListResponse()));
    const app = makeApp(fetchMock, 't');

    await request(app).get('/api/v1/movies/popular');
    const second = await request(app).get('/api/v1/movies/popular');

    expect(second.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('catalog routes — failure handling', () => {
  it('returns 502 with a clear message when TMDB is not configured', async () => {
    const fetchMock = vi.fn();
    const res = await request(makeApp(fetchMock, undefined)).get('/api/v1/movies/trending');

    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('UPSTREAM_ERROR');
    expect(res.body.error.message).toMatch(/not configured/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps upstream 404 to NOT_FOUND', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({}, 404));
    const res = await request(makeApp(fetchMock, 't')).get('/api/v1/movies/trending');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('maps upstream 401 (bad credentials) to UPSTREAM_ERROR', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({}, 401));
    const res = await request(makeApp(fetchMock, 'bad-token')).get('/api/v1/movies/popular');

    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('UPSTREAM_ERROR');
    expect(res.body.error.message).toMatch(/credentials/i);
  });

  it('retries once on upstream 500, then returns UPSTREAM_ERROR', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({}, 500));
    await request(makeApp(fetchMock, 't')).get('/api/v1/movies/popular');

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('recovers when the first attempt fails but the retry succeeds', async () => {
    let call = 0;
    const fetchMock = vi.fn(async () => {
      call += 1;
      return call === 1 ? jsonResponse({}, 503) : jsonResponse(tmdbListResponse());
    });
    const res = await request(makeApp(fetchMock, 't')).get('/api/v1/movies/popular');

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
  });

  it('maps network failure to UPSTREAM_ERROR', async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });
    const res = await request(makeApp(fetchMock, 't')).get('/api/v1/movies/trending');

    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('UPSTREAM_ERROR');
  });
});

describe('catalog routes — validation', () => {
  it('rejects invalid window values with 400', async () => {
    const fetchMock = vi.fn();
    const res = await request(makeApp(fetchMock, 't')).get('/api/v1/movies/trending?window=year');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details[0].path[0]).toBe('window');
  });

  it('rejects out-of-range pages', async () => {
    const res = await request(makeApp(vi.fn(), 't')).get('/api/v1/movies/popular?page=9999');
    expect(res.status).toBe(400);
  });

  it('rejects non-numeric genre ids', async () => {
    const res = await request(makeApp(vi.fn(), 't')).get('/api/v1/discover?genreId=abc');
    expect(res.status).toBe(400);
  });
});
