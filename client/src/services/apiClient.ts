/** Error thrown for any non-2xx API response, shaped like the server envelope. */
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

async function request<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`, window.location.origin);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      headers: { accept: 'application/json' },
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Unable to reach CINEMORA servers');
  }

  if (response.ok) {
    return (await response.json()) as T;
  }

  const body = (await response.json().catch(() => null)) as { error?: { code?: string; message?: string; details?: unknown } } | null;
  const error = body?.error;
  throw new ApiError(
    response.status,
    error?.code ?? 'INTERNAL_ERROR',
    error?.message ?? `Request failed with status ${response.status}`,
    error?.details,
  );
}

export const apiClient = {
  get: request,
};
