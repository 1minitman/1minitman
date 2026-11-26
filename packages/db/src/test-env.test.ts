import { describe, expect, test } from 'bun:test';
import { databaseReady } from './test-env';

describe('database tests skip locally but fail in CI without their URLs (GAP-STD01-09)', () => {
  const set = { DATABASE_URL: 'postgres://x@127.0.0.1/db', ADMIN_DATABASE_URL: 'postgres://y' };

  test('every URL set: ready, with or without CI', () => {
    expect(databaseReady(set, {})).toBe(true);
    expect(databaseReady(set, { CI: 'true' })).toBe(true);
  });

  test('a URL missing away from CI: not ready, so the suite skips', () => {
    expect(databaseReady({ ...set, ADMIN_DATABASE_URL: undefined }, {})).toBe(false);
    expect(databaseReady({ DATABASE_URL: '' }, { CI: '' })).toBe(false);
    expect(databaseReady({ DATABASE_URL: undefined }, { CI: 'false' })).toBe(false);
    expect(databaseReady({ DATABASE_URL: undefined }, { CI: '0' })).toBe(false);
  });

  test('a URL missing in CI: throws and names every missing variable', () => {
    for (const ci of ['true', '1', 'TRUE', 'yes']) {
      expect(() =>
        databaseReady({ DATABASE_URL: undefined, ADMIN_DATABASE_URL: '', X: 'ok' }, { CI: ci }),
      ).toThrow(/DATABASE_URL, ADMIN_DATABASE_URL/);
    }
  });
});
