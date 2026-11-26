import * as Sentry from '@sentry/bun';

/** Tags that identify a failed attempt. Ids only: never the payload or personal data. */
export interface FailureTags {
  job: string;
  job_id: string;
  attempt: number;
}

/** Error tracking port. The worker reports to Sentry [TR §14] (DEC-003). */
export interface ErrorReporter {
  capture(error: unknown, tags: FailureTags): void;
  /** Sends what is queued before the process exits; resolves false on timeout. */
  flush(timeoutMs: number): Promise<boolean>;
}

/** Used when no DSN is configured (local development, tests). */
export const noopReporter: ErrorReporter = {
  capture: () => undefined,
  flush: () => Promise.resolve(true),
};

export interface SentryReporterOptions {
  /** `SENTRY_DSN_WORKER`; empty or absent turns reporting off. */
  dsn?: string;
  environment: string;
  release: string;
  /** Replaces the network transport (tests). */
  transport?: Sentry.BunOptions['transport'];
}

/**
 * Nothing but the error and its stack leaves the worker: no user fields, headers, bodies, query
 * parameters, database values, queue arguments or local variables [TR §14]. The tags above are
 * the only context attached.
 */
export const DATA_COLLECTION: NonNullable<Sentry.BunOptions['dataCollection']> = {
  userInfo: false,
  cookies: false,
  httpHeaders: false,
  httpBodies: [],
  urlQueryParams: false,
  graphQL: { document: false, variables: false },
  genAI: { inputs: false, outputs: false },
  mcp: { inputs: false, outputs: false },
  databaseQueryData: false,
  queues: false,
  stackFrameVariables: false,
};

/** Sentry for the worker [TR §14], DEC-003. Tracing is not enabled here (GAP-MOD00-12). */
export const createSentryReporter = (options: SentryReporterOptions): ErrorReporter => {
  if (!options.dsn) return noopReporter;
  Sentry.init({
    dsn: options.dsn,
    environment: options.environment,
    release: options.release,
    dataCollection: DATA_COLLECTION,
    ...(options.transport ? { transport: options.transport } : {}),
  });
  return {
    capture(error, tags) {
      Sentry.withScope((scope) => {
        scope.setTags({ job: tags.job, job_id: tags.job_id, attempt: tags.attempt });
        Sentry.captureException(error);
      });
    },
    flush: (timeoutMs) => Sentry.flush(timeoutMs),
  };
};
