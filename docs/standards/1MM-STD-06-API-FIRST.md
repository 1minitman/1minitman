# 1MM-STD-06 · The API-first approach

|              |                                                                                                                                                                                                                                                                                                    |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Document** | 1MM-STD-06                                                                                                                                                                                                                                                                                         |
| **Status**   | Approved baseline · v1.0 · 24 Nov 2026                                                                                                                                                                                                                                                             |
| **Audience** | Engineers and coding agents. Mandatory reading before any task in `docs/execution/`                                                                                                                                                                                                                |
| **Owner**    | Engineering lead (code owners)                                                                                                                                                                                                                                                                     |
| **Sources**  | Owner rules for this work; [TR §4.2], [TR §4.5], [TR §8.1], [TR §8.2], [TR §9], [TR §17.3]; [ADM §1.1–1.4]; [WEB §4.0], [WEB §6]; [DD]; repo `docs/USAGE.md`, `packages/contracts`, `apps/api/src`, `scripts/check-contract-breaking.mjs`, `.github/workflows/ci.yml`                              |
| **Related**  | [1MM-EXE-00](../execution/1MM-EXE-00-MASTER-PLAN.md), [1MM-STD-13](1MM-STD-13-ERROR-CODES.md), [1MM-STD-16](1MM-STD-16-DEFENSIVE-PROGRAMMING.md), [1MM-STD-01](1MM-STD-01-TESTING-STRATEGY.md), [1MM-STD-17](1MM-STD-17-LANGUAGE-CONFIGURATION.md), [1MM-STD-14](1MM-STD-14-CODING-CONVENTIONS.md) |

**What this document is for and when to open it.** It states what "API first" means in this
repository, the exact order in which a feature is built, and the gate a module must pass before
anyone writes client code for it. Read it once in full before your first task; open it again when
you start a module, change a contract, or are tempted to put a value in a client.

## 1. The rule

The owner's rules for the build are binding. Four of them define API first:

1. **Every part is built with its API in place and fully supplied first.** No API, no resource
   provisioning, no client code. No half-built screens waiting on a backend.
2. **Order inside every module: API → ADMIN → WEB (website / billing web app) → MOBILE.**
3. **Every module starts with the data:** the data is compared against the UI design and set
   against the schema, so every related resource is covered end to end.
4. **Every UI element, component or piece of text is supported by the API and managed dynamically
   by the admin, including the admin console's own constants.** Nothing a person reads, and no rule
   a person meets, is hard-coded when it can change.

What this means in practice:

| Statement                                               | Consequence                                                                                                                                               |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The API is the only thing that touches the database     | Clients, including the admin console, never hold a database connection, a vendor secret or a business rule (`docs/USAGE.md` §1)                           |
| The contract is written before the handler              | The zod schemas in `packages/contracts` validate requests, shape responses and generate the clients [TR §8.1]                                             |
| A client can only call what the generated client offers | `createMemberClient`, `createPublicClient`, `createAdminClient` in `packages/contracts/src/client.ts`. If the route is not there, the screen cannot start |
| The admin comes before the public clients               | Staff can see, seed and correct the data before members meet it; the public clients are then built against real, managed data                             |
| "Done" for an API means supplied, not merely reachable  | Seeds, config keys, text, permissions, entitlements and fixtures exist (section 4)                                                                        |
| The API decides; clients present                        | Gating, limits, eligibility and wording come from the API. A client may hide a control, never enforce a rule [TR §8.1], [ADM §1.1]                        |

One service, four surfaces [TR §4.2], `packages/contracts/src/surfaces.ts`:

| Surface    | Base path    | Caller                      | Auth                                           | Client                      |
| ---------- | ------------ | --------------------------- | ---------------------------------------------- | --------------------------- |
| `member`   | `/v1`        | Member app, billing web app | Member access token (web app: HttpOnly cookie) | `createMemberClient`        |
| `public`   | `/public/v1` | Website                     | None; rate limited                             | `createPublicClient`        |
| `admin`    | `/admin/v1`  | Admin console               | Admin session cookie plus permission           | `createAdminClient`         |
| (webhooks) | `/webhooks`  | Vendors                     | Signature                                      | None: never in a client SDK |

