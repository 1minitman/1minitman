import type { Logger } from '../logger';

/** Per-request variables set by middleware and read by handlers. */
export interface AppVariables {
  requestId: string;
  logger: Logger;
}
export type AppEnv = { Variables: AppVariables };
