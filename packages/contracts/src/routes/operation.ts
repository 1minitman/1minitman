import { PROBLEM_CODES, type ProblemCode } from '../errors/registry';
import { ProblemSchema } from '../schemas/problem';

/*
 * What every operation declares, so the OpenAPI enumeration test can check it
 * (MOD-00 plan section 4.4, 1MM-STD-13 section 8):
 *
 *   security               OpenAPI `security`; `[]` states that the route needs no credential.
 *   x-rate-limit-policy    The `rate_limit_policies.key` the route is limited by, or `null` to
 *                          state that no policy applies. Limits are never written in a route.
 *   responses              Every error status with `ProblemSchema`, built by `problemResponses`.
 */

export const PROBLEM_CONTENT_TYPE = 'application/problem+json';

/** OpenAPI extension that lists the registry codes a response can carry. */
export const PROBLEM_CODES_EXTENSION = 'x-problem-codes';
export const RATE_LIMIT_POLICY_EXTENSION = 'x-rate-limit-policy';

/** `security: []`: the operation is open (probes, the public website surface). */
export const NO_AUTH: Record<string, string[]>[] = [];

/**
 * The error responses of an operation, grouped by status. `internal` (500) is always included:
 * any route can fail unexpectedly.
 */
export const problemResponses = (...codes: ProblemCode[]) => {
  const byStatus = new Map<number, ProblemCode[]>();
  for (const code of new Set<ProblemCode>([...codes, 'internal'])) {
    const { status } = PROBLEM_CODES[code];
    byStatus.set(status, [...(byStatus.get(status) ?? []), code]);
  }
  return Object.fromEntries(
    [...byStatus].map(([status, list]) => [
      status,
      {
        description: list.map((code) => `\`${code}\`: ${PROBLEM_CODES[code].title}`).join('; '),
        content: { [PROBLEM_CONTENT_TYPE]: { schema: ProblemSchema } },
        [PROBLEM_CODES_EXTENSION]: list,
      },
    ]),
  );
};
