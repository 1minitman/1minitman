import {
  createDatabase,
  updateIfMatch,
  versionToken,
  withAdminTx,
  type ConditionalUpdate,
} from '@1minitman/db';
import { remoteConfig } from '@1minitman/db/schema';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { eq, like } from 'drizzle-orm';
import { requestContext } from '../http/middleware';
import { errorHandler } from '../http/problem';
import { createRouter } from '../http/router';
import { createLogger } from '../logger';
import { etagOf, expectedVersion, requireIfMatch, setETag, settleConditionalWrite } from './index';

// MOD-00 plan rule 8: a write with a stale If-Match changes nothing and returns 412; a write with
// none is 428 (1MM-STD-13). Unit tests over an in-memory row, then the same routes over the real
// updateIfMatch() on the local PostgreSQL.

interface Row {
  value: string;
  version: number;
}

/** A versioned row held in memory, with the same outcomes as updateIfMatch(). */
const memoryRow = () => {
  const rows = new Map<string, Row>([['a', { value: 'one', version: 1 }]]);
  return {
    rows,
    read: (id: string) => rows.get(id),
    update: (id: string, expected: string, value: string): ConditionalUpdate => {
      const row = rows.get(id);
      if (!row) return { outcome: 'missing' };
      if (String(row.version) !== expected) return { outcome: 'stale', token: String(row.version) };
      row.value = value;
      row.version += 1;
      return { outcome: 'updated', token: String(row.version) };
    },
  };
};

const appWith = (store: {
  read: (
    id: string,
  ) =>
    | { value: unknown; token: string }
    | undefined
    | Promise<{ value: unknown; token: string } | undefined>;
  update: (
    id: string,
    expected: string,
    value: string,
  ) => ConditionalUpdate | Promise<ConditionalUpdate>;
}) => {
  const app = createRouter();
  app.use('*', requestContext(createLogger('error')));
  app.onError(errorHandler);
  app.get('/things/:id', async (c) => {
    const row = await store.read(c.req.param('id'));
    if (!row) return c.json({}, 404);
    setETag(c, row.token);
    return c.json({ value: row.value });
  });
  app.put('/things/:id', requireIfMatch(), async (c) => {
    const { value } = await c.req.json<{ value: string }>();
    const result = await store.update(c.req.param('id'), expectedVersion(c), value);
    settleConditionalWrite(c, result);
    return c.json({ value });
  });
  return app;
};

