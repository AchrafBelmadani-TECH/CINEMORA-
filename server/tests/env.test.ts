import { describe, expect, it } from 'vitest';
import { EnvValidationError, parseEnv } from '../src/lib/env.js';

describe('parseEnv', () => {
  it('requires a JWT secret', () => {
    expect(() => parseEnv({})).toThrow(EnvValidationError);
  });

  it('applies safe defaults to a minimal environment', () => {
    const e = parseEnv({ JWT_SECRET: 'x'.repeat(32), });
    expect(e.NODE_ENV).toBe('development');
    expect(e.PORT).toBe(3000);
    expect(e.LOG_LEVEL).toBe('info');
    expect(e.CLIENT_ORIGIN).toBe('http://localhost:5173');
    expect(e.STORAGE_DRIVER).toBe('local');
    expect(e.STORAGE_ROOT).toBe('./storage');
  });

  it('coerces PORT from a string', () => {
    expect(parseEnv({ JWT_SECRET: 'x'.repeat(32),  PORT: '4000' }).PORT).toBe(4000);
  });

  it('rejects an out-of-range PORT', () => {
    expect(() => parseEnv({ JWT_SECRET: 'x'.repeat(32),  PORT: '99999' })).toThrow(EnvValidationError);
    expect(() => parseEnv({ JWT_SECRET: 'x'.repeat(32),  PORT: '0' })).toThrow(EnvValidationError);
  });

  it('rejects a non-numeric PORT', () => {
    expect(() => parseEnv({ JWT_SECRET: 'x'.repeat(32),  PORT: 'not-a-number' })).toThrow(EnvValidationError);
  });

  it('rejects an unknown NODE_ENV', () => {
    expect(() => parseEnv({ JWT_SECRET: 'x'.repeat(32),  NODE_ENV: 'staging' })).toThrow(EnvValidationError);
  });

  it('rejects a short JWT_SECRET when one is provided', () => {
    expect(() => parseEnv({ JWT_SECRET: 'x'.repeat(32),  JWT_SECRET: 'too-short' })).toThrow(EnvValidationError);
    const ok = parseEnv({ JWT_SECRET: 'x'.repeat(32),  JWT_SECRET: 'a'.repeat(32) });
    expect(ok.JWT_SECRET).toHaveLength(32);
  });

  it('rejects an invalid CLIENT_ORIGIN', () => {
    expect(() => parseEnv({ JWT_SECRET: 'x'.repeat(32),  CLIENT_ORIGIN: 'not a url' })).toThrow(EnvValidationError);
  });

  it('reports all offending keys at once', () => {
    try {
      parseEnv({ JWT_SECRET: 'x'.repeat(32),  PORT: 'bad', NODE_ENV: 'nope' });
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(EnvValidationError);
      const paths = (err as EnvValidationError).issues.map((i) => i.path.join('.')).sort();
      expect(paths).toEqual(['NODE_ENV', 'PORT']);
    }
  });
});
