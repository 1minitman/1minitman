import type { Problem } from '@1minitman/contracts';
import type { Context, ErrorHandler, NotFoundHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { AppEnv } from './context';

/**
 * Domain and application code throws ProblemError; the HTTP layer turns it into
 * RFC 9457 problem+json with the request id (Technical Reference 8.1).
 */
export class ProblemError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly title: string,
    readonly extra: { detail?: string; reason?: string; type?: string } & Record<
      string,
      unknown
    > = {},
  ) {
    super(title);
  }
}

export const problemResponse = (
  c: Context<AppEnv>,
  status: ContentfulStatusCode,
  title: string,
  extra: Record<string, unknown> = {},
) => {
  const body: Problem & Record<string, unknown> = {
    type: 'about:blank',
    title,
    status,
    instance: c.req.path,
    request_id: c.get('requestId'),
    ...extra,
  };
  return c.body(JSON.stringify(body), status, { 'Content-Type': 'application/problem+json' });
};

export const notFoundHandler: NotFoundHandler<AppEnv> = (c) => problemResponse(c, 404, 'Not found');

export const errorHandler: ErrorHandler<AppEnv> = (error, c) => {
  if (error instanceof ProblemError)
    return problemResponse(c, error.status, error.title, error.extra);
  if (error instanceof HTTPException) return problemResponse(c, error.status, error.message);
  c.get('logger').error('unhandled error', { error: error.message, stack: error.stack });
  return problemResponse(c, 500, 'Something went wrong');
};
