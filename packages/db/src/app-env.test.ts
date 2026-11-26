import { describe, expect, test } from 'bun:test';
import { AppEnvMismatchError, assertAppEnv, createDatabase } from './client';

// Start-up check for TRX-056, on PostgreSQL 16 (`pnpm services:up && pnpm db:migrate && pnpm db:roles`).
// The local login roles carry no app.env role setting, so a session `SET` stands in for one.
const url = process.env.ADMIN_DATABASE_URL;

describe.skipIf(!url)('assertAppEnv at start-up', () => {
  const open = (appEnv: string) =>
    createDatabase({ url: url ?? '', surface: 'admin', appEnv, max: 1 });

  test('production refuses a login that does not report production', async () => {
    const prod = open('production');
    try {
      await expect(assertAppEnv(prod)).rejects.toBeInstanceOf(AppEnvMismatchError);
    } finally {
      await prod.close();
    }
  });

  test('production passes when the login reports production', async () => {
    const prod = open('production');
    try {
      await prod.sql`SET app.env = 'production'`;
      expect(await assertAppEnv(prod)).toBe('production');
    } finally {
      await prod.close();
    }
  });

  test('other environments are not checked', async () => {
    const staging = open('staging');
    try {
      expect(await assertAppEnv(staging)).toBe('development');
    } finally {
      await staging.close();
    }
  });
});
