import type { Logger } from '../../lib/logger.js';

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

interface InflightEntry {
  promise: Promise<unknown>;
}

export interface TmdbCacheOptions {
  logger: Logger;
  now?: () => number;
}

/**
 * In-memory TTL cache with single-flight deduplication: concurrent requests
 * for the same key share one upstream fetch, and stamps are removed when the
 * promise settles so failures are retried on the next call.
 */
export class TmdbCache {
  private store = new Map<string, CacheEntry>();
  private inflight = new Map<string, InflightEntry>();
  private hits = 0;
  private misses = 0;

  constructor(private readonly options: TmdbCacheOptions) {}

  async get<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> {
    const now = (this.options.now ?? Date.now)();

    const cached = this.store.get(key);
    if (cached && cached.expiresAt > now) {
      this.hits += 1;
      return cached.value as T;
    }
    if (cached) {
      this.store.delete(key);
    }

    const pending = this.inflight.get(key);
    if (pending) {
      return pending.promise as Promise<T>;
    }

    this.misses += 1;
    const promise = fetcher()
      .then((value) => {
        this.store.set(key, { value, expiresAt: (this.options.now ?? Date.now)() + ttlMs });
        return value;
      })
      .finally(() => {
        this.inflight.delete(key);
      });

    this.inflight.set(key, { promise });

    if (this.misses % 25 === 0) {
      this.options.logger.debug(
        { hits: this.hits, misses: this.misses, entries: this.store.size },
        'tmdb cache stats',
      );
    }

    return promise;
  }

  stats(): { hits: number; misses: number; entries: number } {
    return { hits: this.hits, misses: this.misses, entries: this.store.size };
  }
}
