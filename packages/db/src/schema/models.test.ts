import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { and, eq, sql } from 'drizzle-orm';
import { createDatabase, type Database } from '../client';
import { databaseReady } from '../test-env';
import { type Tx, withAdminTx } from '../transactions';
import { featureFlags, remoteConfig } from './index';

// Each Drizzle model reads and writes its table on PostgreSQL 16 [1MM-STD-01 §3.3 Models], and a
// versioned update holds under parallel connections [1MM-STD-01 §3.1, If-Match update] [TR §17.3].
// The admin login is used with app.env = staging, where config writes need no approval [SQL].
// Every row is synthetic: written in a transaction that is rolled back, or deleted afterwards.
const url = process.env.ADMIN_DATABASE_URL;
const ready = databaseReady({ ADMIN_DATABASE_URL: url });
const PARALLEL = 5;

describe.skipIf(!ready)('Drizzle models on PostgreSQL', () => {
  let admin: Database;
  const suffix = crypto.randomUUID().slice(0, 8);

  /** Runs `fn` in an admin transaction, rolls it back and returns what `fn` returned. */
  class Rollback<T> extends Error {
    constructor(readonly value: T) {
      super('roll back the test rows');
    }
  }
  const rolledBack = <T>(fn: (tx: Tx) => Promise<T>): Promise<T> =>
    withAdminTx(admin, async (tx) => {
      throw new Rollback(await fn(tx));
    }).catch((e: unknown) => {
      if (e instanceof Rollback) return e.value as T;
      throw e;
    });

  beforeAll(() => {
    admin = createDatabase({
      url: url ?? '',
      surface: 'admin',
      appEnv: 'staging',
      max: PARALLEL,
      applicationName: 'db-tests',
    });
  });
  afterAll(() => admin.close());

  test('remote_config: insert, read back with defaults, update', async () => {
    const key = `test.db02_model_${suffix}`;
    const seen = await rolledBack(async (tx) => {
      await tx.insert(remoteConfig).values({
        key,
        value: { limit: 3 },
        valueType: 'json',
        description: 'MOD-00-DB-02 model test, rolled back',
      });
      const [inserted] = await tx.select().from(remoteConfig).where(eq(remoteConfig.key, key));
      const [updated] = await tx
        .update(remoteConfig)
        .set({ value: { limit: 4 }, version: sql`${remoteConfig.version} + 1` })
        .where(eq(remoteConfig.key, key))
        .returning();
      return { inserted, updated };
    });

    expect(seen.inserted).toMatchObject({
      key,
      value: { limit: 3 },
      valueType: 'json',
      isPublic: false,
      version: 1,
      permissionKey: 'config.remote',
      approvalId: null,
      unit: null,
    });
    expect(seen.inserted?.updatedAt).toBeInstanceOf(Date);
    expect(seen.updated).toMatchObject({ key, value: { limit: 4 }, version: 2 });
    expect(await admin.db.select().from(remoteConfig).where(eq(remoteConfig.key, key))).toEqual(
      [],
    );
  });

  test('feature_flags: insert, read back with defaults, update', async () => {
    const key = `test.db02_flag_${suffix}`;
    const seen = await rolledBack(async (tx) => {
      await tx.insert(featureFlags).values({ key, description: 'MOD-00-DB-02, rolled back' });
      const [inserted] = await tx.select().from(featureFlags).where(eq(featureFlags.key, key));
      const [updated] = await tx
        .update(featureFlags)
        .set({ enabled: true, rolloutPercent: 50, rules: { country: ['NG'] } })
        .where(eq(featureFlags.key, key))
        .returning();
      return { inserted, updated };
    });

    expect(seen.inserted).toMatchObject({
      key,
      enabled: false,
      rolloutPercent: 0,
      rules: {},
      isKillSwitch: false,
    });
    expect(seen.updated).toMatchObject({ enabled: true, rolloutPercent: 50, rules: { country: ['NG'] } });
  });

  describe('a versioned update under parallel connections', () => {
    const key = `test.db02_version_${suffix}`;

    beforeAll(() =>
      withAdminTx(admin, (tx) =>
        tx.insert(remoteConfig).values({
          key,
          value: 0,
          valueType: 'int',
          description: 'MOD-00-DB-02 parallel test, deleted afterwards',
        }),
      ),
    );
    afterAll(() =>
      withAdminTx(admin, (tx) => tx.delete(remoteConfig).where(eq(remoteConfig.key, key))),
    );

    test(`${PARALLEL} writers with the same version: exactly one wins`, async () => {
      // Every transaction is open on its own connection before any of them writes.
      let arrived = 0;
      let release: () => void = () => {};
      const allOpen = new Promise<void>((resolve) => (release = resolve));
      const write = (writer: number) =>
        withAdminTx(admin, async (tx) => {
          const [ctx] = (await tx.execute(sql`SELECT pg_backend_pid() AS pid`)) as unknown as {
            pid: number;
          }[];
          arrived += 1;
          if (arrived === PARALLEL) release();
          await allOpen;
          const changed = await tx
            .update(remoteConfig)
            .set({ value: writer, version: sql`${remoteConfig.version} + 1` })
            .where(and(eq(remoteConfig.key, key), eq(remoteConfig.version, 1)))
            .returning({ version: remoteConfig.version });
          return { pid: ctx?.pid, changed: changed.length };
        });

      const results = await Promise.all(Array.from({ length: PARALLEL }, (_, i) => write(i + 1)));
      expect(new Set(results.map((r) => r.pid)).size).toBe(PARALLEL);
      expect(results.map((r) => r.changed).sort()).toEqual([0, 0, 0, 0, 1]);

      const winner = results.findIndex((r) => r.changed === 1) + 1;
      const [row] = await admin.db
        .select({ value: remoteConfig.value, version: remoteConfig.version })
        .from(remoteConfig)
        .where(eq(remoteConfig.key, key));
      expect(row).toEqual({ value: winner, version: 2 });
    });
  });
});
