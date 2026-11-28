import { describe, expect, test } from 'bun:test';
import { loadEnv } from './env';

const base = {
  APP_ENV: 'local',
  DATABASE_URL: 'postgres://member@localhost:5432/minitman',
  ADMIN_DATABASE_URL: 'postgres://admin@localhost:5432/minitman',
  REDIS_URL: 'redis://localhost:6379',
};

describe('loadEnv', () => {
  test('reads the member and admin database URLs separately', () => {
    const env = loadEnv(base);
    expect(env.DATABASE_URL).toBe(base.DATABASE_URL);
    expect(env.ADMIN_DATABASE_URL).toBe(base.ADMIN_DATABASE_URL);
  });

  test('refuses to start without the admin database URL', () => {
    const { ADMIN_DATABASE_URL: _omitted, ...rest } = base;
    expect(() => loadEnv(rest)).toThrow(/ADMIN_DATABASE_URL/);
  });

  test('refuses an admin database URL that is not a URL', () => {
    expect(() => loadEnv({ ...base, ADMIN_DATABASE_URL: 'not a url' })).toThrow(
      /ADMIN_DATABASE_URL/,
    );
  });
});

test('refuses to start without APP_ENV, so a hosted deploy never falls back to local', () => {
  const { APP_ENV: _omitted, ...rest } = base;
  expect(() => loadEnv(rest)).toThrow(/APP_ENV/);
});

describe('ORIGIN_SHARED_SECRET (MOD-00 rule 9)', () => {
  const secret = 'a'.repeat(64);

  test('is optional in local', () => {
    expect(loadEnv(base).ORIGIN_SHARED_SECRET).toBe('');
  });

  test.each(['dev', 'demo', 'staging', 'production'])(
    '%s refuses to start without it or with a short one',
    (APP_ENV) => {
      expect(() => loadEnv({ ...base, APP_ENV })).toThrow(/ORIGIN_SHARED_SECRET/);
      expect(() => loadEnv({ ...base, APP_ENV, ORIGIN_SHARED_SECRET: 'a'.repeat(31) })).toThrow(
        /ORIGIN_SHARED_SECRET/,
      );
      expect(loadEnv({ ...base, APP_ENV, ORIGIN_SHARED_SECRET: secret }).ORIGIN_SHARED_SECRET).toBe(
        secret,
      );
    },
  );
});
