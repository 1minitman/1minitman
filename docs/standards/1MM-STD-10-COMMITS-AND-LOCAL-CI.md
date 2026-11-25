# 1MM-STD-10 · Commit configuration and running CI locally

|              |                                                                                                                                                                                                                                                                                                                                                             |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Document** | 1MM-STD-10                                                                                                                                                                                                                                                                                                                                                  |
| **Status**   | Approved baseline · v1.0 · 24 Nov 2026                                                                                                                                                                                                                                                                                                                      |
| **Audience** | Engineers and coding agents                                                                                                                                                                                                                                                                                                                                 |
| **Owner**    | Engineering lead (code owners)                                                                                                                                                                                                                                                                                                                              |
| **Sources**  | [TR §17.3]; repo: `git log`, `package.json`, `.husky/pre-commit`, `scripts/check-secrets.mjs`, `scripts/preflight.mjs`, `scripts/check-repo-rules.mjs`, `scripts/check-banned-terms.mjs`, `scripts/check-contract-breaking.mjs`, `scripts/check-client-bundles.mjs`, `.github/workflows/ci.yml`, `.github/rulesets/`, `docker-compose.yml`, `docs/USAGE.md` |
| **Related**  | [1MM-STD-08](1MM-STD-08-CONTRIBUTING.md), [1MM-STD-09](1MM-STD-09-FORMATTING.md), [1MM-STD-01](1MM-STD-01-TESTING-STRATEGY.md), [1MM-STD-02](1MM-STD-02-AGENTIC-OPERATIONS.md), [1MM-STD-07](1MM-STD-07-PROGRESS-UPDATES.md), [1MM-STD-11](1MM-STD-11-SECURITY-AND-COMPLIANCE.md), [1MM-DB-02](../database/1MM-DB-02-MIGRATIONS.md)                         |

**What this document is for and when to open it.** It covers the last metre before code leaves
your machine: how a commit is written, sized and signed, what the pre-commit hook does, and how
to run every step of the CI job `verify` locally so that a pull request is green the first time.
Open it when you set up a machine, before your first commit, and whenever a check fails.

## 1. The rule

**Nothing is pushed with a red local check.** CI confirms what you already know; it is not where
you find out.

## 2. Commit messages

### 2.1 What the history uses

Read from `git log` on 24 Nov 2026 (seven commits on `develop`):

```
Tighten repository posture: pinned actions, boundaries, contract checks (#7)
Harden supply chain, database access, client settings and API limits (#6)
Run the free gitleaks binary in CI (#5)
Point repository references at github.com/1minitman/1minitman
Pin Node 24 and fail fast on an unsupported Node version
Add branch rulesets and ignore the CI secret-scan report
Set up the 1minitman monorepo
```

The convention in use is therefore:

| Aspect   | What the history does                                                                 |
| -------- | ------------------------------------------------------------------------------------- |
| Subject  | One line, imperative mood, sentence case, starts with a verb, no full stop            |
| Prefix   | None. No Conventional Commits type (`feat:`, `fix:`) is used                          |
| Suffix   | `(#n)`: the pull-request number, added by GitHub when a pull request is squash-merged |
| Language | Plain British English; says what the commit does to the repository                    |

Nothing enforces a message format: there is no `commit-msg` hook and no CI step for it.

### 2.2 The convention from here on

Keep what the history does, and add the task id. **Recommendation** (not yet enforced; see
GAP-STD10-01):

```
<TASK-ID>: <Imperative subject in sentence case>

<Body: why, and anything a reviewer cannot see in the diff. Wrapped at 100.>

<Trailers>
```

| Part     | Rule                                                                                                                                                                                  |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Task id  | The module task from the module plan: `MOD-07-API-03: Serve the discovery feed`. Work with no module task (tooling, CI, documents) has no prefix, as today: `Pin gitleaks to 8.30.1`. |
| Subject  | Imperative, sentence case, no full stop, 72 characters or fewer including the task id. Says what changes, not what you did ("Add", "Reject", "Serve", not "Added", "Fixes stuff").    |
| Body     | Optional for a small commit. Explains why. Cites the source of a rule (`[TR §8.2]`, an ADR number, a gap id) when the commit implements one.                                          |
| Trailers | `Co-Authored-By:` lines for human co-authors only. Coding agents add no attribution trailer or pull-request footer (`.claude/settings.json` turns it off, 25 Nov 2026).               |
| Never    | Secrets, tokens, personal contact details, member data, private spec content, the retired plan's name, or a message such as "wip", "fix", "updates".                                  |