Any `/web/v1` path in a source is stale; the website prefix is `/public/v1`.

## 2. The sequence for one feature

Every feature, in every module, goes through these steps in this order. A step starts only when
the one before it is merged or in the same pull request ahead of it.

| #   | Step                   | What is produced                                                                                                                                                                                                                              | Where                                                                                                    | Check that proves it                                                               |
| --- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 1   | Data review            | The module's "Data first" section: every input, label, list, counter, limit, state and piece of copy on every owned screen mapped to a table column, config key, i18n key, catalogue or entitlement, and to the admin control that manages it | The module plan in `docs/execution/`, section 3                                                          | No unmapped element; every mismatch is a recorded gap                              |
| 2   | Schema and migration   | Only if the review found a gap: the next numbered migration, grants, Drizzle model, seeds                                                                                                                                                     | `packages/db/migrations/`, `packages/db/roles/roles.sql`, `packages/db/src/schema/`                      | `pnpm db:migrate`, `pnpm db:roles`, `packages/db` tests                            |
| 3   | Contract               | zod request and response schemas; route definitions with params, query, headers, body, every success and error response; shared primitives reused                                                                                             | `packages/contracts/src/schemas/`, `packages/contracts/src/routes/`                                      | `pnpm typecheck`                                                                   |
| 4   | OpenAPI                | The surface's OpenAPI 3.1 document, emitted from the route definitions alone (no database needed)                                                                                                                                             | `packages/contracts/openapi/{member,public,admin}.json`                                                  | `pnpm contracts:generate`; `/docs` shows the route outside production              |
| 5   | Handler, rules, tests  | Domain rules and ports, use cases, infrastructure adapters, the HTTP route, registration on its surface; tests at every level                                                                                                                 | `apps/api/src/modules/<name>/{domain,application,infrastructure,http}`, `apps/api/src/surfaces/index.ts` | `pnpm test`; the module's API tests ([1MM-STD-01](1MM-STD-01-TESTING-STRATEGY.md)) |
| 6   | Supply                 | Seeds, config keys, i18n keys, permissions, entitlements, rate-limit policies, job rows, fixtures (section 4)                                                                                                                                 | Migrations (seeds), `packages/i18n`, `packages/entitlements`                                             | The supply checklist in section 4                                                  |
| 7   | Generated typed client | `src/generated/{member,public,admin}.ts` regenerated and committed                                                                                                                                                                            | `packages/contracts/src/generated/`                                                                      | CI step "Generated API client is up to date"                                       |
| 8   | **API gate**           | Section 3                                                                                                                                                                                                                                     | Pull request and the progress log                                                                        | Reviewer ticks the gate                                                            |
| 9   | Admin                  | The admin views that read and manage the feature                                                                                                                                                                                              | `apps/admin/src/routes/`                                                                                 | Admin tests; data is created and edited through the console, not by SQL            |
| 10  | Web                    | Website modules and billing web app pages, where the module has them                                                                                                                                                                          | `apps/site/src/pages/`, `apps/web/src/`                                                                  | Web tests                                                                          |
| 11  | Mobile                 | The member screens                                                                                                                                                                                                                            | `apps/mobile/src/app/`                                                                                   | Mobile tests; the module exit gate                                                 |

Worker jobs that the feature needs are part of the API side and are built between steps 5 and 8
(task kind `WRK`). A module that does not touch an app skips that step; it never reorders the
others.

Layering inside step 5 is enforced by lint (`eslint.config.mjs`): `domain/` imports nothing
outside the module; `application/` imports `domain/`; neither may import Hono, Drizzle, `postgres`,
`bun`, `infrastructure/` or `http/`; code outside a module imports it only through its `index.ts`.

## 3. The API gate

No task with the kind `ADM`, `WEB` or `MOB` in a module starts until that module's API gate is
green. The gate is a checklist in the pull request that closes the last `API` / `WRK` / `DB` task
of the module (or of the slice, where the master plan splits a module into slices), and a line in
`docs/1MM-LOG-01-PROGRESS.md`.

