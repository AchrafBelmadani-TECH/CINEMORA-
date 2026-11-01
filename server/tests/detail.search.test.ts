import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createLogger } from '../src/lib/logger.js';
import { parseEnv, type Env } from '../src/lib/env.js';

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

function makeApp(fetchMock: ReturnType<typeof vi.fn>) {
  return createApp({
    env: testEnv({ TMDB_READ_ACCESS_TOKEN: 'test-token' }),
    logger,
    fetchImpl: fetchMock as unknown as typeof fetch,
  });
}

/** Raw TMDB movie-detail payload with appended responses (abridged but shape-true). */
function movieDetailRaw() {
  return {
    id: 693134,
    title: 'Dune: Part Two',
    tagline: 'Long live the fighters.',
    overview: 'Paul Atreides unites with the Fremen.',
    poster_path: '/poster.jpg',
    backdrop_path: '/backdrop.jpg',
    vote_average: 8.217,
    vote_count: 4600,
    release_date: '2024-02-27',
    status: 'Released',
    original_language: 'en',
    runtime: 166,
    genres: [{ id: 878, name: 'Science Fiction' }],
    credits: {
      cast: [
        { id: 1136406, name: 'Timothée Chalamet', character: 'Paul Atreides', profile_path: '/timo.jpg', order: 0 },
        { id: 90570, name: 'Austin Butler', character: 'Feyd-Rautha', profile_path: null, order: 3 },
      ],
      crew: [
        { id: 525, name: 'Denis Villeneuve', job: 'Director', department: 'Directing' },
        { id: 999, name: 'Patrice Vermette', job: 'Production Design', department: 'Art' },
      ],
    },
    videos: {
      results: [
        { key: 'Way9Dexny3w', site: 'YouTube', type: 'Trailer', name: 'Official Trailer' },
        { key: 'clip1', site: 'YouTube', type: 'Clip', name: 'Clip — should be filtered out' },
      ],
    },
    recommendations: {
      page: 1,
      total_pages: 5,
      total_results: 90,
      results: [{ id: 447365, title: 'Guardians of the Galaxy Vol. 3', media_type: 'movie', poster_path: '/g.jpg', backdrop_path: null, vote_average: 7.9, release_date: '2023-05-03', genre_ids: [878] }],
    },
    similar: { page: 1, total_pages: 1, total_results: 0, results: [] },
  };
}

function tvDetailRaw() {
  return {
    id: 1399,
    name: 'Game of Thrones',
    tagline: 'Winter is coming.',
    overview: 'Seven noble families fight for control of Westeros.',
    poster_path: '/got.jpg',
    backdrop_path: '/got-b.jpg',
    vote_average: 8.44,
    vote_count: 20000,
    first_air_date: '2011-04-17',
    status: 'Ended',
    original_language: 'en',
    episode_run_time: [57],
    number_of_seasons: 8,
    number_of_episodes: 73,
    created_by: [{ id: 22970, name: 'David Benioff' }],
    genres: [{ id: 18, name: 'Drama' }],
    seasons: [
      { season_number: 1, name: 'Season 1', overview: 'Ned Stark arrives.', poster_path: '/s1.jpg', air_date: '2011-04-17', episode_count: 10 },
      { season_number: 2, name: 'Season 2', overview: null, poster_path: null, air_date: '2012-04-01', episode_count: 10 },
    ],
    credits: { cast: [{ id: 22970, name: 'Emilia Clarke', character: 'Daenerys Targaryen', profile_path: '/emilia.jpg', order: 0 }], crew: [] },
    videos: { results: [] },
    recommendations: { page: 1, total_pages: 1, total_results: 0, results: [] },
    similar: {
      page: 1,
      total_pages: 2,
      total_results: 20,
      results: [{ id: 71912, name: 'The Witcher', media_type: 'tv', poster_path: '/w.jpg', backdrop_path: null, vote_average: 7.6, first_air_date: '2019-12-20', genre_ids: [10765] }],
    },
  };
}

function seasonRaw() {
  return {
    season_number: 1,
    name: 'Season 1',
    overview: 'Ned Stark arrives.',
    poster_path: '/s1.jpg',
    air_date: '2011-04-17',
    episodes: [
      {
        episode_number: 1,
        name: 'Winter Is Coming',
        overview: 'Eddard Stark is torn between his family and an old friend.',
        still_path: '/e1.jpg',
        air_date: '2011-04-17',
        runtime: 62,
        vote_average: 7.8,
      },
      { episode_number: 2, name: 'The Kingsroad', overview: null, still_path: null, air_date: '2011-04-24', runtime: 56, vote_average: 0 },
    ],
  };
}

