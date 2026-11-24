# 1MM-ADR-0013 · Drizzle as the ORM, with hand-curated models

|                  |                                                                                                                                                          |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**       | Accepted                                                                                                                                                 |
| **Date decided** | 20 Nov 2026                                                                                                                                              |
| **Decided by**   | Owner decision OD-19 (confirms Technical Reference §18.1 T2); model curation from the repository set-up                                                  |
| **Sources**      | [OD-19], [ODT] P-5 / C-2, [TR §3], [TR §13.1], [TR §18.1] T2, `packages/db/src/schema/index.ts`, `packages/db/migrations/README.md`, `eslint.config.mjs` |
| **Affects**      | packages/db, apps/api (infrastructure layer), apps/worker                                                                                                |

## Context

The MVP baseline chose Drizzle (T2). The open-decisions tracker reopened it as "ORM: Drizzle or
Prisma" with the recommendation Drizzle (P-5), raised it to the owner as a critical item (C-2),
and the owner confirmed Drizzle on 20 Nov 2026 [ODT], [OD-19]. The Technical Reference gives the
reason: "SQL-first ORM, PostGIS-friendly" [TR §3], and counts on "Drizzle parameterised queries"
as the SQL-injection control [TR §13.1]. The schema is written in SQL
([1MM-ADR-0012](1MM-ADR-0012-FORWARD-ONLY-SQL-MIGRATIONS.md)), so the models follow the database,
not the other way round.

## Decision

1. Drizzle ORM (with the `postgres` driver) is the only query layer in the API and the worker.
2. Models are **hand-curated**: `pnpm db:pull` introspects the database into
   `packages/db/.introspected/` (not linted, not imported); the tables a module needs are copied
   into `packages/db/src/schema/`, one file per schema domain, and tidied.
3. Models never generate DDL. Drizzle Kit is used for introspection only.
4. Database functions that hold product rules (for example `record_reaction()`) are called as
   functions; their logic is not re-implemented in TypeScript.
5. Drizzle is imported only in infrastructure code
   ([1MM-ADR-0005](1MM-ADR-0005-API-MODULE-LAYERS.md)).

## Alternatives considered

- **Prisma:** named in the tracker (P-5); the recommendation and the owner's answer were Drizzle
  [ODT], [OD-19].
- **Committing the full introspected output as the models:** not chosen at set-up. **Analysis:**
  221 tables of generated code would be imported by every module whether or not it is built, and
  generated names and types need tidying to be usable.
- **Raw SQL only:** the sources record no such option. **Analysis:** it loses typed results and
  makes the "no string-built SQL" rule [TR §13.1] harder to keep.

## Consequences

- Easier: typed queries close to SQL; PostGIS and custom functions stay usable; models grow only
  as modules are built.
- Harder: a model can drift from the database after a migration; each module must refresh and
  re-check its models.
- Cost: none.

## How it is applied

- `packages/db/src/schema/` (currently `platform.ts`, `types.ts`), `packages/db/src/client.ts`,
  `packages/db/drizzle.config.ts`; `packages/db/src/schema/schema.test.ts` reads seeded values
  through the models on a real database.
- After a migration: `pnpm db:migrate`, then `pnpm db:pull` and update the curated files.
- ESLint bans `drizzle-orm` and `postgres` in `domain` and `application` code.
- Model rules: [1MM-DB-01 Schemas](../database/1MM-DB-01-SCHEMAS.md).

## Revisit when

Drizzle cannot express a query the product needs without unsafe string SQL, or model drift
causes a production incident despite the schema test.
