# Using this repository

A plain guide to what is here, how the parts fit, how to run them, and where every account and key
comes from.

## 1. The picture

Think of a restaurant.

- The **API** is the kitchen. Everything is made there. Nothing else touches the database.
- The **worker** is the prep cook working in the background: clean-ups, reminders, scheduled jobs.
- The **admin console** is the manager's office: staff run the business from it.
- The **website** is the shop window: it tells people what 1minitman is. Information only.
- The **web app** is the till: paying and managing a plan on the web. Billing only.
- The **member app** is the dining room: where members actually use the product.

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

### The one rule: API → admin → website → app

Every feature is built in that order, every time.

1. **API.** Add the route and its contract. Run `pnpm contracts:generate`.
2. **Admin.** Staff can now see and manage the thing.
3. **Website.** If the public needs to read it.
4. **App.** Members use it.

A client can never get ahead of the API, because clients only call what the generated client offers.

## 2. First run

You need: **Node 24** (run `nvm install` in the repo; it reads `.nvmrc`), **pnpm 10**, **Docker Desktop** (running). For the phone app: Xcode
(iOS simulator) or Android Studio, or the Expo Go app on a real phone.

```bash
pnpm install
pnpm preflight     # checks your machine and tells you what is missing
pnpm dev
```

`pnpm dev` does everything: creates `.env.development` if missing, starts the database and Redis,
applies the database schema, then starts all six programs side by side.

| What               | Where                                                                             |
| ------------------ | --------------------------------------------------------------------------------- |
| API                | http://localhost:4000 · health `/health` · readiness `/ready` · reference `/docs` |
| Admin console      | http://localhost:5173                                                             |
| Billing web app    | http://localhost:5174                                                             |
| Website            | http://localhost:4321 (also `/pcm/` and `/fr/`)                                   |
| Member app (Metro) | http://localhost:8081                                                             |
| PostgreSQL         | `localhost:5432`, user / password / database: `minitman`                          |
| Redis              | `localhost:6379`                                                                  |

### The screen you get

The terminal shows a list of tasks on the left. Arrow keys pick one; its log shows on the right.

- Pick **`@1minitman/mobile#dev`** and press **`i`** to enter it. Now Metro's keys work:
  `i` opens the iOS simulator, `a` opens Android, `r` reloads. Press **Ctrl+Z** to leave the task.
- **Ctrl+C** stops everything.

On a real phone: install Expo Go, scan the QR code in the mobile task, and set
`EXPO_PUBLIC_API_URL` in `.env.development` to your computer's Wi-Fi address (see the note in that
file), because `localhost` on a phone means the phone.

### Variations

```bash
pnpm dev --core              # API + admin + website + Metro
pnpm dev --only api,admin    # choose: api, worker, admin, web, site, mobile
pnpm dev --skip-services     # you run PostgreSQL and Redis yourself
```

## 3. Everyday commands

| Command                                     | What it does                                                                           |
| ------------------------------------------- | -------------------------------------------------------------------------------------- |
| `pnpm dev`                                  | Run everything locally.                                                                |
| `pnpm check`                                | Format check, lint, type-check and tests. Run before a pull request.                   |
| `pnpm contracts:generate`                   | Rebuild the typed API client after changing a route.                                   |
| `pnpm db:migrate`                           | Apply new database migrations.                                                         |
| `pnpm db:status`                            | List migrations and whether each is applied.                                           |
| `pnpm db:pull`                              | Write reference Drizzle models from the live database to `packages/db/.introspected/`. |
| `pnpm services:reset`                       | Wipe the local database and Redis and start clean.                                     |
| `pnpm build`                                | Production builds of everything.                                                       |
| `pnpm format`                               | Format the code.                                                                       |
| `pnpm --filter @1minitman/mobile eas <...>` | Run EAS (Expo build service) with the robot token loaded.                              |

## 4. How to add things

### An API endpoint

The API is split into **modules** (`apps/api/src/modules/<name>`). Each has four layers, and each
layer may only know about the ones above it in this list:

| Folder            | Holds                                                     | May import                  |
| ----------------- | --------------------------------------------------------- | --------------------------- |
| `domain/`         | Rules and the interfaces ("ports") the module needs.      | Nothing outside the module. |
| `application/`    | Use cases: one function per thing the module does.        | `domain/`                   |
| `infrastructure/` | The real implementations: database queries, vendor calls. | `domain/`, libraries        |
| `http/`           | Routes: turn a request into a use-case call.              | `application/`, contracts   |