function personRaw() {
  return {
    id: 525,
    name: 'Denis Villeneuve',
    biography: 'Canadian film director.',
    birthday: '1967-10-03',
    deathday: null,
    place_of_birth: 'Gentilly, Québec, Canada',
    known_for_department: 'Directing',
    profile_path: '/denis.jpg',
    combined_credits: {
      cast: [],
      crew: [
        { id: 693134, title: 'Dune: Part Two', media_type: 'movie', popularity: 500, poster_path: '/p.jpg', backdrop_path: null, vote_average: 8.2, release_date: '2024-02-27', genre_ids: [878], overview: 'x', job: 'Director' },
        { id: 693134, title: 'Dune: Part Two', media_type: 'movie', popularity: 500, poster_path: '/p.jpg', backdrop_path: null, vote_average: 8.2, release_date: '2024-02-27', genre_ids: [878], overview: 'x', job: 'Screenplay' },
        { id: 447365, title: 'Guardians Vol. 3', media_type: 'movie', popularity: 100, poster_path: null, backdrop_path: null, vote_average: 7.9, release_date: '2023-05-03', genre_ids: [], overview: null },
      ],
    },
  };
}

function searchRaw() {
  return {
    page: 1,
    total_pages: 3,
    total_results: 42,
    results: [
      { id: 693134, media_type: 'movie', title: 'Dune: Part Two', overview: 'x', poster_path: '/d.jpg', backdrop_path: '/db.jpg', vote_average: 8.2, release_date: '2024-02-27', genre_ids: [878] },
      { id: 1399, media_type: 'tv', name: 'Game of Thrones', overview: 'x', poster_path: '/g.jpg', backdrop_path: null, vote_average: 8.4, first_air_date: '2011-04-17', genre_ids: [18] },
      { id: 525, media_type: 'person', name: 'Denis Villeneuve', profile_path: '/v.jpg', known_for_department: 'Directing' },
      { id: 1, media_type: 'person', name: 'No Profile Person', profile_path: null, known_for_department: null },
    ],
  };
}

describe('GET /movies/:id — detail (Phase 3)', () => {
  it('normalizes movie detail with credits, videos and recommendations', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(movieDetailRaw()));
    const res = await request(makeApp(fetchMock)).get('/api/v1/movies/693134');

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Dune: Part Two');
    expect(res.body.tagline).toBe('Long live the fighters.');
    expect(res.body.runtimeMinutes).toBe(166);
    expect(res.body.mediaType).toBe('movie');
    expect(res.body.genres).toEqual([{ id: 878, name: 'Science Fiction' }]);
    expect(res.body.cast).toHaveLength(2);
    expect(res.body.cast[0]).toMatchObject({ personId: 1136406, name: 'Timothée Chalamet', character: 'Paul Atreides' });
    expect(res.body.directors).toEqual([{ personId: 525, name: 'Denis Villeneuve', job: 'Director', department: 'Directing' }]);
    // clips are filtered out — only YouTube trailers/teasers remain
    expect(res.body.videos).toEqual([{ key: 'Way9Dexny3w', site: 'YouTube', type: 'Trailer', name: 'Official Trailer' }]);
    // recommendations take precedence over similar
    expect(res.body.recommendations.items[0].title).toBe('Guardians of the Galaxy Vol. 3');
    // single upstream call via append_to_response
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((fetchMock.mock.calls[0]?.[0] as string)).toContain('append_to_response=credits%2Cvideos%2Crecommendations%2Csimilar');
  });

  it('normalizes TV detail with seasons, creators and fallback to similar', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(tvDetailRaw()));
    const res = await request(makeApp(fetchMock)).get('/api/v1/tv/1399');

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Game of Thrones');
    expect(res.body.numberOfSeasons).toBe(8);
    expect(res.body.seasons[0]).toMatchObject({ seasonNumber: 1, name: 'Season 1', episodeCount: 10 });
    expect(res.body.directors[0]).toMatchObject({ personId: 22970, name: 'David Benioff', job: 'Creator' });
    // empty recommendations fall back to similar
    expect(res.body.recommendations.items[0].title).toBe('The Witcher');
    expect(res.body.recommendations.items[0].mediaType).toBe('tv');
    expect(res.body.videos).toEqual([]);
  });

  it('maps a bad title id to 404', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({}, 404));
    const res = await request(makeApp(fetchMock)).get('/api/v1/movies/999999999');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('rejects non-numeric ids', async () => {
    const res = await request(makeApp(vi.fn())).get('/api/v1/movies/abc');
    expect(res.status).toBe(400);
  });
});

