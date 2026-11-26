import { z } from 'zod';
import { FIELD_CODES, PROBLEM_CODE_PATTERN } from '../errors/registry';

/** One failed field inside a `validation` problem (1MM-STD-13 section 2.1). */
export const FieldErrorSchema = z.object({
  /** Dotted field path, for example `profile.nickname`. Empty for the whole body. */
  path: z.string(),
  code: z.enum(FIELD_CODES),
  /** The zod message: English, for developers. Clients show `error.field.<code>`. */
  message: z.string(),
});
export type FieldError = z.infer<typeof FieldErrorSchema>;

/**
 * RFC 9457 problem+json. Every error the API returns has this shape (1MM-STD-13 section 2.1).
 * `reason` is the error code from the registry; clients branch on it alone. It is validated by
 * pattern, not by enum, so a client keeps working when a later API adds a code.
 */
export const ProblemSchema = z
  .object({
    type: z.string(),
    title: z.string(),
    status: z.number().int().min(400).max(599),
    detail: z.string().optional(),
    instance: z.string(),
    request_id: z.string(),
    reason: z.string().regex(PROBLEM_CODE_PATTERN),
    errors: z.array(FieldErrorSchema).optional(),
    entitlement: z.string().optional(),
    upsell: z.string().optional(),
    permission: z.string().optional(),
    retry_after_seconds: z.number().int().nonnegative().optional(),
    until: z.iso.datetime().optional(),
    tries_left: z.number().int().nonnegative().optional(),
    limit: z.number().int().nonnegative().optional(),
    used: z.number().int().nonnegative().optional(),
  })
  .meta({ id: 'Problem' });
export type Problem = z.infer<typeof ProblemSchema>;

/** The extension members a handler may pass when it raises a problem. */
export type ProblemExtensions = Partial<
  Pick<
    Problem,
    | 'errors'
    | 'entitlement'
    | 'upsell'
    | 'permission'
    | 'retry_after_seconds'
    | 'until'
    | 'tries_left'
    | 'limit'
    | 'used'
  >
>;