`modules/system` is the worked example (health and readiness). The lint rules enforce the layering.

Steps:

1. Define the request and response in `packages/contracts/src/schemas/`, and the route in
   `packages/contracts/src/routes/`.
2. Write the use case, then the route handler, in your module.
3. Register the module's router on its surface in `apps/api/src/surfaces/index.ts`
   (`member` = `/v1`, `public` = `/public/v1`, `admin` = `/admin/v1`).
4. `pnpm contracts:generate`. The admin console, website and app can now call it, fully typed.

Errors are always `problem+json` with a request id: throw `ProblemError` and the API formats it.

### A database change

1. Add the next numbered file in `packages/db/migrations/` (the next unused number: one above the
   highest file there). Never edit a
   file that has been applied.
2. `pnpm db:migrate`, then `pnpm db:roles` (new tables get the standard grants; add any
   table-specific `REVOKE` to `packages/db/roles/roles.sql`).
3. If code needs the table, add its model in `packages/db/src/schema/` (copy from `pnpm db:pull`
   output and tidy).

The schema has 221 tables already. `packages/db/SCHEMA_DATA_DICTIONARY.md` explains each one.

### A background job

Create a file in `apps/worker/src/jobs/` with `defineJob({ name, cron?, handle })` and add it to the
list in `jobs/index.ts`. Names come from the job catalogue in the Technical Reference (section 11).

### An admin page

Add a route file under `apps/admin/src/routes/`. The left navigation already lists every module from
the admin spec; until a module has its own route file it shows a placeholder naming its spec id,
milestone and permission. shadcn components go in `packages/ui-web`
(`pnpm dlx shadcn@latest add <name>` from that folder).

### A website page

Add a file under `apps/site/src/pages/`, then set `ready: true` for its link in
`apps/site/src/lib/navigation.ts`. Links only appear once their page exists.

### An app screen

Add a file under `apps/mobile/src/app/`. Route names follow the screen inventory (for example
`spec/[id].tsx` for D4). Shared pieces go in `packages/ui-native`. Use `testID` values copied from
the design (`welcome.cta.getStarted`).

### Colours, type, spacing

They come from one file: `packages/tokens/tokens.json`. Never write a hex colour in a component.
Change the token, run `pnpm --filter @1minitman/tokens build`, and web, admin, website and app all
follow.

## 5. Settings and secrets

- **`.env.example`** is the full list: every variable, what it is for and where to get it. Committed.
- **`.env.development`** is your local copy. Never committed. Created for you by `pnpm dev`.
- One file at the repo root feeds every app.
- A value reaches a browser or a phone only if its name starts with `VITE_`, `PUBLIC_` or
  `EXPO_PUBLIC_`. Never put a secret behind those prefixes.
- Hosted environments do not use files: the same names are set in Railway, Cloudflare Pages and EAS.

Section 1 of `.env.example` is all you need to run locally. Fill a vendor's section when you start
the feature that uses it.

## 6. Where to get each account and key

All chosen for near-zero fixed cost (owner decisions OD-06 and OD-11). "When" says when you need it.

| Service             | Used for                                             | Cost to start             | Where                                                  | When                     |
| ------------------- | ---------------------------------------------------- | ------------------------- | ------------------------------------------------------ | ------------------------ |
| Docker Desktop      | Local database and Redis                             | Free                      | docker.com                                             | Now                      |
| Expo / EAS          | Building and updating the app                        | Free tier                 | expo.dev (account `minitnetwork`, project `1minitman`) | App builds               |
| GitHub              | Code, reviews, CI                                    | Free (public repo)        | github.com/1minitman/1minitman                         | Now                      |
| Neon                | Hosted PostgreSQL + PostGIS (Frankfurt)              | Free tier                 | console.neon.tech                                      | First hosted environment |
| Upstash             | Hosted Redis (Frankfurt)                             | Free tier                 | console.upstash.com                                    | First hosted environment |
| Railway             | Runs the API and worker (EU West)                    | Small usage-based fee     | railway.com                                            | First hosted environment |
| Cloudflare          | DNS, CDN, WAF, Pages (admin, web, website), R2 media | Free plan                 | dash.cloudflare.com                                    | First hosted environment |
| Resend              | Email                                                | Free tier                 | resend.com                                             | Sign-up codes by email   |
| Termii              | SMS / WhatsApp codes (Nigeria)                       | Pay as you go             | accounts.termii.com                                    | Phone verification       |
| Twilio Verify       | Fallback for codes                                   | Pay as you go             | console.twilio.com                                     | Phone verification       |
| AWS                 | Face liveness checks, encryption keys                | Pay per check             | console.aws.amazon.com                                 | Black Badge              |
| RevenueCat          | App Store and Google Play purchases                  | Free tier                 | app.revenuecat.com                                     | Paid plans in the app    |
| Flutterwave         | Web payments                                         | Per transaction           | dashboard.flutterwave.com                              | Web billing              |
| Apple Developer     | iOS builds, Sign in with Apple                       | USD 99 a year             | developer.apple.com                                    | iOS builds               |
| Google Play Console | Android releases                                     | USD 25 once               | play.google.com/console                                | Android releases         |
| Google Cloud        | Google sign-in, Places                               | Free tier / pay as you go | console.cloud.google.com                               | Google sign-in, meet-ups |
| Sentry              | Crash and error reports                              | Free tier                 | sentry.io                                              | Before beta              |
| PostHog (EU)        | Product analytics, after consent                     | Free tier                 | eu.posthog.com                                         | Before beta              |
| daily.co            | Gold calls                                           | Free minutes              | dashboard.daily.co                                     | After public launch      |

