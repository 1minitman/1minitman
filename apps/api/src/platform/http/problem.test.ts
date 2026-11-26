import { isProblemCode, problemType, ProblemSchema } from '@1minitman/contracts';
import { createRoute, z } from '@hono/zod-openapi';
import { describe, expect, test } from 'bun:test';
import { HTTPException } from 'hono/http-exception';
import type { Logger } from '../logger';
import { requestContext } from './middleware';
import { ProblemError } from '../errors';
import { buildProblem, errorHandler, notFoundHandler } from './problem';
import { createRouter } from './router';

const echoRoute = createRoute({
  method: 'post',
  path: '/echo/{id}',
  request: {
    params: z.object({ id: z.uuid() }),
    query: z.strictObject({ limit: z.coerce.number().int().min(1).max(100).optional() }),
    body: {
      content: {
        'application/json': {
          schema: z.object({ nickname: z.string().min(3).max(5), age: z.number().int() }),
        },
      },
    },
  },
  responses: { 200: { description: 'ok' } },
});

const ID = '3f1e9d2c-4b5a-4c3d-9e8f-0123456789ab';

/** Records error lines instead of printing them. */
const errorLines: string[] = [];
const recordingLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: (message) => void errorLines.push(message),
  child: () => recordingLogger,
};

const buildApp = () => {
  const app = createRouter();
  app.use('*', requestContext(recordingLogger));
  app.onError(errorHandler);
  app.notFound(notFoundHandler);
  app.openapi(echoRoute, (c) => c.json({ ok: true }, 200));
  app.get('/gated', () => {
    throw new ProblemError('entitlement', { entitlement: 'chat.full', upsell: 'D15?plan=premium' });
  });
  app.get('/locked', () => {
    throw new ProblemError('rate_limited', { retry_after_seconds: 30, detail: 'Slow down' });
  });
  app.get('/http/:status', (c) => {
    throw new HTTPException(Number(c.req.param('status')) as 400);
  });
  app.get('/boom', () => {
    throw new Error('database password is hunter2');
  });
  return app;
};

const send = (path: string, init?: RequestInit) =>
  buildApp().request(path, {
    ...init,
    headers: { 'x-request-id': 'req_12345678', ...init?.headers },
  });

const problemOf = async (res: Response) => {
  expect(res.headers.get('content-type')).toBe('application/problem+json');
  const body = (await res.json()) as Record<string, unknown>;
  const parsed = ProblemSchema.safeParse(body);
  expect(parsed.success).toBe(true);
  expect(body.status).toBe(res.status);
  expect(body.request_id).toBe('req_12345678');
  expect(isProblemCode(body.reason)).toBe(true);
  expect(body.type).toBe(problemType(body.reason as never));
  return body;
};

describe('ProblemError', () => {
  test('takes its status and title from the registry', () => {
    const error = new ProblemError('precondition_failed');
    expect(error.status).toBe(412);
    expect(error.message).toBe('If-Match does not match');
    expect(new ProblemError('not_found', { detail: 'No such photo' }).message).toBe(
      'No such photo',
    );
  });

  test('buildProblem never lets details override the code, path or request id', () => {
    const body = buildProblem('blocked', '/v1/x', 'req_12345678', {
      detail: 'd',
      ...({
        reason: 'internal',
        status: 200,
        title: 'OK',
        type: 'about:blank',
        instance: '/elsewhere',
        request_id: 'x',
      } as object),
    });
    expect(body).toMatchObject({
      reason: 'blocked',
      status: 403,
      title: 'Blocked',
      type: problemType('blocked'),
      detail: 'd',
      instance: '/v1/x',
      request_id: 'req_12345678',
    });
  });
});

