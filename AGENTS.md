# AGENTS.md

Entry point for any coding agent working in this repository. Read it at the start of every
session, then follow the links. The full procedure is
[1MM-STD-02 Agentic operations](docs/standards/1MM-STD-02-AGENTIC-OPERATIONS.md).

## What this is

1minitman is a dating app. One TypeScript monorepo (pnpm 10 workspaces, Turborepo, Node 24):

- `apps/api` Hono on Bun: `/v1` (members), `/public/v1` (website), `/admin/v1`, `/webhooks`
- `apps/worker` pg-boss jobs on Bun
- `apps/admin` staff console · `apps/web` billing only · `apps/site` public website · `apps/mobile`
  member app (Expo)
- `packages/` `db`, `contracts`, `entitlements`, `i18n`, `tokens`, `ui-web`, `ui-native`

The repository is scaffolded; features are built module by module from `docs/execution/`.

## Rules that are not negotiable

1. **API first.** Order inside every module: API → admin → web → mobile. No client code before
   the module's API gate is recorded as passed. Never build against a stub or a missing endpoint.
2. **Data first.** Before building, check every input, label, limit and list against the schema,
   the config keys and the i18n catalogue (module plan §3). Anything missing is a gap, not a guess.
3. **Everything is admin-managed.** Text, option lists, limits and rules that can change come from
   the API and are edited in the admin console, including the console's own constants. Do not
   hard-code them.
4. **Never invent a fact.** Endpoints, tables, columns, permissions, config keys and screen ids
   come from the cited sources. If it is missing, raise a gap (`GAP-MOD07-01`) in the document's
   "Gaps raised" section and stop that task.
5. **The repository is public.** No secrets, no `.env` files except `.env.example`, no real
   member data, no personal e-mail addresses or phone numbers, nothing from the private spec pack
   beyond cited facts, no business or investor content.
6. **Two branches, pull requests only.** `develop` is the default; `production` is live. Never
   push to either. Branch from `develop`, open a pull request, a code owner reviews and merges.
7. **Signed commits.** Every commit is signed. Never use `--no-verify`.
8. **One module task per pull request**, named by its task id (`MOD-07-API-03`).
9. **Never** weaken branch protection or CI, skip or delete a test to get green, edit an applied
   migration, hand-edit generated files, merge, deploy, or touch a hosted environment.
10. Plans are **Free, Premium, Gold**. **Black Badge** is a one-off verification, never a
    subscription.
11. At most **five agents** work at once, sub-agents included. Do not edit files another open
    task owns.

## Mandatory for every task

Three standards bind every agent and every engineer on every task. Read them before the first
task and follow them without exception; work that breaks one is not merged.

- [1MM-STD-02 Agentic operations](docs/standards/1MM-STD-02-AGENTIC-OPERATIONS.md): how records,
  decisions, gaps and memory are kept, so that nothing is orphaned.
- [1MM-STD-06 API first](docs/standards/1MM-STD-06-API-FIRST.md): no API, no client code.
- [1MM-STD-04 Brand guide](docs/standards/1MM-STD-04-BRAND-GUIDE.md): the developer and agent
  contract for anything a person sees or reads; every UI pull request passes its §17 checklist.
  Every screen that takes input also follows
  [1MM-STD-21 Client input validation](docs/standards/1MM-STD-21-CLIENT-INPUT-VALIDATION.md)
  (proposed, [1MM-ADR-0080](docs/adrs/1MM-ADR-0080-CLIENT-INPUT-VALIDATION-STRATEGY.md)).

## Reading order

1. This file.
2. [docs/1MM-INDEX.md](docs/1MM-INDEX.md): map of every document.
3. [docs/1MM-LOG-01-PROGRESS.md](docs/1MM-LOG-01-PROGRESS.md): status board, newest entries, the
   last "Next step".
4. [docs/execution/1MM-EXE-00-MASTER-PLAN.md](docs/execution/1MM-EXE-00-MASTER-PLAN.md): order,
   dependencies, gates.
