import { denyAllMemberAuthPorts } from '../auth/member';
import type { Logger } from '../logger';
import { createMemoryConnectionRegistry } from './connection-registry';
import { createWebSocketGateway } from './gateway';
import { createMemoryRelay } from './relay';
import { createAdminStreamHub, denyAllAdminStreamFilter } from './sse-hub';

/**
 * Realtime for one process with nothing behind it: an in-memory relay, deny-all token checks and
 * the deny-all admin filter. For tests and the OpenAPI emitter, never for a running API.
 */
export const createInMemoryRealtime = (logger: Logger) => {
  const relay = createMemoryRelay(logger);
  const { tokens, denyList } = denyAllMemberAuthPorts();
  return {
    gateway: createWebSocketGateway({
      tokens,
      denyList,
      relay,
      registry: createMemoryConnectionRegistry().registry,
      logger,
    }),
    adminStream: createAdminStreamHub({ relay, filter: denyAllAdminStreamFilter, logger }),
  };
};