describe('problem responses', () => {
  test('an unknown route is not_found with the request id', async () => {
    const body = await problemOf(await send('/v1/nope?email=a@b.co'));
    expect(body).toMatchObject({ reason: 'not_found', status: 404, instance: '/v1/nope' });
  });

  test('a ProblemError carries its extension members', async () => {
    const body = await problemOf(await send('/gated'));
    expect(body).toMatchObject({
      reason: 'entitlement',
      status: 403,
      title: 'Entitlement required',
      entitlement: 'chat.full',
      upsell: 'D15?plan=premium',
    });
  });

  test('retry_after_seconds is mirrored in Retry-After', async () => {
    const res = await send('/locked');
    expect(res.headers.get('retry-after')).toBe('30');
    expect(await problemOf(res)).toMatchObject({ reason: 'rate_limited', detail: 'Slow down' });
  });

  test('an unhandled error is internal, logged, and leaks nothing', async () => {
    errorLines.length = 0;
    const res = await send('/boom');
    expect(errorLines).toEqual(['unhandled error']);
    expect(res.status).toBe(500);
    const body = await problemOf(res);
    expect(body.reason).toBe('internal');
    expect(JSON.stringify(body)).not.toContain('hunter2');
  });

  test.each([
    [400, 'bad_request'],
    [401, 'unauthenticated'],
    [404, 'not_found'],
    [410, 'expired'],
    [412, 'precondition_failed'],
    [413, 'payload_too_large'],
    [415, 'unsupported_media_type'],
    [428, 'precondition_required'],
    [502, 'provider_error'],
    [503, 'dependency_unavailable'],
    [504, 'provider_timeout'],
  ])('HTTPException %d becomes %s', async (status, reason) => {
    const res = await send(`/http/${status}`);
    expect(res.status).toBe(status);
    expect((await problemOf(res)).reason).toBe(reason);
  });

  // 422, 423 and 429 have codes, but those codes must carry a member an HTTPException lacks.
  test.each([403, 422, 423, 429])(
    'an HTTPException %d with no platform code is internal',
    async (status) => {
      const res = await send(`/http/${status}`);
      expect(res.status).toBe(500);
      expect((await problemOf(res)).reason).toBe('internal');
    },
  );
});

describe('validation problems', () => {
  const post = (path: string, body: string) =>
    send(path, { method: 'POST', body, headers: { 'content-type': 'application/json' } });

  test('body fields fail with their field codes', async () => {
    const res = await post(`/echo/${ID}`, JSON.stringify({ nickname: 'abcdef' }));
    expect(res.status).toBe(422);
    const body = await problemOf(res);
    expect(body.reason).toBe('validation');
    expect(body.errors).toEqual([
      { path: 'nickname', code: 'too_long', message: expect.any(String) },
      { path: 'age', code: 'required', message: expect.any(String) },
    ]);
  });

  test('a bad path parameter is invalid_format', async () => {
    const res = await post('/echo/not-a-uuid', JSON.stringify({ nickname: 'abc', age: 1 }));
    expect((await problemOf(res)).errors).toEqual([
      { path: 'id', code: 'invalid_format', message: expect.any(String) },
    ]);
  });

  test('an unknown query field and an out-of-range value are refused', async () => {
    const res = await post(
      `/echo/${ID}?limit=500&sort=name`,
      JSON.stringify({ nickname: 'abc', age: 1 }),
    );
    const errors = (await problemOf(res)).errors as { path: string; code: string }[];
    expect(errors.map(({ path, code }) => ({ path, code }))).toEqual(
      expect.arrayContaining([
        { path: 'limit', code: 'out_of_range' },
        { path: 'sort', code: 'invalid_format' },
      ]),
    );
  });

  test('a body that is not JSON is a problem document, never about:blank', async () => {
    const res = await post(`/echo/${ID}`, '{not json');
    const body = await problemOf(res);
    expect(['bad_request', 'validation']).toContain(body.reason as string);
    expect(body.type).not.toBe('about:blank');
  });

  test('a valid request passes', async () => {
    const res = await post(`/echo/${ID}?limit=5`, JSON.stringify({ nickname: 'abc', age: 30 }));
    expect(res.status).toBe(200);
  });
});
