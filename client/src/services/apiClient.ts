export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** True when the failure is on our side of the API (TMDB misconfig/outage). */
  get isUpstream(): boolean {
    return this.code === 'UPSTREAM_ERROR';
  }
}

const BASE_URL = '/api/v1';

/** In-memory access token — never persisted to localStorage (ADR #5). */
let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export interface RefreshedSession { accessToken: string }
type RefreshListener = (session: RefreshedSession) => void;
type SessionListener = () => void;
const refreshListeners = new Set<RefreshListener>();
const expiredListeners = new Set<SessionListener>();

/** Registers callbacks fired when the silent refresh rotates the session. */
export function onSessionRefreshed(listener: RefreshListener): () => void {
  refreshListeners.add(listener);
  return () => refreshListeners.delete(listener);
}

export function onSessionExpired(listener: () => void): () => void {
  expiredListeners.add(listener);
  return () => expiredListeners.delete(listener);
}

let refreshInFlight: Promise<boolean> | null = null;

/** Single-flight silent refresh; returns whether a new access token was obtained. */
function attemptRefresh(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const response = await fetch(`${BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers: { accept: 'application/json' },
        });
        if (!response.ok) {
          accessToken = null;
          expiredListeners.forEach((l) => l());
          return false;
        }
        const session = (await response.json()) as { accessToken: string };
        accessToken = session.accessToken;
        refreshListeners.forEach((l) => l(session));
        return true;
      } catch {
        return false;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; params?: Record<string, string | number | undefined>; _retried?: boolean } = {},
): Promise<T> {
  const { method = 'GET', body, params } = options;
  const url = new URL(`${BASE_URL}${path}`, window.location.origin);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }

  const headers: Record<string, string> = { accept: 'application/json' };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (body !== undefined) headers['content-type'] = 'application/json';

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Unable to reach CINEMORA servers');
  }

  if (response.status === 401 && !options._retried && accessToken) {
    // access token expired — refresh once (single-flight) and retry
    const refreshed = await attemptRefresh();
    if (refreshed) {
      return request<T>(path, { ...options, _retried: true });
    }
  }

  if (response.ok) {
    return (await response.json()) as T;
  }

  const errorBody = (await response.json().catch(() => null)) as {
    error?: { code?: string; message?: string; details?: unknown };
  } | null;
  const error = errorBody?.error;
  throw new ApiError(
    response.status,
    error?.code ?? 'INTERNAL_ERROR',
    error?.message ?? `Request failed with status ${response.status}`,
    error?.details,
  );
}

export const apiClient = {
  get: <T>(path: string, params?: Record<string, string | number | undefined>) => request<T>(path, { params }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
