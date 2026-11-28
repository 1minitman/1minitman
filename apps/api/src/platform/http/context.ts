import type { AdminPrincipal, MemberPrincipal } from '../auth/principals';
import type { Logger } from '../logger';

/** Per-request variables set by middleware and read by handlers. */
export interface AppVariables {
  requestId: string;
  logger: Logger;
  /**
   * The caller's address, set by `originLock()`: `CF-Connecting-IP` outside `local`. Read it with
   * `clientIp(c)`.
   */
  clientIp?: string;
  /** Set by `requireMember()`; read it with `currentMember(c)`. */
  member?: MemberPrincipal;
  /** Set by `requireAdmin()`; read it with `currentAdmin(c)`. */
  admin?: AdminPrincipal;
  /** Set by `requireIfMatch()`: the entity tag of `If-Match`; read it with `expectedVersion(c)`. */
  ifMatch?: string;
}
export type AppEnv = { Variables: AppVariables };