Because `develop` takes squash merges only, **the pull-request title becomes the commit on
`develop`**. The title follows the same rule, and GitHub appends `(#n)`. Commits inside the
branch still follow it, so the branch is reviewable commit by commit.

A commit that reverts another says so and names it: `Revert "MOD-07-API-03: Serve the discovery
feed"`, with the reason in the body.

## 3. Commit size and scope

1. **One logical change per commit.** It builds, type-checks and passes its tests on its own.
2. **One task per branch** ([1MM-STD-08](1MM-STD-08-CONTRIBUTING.md) §6). A commit never mixes
   two tasks or two layers.
3. **Separate the mechanical from the meaningful.** Generated output (`pnpm contracts:generate`),
   lockfile changes, formatting and renames go in their own commits, so a reviewer can skip them.
4. **A migration is its own commit**, with its roles change and data-dictionary update
   ([1MM-DB-02](../database/1MM-DB-02-MIGRATIONS.md)).
5. **Tests travel with the code they test**, in the same commit.
6. **Records travel with the work:** the progress-log entry, gap rows and ADRs are committed on
   the same branch ([1MM-STD-07](1MM-STD-07-PROGRESS-UPDATES.md) §4).
7. **Do not rewrite shared history.** Rebase and amend freely on your own unpublished branch.
   After review has started, add commits rather than force-pushing, unless the reviewer asks for
   a rebase. Never force-push a branch you did not create. The protected branches refuse force
   pushes.
8. **Commit only what you mean to.** Review `git diff --cached` before every commit. Stage files
   by name, not with `git add -A`.

## 4. Signed commits

### 4.1 What a signed commit is and why it is required

A signed commit carries a cryptographic signature made with a private key that only the
committer holds. GitHub checks the signature against the public keys on the committer's account
and marks the commit "Verified". The name and e-mail on a commit are free text and prove
nothing; the signature proves who made it.

Both rulesets contain the rule `required_signatures` (`.github/rulesets/develop.json`,
`.github/rulesets/production.json`): the protected branches refuse anything unsigned. Merge and
squash commits made by GitHub are signed by GitHub (`docs/USAGE.md` §8). The repository is
public and its history is the record of who changed what, so every commit on a branch is signed,
not only the merge.

### 4.2 Setting up SSH signing (simplest)

Use an SSH key you already have for GitHub, or create one for signing.

```bash
# 1. Create a key if you need one (choose a passphrase).
ssh-keygen -t ed25519 -C "signing key" -f ~/.ssh/id_ed25519_signing

# 2. Tell git to sign with SSH, with that key, on every commit and tag.
git config --global gpg.format ssh
git config --global user.signingkey ~/.ssh/id_ed25519_signing.pub
git config --global commit.gpgsign true
git config --global tag.gpgsign true
```

3. Add the **public** key to GitHub: Settings → SSH and GPG keys → New SSH key → key type
   **Signing Key**. A key added only as an authentication key does not verify signatures.
4. Make sure `git config user.email` is an e-mail address verified on your GitHub account (the
   GitHub-provided no-reply address works and keeps your address out of a public history).
5. Optional, to verify SSH signatures locally:

```bash
echo "$(git config user.email) $(cat ~/.ssh/id_ed25519_signing.pub)" >> ~/.ssh/allowed_signers
git config --global gpg.ssh.allowedSignersFile ~/.ssh/allowed_signers
```

### 4.3 Setting up GPG signing (alternative)

```bash
gpg --full-generate-key                      # choose an ed25519 or RSA 4096 key and a passphrase
gpg --list-secret-keys --keyid-format=long   # note the key id after "sec"
git config --global user.signingkey <KEY-ID>
git config --global commit.gpgsign true
git config --global tag.gpgsign true
gpg --armor --export <KEY-ID>                # paste into GitHub: Settings → SSH and GPG keys → New GPG key
```

The e-mail on the GPG key must match a verified e-mail on your GitHub account.

### 4.4 Checking and fixing

