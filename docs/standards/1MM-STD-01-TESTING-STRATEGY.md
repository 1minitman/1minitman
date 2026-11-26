# 1MM-STD-01 · Testing strategy

|              |                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Document** | 1MM-STD-01                                                                                                                                                                                                                                                                                                                                                                                         |
| **Status**   | Approved baseline · v1.1 · 26 Nov 2026                                                                                                                                                                                                                                                                                                                                                             |
| **Audience** | Engineers and coding agents                                                                                                                                                                                                                                                                                                                                                                        |
| **Owner**    | Engineering lead (code owners)                                                                                                                                                                                                                                                                                                                                                                     |
| **Sources**  | [TR §2.4], [TR §4.4], [TR §5.1], [TR §5.3], [TR §8.1], [TR §8.4], [TR §8.5], [TR §11], [TR §13.1–13.3], [TR §15.1], [TR §15.2], [TR §17.3]; [ADM §1.1–1.5], [ADM §1.7]; [WEB §3.6–3.8], [WEB §4.0]; [OD-10]; [SQL]; repo `.github/workflows/ci.yml`, `turbo.json`, `package.json`, `.husky/pre-commit`, existing `*.test.ts`                                                                       |
| **Related**  | [1MM-STD-06](1MM-STD-06-API-FIRST.md), [1MM-STD-13](1MM-STD-13-ERROR-CODES.md), [1MM-STD-16](1MM-STD-16-DEFENSIVE-PROGRAMMING.md), [1MM-STD-03](1MM-STD-03-MOBILE-BUILD-STRATEGY.md), [1MM-STD-10](1MM-STD-10-COMMITS-AND-LOCAL-CI.md), [1MM-STD-17](1MM-STD-17-LANGUAGE-CONFIGURATION.md), [1MM-DB-02](../database/1MM-DB-02-MIGRATIONS.md), [1MM-EXE-00](../execution/1MM-EXE-00-MASTER-PLAN.md) |

**What this document is for and when to open it.** It says how each app and package is tested,
what every test level must prove, which thresholds apply and where each is configured. Open it
when you write the "Tests" section of a module plan, when you add a test, when a threshold needs
changing, and when you sign a module's exit gate.

## 1. The three mandatory conditions

Every test level, for every app and package, covers three conditions. A change is not tested
until all three are present for it.

| #   | Condition            | Question it answers                                                                         | Typical cases                                                                                                                                                           |
| --- | -------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Expected**         | Given valid input and a normal state, does it do what the source says?                      | The happy path of each rule in the module plan, with the exact values from the sources                                                                                  |
| 2   | **Unexpected**       | Given wrong, hostile, duplicated, late or missing input, does it refuse safely and clearly? | Invalid and oversized input, wrong caller, another member's row, replay, double submit, out-of-order events, dependency down, malformed stored data, unknown enum value |
| 3   | **Variables change** | When a value that can change does change, does behaviour follow without a code change?      | The variables below                                                                                                                                                     |

The variables of condition 3, and how a test moves each one:

| Variable           | Values to exercise                                                                                                                                                            | How a test moves it                                                                               |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Config values      | The seeded value, the minimum, the maximum, a changed value (`remote_config`, `rate_limit_policies`); each feature flag on and off                                            | Write the row in the test database or inject the config port; never edit a constant               |
| Plan               | Free unverified, Free with Black Badge, Premium, Gold; a plan change mid-session; grace and lapse                                                                             | Factories set `users.role`; entitlements resolve from `role_entitlements` [TR §9]                 |
| Role (admin)       | Each seeded admin role, a scoped grant (country, city, queue), an expired grant, no permission                                                                                | Factories create the admin with role rows [ADM §1.1]                                              |
| Locale             | `en`, `pcm`, `fr`; a missing key (falls back to `en`); long strings; text at 200% [TR §2.4]                                                                                   | Locale parameter; pseudo-long catalogue                                                           |
| Time and time zone | Just before and just after every boundary (expiry, window, cooldown, local midnight); UTC, Africa/Lagos and a zone behind UTC; month and year ends; DST in a zone that has it | An injected clock ([1MM-STD-16](1MM-STD-16-DEFENSIVE-PROGRAMMING.md) section 9); the process `TZ` |
| Network            | Online, offline, slow (3G profile [TR §15.1]), a request that times out, a response lost after the server committed                                                           | Faked transport in client tests; throttling in Playwright; failing ports in API tests             |
| Concurrency        | Two actors at once, the same actor twice, a job overlapping a request                                                                                                         | Parallel connections against PostgreSQL [TR §17.3]                                                |
| Device size        | The size classes of [1MM-STD-03](1MM-STD-03-MOBILE-BUILD-STRATEGY.md); admin and website breakpoints (sections 3.4 and 3.6); light and dark; reduced motion                   | Viewports in Playwright; devices in Maestro                                                       |

Rules:

1. A test name says which condition and which rule it covers, for example
   `MOD-07 rule 4 · unexpected · second like from a blocked pair is refused`.
2. Values in tests come from the sources (seeded config, the entitlement matrix), read from the
   database or the contract, not retyped, so that a seed change breaks the right test.
3. A boundary is tested on both sides: request N allowed, request N+1 refused.
4. A test must be able to fail. A reviewer may ask the author to show it failing with the rule
   removed.

## 2. What exists today

