import type { NextFunction, Request, Response, RequestHandler } from 'express';
import { AppError } from '../lib/errors.js';
import type { Env } from '../lib/env.js';
import { verifyAccessToken } from '../services/auth/tokens.js';
import type { UserRole } from '@prisma/client';

export interface AuthenticatedUser {
  userId: string;
  role: UserRole;
  profileId: string | null;
}

declare module 'express-serve-static-core' {
  interface Request {
    auth?: AuthenticatedUser;
  }
}

/** Verifies the Bearer access token and attaches the authenticated identity. */
export function requireAuth(env: Env): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const header = req.header('authorization');
    if (!header?.startsWith('Bearer ')) {
      next(AppError.unauthorized('Authentication required'));
      return;
    }
    verifyAccessToken(header.slice(7).trim(), env.JWT_SECRET)
      .then((claims) => {
        req.auth = { userId: claims.sub, role: claims.role, profileId: claims.profileId };
        next();
      })
      .catch(() => {
        next(AppError.unauthorized('Access token is invalid or expired'));
      });
  };
}

/** Role gate — must run after requireAuth. */
export function requireRole(role: UserRole): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) {
      next(AppError.unauthorized('Authentication required'));
      return;
    }
    if (req.auth.role !== role) {
      next(AppError.forbidden('You do not have permission to access this resource'));
      return;
    }
    next();
  };
}

/** Personal-data gate — an active profile must be present in the token. */
export function requireProfile(): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth?.profileId) {
      next(AppError.forbidden('Select a profile first'));
      return;
    }
    next();
  };
}

/** Parses the Bearer token if present; never errors. Sets req.auth or leaves it undefined. */
export function optionalAuth(env: Env): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const header = req.header('authorization');
    if (!header?.startsWith('Bearer ')) {
      next();
      return;
    }
    verifyAccessToken(header.slice(7).trim(), env.JWT_SECRET)
      .then((claims) => {
        req.auth = { userId: claims.sub, role: claims.role, profileId: claims.profileId };
        next();
      })
      .catch(() => next());
  };
}
