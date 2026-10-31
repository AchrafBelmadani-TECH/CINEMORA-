import { describe, afterEach, expect, it, vi } from 'vitest';
import { apiClient, ApiError } from './apiClient';

describe('apiClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns parsed JSON on 2xx responses', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })));

    await expect(apiClient.get('/health')).resolves.toEqual({ ok: true });
  });

  it('builds the request URL with query params', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await apiClient.get('/movies/popular', { page: 2 });

    const called = fetchMock.mock.calls[0] as unknown as [string] | undefined;
    const url = new URL(called![0]);
    expect(url.pathname).toBe('/api/v1/movies/popular');
    expect(url.searchParams.get('page')).toBe('2');
  });

  it('maps the server error envelope onto ApiError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ error: { code: 'UPSTREAM_ERROR', message: 'TMDB is unreachable' } }),
            { status: 502 },
          ),
      ),
    );

    const err = await apiClient.get('/movies/popular').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(502);
    expect((err as ApiError).code).toBe('UPSTREAM_ERROR');
    expect((err as ApiError).isUpstream).toBe(true);
  });

  it('survives non-JSON error bodies with a generic envelope', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('gateway timeout', { status: 504 })));

    const err = await apiClient.get('/movies/popular').catch((e: unknown) => e);
    expect((err as ApiError).code).toBe('INTERNAL_ERROR');
    expect((err as ApiError).status).toBe(504);
  });

  it('reports network failures as NETWORK_ERROR', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('fetch failed');
    }));

    const err = await apiClient.get('/movies/popular').catch((e: unknown) => e);
    expect((err as ApiError).code).toBe('NETWORK_ERROR');
    expect((err as ApiError).status).toBe(0);
  });
});