| Where                                                 | Runner     | What it proves                                                                                                               | Needs services                  |
| ----------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| `apps/api/src/app.test.ts`                            | `bun test` | `/health`, `/ready` degraded when a probe fails, problem+json with the request id, CORS allow-list                           | No (in-memory app, fake probes) |
| `apps/api/src/platform/rate-limit/rate-limit.test.ts` | `bun test` | The limiter and its middleware                                                                                               | No (memory limiter)             |
| `apps/worker/src/jobs/jobs.test.ts`                   | `bun test` | Job names are unique and follow `area.action`                                                                                | No                              |
| `packages/db/src/roles.test.ts`                       | `bun test` | Role separation on a real database: no DDL for `app_api`, admin-only tables hidden, audit log immutable, queue role isolated | PostgreSQL                      |
| `packages/db/src/schema/schema.test.ts`               | `bun test` | Seeds read through the Drizzle models (`discovery.daily_cap.*`, `intro.window_hours`, `offers.enabled` off)                  | PostgreSQL                      |
| `packages/db/src/schema-lint.test.ts`                 | `bun test` | The schema lint reports each kind of drift; every Drizzle model matches the migrated schema                                  | PostgreSQL (unit part: no)      |
| `packages/db/src/schema/models.test.ts`               | `bun test` | Each model reads and writes its table; five parallel writers on one version, exactly one wins                                | PostgreSQL                      |
| `packages/db/src/transactions.test.ts`                | `bun test` | Row-level security context per transaction, two members on parallel connections, `app.env`                                   | PostgreSQL                      |
| `packages/entitlements/src/entitlements.test.ts`      | `bun test` | Role ladder, unlimited values, 25 entitlement keys                                                                           | No                              |

`pnpm test` is `turbo run test`; only `apps/api`, `apps/worker`, `packages/db` and
`packages/entitlements` have a `test` script. `apps/admin`, `apps/web`, `apps/site`, `apps/mobile`,
`packages/contracts`, `packages/i18n`, `packages/tokens`, `packages/ui-web` and `packages/ui-native`
have none. The database tests skip themselves (`describe.skipIf`) when the connection variables
are absent, except in CI, where `databaseReady()` in `packages/db/src/test-env.ts` makes them fail
instead (GAP-STD01-09, closed). CI also runs `pnpm db:lint-schema`, which fails when a Drizzle
model names a table or column the migrations do not have.

Tools the Technical Reference names for CI [TR §17.3]: unit tests, API integration tests against
PostgreSQL 16 + PostGIS in a container, schema behaviour tests with parallel connections,
Playwright (web, admin, site), Maestro (app), axe, bundle budgets, EXPLAIN checks on hot queries.
Of these the repo has the PostgreSQL service in CI and `bun test`. Every other tool below is
labelled **Recommendation** where the sources do not name it, and has a REPO gap.

## 3. Strategy per app and package

### 3.1 API (`apps/api`)

Pyramid, widest first: unit → integration → contract → schema behaviour → a few end-to-end smoke
calls.

| Level            | Scope                                                                                                                                                                                       | Tool                                                        | Runs against                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Unit             | `domain/` rules and `application/` use cases with fake ports                                                                                                                                | `bun test`                                                  | Nothing external                                                               |
| Integration      | A route through `createApp()` with real adapters: auth, validation, RLS, transactions, problem documents                                                                                    | `bun test`, `app.request()`                                 | PostgreSQL 16 + PostGIS and Redis (`pnpm services:up`; CI services) [TR §17.3] |
| Contract         | Every operation declares auth, errors and a rate-limit policy; responses parse against their zod schema; error codes are registry codes ([1MM-STD-13](1MM-STD-13-ERROR-CODES.md) section 8) | `bun test` over the OpenAPI documents and route definitions | Nothing external                                                               |
| Schema behaviour | Database functions and constraints under real concurrency                                                                                                                                   | `bun test` with several `postgres` connections [TR §17.3]   | PostgreSQL                                                                     |
| Vendor adapters  | Each adapter against recorded or hand-written vendor responses, including errors and timeouts                                                                                               | `bun test` with a local fake HTTP server                    | Nothing external; never a live vendor in CI                                    |
| Hot-query plans  | `EXPLAIN` on the hot queries asserts index use (no sequential scan on the large tables) [TR §15.2], [TR §17.3]                                                                              | `bun test`                                                  | PostgreSQL with a sized fixture                                                |

| Condition        | What the API tests must show                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Expected         | Each endpoint of the module plan returns the declared shape and status; each numbered business rule holds; the audit row and outbox row are written in the same transaction; pagination is keyset with stable order [TR §8.1]                                                                                                                                                                 |
| Unexpected       | 422 on every invalid field; 401 without a token; the four authorisation checks refused ([1MM-STD-16](1MM-STD-16-DEFENSIVE-PROGRAMMING.md) section 3): wrong plan, missing permission, another member's row under RLS, non-participant; replayed `Idempotency-Key` and client id; stale `If-Match` → 412; tampered cursor; oversized body; vendor error and timeout; Redis down; database down |
| Variables change | Config row changed (limit N → N+1 boundary); each flag off → `feature_disabled`; each plan and a plan change mid-test; `Accept-Language` for server-rendered text; clock moved across each expiry and across local midnight for per-day quotas [TR §8.5]; two concurrent requests                                                                                                             |

Schema behaviour tests, the minimum set:

| Subject                       | Parallel-connection case                                             | Expected result                                               |
| ----------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------- |
| `record_reaction()` [TR §8.4] | A likes B and B likes A at the same instant, many times              | Exactly one active match per pair; one intro session          |
| `record_reaction()` replay    | The same `client_reaction_id` sent twice in parallel                 | One reaction; the second returns `o_replayed = true`          |
| `spend_spec_view()` [TR §8.5] | A member at cap − 1 spends from 10 connections                       | Exactly one succeeds; `count` never exceeds the cap           |
| `decide_intro()`              | Both members decide at once; one member decides twice                | One outcome; the second decision is refused (decisions final) |
| Partial unique indexes        | Two inserts of the same live subscription, conversation, application | One row; the other gets a unique violation                    |
| Queue claim                   | Two reviewers claim the same case                                    | One claim                                                     |
| `If-Match` update             | Two updates with the same version                                    | One succeeds, one affects zero rows                           |
| Message send                  | The same `client_msg_id` twice                                       | One message (`message_client_ids`)                            |
| Webhook intake                | The same `(provider, event_id)` delivered twice in parallel          | One `webhook_events` row; processed once                      |

Edge cases to name in module plans: empty lists and last pages; maximum lengths and Unicode
(emoji, right-to-left, combining marks) in text fields; ids that are valid UUIDs but unknown;
leap day and month-end for renewals; a member deleted, restricted or blocked between two steps.

### 3.2 Worker (`apps/worker`)

Pyramid: unit (the handler with fake context) → integration (the handler against PostgreSQL) →
one pg-boss round trip per job kind.