The exact screen to click through for each key is written next to its variable in `.env.example`.

## 7. The member app in more detail

- Runs in **Expo Go** today (no native build needed). The first feature that needs custom native
  code (RevenueCat, face liveness, MMKV) moves it to a **development build**:
  `pnpm --filter @1minitman/mobile eas build --profile development --platform ios`.
- Before the first store build, set `ios.bundleIdentifier` and `android.package` in
  `apps/mobile/app.config.ts` to the ids of the **existing** store listings. They are deliberately
  not guessed here.
- `eas.json` has three profiles: `development`, `preview` (internal testers), `production`.
- The robot token (`EXPO_TOKEN`) lets EAS run without a personal login, locally and in CI.

## 8. Branches and releases

- **`develop`**: the default branch. Nobody pushes to it directly; work arrives by pull request,
  CI must pass, a review is required.
- **`production`**: what is live. It changes only by an approved merge commit from `develop`.

Flow: branch from `develop` → pull request → CI green + review → merge. To release: pull request
from `develop` into `production` → approval → merge commit.

### Turning the protection on (repository owner, once)

Branch rules can only be set by an account with **admin** rights on the repository. They are written
down in `.github/rulesets/` so nothing has to be typed by hand:

1. GitHub → the repository → **Settings → Rules → Rulesets → New ruleset → Import a ruleset**.
2. Import `.github/rulesets/develop.json`, then `.github/rulesets/production.json`.

Or from a terminal signed in as the owner:

```bash
gh api -X POST repos/1minitman/1minitman/rulesets --input .github/rulesets/develop.json
gh api -X POST repos/1minitman/1minitman/rulesets --input .github/rulesets/production.json
```

What they enforce: no direct pushes, no force pushes, no deleting the branch, signed commits, a pull
request with one approving code-owner review (never the author), resolved conversations, a green
`verify` check and no new high-severity CodeQL finding. `develop` takes
squash merges only; `production` takes merge commits only.

Also switch on, under **Settings → Code security**: secret scanning, push protection, Dependabot
alerts and private vulnerability reporting (all free on a public repository).

The repository is **public**: anyone can read both branches. Rules control who can change them, not
who can see them. If `production` must not be readable, make the repository private (branch rules
on a private repository need a paid GitHub plan).

### How the code is protected

| Risk                                   | Guard                                                                                                                                                                                                                                                                                                                                                         |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A poisoned dependency                  | Frozen lockfile in CI; install scripts run only for an allow-list and anything else fails the install; versions younger than 3 days are never resolved; a version with weaker publishing trust than its predecessor is refused; updates are proposed by hand (Dependabot alerts only); CI fails on high or critical advisories; CodeQL on every pull request. |
| A secret in the code                   | Pre-commit hook, GitHub push protection, CI secret scan.                                                                                                                                                                                                                                                                                                      |
| A secret in a browser or app bundle    | Only `VITE_`, `PUBLIC_` and `EXPO_PUBLIC_` names can reach a client; each app validates its settings when it starts; CI scans the built bundles for server-only names and values.                                                                                                                                                                             |
| Bad input                              | Every route is declared with a zod schema; invalid requests are rejected before any use case runs.                                                                                                                                                                                                                                                            |
| Flooding and guessing                  | Redis sliding-window limiter (`rateLimit()` in `apps/api/src/platform/rate-limit`), attached per route with the limits from the Technical Reference (13.3).                                                                                                                                                                                                   |
| A compromised program reaching too far | Separate database users: the API cannot change the schema or read admin-only tables, the worker cannot run DDL, the job queue cannot see member data, nobody can rewrite the audit log. Tests prove each of these on a real database.                                                                                                                         |
| Data left in the job queue             | Job payloads carry ids only: never secrets, codes or personal data.                                                                                                                                                                                                                                                                                           |
| Stolen sign-in                         | Web: HttpOnly, Secure cookies only. App: tokens in `expo-secure-store` (Keychain / Keystore) only. Never one shared storage helper for both.                                                                                                                                                                                                                  |

