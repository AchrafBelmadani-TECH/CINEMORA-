import { describe, expect, it } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { createRateLimiter } from '../src/lib/rateLimit.js';
import { AppError } from '../src/lib/errors.js';

function fakeReq(ip = '203.0.113.7'): Request {
  return { ip } as unknown as Request;
}

function fakeRes(): { headers: Record<string, string>; res: Response } {
  const headers: Record<string, string> = {};
  const res = {
    setHeader: (k: string, v: string) => {
      headers[k.toLowerCase()] = v;
    },
  } as unknown as Response;
  return { headers, res };
}

function run(
  middleware: (req: Request, res: Response, next: NextFunction) => void,
  req: Request,
  res: Response,
): unknown {
  let captured: unknown = 'next-not-called';
  middleware(req, res, ((err?: unknown) => {
    captured = err;
  }) as NextFunction);
  return captured;
}

describe('createRateLimiter', () => {
  it('allows up to max requests inside the window, then blocks', () => {
    let t = 0;
    const { middleware } = createRateLimiter({ windowMs: 1000, max: 3, now: () => t });

    const outcomes: unknown[] = [];
    for (let i = 0; i < 4; i++) {
      const { res } = fakeRes();
      outcomes.push(run(middleware, fakeReq(), res));
      t += 10;
    }

    expect(outcomes.slice(0, 3)).toEqual([undefined, undefined, undefined]);
    expect(outcomes[3]).toBeInstanceOf(AppError);
    expect((outcomes[3] as AppError).status).toBe(429);
  });

  it('frees capacity once the window slides past the oldest hit', () => {
    let t = 0;
    const { middleware } = createRateLimiter({ windowMs: 1000, max: 1, now: () => t });

    const first = fakeRes();
    expect(run(middleware, fakeReq(), first.res)).toBeUndefined();

    const blocked = fakeRes();
    expect(run(middleware, fakeReq(), blocked.res)).toBeInstanceOf(AppError);

    t = 1001; // first hit has left the window
    const after = fakeRes();
    expect(run(middleware, fakeReq(), after.res)).toBeUndefined();
  });

  it('sets a Retry-After header when blocking', () => {
    const { middleware } = createRateLimiter({ windowMs: 60_000, max: 1, now: () => 0 });

    const first = fakeRes();
    run(middleware, fakeReq(), first.res);
    const second = fakeRes();
    run(middleware, fakeReq(), second.res);

    expect(second.headers['retry-after']).toBeDefined();
    expect(Number(second.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('tracks clients independently', () => {
    const { middleware } = createRateLimiter({ windowMs: 1000, max: 1, now: () => 0 });

    const a1 = fakeRes();
    const b1 = fakeRes();
    expect(run(middleware, fakeReq('1.1.1.1'), a1.res)).toBeUndefined();
    expect(run(middleware, fakeReq('2.2.2.2'), b1.res)).toBeUndefined();
  });
});
