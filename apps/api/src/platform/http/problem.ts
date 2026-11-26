import { PROBLEM_CODES, problemType, type Problem, type ProblemCode } from '@1minitman/contracts';
import { PROBLEM_CONTENT_TYPE } from '@1minitman/contracts/routes';
import type { Context, ErrorHandler, NotFoundHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { ProblemError, type ProblemDetails } from '../errors';
import type { AppEnv } from './context';

/** Builds the problem document for a registry code (1MM-STD-13 section 2.1). */
export const buildProblem = (
  code: ProblemCode,
  instance: string,
  requestId: string,
  details: ProblemDetails = {},
): Problem => {
  const { status, title } = PROBLEM_CODES[code];
  return {
    type: problemType(code),
    title,
    status,
    ...details,
    instance,
    request_id: requestId,
    reason: code,
  };
};

/** Writes `application/problem+json`; `instance` is the path without the query string. */
export const problemResponse = (
  c: Context<AppEnv>,
  code: ProblemCode,
  details: ProblemDetails = {},
) => {
  const body = buildProblem(code, c.req.path, c.get('requestId'), details);
  const headers: Record<string, string> = { 'Content-Type': PROBLEM_CONTENT_TYPE };
  if (body.retry_after_seconds !== undefined) {
    headers['Retry-After'] = String(body.retry_after_seconds);
  }
  return c.body(JSON.stringify(body), body.status as ContentfulStatusCode, headers);
};

/**
 * Hono raises HTTPException for conditions it detects itself (a body over the limit, a body
 * that is not JSON). Each status maps to the platform code for that condition.
 */
const HTTP_EXCEPTION_CODES: Partial<Record<number, ProblemCode>> = {
  400: 'bad_request',
  401: 'unauthenticated',
  404: 'not_found',
  410: 'expired',
  412: 'precondition_failed',
  413: 'payload_too_large',
  415: 'unsupported_media_type',
  422: 'validation',
  423: 'locked',
  428: 'precondition_required',
  429: 'rate_limited',
  502: 'provider_error',
  503: 'dependency_unavailable',
  504: 'provider_timeout',
};

export const notFoundHandler: NotFoundHandler<AppEnv> = (c) => problemResponse(c, 'not_found');

export const errorHandler: ErrorHandler<AppEnv> = (error, c) => {
  if (error instanceof ProblemError) return problemResponse(c, error.code, error.details);
  if (error instanceof HTTPException) {
    const code = HTTP_EXCEPTION_CODES[error.status];
    if (code) return problemResponse(c, code);
  }
  c.get('logger').error('unhandled error', { error: error.message, stack: error.stack });
  return problemResponse(c, 'internal');
};