| Level             | Scope                                                                                                   | Tool                                           |
| ----------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Catalogue         | Names unique and `area.action` (exists); every job in the module plan is registered; cron strings parse | `bun test`                                     |
| Job               | `handle(payload, context)` against a real database with fixtures                                        | `bun test`, PostgreSQL                         |
| Idempotent re-run | Every job test runs the handler **twice** and asserts the second run changes nothing                    | `bun test`                                     |
| Schedule          | The handler is run with the clock at, before and after the due time; local-time jobs across time zones  | Injected clock                                 |
| Queue round trip  | Enqueue through pg-boss as `app_queue`, the worker picks it up, retries on failure                      | `bun test`, PostgreSQL (one test per job kind) |

| Condition        | What the worker tests must show                                                                                                                                                                                                                        |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Expected         | The job does what [TR §11] says for rows that are due, and writes its notifications through the outbox                                                                                                                                                 |
| Unexpected       | Malformed payload fails without retry; the row was deleted or changed since enqueue; the vendor fails (job retries, no partial state); the job is killed half-way and resumes; two instances of the same job overlap; nothing is due (no-op, no error) |
| Variables change | The job's config keys changed; its kill switch off (stops cleanly); clock across the boundary; members in different time zones for per-zone jobs (`quota.reset` runs hourly per time zone [TR §11]); a batch larger than one page                      |

Payloads in tests carry ids only, as in production (`apps/worker/src/platform/job.ts`).

### 3.3 Database (`packages/db`)

| Level        | Scope                                                                                                                                                                                                                                                                                                                     | Tool                                         |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Migrations   | All files apply in order to an empty PostgreSQL 16 + PostGIS; applying again is a no-op; checksums of applied files are unchanged (the runner checks them)                                                                                                                                                                | `pnpm db:migrate` in CI (exists); `bun test` |
| Upgrade path | A new migration applies on top of a database holding the previous state **with data in it** (expand-then-contract: old code still works after the migration)                                                                                                                                                              | `bun test`                                   |
| Roles        | What each role can and cannot do (exists in `roles.test.ts`); every new table is covered by the default grants or an explicit `REVOKE`                                                                                                                                                                                    | `bun test`                                   |
| RLS          | For each of the ten RLS tables: as `app_api` with `app.user_id` = A, B's rows are invisible and unwritable; with `app.user_id` unset, no member-owned row is visible, except that `profiles_read` still returns every non-hidden profile (DB-05 GAP-DB05-03), which is why the public surface never queries member tables | `bun test`                                   |
| Constraints  | Each invariant in [1MM-STD-16](1MM-STD-16-DEFENSIVE-PROGRAMMING.md) section 7 refuses the bad row with the expected SQLSTATE                                                                                                                                                                                              | `bun test`                                   |
| Partitions   | `ensure_monthly_partitions()` creates the next months, is idempotent, is callable by `app_worker` and not by `app_api` (exists in part); a row dated in a month with no partition lands in the default partition; year-end rollover                                                                                       | `bun test`                                   |
| Seeds        | Seeded values equal the sources (exists for three keys); the entitlement key list equals `packages/entitlements`                                                                                                                                                                                                          | `bun test`                                   |
| Models       | Each Drizzle model in `packages/db/src/schema/` reads and writes its table (drift between model and schema fails)                                                                                                                                                                                                         | `bun test`                                   |

| Condition        | What the database tests must show                                                                                                                                                                          |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Expected         | The schema applies; seeds are present; each role does its job                                                                                                                                              |
| Unexpected       | An edited applied migration is refused; DDL as `app_api`; update or delete on an append-only table; a self-approval; an under-18 birth date; a second live row where one is allowed                        |
| Variables change | `app.env` = `production` versus unset (`enforce_config_approval()` enforces four-eyes only in production [SQL]); `app.user_id` set, unset, another member; dates across month and year ends for partitions |

Detail on writing and reviewing migrations is in [1MM-DB-02](../database/1MM-DB-02-MIGRATIONS.md).

### 3.4 Admin console (`apps/admin`)

Pyramid: component → route → permission matrix → a small Playwright suite.

| Level             | Scope                                                                                                                                                                             | Tool                                                                          |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Unit              | Formatting, URL-state parsing, the error mapper, permission helpers                                                                                                               | **Recommendation:** Vitest (the app builds with Vite)                         |
| Component         | Shared components in `packages/ui-web` and feature components: states, keyboard use, `aria` wiring                                                                                | **Recommendation:** Vitest + Testing Library                                  |
| Route             | A route with its loader and queries, with the network faked at the client boundary from contract-typed fixtures: every standard state of [ADM §1.5]                               | **Recommendation:** Vitest + Testing Library + TanStack Router memory history |
| Permission matrix | A table-driven test: for every route and action × every seeded role, the control is shown or hidden as the matrix says [TR §7.3]; the matching API test proves the server refuses | Generated from the permission seed; runs at route level and in the API suite  |
| End to end        | Sign-in with MFA, one full path per module (list → detail → write with reason → audit row visible), step-up, approval by a second admin, `412` conflict                           | Playwright [TR §17.3] against the real API and a seeded database              |
| Accessibility     | axe with 0 violations in light and dark on every route [TR §2.4], [ADM §1.9]                                                                                                      | **Recommendation:** `@axe-core/playwright`                                    |

| Condition        | What the admin tests must show                                                                                                                                                                                                                                                                      |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Expected         | Lists page by cursor, filter and sort through the URL; forms save with `Idempotency-Key` and `If-Match`; a reason is required where flagged; the approval flow shows "Sent for approval" [ADM §1.2–1.4]                                                                                             |
| Unexpected       | Each error state of [ADM §1.5]; a direct link without permission; a hidden action called anyway is refused by the API; double click acts once; `412` shows the diff; session ends mid-form (draft kept in memory); offline disables writes                                                          |
| Variables change | Every seeded role and a scoped role; config-driven console values (page sizes, timers) changed in the admin; light and dark; the breakpoints of [ADM §1.7] (MOD-00 tests the shell at 1280, 1024, 768 and 375 px); a slow network (skeleton only after 300 ms); time shown in the console time zone |

