import { createHmac, timingSafeEqual } from 'node:crypto';

const TOKEN_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours — covers a long feature film

/**
 * Short-lived playback tokens for media URLs. Native <video> and HLS segment
 * requests cannot carry Authorization headers, so URLs carry an HMAC of
 * (assetId + expiry) signed with JWT_SECRET. Forged or expired URLs are
 * rejected before any file is touched.
 */
export function signMediaToken(assetId: string, jwtSecret: string, now = Date.now()): string {
  const expires = now + TOKEN_TTL_MS;
  const signature = createHmac('sha256', jwtSecret).update(`${assetId}:${expires}`).digest('base64url');
  return `${expires}.${signature}`;
}

export function verifyMediaToken(assetId: string, token: string, jwtSecret: string, now = Date.now()): boolean {
  const [expiresRaw, signature] = token.split('.');
  if (!expiresRaw || !signature) return false;
  const expires = Number(expiresRaw);
  if (!Number.isFinite(expires) || expires < now) return false;
  const expected = createHmac('sha256', jwtSecret).update(`${assetId}:${expires}`).digest('base64url');
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
