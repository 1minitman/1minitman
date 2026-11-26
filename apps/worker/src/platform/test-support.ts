import type { Database } from '@1minitman/db';
import type { AttemptDeps } from './attempt';
import type { Catalogue, CatalogueRow } from './catalogue';
import type { FailureNotifier, JobFailure } from './failure-notifier';
import type { Logger } from './logger';
import type { ErrorReporter, FailureTags } from './reporter';

/** Test doubles shared by the worker's unit tests. Never imported by `main.ts`. */

export interface LogLine {
  level: string;
  message: string;
  fields?: Record<string, unknown>;
}

export const recordingLogger = (lines: LogLine[] = []): Logger & { lines: LogLine[] } => {
  const at =
    (level: string) =>
    (message: string, fields?: Record<string, unknown>): void => {
      lines.push({ level, message, fields });
    };
  const logger: Logger & { lines: LogLine[] } = {
    lines,
    debug: at('debug'),
    info: at('info'),
    warn: at('warn'),
    error: at('error'),
    child: () => logger,
  };
  return logger;
};

export const catalogueRow = (
  name: string,
  overrides: Partial<CatalogueRow> = {},
): CatalogueRow => ({
  name,
  cron: null,
  isActive: true,
  runNowAllowed: false,
  isDestructive: false,
  ...overrides,
});

export const memoryCatalogue = (rows: CatalogueRow[]): Catalogue => ({
  list: () => Promise.resolve([...rows]),
  get: (name) => Promise.resolve(rows.find((row) => row.name === name)),
});

export const recordingReporter = () => {
  const captured: { error: unknown; tags: FailureTags }[] = [];
  const reporter: ErrorReporter & { captured: typeof captured } = {
    captured,
    capture: (error, tags) => {
      captured.push({ error, tags });
    },
    flush: () => Promise.resolve(true),
  };
  return reporter;
};

export const recordingNotifier = (fail = false) => {
  const failures: JobFailure[] = [];
  const notifier: FailureNotifier & { failures: JobFailure[] } = {
    failures,
    jobFailed: (failure) => {
      failures.push(failure);
      return fail
        ? Promise.reject(new Error('notification store down'))
        : Promise.resolve({ notified: 1 });
    },
  };
  return notifier;
};

/** A database handle for unit tests whose handlers never query. */
export const unusedDatabase = {} as Database;

export const fakeDeps = (rows: CatalogueRow[], options: { notifierFails?: boolean } = {}) => {
  const logger = recordingLogger();
  const reporter = recordingReporter();
  const notifier = recordingNotifier(options.notifierFails);
  const deps: AttemptDeps = {
    catalogue: memoryCatalogue(rows),
    context: { database: unusedDatabase, logger },
    reporter,
    notifier,
  };
  return { deps, logger, reporter, notifier };
};