| #   | Gate item                                                                                                                                                                                                                          | Evidence                                                            |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| G1  | Every endpoint in the module plan's section 4.1 exists on its surface, with its auth and gate as planned                                                                                                                           | The OpenAPI documents; the route list in the pull request           |
| G2  | Every request and response is a zod schema in `packages/contracts`; no route returns an undeclared shape                                                                                                                           | Contract tests                                                      |
| G3  | Every error the route can return is declared and uses a code from [1MM-STD-13](1MM-STD-13-ERROR-CODES.md)                                                                                                                          | Registry tests                                                      |
| G4  | Every business rule in the plan's section 4.3 has a test that would fail if the rule were removed                                                                                                                                  | Test names cite the rule number                                     |
| G5  | The three test conditions are covered: expected, unexpected, variables change ([1MM-STD-01](1MM-STD-01-TESTING-STRATEGY.md))                                                                                                       | Test report                                                         |
| G6  | Authorisation is proven negative as well as positive: wrong role, wrong plan, another member's row, out-of-scope admin                                                                                                             | Tests ([1MM-STD-16](1MM-STD-16-DEFENSIVE-PROGRAMMING.md) section 3) |
| G7  | Idempotency, rate-limit policy and `If-Match` are applied where the plan says so                                                                                                                                                   | Tests                                                               |
| G8  | The module is **fully supplied** (section 4)                                                                                                                                                                                       | The supply checklist, filled in                                     |
| G9  | Jobs, webhooks and real-time events of the module run and are tested, including a second run of each job                                                                                                                           | Worker tests                                                        |
| G10 | `pnpm contracts:generate` leaves no diff; `scripts/check-contract-breaking.mjs` passes against the base branch                                                                                                                     | CI job `verify`                                                     |
| G11 | `pnpm check` is green                                                                                                                                                                                                              | CI job `verify`                                                     |
| G12 | The API is deployed to the shared environment the clients will use, with migrations and seeds applied, once that environment exists                                                                                                | `/health` version on that environment                               |
| G13 | Nothing is stubbed for this module's own endpoints. A dependency on a later module is a port with a named stub adapter, listed in the plan ([coordinator ruling R7](../execution/1MM-EXE-00-MASTER-PLAN.md#7-coordinator-rulings)) | The plan's section 8                                                |
| G14 | Audit rows (admin writes) and analytics events named in the plan are written                                                                                                                                                       | Tests                                                               |

Rulings that qualify the gate:

- A port with a stub adapter lets an **earlier API** proceed; it never lets a **client** proceed.
  No client work starts against a stub: the API gate of the owning module still applies to its own
  screens (ruling R7).
- Where an early module needs a small piece owned by a later one, the master plan schedules that
  slice early with its own gate (for example the blocks and reports slice, R8; the notification
  delivery slices, ruling R21).
- The admin shell is the one client built in two stages; its session-bound parts wait for MOD-01's
  API gate (ruling R20).

## 4. What "fully supplied" means

An endpoint that answers but has nothing behind it does not pass. For every module, each row below
is either delivered or marked "not applicable" with a reason.