| Task                                         | Command                                                                                                               |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Check the last commit is signed              | `git log --show-signature -1`                                                                                         |
| Check every commit on your branch            | `git log --format='%h %G? %s' origin/develop..HEAD` (`G` good; `N` none; `E` signed but the key is not known locally) |
| Sign the commit you just made                | `git commit --amend --no-edit -S`                                                                                     |
| Sign earlier unsigned commits on your branch | `git rebase --exec 'git commit --amend --no-edit -S' origin/develop` (your own unpublished branch only)               |

Rules:

- A private key never leaves its owner's machine, is never committed and is never shared. Keys
  are protected by a passphrase or a hardware key.
- A coding agent signs with the key of the engineer who runs it, through that engineer's git
  configuration. An agent never creates a key, never adds a key to an account and never turns
  signing off.
- If signing fails, fix the key set-up. Do not commit unsigned and do not use
  `-c commit.gpgsign=false`.

## 5. The pre-commit hook

`pnpm install` runs the `prepare` script, which installs husky. The hook is `.husky/pre-commit`
and runs three things in order on every `git commit`:

| Step | Command                                                                | What it does                                                                                                                                                                                                                    |
| ---- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | `pnpm exec lint-staged`                                                | Runs on staged files only (configured in `package.json`): `eslint --fix --no-warn-ignored` on `*.{ts,tsx,js,mjs,cjs,astro}`; `prettier --write` on `*.{ts,tsx,js,mjs,cjs,json,md,yml,yaml,css}`. Fixes are added to the commit. |
| 2    | `node scripts/check-secrets.mjs --staged`                              | The light secret guard (section 6).                                                                                                                                                                                             |
| 3    | `gitleaks git --staged --redact --no-banner`, if gitleaks is installed | The deeper scan. Skipped silently when gitleaks is not on the machine. CI always runs it.                                                                                                                                       |

What the hook does **not** do: type-check, run tests, check repository rules or banned terms,
build, or touch the database. Those are the local checks of section 8. The hook is a fast net,
not the check.

Rules:

- Never commit with `--no-verify` and never set `HUSKY=0`. If the hook is wrong, fix the hook in
  its own pull request.
- If the hook does not run, hooks are not installed: run `pnpm install` again.
- If lint-staged cannot fix a file, fix it by hand and commit again; the commit was not made.

## 6. The secret scan

Three nets catch secrets before they reach a public repository (`docs/USAGE.md` §8): the
pre-commit hook on your machine, GitHub push protection, and the CI secret scan.

| Net                         | Where                                       | What it catches                                                                                                                                                                                                                                                                                              |
| --------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `scripts/check-secrets.mjs` | Pre-commit (`--staged`); can be run by hand | Any staged `.env` or `.env.*` file other than `.env.example`; and, in added lines: a private-key header, an AWS access key id, a live secret key (`sk_live_` / `rk_live_`), a Flutterwave secret key, a Resend API key, an Expo token assignment. It says of itself that it is a light guard, not a scanner. |
| gitleaks, local             | Pre-commit, when installed                  | The full gitleaks rule set over the staged changes                                                                                                                                                                                                                                                           |
| gitleaks, CI                | `verify`, step "Secret scan"                | gitleaks 8.30.1, downloaded as a binary and checked against a pinned SHA-256, run over the git history: `gitleaks git --redact --no-banner`                                                                                                                                                                  |
| GitHub push protection      | Repository setting                          | Known token formats, at push time                                                                                                                                                                                                                                                                            |

Set-up and use:

```bash
brew install gitleaks                        # macOS; other systems: the gitleaks release binaries
node scripts/check-secrets.mjs --staged      # what the hook runs
node scripts/check-secrets.mjs               # the same patterns over everything changed since HEAD
gitleaks git --redact --no-banner            # what CI runs: the whole history
```

Installing gitleaks is expected on every machine that commits here, so that the local net is the
same as CI's.

If a scan fires:

1. **A real secret, not yet committed:** remove it from the file, keep it in `.env.development`
   (git-ignored) or the platform's secret store, and reference it by variable name.
2. **A real secret, committed or pushed:** treat it as leaked. Revoke and replace it at the vendor
   straight away, then tell a code owner. Removing the commit is not enough.