Not set up, on purpose, until there is something to protect: a hosted secret manager (local
development keeps the git-ignored `.env.development`; hosted environments use each platform's
own encrypted variables), Turborepo remote cache (off; if enabled later, pull requests must be
read-only), and keyless (OIDC) deploys, which arrive with the first deploy workflow.

### Security habits

- **A leaked secret is a dead secret.** If a key ever reaches GitHub, revoke and replace it at the
  vendor straight away. Deleting the commit is not enough; bots copy public commits within minutes.
- **Three nets catch secrets:** the pre-commit hook on your machine (install `gitleaks` with
  `brew install gitleaks` for the deeper scan), GitHub push protection, and the CI secret scan.
- **Sign your commits** (`git config commit.gpgsign true` with an SSH or GPG key added to GitHub).
  Merges made by GitHub are signed for you; the protected branches refuse anything unsigned.
- **Turn on two-factor sign-in** with a passkey or security key on every account with access.
- **Tokens:** use fine-grained, expiring tokens limited to this repository, never a classic
  all-access token.
- **Outside contributors** work from forks. Their pull requests do not run CI until a maintainer
  approves the run, and CI never has write access or secrets for fork code.

CI (`.github/workflows/ci.yml`) runs on every pull request: secret scan, format, lint, banned
terms, the full schema on PostgreSQL 16 + PostGIS, generated-client check, type-check, tests, builds.

## 9. Deploying (when the first hosted environment is set up)

| Part                | Goes to                     | How                                                                            |
| ------------------- | --------------------------- | ------------------------------------------------------------------------------ |
| API, worker         | Railway                     | `infra/docker/service.Dockerfile` with `infra/railway/*.json`                  |
| Database            | Neon                        | `DATABASE_MIGRATION_URL=<direct url> pnpm db:migrate` as a gated release step  |
| Admin, web, website | Cloudflare Pages            | Build command `pnpm --filter @1minitman/<app> build`, output `apps/<app>/dist` |
| Member app          | EAS Build / Submit / Update | `eas build`, `eas submit`, `eas update`                                        |

Staging and production never share a database, Redis, bucket or key.

## 10. When something goes wrong

| Symptom                                        | Fix                                                                             |
| ---------------------------------------------- | ------------------------------------------------------------------------------- |
| "Node … is too old" / "not supported by Astro" | `nvm install && nvm use` in the repo folder, then `pnpm dev`.                   |
| "Docker is not running"                        | Start Docker Desktop, then `pnpm dev` again.                                    |
| A port is already in use                       | A previous `pnpm dev` is still running. `pnpm preflight` names the port.        |
| API says "Invalid environment"                 | Compare `.env.development` with `.env.example`; the message names the variable. |
| `/ready` says the database is down             | `pnpm services:up`, then `pnpm db:migrate`.                                     |
| Database in a strange state                    | `pnpm services:reset` then `pnpm db:migrate` (local data is disposable).        |
| App on a phone can't reach the API             | Use your computer's Wi-Fi address in `EXPO_PUBLIC_API_URL`, same Wi-Fi network. |
| App shows old code                             | In the mobile task press `r`; if still stale, restart with `expo start -c`.     |
| Types wrong after changing a route             | `pnpm contracts:generate`.                                                      |

## 11. Where the product decisions live

The specifications (the "dev-ready pack": Technical Reference, admin and website specs, user flows,
brand guide, decisions log) are kept **outside this repository**, because this repository is public
and they include business plans. Ask the owner for the pack. Two pieces of it live here because the
code needs them: the schema (`packages/db/migrations/0001_baseline_v3_4.sql`) with its data
dictionary, and the design tokens (`packages/tokens/tokens.json`).

When documents disagree, the owner decisions log (OD-01 onwards) wins, newest first.
