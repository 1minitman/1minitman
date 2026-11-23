import { createMiddleware } from 'hono/factory';
import type { Logger } from '../logger';
import type { AppEnv } from './context';

const REQUEST_ID = /^[A-Za-z0-9_-]{8,64}$/;

/** A request id on every response and log line. A well-formed inbound id is kept. */
export const requestContext = (logger: Logger) =>
  createMiddleware<AppEnv>(async (c, next) => {
    const inbound = c.req.header('x-request-id');
    const requestId = inbound && REQUEST_ID.test(inbound) ? inbound : crypto.randomUUID();
    c.set('requestId', requestId);
    c.set('logger', logger.child({ request_id: requestId }));
    c.header('X-Request-Id', requestId);

    const started = performance.now();
    await next();
    // Path only: query strings can carry personal data.
    c.get('logger').info('request', {
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      duration_ms: Math.round(performance.now() - started),
    });
  });