const put = (
  app: ReturnType<typeof appWith>,
  ifMatch: string | undefined,
  value: string,
  id = 'a',
) =>
  app.request(`/things/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(ifMatch === undefined ? {} : { 'If-Match': ifMatch }),
    },
    body: JSON.stringify({ value }),
  });

describe('If-Match over an in-memory row', () => {
  const setup = () => {
    const mem = memoryRow();
    const app = appWith({
      read: (id) => {
        const row = mem.read(id);
        return row && { value: row.value, token: String(row.version) };
      },
      update: mem.update,
    });
    return { mem, app };
  };

  test('a read sends the version as a strong ETag', async () => {
    const { app } = setup();
    const res = await app.request('/things/a');
    expect(res.headers.get('ETag')).toBe('"1"');
  });

  test('a write with the current tag succeeds and returns the new ETag', async () => {
    const { app, mem } = setup();
    const res = await put(app, '"1"', 'two');
    expect(res.status).toBe(200);
    expect(res.headers.get('ETag')).toBe('"2"');
    expect(mem.rows.get('a')).toEqual({ value: 'two', version: 2 });
  });

  test('a stale tag is 412 precondition_failed and changes nothing', async () => {
    const { app, mem } = setup();
    await put(app, '"1"', 'two');
    const res = await put(app, '"1"', 'three');
    expect(res.status).toBe(412);
    expect(res.headers.get('Content-Type')).toBe('application/problem+json');
    const body = (await res.json()) as { reason: string; request_id: string };
    expect(body.reason).toBe('precondition_failed');
    expect(body.request_id).toBeString();
    expect(res.headers.get('ETag')).toBeNull();
    expect(mem.rows.get('a')).toEqual({ value: 'two', version: 2 });
  });

  test('a missing If-Match is 428 precondition_required and the handler never runs', async () => {
    const { app, mem } = setup();
    for (const header of [undefined, '', '   ']) {
      const res = await put(app, header, 'x');
      expect(res.status).toBe(428);
      expect(((await res.json()) as { reason: string }).reason).toBe('precondition_required');
    }
    expect(mem.rows.get('a')?.version).toBe(1);
  });

  test.each(['1', '*', '"1", "2"', '"a b"'])('If-Match %p is 422 on if-match', async (header) => {
    const { app, mem } = setup();
    const res = await put(app, header, 'x');
    expect(res.status).toBe(422);
    const body = (await res.json()) as { reason: string; errors: { path: string }[] };
    expect(body.reason).toBe('validation');
    expect(body.errors[0]?.path).toBe('if-match');
    expect(mem.rows.get('a')?.version).toBe(1);
  });

  test('a weak tag never matches (strong comparison): 412', async () => {
    const { app, mem } = setup();
    const res = await put(app, 'W/"1"', 'x');
    expect(res.status).toBe(412);
    expect(mem.rows.get('a')?.version).toBe(1);
  });

  test('a write to a row that does not exist is 404', async () => {
    const { app } = setup();
    const res = await put(app, '"1"', 'x', 'nope');
    expect(res.status).toBe(404);
  });

  test('expectedVersion without requireIfMatch is a programming error', () => {
    const c = { get: () => undefined } as unknown as Parameters<typeof expectedVersion>[0];
    expect(() => expectedVersion(c)).toThrow('requireIfMatch');
  });

  test('etagOf quotes a token', () => {
    expect(etagOf('1764151200123456')).toBe('"1764151200123456"');
  });
});

const adminUrl = process.env.ADMIN_DATABASE_URL;
const ci = !['', 'false', '0'].includes(process.env.CI?.trim().toLowerCase() ?? '');
if (ci && !adminUrl) throw new Error('If-Match tests need ADMIN_DATABASE_URL in CI');

describe.skipIf(!adminUrl)('If-Match over remote_config on PostgreSQL', () => {
  const admin = adminUrl
    ? createDatabase({ url: adminUrl, surface: 'admin', appEnv: 'staging', max: 2 })
    : null;
  const key = `test.api04_http_${crypto.randomUUID().replaceAll('-', '').slice(0, 10)}`;
  const version = { column: remoteConfig.version, kind: 'version' } as const;

  beforeAll(async () => {
    await admin!.db.insert(remoteConfig).values({
      key,
      value: 'one',
      valueType: 'string',
      description: 'MOD-00-API-04 If-Match HTTP test, deleted afterwards',
    });
  });
  afterAll(async () => {
    await admin!.db.delete(remoteConfig).where(like(remoteConfig.key, 'test.api04_http_%'));
    await admin!.close();
  });

  const app = appWith({
    read: async (id) =>
      (
        await admin!.db
          .select({ value: remoteConfig.value, token: versionToken(version) })
          .from(remoteConfig)
          .where(eq(remoteConfig.key, id))
      )[0],
    update: (id, expected, value) =>
      withAdminTx(admin!, (tx) =>
        updateIfMatch(tx, {
          table: remoteConfig,
          id: remoteConfig.key,
          idValue: id,
          version,
          expected,
          set: { value },
        }),
      ),
  });

  test('read, write with the tag, then a stale write is 412 and the row keeps the first write', async () => {
    const tag = (await app.request(`/things/${key}`)).headers.get('ETag')!;
    const first = await put(app, tag, 'two', key);
    expect(first.status).toBe(200);
    const stale = await put(app, tag, 'three', key);
    expect(stale.status).toBe(412);
    const read = await app.request(`/things/${key}`);
    expect(await read.json()).toEqual({ value: 'two' });
    expect(read.headers.get('ETag')).toBe(first.headers.get('ETag'));
  });
});
