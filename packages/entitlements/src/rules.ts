import type { EntitlementKey, EntitlementSet } from './keys';

/** Boolean entitlements: granted only when the value is exactly true. */
export const isGranted = (set: EntitlementSet, key: EntitlementKey): boolean => set[key] === true;

/** Numeric entitlements: the limit, or Infinity when unlimited (null). */
export const limitOf = (set: EntitlementSet, key: EntitlementKey): number => {
  const value = set[key];
  if (value === null) return Number.POSITIVE_INFINITY;
  return typeof value === 'number' ? value : 0;
};

/** True when `used` is still below the limit for `key`. */
export const hasRoom = (set: EntitlementSet, key: EntitlementKey, used: number): boolean =>
  used < limitOf(set, key);
