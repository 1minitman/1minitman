import type { Database } from '@1minitman/db';

/** One row of `worker_jobs` as the worker needs it. */
export interface CatalogueRow {
  name: string;
  /** Machine-readable schedule, UTC (TRX-049). NULL for jobs the API enqueues. */
  cron: string | null;
  isActive: boolean;
  runNowAllowed: boolean;
  isDestructive: boolean;
}

/** Read access to the job catalogue. Edited on the A31 Jobs page, never by the worker. */
export interface Catalogue {
  list(): Promise<CatalogueRow[]>;
  get(name: string): Promise<CatalogueRow | undefined>;
}

interface Row {
  name: string;
  cron: string | null;
  is_active: boolean;
  run_now_allowed: boolean;
  is_destructive: boolean;
}

const toRow = (row: Row): CatalogueRow => ({
  name: row.name,
  cron: row.cron,
  isActive: row.is_active,
  runNowAllowed: row.run_now_allowed,
  isDestructive: row.is_destructive,
});

/** The catalogue in PostgreSQL, read on the worker pool (`app_worker`). */
export const postgresCatalogue = (database: Database): Catalogue => ({
  async list() {
    const rows = await database.sql<Row[]>`
      SELECT name, cron, is_active, run_now_allowed, is_destructive
        FROM worker_jobs ORDER BY name`;
    return rows.map(toRow);
  },
  async get(name) {
    const [row] = await database.sql<Row[]>`
      SELECT name, cron, is_active, run_now_allowed, is_destructive
        FROM worker_jobs WHERE name = ${name}`;
    return row ? toRow(row) : undefined;
  },
});

/** A catalogued job whose handler is not built yet, with the module plan that builds it. */
export interface PendingJob {
  name: string;
  /** Module plan id, for example `MOD-10`. */
  owner: string;
  /** Plan task that builds it, or the gap that tracks it. */
  task?: string;
}

/** How the handler registry and the pending manifest differ from the catalogue. */
export interface CatalogueReport {
  /** Rows with neither a handler nor a pending entry. */
  unclaimed: string[];
  /** Handlers with no row. */
  handlersWithoutRow: string[];
  /** Pending entries with no row. */
  pendingWithoutRow: string[];
  /** Names that have a handler and are also still listed as pending. */
  handledAndPending: string[];
  /** Names listed more than once in the registry or the manifest. */
  duplicates: string[];
}

const duplicatesOf = (names: string[]) =>
  [...new Set(names.filter((name, index) => names.indexOf(name) !== index))].sort();

/**
 * Compares the registry and the manifest with the catalogue. The catalogue test asserts every
 * list is empty; the runner refuses to start when a handler has no row.
 */
export const compareCatalogue = (
  handlers: readonly string[],
  pending: readonly PendingJob[],
  rows: readonly string[],
): CatalogueReport => {
  const catalogued = new Set(rows);
  const handled = new Set(handlers);
  const pendingNames = pending.map((job) => job.name);
  const listed = new Set(pendingNames);
  return {
    unclaimed: rows.filter((name) => !handled.has(name) && !listed.has(name)).sort(),
    handlersWithoutRow: handlers.filter((name) => !catalogued.has(name)).sort(),
    pendingWithoutRow: pendingNames.filter((name) => !catalogued.has(name)).sort(),
    handledAndPending: handlers.filter((name) => listed.has(name)).sort(),
    duplicates: [
      ...new Set([...duplicatesOf([...handlers]), ...duplicatesOf(pendingNames)]),
    ].sort(),
  };
};
