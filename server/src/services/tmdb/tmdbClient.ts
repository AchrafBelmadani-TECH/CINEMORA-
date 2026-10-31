import { AppError } from '../../lib/errors.js';
import type { Logger } from '../../lib/logger.js';

const TMDB_API_ROOT = 'https://api.themoviedb.org';
const TIMEOUT_MS = 8_000;
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const RETRY_DELAY_MS = 300;

export interface TmdbClientOptions {
  /** v4 read access token. Calls fail with UPSTREAM_ERROR when absent. */
  token?: string;
  logger: Logger;
  fetchImpl?: typeof fetch;
}

interface TmdbErrorBody {
  status_message?: string;
}

/**
 * Low-level TMDB v3 client: bearer auth, 8s timeout, one retry on network
 * errors and retryable upstream statuses, and error mapping to AppError.
 */
export class TmdbClient {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: TmdbClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  get configured(): boolean {
    return Boolean(this.options.token);
  }

  async getJson<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
    const token = this.options.token;
    if (!token) {
      throw AppError.upstream('TMDB is not configured — set TMDB_READ_ACCESS_TOKEN in server/.env');
    }

    const url = this.buildUrl(path, params);

    let lastError: unknown;
    for (let attempt = 0; attempt <= 1; attempt++) {
      try {
        return await this.attempt<T>(url, token);
      } catch (err) {
        lastError = err;
        const retryable =
          err instanceof Error &&
          (err.name === 'AbortError' ||
            err.message === 'fetch failed' ||
            (AppError.isAppError(err) && RETRYABLE_STATUS.has(err.status)));
        if (!retryable || attempt === 1) break;
        await delay(RETRY_DELAY_MS);
      }
    }
    throw lastError;
  }

  private async attempt<T>(url: string, token: string): Promise<T> {
    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        headers: { Authorization: `Bearer ${token}`, accept: 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      // Network failure or timeout — both map to upstream.
      throw AppError.upstream('TMDB is unreachable');
    }

    if (response.ok) {
      return (await response.json()) as T;
    }

    const body = (await response.json().catch(() => ({}))) as TmdbErrorBody;
    const { status } = response;

    if (status === 404) {
      throw AppError.notFound('Title not found');
    }
    if (status === 401) {
      this.options.logger.error({ status }, 'tmdb rejected our credentials');
      throw AppError.upstream('TMDB credentials rejected');
    }
    if (status === 429) {
      throw AppError.rateLimited('Upstream rate limit reached — please retry shortly');
    }
    if (RETRYABLE_STATUS.has(status)) {
      throw AppError.upstream('TMDB is temporarily unavailable');
    }
    this.options.logger.warn({ status, body }, 'tmdb returned an unexpected status');
    throw AppError.upstream('Unexpected response from TMDB');
  }

  private buildUrl(path: string, params: Record<string, string | number | undefined>): string {
    // Join against the origin: an absolute path would otherwise discard the
    // /3 prefix from a base URL (new URL('/x', '…/3') === '…/x').
    const normalized = path.startsWith('/') ? path : `/${path}`;
    const url = new URL(`/3${normalized}`, TMDB_API_ROOT);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
    return url.toString();
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
