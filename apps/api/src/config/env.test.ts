import { describe, expect, test } from 'bun:test';
import { loadEnv } from './env';

const base = {
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
