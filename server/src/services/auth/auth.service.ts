import { AppError } from '../../lib/errors.js';
import type { Logger } from '../../lib/logger.js';
import { prisma } from '../../lib/prisma.js';
import type { Env } from '../../lib/env.js';
import { hashPassword, verifyPassword } from './password.js';
import {
  generateRefreshToken,
  hashRefreshToken,
  signAccessToken,
  REFRESH_TOKEN_TTL_SECONDS,
} from './tokens.js';
import type { LoginInput, RegisterInput } from '../../validators/auth.js';

export const MAX_PROFILES_PER_ACCOUNT = 5;

export interface SessionUser {
  id: string;
  email: string;
  displayName: string;
  role: 'USER' | 'ADMIN';
}

export interface SessionProfile {
  id: string;
  name: string;
  avatarKey: string;
}

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  user: SessionUser;
  profile: SessionProfile;
}

function sessionUser(user: { id: string; email: string; displayName: string; role: string }): SessionUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role as 'USER' | 'ADMIN',
  };
}

/**
 * Issues an access token bound to the active profile + a rotating refresh
 * token (hashed at rest). The refresh row remembers the session's active
 * profile so silent refreshes keep it.
 */
async function issueSession(
  user: { id: string; email: string; displayName: string; role: string },
  profile: SessionProfile,
  env: Env,
  familyId?: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  const accessToken = await signAccessToken(
    { sub: user.id, role: user.role as 'USER' | 'ADMIN', profileId: profile.id },
    env.JWT_SECRET,
  );
  const refreshToken = generateRefreshToken();
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashRefreshToken(refreshToken),
      familyId: familyId ?? crypto.randomUUID(),
      profileId: profile.id,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000),
    },
  });
  return { accessToken, refreshToken };
}

/** Registers an account, seeds the first profile and returns a full session. */
export async function register(input: RegisterInput, env: Env): Promise<SessionTokens> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw AppError.conflict('An account with this email already exists');

  // Admin bootstrap: the configured email becomes ADMIN (docs/ARCHITECTURE §6).
  const role = env.ADMIN_BOOTSTRAP_EMAIL && env.ADMIN_BOOTSTRAP_EMAIL.toLowerCase() === input.email ? 'ADMIN' : 'USER';

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash: await hashPassword(input.password),
      displayName: input.displayName,
      role,
    },
  });

  const profile = await prisma.profile.create({
    data: { userId: user.id, name: input.displayName.slice(0, 25), avatarKey: 'aurora' },
  });

  const { accessToken, refreshToken } = await issueSession(user, profile, env);
  return {
    accessToken,
    refreshToken,
    user: sessionUser(user),
    profile: { id: profile.id, name: profile.name, avatarKey: profile.avatarKey },
  };
}

/** Verifies credentials with a generic error (no user enumeration; timing parity). */
export async function login(input: LoginInput, env: Env): Promise<SessionTokens> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  const passwordOk = user
    ? await verifyPassword(user.passwordHash, input.password)
    : await verifyPassword(
        '$argon2id$v=19$m=19456,t=2,p=1$Y2luZW1vcmFkZXZzYWx0$K17f2ZvJ2LmS3WqV0aZ4yB5XlJ8QeM9nH6tRcU2wAo0',
        input.password,
      );

  if (!user || !passwordOk) throw AppError.unauthorized('Invalid email or password');
  if (user.isDisabled) throw AppError.forbidden('This account has been disabled');

  const profile = await prisma.profile.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, avatarKey: true },
  });
  if (!profile) throw AppError.internal('Account has no profile');

  const { accessToken, refreshToken } = await issueSession(user, profile, env);
  return { accessToken, refreshToken, user: sessionUser(user), profile };
}

/**
 * Rotates a refresh token, preserving the session's active profile. Reuse of
 * a revoked token is treated as theft: the entire family is revoked and the
 * caller must re-authenticate.
 */
export async function refresh(rawToken: string, env: Env, logger: Logger): Promise<SessionTokens> {
  const tokenHash = hashRefreshToken(rawToken);
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!stored) throw AppError.unauthorized('Invalid refresh token');

  if (stored.revokedAt) {
    await prisma.refreshToken.updateMany({
      where: { familyId: stored.familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    logger.warn({ userId: stored.userId, familyId: stored.familyId }, 'refresh token reuse detected — family revoked');
    throw AppError.unauthorized('Session revoked — please sign in again');
  }

  if (stored.expiresAt <= new Date()) throw AppError.unauthorized('Refresh token expired');
  if (stored.user.isDisabled) throw AppError.forbidden('This account has been disabled');

  await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });

  // Preserve the session's active profile; fall back to the first profile if
  // it was deleted during the session.
  let profile = stored.profileId
    ? await prisma.profile.findFirst({
        where: { id: stored.profileId, userId: stored.user.id },
        select: { id: true, name: true, avatarKey: true },
      })
    : null;
  if (!profile) {
    profile = await prisma.profile.findFirst({
      where: { userId: stored.user.id },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, avatarKey: true },
    });
  }
  if (!profile) throw AppError.forbidden('Account has no profile');

  const { accessToken, refreshToken } = await issueSession(stored.user, profile, env, stored.familyId);
  return { accessToken, refreshToken, user: sessionUser(stored.user), profile };
}

/** Revokes the presented token's entire family (idempotent). */
export async function logout(rawToken: string | undefined): Promise<void> {
  if (!rawToken) return;
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash: hashRefreshToken(rawToken) } });
  if (!stored) return;
  await prisma.refreshToken.updateMany({
    where: { familyId: stored.familyId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/** Re-issues a session bound to a (re)activated profile in a new family. */
export async function activateProfile(userId: string, profileId: string, env: Env): Promise<SessionTokens> {
  const profile = await prisma.profile.findFirst({
    where: { id: profileId, userId },
    select: { id: true, name: true, avatarKey: true },
  });
  if (!profile) throw AppError.notFound('Profile not found');

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const { accessToken, refreshToken } = await issueSession(user, profile, env, crypto.randomUUID());
  return { accessToken, refreshToken, user: sessionUser(user), profile };
}

export async function me(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      displayName: true,
      role: true,
      createdAt: true,
      profiles: { orderBy: { createdAt: 'asc' }, select: { id: true, name: true, avatarKey: true } },
    },
  });
  if (!user) throw AppError.notFound('Account not found');
  return user;
}