| Supply                 | What must exist                                                                                                                                                                                       | Where it lives                                                                                   | How a client receives it                                                              |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| Schema                 | Tables, enums, constraints, indexes, functions, RLS policies, partitions the module uses                                                                                                              | `packages/db/migrations/` (baseline v3.4 plus numbered files)                                    | Not directly                                                                          |
| Grants                 | The right roles can and cannot touch the new objects                                                                                                                                                  | `packages/db/roles/roles.sql`; `pnpm db:roles`                                                   | Not directly                                                                          |
| Seeds                  | Reference rows the feature cannot work without: catalogues, option lists, plans and prices, templates, reasons                                                                                        | Migrations (seed statements)                                                                     | The catalogue and options endpoints, for example `GET /v1/options/{type}` [TR §8.2]   |
| Config keys            | Every number, duration, limit and switch as a `remote_config` row with `value_type`, `description`, range (`min_value`, `max_value`), `unit`, `group_key`, `is_public` and its `permission_key` [SQL] | `remote_config`                                                                                  | Public keys through `GET /v1/config` [TR §8.2]; private keys are read by the API only |
| Feature flags          | A `feature_flags` row for anything that can be switched off, marked `is_kill_switch` where it is one [SQL]                                                                                            | `feature_flags`, `feature_flag_overrides`                                                        | The config bootstrap                                                                  |
| Rate-limit policies    | A `rate_limit_policies` row for each limited route; no handler passes its own numbers [TR §13.3]                                                                                                      | `rate_limit_policies`                                                                            | 429 responses                                                                         |
| i18n keys              | Every label, heading, button, helper, empty-state and error message as a key, with the `en` value                                                                                                     | `i18n_strings` (source of truth), bundled defaults in `packages/i18n`                            | [1MM-STD-17](1MM-STD-17-LANGUAGE-CONFIGURATION.md)                                    |
| Permissions            | Every admin action has a row in `admin_permissions` with its `requires_reason`, `requires_reauth`, `requires_approval` flags, and is granted to the seeded roles [ADM §1.2], [TR §7.3]                | `admin_permissions`, `admin_role_permissions`                                                    | The admin session's effective permissions                                             |
| Entitlements           | Every gated capability is an entitlement key with a value per role; the key list in code equals the seed                                                                                              | `entitlements`, `role_entitlements` [TR §9]; `packages/entitlements/src/keys.ts`                 | `GET /v1/me/entitlements` [TR §8.2]                                                   |
| Error codes            | Every error has a registry code and an `error.<code>` message                                                                                                                                         | [1MM-STD-13](1MM-STD-13-ERROR-CODES.md)                                                          | Problem documents                                                                     |
| Notification templates | Every push, e-mail and SMS the feature sends exists as a template row                                                                                                                                 | `notification_templates` [SQL]                                                                   | Delivered by `notifications.deliver` [TR §11]                                         |
| Jobs                   | Every job the feature needs is defined, scheduled and listed                                                                                                                                          | `apps/worker/src/jobs/`, `worker_jobs` [SQL]                                                     | Not directly                                                                          |
| Media and assets       | Illustrations, icons and sounds the screens need are present in the repo or served, named as in the module plan's section 3.3                                                                         | App asset folders, `packages/tokens`                                                             | Bundled or CDN                                                                        |
| Fixtures               | Synthetic data that puts every screen state on screen: loading, empty, content, error, restricted, each plan, each role [OD-10]                                                                       | Test factories and the development seed ([1MM-STD-01](1MM-STD-01-TESTING-STRATEGY.md) section 5) | Local and shared environments                                                         |
| Documentation          | Summary, description and examples on each route, so `/docs` is usable                                                                                                                                 | Route definitions                                                                                | `/docs` outside production                                                            |

## 5. Every element maps to an API-served, admin-managed source

Before a screen is built, each thing on it has an answer to three questions: where does it come
from, which endpoint serves it, and who can change it in the admin console. The module plans
record this per screen (sections 3.2 and 3.4). The kinds of source are fixed:

