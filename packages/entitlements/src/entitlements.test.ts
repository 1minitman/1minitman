import { describe, expect, test } from 'bun:test';
import { ENTITLEMENT_KEYS, isVerified, limitOf, planForRole, roleAtLeast } from './index';
import type { EntitlementSet } from './index';

describe('role ladder', () => {
  test('plans map from roles', () => {
    expect(planForRole('ACTIVE')).toBe('free');
    expect(planForRole('CLASSIC')).toBe('premium');
    expect(planForRole('SUPER')).toBe('gold');
  });
  test('verification starts at ACTIVE', () => {
    expect(isVerified('PENDING_REVIEW')).toBe(false);
    expect(isVerified('ACTIVE')).toBe(true);
    expect(roleAtLeast('SUPER', 'CLASSIC')).toBe(true);
  });
});

describe('entitlement values', () => {
  test('null means unlimited', () => {
    const set = Object.fromEntries(ENTITLEMENT_KEYS.map((k) => [k, false])) as EntitlementSet;
    set['chat.open_conversations'] = null;
    expect(limitOf(set, 'chat.open_conversations')).toBe(Number.POSITIVE_INFINITY);
  });
  test('schema v3.4 seeds 25 keys', () => {
    expect(ENTITLEMENT_KEYS).toHaveLength(25);
  });
});
