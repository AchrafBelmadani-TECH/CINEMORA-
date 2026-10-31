import type { NextFunction, Request, Response } from 'express';
import { AppError } from './errors.js';

export interface RateLimiterOptions {
  windowMs: number;
  max: number;
  /** Injectable clock for tests. */
  now?: () => number;
  keyFrom?: (req: Request) => string;
}

export interface RateLimiter {
  middleware: (req: Request, res: Response, next: NextFunction) => void;
}

/**
 * Fixed-window in-memory rate limiter. Sufficient for the single-process dev
 * topology; Phase 8 swaps in a shared store if we scale out horizontally.
 */
export function createRateLimiter(options: RateLimiterOptions): RateLimiter {
  const { windowMs, max } = options;
  const now = options.now ?? Date.now;
  const keyFrom = options.keyFrom ?? ((req) => req.ip ?? 'unknown');
  const hits = new Map<string, number[]>();

  function prune(key: string, at: number): number[] {
    const cutoff = at - windowMs;
    const recent = (hits.get(key) ?? []).filter((t) => t > cutoff);
    if (recent.length > 0) hits.set(key, recent);
    else hits.delete(key);
    return recent;
  }

  const middleware = (req: Request, _res: Response, next: NextFunction) => {
    const key = keyFrom(req);
    const at = now();
    const recent = prune(key, at);
    if (recent.length >= max) {
      const retryAfterSec = Math.ceil((recent[0]! + windowMs - at) / 1000);
      _res.setHeader('Retry-After', String(Math.max(retryAfterSec, 1)));
      next(AppError.rateLimited(`Rate limit exceeded — try again in ${Math.max(retryAfterSec, 1)}s`));
      return;
    }
    recent.push(at);
    hits.set(key, recent);
    next();
  };

  return { middleware };
}
