import { afterAll, describe, expect, test } from 'bun:test';
import { createRouter } from '../http/router';
import { errorHandler } from '../http/problem';
import { requestContext } from '../http/middleware';
import { createLogger } from '../logger';
import { OutboundTimeoutError, withOutboundTimeout } from './timeout';

// A local server standing in for a vendor: `/slow` sends its headers late, `/slow-body` sends the
// headers at once and the body late.
const vendor = Bun.serve({
  port: 0,
  fetch: async (request) => {
    const path = new URL(request.url).pathname;
    if (path === '/slow') {
      await Bun.sleep(300);
      return Response.json({ ok: true });
    }
    if (path === '/slow-body') {
      const stream = new ReadableStream({
        async start(controller) {
          controller.enqueue(new TextEncoder().encode('{"ok":'));
          await Bun.sleep(300);
          controller.enqueue(new TextEncoder().encode('true}'));
          controller.close();
        },
      });
      return new Response(stream, { headers: { 'content-type': 'application/json' } });
    }
    return Response.json({ ok: true });
  },
});
afterAll(() => vendor.stop(true));
const url = (path: string) => `http://localhost:${vendor.port}${path}`;

describe('withOutboundTimeout', () => {
  test('returns the result of a call that answers in time', async () => {
    const result = await withOutboundTimeout({ provider: 'fake', timeoutMs: 1000 }, (signal) =>
      fetch(url('/fast'), { signal }).then((r) => r.json()),
    );
    expect(result).toEqual({ ok: true });
  });

  test('a vendor that does not answer rejects with OutboundTimeoutError', async () => {
    const started = performance.now();
    const call = withOutboundTimeout({ provider: 'fake', timeoutMs: 50 }, (signal) =>
      fetch(url('/slow'), { signal }),
    );
    await expect(call).rejects.toBeInstanceOf(OutboundTimeoutError);
    expect(performance.now() - started).toBeLessThan(250);
  });

  test('reading a slow body inside the call is bounded too', async () => {
    const call = withOutboundTimeout({ provider: 'fake', timeoutMs: 50 }, async (signal) => {
      const res = await fetch(url('/slow-body'), { signal });
      return res.json();
    });
    await expect(call).rejects.toMatchObject({ code: 'provider_timeout', provider: 'fake' });
  });

  test('work that ignores the signal still settles at the deadline', async () => {
    let aborted = false;
    const call = withOutboundTimeout({ provider: 'sdk', timeoutMs: 20 }, (signal) => {
      signal.addEventListener('abort', () => (aborted = true));
      return new Promise<never>(() => undefined);
    });
    await expect(call).rejects.toBeInstanceOf(OutboundTimeoutError);
    expect(aborted).toBe(true);
  });

  test('another failure passes through unchanged', async () => {
    const failure = new Error('connection refused');
    const call = withOutboundTimeout({ provider: 'fake', timeoutMs: 1000 }, () =>
      Promise.reject(failure),
    );
    await expect(call).rejects.toBe(failure);
  });

  test.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'refuses a timeout of %p: no call runs without a limit',
    async (timeoutMs) => {
      let ran = false;
      const call = withOutboundTimeout({ provider: 'fake', timeoutMs }, () => {
        ran = true;
        return Promise.resolve(1);
      });
      await expect(call).rejects.toThrow(/positive timeout/);
      expect(ran).toBe(false);
    },
  );

  test('an unhandled timeout is a 504 provider_timeout problem', async () => {
    const app = createRouter();
    app.onError(errorHandler);
    app.use('*', requestContext(createLogger('error')));
    app.get('/', async (c) => {
      await withOutboundTimeout({ provider: 'fake', timeoutMs: 20 }, (signal) =>
        fetch(url('/slow'), { signal }),
      );
      return c.text('unreachable');
    });
    const res = await app.request('/');
    expect(res.status).toBe(504);
    expect(await res.json()).toMatchObject({
      reason: 'provider_timeout',
      detail: 'fake did not answer within 20 ms',
    });
  });
});
