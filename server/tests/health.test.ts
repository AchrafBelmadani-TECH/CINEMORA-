import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createLogger } from '../src/lib/logger.js';
import { parseEnv } from '../src/lib/env.js';
import type { Env } from '../src/lib/env.js';

function testEnv(overrides: Partial<Env> = {}): Env {
  return { ...parseEnv({ NODE_ENV: 'test', LOG_LEVEL: 'silent', JWT_SECRET: 'x'.repeat(32) }), ...overrides };
}

function makeApp(testRoutes = false) {
  return createApp({
    env: testEnv(),
    logger: createLogger(testEnv()),
    testRoutes,
  });
}

describe('GET /api/v1/health', () => {
  it('returns ok with version and uptime', async () => {
    const res = await request(makeApp()).get('/api/v1/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.version).toBe('string');
    expect(typeof res.body.uptime).toBe('number');
    expect(res.headers['x-request-id']).toMatch(/^req_/);
  });

  it('echoes a well-formed inbound X-Request-Id', async () => {
    const res = await request(makeApp()).get('/api/v1/health').set('X-Request-Id', 'req_fixed_123');
    expect(res.headers['x-request-id']).toBe('req_fixed_123');
  });
});

describe('unknown routes', () => {
  it('return the 404 envelope with a request id', async () => {
    const res = await request(makeApp()).get('/api/v1/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.error.requestId).toMatch(/^req_/);
  });
});

describe('error handler', () => {
  it('renders AppError with code, message and details', async () => {
    const res = await request(makeApp(true)).get('/api/v1/__test/error');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toBe('deliberate test error');
    expect(res.body.error.details).toEqual([{ path: 'test', message: 'boom' }]);
  });

  it('masks unexpected errors in non-dev mode', async () => {
    const res = await request(makeApp(true)).get('/api/v1/__test/crash');

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
    expect(res.body.error.message).toBe('Something went wrong');
  });

  it('rejects malformed JSON bodies with a 400 envelope', async () => {
    const res = await request(makeApp())
      .post('/api/v1/health')
      .set('Content-Type', 'application/json')
      .send('{not json');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toBe('Malformed JSON body');
  });
});

describe('CORS', () => {
  it('allows the configured client origin with credentials', async () => {
    const res = await request(makeApp())
      .get('/api/v1/health')
      .set('Origin', 'http://localhost:5173');

    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });
});