| Kind of thing on screen                                               | Source of truth                                                              | Served by                                                                                 | Managed in the admin by                                                    |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Static text: labels, headings, buttons, helper and error text         | `i18n_strings`                                                               | The i18n catalogue (delivery path: MOD-00 GAP-MOD00-03, MOD-02); bundled defaults offline | Translations pages (A25), MOD-02 / MOD-11                                  |
| Member data                                                           | The domain tables                                                            | The feature's own endpoints                                                               | Member 360 and the domain's admin module                                   |
| Option lists and pickers                                              | Catalogue tables                                                             | `GET /v1/options/{type}` [TR §8.2]                                                        | Catalogue pages, MOD-02 (ruling R11)                                       |
| Numbers a person meets: caps, durations, lengths, counts, thresholds  | `remote_config`                                                              | `GET /v1/config` for public keys; otherwise inside the feature's responses                | Remote config (A31, A24 tuning); production changes need an approval [SQL] |
| Whether a feature shows at all                                        | `feature_flags`                                                              | The config bootstrap                                                                      | Feature flags (A31)                                                        |
| What a plan allows                                                    | `role_entitlements` [TR §9]                                                  | `GET /v1/me/entitlements`                                                                 | Plans and entitlements (A21)                                               |
| Prices and products                                                   | `prices`, products [TR §6.1]                                                 | Billing and public plan endpoints                                                         | A21                                                                        |
| Website content                                                       | CMS tables (`site_pages`, `site_blocks`, …) [TR §6.1], [WEB §6]              | `/public/v1`                                                                              | CMS (A28, A29)                                                             |
| Legal text                                                            | `legal_documents` [TR §6.1]                                                  | `GET /v1/legal/{kind}`                                                                    | A30                                                                        |
| Help content                                                          | `help_articles` [SQL]                                                        | Help endpoints                                                                            | A27                                                                        |
| Notification wording                                                  | `notification_templates` [SQL]                                               | Rendered server-side                                                                      | A25                                                                        |
| Maintenance, forced update, banners                                   | `maintenance_windows`, `app_versions`, `site_settings` [SQL]                 | `GET /v1/config`; website config (MOD-00 GAP-MOD00-04)                                    | A31, A28                                                                   |
| Admin console constants: page sizes, SLA timers, reason lists, macros | `remote_config`, catalogue tables, `admin_macros`, `admin_saved_views` [SQL] | `/admin/v1`                                                                               | The same admin pages; the console has no private constants                 |
| Admin navigation and what an admin may do                             | `admin_permissions` and the session's effective permissions [ADM §1.1]       | `/admin/v1`                                                                               | RBAC (A05)                                                                 |

What may stay in client code, because it cannot change without a release anyway:

- Layout, component structure, routes, `testID` values.
- Design tokens, which come from `packages/tokens` and never from a literal in a component.
- The list of entitlement **keys** (`packages/entitlements`), which a test keeps equal to the seed;
  the **values** always come from the API.
- Bundled default text in `packages/i18n`, used only until the served catalogue is loaded and when
  the device is offline.
- Technical constants with no product meaning: retry backoff, debounce, animation frames.

If a thing on a board has no source in the table above, it is a gap in the module plan, not a
constant in the client.

## 6. What is forbidden

| Forbidden                                                                                      | Why                                                              | Do this instead                                                                            | How it is caught                                                                    |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| A screen built on mock data, a local JSON file or a fake server because the API is not ready   | It hides contract mistakes and ships half-built screens (rule 1) | Build the API to its gate first                                                            | Review against the API gate; the progress log shows the gate before the client task |
| A hand-written `fetch`, `axios` call or URL string to our API                                  | It bypasses the contract and the types                           | Use the client from each app's `src/lib/api.ts`, which wraps `@1minitman/contracts/client` | Review today; a lint rule is GAP-STD06-01                                           |
| A hand-written request or response type that duplicates a contract                             | It drifts                                                        | Import the zod schema or the generated type from `@1minitman/contracts`                    | Review                                                                              |
| A client-side constant for a limit, price, duration, option list or plan rule                  | Rule 4                                                           | A `remote_config` key, catalogue, entitlement or price served by the API                   | Review against the module plan's section 3.4                                        |
| User-visible text as a literal in a component                                                  | Rule 4; [WEB §4.0]                                               | An i18n key                                                                                | Review; an i18n lint is planned in MOD-00                                           |
| A client deciding access (plan check, role check) as the only check                            | The API decides [TR §8.1], [ADM §1.1]                            | Enforce in the API; the client only hides                                                  | Negative authorisation tests (gate G6)                                              |
| A route with no contract, or a handler returning a shape its contract does not declare         | Clients cannot rely on it                                        | Define it in `packages/contracts` and register it with `createRouter().openapi()`          | Contract tests                                                                      |
| Editing a file in `packages/contracts/src/generated/` or `packages/contracts/openapi/` by hand | They are outputs                                                 | Change the route, run `pnpm contracts:generate`                                            | CI "Generated API client is up to date"                                             |
| A client importing `@1minitman/contracts/routes`                                               | It pulls `@hono/zod-openapi` into a bundle                       | Clients import `@1minitman/contracts` and `@1minitman/contracts/client` only               | Review; lint rule in GAP-STD06-01                                                   |
| A client reaching the database, Redis or a vendor with a secret                                | Only the API and worker do [TR §13.4]                            | An API route                                                                               | `pnpm check:client-bundles`                                                         |
| Removing or renaming a field, route or success response                                        | Released apps keep calling old endpoints for months              | Section 7                                                                                  | `scripts/check-contract-breaking.mjs`                                               |
| Data created by SQL in a shared environment "to unblock the app"                               | It proves nothing about the admin path                           | Create it through the admin console or a seed migration                                    | Review                                                                              |

