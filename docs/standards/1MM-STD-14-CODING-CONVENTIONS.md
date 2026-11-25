# 1MM-STD-14 · Coding conventions

|              |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Document** | 1MM-STD-14                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **Status**   | Approved baseline · v1.0 · 24 Nov 2026                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **Audience** | Engineers and coding agents                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **Owner**    | Engineering lead (code owners)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **Sources**  | Repo: `tsconfig.base.json`, `eslint.config.mjs`, `pnpm-workspace.yaml`, `scripts/check-repo-rules.mjs`, `apps/api/src`, `apps/worker/src`, `apps/admin/src`, `apps/web/src`, `apps/site/src`, `apps/mobile/src`, `packages/*`; [TR §2.4], [TR §2.5], [TR §4.5], [TR §4.6], [TR §5.1], [TR §5.3], [TR §6], [TR §7.1], [TR §8.1], [TR §8.3], [TR §10.2], [TR §11], [TR §14], [TR §17.3], [SQL] seeds and preamble, [DD §14], [ADM §1.4], [ADM §1.6], [ADM A01], [ADM App. E], [WEB §3.1], [WEB §4.0], [CN handoff] |
| **Related**  | [1MM-STD-13](1MM-STD-13-ERROR-CODES.md), [1MM-STD-16](1MM-STD-16-DEFENSIVE-PROGRAMMING.md), [1MM-STD-06](1MM-STD-06-API-FIRST.md), [1MM-STD-09](1MM-STD-09-FORMATTING.md), [1MM-STD-20](1MM-STD-20-DESIGN-SYSTEM.md), [1MM-STD-17](1MM-STD-17-LANGUAGE-CONFIGURATION.md), [1MM-STD-12](1MM-STD-12-DATA-HANDLING.md), [1MM-STD-11](1MM-STD-11-SECURITY-AND-COMPLIANCE.md), [1MM-STD-01](1MM-STD-01-TESTING-STRATEGY.md), [1MM-DB-03](../database/1MM-DB-03-SQL-STRUCTURE.md)                                      |

**What this document is for and when to open it.** It says how code is written in this
repository: where a piece of code belongs, what it may depend on, how things are named, and what a
reviewer rejects. Open it before your first change in a workspace and whenever you are unsure
where something goes. The conventions are taken from the scaffold as it stands; where the scaffold
does not yet enforce one, that is said, and additions of ours are marked **Recommendation**.

## 1. TypeScript strictness

`tsconfig.base.json` is extended by every workspace that has a `tsconfig.json`, except the
mobile app (§1.1) and the website, which extends `astro/tsconfigs/strict`. `packages/tokens` has
no TypeScript source and no `tsconfig.json`.

| Option                                                                  | Effect on how you write code                                                                                                                                   |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `strict`                                                                | No implicit `any`; `null` and `undefined` are checked; `catch` variables are `unknown`, so narrow with `error instanceof Error` (as `check-readiness.ts` does) |
| `noUncheckedIndexedAccess`                                              | `array[i]` and `record[key]` are `T \| undefined`. Handle the missing case (`row?.made ?? 0`), do not assert it away                                           |
| `noImplicitOverride`                                                    | A method that overrides must say `override`                                                                                                                    |
| `noFallthroughCasesInSwitch`                                            | Every `case` ends in `break`, `return` or `throw`                                                                                                              |
| `verbatimModuleSyntax` + `isolatedModules`                              | Type imports must be marked (`import type`, or inline `type`); each file compiles on its own                                                                   |
| `moduleDetection: force`                                                | Every file is a module                                                                                                                                         |
| `module: ESNext`, `moduleResolution: Bundler`, `target` / `lib: ES2023` | ESM only; imports have no file extension                                                                                                                       |
| `resolveJsonModule`                                                     | JSON can be imported (the i18n catalogues)                                                                                                                     |
| `forceConsistentCasingInFileNames`                                      | Import paths match file-name case exactly                                                                                                                      |
| `noEmit`                                                                | `tsc` only checks; Bun, Vite, Astro and Metro build                                                                                                            |

Rules on top of the compiler:

1. No `any`. Use `unknown` and narrow, or a zod schema at the boundary. `typescript-eslint`
   recommended reports an explicit `any`.
2. No non-null `!` and no `as` to silence the checker. The accepted uses are a DOM root lookup at
   the entry point and a cast that a framework's typing forces (as in `surfaces/index.ts`); each
   other use carries a comment.
