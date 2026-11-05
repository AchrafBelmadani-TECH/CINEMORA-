import { afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createLogger } from '../src/lib/logger.js';
import { parseEnv, type Env } from '../src/lib/env.js';
import { prisma } from '../src/lib/prisma.js';

const env: Env = {
  ...parseEnv({ NODE_ENV: 'test', LOG_LEVEL: 'silent', JWT_SECRET: 'auth-test-secret-auth-test-secret-1', AUTH_RATE_LIMIT_MAX: 1000 }),
  ADMIN_BOOTSTRAP_EMAIL: 'admin@auth.test',
};

const logger = createLogger(env);
const app = createApp({ env, logger });

let emailCounter = 0;
const uniqueEmail = (prefix: string) => `${prefix}-${Date.now()}-${emailCounter++}@auth.test`;

function extractRefreshCookie(res: import('supertest').Response): string {
  const cookies = res.headers['set-cookie'] as unknown as string[];
  const cookie = Array.isArray(cookies) ? cookies.find((c) => c.startsWith('refresh_token=')) : undefined;
  expect(cookie, 'refresh cookie must be set').toBeTruthy();
  return cookie!;
}

function refreshCookieValue(cookieHeader: string): string {
  return cookieHeader.split(';')[0]!.split('=').slice(1).join('=');
}

async function register(email = uniqueEmail('user')) {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ email, password: 'Password123', displayName: 'Test User' });
  expect(res.status).toBe(201);
  return res;
}

afterAll(async () => {
  await prisma.refreshToken.deleteMany({ where: { user: { email: { contains: '@auth.test' } } } });
  await prisma.profile.deleteMany({ where: { user: { email: { contains: '@auth.test' } } } });
  await prisma.user.deleteMany({ where: { email: { contains: '@auth.test' } } });
  await prisma.$disconnect();
});

describe('registration & login', () => {
  it('registers with hashed password, first profile and session cookies', async () => {
    const email = uniqueEmail('register');
    const res = await register(email);

    expect(res.body.user.email).toBe(email);
    expect(res.body.user.role).toBe('USER');
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.profile.name).toBe('Test User');

    const cookie = extractRefreshCookie(res);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Path=/api/v1/auth');

    const stored = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(stored.passwordHash.startsWith('$argon2id$')).toBe(true);
    expect(stored.passwordHash).not.toContain('Password123');
  });

  it('rejects duplicate emails with 409', async () => {
    const email = uniqueEmail('dupe');
    await register(email);
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email, password: 'Password123', displayName: 'Dupe' });
    expect(res.status).toBe(409);
  });

  it('validates password strength and email format', async () => {
    const weak = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: uniqueEmail('weak'), password: 'short', displayName: 'Weak' });
    expect(weak.status).toBe(400);
    expect(weak.body.error.code).toBe('VALIDATION_ERROR');

    const noDigits = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: uniqueEmail('weak'), password: 'nodigitshere', displayName: 'Weak' });
    expect(noDigits.status).toBe(400);

    const badEmail = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'not-an-email', password: 'Password123', displayName: 'Bad' });
    expect(badEmail.status).toBe(400);
  });

  it('logs in with correct credentials and returns a session', async () => {
    const email = uniqueEmail('login');
    await register(email);
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: 'Password123' });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(extractRefreshCookie(res)).toBeTruthy();
  });

  it('returns a generic 401 for wrong credentials (no enumeration)', async () => {
    const email = uniqueEmail('wrong');
    await register(email);
    const wrongPassword = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: 'WrongPassword1' });
    expect(wrongPassword.status).toBe(401);
    expect(wrongPassword.body.error.message).toMatch(/invalid email or password/i);

    const unknown = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'ghost@auth.test', password: 'Password123' });
    expect(unknown.status).toBe(401);
    expect(unknown.body.error.message).toMatch(/invalid email or password/i);
  });

  it('blocks disabled accounts with 403', async () => {
    const email = uniqueEmail('disabled');
    await register(email);
    await prisma.user.update({ where: { email }, data: { isDisabled: true } });

    const res = await request(app).post('/api/v1/auth/login').send({ email, password: 'Password123' });
    expect(res.status).toBe(403);
  });

  it('grants ADMIN to the configured bootstrap email', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'admin@auth.test', password: 'Password123', displayName: 'Admin' });
    if (res.status === 409) {
      // idempotent across runs — log in and check the role
      const login = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'admin@auth.test', password: 'Password123' });
      expect(login.body.user.role).toBe('ADMIN');
      return;
    }
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('ADMIN');
  });
});

describe('session lifecycle', () => {
  it('returns the account with profiles from /auth/me', async () => {
    const reg = await register();
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${reg.body.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(reg.body.user.email);
    expect(res.body.user.profiles).toHaveLength(1);
  });

  it('requires a bearer token for /auth/me', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  it('rotates the refresh token and keeps the session alive', async () => {
    const reg = await register();
    const firstCookie = extractRefreshCookie(reg);

    const refreshed = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', firstCookie);
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.accessToken).toBeTruthy();

    // rotation: the presented token was revoked — replaying it is reuse
    const replay = await request(app).post('/api/v1/auth/refresh').set('Cookie', firstCookie);
    expect(replay.status).toBe(401);

    // reuse detection revoked the whole family — the rotated token is dead too
    const rotatedCookie = extractRefreshCookie(refreshed);
    const afterReuse = await request(app).post('/api/v1/auth/refresh').set('Cookie', rotatedCookie);
    expect(afterReuse.status).toBe(401);
  });

  it('rejects refresh without a cookie', async () => {
    const res = await request(app).post('/api/v1/auth/refresh');
    expect(res.status).toBe(401);
  });

  it('revokes the family on logout', async () => {
    const reg = await register();
    const cookie = extractRefreshCookie(reg);

    const logout = await request(app).post('/api/v1/auth/logout').set('Cookie', cookie);
    expect(logout.status).toBe(204);

    const after = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);
    expect(after.status).toBe(401);
  });

  it('logs out idempotently without a cookie', async () => {
    const res = await request(app).post('/api/v1/auth/logout');
    expect(res.status).toBe(204);
  });
});