3. **A false alarm:** do not rewrite the value to slip past the pattern. Ask a code owner; an
   allow-list change is its own reviewed pull request.

## 7. Every CI step and its local command

The CI job is `verify` in `.github/workflows/ci.yml`. It runs on every pull request into `develop`
or `production` and on every push to `develop`, with read-only permissions, on Ubuntu, with a
PostgreSQL 16 + PostGIS container (`postgis/postgis:16-3.4`) and a Redis container
(`redis:7-alpine`): the same images as `docker-compose.yml`.

| #   | CI step                                                                | What it proves                                                                                                                                                | Local command                                                                                             | In `pnpm check`? |
| --- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ---------------- |
| 0   | Services: PostgreSQL 16 + PostGIS, Redis                               | The database-backed steps have something to run against                                                                                                       | `pnpm services:up`                                                                                        | No               |
| 1   | Checkout with full history (`fetch-depth: 0`)                          | The history is there for the secret scan and the contract comparison                                                                                          | `git fetch origin`                                                                                        | No               |
| 2   | Set up pnpm                                                            | The pnpm version from `packageManager` (`pnpm@10.33.0`)                                                                                                       | `corepack enable` (once)                                                                                  | No               |
| 3   | Set up Node from `.nvmrc`                                              | Node 24                                                                                                                                                       | `nvm install && nvm use`                                                                                  | No               |
| 4   | `pnpm install --frozen-lockfile`                                       | The lockfile matches the manifests; install scripts run only for the allow-list                                                                               | `pnpm install --frozen-lockfile`                                                                          | No               |
| 5   | Dependency audit: `pnpm audit:deps`                                    | No high or critical advisory                                                                                                                                  | `pnpm audit:deps`                                                                                         | No               |
| 6   | `cp .env.example .env.development`                                     | CI runs on the example values                                                                                                                                 | Nothing if you have `.env.development`. Do not overwrite your own file; `pnpm dev` creates it if missing. | No               |
| 7   | Secret scan (gitleaks 8.30.1)                                          | No secret anywhere in the history                                                                                                                             | `gitleaks git --redact --no-banner`                                                                       | No               |
| 8   | `pnpm format:check`                                                    | Prettier formatting ([1MM-STD-09](1MM-STD-09-FORMATTING.md))                                                                                                  | `pnpm format:check` (fix: `pnpm format`)                                                                  | Yes              |
| 9   | `pnpm lint`                                                            | ESLint, including the import-boundary rules                                                                                                                   | `pnpm lint`                                                                                               | Yes              |
| 10  | `pnpm check:banned-terms`                                              | The retired plan, its price and the Black Badge described as a subscription appear nowhere outside the skipped paths                                          | `pnpm check:banned-terms`                                                                                 | No               |
| 11  | Workflow and workspace rules: `pnpm check:repo`                        | Actions pinned to commit hashes, no `pull_request_target`, top-level read-only permissions; workspaces private, `exports` declared, `workspace:*`, `catalog:` | `pnpm check:repo`                                                                                         | Yes              |
| 12  | Apply schema: `pnpm db:migrate`                                        | Every migration applies to an empty PostgreSQL 16 + PostGIS                                                                                                   | `pnpm db:migrate` (from empty: `pnpm services:reset` first)                                               | No               |
| 13  | Apply database roles: `pnpm db:roles`                                  | The least-privilege roles and grants apply                                                                                                                    | `pnpm db:roles`                                                                                           | No               |
| 14  | Generated API client is up to date                                     | The OpenAPI documents and typed clients in `packages/contracts` match the routes                                                                              | `pnpm contracts:generate && git diff --exit-code packages/contracts`                                      | No               |
| 15  | No breaking API change (pull requests only)                            | Against the base branch: no removed path, operation, success response or response field, no newly required request field                                      | `node scripts/check-contract-breaking.mjs origin/develop`                                                 | No               |
| 16  | `pnpm typecheck`                                                       | Every workspace type-checks                                                                                                                                   | `pnpm typecheck`                                                                                          | Yes              |
| 17  | `pnpm test`                                                            | Every workspace's tests, including the database tests                                                                                                         | `pnpm test`                                                                                               | Yes              |
| 18  | `pnpm build`                                                           | Every app builds for production                                                                                                                               | `pnpm build`                                                                                              | No               |
| 19  | No server-only settings in client bundles: `pnpm check:client-bundles` | No server-only variable name or value in `apps/admin/dist`, `apps/web/dist`, `apps/site/dist`                                                                 | `pnpm check:client-bundles` (after `pnpm build`)                                                          | No               |

