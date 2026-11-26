import { describe, expect, test } from 'bun:test';
import { isProblemCode, PROBLEM_CODES } from './errors/registry';
import {
  PROBLEM_CODES_EXTENSION,
  PROBLEM_CONTENT_TYPE,
  RATE_LIMIT_POLICY_EXTENSION,
} from './routes/operation';
import { SURFACE_NAMES } from './surfaces';
import { openApiOperations } from './test-support/openapi';
import { seededRateLimitPolicies } from './test-support/sources';

/*
 * Enumerates every operation of the three OpenAPI documents (MOD-00 plan section 4.4, API gate
 * item 2) and asserts that it declares auth, its error responses and a rate-limit policy.
 * The documents are the committed output of `pnpm contracts:generate`.
 */

/** Error responses that are deliberately not problem documents (1MM-STD-13 section 2.2). */
const NOT_A_PROBLEM = new Set(['GET /ready 503']);

const operations = openApiOperations();

describe('OpenAPI enumeration', () => {
  const policies = seededRateLimitPolicies();

  test('there are operations on every surface', () => {
    for (const surface of SURFACE_NAMES) {
      expect(operations.some((op) => op.surface === surface)).toBe(true);
    }
    expect(policies.size).toBeGreaterThanOrEqual(15);
  });

  for (const { surface, id, operation } of operations) {
    describe(`${surface} ${id}`, () => {
      test('declares auth', () => {
        expect(Array.isArray(operation.security)).toBe(true);
      });

      test('declares a seeded rate-limit policy, or null for none', () => {
        expect(Object.hasOwn(operation, RATE_LIMIT_POLICY_EXTENSION)).toBe(true);
        const policy = operation[RATE_LIMIT_POLICY_EXTENSION];
        if (policy !== null) expect(policies.has(String(policy))).toBe(true);
      });

      test('declares its error responses with ProblemSchema and registry codes', () => {
        const errors = Object.entries(operation.responses ?? {}).filter(
          ([status]) => Number(status) >= 400,
        );
        expect(errors.length).toBeGreaterThan(0);
        for (const [status, response] of errors) {
          if (NOT_A_PROBLEM.has(`${id} ${status}`)) continue;
          expect(Object.keys(response.content ?? {})).toEqual([PROBLEM_CONTENT_TYPE]);
          expect(response.content?.[PROBLEM_CONTENT_TYPE]?.schema?.$ref).toBe(
            '#/components/schemas/Problem',
          );
          const codes = response[PROBLEM_CODES_EXTENSION] as unknown[];
          expect(codes.length).toBeGreaterThan(0);
          for (const code of codes) {
            expect(isProblemCode(code)).toBe(true);
            if (isProblemCode(code)) expect(PROBLEM_CODES[code].status).toBe(Number(status));
          }
        }
      });
    });
  }
});
