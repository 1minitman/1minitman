import { afterAll, describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import { createDatabase } from '../client';
import { featureFlags, remoteConfig } from './index';

// Integration tests: need the local database (`pnpm services:up && pnpm db:migrate`).
const url = process.env.DATABASE_URL;
const database = url ? createDatabase({ url, max: 1, applicationName: 'db-tests' }) : null;
afterAll(() => database?.close());

describe.skipIf(!database)('schema v3.4 seeds, read through the models', () => {
  test('daily spec caps are 25 and 50 (OD-03)', async () => {
    const rows = await database!.db
      .select({ key: remoteConfig.key, value: remoteConfig.value })
      .from(remoteConfig);
    const byKey = new Map(rows.map((row) => [row.key, row.value]));
    expect(byKey.get('discovery.daily_cap.basic')).toBe(25);
    expect(byKey.get('discovery.daily_cap.verified_free')).toBe(50);
    expect(byKey.get('intro.window_hours')).toBe(24);
  });

  test('offers are off at launch (OD-01)', async () => {
    const [flag] = await database!.db
      .select()
      .from(featureFlags)
      .where(eq(featureFlags.key, 'offers.enabled'));
    expect(flag?.enabled).toBe(false);
  });
});
