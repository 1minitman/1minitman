import { afterAll, describe, expect, test } from 'bun:test';
import { sql as raw } from 'drizzle-orm';
import {
  boolean,
  integer,
  numeric,
  pgSchema,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import postgres from 'postgres';
import * as schema from './schema';
import { geographyPoint } from './schema/types';
import {
  type Catalogue,
  type CatalogueColumn,
  collectTables,
  lintModels,
  normaliseType,
  readCatalogue,
  typeMatches,
} from './schema-lint';
import { databaseReady } from './test-env';

const col = (type: string, notNull = false, hasDefault = false, baseType: string | null = null) =>
  ({ type, baseType, notNull, hasDefault }) satisfies CatalogueColumn;

const catalogue = (tables: Record<string, Record<string, CatalogueColumn>>): Catalogue =>
  new Map(
    Object.entries(tables).map(([name, columns]) => [name, new Map(Object.entries(columns))]),
  );

const people = catalogue({
  'public.people': {
    id: col('uuid', true, true),
    name: col('text', true),
    country: col('iso_country', false, false, 'text'),
    score: col('numeric(10,2)'),
    seen_at: col('timestamp with time zone', true, true),
    place: col('geography(Point,4326)'),
    code: col('character varying(8)'),
  },
});

const peopleModel = pgTable('people', {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  country: text(),
  score: numeric(),
  seenAt: timestamp('seen_at', { withTimezone: true }).notNull().defaultNow(),
  place: geographyPoint(),
  code: varchar({ length: 8 }),
});

describe('type names are compared the way PostgreSQL prints them', () => {
  test('normaliseType resolves aliases, case and spacing', () => {
    expect(normaliseType('numeric(10, 2)')).toBe('numeric(10,2)');
    expect(normaliseType(' Timestamp ')).toBe('timestamp without time zone');
    expect(normaliseType('varchar(8)')).toBe('character varying(8)');
    expect(normaliseType('int4[]')).toBe('integer[]');
    expect(normaliseType('geography(Point, 4326)')).toBe('geography(point,4326)');
    expect(normaliseType('timestamp with time zone')).toBe('timestamp with time zone');
  });

  test('a time precision sits before the zone, as format_type() prints it', () => {
    expect(normaliseType('timestamp (3)')).toBe('timestamp(3) without time zone');
    expect(normaliseType('time(6)')).toBe('time(6) without time zone');
    expect(normaliseType('timestamp (3) with time zone')).toBe('timestamp(3) with time zone');
    expect(typeMatches('timestamp (3)', col('timestamp(3) without time zone'))).toBe(true);
    expect(typeMatches('timestamp', col('timestamp(3) without time zone'))).toBe(true);
    expect(typeMatches('timestamp (6)', col('timestamp(3) without time zone'))).toBe(false);
    expect(typeMatches('timestamp with time zone', col('timestamp(3) with time zone'))).toBe(true);
    expect(typeMatches('timestamp', col('timestamp(3) with time zone'))).toBe(false);
    const model = pgTable('people', { seenAt: timestamp('seen_at', { precision: 3 }) });
    const db = catalogue({ 'public.people': { seen_at: col('timestamp(3) without time zone') } });
    expect(lintModels([model], db)).toEqual([]);
  });

  test('a model type without a modifier matches the database type with one', () => {
    expect(typeMatches('numeric', col('numeric(10,2)'))).toBe(true);
    expect(typeMatches('numeric(10, 2)', col('numeric(10,2)'))).toBe(true);
    expect(typeMatches('numeric(12, 2)', col('numeric(10,2)'))).toBe(false);
  });

  test('a domain matches by its own name or by its base type', () => {
    const domain = col('app_locale', true, true, 'text');
    expect(typeMatches('app_locale', domain)).toBe(true);
    expect(typeMatches('text', domain)).toBe(true);
    expect(typeMatches('integer', domain)).toBe(false);
  });

  test('arrays and scalars do not match each other', () => {
    expect(typeMatches('text', col('text[]'))).toBe(false);
    expect(typeMatches('text[]', col('text[]'))).toBe(true);
  });
});

describe('lintModels', () => {
  test('a model that matches its table has no findings', () => {
    expect(lintModels([peopleModel], people)).toEqual([]);
  });

  test('a table the migrations do not create is reported once, not per column', () => {
    const ghost = pgTable('ghosts', { id: uuid().primaryKey(), name: text() });
    expect(lintModels([ghost], people)).toEqual([
      {
        problem: 'missing-table',
        table: 'public.ghosts',
        message: 'model names table public.ghosts, which the migrations do not create',
      },
    ]);
  });

  test('a table in another schema is looked up in that schema', () => {
    const other = pgSchema('audit').table('people', { id: uuid().primaryKey() });
    expect(lintModels([other], people).map((f) => f.problem)).toEqual(['missing-table']);
  });

  test('a column the migrations do not have is reported by name', () => {
    const drifted = pgTable('people', { id: uuid().primaryKey(), nickname: text() });
    expect(lintModels([drifted], people)).toEqual([
      {
        problem: 'missing-column',
        table: 'public.people',
        column: 'nickname',
        message: 'model names column public.people.nickname, which the migrations do not have',
      },
    ]);
  });

  test('a wrong type, a wrong nullability and an invented default are each reported', () => {
    const drifted = pgTable('people', {
      name: integer(),
      country: text().notNull(),
      score: numeric().default('0'),
      code: boolean(),
    });
    const findings = lintModels([drifted], people);
    expect(findings.map((f) => [f.column, f.problem])).toEqual([
      ['name', 'type-mismatch'],
      ['name', 'nullability-mismatch'],
      ['country', 'nullability-mismatch'],
      ['score', 'default-missing'],
      ['code', 'type-mismatch'],
    ]);
    expect(findings[0]?.message).toBe(
      'public.people.name is text in the database but integer in the model',
    );
    expect(findings[2]?.message).toBe(
      'public.people.country is nullable in the database but NOT NULL in the model',
    );
  });

  test('a client-side $defaultFn is not taken for a database default', () => {
    const model = pgTable('people', {
      name: text()
        .notNull()
        .$defaultFn(() => 'x'),
      score: numeric().default(raw`0`),
    });
    expect(lintModels([model], people).map((f) => [f.column, f.problem])).toEqual([
      ['score', 'default-missing'],
    ]);
  });

  test('collectTables keeps only Drizzle tables', () => {
    const tables = collectTables({ peopleModel, col, answer: 42, nothing: null });
    expect(tables).toEqual([peopleModel]);
  });
});

// Behaviour on PostgreSQL 16 (`pnpm services:up && pnpm db:migrate`).
const url = process.env.DATABASE_URL;
const ready = databaseReady({ DATABASE_URL: url });

describe.skipIf(!ready)('schema lint against the migrated database', () => {
  const sql = postgres(url ?? '', { max: 1, onnotice: () => {} });
  afterAll(() => sql.end());

  test('every model in src/schema matches the migrations', async () => {
    const tables = collectTables(schema);
    expect(tables.length).toBeGreaterThan(0);
    expect(lintModels(tables, await readCatalogue(sql))).toEqual([]);
  });

  test('the catalogue reads domains, enums, PostGIS and partitioned tables', async () => {
    const db = await readCatalogue(sql);
    expect(db.get('public.users')?.get('locale')).toEqual(col('app_locale', true, true, 'text'));
    expect(db.get('public.users')?.get('plan')?.type).toBe('plan_t');
    expect(db.get('public.users')?.get('email')?.type).toBe('citext');
    expect(db.has('public.messages')).toBe(true);
    expect(db.has('public.schema_migrations')).toBe(true);
  });

  test('a model naming a column the migration does not have fails the lint', async () => {
    const drifted = pgTable('remote_config', {
      key: text().primaryKey(),
      valueJson: text('value_json'),
    });
    expect(lintModels([drifted], await readCatalogue(sql))).toEqual([
      {
        problem: 'missing-column',
        table: 'public.remote_config',
        column: 'value_json',
        message:
          'model names column public.remote_config.value_json, which the migrations do not have',
      },
    ]);
  });
});