5. Your module plan in `docs/execution/` (`1MM-EXE-MOD-nn-…`): §3 data, §4 API, §8 tasks, §12 gaps.
6. The standards for your kind of task (table in
   [1MM-STD-02 §4](docs/standards/1MM-STD-02-AGENTIC-OPERATIONS.md)). Always:
   [API first](docs/standards/1MM-STD-06-API-FIRST.md),
   [coding conventions](docs/standards/1MM-STD-14-CODING-CONVENTIONS.md),
   [testing](docs/standards/1MM-STD-01-TESTING-STRATEGY.md),
   [commits and local CI](docs/standards/1MM-STD-10-COMMITS-AND-LOCAL-CI.md),
   [contributing](docs/standards/1MM-STD-08-CONTRIBUTING.md).
7. Database work: `docs/database/`. Decisions: [docs/adrs/](docs/adrs/1MM-ADR-0000-INDEX.md).
   How to run and add things: [docs/USAGE.md](docs/USAGE.md).

Precedence when records disagree: owner decisions → Technical Reference and
[its extensions log](docs/1MM-LOG-03-TECHNICAL-REFERENCE-EXTENSIONS.md) → ADRs → standards →
module plans → code.

## Commands

| Command                                       | Use                                                                          |
| --------------------------------------------- | ---------------------------------------------------------------------------- |
| `pnpm install`, `pnpm preflight`              | Install (pnpm 10; Node 24 from `.nvmrc`); check this machine                 |
| `pnpm dev`                                    | Database, Redis, migrations and every app                                    |
| `pnpm dev:core` / `pnpm dev:api`              | API + admin + website + Metro / API + worker only                            |
| `pnpm services:up` / `down` / `reset`         | Local PostgreSQL 16 + PostGIS and Redis                                      |
| `pnpm db:migrate` / `db:status`               | Apply / list migrations                                                      |
| `pnpm db:roles`                               | Apply database roles after a migration (`pnpm dev` runs it for you on start) |
| `pnpm contracts:generate`                     | Regenerate OpenAPI and typed clients after a route change                    |
| `pnpm check`, `pnpm format`                   | Format check, lint, repository rules, type-check, tests; Prettier            |
| `pnpm check:banned-terms`                     | Retired product terms                                                        |
| `pnpm build` then `pnpm check:client-bundles` | Builds; no server-only setting in a client bundle                            |

`pnpm check` is not all of CI. The full local run is in
[1MM-STD-10](docs/standards/1MM-STD-10-COMMITS-AND-LOCAL-CI.md). Nothing is pushed with a red
local check.

## Where things live

| Thing                          | Place                                                                                |
| ------------------------------ | ------------------------------------------------------------------------------------ |
| API module                     | `apps/api/src/modules/<name>/{domain,application,infrastructure,http}`               |
| Request, response, route       | `packages/contracts/src/schemas/`, `packages/contracts/src/routes/`                  |
| Generated OpenAPI and clients  | `packages/contracts/openapi/`, `packages/contracts/src/generated/` (never hand-edit) |
| Migration                      | `packages/db/migrations/` (next unused number; never edit an applied file)           |
| Database roles                 | `packages/db/roles/`                                                                 |
| Worker job                     | `apps/worker/src/jobs/`                                                              |
| Admin route                    | `apps/admin/src/routes/`                                                             |
| Website page                   | `apps/site/src/pages/`                                                               |
| App screen                     | `apps/mobile/src/app/`                                                               |
| Tokens (colour, type, spacing) | `packages/tokens/tokens.json` (never a hex value in a component)                     |
| Settings                       | `.env.example` is the list; `.env.development` is local and never committed          |

## Session start

1. `git status` clean; `git fetch`; branch from `origin/develop`.
2. Read the progress log's status board and newest entries for your module.
3. Find your task id in the module plan; confirm dependencies, open gaps and (for client tasks)
   the API gate. Read the standards for the task. `pnpm preflight`.

## Session end

1. Local checks green; work committed (signed) and pushed to its own branch.
2. Add an entry to [docs/1MM-LOG-01-PROGRESS.md](docs/1MM-LOG-01-PROGRESS.md): what changed,
   evidence, gate status, gaps raised or closed, next step.
3. New gap → the document's "Gaps raised" table. New decision → an ADR and its index row.
   Scope or task change → the module plan's change log. New document → `docs/1MM-INDEX.md`.
4. No scratch files, secrets or private spec content in the diff.

Stop and ask a human for: owner decisions, secrets, merges, anything on a hosted environment,
repository settings.
