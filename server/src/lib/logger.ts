import pino from 'pino';
import type { Env } from './env.js';

export function createLogger(env: Env) {
  return pino({
    level: env.LOG_LEVEL,
    base: { service: 'cinemora-api' },
  });
}

export type Logger = ReturnType<typeof createLogger>;
