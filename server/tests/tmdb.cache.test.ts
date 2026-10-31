import { describe, expect, it, vi } from 'vitest';
import { TmdbCache } from '../src/services/tmdb/cache.js';
import { createLogger } from '../src/lib/logger.js';

const logger = createLogger({ NODE_ENV: 'test', LOG_LEVEL: 'silent' } as never);

describe('TmdbCache', () => {
  it('fetches once and serves subsequent calls from cache within the TTL', async () => {
    const t = 0;
    const cache = new TmdbCache({ logger, now: () => t });
    const fetcher = vi.fn(async () => ({ value: 42 }));

    const first = await cache.get('k', 1000, fetcher);
    const second = await cache.get('k', 1000, fetcher);

    expect(first).toEqual({ value: 42 });
    expect(second).toEqual({ value: 42 });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(cache.stats()).toEqual({ hits: 1, misses: 1, entries: 1 });
  });

  it('re-fetches after the TTL has passed', async () => {
    let t = 0;
    const cache = new TmdbCache({ logger, now: () => t });
    const fetcher = vi.fn(async () => 'v1');

    await cache.get('k', 1000, fetcher);
    t = 1001;
    const fresh = await cache.get('k', 1000, fetcher);

    expect(fresh).toBe('v1');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('coalesces concurrent calls for the same key (single-flight)', async () => {
    const cache = new TmdbCache({ logger });
    let resolveUpstream!: (v: string) => void;
    const fetcher = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveUpstream = resolve;
        }),
    );

    const a = cache.get('k', 1000, fetcher);
    const b = cache.get('k', 1000, fetcher);
    resolveUpstream('shared');
    const [ra, rb] = await Promise.all([a, b]);

    expect(ra).toBe('shared');
    expect(rb).toBe('shared');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('does not cache failures — a rejected fetch is retried on the next call', async () => {
    const cache = new TmdbCache({ logger });
    let attempts = 0;
    const fetcher = vi.fn(async () => {
      attempts += 1;
      if (attempts === 1) throw new Error('upstream boom');
      return 'recovered';
    });

    await expect(cache.get('k', 1000, fetcher)).rejects.toThrow('upstream boom');
    await expect(cache.get('k', 1000, fetcher)).resolves.toBe('recovered');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('tracks distinct keys independently', async () => {
    const cache = new TmdbCache({ logger });
    await cache.get('a', 1000, async () => 1);
    await cache.get('b', 1000, async () => 2);

    expect(cache.stats()).toEqual({ hits: 0, misses: 2, entries: 2 });
  });
});