describe('profiles', () => {
  it('creates profiles up to the limit of 5 and rejects the 6th', async () => {
    const reg = await register();
    const authHeader = { Authorization: `Bearer ${reg.body.accessToken}` };

    for (let i = 2; i <= 5; i++) {
      const created = await request(app)
        .post('/api/v1/profiles')
        .set(authHeader)
        .send({ name: `Profile ${i}`, avatarKey: 'nova' });
      expect(created.status).toBe(201);
    }

    const sixth = await request(app)
      .post('/api/v1/profiles')
      .set(authHeader)
      .send({ name: 'Profile 6', avatarKey: 'jade' });
    expect(sixth.status).toBe(409);
  });

  it('renames, switches and deletes profiles with owner scoping', async () => {
    const reg = await register();
    const token = reg.body.accessToken as string;
    const authHeader = { Authorization: `Bearer ${token}` };

    const created = await request(app)
      .post('/api/v1/profiles')
      .set(authHeader)
      .send({ name: 'Kids', avatarKey: 'coral' });
    const profileId = created.body.profile.id as string;

    const renamed = await request(app)
      .patch(`/api/v1/profiles/${profileId}`)
      .set(authHeader)
      .send({ name: 'Family' });
    expect(renamed.body.profile.name).toBe('Family');

    const activated = await request(app)
      .post(`/api/v1/profiles/${profileId}/activate`)
      .set(authHeader);
    expect(activated.status).toBe(200);
    expect(activated.body.profile.id).toBe(profileId);
    expect(activated.body.accessToken).toBeTruthy();

    // scoping: another account cannot touch it
    const other = await register();
    const forbidden = await request(app)
      .patch(`/api/v1/profiles/${profileId}`)
      .set({ Authorization: `Bearer ${other.body.accessToken}` })
      .send({ name: 'Hacked' });
    expect(forbidden.status).toBe(404);

    const deleted = await request(app).delete(`/api/v1/profiles/${profileId}`).set(authHeader);
    expect(deleted.status).toBe(204);
  });

  it('prevents deleting the last remaining profile', async () => {
    const reg = await register();
    const profileId = reg.body.profile.id as string;
    const res = await request(app)
      .delete(`/api/v1/profiles/${profileId}`)
      .set({ Authorization: `Bearer ${reg.body.accessToken}` });
    expect(res.status).toBe(400);
  });

  it('rejects unknown avatar presets', async () => {
    const reg = await register();
    const res = await request(app)
      .post('/api/v1/profiles')
      .set({ Authorization: `Bearer ${reg.body.accessToken}` })
      .send({ name: 'Evil', avatarKey: 'https://evil.example/track.png' });
    expect(res.status).toBe(400);
  });
});

describe('preferences', () => {
  it('creates defaults on first read and persists updates', async () => {
    const reg = await register();
    const authHeader = { Authorization: `Bearer ${reg.body.accessToken}` };

    const initial = await request(app).get('/api/v1/profiles/me/preferences').set(authHeader);
    expect(initial.status).toBe(200);
    expect(initial.body.preferredLanguage).toBe('en');
    expect(initial.body.autoplayNext).toBe(true);

    const updated = await request(app)
      .put('/api/v1/profiles/me/preferences')
      .set(authHeader)
      .send({ preferredLanguage: 'de', subtitleLanguage: 'en', autoplayNext: false });
    expect(updated.body.preferredLanguage).toBe('de');
    expect(updated.body.autoplayNext).toBe(false);

    const reread = await request(app).get('/api/v1/profiles/me/preferences').set(authHeader);
    expect(reread.body.preferredLanguage).toBe('de');
  });

  it('rejects invalid language codes', async () => {
    const reg = await register();
    const res = await request(app)
      .put('/api/v1/profiles/me/preferences')
      .set({ Authorization: `Bearer ${reg.body.accessToken}` })
      .send({ preferredLanguage: 'german' });
    expect(res.status).toBe(400);
  });
});

describe('role-based access control', () => {
  it('forbids USER accounts from admin sync endpoints', async () => {
    const reg = await register();
    const res = await request(app)
      .post('/api/v1/admin/sync')
      .set({ Authorization: `Bearer ${reg.body.accessToken}` })
      .send({ source: 'movie_popular', pages: 1 });
    expect(res.status).toBe(403);
  });

  it('allows the bootstrap ADMIN account to view import jobs', async () => {
    const payload = { email: 'admin@auth.test', password: 'Password123' };
    let res = await request(app).post('/api/v1/auth/register').send({
      ...payload,
      displayName: 'Admin',
    });
    if (res.status === 409) {
      res = await request(app).post('/api/v1/auth/login').send(payload);
    }
    const token = res.body.accessToken as string;
    expect(res.body.user.role).toBe('ADMIN');

    const jobs = await request(app)
      .get('/api/v1/admin/import-jobs')
      .set({ Authorization: `Bearer ${token}` });
    expect(jobs.status).toBe(200);
  });
});
