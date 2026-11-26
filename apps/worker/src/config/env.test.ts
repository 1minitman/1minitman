import { expect, test } from 'bun:test';
import { loadEnv } from './env';

const base = {
  WORKER_DATABASE_URL: 'postgres://worker@localhost:5432/db',
  QUEUE_DATABASE_URL: 'postgres://queue@localhost:5432/db',
};

test('defaults apply and an empty Sentry DSN turns reporting off', () => {
  const env = loadEnv({ ...base, SENTRY_DSN_WORKER: '  ' });
  expect(env.APP_ENV).toBe('local');
  expect(env.APP_VERSION).toBe('0.1.0');
  expect(env.LOG_LEVEL).toBe('info');
  expect(env.SENTRY_DSN_WORKER).toBeUndefined();
});

test('a Sentry DSN is kept when it is a URL', () => {
  const dsn = 'https://key@sentry.example.invalid/1';
  expect(loadEnv({ ...base, SENTRY_DSN_WORKER: dsn }).SENTRY_DSN_WORKER).toBe(dsn);
});

test('an invalid setting is refused with its name', () => {
  expect(() => loadEnv({ ...base, SENTRY_DSN_WORKER: 'not a url' })).toThrow(/SENTRY_DSN_WORKER/);
  expect(() => loadEnv({ QUEUE_DATABASE_URL: base.QUEUE_DATABASE_URL })).toThrow(
    /WORKER_DATABASE_URL/,
  );
});
