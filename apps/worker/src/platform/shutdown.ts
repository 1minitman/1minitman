import { errorLabel, type Logger } from './logger';

export interface ShutdownDeps {
  logger: Logger;
  /** Run in order: stop taking work, flush, close connections. */
  steps: readonly (() => Promise<unknown>)[];
  /** `process.exit` in `main.ts`; a test passes a recorder. */
  exit: (code: number) => void;
}

/**
 * The signal handler. It runs once: a second signal while stopping is logged and ignored. A step
 * that rejects is logged (label only) and the process exits 1; a clean stop exits 0. It never
 * rejects, so `void shutdown(signal)` cannot become an unhandled rejection.
 */
export const createShutdown = ({ logger, steps, exit }: ShutdownDeps) => {
  let stopping = false;
  return async (signal: string): Promise<void> => {
    if (stopping) {
      logger.info('shutdown already in progress', { signal });
      return;
    }
    stopping = true;
    let code = 0;
    try {
      logger.info('shutting down', { signal });
      for (const step of steps) await step();
    } catch (error) {
      code = 1;
      logger.error('shutdown failed', { signal, error: errorLabel(error) });
    } finally {
      exit(code);
    }
  };
};
