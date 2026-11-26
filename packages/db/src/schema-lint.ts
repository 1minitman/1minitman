import { is } from 'drizzle-orm';
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core';
import type postgres from 'postgres';

// Schema lint [ADM §4]: the Drizzle models in src/schema/ are hand-curated, so they can drift from
// the SQL migrations, which own the schema. The lint compares every model with the catalogue of a
// migrated database and reports each table or column the migrations do not have, and each type,
// nullability or default the model states differently. It never changes the database.

/** One column as the migrated database has it. */
export interface CatalogueColumn {
  /** format_type() of the column type, e.g. `timestamp with time zone`, `iso_country`. */
  type: string;
  /** For a column typed with a DOMAIN, format_type() of the domain's base type, e.g. `text`. */
  baseType: string | null;
  notNull: boolean;
  hasDefault: boolean;
}

/** Tables of the migrated database: `schema.table` → column name → column. */
export type Catalogue = Map<string, Map<string, CatalogueColumn>>;

export type LintProblem =
  'missing-table' | 'missing-column' | 'type-mismatch' | 'nullability-mismatch' | 'default-missing';

export interface LintFinding {
  problem: LintProblem;
  table: string;
  column?: string;
  message: string;
}

/** Every Drizzle table among the exports of a module (for example `./schema`). */
export const collectTables = (exports: Record<string, unknown>): PgTable[] =>
  Object.values(exports).filter((value): value is PgTable => is(value, PgTable));

// Short names Drizzle may print for a type, mapped to the name format_type() uses.
const ALIASES: Record<string, string> = {
  int: 'integer',
  int2: 'smallint',
  int4: 'integer',
  int8: 'bigint',
  serial: 'integer',
  smallserial: 'smallint',
  bigserial: 'bigint',
  bool: 'boolean',
  float4: 'real',
  float8: 'double precision',
  decimal: 'numeric',
  varchar: 'character varying',
  char: 'character',
  timestamp: 'timestamp without time zone',
  timestamptz: 'timestamp with time zone',
  time: 'time without time zone',
  timetz: 'time with time zone',
};

/** Lower case, no spaces inside modifiers, aliases resolved: `numeric(10, 2)` → `numeric(10,2)`. */
export const normaliseType = (type: string): string => {
  const compact = type
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\s*([(),[\]])\s*/g, '$1');
  const match = /^([a-z_][a-z0-9_ ]*?)((?:\(.*\))?)((?:\[\])*)$/.exec(compact);
  if (!match) return compact;
  const [, name = '', modifier = '', array = ''] = match;
  return `${ALIASES[name] ?? name}${modifier}${array}`;
};

const withoutModifier = (type: string) => type.replace(/\(.*\)/, '');

/**
 * True when the model type names the database type. A model type without a modifier matches the
 * same type with one (`numeric` matches `numeric(10,2)`); a domain matches by name or base type.
 */
export const typeMatches = (modelType: string, column: CatalogueColumn): boolean => {
  const model = normaliseType(modelType);
  const hasModifier = model !== withoutModifier(model);
  return [column.type, column.baseType]
    .filter((type): type is string => Boolean(type))
    .map(normaliseType)
    .some((db) => db === model || (!hasModifier && withoutModifier(db) === model));
};

/** Compares the models with the catalogue. An empty list means no drift. */
export const lintModels = (tables: readonly PgTable[], catalogue: Catalogue): LintFinding[] => {
  const findings: LintFinding[] = [];
  for (const table of tables) {
    const config = getTableConfig(table);
    const name = `${config.schema ?? 'public'}.${config.name}`;
    const columns = catalogue.get(name);
    if (!columns) {
      findings.push({
        problem: 'missing-table',
        table: name,
        message: `model names table ${name}, which the migrations do not create`,
      });
      continue;
    }
    for (const column of config.columns) {
      const where = `${name}.${column.name}`;
      const db = columns.get(column.name);
      if (!db) {
        findings.push({
          problem: 'missing-column',
          table: name,
          column: column.name,
          message: `model names column ${where}, which the migrations do not have`,
        });
        continue;
      }
      const modelType = column.getSQLType();
      if (!typeMatches(modelType, db)) {
        findings.push({
          problem: 'type-mismatch',
          table: name,
          column: column.name,
          message: `${where} is ${db.type} in the database but ${modelType} in the model`,
        });
      }
      if (column.notNull !== db.notNull) {
        findings.push({
          problem: 'nullability-mismatch',
          table: name,
          column: column.name,
          message: `${where} is ${db.notNull ? 'NOT NULL' : 'nullable'} in the database but ${column.notNull ? 'NOT NULL' : 'nullable'} in the model`,
        });
      }
      // Only a SQL default matters here: $defaultFn values are produced by the client.
      if (column.default !== undefined && !db.hasDefault) {
        findings.push({
          problem: 'default-missing',
          table: name,
          column: column.name,
          message: `model gives ${where} a default, which the database does not have`,
        });
      }
    }
  }
  return findings;
};

/**
 * Reads tables, partitioned tables, views and their columns from the connected database. The
 * system catalogue is readable by every login, so any of the application logins will do.
 */
export const readCatalogue = async (sql: postgres.Sql): Promise<Catalogue> => {
  const rows = await sql<
    {
      schema: string;
      table: string;
      column: string;
      type: string;
      base_type: string | null;
      not_null: boolean;
      has_default: boolean;
    }[]
  >`
    SELECT n.nspname AS schema,
           c.relname AS table,
           a.attname AS column,
           format_type(a.atttypid, a.atttypmod) AS type,
           CASE WHEN t.typtype = 'd' THEN format_type(t.typbasetype, t.typtypmod) END AS base_type,
           a.attnotnull AS not_null,
           a.atthasdef AS has_default
      FROM pg_attribute a
      JOIN pg_class c ON c.oid = a.attrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_type t ON t.oid = a.atttypid
     WHERE c.relkind IN ('r', 'p', 'v', 'm')
       AND a.attnum > 0
       AND NOT a.attisdropped
       AND n.nspname NOT IN ('pg_catalog', 'information_schema')
       AND n.nspname NOT LIKE 'pg_toast%'`;
  const catalogue: Catalogue = new Map();
  for (const row of rows) {
    const key = `${row.schema}.${row.table}`;
    let columns = catalogue.get(key);
    if (!columns) catalogue.set(key, (columns = new Map()));
    columns.set(row.column, {
      type: row.type,
      baseType: row.base_type,
      notNull: row.not_null,
      hasDefault: row.has_default,
    });
  }
  return catalogue;
};