A unit or component test that fakes the network at the client boundary is not a "mock-only
screen": it is a test. The rule is that the screen's first run, and its end-to-end tests, are
against the real API.

## 7. Changing a contract without breaking clients

Mobile releases stay installed for months [TR §5.1], so a contract may grow but not
shrink.

### 7.1 What the tooling checks

| Check                      | Where                                                               | What it does                                                                                                                                                                                                         |
| -------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Generated client drift     | CI job `verify`, step "Generated API client is up to date"          | Runs `pnpm contracts:generate && git diff --exit-code packages/contracts`. Fails if the committed OpenAPI documents or generated types differ from what the routes produce                                           |
| Breaking-change check      | CI job `verify`, step "No breaking API change" (pull requests only) | Runs `node scripts/check-contract-breaking.mjs "origin/<base>"`. Per surface it fails on: a removed path, a removed operation, a removed 2xx response, a removed response field, a newly required request-body field |
| Type-check of every client | `pnpm typecheck`                                                    | A changed type breaks the admin, web, site and mobile builds in the same pull request                                                                                                                                |

`pnpm contracts:generate` runs `openapi:emit` in `apps/api` (writes
`packages/contracts/openapi/*.json` from the route definitions) and then `generate` in
`packages/contracts` (runs `openapi-typescript` into `src/generated/`), as wired in `turbo.json`.

### 7.2 What the script does not check (review catches these)

The script compares JSON request bodies and 2xx JSON responses only. A reviewer must also refuse,
unless versioned:

- a new required query parameter, path parameter or header;
- a narrowed type (string to enum, a smaller maximum, an enum value removed from a request);
- a new enum value in a **response** that old clients switch on (clients must have a default
  branch: [1MM-STD-16](1MM-STD-16-DEFENSIVE-PROGRAMMING.md) section 9);
- a changed meaning with the same shape (units, time zone, sort order, default page size);
- a removed or re-statused error code ([1MM-STD-13](1MM-STD-13-ERROR-CODES.md) section 8);
- a changed WebSocket or SSE event shape (not in the OpenAPI documents).

Extending the script to cover parameters, enums and error responses is GAP-STD06-02.

### 7.3 How to make each kind of change

| Change                          | Method                                                                                                                                                                                                                             |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Add a response field            | Add it. Old clients ignore it (clients must not use strict object parsing on responses)                                                                                                                                            |
| Add an optional request field   | Add it with a server-side default that preserves the old behaviour                                                                                                                                                                 |
| Add an endpoint                 | Add it                                                                                                                                                                                                                             |
| Make a request field required   | Not allowed on an existing route. Add a new route or keep the default                                                                                                                                                              |
| Rename a field                  | Expand, then contract: add the new field, serve both, move every client, wait until no supported app version sends or reads the old one (the OB1 version gate and `app_versions` define "supported" [TR §5.1], [SQL]), then remove |
| Remove a field or route         | The same, ending with a pull request in which the breaking-change check fails on purpose. That pull request needs a code-owner approval that names the minimum supported app version and an ADR in `docs/adrs/`                    |
| Change behaviour incompatibly   | A new route path (for example a new sub-path or a versioned segment under the same surface). The surface prefixes (`/v1`, `/public/v1`, `/admin/v1`) change only by an ADR                                                         |
| Add an enum value to a response | Allowed only if released clients have a default branch for unknown values; say so in the pull request                                                                                                                              |

