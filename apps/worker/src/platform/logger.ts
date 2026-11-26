// The API's logger shape (`apps/api/src/platform/logger.ts`), copied so the worker and the API
// write the same JSON line (REP-037). Apps never import each other.

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
const ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export interface Logger {
  debug(message: string, fields?: Record<string, unknown>): void;
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
  child(fields: Record<string, unknown>): Logger;
}

/**
 * Structured JSON logs, one line per event (Technical Reference 14).
 * Never pass payloads, message bodies, passwords, codes, tokens or personal data as fields.
 */
export const createLogger = (level: LogLevel, base: Record<string, unknown> = {}): Logger => {
  const write = (lvl: LogLevel, message: string, fields?: Record<string, unknown>) => {
    if (ORDER[lvl] < ORDER[level]) return;
    const line = JSON.stringify({
      time: new Date().toISOString(),
      level: lvl,
      message,
      ...base,
      ...fields,
    });
    (lvl === 'error' ? console.error : console.log)(line);
  };
  return {
    debug: (m, f) => write('debug', m, f),
    info: (m, f) => write('info', m, f),
    warn: (m, f) => write('warn', m, f),
    error: (m, f) => write('error', m, f),
    child: (fields) => createLogger(level, { ...base, ...fields }),
  };
};

/**
 * A payload-free label for a caught error, for log lines: the driver code (PostgreSQL SQLSTATE,
 * a system error code) or the error's name, never its message. A PostgreSQL message can quote the
 * offending value and a vendor library's can quote a request, so only Sentry receives the message
 * (1MM-STD-14 section 16 rule 10; the same rule as the API's webhook intake).
 */
export const errorLabel = (error: unknown): string => {
  const cause =
    error instanceof Error ? (error.cause as { code?: unknown } | undefined) : undefined;
  if (cause && typeof cause.code === 'string') return cause.code;
  const own = (error as { code?: unknown } | null)?.code;
  if (typeof own === 'string') return own;
  return error instanceof Error ? error.name : 'unknown';
};
