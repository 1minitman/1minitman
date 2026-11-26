import { describe, expect, test } from 'bun:test';
import { ProblemSchema } from './problem';

const base = {
  type: 'tag:1minitman.com,2026:problem:entitlement',
  title: 'Entitlement required',
  status: 403,
  instance: '/v1/conversations',
  request_id: 'req_12345678',
  reason: 'entitlement',
};

describe('ProblemSchema', () => {
  test('accepts the gating example of the Technical Reference', () => {
    expect(
      ProblemSchema.safeParse({ ...base, entitlement: 'chat.full', upsell: 'D15?plan=premium' })
        .success,
    ).toBe(true);
  });

  test('reason, instance and request_id are required', () => {
    for (const key of ['reason', 'instance', 'request_id'] as const) {
      const { [key]: _omitted, ...rest } = base;
      expect(ProblemSchema.safeParse(rest).success).toBe(false);
    }
  });

  test('accepts a code this client does not know yet, refuses a malformed one', () => {
    expect(ProblemSchema.safeParse({ ...base, reason: 'some_future_code' }).success).toBe(true);
    expect(ProblemSchema.safeParse({ ...base, reason: 'Not-Snake' }).success).toBe(false);
  });

  test('validation errors carry a field code', () => {
    const errors = [{ path: 'nickname', code: 'too_long', message: 'Too big' }];
    expect(ProblemSchema.safeParse({ ...base, errors }).success).toBe(true);
    expect(
      ProblemSchema.safeParse({ ...base, errors: [{ path: 'a', message: 'no code' }] }).success,
    ).toBe(false);
  });

  test('extension members are typed', () => {
    expect(ProblemSchema.safeParse({ ...base, retry_after_seconds: -1 }).success).toBe(false);
    expect(ProblemSchema.safeParse({ ...base, until: 'tomorrow' }).success).toBe(false);
    expect(ProblemSchema.safeParse({ ...base, until: '2026-11-26T09:00:00Z' }).success).toBe(true);
    expect(ProblemSchema.safeParse({ ...base, status: 200 }).success).toBe(false);
  });
});
