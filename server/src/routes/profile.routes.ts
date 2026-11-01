import { Router } from 'express';
import type { Request, Response, RequestHandler, NextFunction } from 'express';
import type { Env } from '../lib/env.js';
import { AppError } from '../lib/errors.js';
import { requireAuth, requireProfile } from '../middleware/auth.js';
import * as profiles from '../services/auth/profile.service.js';
import * as auth from '../services/auth/auth.service.js';
import { REFRESH_COOKIE, refreshCookieOptions } from './auth.routes.js';
import {
  preferencesSchema,
  profileCreateSchema,
  profileIdParamsSchema,
  profileUpdateSchema,
} from '../validators/auth.js';

function asyncRoute(handler: (req: Request, res: Response) => Promise<void>): RequestHandler {
  return (req, res, next: NextFunction) => {
    handler(req, res).catch(next);
  };
}

function parse<T>(schema: { safeParse: (data: unknown) => { success: boolean; error?: { issues: unknown }; data?: T } }, data: unknown): T {
  const parsed = schema.safeParse(data);
  if (!parsed.success || parsed.data === undefined) {
    throw AppError.badRequest('Request validation failed', parsed.error?.issues);
  }
  return parsed.data;
}

/** Profile management + preferences — all routes require an authenticated user. */
export function profileRoutes(env: Env): Router {
  const router = Router();
  router.use(requireAuth(env));

  router.get(
    '/',
    asyncRoute(async (req, res) => {
      res.json({ profiles: await profiles.listProfiles(req.auth!.userId) });
    }),
  );

  router.post(
    '/',
    asyncRoute(async (req, res) => {
      const input = parse(profileCreateSchema, req.body);
      const profile = await profiles.createProfile(req.auth!.userId, input);
      res.status(201).json({ profile });
    }),
  );

  router.patch(
    '/:id',
    asyncRoute(async (req, res) => {
      const { id } = parse(profileIdParamsSchema, req.params);
      const patch = parse(profileUpdateSchema, req.body);
      res.json({ profile: await profiles.updateProfile(req.auth!.userId, id, patch) });
    }),
  );

  router.delete(
    '/:id',
    asyncRoute(async (req, res) => {
      const { id } = parse(profileIdParamsSchema, req.params);
      await profiles.deleteProfile(req.auth!.userId, id);
      res.status(204).send();
    }),
  );

  // Switching profiles re-issues the session (new access token + rotated refresh)
  router.post(
    '/:id/activate',
    asyncRoute(async (req, res) => {
      const { id } = parse(profileIdParamsSchema, req.params);
      const session = await auth.activateProfile(req.auth!.userId, id, env);
      res.cookie(REFRESH_COOKIE, session.refreshToken, refreshCookieOptions(env));
      res.json({ user: session.user, profile: session.profile, accessToken: session.accessToken });
    }),
  );

  // Preferences — scoped to the active profile in the token
  router.get(
    '/me/preferences',
    requireProfile(),
    asyncRoute(async (req, res) => {
      res.json(await profiles.getPreferences(req.auth!.userId, req.auth!.profileId!));
    }),
  );

  router.put(
    '/me/preferences',
    requireProfile(),
    asyncRoute(async (req, res) => {
      const patch = parse(preferencesSchema, req.body);
      res.json(await profiles.updatePreferences(req.auth!.userId, req.auth!.profileId!, patch));
    }),
  );

  return router;
}