The admin console, website and billing web app deploy with the API, so for the `admin` and `public`
surfaces the waiting period is one deploy, but the order is the same: expand, move clients,
contract. The database follows the same expand-then-contract rule (`packages/db/migrations/README.md`).

## 8. Worked example: the `system` module

The `system` module (health and readiness) is the only feature in the scaffold and is the pattern
to copy. Follow the files in this order.

**Step 1, data review.** The feature shows whether the service and its dependencies are up. It
needs no table. Its consumers are the platform's probes and the status line each client shows
(`status.apiOnline`, `status.apiOffline` in `packages/i18n`; the scaffold's key names, due to be
rewritten in snake_case under [1MM-STD-17](1MM-STD-17-LANGUAGE-CONFIGURATION.md) section 4).

**Step 2, schema.** Not applicable: no table.

**Step 3, contract.** `packages/contracts/src/schemas/system.ts` defines `EnvironmentSchema`,
`HealthSchema`, `DependencyCheckSchema` and `ReadinessSchema` as zod objects, named for OpenAPI
with `.meta({ id })`, and exports the inferred types. `packages/contracts/src/routes/system.ts`
defines `healthRoute` (`GET /health`, 200) and `readinessRoute` (`GET /ready`, 200 and 503) with
`createRoute`. The schemas are exported from `packages/contracts/src/index.ts` (safe for every
client); the routes from `packages/contracts/src/routes/index.ts` (API only).

**Step 4, OpenAPI.** `apps/api/src/cli/emit-openapi.ts` builds one document per surface with
`buildOpenApiDocument()` from `apps/api/src/app.ts` and writes
`packages/contracts/openapi/{member,public,admin}.json`. It needs no database: `checkReadiness`
is a function that throws, because documents come from route definitions alone.

**Step 5, handler, rules and tests.**

| Layer             | File                                                         | What it holds                                                                                                                                                     |
| ----------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `domain/`         | `apps/api/src/modules/system/domain/dependency-probe.ts`     | The port `DependencyProbe` (`name`, `ping()`) and `DependencyStatus`. No imports                                                                                  |
| `application/`    | `apps/api/src/modules/system/application/check-readiness.ts` | The use case `createCheckReadiness(probes)`: asks every probe in parallel, each under a 2-second timeout, and summarises                                          |
| `infrastructure/` | `apps/api/src/modules/system/infrastructure/probes.ts`       | `postgresProbe` (`SELECT 1`) and `redisProbe` (`PING`): the real adapters for the port                                                                            |
| `http/`           | `apps/api/src/modules/system/http/system.routes.ts`          | `createSystemRouter(deps)`: `createRouter().openapi(healthRoute, …).openapi(readinessRoute, …)`; returns 503 when not ready                                       |
| Public face       | `apps/api/src/modules/system/index.ts`                       | The only file other code imports                                                                                                                                  |
| Composition       | `apps/api/src/app.ts`                                        | `createApp(deps)` is a pure function of its dependencies, so a test builds the app in memory                                                                      |
| Test              | `apps/api/src/app.test.ts`                                   | Expected (`/health` is 200 without touching dependencies), unexpected (unknown route → problem+json with the request id), variable (database down → `/ready` 503) |

A feature module registers its router inside the matching builder in
`apps/api/src/surfaces/index.ts` (`member`, `public` or `admin`); `system` is mounted at the root
because probes sit outside the surfaces.

**Step 6, supply.** Two i18n keys (`status.apiOnline`, `status.apiOffline`) exist in
`packages/i18n/src/locales/en.json`. No seeds, permissions or entitlements apply.

**Step 7, generated client.** `pnpm contracts:generate` writes `/health` and `/ready` into
`packages/contracts/src/generated/{member,public,admin}.ts`. Each client then calls them through
its own wrapper, fully typed: `apps/admin/src/lib/api.ts` (`createAdminClient`),
`apps/web/src/lib/api.ts` (`createMemberClient` with credentials),
`apps/mobile/src/lib/api.ts` (`createMemberClient`), and the website footer
(`createPublicClient`).

