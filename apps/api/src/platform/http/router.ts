import { OpenAPIHono } from '@hono/zod-openapi';
import type { AppEnv } from './context';
import { problemResponse } from './problem';

/**
 * Every module builds its router with this factory so validation failures
 * always come back as problem+json, in the same shape, on every surface.
 */
export const createRouter = () =>
  new OpenAPIHono<AppEnv>({
    defaultHook: (result, c) => {
      if (result.success) return;
      return problemResponse(c, 422, 'Validation failed', {
        reason: 'validation',
        errors: result.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
    },
  });

export type Router = ReturnType<typeof createRouter>;