Outside the `verify` job, the rulesets also require CodeQL results and signed commits. CodeQL runs
through GitHub default set-up (there is no workflow file for it) and has no simple local
equivalent; the lint rules and review are the local stand-in. Signatures are
checked with the command in section 4.4.

## 8. Running it locally

### 8.1 `pnpm check`: the quick run

```bash
pnpm check
```

It runs, in order and stopping at the first failure:
`pnpm format:check && pnpm lint && pnpm check:repo && pnpm typecheck && pnpm test`.

| Covers (CI steps)                                              | Does not cover (CI steps)                                                                                                                                                                                                           |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 8 format, 9 lint, 11 repository rules, 16 type-check, 17 tests | 4 frozen install, 5 dependency audit, 7 gitleaks over the history, 10 banned terms, 12 schema applies, 13 roles apply, 14 generated client up to date, 15 breaking API change, 18 builds, 19 client-bundle scan; CodeQL; signatures |

Two things to know:

- **`pnpm test` needs the database.** The tests in `packages/db` connect to PostgreSQL with the
  URLs in `.env.development` and prove the role separation on a real database. Bring the services
  up, migrate and apply roles first (section 8.3). If those URLs are not set at all, the database
  tests are skipped, not failed: a pass without a database proves less than CI does.
- `pnpm check` is the run to use while working. It is **not** the bar for pushing.

### 8.2 The full local run: the bar for pushing

Run this before every push that opens or updates a pull request. It is the `verify` job, step for
step:

```bash
git fetch origin
pnpm install --frozen-lockfile
pnpm audit:deps
gitleaks git --redact --no-banner
pnpm services:up
pnpm db:migrate
pnpm db:roles
pnpm format:check
pnpm lint
pnpm check:banned-terms
pnpm check:repo
pnpm contracts:generate && git diff --exit-code packages/contracts
node scripts/check-contract-breaking.mjs origin/develop
pnpm typecheck
pnpm test
pnpm build
pnpm check:client-bundles
```

Then confirm every commit on the branch is signed (section 4.4).

**Recommendation:** add this sequence as one root script (GAP-STD10-02), so that "the full local
run" is one command and cannot drift from the workflow.

### 8.3 The database-backed steps

The local services are defined in `docker-compose.yml`: PostgreSQL 16 + PostGIS on port 5432
(user, password and database `minitman`) and Redis on port 6379. Docker must be running.

| Command               | What it does                                                                         | When                                                           |
| --------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| `pnpm services:up`    | `docker compose up -d --wait`: starts both services and waits until they are healthy | Before any database-backed step                                |
| `pnpm db:migrate`     | Applies pending migrations from `packages/db/migrations/` in order                   | After `services:up`; after pulling a new migration             |
| `pnpm db:status`      | Lists migrations and whether each is applied                                         | When unsure of the state                                       |
| `pnpm db:roles`       | Applies the least-privilege roles and grants (`packages/db/roles/`)                  | After every `db:migrate` that adds a table; before `pnpm test` |
| `pnpm services:reset` | `docker compose down -v` then up: wipes the local database and Redis                 | To prove the migrations apply from empty, as CI does           |
| `pnpm services:down`  | Stops the services, keeps the data                                                   | When finished                                                  |

To reproduce CI exactly for a migration, start from empty:

```bash
pnpm services:reset && pnpm db:migrate && pnpm db:roles && pnpm test
```

Local data is disposable (`docs/USAGE.md` §10). These commands are for the local services only:
nobody runs a migration against a hosted environment from a laptop; that is a gated release step
[TR §17.3].

`pnpm dev` also starts the services, applies migrations and then runs `pnpm db:roles`
(`scripts/dev.mjs`), but it is a development server, not a check. When you start the services
without `pnpm dev`, run `pnpm db:roles` after `pnpm db:migrate`: it applies the grants and creates
the local login users that the database URLs in `.env.example` connect as. (GAP-STD10-04 recorded
that the start script used to skip this step; it was fixed on 24 Nov 2026.)

