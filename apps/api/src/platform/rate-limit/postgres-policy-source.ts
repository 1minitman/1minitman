import type { Database } from '@1minitman/db';
import { rateLimitPolicies } from '@1minitman/db/schema';
import type { PolicySource } from './policies';

/**
 * Reads every row of `rate_limit_policies` (15 seeded [TR §13.3]). The table holds no member
 * data and has no row-level security, so the read needs no member context.
 */
export const postgresPolicySource = (database: Database): PolicySource => ({
  load: () =>
    database.db
      .select({
        key: rateLimitPolicies.key,
        scope: rateLimitPolicies.scope,
        maxRequests: rateLimitPolicies.maxRequests,
        windowSeconds: rateLimitPolicies.windowSeconds,
        lockoutSeconds: rateLimitPolicies.lockoutSeconds,
        algorithm: rateLimitPolicies.algorithm,
        isActive: rateLimitPolicies.isActive,
      })
      .from(rateLimitPolicies),
});
