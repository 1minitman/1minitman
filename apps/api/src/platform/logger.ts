type Level = 'debug' | 'info' | 'warn' | 'error';
const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export interface Logger {
  debug(message: string, fields?: Record<string, unknown>): void;
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
  child(fields: Record<string, unknown>): Logger;
}

/**
 * Structured JSON logs, one line per event (Technical Reference 14).
 * Never pass message bodies, passwords, codes, tokens, face data or card data as fields.
 */
export const createLogger = (level: Level, base: Record<string, unknown> = {}): Logger => {
  const write = (lvl: Level, message: string, fields?: Record<string, unknown>) => {
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