### 3.5 Billing web app (`apps/web`)

The same levels and tools as the admin console, sized to a small app: unit and component tests,
route tests for each page, and Playwright for the payment paths [TR §6.2].

| Condition        | What the web app tests must show                                                                                                                                                                                                       |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Expected         | Sign-in with a cookie session; Black Badge pay step; Premium and Gold checkout with the proration preview; change and cancel plan; update payment method, against the Flutterwave **test mode** [TR §4.4]                              |
| Unexpected       | Declined payment; checkout abandoned and resumed; the browser's back button after paying; double submit (one charge, by `Idempotency-Key` [TR §8.1]); a store-billed member (actions refused); a new device (L2 / L3); expired session |
| Variables change | Each plan and price from `prices` (changed in the admin, shown without a release); `payments.flutterwave_web` off; locale; the webhook arriving before and after the redirect back; phone and desktop widths                           |

No test ever uses a real card or live keys. Payment end-to-end runs use the provider's sandbox
only [TR §4.4].

### 3.6 Website (`apps/site`)

Pyramid: build checks → component checks → Playwright across templates → budgets.

| Level         | Scope                                                                                                                                                                                                           | Tool                                                         |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Build         | `astro check` (exists as `typecheck`); every route builds in `en`, `pcm`, `fr`; internal links resolve                                                                                                          | `astro check`; **Recommendation:** a link checker on `dist/` |
| End to end    | Each template at 360, 600, 1024 and 1440 px, light and dark, no horizontal scroll, readable at 200% text zoom; forms; language and theme switch; consent; works with JavaScript disabled for reading [WEB §4.0] | Playwright [TR §17.3]                                        |
| Accessibility | axe: 0 violations in both themes; keyboard-only walkthrough [WEB §4.0], [WEB §3.6]                                                                                                                              | **Recommendation:** `@axe-core/playwright`                   |
| Performance   | The budgets in section 4.2                                                                                                                                                                                      | Lighthouse CI and a bundle size check [WEB §3.7]             |
| i18n          | Every key used exists in `en`; `pcm` and `fr` fall back to `en`; `hreflang` and locale routes; no hard-coded copy [WEB §4.0], [WEB §3.8]                                                                        | Unit test in `packages/i18n`; Playwright per locale          |
| Privacy       | No third-party request before consent [WEB §4.0]                                                                                                                                                                | Playwright network assertion                                 |
| Security      | Response headers of [WEB §3.12] on the deployed preview                                                                                                                                                         | Playwright or a header check script                          |

| Condition        | What the website tests must show                                                                                                                                                                                                            |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Expected         | Pages render from published CMS content; forms submit once and show the success state; store links and QR resolve                                                                                                                           |
| Unexpected       | A CMS section with no published items is hidden with its heading and nav anchor [WEB §3.13]; form errors by code; honeypot filled; submit too fast; offline (`/offline`); API down at browse time (static content still reads)              |
| Variables change | Locale; theme; viewport; `Save-Data` and reduced motion [WEB §4.0]; maintenance on (forms paused, safety form open [OD-32]); `offers.enabled` off (offer page absent); a CMS publish (content changes without a code change); 3G throttling |

### 3.7 Mobile (`apps/mobile`)

Pyramid: unit → component → Maestro flows. Device coverage follows
[1MM-STD-03](1MM-STD-03-MOBILE-BUILD-STRATEGY.md) section 12: at least one iOS phone, one Android
phone and one tablet for every task.

| Level         | Scope                                                                                                                                                                   | Tool                                                                   |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Unit          | Pure logic: the error mapper, deep-link parser, storage schemas and migrations, outbox, entitlement helpers, formatters                                                 | **Recommendation:** Jest with the `jest-expo` preset                   |
| Component     | Screens and `packages/ui-native` components with the network faked at the client boundary: every state (loading, empty, content, error, offline, restricted), each plan | **Recommendation:** React Native Testing Library                       |
| End to end    | One Maestro flow per flow row of [UF §15] the module owns, using the `testID` hooks, against the real API in a seeded environment                                       | Maestro [TR §5.1], [TR §17.3]                                          |
| Accessibility | An accessibility check on the Maestro flows [TR §2.4]: labels on icon buttons, 44 px targets, font scaling to 200%                                                      | Maestro assertions plus component-level checks                         |
| Budgets       | Cold start, app size, deck frame rate (section 4.2)                                                                                                                     | Measured on the reference device in MOD-19; app size checked per build |

| Condition        | What the mobile tests must show                                                                                                                                                                                                                                                                                                                                |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Expected         | Each screen in flow order with real data; haptic and sound tags fire where specified [TR §17.3]; onboarding resumes at the saved step [TR §5.3]                                                                                                                                                                                                                |
| Unexpected       | Each error screen of [1MM-STD-13](1MM-STD-13-ERROR-CODES.md) section 6.5; offline at launch (A0·E) and in the app (ES5); a failed send (ES6); app killed mid-write (outbox replays once); expired token mid-flow; a bad deep link and a bad push payload (ignored); permission denied (camera, notifications, location); corrupt local storage                 |
| Variables change | Plan (each role, and `entitlements.changed` arriving mid-session [TR §8.3]); config (caps, durations) and flags changed in the admin; locale and 200% text; light and dark; reduced motion; time zone and device clock change; 3G and data-saver [TR §15.1]; device size class and rotation; iOS and Android; an old app version against the current API (OB1) |

A development build is needed for Maestro once native modules are present (`docs/USAGE.md` §7).

### 3.8 Packages

