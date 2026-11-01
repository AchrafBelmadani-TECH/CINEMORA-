import { Router } from 'express';
import type { Request, Response, RequestHandler, NextFunction } from 'express';
import type { Env } from '../lib/env.js';
import type { Logger } from '../lib/logger.js';
import { AppError } from '../lib/errors.js';
import { createRateLimiter } from '../lib/rateLimit.js';
import { requireAuth } from '../middleware/auth.js';
import * as auth from '../services/auth/auth.service.js';
import { loginSchema, registerSchema } from '../validators/auth.js';

export const REFRESH_COOKIE = 'refresh_token';

export function refreshCookieOptions(env: Env) {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/api/v1/auth',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  };
}

function readRefreshCookie(req: Request): string {
  const token = (req.cookies as Record<string, string | undefined> | undefined)?.[REFRESH_COOKIE];
  if (!token) throw AppError.unauthorized('Refresh token missing');
  return token;
}

function validate<T>(schema: { safeParse: (data: unknown) => { success: boolean; error?: { issues: unknown }; data?: T } }, body: unknown): T {
  const parsed = schema.safeParse(body ?? {});
  if (!parsed.success || parsed.data === undefined) {
    throw AppError.badRequest('Request validation failed', parsed.error?.issues);
  }
  return parsed.data;
}

function asyncRoute(handler: (req: Request, res: Response) => Promise<void>): RequestHandler {
  return (req, res, next: NextFunction) => {
    handler(req, res).catch(next);
  };
}

/** Session endpoints: register, login, refresh (rotation), logout, me. */
export function authRoutes(env: Env, logger: Logger): Router {
  const router = Router();
  const authLimiter = createRateLimiter({ windowMs: 60_000, max: env.AUTH_RATE_LIMIT_MAX });

  function respondWithSession(res: Response, session: auth.SessionTokens, status = 200) {
    res.cookie(REFRESH_COOKIE, session.refreshToken, refreshCookieOptions(env));
    res.status(status).json({
      user: session.user,
      profile: session.profile,
      accessToken: session.accessToken,
    });
  }

  router.post(
    '/register',
    authLimiter.middleware,
    asyncRoute(async (req, res) => {
      const input = validate(registerSchema, req.body);
      const session = await auth.register(input, env);
      respondWithSession(res, session, 201);
    }),
  );

  router.post(
    '/login',
    authLimiter.middleware,
    asyncRoute(async (req, res) => {
      const input = validate(loginSchema, req.body);
      const session = await auth.login(input, env);
      respondWithSession(res, session);
    }),
  );

  router.post(
    '/refresh',
    asyncRoute(async (req, res) => {
      const rawToken = readRefreshCookie(req);
      const session = await auth.refresh(rawToken, env, logger);
      respondWithSession(res, session);
    }),
  );

  router.post(
    '/logout',
    asyncRoute(async (req, res) => {
      const rawToken = (req.cookies as Record<string, string | undefined> | undefined)?.[REFRESH_COOKIE];
      await auth.logout(rawToken);
      res.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
      res.status(204).send();
    }),
  );

  router.get(
    '/me',
    requireAuth(env),
    asyncRoute(async (req, res) => {
      const user = await auth.me(req.auth!.userId);
      res.json({ user });
    }),
  );

  return router;
}
