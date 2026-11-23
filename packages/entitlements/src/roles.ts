/** Role ladder, lowest to highest (schema enum member_role_t). */
export const MEMBER_ROLES = ['BASIC', 'PENDING_REVIEW', 'ACTIVE', 'CLASSIC', 'SUPER'] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

/** Plans (schema enum plan_t). The Black Badge is a one-off product, never a plan. */
export const PLANS = ['free', 'premium', 'gold'] as const;
export type Plan = (typeof PLANS)[number];

const PLAN_BY_ROLE: Record<MemberRole, Plan> = {
  BASIC: 'free',
  PENDING_REVIEW: 'free',
  ACTIVE: 'free',
  CLASSIC: 'premium',
  SUPER: 'gold',
};

export const planForRole = (role: MemberRole): Plan => PLAN_BY_ROLE[role];

/** True when `role` is at or above `minimum` on the ladder. */
export const roleAtLeast = (role: MemberRole, minimum: MemberRole): boolean =>
  MEMBER_ROLES.indexOf(role) >= MEMBER_ROLES.indexOf(minimum);

/** Black Badge verified: ACTIVE or higher. */
export const isVerified = (role: MemberRole): boolean => roleAtLeast(role, 'ACTIVE');
