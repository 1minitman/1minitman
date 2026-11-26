import type { AdminPrincipal, MemberPrincipal } from '../auth/principals';
import type { Logger } from '../logger';

/** Per-request variables set by middleware and read by handlers. */
export interface AppVariables {
  requestId: string;
  logger: Logger;
  /** Set by `requireMember()`; read it with `currentMember(c)`. */
  member?: MemberPrincipal;
  /** Set by `requireAdmin()`; read it with `currentAdmin(c)`. */
  admin?: AdminPrincipal;
}
export type AppEnv = { Variables: AppVariables };
