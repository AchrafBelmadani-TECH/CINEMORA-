import { createHash, randomBytes } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import type { UserRole } from '@prisma/client';

const ISSUER = 'cinemora';
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60; // 15 minutes
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

export interface AccessTokenClaims {
  sub: string; // user id
  role: UserRole;
  profileId: string | null; // active profile
  tokenType: 'access';
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string; // raw — only the SHA-256 hash is stored
}

function secretKey(jwtSecret: string): Uint8Array {
  return new TextEncoder().encode(jwtSecret);
}

export async function signAccessToken(
  claims: Omit<AccessTokenClaims, 'tokenType'>,
  jwtSecret: string,
): Promise<string> {
  return new SignJWT({ ...claims, tokenType: 'access' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(secretKey(jwtSecret));
}

export async function verifyAccessToken(token: string, jwtSecret: string): Promise<AccessTokenClaims> {
  const { payload } = await jwtVerify(token, secretKey(jwtSecret), { issuer: ISSUER });
  if (payload.tokenType !== 'access') throw new Error('wrong token type');
  return {
    sub: String(payload.sub),
    role: payload.role as UserRole,
    profileId: (payload.profileId as string | null) ?? null,
    tokenType: 'access',
  };
}

/** 256-bit random refresh token; only its SHA-256 hash is persisted. */
export function generateRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashRefreshToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}