### 8.4 `pnpm preflight`

```bash
pnpm preflight
```

It reads only and changes nothing (`scripts/preflight.mjs`). It checks that the machine can run
the project and prints a fix for each failure:

| Check                                   | Fix it prints                                                 |
| --------------------------------------- | ------------------------------------------------------------- |
| Node version                            | `nvm install` in the repo (uses `.nvmrc`), or install Node 24 |
| pnpm 10 or newer                        | `corepack enable && corepack prepare pnpm@10 --activate`      |
| Docker is running                       | Start Docker Desktop                                          |
| `node_modules` installed                | `pnpm install`                                                |
| `.env.development` exists               | `cp .env.example .env.development`                            |
| Ports 4000, 5173, 5174, 4321, 8081 free | Stop whatever holds the port, or a previous `pnpm dev`        |

Run it on a new machine, at the start of a session, and first when anything behaves strangely. A
running `pnpm dev` makes the port checks fail; that is expected.

## 9. When a check fails

First read the message: every script in `scripts/` names the file and the rule. Then:

| Failing step                     | Usual cause                                                                                                     | What to do                                                                                                                                                  |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile` | A manifest changed without the lockfile; a dependency wants an install script; a version is younger than 3 days | Run `pnpm install`, commit the lockfile. For the guards, see [1MM-STD-08](1MM-STD-08-CONTRIBUTING.md) §12; never loosen one to pass.                        |
| `pnpm audit:deps`                | A high or critical advisory                                                                                     | Update the dependency in its own pull request. If no fix exists, tell a code owner; do not lower the audit level.                                           |
| Secret scan                      | A secret-shaped value                                                                                           | Section 6.                                                                                                                                                  |
| `pnpm format:check`              | Unformatted files                                                                                               | `pnpm format`, review the diff, commit.                                                                                                                     |
| `pnpm lint`                      | A lint error, often a forbidden import across layers or packages                                                | Fix the code. An `eslint-disable` needs a reason on the same line and a reviewer's agreement.                                                               |
| `pnpm check:banned-terms`        | A retired product term                                                                                          | Remove it. Plans are Free, Premium, Gold; Black Badge is a one-off verification.                                                                            |
| `pnpm check:repo`                | An unpinned action, a workspace not private, a missing `exports`, a version not on `catalog:`                   | Fix the manifest or workflow as the message says.                                                                                                           |
| `pnpm db:migrate`                | A migration that does not apply, or an applied file edited (checksum)                                           | Fix the new file. Never edit an applied file: add the next numbered one ([1MM-DB-02](../database/1MM-DB-02-MIGRATIONS.md)). Locally: `pnpm services:reset`. |
| `pnpm db:roles`                  | A new table with no decision about grants                                                                       | Add the table-specific grants or revokes in `packages/db/roles/`.                                                                                           |
| Generated client is up to date   | A route or schema changed without regenerating                                                                  | `pnpm contracts:generate`, commit the result in its own commit.                                                                                             |
| No breaking API change           | A removed path, operation, response or field, or a newly required request field                                 | Add instead of changing: keep the old field or route working, or version the route.                                                                         |
| `pnpm typecheck`                 | A type error, or stale generated types                                                                          | `pnpm contracts:generate`; then fix the code. No `any` or `@ts-ignore` to get past it.                                                                      |
| `pnpm test`                      | A failing test, or the database is not up, migrated or granted                                                  | Section 8.3, then fix the code. A test is changed only when the behaviour it describes has changed by decision.                                             |
| `pnpm build`                     | A build-time error, often a missing setting                                                                     | Compare `.env.development` with `.env.example`.                                                                                                             |
| `pnpm check:client-bundles`      | A server-only variable name or value reached a client bundle                                                    | Remove the reference from client code. Only `VITE_`, `PUBLIC_` and `EXPO_PUBLIC_` names may reach a client.                                                 |
| CodeQL                           | A new security alert                                                                                            | Fix the code. Dismissing an alert is a code owner's decision.                                                                                               |
| Signatures                       | An unsigned commit                                                                                              | Section 4.4.                                                                                                                                                |

Rules when a check is red:

1. Fix the cause. Never skip, delete or weaken the check, the test or the rule.
2. Never re-run until it passes. A check that fails sometimes is a defect: record it in the
   progress log and fix it or raise it.
3. If it passes locally and fails in CI, the difference is the environment: CI uses the example
   settings, an empty database and a frozen install. Reproduce with `pnpm services:reset`, a copy
   of `.env.example` and `pnpm install --frozen-lockfile`.
4. If the check itself is wrong, fix the check in its own pull request, reviewed by a code owner.
5. If you cannot make it green, do not push. Record what is red and why in the progress log
   ([1MM-STD-02](1MM-STD-02-AGENTIC-OPERATIONS.md) §15.2) and hand off.

## 10. Gaps raised

Dispositions are recorded in [1MM-LOG-03](../1MM-LOG-03-TECHNICAL-REFERENCE-EXTENSIONS.md)
(Technical Reference and schema), [1MM-LOG-02](../1MM-LOG-02-UI-UPDATES.md) (UI) and
[1MM-LOG-04](../1MM-LOG-04-OPEN-DECISIONS-AND-FOLLOW-UPS.md) (owner decisions and repository
follow-ups).

| Gap id       | Type | Where found                                                                              | What is missing or conflicting                                                                                                                                                                                                                                                                                                    | Proposed resolution                                                                                                                                                                                                                                                                                                                   | Blocks                                                                                                                                             |
| ------------ | ---- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| GAP-STD10-01 | REPO | `git log`, `.husky/`, `.github/workflows/ci.yml`                                         | The commit-message convention is a habit, not a rule: nothing checks it, and nothing ties a commit or a pull-request title to a task id.                                                                                                                                                                                          | **Recommendation:** adopt section 2.2 and enforce it where it matters, on the pull-request title (it becomes the squash commit): a step in `verify` that fails a pull request whose title neither starts with a task id (`MOD-nn-<KIND>-nn: `) nor is marked as non-module work. A dependency-free script in `scripts/` is enough.    | Nothing; section 2.2 applies by review                                                                                                             |
| GAP-STD10-02 | REPO | `package.json` (`check`), `.github/workflows/ci.yml`, `.github/pull_request_template.md` | `pnpm check` runs five of the checks in `verify`. The pull-request template and `docs/USAGE.md` §3 present it as the check to run before a pull request, so a pull request can pass it and fail CI on the audit, secret scan, banned terms, schema, roles, generated client, contract, build or bundle steps.                     | **Recommendation:** add a root script (for example `check:ci`) that runs the sequence in section 8.2, and point the template and `docs/USAGE.md` at it. Keep `pnpm check` as the quick run.                                                                                                                                           | Nothing; section 8.2 lists the commands                                                                                                            |
| GAP-STD10-03 | TR   | [TR §17.3]; `.husky/pre-commit`                                                          | The Technical Reference says the pre-commit hook runs lint, format, type-check and gitleaks. The hook runs lint and format on staged files, the light secret guard, and gitleaks only when it is installed. It does not type-check.                                                                                               | Correct [TR §17.3] to: "pre-commit: lint and format on staged files, secret scan; type-check, tests and the remaining checks run in the local check and in CI." **Recommendation:** keep type-checking out of the hook (it is slow across the monorepo) and make gitleaks a `pnpm preflight` check so the local net is never skipped. | Nothing                                                                                                                                            |
| GAP-STD10-04 | REPO | `scripts/dev.mjs`, `.env.example`, `packages/db/src/cli/roles.ts`                        | `.env.example` says `pnpm dev` creates the local database users, but `scripts/dev.mjs` runs `pnpm db:migrate` only. The login users (`minitman_api` and the others) are created by `pnpm db:roles`. On a new or reset local database the API's `DATABASE_URL` user therefore does not exist until `pnpm db:roles` is run by hand. | Make `scripts/dev.mjs` run `pnpm db:roles` after `pnpm db:migrate` (it is idempotent), or correct the comment in `.env.example` and add the step to `docs/USAGE.md` §2.                                                                                                                                                               | Nothing; section 8.3 and the root README state the step **Fixed 24 Nov 2026:** `scripts/dev.mjs` now runs `pnpm db:roles` after `pnpm db:migrate`. |

## Change log

| Version | Date        | Change            |
| ------- | ----------- | ----------------- |
| v1.0    | 24 Nov 2026 | Approved baseline |
