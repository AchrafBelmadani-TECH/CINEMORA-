import { z } from 'zod';

/**
 * Environment contract. Required-by-later-phase variables are optional here so
 * the server boots in Phase 1; each phase tightens its own variables to
 * required (fail-fast) when the feature that needs them ships.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  CLIENT_ORIGIN: z.string().url().default('http://localhost:5173'),

  // Phase 2+
  TMDB_READ_ACCESS_TOKEN: z.string().min(1).optional(),

  // Phase 4+ — local default points at the embedded dev Postgres; staging and
  // production override DATABASE_URL with a managed instance.
  DATABASE_URL: z
    .string()
    .min(1)
    .default('postgresql://cinemora@localhost:5433/cinemora'),
  JWT_SECRET: z.string().min(32),

  // Phase 7 (first admin seed): a user registering with this email becomes ADMIN.
  ADMIN_BOOTSTRAP_EMAIL: z.string().min(3).optional(),

  // Auth endpoint rate limit (requests/min/IP). Default 10; raise for load tests.
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(10_000).default(10),

  // Phase 6+
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  STORAGE_ROOT: z.string().min(1).default('./storage'),
  FFMPEG_PATH: z.string().min(1).optional(),
  FFPROBE_PATH: z.string().min(1).optional(),

  // Interim bootstrap-admin credential for the sync API until USER/ADMIN
  // RBAC ships (Phase 5). Unset → admin routes return 503 (disabled).

});

export type Env = z.infer<typeof envSchema>;

export class EnvValidationError extends Error {
  constructor(public readonly issues: z.ZodIssue[]) {
    super('Environment validation failed');
    this.name = 'EnvValidationError';
  }
}

/** Parse and validate a raw environment bag (injectable for tests). */
export function parseEnv(raw: Record<string, string | undefined>): Env {
  // Empty strings (e.g. placeholder lines copied from .env.example for
  // later phases) mean "unset", not "invalid".
  const cleaned = Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, typeof v === 'string' && v.trim() === '' ? undefined : v]),
  );
  const result = envSchema.safeParse(cleaned);
  if (!result.success) {
    throw new EnvValidationError(result.error.issues);
  }
  return result.data;
}

let cached: Env | undefined;

/** The process environment, validated once. Throws (fail-fast) if invalid. */
export function env(): Env {
  if (!cached) {
    cached = parseEnv(process.env);
  }
  return cached;
}

/** Test hook — forget the cached env. */
export function resetEnvCache(): void {
  cached = undefined;
}