**Step 8, gate.** CI `verify` proves G10 and G11. For this module G6, G7, G9 and G14 are not
applicable (no auth, no writes, no jobs).

**Steps 9 to 11, clients.** Only now do the admin shell, the website footer and the app's tab
screen show the status, each reading the same typed response. None of them has its own idea of
what "healthy" means: the API's `status` field decides.

What a real feature adds to this pattern: a migration and model (step 2), error responses declared
on the route (step 3), authentication, authorisation, idempotency and rate limiting (step 5), and
the supply rows of section 4 (step 6).

## 9. Roles in a pull request

| Who               | Checks                                                                                                                             |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Author (or agent) | Follows section 2 in order; fills the API gate or names the gate that already passed; lists contract changes by kind (section 7.3) |
| Reviewer          | Refuses client code whose API gate is not recorded; reads the OpenAPI diff before the handler; applies section 7.2                 |
| CI                | Drift check, breaking-change check, type-check of every client, tests, builds, client-bundle scan                                  |

## 10. Gaps raised

Dispositions are recorded in [1MM-LOG-03](../1MM-LOG-03-TECHNICAL-REFERENCE-EXTENSIONS.md)
(Technical Reference and schema), [1MM-LOG-02](../1MM-LOG-02-UI-UPDATES.md) (UI) and
[1MM-LOG-04](../1MM-LOG-04-OPEN-DECISIONS-AND-FOLLOW-UPS.md) (owner decisions and repository
follow-ups).

| Gap id       | Type | Where found                                   | What is missing or conflicting                                                                                                                                                                                      | Proposed resolution                                                                                                                                                                                                               | Blocks                        |
| ------------ | ---- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| GAP-STD06-01 | REPO | `eslint.config.mjs`                           | Nothing stops a client from calling `fetch` on the API directly, or from importing `@1minitman/contracts/routes`                                                                                                    | Add to the client blocks (`apps/{admin,web,site,mobile}`, `packages/ui-*`): `no-restricted-globals` / `no-restricted-syntax` for `fetch(` outside `src/lib/api.ts`, and `no-restricted-imports` for `@1minitman/contracts/routes` | First client feature (MOD-00) |
| GAP-STD06-02 | REPO | `scripts/check-contract-breaking.mjs`         | The check covers removed paths, operations, 2xx responses, response fields and newly required body fields. It does not cover query, path or header parameters, enum narrowing, error responses, or non-JSON content | Extend the script to compare `parameters` (new required), request enum values (removed), and declared error responses (removed); keep the output format                                                                           | MOD-00-API-01                 |
| GAP-STD06-03 | REPO | `packages/contracts/package.json`             | The package has no `test` script, so contract tests (every operation declares auth, errors and a rate-limit policy; schemas round-trip) have nowhere to run                                                         | Add `"test": "bun test"` and the enumeration tests planned in MOD-00                                                                                                                                                              | API gate item G2              |
| GAP-STD06-04 | REPO | `docs/USAGE.md` §4, `packages/db/migrations/` | `docs/USAGE.md` says "the next number is `0006`", but `0006_partition_function_definer.sql` already exists                                                                                                          | Change the sentence to "use the next free number"                                                                                                                                                                                 | none                          |
| GAP-STD06-05 | TR   | [TR §8.1], [TR §17.3]                         | The Technical Reference states the contract tooling but not the build order, the API gate or the compatibility rule for released app versions                                                                       | Add a short subsection to [TR §8.1] that points to this standard: order API → admin → web → mobile, the gate, and "a contract may grow but not shrink while a supported app version uses it"                                      | none                          |

## Change log

| Version | Date        | Change                                                                                              |
| ------- | ----------- | --------------------------------------------------------------------------------------------------- |
| v1.0    | 24 Nov 2026 | First issue: the rule, the sequence, the API gate, supply, source mapping, contract change, example |