3. Prefer `satisfies` to check a literal against a type without widening it (`TABS` in the mobile
   tab layout, the test's `AppDeps`).
4. Derive types, do not repeat them: `z.infer<typeof Schema>`, `ReturnType<typeof factory>`,
   `(typeof LIST)[number]`, `keyof typeof MAP`.
5. Literal unions from `as const` arrays or objects; no TypeScript `enum`
   (`MEMBER_ROLES`, `PLANS`, `ENTITLEMENTS`, `SURFACES`).
6. Mark promises you do not await with `void` (`void shutdown('SIGINT')`). Type-aware lint for
   floating promises is not configured (GAP-STD16-03 in
   [1MM-STD-16](1MM-STD-16-DEFENSIVE-PROGRAMMING.md)).
7. Unused parameters are prefixed `_` (`_payload`, `_deps`).

### 1.1 The mobile app's compiler settings

`apps/mobile/tsconfig.json` extends `expo/tsconfig.base` and adds `strict`,
`noUncheckedIndexedAccess` and the `@/*` → `./src/*` path alias. It does not get
`noImplicitOverride`, `noFallthroughCasesInSwitch`, `verbatimModuleSyntax`, `isolatedModules` or
`forceConsistentCasingInFileNames` from the base (GAP-STD14-03). Write mobile code as if they were
on; ESLint's type-import rule already applies there.

## 2. SOLID and clean architecture, as applied here

| Principle             | How this codebase applies it                                                                                                                | Where to see it                                                                   |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Single responsibility | One use case per file in `application/`; one job per file in `apps/worker/src/jobs/`; one component per file                                | `check-readiness.ts`, `partitions-ensure.ts`                                      |
| Open / closed         | New behaviour is a new file added to a registry; the runner, the surface router factory and the token build are not edited to add a feature | `apps/worker/src/jobs/index.ts`, `apps/api/src/surfaces/index.ts`                 |
| Liskov substitution   | Any adapter that satisfies a port can replace another, including in tests                                                                   | `createMemoryRateLimiter` and `createRedisRateLimiter` both satisfy `RateLimiter` |
| Interface segregation | Ports are small and named for one need; dependencies are narrowed (`Pick<Env, 'APP_ENV' \| 'APP_VERSION' \| 'CORS_ALLOWED_ORIGINS'>`)       | `DependencyProbe`, `AppDeps`                                                      |
| Dependency inversion  | Domain and application code depend on ports; concrete infrastructure is created only in the composition root and passed in                  | `apps/api/src/main.ts`, `createApp(deps)`                                         |

Style that follows from this:

- **Functions and factories, not classes.** A use case is `createX(deps)` returning a function; a
  router is `createXRouter(deps)`. The one class is `ProblemError`.
- **No module-level state and no singletons** in the API or worker. Clients (database, Redis) are
  created in `main.ts` and injected, so tests build an app in memory (`app.test.ts`).
- **Pure where possible.** `packages/entitlements` holds only vocabulary and pure rules; the
  values live in the database.

## 3. Boundaries

### 3.1 API module layers

`apps/api/src/modules/<name>/` has exactly four folders and an `index.ts`.

| Layer             | Holds                                                           | May import                                                                                                                                      | Must not import                                                                                  |
| ----------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `domain/`         | Rules, value types, and the ports (interfaces) the module needs | Nothing outside the module except shared packages of pure types and rules (`@1minitman/contracts` schemas and types, `@1minitman/entitlements`) | `hono`, `@hono/*`, `drizzle-orm`, `postgres`, `bun`, anything under `infrastructure/` or `http/` |
| `application/`    | Use cases: one function per thing the module does               | `domain/`                                                                                                                                       | The same list                                                                                    |
| `infrastructure/` | Adapters: database queries, Redis, vendor clients               | `domain/`, `@1minitman/db`, libraries                                                                                                           | `http/` (by convention)                                                                          |
| `http/`           | Routes: parse, call a use case, shape the response              | `application/`, `@1minitman/contracts/routes`, `platform/http`                                                                                  | `infrastructure/` (by convention; wiring happens in the composition root)                        |
| `index.ts`        | The module's public face: re-exports only what other code needs | —                                                                                                                                               | —                                                                                                |

### 3.2 What lint enforces (`eslint.config.mjs`)

| Rule                                                                                                                                                           | Scope                                            | Message a violation gets                                                               |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------- |
| No relative path into another workspace (`../../packages/…`)                                                                                                   | `apps/**`, `packages/**`                         | "Import another workspace by its package name (@1minitman/...), not by path."          |
| No reaching into a package's `src` or `dist` (`@1minitman/*/src/**`)                                                                                           | same                                             | "Use the package's public exports …"                                                   |
| Nothing imports an app (`@1minitman/api`, `worker`, `admin`, `web`, `site`, `mobile`)                                                                          | same                                             | "Apps are deployables: nothing imports an app. Move shared code to a package."         |
| Code outside `modules/` imports a module only through its index (`**/modules/*/*/**` is banned)                                                                | `apps/api/src/**` except `modules/**`            | "Import from the module's index (modules/<name>), not from inside it."                 |
| `domain/` and `application/` never import `hono`, `hono/*`, `@hono/*`, `drizzle-orm`, `drizzle-orm/*`, `postgres`, `bun`, `**/infrastructure/**`, `**/http/**` | `apps/api/src/modules/*/{domain,application}/**` | "Domain and application layers depend on ports only, never on frameworks or adapters." |

Not enforced by lint, so enforced in review: one module importing another module's inner folders
(the index rule above excludes files inside `modules/`); `infrastructure/` ↔ `http/` imports;
layering in the worker (GAP-STD14-05). **Recommendation:** a module that needs another module's
behaviour depends on a port in its own `domain/` and receives the other module's use case in the
composition root (this is also how [coordinator ruling R7](../execution/1MM-EXE-00-MASTER-PLAN.md#7-coordinator-rulings)
stubs a later module).

One consequence of the last lint rule: `ProblemError` lives in
`apps/api/src/platform/http/problem.ts`, whose path matches `**/http/**`, so `domain/` and
`application/` code cannot import it today although its own comment says they throw it
(GAP-STD14-01).

### 3.3 Packages

| Rule                                                                                  | Enforced by                             |
| ------------------------------------------------------------------------------------- | --------------------------------------- |
| Every workspace is `"private": true`                                                  | `pnpm check:repo`                       |
| Every package declares `exports`; only what is exported can be imported               | `pnpm check:repo` + the lint rule above |
| A workspace depends on another only as `"workspace:*"`                                | `pnpm check:repo`                       |
| No workspace depends on an app                                                        | `pnpm check:repo` + lint                |
| `react`, `react-dom`, `react-native`, `typescript`, `zod` use `"catalog:"` everywhere | `pnpm check:repo`                       |

The **version catalogue** in `pnpm-workspace.yaml` declares one version of every shared dependency
(`typescript`, `zod`, `react`, `react-dom`, their types, `vite`, `tailwindcss`,
`@tailwindcss/vite`, `hono`, `@hono/zod-openapi`, `drizzle-orm`, `postgres`, `bun`, `@types/bun`,
`@tanstack/react-query`, `react-native`). A dependency used by two workspaces goes in the
catalogue and is referenced as `"catalog:"`. React Native is pinned to the exact version the Expo
SDK ships with.

Which package is for what:

| Package                                     | Holds                                                                         | Imported by                            | Must stay free of                                          |
| ------------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------- | ---------------------------------------------------------- |
| `@1minitman/contracts`                      | zod schemas (`.`), route definitions (`./routes`), typed clients (`./client`) | Everything; `./routes` by the API only | Server code in `.`; `@hono/zod-openapi` outside `./routes` |
| `@1minitman/db`                             | Migrations, migrator, `createDatabase`, Drizzle models (`./schema`)           | API, worker                            | Being imported by any client                               |
| `@1minitman/entitlements`                   | Roles, plans, entitlement keys, pure rules                                    | API, mobile                            | I/O of any kind                                            |
| `@1minitman/i18n`                           | Locales and bundled catalogues                                                | API, site, mobile                      | Framework code                                             |
| `@1minitman/tokens`                         | Design tokens and their build                                                 | UI packages, site, mobile              | Runtime dependencies                                       |
| `@1minitman/ui-web`, `@1minitman/ui-native` | Shared components                                                             | admin, web / mobile                    | Data fetching, copy, business rules                        |

## 4. Naming

Patterns are taken from the schema seeds and the existing code. Do not invent a new pattern;
find the neighbour and match it.

### 4.1 Code

| Thing                   | Pattern                                                                                                                       | Examples in the repo                                                               |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| File                    | lower kebab-case; routes `<module>.routes.ts`; tests `<subject>.test.ts` ([1MM-STD-09 §7](1MM-STD-09-FORMATTING.md))          | `check-readiness.ts`, `system.routes.ts`                                           |
| Type, interface         | PascalCase noun; no `I` prefix; props `<Name>Props`; dependencies `<Name>Deps`                                                | `DependencyProbe`, `ReadinessReport`, `SystemRouterDeps`, `ButtonProps`            |
| Function, variable      | camelCase verb phrase                                                                                                         | `loadEnv`, `planForRole`, `clientIp`                                               |
| Factory                 | `create<Thing>` returning the thing; its type is `ReturnType<typeof create…>`                                                 | `createApp`, `createCheckReadiness`, `createDatabase`, `createLogger`              |
| Adapter                 | `<technology><Port>`                                                                                                          | `postgresProbe`, `redisProbe`, `createRedisRateLimiter`, `createMemoryRateLimiter` |
| Predicate               | `is…`, `has…`                                                                                                                 | `isVerified`, `isGranted`, `hasRoom`, `isLocale`                                   |
| Module-level constant   | UPPER_SNAKE; unit in the name                                                                                                 | `TIMEOUT_MS`, `MONTHS_AHEAD`, `PARTITIONED_TABLES`, `SURFACE_NAMES`                |
| zod schema              | PascalCase + `Schema`; inferred type has the same name without the suffix; OpenAPI component id via `.meta({ id: 'Health' })` | `HealthSchema` → `Health`, `ProblemSchema` → `Problem`, `CursorQuerySchema`        |
| Schema helper (generic) | camelCase function                                                                                                            | `cursorPage(item)`                                                                 |
| Route definition        | camelCase + `Route`, one per operation, with `tags` and `summary`                                                             | `healthRoute`, `readinessRoute`                                                    |
| Wire fields (JSON)      | snake_case                                                                                                                    | `request_id`, `next_cursor`, `has_more`, `latency_ms`                              |
| React component         | PascalCase named export; hooks `use…`                                                                                         | `AppShell`, `StatusBadge`, `useTheme`, `useHaptic`                                 |
| Query options           | camelCase + `Query`; key is an array from general to specific                                                                 | `healthQuery` with `['system', 'health']`                                          |
| Test id                 | Dotted `<area>.<group>.<element>`; screen roots `screen.<ID>`                                                                 | `overview.status.api`, `welcome.cta.getStarted`, `screen.D1`                       |
| Environment variable    | UPPER_SNAKE; client-visible ones start `VITE_`, `PUBLIC_` or `EXPO_PUBLIC_`                                                   | `DATABASE_URL`, `VITE_API_URL`                                                     |

### 4.2 Data and platform identifiers

| Thing                                   | Pattern                                                                                                                                                                                                                                                                                                                                                                          | Examples from the sources                                                                                                 |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Table                                   | lower snake_case, plural                                                                                                                                                                                                                                                                                                                                                         | `role_entitlements`, `admin_audit_log`, `notification_templates` [SQL]                                                    |
| Column                                  | lower snake_case; timestamps `…_at`; booleans `is_…`, `…_enabled`; money `…_usd_cents`; foreign keys `<thing>_id`                                                                                                                                                                                                                                                                | `created_at`, `is_kill_switch`, `amount_usd_cents` [SQL]                                                                  |
| Enum type                               | `<name>_t`; values lower snake_case (the role ladder is upper-case)                                                                                                                                                                                                                                                                                                              | `plan_t` (`free`, `premium`, `gold`), `member_role_t` [SQL]                                                               |
| Index, trigger, view, materialised view | `idx_<table>_<what>`, `trg_<table>_<what>`, `v_<name>`, `mv_<name>`                                                                                                                                                                                                                                                                                                              | `idx_cities_search`, `trg_cities_upd`, `v_role_drift` [SQL]                                                               |
| Migration file                          | `NNNN_lower_snake_title.sql`                                                                                                                                                                                                                                                                                                                                                     | `0006_partition_function_definer.sql`                                                                                     |
| Job                                     | `<area>.<action>`, lower snake segments joined by dots (a test asserts `^[a-z_]+(\.[a-z_]+)+$`); the name comes from the job catalogue                                                                                                                                                                                                                                           | `partitions.ensure`, `media.process`, `intro.audio.purge` [TR §11], `worker_jobs` seed                                    |
| WebSocket event                         | `<object>.<event>`                                                                                                                                                                                                                                                                                                                                                               | `match.created`, `message.new`, `entitlements.changed` [TR §8.3]                                                          |
| Admin stream event                      | `<object>.<event>`                                                                                                                                                                                                                                                                                                                                                               | `queue.counts`, `approval.decided` [ADM §1.6]                                                                             |
| Audit action                            | `area.object.verb`; an approval-gated action writes `….request` when requested                                                                                                                                                                                                                                                                                                   | `member.pii.reveal` [ADM App. E]                                                                                          |
| Analytics event                         | `screen.action`, tied to the screen code. Names are proposed by modules and published by MOD-18 (ruling R17)                                                                                                                                                                                                                                                                     | `d1.reaction.like`, `pm8.prompt.save` [TR §14]                                                                            |
| Remote-config key                       | `<area>.<setting>`, lower snake segments; unit in the name                                                                                                                                                                                                                                                                                                                       | `discovery.daily_cap.basic`, `intro.window_hours`, `discovery.pass_undo_seconds` [SQL]                                    |
| Feature flag                            | `<area>.<flag>`                                                                                                                                                                                                                                                                                                                                                                  | `calls.enabled`, `locale.fr`, `registration.open` [SQL]                                                                   |
| Rate-limit policy                       | `<action>.<subject>`                                                                                                                                                                                                                                                                                                                                                             | `otp.send`, `login.ip`, `reactions.user` [SQL]                                                                            |
| Admin permission                        | `<resource>.<action>`, sub-resource in the middle                                                                                                                                                                                                                                                                                                                                | `users.read`, `users.pii.read`, `badges.review` [SQL]                                                                     |
| Admin role                              | lower snake_case                                                                                                                                                                                                                                                                                                                                                                 | `super_admin`, `trust_safety_lead` [SQL]                                                                                  |
| Entitlement key                         | `<area>.<capability>`, lower snake                                                                                                                                                                                                                                                                                                                                               | `chat.full`, `discovery.specs_per_day`, `groups.own_max` (`packages/entitlements/src/keys.ts`)                            |
| Product code                            | lower snake_case                                                                                                                                                                                                                                                                                                                                                                 | `black_badge`, `premium_monthly`, `gold_monthly` [SQL]                                                                    |
| Notification template                   | Code `N01`…`N36` (member) and `W01`…`W08` (website); keys `n01.title`, `n01.body`                                                                                                                                                                                                                                                                                                | `notification_templates` seed                                                                                             |
| i18n key                                | Dotted, lower-case. Seeds use lower snake segments (`product.black_badge`, `opt.faith_practice`, `q.traits`); the 12 scaffold keys use camelCase segments (`common.getTheApp`). New keys follow the seeds: lower snake_case segments ([ADR-0079](../adrs/1MM-ADR-0079-I18N-KEY-NAMING.md), GAP-STD14-02); the full rule is in [1MM-STD-17](1MM-STD-17-LANGUAGE-CONFIGURATION.md) | `packages/i18n/src/locales/en.json`, [SQL]                                                                                |
| Redis key                               | Colon-separated, lower-case, ids in braces in documentation                                                                                                                                                                                                                                                                                                                      | `ent:{user_id}`, `sess:deny:{session}`, `quota:specs:{user_id}:{local_date}`, `rl:<policy>:<subject>` [DD §14], [TR §8.1] |
| Screen, admin module, website module id | Exactly as in the sources                                                                                                                                                                                                                                                                                                                                                        | `D1`, `MF2`, `A12`, `W22`                                                                                                 |

A name in this table that your code needs and that no source contains is a gap, not a naming
exercise.

## 5. Module anatomy: the `system` module

```
apps/api/src/modules/system/
  domain/dependency-probe.ts        the port DependencyProbe { name; ping() } and DependencyStatus
  application/check-readiness.ts    createCheckReadiness(probes) → () => Promise<ReadinessReport>
  infrastructure/probes.ts          postgresProbe(database), redisProbe(redis): adapters for the port
  http/system.routes.ts             createSystemRouter(deps): healthRoute, readinessRoute handlers
  index.ts                          the public face: the factory, the adapters, the router, their types
```

How the pieces meet:

1. **Contract first.** `packages/contracts/src/schemas/system.ts` defines `HealthSchema` and
   `ReadinessSchema`; `packages/contracts/src/routes/system.ts` defines `healthRoute` and
   `readinessRoute` with `createRoute` ([1MM-STD-06](1MM-STD-06-API-FIRST.md)).
2. **Port.** `domain/` states what the module needs from the world, in its own words.
3. **Use case.** `application/` takes ports, returns a function, holds the rule (ask every
   dependency in parallel, 2 s timeout, summarise). It imports only `domain/`.
4. **Adapters.** `infrastructure/` implements the port with `@1minitman/db` and Bun's Redis client.
5. **Route.** `http/` builds a router with `createRouter()` from `platform/http/router` (so a
   validation failure is always problem+json), registers each contract route with `.openapi()`,
   calls the use case and returns the status the contract declares.
6. **Composition.** `apps/api/src/main.ts` is the only file that creates the database and Redis
   clients. It builds the adapters, the use case and `createApp(deps)`. A feature module's router
   is registered on its surface in `apps/api/src/surfaces/index.ts` (`member`, `public`, `admin`),
   or on the webhooks router.
7. **Test.** `apps/api/src/app.test.ts` builds the app with fake probes and an in-memory rate
   limiter and calls `app.request(...)`. No network, no mocks of our own code.

Platform code that every module shares lives in `apps/api/src/platform/` (`http/`, `logger.ts`,
`rate-limit/`), each folder with an `index.ts` where it has more than one file. Settings live in
`apps/api/src/config/env.ts`.

Rules for a new module:

1. The folder name is the module's noun, lower kebab-case; the four layer names are fixed.
2. A handler does three things: read validated input (`c.req.valid(...)`), call one use case,
   return a contract-shaped response. No SQL, no business rule, no vendor call.
3. A use case returns data or throws a typed error; it never returns a `Response` and never reads
   the Hono context.
4. Adapters return domain types, not rows or vendor payloads.
5. Rate limits are attached with `rateLimit()` using a policy name seeded in
   `rate_limit_policies`; never an invented limit.
6. Export from `index.ts` only what the composition root or another module's port needs.

## 6. Worker job anatomy

```ts
// apps/worker/src/jobs/partitions-ensure.ts
export const partitionsEnsure = defineJob({
  name: 'partitions.ensure',
  cron: '0 3 1 * *', // 03:00 UTC on the 1st of each month
  async handle(_payload, { database, log }) { … },
});
```

| Rule                                 | Detail                                                                                                                                                                                                                 |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One file per job                     | In `apps/worker/src/jobs/`, named after the job with dots as hyphens; exported as a camelCase constant                                                                                                                 |
| `defineJob({ name, cron?, handle })` | From `apps/worker/src/platform/job.ts`. `name` comes from the job catalogue [TR §11] / the `worker_jobs` seed                                                                                                          |
| Register                             | Add the constant to the array in `jobs/index.ts`. The runner is not edited                                                                                                                                             |
| Schedule                             | `cron` jobs are scheduled by the worker in UTC; jobs without `cron` run when the API enqueues them. Where the schedule lives long-term is GAP-MOD00-02 in [1MM-EXE-MOD-00](../execution/1MM-EXE-MOD-00-FOUNDATIONS.md) |
| Context                              | The handler receives `JobContext` (`database`, `log`). It depends on that, never on a concrete client it creates itself                                                                                                |
| Payload                              | Ids only: never secrets, tokens, codes or personal data. Payloads are stored in the queue tables in plain text. The handler loads what it needs by id. Parsing the payload with zod is GAP-STD16-01                    |
| Idempotent                           | A job may run twice (retry, restart). Design every handler so a second run is harmless                                                                                                                                 |
| Database role                        | The worker connects as `app_worker` (no schema changes); the queue as `app_queue`                                                                                                                                      |
| Log                                  | One `log()` call per meaningful step, with ids and counts, never content                                                                                                                                               |
| Test                                 | `jobs.test.ts` asserts names are unique and match the naming pattern; each job adds its own behaviour test                                                                                                             |

## 7. React conventions: admin console and web app

| Topic           | Convention                                                                                                                                                                                                 | Source                                                             |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Entry           | `main.tsx`: `initTheme()` before render, one `QueryClient`, one router with `context: { queryClient }` and `defaultPreload: 'intent'`, the `Register` module augmentation                                  | `apps/admin/src/main.tsx`                                          |
| Routing         | TanStack Router, file-based under `src/routes/`. Each file exports `Route = createFileRoute('<path>')({ … })`; the page component is a function declaration below it. `routeTree.gen.ts` is generated      | `apps/admin/src/routes/`                                           |
| Unbuilt modules | Fall through to `routes/$.tsx`, which reads `shell/navigation.ts`. Building a module adds its own route file                                                                                               | `apps/admin/src/routes/$.tsx`                                      |
| API access      | Only the typed client from `@1minitman/contracts/client` (`createAdminClient`, cookie credentials included). No hand-written `fetch` to our API                                                            | `apps/admin/src/lib/api.ts`, [1MM-STD-06](1MM-STD-06-API-FIRST.md) |
| Server state    | TanStack Query. Define `queryOptions({ queryKey, queryFn, … })` objects and pass them to `useQuery`; check both `data` and `error` from the client and throw on failure so the query's error state is real | `healthQuery`, `readinessQuery`                                    |
| Query keys      | Arrays, general to specific: `['<area>', '<resource>', params]`. Mutations invalidate by prefix                                                                                                            | repo pattern                                                       |
| URL state       | Filters, sort, cursor and the open drawer id live in the URL, never in component state                                                                                                                     | [ADM §1.4], [ADM A01]                                              |
| Local state     | `useState` / `useReducer` in the component that owns it. **Recommendation:** no global client store in the admin or web app; server state is Query's, navigation state is the router's                     | Recommendation                                                     |
| Forms           | react-hook-form with the zod schemas shared from `packages/contracts`; validate on blur and submit; focus the first invalid field                                                                          | [ADM A01]                                                          |
| Writes          | Send `Idempotency-Key` (a UUID generated when the dialog opens) and `If-Match` where the row has a version; a 412 shows the reload message                                                                 | [ADM §1.4]                                                         |
| Tables          | TanStack Table through the shared `DataTable`; cursor pagination only                                                                                                                                      | [TR §7.1], [ADM §1.4]                                              |
| Components      | Shared ones from `@1minitman/ui-web`; app folders hold routes, the shell and screen-specific composition. Named exports; props typed inline or as `<Name>Props`                                            | [1MM-STD-20](1MM-STD-20-DESIGN-SYSTEM.md)                          |
| Hooks           | Rules of hooks are lint-enforced. A custom hook owns one concern and returns an object or a function                                                                                                       | `useTheme`                                                         |
| Effects         | An effect synchronises with something outside React (DOM attribute, storage, subscription). Data fetching is never in an effect                                                                            | `theme.ts`                                                         |
| Permissions     | The UI hides what a role cannot do, and never relies on hiding: the API decides                                                                                                                            | [TR §7.1]                                                          |
| Copy            | From the i18n catalogue or the API; the scaffold's inline strings are placeholders to be replaced as modules land                                                                                          | owner rule 4                                                       |
| Test hooks      | `data-testid` on every interactive element                                                                                                                                                                 | [WEB §4.0], [TR §2.4]                                              |

The web app (`apps/web`) is billing only [TR §6.2] and follows the same conventions; it has no
router yet.

## 8. Astro conventions: the website

| Topic          | Convention                                                                                                                                                                    | Source                                                     |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Output         | `output: 'static'`. No server code, no secrets, nothing a build cannot know                                                                                                   | `apps/site/astro.config.mjs`                               |
| Pages          | `src/pages/`; English at the root, `/pcm/…` and `/fr/…` beside it through `[locale]/` and `getStaticPaths`; never auto-redirect by locale                                     | `astro.config.mjs`, `pages/[locale]/index.astro`           |
| Page body      | A page file is thin: it picks the locale and renders a component, so the three locales share one implementation                                                               | `HomePage.astro`                                           |
| Layout         | Every page uses `BaseLayout` with `locale`, `title` (≤ 60 characters), `description` (≤ 155), `path`; it sets `lang`, canonical, hreflang, the theme script and the skip link | `BaseLayout.astro`                                         |
| Props          | Typed with `interface Props` in the frontmatter; destructure from `Astro.props`                                                                                               | repo pattern                                               |
| Copy and links | `createTranslator(locale)` from `@1minitman/i18n`; `localizedPath(locale, path)` for every internal link; navigation entries appear only when `ready`                         | `Header.astro`, `lib/navigation.ts`                        |
| Content        | Rendered from the CMS through `/public/v1` with the typed public client; nothing a person reads is hard-coded except ids                                                      | [TR §6.1], [WEB §4.0]                                      |
| Client script  | Small, inline, progressive: the page works with JavaScript off. No framework island unless a module's budget allows it                                                        | [WEB §4.0], [1MM-STD-20 §5.2](1MM-STD-20-DESIGN-SYSTEM.md) |
| Settings       | Declared in `env.schema` (`envField`), `PUBLIC_` prefix, validated at build                                                                                                   | `astro.config.mjs`                                         |
| Storage        | Every `localStorage` read and write is in `try` / `catch`                                                                                                                     | `BaseLayout.astro`, [WEB §3.1]                             |
| Type check     | `astro check` (`pnpm typecheck`); ESLint and Prettier do not read `.astro` yet ([1MM-STD-09 §5.2](1MM-STD-09-FORMATTING.md))                                                  | repo                                                       |

## 9. React Native and Expo Router conventions

| Topic                  | Convention                                                                                                                                                         | Source                                    |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------- |
| Routes                 | `apps/mobile/src/app/`; groups in parentheses (`(tabs)`), `_layout.tsx` per group; route names follow the screen inventory. Typed routes are on                    | `app.config.ts`, `docs/USAGE.md`          |
| Screen file            | Default-exported function `<Name>Screen` (Expo Router needs the default export); a first comment names the screen id; the root view carries `testID="screen.<ID>"` | `(tabs)/specs.tsx`                        |
| Imports inside the app | The `@/` alias for `src/`; packages by name                                                                                                                        | `apps/mobile/tsconfig.json`               |
| Providers              | All in `providers/app-providers.tsx` (gesture root, safe area, Query, theme), so the root layout is only about routing and gates                                   | repo                                      |
| Components             | From `@1minitman/ui-native`. Text only through its `Text`; app-local components only when one screen uses them                                                     | [1MM-STD-20](1MM-STD-20-DESIGN-SYSTEM.md) |
| Styling                | NativeWind classes from the token preset; `useThemeColor(name)` where an API needs a raw colour. No `StyleSheet` colours, no hex                                   | `(tabs)/_layout.tsx`                      |
| Server state           | TanStack Query with `queryOptions`, the member client from `@1minitman/contracts/client`                                                                           | `lib/api.ts`                              |
| Local state            | Zustand for app-local state; the offline outbox persisted in MMKV                                                                                                  | [TR §5.1]                                 |
| Forms                  | react-hook-form + the shared zod schemas                                                                                                                           | [TR §5.1]                                 |
| Lists and gestures     | FlashList; Gesture Handler + Reanimated, and the buttons always work without swiping                                                                               | [TR §5.1]                                 |
| Secrets and tokens     | Refresh tokens in `expo-secure-store` only; never in MMKV, AsyncStorage or the bundle                                                                              | [TR §5.1], `lib/env.ts`                   |
| Settings               | `lib/env.ts`: each `EXPO_PUBLIC_` variable is written out by name, because Expo only inlines literal references                                                    | `lib/env.ts`                              |
| Haptics                | `useHaptic(kind)` from `lib/haptics.ts`; never `expo-haptics` directly                                                                                             | [TR §2.5]                                 |
| Ids                    | Messages and reactions carry client-generated ids so a replay is idempotent                                                                                        | [TR §5.3]                                 |
| Accessibility          | `accessibilityRole`, `accessibilityLabel` in context, `accessibilityState`; `testID` copied from the design's `data-testid`                                        | [TR §2.4], [CN handoff]                   |
| Entitlements           | UI hints from `@1minitman/entitlements` and `GET /v1/me/entitlements`; the API still decides                                                                       | [TR §4.5]                                 |

The scaffold's tab titles call `translate('en', …)` with a fixed locale and some screens hold
inline strings; both are placeholders until the locale and catalogue work of MOD-02 lands.

## 10. Error handling

The registry of codes, statuses and client presentation is
[1MM-STD-13](1MM-STD-13-ERROR-CODES.md); defensive patterns are in
[1MM-STD-16](1MM-STD-16-DEFENSIVE-PROGRAMMING.md). The coding rules:

1. Every API error leaves as RFC 9457 problem+json with a request id [TR §8.1]. Code throws
   `ProblemError`; `errorHandler` formats it. Handlers never build an ad-hoc error body.
2. Routers are created with `createRouter()` so validation failures share one shape.
3. An unexpected error is logged with its stack and returned as a 500 that carries no internals.
4. Throw `Error` objects, never strings. Narrow `unknown` in `catch` before reading it.
5. Never swallow an error. An empty `catch` is allowed only where failing is the designed
   outcome, with a comment saying so (storage blocked in `theme.ts`; haptics in `haptics.ts`).
6. Clients check the `{ data, error }` pair the typed client returns and turn a failure into the
   query's error state; they do not render on `data` alone.
7. Expected outcomes are not exceptions: a degraded readiness report is a value with its own
   status, not a throw.
8. Timeouts and cleanup go in `try` / `finally` (`check-readiness.ts` clears its timer).

## 11. Logging

| Rule         | Detail                                                                                                                                                                                                                  |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One logger   | The API uses the `Logger` from `apps/api/src/platform/logger.ts` (`debug`, `info`, `warn`, `error`, `child`). Handlers take the request logger from the context (`c.get('logger')`), which already carries `request_id` |
| Shape        | One JSON object per line: `time`, `level`, `message`, base fields (`service`, `env`), then the call's fields [TR §14]                                                                                                   |
| Message      | A short constant phrase (`'request'`, `'job done'`); variable data goes in fields, never interpolated into the message                                                                                                  |
| Field names  | snake_case with the unit: `duration_ms`, `request_id`                                                                                                                                                                   |
| Never logged | Message bodies, passwords, codes, tokens, face data, card data; query strings (the request log records the path only); personal data beyond an id [TR §14]                                                              |
| Levels       | `error`: we failed and someone should look. `warn`: degraded but served (limiter unavailable). `info`: lifecycle and one line per request or job. `debug`: local diagnosis                                              |
| `console.*`  | ESLint leaves `no-console` off because the logger and the scripts write to the console. Application code in the API does not call `console` directly                                                                    |
| Worker       | The worker currently builds its own JSON line in `main.ts` and does not apply `LOG_LEVEL` (GAP-STD14-04)                                                                                                                |

## 12. Configuration and environment access

1. **Environment variables are read in exactly one module per workspace**, validated with zod
   (or Astro's `env.schema`) when the process or app starts:

   | Workspace                | Module                          | Reads                                           |
   | ------------------------ | ------------------------------- | ----------------------------------------------- |
   | `apps/api`               | `src/config/env.ts` (`loadEnv`) | `process.env`                                   |
   | `apps/worker`            | `src/config/env.ts` (`loadEnv`) | `process.env`                                   |
   | `apps/admin`, `apps/web` | `src/lib/env.ts` (`env`)        | `import.meta.env`, `VITE_` names only           |
   | `apps/site`              | `astro.config.mjs` `env.schema` | `PUBLIC_` names only                            |
   | `apps/mobile`            | `src/lib/env.ts` (`env`)        | `process.env.EXPO_PUBLIC_…`, each named in full |

   No other file touches `process.env` or `import.meta.env`. Not lint-enforced (GAP-STD14-05).

2. A missing or malformed variable stops start-up with a message that names it and points at
   `.env.example`.
3. Every variable is added to `.env.example` with what it is for and where it comes from. One file
   at the repository root feeds every app.
4. Code receives the narrow slice it needs (`Pick<Env, …>`), not the whole environment.
5. Only names starting `VITE_`, `PUBLIC_` or `EXPO_PUBLIC_` reach a client, and nothing secret
   ever has one. `pnpm check:client-bundles` scans the built bundles for server-only names and
   values.
6. **Business values are not environment variables.** Limits, timings, switches and copy live in
   `remote_config`, `feature_flags`, `rate_limit_policies`, `role_entitlements`, `i18n_strings`
   and the CMS, are served by the API and edited in the admin console (owner rule 4). The
   environment holds only connection strings, credentials, origins and build-time addresses.
7. Secrets are never committed, logged, placed in a job payload or returned by an endpoint
   ([1MM-STD-11](1MM-STD-11-SECURITY-AND-COMPLIANCE.md)).

## 13. Dates, money and ids

### 13.1 Dates and time

| Rule                                                                                                               | Source                                      |
| ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------- |
| The database stores `timestamptz` in UTC; every connection runs with `TimeZone = 'UTC'` (`createDatabase` sets it) | [SQL] preamble, `packages/db/src/client.ts` |
| Mutable tables have `created_at` and `updated_at` (trigger `set_updated_at`); code does not set `updated_at`       | [SQL] preamble                              |
| The API sends and accepts ISO 8601 UTC strings (`new Date().toISOString()`)                                        | `system.routes.ts`                          |
| Cron expressions are UTC                                                                                           | `apps/worker/src/platform/runner.ts`        |
| "Per day" member limits reset at the member's local midnight; keys carry `{local_date}`                            | [DD §14], `remote_config` seed              |
| Clients format dates for display in the viewer's locale and zone; the admin console shows WAT with UTC on hover    | [ADM A01]                                   |
| Durations carry their unit in the name: `_ms`, `_seconds`, `_hours`, `_days`, `windowSeconds`, `TIMEOUT_MS`        | repo and seed pattern                       |
| Never store or compare a formatted date string; never do date arithmetic on local time                             | Recommendation                              |

### 13.2 Money

| Rule                                                                                                                                                              | Source                                      |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Amounts are integer US cents: the `usd_cents` domain (`bigint`, non-negative), columns named `…_usd_cents`                                                        | [SQL] preamble                              |
| List prices are USD only, versioned in `prices`; a price change inserts a new version and closes the old row, never an update in place                            | [TR §4.6], [SQL] `prices`                   |
| Stores show local currency; what was actually charged is recorded beside the USD amount (`transactions.charged_currency`); currency codes are upper-case ISO 4217 | [TR §4.6], [SQL]                            |
| Revenue is aggregated in US cents                                                                                                                                 | [TR §4.6]                                   |
| No floating-point money anywhere: no `2.5`, no `amount / 100` stored or compared. Convert to a display string only at the edge                                    | Recommendation                              |
| Display format: `$2.50`, two decimals, "/mo" or "a month", "one-off" for the Black Badge                                                                          | [1MM-STD-04 §14](1MM-STD-04-BRAND-GUIDE.md) |
| Prices, proration and refunds are computed by the API's entitlement and billing code, never by a client                                                           | [TR §4.6]                                   |
| In contracts, money fields are integer numbers named `…_usd_cents`                                                                                                | Recommendation, following the column names  |

### 13.3 Ids

| Rule                                                                                                                        | Source                        |
| --------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| Entity primary keys are UUID v7, generated by the database default `uuid_v7()`; code does not invent another scheme         | [TR §10.2], [SQL]             |
| Ids created on the device (messages, reactions in the offline outbox) are UUID v7 too, so they stay unique and time-ordered | [SQL] preamble, [TR §5.3]     |
| Small catalogue tables use natural keys (`code`, `key`); append-only logs use `bigint` sequences                            | [SQL] preamble                |
| `Idempotency-Key` on payments, badge submit and exports; the admin console sends one on every write                         | [TR §8.1], [ADM §1.4]         |
| The request id is taken from a well-formed inbound `X-Request-Id` or generated, and returned on every response              | `platform/http/middleware.ts` |
| Ids are opaque: never parse meaning from one, never expose a sequence number to a member                                    | [TR §10.2]                    |
| Pagination is keyset: an opaque cursor encoding `(sort_key, id)`; never `OFFSET`                                            | [TR §8.1], [ADM §1.4]         |

## 14. Comments and documentation

1. A comment says **why**, or states a rule the code cannot show: a decision id, a source section,
   a constraint ("Path only: query strings can carry personal data.").
2. Exported functions, types and components get a one-or-two-line `/** … */` when the name alone
   is not enough. Props that are not obvious get their own doc line.
3. Cite the source by section where a rule comes from one ("Technical Reference 8.1", "OD-15"),
   so the next reader can check it. Do not paste source text.
4. A screen, admin module or website module id appears in a comment at the top of the file that
   implements it.
5. No commented-out code, no `TODO` without a task id or gap id, no change history in comments
   (Git has it).
6. Each generated file starts with "Generated by … Do not edit."
7. British English in comments, identifiers excepted where a platform API fixes the spelling.
8. Behaviour that other people rely on is documented where they will look: `docs/USAGE.md` for how
   to run and add things, the module plan for scope, an ADR for a decision.

## 15. Dependency rules

Supply-chain settings in `pnpm-workspace.yaml`:

| Setting                     | What it does                                                                                                        |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `onlyBuiltDependencies`     | Install scripts run only for the listed packages (`bun`, `esbuild`, `sharp`, `@tailwindcss/oxide`, `unrs-resolver`) |
| `strictDepBuilds: true`     | An install fails if any other dependency wants to run a build script                                                |
| `minimumReleaseAge: 4320`   | A version published less than three days ago is never resolved                                                      |
| `trustPolicy: no-downgrade` | A version whose publishing trust is weaker than an earlier version of the same package is refused                   |
| `nodeLinker: hoisted`       | Flat `node_modules`, required by Expo and React Native                                                              |
| `catalog:`                  | One version of each shared dependency (§3.3)                                                                        |

Working rules:

1. Before adding a dependency, check that the platform, the catalogue or an existing package does
   not already do the job. Each new dependency is named in the pull request with its reason,
   licence and size; `package.json`, the lockfile and `pnpm-workspace.yaml` are code-owned.
2. Add it to the workspace that uses it, never to the root (the root holds repository tooling
   only). If two workspaces use it, put it in the catalogue.
3. Adding a package to `onlyBuiltDependencies` is a security decision reviewed by a code owner.
4. CI installs with `--frozen-lockfile` and fails on a high or critical advisory
   (`pnpm audit:deps`). Dependabot does not open update pull requests (switched off on
   25 Nov 2026); an engineer proposes updates by pull request (the 3-day `minimumReleaseAge` still
   applies), and Dependabot alerts report vulnerable versions.
5. Server-only packages (`@1minitman/db`, `postgres`, `drizzle-orm`, `pg-boss`) are never a
   dependency of a client app or a UI package.
6. Expo-managed packages keep the versions the SDK expects (`~58.x`); change them with the SDK,
   not one by one.
7. Never work round a refused install by loosening one of the settings above.

## 16. What never to do

1. Import across a boundary in §3, or copy code between workspaces to avoid one.
2. Put a business rule in a route handler, a React component or a client.
3. Query the database from `http/` or `application/` code, or build SQL by joining strings.
4. Read `process.env` or `import.meta.env` outside the env module.
5. Hard-code copy, a limit, an option list, a price or a feature switch.
6. Call our API with a hand-written `fetch` or URL string.
7. Hand-edit a generated file, or edit an applied migration.
8. Use `any`, `@ts-ignore`, or a lint-disable comment without a stated reason.
9. Store money as a float, a timestamp as local time, or a token outside `expo-secure-store` or an
   HttpOnly cookie.
10. Put a secret, a code, a token or personal data in a log line, a job payload, an analytics
    event or an error message.
11. Add a class, a singleton or module-level mutable state where a factory with injected
    dependencies does the job.
12. Invent a name for a job, permission, config key, entitlement, event or error code that no
    source contains.
13. Write the retired plan's name or price, or call the Black Badge a subscription
    (`pnpm check:banned-terms`).
14. Skip, delete or weaken a test or a check to get a green run.

## 17. Review checklist

- [ ] The change belongs to one module task and follows API → admin → web → mobile.
- [ ] New code sits in the right layer and package; no boundary rule in §3 is bent.
- [ ] The contract (schema, route) changed first and `pnpm contracts:generate` was run.
- [ ] Names match §4 and every platform identifier exists in a source.
- [ ] No `any`, unchecked index, unexplained assertion or floating promise.
- [ ] Handlers are thin; use cases take ports; adapters are created only in the composition root.
- [ ] Errors use codes from [1MM-STD-13](1MM-STD-13-ERROR-CODES.md); nothing is swallowed.
- [ ] Logs carry ids and counts only; no sensitive field.
- [ ] Settings come through the env module; new variables are in `.env.example`; business values
      come from the database through the API.
- [ ] Times are UTC, money is integer cents, ids are UUID v7 or opaque.
- [ ] Jobs are idempotent and carry ids only.
- [ ] UI uses shared components and tokens ([1MM-STD-20](1MM-STD-20-DESIGN-SYSTEM.md)) and no
      hard-coded copy.
- [ ] Comments say why and cite the source; no dead code.
- [ ] New dependencies are justified, in the right workspace, and catalogue-pinned if shared.
- [ ] Tests cover the expected, the unexpected and a changed variable
      ([1MM-STD-01](1MM-STD-01-TESTING-STRATEGY.md)); `pnpm check` is green.

## 18. Gaps raised

Dispositions are recorded in [1MM-LOG-03](../1MM-LOG-03-TECHNICAL-REFERENCE-EXTENSIONS.md)
(Technical Reference and schema), [1MM-LOG-02](../1MM-LOG-02-UI-UPDATES.md) (UI) and
[1MM-LOG-04](../1MM-LOG-04-OPEN-DECISIONS-AND-FOLLOW-UPS.md) (owner decisions and repository
follow-ups).

| Gap id       | Type | Where found                                                                             | What is missing or conflicting                                                                                                                                                                                                                                                | Proposed resolution                                                                                                                                                                                                                                                       | Blocks                                            |
| ------------ | ---- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| GAP-STD14-01 | REPO | `apps/api/src/platform/http/problem.ts`, `eslint.config.mjs` (clean-architecture block) | The comment on `ProblemError` says domain and application code throws it, but the class lives under `platform/http/`, which the lint rule bans for those layers (`**/http/**`), and it takes a Hono status type. A use case cannot raise a typed error without breaking lint. | Move the throwable error (registry code, no framework types) to `apps/api/src/platform/errors.ts`; keep `problemResponse` and the handlers in `platform/http/`. Do it with `MOD-00-API-01`, which already reworks `ProblemError` (GAP-STD13-02).                          | First feature use case that must refuse a request |
| GAP-STD14-02 | REPO | `packages/i18n/src/locales/en.json` against the [SQL] seeds                             | The 12 scaffold keys use camelCase segments (`common.getTheApp`, `status.apiOnline`); every key in the schema seeds uses lower snake segments (`product.black_badge`, `opt.faith_practice`, `n01.title`). Two patterns cannot both be the rule for `i18n_strings`.            | Adopt the seeds' pattern for all keys and rename the scaffold keys when the catalogue sync is built (GAP-MOD00-03); confirm in [1MM-STD-17](1MM-STD-17-LANGUAGE-CONFIGURATION.md).                                                                                        | MOD-02 i18n API                                   |
| GAP-STD14-03 | REPO | `apps/mobile/tsconfig.json`                                                             | The mobile app does not extend `tsconfig.base.json` and so lacks `noImplicitOverride`, `noFallthroughCasesInSwitch`, `verbatimModuleSyntax`, `isolatedModules` and `forceConsistentCasingInFileNames`.                                                                        | Add those five options to `apps/mobile/tsconfig.json` (it must keep extending `expo/tsconfig.base`).                                                                                                                                                                      | none                                              |
| GAP-STD14-04 | REPO | `apps/worker/src/main.ts`, `apps/worker/src/config/env.ts`                              | The worker validates `LOG_LEVEL` but never uses it, and writes its own JSON line with no level, while the API has a `Logger`. The two services log in different shapes.                                                                                                       | Share one logger (move `createLogger` to a small package or copy the interface into the worker's `platform/`), give `JobContext` a `Logger`, apply `LOG_LEVEL`.                                                                                                           | MOD-00 observability                              |
| GAP-STD14-05 | REPO | `eslint.config.mjs`                                                                     | Three conventions in this document have no lint rule: env access outside the env module, cross-module imports inside `apps/api/src/modules/`, and layering inside the worker.                                                                                                 | Add `no-restricted-properties` / `no-restricted-syntax` for `process.env` and `import.meta.env` outside the env modules; extend the module-index rule to files inside `modules/` for other modules; add a worker rule that `jobs/` imports only `platform/` and packages. | none                                              |
| GAP-STD14-06 | REPO | `packages/entitlements/src/keys.ts`                                                     | The comment says "the API test suite compares the two" (the key list and the `entitlements` seed). No such test exists; the package test only checks that there are 25 keys.                                                                                                  | Add the comparison test with the entitlement resolver (ruling R2, MOD-03).                                                                                                                                                                                                | MOD-03 exit                                       |

## Change log

| Version | Date        | Change                                                                                    |
| ------- | ----------- | ----------------------------------------------------------------------------------------- |
| v1.0    | 24 Nov 2026 | First issue, from the scaffold's configuration and code and the Technical Reference v3.5. |
