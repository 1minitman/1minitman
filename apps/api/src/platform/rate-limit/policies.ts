import type { Logger } from '../logger';
import type { RateLimitAlgorithm } from './rate-limiter';

/** `rate_limit_policies.scope` [SQL]: who a policy counts. */
export type RateLimitScope = 'ip' | 'device' | 'account' | 'phone' | 'email' | 'account_ip';

/** One row of `rate_limit_policies`, as the API uses it [TR §13.3]. */
export interface RateLimitPolicy {
  key: string;
  scope: RateLimitScope;
  maxRequests: number;
  windowSeconds: number;
  lockoutSeconds: number | null;
  algorithm: RateLimitAlgorithm;
  isActive: boolean;
}

/**
 * DEC-002 (owner, 26 Nov 2026): when Redis cannot answer, the lockout policies fail closed and
 * every other policy fails open. The lockout policies are the rows that carry `lockout_seconds`
 * (MOD-00 plan section 4.3 rule 5); in the seed these are exactly the four DEC-002 names:
 * `otp.verify.sms`, `otp.verify.email`, `login.account` and `admin.login`.
 */
export const failsClosed = (policy: RateLimitPolicy) => policy.lockoutSeconds !== null;

/** Port: where the policies are read from. Production reads PostgreSQL. */
export interface PolicySource {
  load(): Promise<RateLimitPolicy[]>;
}

/** A fixed list, for tests and tools that need no database. */
export const staticPolicySource = (policies: RateLimitPolicy[]): PolicySource => ({
  load: () => Promise.resolve(policies.map((policy) => ({ ...policy }))),
});

/** The policies in memory. Requests read the current snapshot; `reload()` swaps it whole. */
export interface PolicyStore {
  get(key: string): RateLimitPolicy | undefined;
  /** Reads the source again. On failure the previous snapshot stays and the error is thrown. */
  reload(): Promise<void>;
  /** True once a load has succeeded. */
  readonly loaded: boolean;
}

export const createPolicyStore = (source: PolicySource, logger?: Logger): PolicyStore => {
  let snapshot = new Map<string, RateLimitPolicy>();
  let loaded = false;
  // Reloads run one after another, so a slow older read can never overwrite a newer one.
  let queue: Promise<void> = Promise.resolve();

  const load = async () => {
    const policies = await source.load();
    snapshot = new Map(policies.map((policy) => [policy.key, policy]));
    loaded = true;
    logger?.info('rate-limit policies loaded', { count: snapshot.size });
  };

  return {
    get: (key) => snapshot.get(key),
    reload() {
      const run = queue.then(load);
      queue = run.catch(() => {});
      return run;
    },
    get loaded() {
      return loaded;
    },
  };
};