describe('GET /tv/:id/season/:n — season detail (Phase 3)', () => {
  it('normalizes episodes with stills, air dates and runtimes', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(seasonRaw()));
    const res = await request(makeApp(fetchMock)).get('/api/v1/tv/1399/season/1');

    expect(res.status).toBe(200);
    expect(res.body.seasonNumber).toBe(1);
    expect(res.body.episodes[0]).toMatchObject({
      episodeNumber: 1,
      name: 'Winter Is Coming',
      airDate: '2011-04-17',
      runtimeMinutes: 62,
      voteAverage: 7.8,
    });
    expect(res.body.episodes[1].runtimeMinutes).toBe(56);
  });

  it('caches season requests (one upstream call for two identical requests)', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(seasonRaw()));
    const app = makeApp(fetchMock);
    await request(app).get('/api/v1/tv/1399/season/1');
    await request(app).get('/api/v1/tv/1399/season/1');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('GET /people/:id — person detail (Phase 3)', () => {
  it('normalizes person with known-for and deduped filmography', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(personRaw()));
    const res = await request(makeApp(fetchMock)).get('/api/v1/people/525');

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Denis Villeneuve');
    expect(res.body.knownForDepartment).toBe('Directing');
    expect(res.body.knownFor).toHaveLength(2);
    // duplicate id across crew jobs collapses in filmography
    expect(res.body.filmography).toHaveLength(2);
    expect(res.body.filmography[0].releaseDate).toBe('2024-02-27');
  });
});

describe('GET /search/multi — search (Phase 3)', () => {
  it('returns typed movie, tv and person results', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(searchRaw()));
    const res = await request(makeApp(fetchMock)).get('/api/v1/search/multi?query=dune');

    expect(res.status).toBe(200);
    expect(res.body.totalResults).toBe(42);
    expect(res.body.items[0]).toMatchObject({ mediaType: 'movie', title: 'Dune: Part Two' });
    expect(res.body.items[1]).toMatchObject({ mediaType: 'tv', title: 'Game of Thrones' });
    expect(res.body.items[2]).toMatchObject({ mediaType: 'person', name: 'Denis Villeneuve' });
    const url = fetchMock.mock.calls[0]?.[0] as string;
    expect(url).toContain('/3/search/multi');
    expect(url).toContain('query=dune');
    expect(url).toContain('include_adult=false');
  });

  it('rejects empty and over-long queries', async () => {
    expect((await request(makeApp(vi.fn())).get('/api/v1/search/multi?query=')).status).toBe(400);
    expect((await request(makeApp(vi.fn())).get(`/api/v1/search/multi?query=${'x'.repeat(201)}`)).status).toBe(400);
  });

  it('caches identical searches', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(searchRaw()));
    const app = makeApp(fetchMock);
    await request(app).get('/api/v1/search/multi?query=dune');
    await request(app).get('/api/v1/search/multi?query=dune');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('GET /discover — advanced filters (Phase 3)', () => {
  it('maps genres csv, years, rating and language to whitelisted upstream params', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ page: 1, total_pages: 1, total_results: 0, results: [] }));
    const res = await request(makeApp(fetchMock)).get(
      '/api/v1/discover?mediaType=movie&genres=878,12&yearFrom=2020&yearTo=2024&voteAverageGte=7&language=en&sortBy=release_date.desc&page=2',
    );

    expect(res.status).toBe(200);
    const url = fetchMock.mock.calls[0]?.[0] as string;
    expect(url).toContain('/3/discover/movie');
    expect(url).toContain('with_genres=878%2C12');
    expect(url).toContain('primary_release_date.gte=2020-01-01');
    expect(url).toContain('primary_release_date.lte=2024-12-31');
    expect(url).toContain('vote_average.gte=7');
    expect(url).toContain('vote_count.gte=50');
    expect(url).toContain('with_original_language=en');
    expect(url).toContain('sort_by=primary_release_date.desc');
    expect(url).toContain('page=2');
  });

  it('maps TV date filters to first_air_date and tv sort', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ page: 1, total_pages: 1, total_results: 0, results: [] }));
    await request(makeApp(fetchMock)).get('/api/v1/discover?mediaType=tv&yearFrom=2019&sortBy=release_date.desc');

    const url = fetchMock.mock.calls[0]?.[0] as string;
    expect(url).toContain('first_air_date.gte=2019-01-01');
    expect(url).toContain('sort_by=first_air_date.desc');
  });

  it('rejects invalid sort, year range and language values', async () => {
    const app = () => makeApp(vi.fn());
    expect((await request(app()).get('/api/v1/discover?sortBy=revenue.desc')).status).toBe(400);
    expect((await request(app()).get('/api/v1/discover?yearFrom=2024&yearTo=2020')).status).toBe(400);
    expect((await request(app()).get('/api/v1/discover?language=eng')).status).toBe(400);
    expect((await request(app()).get('/api/v1/discover?genres=878,abc')).status).toBe(400);
  });
});
