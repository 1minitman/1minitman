# 1minitman

_Don't waste my time._

## What 1minitman is

1minitman is a dating app for people who do not want their time wasted. Members are real people:
the **Black Badge** is a one-off verification (a phone and face check), never a subscription. A
match opens with the **1-Minute Intro** before chat, and there are three plans: **Free**,
**Premium** and **Gold**.

This repository is the whole product in one TypeScript monorepo: the API, the background worker,
the admin console, the public website, the billing web app and the member app, with the packages
they share.

## Contents

- [Apps and packages](#apps-and-packages)
- [Architecture](#architecture)
- [The API-first rule](#the-api-first-rule)
- [Prerequisites](#prerequisites)
- [Quick start](#quick-start)
- [Everyday commands](#everyday-commands)
- [Environment files](#environment-files)
- [Project layout](#project-layout)
- [How the work is organised](#how-the-work-is-organised)
- [Testing](#testing)
- [Branches and contributing](#branches-and-contributing)
- [Security](#security)
- [Status](#status)
- [Licence](#licence)

## Apps and packages

Six apps. Apps are deployed; they are never imported by anything else.

| App           | What it is                                                                    | Built with                                             | Local address                    | Deploys to       |
| ------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------ | -------------------------------- | ---------------- |
| `apps/api`    | The API. Everything is made here; nothing else touches the database.          | Hono on Bun, `@hono/zod-openapi`                       | `http://localhost:4000`          | Railway          |
| `apps/worker` | Background jobs: clean-ups, reminders, scheduled work.                        | pg-boss on Bun                                         | none                             | Railway          |
| `apps/admin`  | The staff console: the business is run from it.                               | Vite, React 19, TanStack Router and Query, Tailwind v4 | `http://localhost:5173`          | Cloudflare Pages |
| `apps/web`    | The billing web app: paying for and managing a plan on the web. Billing only. | Vite, React                                            | `http://localhost:5174`          | Cloudflare Pages |
| `apps/site`   | The public website, in English, Naijá (`pcm`) and French. Information only.   | Astro (static)                                         | `http://localhost:4321`          | Cloudflare Pages |
| `apps/mobile` | The member app for iOS and Android.                                           | Expo, Expo Router, NativeWind, React Native            | Metro on `http://localhost:8081` | EAS              |

Seven packages. Packages are shared; each exposes only what its `exports` declare.

| Package                 | What it holds                                                                                                                     | Used by                                                                         |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `packages/db`           | The schema (v3.4 baseline), forward-only SQL migrations, the migration runner, least-privilege database roles, the Drizzle client | API, worker                                                                     |
| `packages/contracts`    | zod schemas, route definitions, one OpenAPI document per API surface, generated typed clients                                     | API and every client                                                            |
| `packages/entitlements` | Roles, plans, entitlement keys and the pure rules over them                                                                       | API, member app                                                                 |
| `packages/i18n`         | The `en`, `pcm` and `fr` catalogues                                                                                               | API, website, member app today; every client as its text moves to the catalogue |
| `packages/tokens`       | Brand tokens, built to CSS, TypeScript and a NativeWind preset                                                                    | Website, member app and both UI packages                                        |
| `packages/ui-web`       | shadcn-style components on the tokens                                                                                             | Admin console, web app                                                          |
| `packages/ui-native`    | NativeWind components on the tokens                                                                                               | Member app                                                                      |

## Architecture

```
                    ┌──────────── packages/contracts ────────────┐
                    │  one contract, one typed client for all    │
                    └─────────────────────┬──────────────────────┘
 admin console ──/admin/v1──┐             │
 website ───────/public/v1──┼──▶  API (Hono on Bun)  ──▶  PostgreSQL 16 + PostGIS
 web app ──────────────/v1──┤        │        ▲            Redis
 member app ───────────/v1──┘        │        │
 payment / SMS vendors ──/webhooks───┘     worker (pg-boss jobs)
```

- **One back end.** Only the API and the worker reach the database. Every client goes through
  the API.
- **Four API surfaces.** `/v1` for members (the app and the billing web app), `/public/v1` for
  the website, `/admin/v1` for the console, `/webhooks` for inbound vendor calls.
- **One contract.** Routes are declared with zod schemas in `packages/contracts`. The OpenAPI
  documents and the typed clients are generated from them, so a client can only call what the API
  offers. Invalid requests are rejected before any use case runs.
- **Errors are `problem+json`** (RFC 9457) and carry a request id.
- **API modules have four layers:** `domain`, `application`, `infrastructure`, `http`. Lint rules
  enforce the layering and the workspace boundaries.
- **Least privilege in the database.** The API, the admin API, the worker, the job queue and the
  migrator each connect as their own database role with only the rights they need.
- **Everything a person reads is data.** Text, option lists, limits and rules that can change are
  served by the API and managed in the admin console, not written into a client.

## The API-first rule

Every module is built in the same order, every time:

**API → admin → web (website, billing web app) → mobile**

1. The data is checked first: every field, label and limit against the schema.
2. The API is built and fully supplied: contract, migration, use cases, routes, jobs, tests.
3. The module's **API gate** is passed and recorded.
4. Only then do the clients start: admin console, then web, then the member app.

No client code is written against a missing endpoint or a stub. The full rule is
[1MM-STD-06 The API-first approach](docs/standards/1MM-STD-06-API-FIRST.md).

## Prerequisites

| Tool                                           | Version                                  | Needed for                                                 |
| ---------------------------------------------- | ---------------------------------------- | ---------------------------------------------------------- |
| Node                                           | 24 (`.nvmrc`; run `nvm install`)         | Everything                                                 |
| pnpm                                           | 10 (`packageManager` in `package.json`)  | Everything                                                 |
| Docker Desktop, running                        | Any current version                      | The local PostgreSQL 16 + PostGIS and Redis                |
| Xcode or Android Studio, or Expo Go on a phone | Current                                  | Running the member app                                     |
| gitleaks                                       | Current (`brew install gitleaks`)        | The deeper secret scan before each commit                  |
| A commit-signing key                           | SSH or GPG, added to your GitHub account | Committing: the protected branches refuse unsigned commits |

Bun, the runtime of the API and the worker, is installed by `pnpm install`.

## Quick start

```bash
pnpm install
pnpm preflight     # checks this machine and says what is missing
pnpm dev           # database, Redis, migrations, then every app side by side
```

`pnpm dev` creates `.env.development` from `.env.example` if it is missing; the local defaults
work as they are. It also applies the database migrations and the least-privilege database roles,
so the users the apps connect as exist before the apps start.

| What               | Where                                                                             |
| ------------------ | --------------------------------------------------------------------------------- |
| API                | http://localhost:4000 · health `/health` · readiness `/ready` · reference `/docs` |
| Admin console      | http://localhost:5173                                                             |
| Billing web app    | http://localhost:5174                                                             |
| Website            | http://localhost:4321 (also `/pcm/` and `/fr/`)                                   |
| Member app (Metro) | http://localhost:8081                                                             |
| PostgreSQL         | `localhost:5432`                                                                  |
| Redis              | `localhost:6379`                                                                  |

Variations:

```bash
pnpm dev --core              # API + admin + website + Metro
pnpm dev --only api,admin    # choose from: api, worker, admin, web, site, mobile
pnpm dev --skip-services     # you run PostgreSQL and Redis yourself
```

[docs/USAGE.md](docs/USAGE.md) has the longer guide: the terminal screen you get, running on a
real phone, how to add an endpoint, a migration, a job, a page or a screen, and what to do when
something goes wrong.

## Everyday commands

| Command                                               | What it does                                                              |
| ----------------------------------------------------- | ------------------------------------------------------------------------- |
| `pnpm dev`, `pnpm dev:core`, `pnpm dev:api`           | Run everything / the core apps / the API and worker only                  |
| `pnpm preflight`                                      | Check that this machine can run the project                               |
| `pnpm services:up`, `services:down`, `services:reset` | Start, stop, or wipe and restart the local database and Redis             |
| `pnpm db:migrate`, `pnpm db:status`                   | Apply pending migrations; list migrations and whether each is applied     |
| `pnpm db:roles`                                       | Apply the least-privilege database roles and local login users            |
| `pnpm db:pull`                                        | Write reference Drizzle models from the live database                     |
| `pnpm contracts:generate`                             | Regenerate the OpenAPI documents and typed clients after changing a route |
| `pnpm check`                                          | Format check, lint, repository rules, type-check and tests                |
| `pnpm format`, `pnpm format:check`                    | Format the code; check formatting                                         |
| `pnpm lint`, `pnpm typecheck`, `pnpm test`            | Each check on its own                                                     |
| `pnpm check:repo`, `pnpm check:banned-terms`          | Workflow and workspace rules; retired product terms                       |
| `pnpm build`, then `pnpm check:client-bundles`        | Production builds; prove no server-only setting reached a client bundle   |
| `pnpm audit:deps`                                     | Fail on high or critical dependency advisories                            |

## Environment files

- **`.env.example`** is committed. It is the full list: every variable, what it is for and where
  to get it.
- **`.env.development`** is your local copy. It is never committed. `pnpm dev` creates it.
- One file at the repository root feeds every app. Nothing reads a per-app `.env`.
- A value reaches a browser or a phone only if its name starts with `VITE_` (admin, web app),
  `PUBLIC_` (website) or `EXPO_PUBLIC_` (member app). Never give a secret one of those prefixes.
- Section 1 of `.env.example` is all you need to run locally. Fill a vendor's section when you
  start the feature that uses it.
- Hosted environments do not use files: the same names are set in each platform's own encrypted
  variables.

## Project layout

```
apps/
  api/        Hono on Bun: /v1 · /public/v1 · /admin/v1 · /webhooks
  worker/     pg-boss jobs on Bun
  admin/      staff console
  web/        billing web app
  site/       public website (en / pcm / fr)
  mobile/     member app (Expo)
packages/
  db/            schema, migrations, migrator, roles, Drizzle client
  contracts/     zod schemas, routes, OpenAPI, generated clients
  entitlements/  roles, plans, entitlement keys, rules
  i18n/          en / pcm / fr catalogues
  tokens/        brand tokens → CSS, TypeScript, NativeWind preset
  ui-web/        web components on the tokens
  ui-native/     native components on the tokens
docs/
  1MM-INDEX.md   map of every document
  execution/     master plan and one plan per module
  standards/     engineering standards
  database/      database design
  resources/     open-source and platform choices
  adrs/          architecture decision records
  USAGE.md       how to run, add things and get keys
infra/           Dockerfile and Railway config for the API and worker
assets/          logo pack and illustrations (sources)
scripts/         the dev runner, preflight and the repository checks
.github/         CI workflow, branch rulesets, code owners, pull-request template
```

## How the work is organised

The build is planned and governed by the documents in `docs/`. Start at the index.

| Document                                                                                               | What it is                                                                                                  |
| ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| [docs/1MM-INDEX.md](docs/1MM-INDEX.md)                                                                 | The map of every document                                                                                   |
| [docs/execution/1MM-EXE-00-MASTER-PLAN.md](docs/execution/1MM-EXE-00-MASTER-PLAN.md)                   | The master plan: the order of the modules, their dependencies and gates                                     |
| [docs/execution/](docs/execution/)                                                                     | One plan per module, MOD-00 to MOD-19: data first, then API, admin, web, mobile, tests, exit gate           |
| [docs/standards/](docs/standards/)                                                                     | The engineering standards: testing, API first, coding conventions, security, errors, design system and more |
| [docs/database/](docs/database/)                                                                       | Database design: schemas, migrations, SQL structure, indexing, security, data protection                    |
| [docs/adrs/1MM-ADR-0000-INDEX.md](docs/adrs/1MM-ADR-0000-INDEX.md)                                     | Architecture decision records                                                                               |
| [docs/resources/](docs/resources/)                                                                     | Open-source and platform choices                                                                            |
| [docs/1MM-LOG-01-PROGRESS.md](docs/1MM-LOG-01-PROGRESS.md)                                             | The progress log: the state of each module and what was done, with evidence                                 |
| [docs/1MM-LOG-02-UI-UPDATES.md](docs/1MM-LOG-02-UI-UPDATES.md)                                         | The UI updates log: design changes the build needs                                                          |
| [docs/1MM-LOG-03-TECHNICAL-REFERENCE-EXTENSIONS.md](docs/1MM-LOG-03-TECHNICAL-REFERENCE-EXTENSIONS.md) | The public trail of additions to the Technical Reference and schema                                         |
| [docs/1MM-LOG-04-OPEN-DECISIONS-AND-FOLLOW-UPS.md](docs/1MM-LOG-04-OPEN-DECISIONS-AND-FOLLOW-UPS.md)   | Open owner decisions and repository follow-ups                                                              |
| [docs/USAGE.md](docs/USAGE.md)                                                                         | The practical guide to running the repository                                                               |
| [AGENTS.md](AGENTS.md)                                                                                 | The entry point for coding agents                                                                           |

The product specifications are kept outside this repository, because the repository is public.
The documents here derive from them and cite them.

## Testing

```bash
pnpm services:up && pnpm db:migrate && pnpm db:roles   # the database tests need a real database
pnpm test                                              # every workspace's tests
pnpm --filter @1minitman/api test                      # one workspace
pnpm check                                             # format, lint, repository rules, type-check, tests
```

CI (the `verify` job) runs more than `pnpm check`: a frozen install, a dependency audit, a secret
scan, the schema and roles on PostgreSQL 16 + PostGIS, a check that the generated client is up to
date, a check for breaking API changes, the builds and a scan of the client bundles. How to run
every step locally is in
[1MM-STD-10 Commits and local CI](docs/standards/1MM-STD-10-COMMITS-AND-LOCAL-CI.md). What is
tested, and how, per app, is in
[1MM-STD-01 Testing strategy](docs/standards/1MM-STD-01-TESTING-STRATEGY.md).

## Branches and contributing

- **`develop`** is the default branch. All work arrives here by pull request, squash-merged.
- **`production`** is what is live. It changes only by an approved merge commit from `develop`.
- There are no other long-lived branches. Nobody pushes to either branch directly.
- Every pull request needs a green `verify` check, a clean CodeQL result (GitHub default
  set-up), signed commits and an
  approving review from a code owner who is not the author.
- One module task per pull request, named by its task id.

Read [CONTRIBUTING.md](CONTRIBUTING.md) before your first pull request.

## Security

Do not open a public issue for a security problem. Follow [SECURITY.md](SECURITY.md).

This repository is public. Never commit a secret, an `.env` file other than `.env.example`, or
real member data. A pre-commit hook, GitHub push protection and the CI secret scan guard against
it; a secret that reaches GitHub is treated as leaked and replaced at once.

## Status

The monorepo is scaffolded. The API serves health and readiness only; there are no product
features yet. The documents that plan the build are in `docs/`, and the build proceeds module by module from the
[master plan](docs/execution/1MM-EXE-00-MASTER-PLAN.md). The current state of every module is on
the status board in [docs/1MM-LOG-01-PROGRESS.md](docs/1MM-LOG-01-PROGRESS.md).

## Licence

There is no licence file in this repository yet. The terms on which the code may be used, copied
or contributed to are an open owner decision (DEC-001 in
[docs/1MM-LOG-04-OPEN-DECISIONS-AND-FOLLOW-UPS.md](docs/1MM-LOG-04-OPEN-DECISIONS-AND-FOLLOW-UPS.md)).
Until a licence file is added, no licence is granted.