| Package                                 | What is tested                                                                                                                                                                                                                                                | Expected / unexpected / variables change                                                                                                                    |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/contracts`                    | Schemas accept valid and refuse invalid examples; every operation declares auth, errors and a rate-limit policy (MOD-00); the problem registry tests; generated files are current (CI drift step); no breaking change (`scripts/check-contract-breaking.mjs`) | Expected: examples round-trip. Unexpected: unknown fields, wrong types, over-long values. Variables: a response with an extra field still parses in clients |
| `packages/entitlements`                 | Role ladder and helpers (exists); the key list equals the `entitlements` seed; the resolver returns the matrix of [TR §9] for every role                                                                                                                      | Expected: each role's values. Unexpected: unknown role or key (denied). Variables: a `role_entitlements` row changed → the resolver follows                 |
| `packages/tokens`                       | `node build.mjs --check` (exists as `typecheck`): outputs are current; contrast pairs meet [TR §2.4] (body ≥ 7:1, secondary ≥ 4.5:1, UI graphics ≥ 3:1)                                                                                                       | Expected: build is deterministic. Unexpected: a missing or malformed token fails the build. Variables: light and dark themes, tier tokens                   |
| `packages/i18n`                         | Every key used in code exists in `en`; fallback to `en`; ICU plural and select render; `max_length` hints respected [SQL `i18n_strings.max_length`]; the name and slogan are never translated                                                                 | Expected: `translate()` returns the locale string. Unexpected: missing key, malformed ICU. Variables: each locale; plural counts 0, 1, 2, many              |
| `packages/ui-web`, `packages/ui-native` | Each component: states, keyboard and screen-reader behaviour, tokens only (no raw hex)                                                                                                                                                                        | Expected: renders each variant. Unexpected: empty and over-long content. Variables: theme, text scale, width, reduced motion                                |
| `packages/db`                           | Section 3.3                                                                                                                                                                                                                                                   |                                                                                                                                                             |

## 4. Thresholds and where each is configured

A threshold is a number someone may need to change. Each lives in exactly one place, in the repo,
changed by pull request. Changing one needs a code-owner review and a line in the progress log;
lowering one also needs the reason in the pull request.

### 4.1 Coverage floors

The sources set no coverage numbers. These are **Decided** (DEC-004, 26 Nov 2026), measured on lines and
branches, enforced per workspace so a well-tested package cannot hide an untested one.

| Workspace                                                          | Floor (lines / branches)              | Configured in                                       |
| ------------------------------------------------------------------ | ------------------------------------- | --------------------------------------------------- |
| `apps/api` `domain/` and `application/`                            | 90% / 85%                             | `apps/api/bunfig.toml` (`[test] coverageThreshold`) |
| `apps/api` overall, `apps/worker`                                  | 80% / 75%                             | `apps/api/bunfig.toml`, `apps/worker/bunfig.toml`   |
| `packages/entitlements`, `packages/contracts`, `packages/i18n`     | 90% / 85%                             | `bunfig.toml` in each package                       |
| `packages/db` (TypeScript only; SQL is covered by behaviour tests) | 80% / 75%                             | `packages/db/bunfig.toml`                           |
| `apps/admin`, `apps/web`, `packages/ui-web`                        | 70% / 65%                             | `vitest.config.ts` (`coverage.thresholds`) in each  |
| `apps/mobile`, `packages/ui-native`                                | 70% / 65%                             | `jest.config.js` (`coverageThreshold`) in each      |
| `apps/site`                                                        | none; covered by Playwright templates | n/a                                                 |

Coverage is a floor, not a goal: the three conditions of section 1 and the rule-by-rule tests of
the API gate decide whether a change is tested. `packages/contracts`, `packages/i18n` and
`apps/api` have their `bunfig.toml` since `MOD-00-API-01`, and `apps/worker` since `MOD-00-WRK-01`; Bun measures lines and functions per
file, not branches (GAP-MOD00-16). The other files do not exist yet (GAP-STD01-01 to
GAP-STD01-03). Floors start at the current measured value if it is lower when the tooling lands,
and rise to the table by MOD-19.

### 4.2 Performance budgets

| Measure                                | Budget                                                                                                                                | Source                 | Checked by                                                                             | Configured in (when added)                              |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| API latency p95 at the origin          | Reads < 200 ms, writes < 400 ms, discovery deck < 300 ms                                                                              | [TR §15.1]             | Load test in MOD-19; `api_request_rollups` alerts in production [TR §14]               | Load-test thresholds file (MOD-19)                      |
| API latency p95 from Lagos on 4G       | Reads < 450 ms, writes < 650 ms                                                                                                       | [TR §15.1], [OD-11]    | MOD-19 field measurement                                                               | MOD-19 report                                           |
| Chat delivery                          | < 500 ms in one region; < 700 ms Lagos to Lagos                                                                                       | [TR §15.1]             | MOD-08 and MOD-19 end-to-end timing                                                    | Load-test thresholds file                               |
| Hot queries                            | Use their index; no sequential scan on large tables                                                                                   | [TR §15.2], [TR §17.3] | EXPLAIN tests in `apps/api`                                                            | The test file per query                                 |
| First screen, cold start, 2 GB Android | < 2 s                                                                                                                                 | [TR §15.1]             | Measured on the reference device per release candidate                                 | MOD-19 checklist                                        |
| App download size                      | < 30 MB                                                                                                                               | [TR §15.1]             | Size check on the EAS build                                                            | Budget script (GAP-STD01-07)                            |
| Deck card                              | 60 fps                                                                                                                                | [TR §15.1]             | Profiling on the reference device (MOD-07)                                             | MOD-07 exit gate                                        |
| Card photo                             | < 80 KB AVIF / WebP                                                                                                                   | [TR §15.1]             | `media.process` test asserts output size (MOD-04)                                      | `remote_config` where a key exists, else the job's test |
| Motion                                 | 150–250 ms transitions                                                                                                                | [TR §15.1]             | Token values in `packages/tokens`                                                      | `packages/tokens/tokens.json`                           |
| Website LCP                            | ≤ 2.5 s (Lighthouse mobile, throttled)                                                                                                | [TR §15.1], [WEB §3.7] | Lighthouse CI                                                                          | `apps/site/lighthouserc.json`                           |
| Website Lighthouse scores              | 95+ in all four categories [TR §6.1]. [WEB §3.7] says ≥ 90 for performance; the Technical Reference wins by source precedence         | [TR §6.1]              | Lighthouse CI                                                                          | `apps/site/lighthouserc.json`                           |
| Website CLS, INP                       | CLS ≤ 0.1; INP ≤ 200 ms (field p75)                                                                                                   | [WEB §3.7]             | Lighthouse CI (CLS, lab); field data after launch                                      | `apps/site/lighthouserc.json`                           |
| Website transfer                       | Above the fold < 500 KB; HTML ≤ 40 KB; CSS ≤ 30 KB; first-view JS ≤ 50 KB on Home, ≤ 80 KB with forms; one font ≤ 60 KB; hero ≤ 60 KB | [WEB §3.7]             | Bundle size check on `apps/site/dist`                                                  | Budget script (GAP-STD01-07)                            |
| Third-party scripts before consent     | 0                                                                                                                                     | [WEB §3.7]             | Playwright network assertion                                                           | The test                                                |
| Admin and web app bundles              | No budget in the sources                                                                                                              |                        | **Recommendation:** record the first production build size and fail on growth over 10% | Budget script (GAP-STD01-07)                            |
| Accessibility                          | axe: 0 violations, both themes                                                                                                        | [WEB §4.0], [TR §2.4]  | `@axe-core/playwright`                                                                 | Shared Playwright fixture                               |

Product numbers that tests assert (caps, windows, limits) are not thresholds of this document:
they live in `remote_config`, `rate_limit_policies` and `role_entitlements`, and tests read them
from there.

### 4.3 Flake policy

The sources set none. **Decided** (DEC-004, 26 Nov 2026):

| Rule                                      | Value                                                                                                                                                                                                                              | Configured in                                                                  |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Unit, integration, contract, schema tests | No retries. A test that fails once is a failure                                                                                                                                                                                    | Default runner settings (no retry flag)                                        |
| Playwright                                | 1 retry in CI, 0 locally; a test that passes only on retry is reported                                                                                                                                                             | `playwright.config.ts` (`retries`)                                             |
| Maestro                                   | 1 retry per flow in CI                                                                                                                                                                                                             | The Maestro CI step                                                            |
| Quarantine                                | A flaky test is fixed within 2 working days or moved to a quarantine list with an owner and an issue; quarantined tests still run and report, but do not block. No quarantined test may cover a rule in an open module's exit gate | A `quarantine` tag in the test title; the list is reviewed at each module exit |
| Never                                     | Deleting or skipping a test to get green (`AGENTS.md` rule 9); `sleep` as a fix; widening an assertion until it passes                                                                                                             | Review                                                                         |
| Determinism                               | Injected clock and random source; unique data per test; no dependence on test order; no shared mutable rows between test files                                                                                                     | [1MM-STD-16](1MM-STD-16-DEFENSIVE-PROGRAMMING.md) section 9                    |
| Time limits                               | CI job `verify` has `timeout-minutes: 20`. **Recommendation:** keep `pnpm test` under 5 minutes; slower suites (Playwright, Maestro, load) run in their own jobs                                                                   | `.github/workflows/ci.yml`                                                     |

## 5. Test data and fixtures

1. **Synthetic only.** No real personal data in any test, fixture, seed, screenshot, recording or
   lower environment. The demo uses test accounts and dummy data only [OD-10]; no production data
   exists outside production [TR §4.4], [TR §13.1]. This repository is public: a fixture is
   published the moment it is committed.
2. **Obviously fake.** Names from a fixed fictional list; e-mail addresses at `example.com`,
   `example.org` or `.test` domains; phone numbers from the vendor's documented test numbers
   [TR §4.4] or clearly invalid ranges; no photographs of real people (generated placeholders or
   the repo's illustrations); coordinates of public landmarks, never a home address.
3. **Factories, not dumps.** Each domain has a factory that builds a valid row with defaults and
   overrides (`aMember({ role: 'CLASSIC' })`). Factories live beside the tests of the package that
   owns the table. A database dump is never committed.
4. **Reference data comes from migrations.** Tests rely on the seeds in the baseline (plans,
   entitlements, config, flags, permissions, catalogues) and never re-insert them. A test that
   changes a config row restores it or runs in a transaction that rolls back.
5. **Isolation.** Each test creates what it needs and does not read rows it did not create.
   **Recommendation:** integration tests run inside a transaction rolled back at the end; tests
   that need several connections (schema behaviour) use unique ids and clean up by id.
6. **Vendor fixtures** are hand-written or sanitised recordings of sandbox responses with every
   identifier replaced; never a live payload. Webhook fixtures are signed with a test secret
   defined in the test.
7. **Development and demo seed.** One script builds a small, named, synthetic world (members on
   each plan, an admin per role, matches, chats, a group) for local work, shared environments and
   Maestro. It is the same data the API gate's "fixtures" row asks for
   ([1MM-STD-06](1MM-STD-06-API-FIRST.md) section 4). It refuses to run when `APP_ENV` is
   `production`. The script does not exist yet (GAP-STD01-08).
8. **Secrets.** Tests use the local defaults of `.env.example`, as CI does
   (`cp .env.example .env.development`). No test needs a real key; a test that would is rewritten
   against a fake.
9. **Clocks.** Fixtures use fixed dates relative to an injected "now", never the wall clock.

## 6. What runs where

| Check                                          | Local, on demand                           | Pre-commit (`.husky/pre-commit`)                            | CI job `verify` (`.github/workflows/ci.yml`)                                                                  | State                      |
| ---------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------- |
| Dependency audit (high and critical)           | `pnpm audit:deps`                          |                                                             | Yes                                                                                                           | Exists                     |
| Secret scan                                    |                                            | `scripts/check-secrets.mjs --staged`; gitleaks if installed | gitleaks                                                                                                      | Exists                     |
| Format                                         | `pnpm format:check`                        | Prettier on staged files (lint-staged)                      | Yes                                                                                                           | Exists                     |
| Lint                                           | `pnpm lint`                                | `eslint --fix` on staged files (lint-staged)                | Yes                                                                                                           | Exists                     |
| Banned terms                                   | `pnpm check:banned-terms`                  |                                                             | Yes                                                                                                           | Exists                     |
| Repository rules                               | `pnpm check:repo`                          |                                                             | Yes                                                                                                           | Exists                     |
| Schema applies to PostgreSQL 16 + PostGIS      | `pnpm db:migrate`                          |                                                             | Yes (`postgis/postgis:16-3.4` service)                                                                        | Exists                     |
| Database roles                                 | `pnpm db:roles`                            |                                                             | Yes                                                                                                           | Exists                     |
| Generated client is current                    | `pnpm contracts:generate`                  |                                                             | Yes (`git diff --exit-code packages/contracts`)                                                               | Exists                     |
| No breaking API change                         | `node scripts/check-contract-breaking.mjs` |                                                             | Pull requests only                                                                                            | Exists                     |
| Type-check                                     | `pnpm typecheck`                           |                                                             | Yes                                                                                                           | Exists                     |
| Unit, integration, contract, schema, job tests | `pnpm test` (needs `pnpm services:up`)     |                                                             | Yes (`pnpm test`, with PostgreSQL and Redis services)                                                         | Exists for four workspaces |
| Builds                                         | `pnpm build`                               |                                                             | Yes                                                                                                           | Exists                     |
| No server-only settings in client bundles      | `pnpm check:client-bundles`                |                                                             | Yes                                                                                                           | Exists                     |
| CodeQL                                         |                                            |                                                             | Separate required check on `develop` and `production`, run by GitHub CodeQL default set-up (no workflow file) | Exists (branch rules)      |
| Component and route tests (admin, web, mobile) | `pnpm test`                                |                                                             | In `verify` once the workspaces have a `test` script                                                          | Gap                        |
| Coverage floors                                | With the tests                             |                                                             | With the tests                                                                                                | Gap                        |
| Playwright + axe (admin, web, site)            | Per app                                    |                                                             | A separate job on pull requests that touch the app                                                            | Gap                        |
| Lighthouse CI and bundle budgets               | Per app                                    |                                                             | A separate job on pull requests that touch `apps/site`                                                        | Gap                        |
| EXPLAIN checks                                 | `pnpm test`                                |                                                             | In `verify`                                                                                                   | Gap (MOD-00)               |
| Maestro flows                                  | On a simulator or device                   |                                                             | A separate job or device farm run, per MOD-00-MOB-01                                                          | Gap                        |
| Load, penetration and accessibility audits     |                                            |                                                             | MOD-19, before launch                                                                                         | Planned                    |

Rules:

1. Pre-commit stays fast: formatting, lint on staged files and the secret scan only. Tests do not
   run in the hook. `pnpm check` (format check, lint, repository rules, type-check, tests) is run
   by hand before every push; the full local equivalent of CI is in
   [1MM-STD-10](1MM-STD-10-COMMITS-AND-LOCAL-CI.md).
2. CI is the judge. Nothing merges with a red `verify`, and nobody weakens the workflow to get
   green (`AGENTS.md` rule 9).
3. CI never has write access or secrets for code from a fork (`docs/USAGE.md` §8), so every test
   in `verify` must pass with the values of `.env.example` alone.
4. New test jobs follow the workflow rules that `pnpm check:repo` enforces: actions pinned to a
   full commit hash, top-level read-only `permissions`, no `pull_request_target`.
5. A test that needs a service must fail, not skip, when CI is running (GAP-STD01-09).

## 7. How a module's exit gate uses this document

Each module plan has a "Tests" section (§9) and an "Exit gate" (§10). The gate is signed only
when:

| #   | Item                                                                                                                                                                | Evidence                                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| T1  | The module's §9 lists, for each app it touches, the expected, unexpected and variables-change cases, the named edge cases and the adjustable thresholds             | The module plan                                             |
| T2  | Every numbered rule in §4.3 has at least one test per condition, named with the rule number                                                                         | Test report filtered by module                              |
| T3  | The API gate ([1MM-STD-06](1MM-STD-06-API-FIRST.md) section 3) was recorded before the first client task                                                            | Progress log                                                |
| T4  | Concurrency rules have parallel-connection tests; each job is run twice in its test                                                                                 | Test names                                                  |
| T5  | Admin: permission-matrix rows for the module's permissions pass; the module's end-to-end path passes; axe is clean                                                  | Playwright report                                           |
| T6  | Website and web app: templates pass at every breakpoint, locale and theme; budgets hold                                                                             | Playwright and Lighthouse reports                           |
| T7  | Mobile: the module's Maestro flows pass on an iOS phone, an Android phone and a tablet ([1MM-STD-03](1MM-STD-03-MOBILE-BUILD-STRATEGY.md) section 12)               | Maestro output, screenshots                                 |
| T8  | Each config key, flag and entitlement the module uses was changed in the admin console during a test run and the clients followed without a release                 | End-to-end test or a recorded manual run, named in the gate |
| T9  | Coverage floors hold for the workspaces the module touched; no test is skipped or newly quarantined for this module                                                 | CI                                                          |
| T10 | The sources' own acceptance checklists for the module's screens are ticked ([ADM] module checklists, [WEB §4.0] and module criteria)                                | The module plan's §10                                       |
| T11 | Fixtures for every screen state exist in the development seed                                                                                                       | Seed script diff                                            |
| T12 | The module's Member 360 tab is verified against real data, where it has one ([coordinator ruling R6](../execution/1MM-EXE-00-MASTER-PLAN.md#7-coordinator-rulings)) | Admin end-to-end test                                       |

MOD-19 then runs the whole product end to end, the load test against section 4.2, the penetration
test and the accessibility audit.

## 8. Writing tests: conventions

1. Test files sit beside the code as `*.test.ts` / `*.test.tsx` (as the existing ones do).
   End-to-end suites live in an `e2e/` folder in their app; Maestro flows in `apps/mobile/.maestro/`
   (**Recommendation**).
2. Build the thing under test from its dependencies: `createApp(deps)` for the API (as
   `app.test.ts` does), a use case with fake ports, a job with a fake context. No global state.
3. Assert on behaviour the contract promises: status, registry code, declared fields, rows
   written. Do not assert on log text, private functions or English messages.
4. Select elements by role and accessible name on the web, and by `testID` on mobile; the ids come
   from the designs (`data-testid`, `testID`) [TR §2.4], [WEB §4.0].
5. One reason to fail per test. Table-driven tests for matrices (plans, roles, locales).
6. Client tests fake the network only at the generated client's boundary, with fixtures typed by
   the contract, so a contract change breaks them at compile time.
7. No test calls a live vendor, sends a real message or charges a real card.

## 9. Gaps raised

Dispositions are recorded in [1MM-LOG-03](../1MM-LOG-03-TECHNICAL-REFERENCE-EXTENSIONS.md)
(Technical Reference and schema), [1MM-LOG-02](../1MM-LOG-02-UI-UPDATES.md) (UI) and
[1MM-LOG-04](../1MM-LOG-04-OPEN-DECISIONS-AND-FOLLOW-UPS.md) (owner decisions and repository
follow-ups).

| Gap id       | Type     | Where found                                                                 | What is missing or conflicting                                                                                                                                                                                                                | Proposed resolution                                                                                                                                                                                         | Blocks                                 |
| ------------ | -------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| GAP-STD01-01 | REPO     | `apps/admin`, `apps/web`, `packages/ui-web` `package.json`                  | No unit, component or route test runner and no `test` script, so `turbo run test` skips them                                                                                                                                                  | **Recommendation:** add Vitest, Testing Library and jsdom; a `test` script and `vitest.config.ts` with the coverage thresholds of section 4.1                                                               | MOD-00-ADM-02                          |
| GAP-STD01-02 | REPO     | `apps/mobile`, `packages/ui-native` `package.json`                          | No unit or component test runner and no `test` script                                                                                                                                                                                         | **Recommendation:** add Jest with the `jest-expo` preset and React Native Testing Library; `jest.config.js` with coverage thresholds                                                                        | MOD-00-MOB-01                          |
| GAP-STD01-03 | REPO     | `apps/api`, `apps/worker`, `packages/*`                                     | No coverage is measured; no `bunfig.toml` exists; `packages/contracts`, `packages/i18n` have no `test` script                                                                                                                                 | Add `bunfig.toml` with `[test] coverage = true` and `coverageThreshold` per section 4.1; add `"test": "bun test"` to `packages/contracts` and `packages/i18n`                                               | MOD-00-API-01                          |
| GAP-STD01-04 | REPO     | [TR §17.3]; `apps/admin`, `apps/web`, `apps/site`                           | Playwright and axe are named by the Technical Reference but not installed; no `e2e/` suites, no CI job                                                                                                                                        | Add `@playwright/test` and **Recommendation** `@axe-core/playwright`; one `playwright.config.ts` per app with the viewports of sections 3.4 and 3.6; a CI job with read-only permissions and pinned actions | MOD-00-ADM-02, site milestone M1       |
| GAP-STD01-05 | REPO     | [TR §17.3], [TR §5.1]; `apps/mobile`                                        | Maestro is named but there are no flows, no CI step and no decision on where devices run. Tablets are disabled in `app.config.ts` (already STD-03 GAP-STD03-02), so the tablet leg cannot run yet                                             | Add `apps/mobile/.maestro/` with a smoke flow; choose the runner (simulator in CI or a device farm) in MOD-00-MOB-01                                                                                        | MOD-00-MOB-01                          |
| GAP-STD01-06 | REPO     | [WEB §3.7] "Budgets are enforced in CI (Lighthouse CI + bundle size check)" | Lighthouse CI is not installed and there is no `lighthouserc.json`                                                                                                                                                                            | Add Lighthouse CI for `apps/site` with the assertions of section 4.2                                                                                                                                        | MOD-00-OPS-05                          |
| GAP-STD01-07 | REPO     | [TR §17.3] "bundle budgets"; `scripts/`                                     | No script checks bundle or app size against a budget                                                                                                                                                                                          | Add `scripts/check-bundle-budgets.mjs` reading one budgets file (site transfer limits from [WEB §3.7], app size < 30 MB, recorded admin and web baselines) and a root script `check:budgets`                | MOD-00-OPS-05                          |
| GAP-STD01-08 | REPO     | [TR §4.4]; `packages/db`                                                    | There is no synthetic development and demo seed and no shared test factories                                                                                                                                                                  | Add a seed command in `packages/db` (refuses `APP_ENV=production`) and factories per domain, grown by each module                                                                                           | First module with member data (MOD-03) |
| GAP-STD01-09 | REPO     | `packages/db/src/roles.test.ts`, `packages/db/src/schema/schema.test.ts`    | Both use `describe.skipIf(...)` when the database variables are missing, so a mis-configured CI run passes with the database tests silently skipped                                                                                           | When `CI` is set, fail instead of skip if the variables are absent. **Closed** by `MOD-00-DB-02` (`databaseReady()`)                                                                                        | none                                   |
| GAP-STD01-10 | TR       | [TR §17.3], [TR §15.1]                                                      | The Technical Reference names the test tools but gives no coverage floors, no flake policy and no statement of the three conditions; [TR §6.1] and [WEB §3.7] give different Lighthouse score floors (95 in all categories, ≥ 90 performance) | Add a pointer from [TR §17.3] to this standard; state one Lighthouse floor (this document applies 95, by source precedence)                                                                                 | none                                   |
| GAP-STD01-11 | DECISION | Section 4.1, section 4.3                                                    | Coverage floors and the flake policy are recommendations of this document, not owner-set numbers                                                                                                                                              | Owner or engineering lead confirms the floors in section 4.1 and the retry and quarantine rules in section 4.3, or sets others                                                                              | Enforcing coverage in CI               |

## Change log

| Version | Date        | Change                                                                                                                                                                                                                |
| ------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| v1.0    | 24 Nov 2026 | First issue: three conditions, per-app strategy, thresholds and their locations, test data rules, run matrix, exit-gate usage                                                                                         |
| v1.1    | 26 Nov 2026 | `MOD-00-DB-02`: database tests fail in CI instead of skipping (GAP-STD01-09 closed); schema lint and model tests listed                                                                                               |
| v1.2    | 26 Nov 2026 | `MOD-00-API-01`: coverage floors enforced for `packages/contracts`, `packages/i18n` (90%) and `apps/api` (80%) on lines and functions; `test` scripts added to contracts and i18n (GAP-MOD00-16 raised for branches). |
