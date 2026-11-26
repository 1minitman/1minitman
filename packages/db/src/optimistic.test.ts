import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { eq, like } from 'drizzle-orm';
import { createDatabase, type Database } from './client';
import { isVersionToken, updateIfMatch, versionToken, type RowVersion } from './optimistic';
import { rateLimitPolicies, remoteConfig } from './schema';
import { databaseReady } from './test-env';
import { withAdminTx } from './transactions';

// MOD-00 plan rule 8: a write with a stale version changes nothing. Behaviour tests on
// PostgreSQL 16 against two real tables, one versioned by `updated_at` (rate_limit_policies) and
// one by `version` (remote_config), including writers on parallel connections [1MM-STD-16 §5].
// Rows use a `test.api04_*` key and are deleted afterwards; seeded rows are never touched.

describe('isVersionToken', () => {
  test.each([
    ['updated_at', '1764151200123456', true],
    ['updated_at', '1234567890123456789', false],
    ['updated_at', '-5', false],
    ['updated_at', '12a', false],
    ['version', '2147483647', true],
    ['version', '2147483648', false],
    ['version', '', false],
  ] as const)('%s %p is %p', (kind, token, expected) => {
    expect(isVersionToken(kind, token)).toBe(expected);
  });
});

const url = process.env.ADMIN_DATABASE_URL;
const ready = databaseReady({ ADMIN_DATABASE_URL: url });
const PARALLEL = 5;

describe.skipIf(!ready)('updateIfMatch on PostgreSQL', () => {
  let admin: Database;
  const suffix = crypto.randomUUID().replaceAll('-', '').slice(0, 10);
  const policyKey = `test.api04_rlp_${suffix}`;
  const configKey = `test.api04_rc_${suffix}`;
  const byUpdatedAt: RowVersion = { column: rateLimitPolicies.updatedAt, kind: 'updated_at' };
  const byVersion: RowVersion = { column: remoteConfig.version, kind: 'version' };

  beforeAll(async () => {
    admin = createDatabase({
      url: url ?? '',
      surface: 'admin',
      appEnv: 'staging',
      max: PARALLEL,
      applicationName: 'db-tests',
    });
    await admin.db.insert(rateLimitPolicies).values({
      key: policyKey,
      scope: 'ip',
      maxRequests: 3,
      windowSeconds: 60,
      appliesTo: 'test only',
      description: 'MOD-00-API-04 If-Match test, deleted afterwards',
    });
    await admin.db.insert(remoteConfig).values({
      key: configKey,
      value: 1,
      valueType: 'int',
      description: 'MOD-00-API-04 If-Match test, deleted afterwards',
    });
  });
  afterAll(async () => {
    await admin.db.delete(rateLimitPolicies).where(like(rateLimitPolicies.key, 'test.api04_%'));
    await admin.db.delete(remoteConfig).where(like(remoteConfig.key, 'test.api04_%'));
    await admin.close();
  });

  const policyToken = async () =>
    (
      await admin.db
        .select({ token: versionToken(byUpdatedAt), max: rateLimitPolicies.maxRequests })
        .from(rateLimitPolicies)
        .where(eq(rateLimitPolicies.key, policyKey))
    )[0]!;
  const configRow = async () =>
    (
      await admin.db
        .select({ token: versionToken(byVersion), value: remoteConfig.value })
        .from(remoteConfig)
        .where(eq(remoteConfig.key, configKey))
    )[0]!;

  const updatePolicy = (expected: string, maxRequests: number) =>
    withAdminTx(admin, (tx) =>
      updateIfMatch(tx, {
        table: rateLimitPolicies,
        id: rateLimitPolicies.key,
        idValue: policyKey,
        version: byUpdatedAt,
        expected,
        set: { maxRequests },
      }),
    );
  const updateConfig = (expected: string, value: number, idValue = configKey) =>
    withAdminTx(admin, (tx) =>
      updateIfMatch(tx, {
        table: remoteConfig,
        id: remoteConfig.key,
        idValue,
        version: byVersion,
        expected,
        set: { value },
      }),
    );

  test('updated_at: the token is the full microsecond value, not a rounded Date', async () => {
    const { token } = await policyToken();
    expect(token).toMatch(/^\d{16}$/);
  });

  test('updated_at: a current token updates and returns the new token', async () => {
    const before = await policyToken();
    const result = await updatePolicy(before.token, 4);
    expect(result.outcome).toBe('updated');
    const after = await policyToken();
    expect(after.max).toBe(4);
    expect(result).toEqual({ outcome: 'updated', token: after.token });
    expect(after.token).not.toBe(before.token);
  });

  test('updated_at: a stale token changes nothing and reports the current token', async () => {
    const stale = (await policyToken()).token;
    await updatePolicy(stale, 5);
    const current = await policyToken();
    const result = await updatePolicy(stale, 99);
    expect(result).toEqual({ outcome: 'stale', token: current.token });
    expect((await policyToken()).max).toBe(5);
  });

  test('updated_at: a token one microsecond off is stale', async () => {
    const { token } = await policyToken();
    const result = await updatePolicy(String(BigInt(token) + 1n), 77);
    expect(result.outcome).toBe('stale');
    expect((await policyToken()).max).not.toBe(77);
  });

  test('version: a current token increments the version', async () => {
    const before = await configRow();
    const result = await updateConfig(before.token, 2);
    expect(result).toEqual({ outcome: 'updated', token: String(Number(before.token) + 1) });
    expect(await configRow()).toEqual({
      token: result.outcome === 'updated' ? result.token : '',
      value: 2,
    });
  });

  test('version: a stale or malformed token changes nothing', async () => {
    const current = await configRow();
    for (const expected of ['0', 'abc', '99999999999', '"1"']) {
      expect(await updateConfig(expected, 42)).toEqual({ outcome: 'stale', token: current.token });
    }
    expect(await configRow()).toEqual(current);
  });

  test('a missing row is reported as missing', async () => {
    expect(await updateConfig('1', 3, `test.api04_none_${suffix}`)).toEqual({ outcome: 'missing' });
  });

  test('parallel writers holding one token: exactly one wins', async () => {
    const { token } = await configRow();
    const results = await Promise.all(
      Array.from({ length: PARALLEL }, (_, i) => updateConfig(token, 100 + i)),
    );
    const winners = results.filter((r) => r.outcome === 'updated');
    expect(winners).toHaveLength(1);
    expect(results.filter((r) => r.outcome === 'stale')).toHaveLength(PARALLEL - 1);
    expect((await configRow()).token).toBe(String(Number(token) + 1));
  });

  test('parallel writers on updated_at: exactly one wins', async () => {
    const { token } = await policyToken();
    const results = await Promise.all(
      Array.from({ length: PARALLEL }, (_, i) => updatePolicy(token, 10 + i)),
    );
    expect(results.filter((r) => r.outcome === 'updated')).toHaveLength(1);
  });

  test('an empty change is refused before any query', async () => {
    await expect(
      withAdminTx(admin, (tx) =>
        updateIfMatch(tx, {
          table: rateLimitPolicies,
          id: rateLimitPolicies.key,
          idValue: policyKey,
          version: byUpdatedAt,
          expected: '1',
          set: {},
        }),
      ),
    ).rejects.toThrow('at least one column');
  });
});
