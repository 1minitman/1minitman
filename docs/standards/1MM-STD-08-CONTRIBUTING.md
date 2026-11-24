# 1MM-STD-08 · Contributing strategy

|              |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Document** | 1MM-STD-08                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **Status**   | Approved baseline · v1.0 · 24 Nov 2026                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **Audience** | Engineers and coding agents; outside contributors                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| **Owner**    | Engineering lead (code owners)                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **Sources**  | [TR §17.2], [TR §17.3]; repo: `.github/rulesets/develop.json`, `.github/rulesets/production.json`, `.github/CODEOWNERS`, `.github/pull_request_template.md`, `.github/workflows/ci.yml`, `.github/dependabot.yml`, `SECURITY.md`, `pnpm-workspace.yaml`, `scripts/check-repo-rules.mjs`, `docs/USAGE.md` §8                                                                                                                                                                                      |
| **Related**  | [CONTRIBUTING.md](../../CONTRIBUTING.md), [1MM-STD-02](1MM-STD-02-AGENTIC-OPERATIONS.md), [1MM-STD-06](1MM-STD-06-API-FIRST.md), [1MM-STD-07](1MM-STD-07-PROGRESS-UPDATES.md), [1MM-STD-09](1MM-STD-09-FORMATTING.md), [1MM-STD-10](1MM-STD-10-COMMITS-AND-LOCAL-CI.md), [1MM-STD-11](1MM-STD-11-SECURITY-AND-COMPLIANCE.md), [1MM-STD-01](1MM-STD-01-TESTING-STRATEGY.md), [1MM-RES-01](../resources/1MM-RES-01-OPEN-SOURCE-AND-PLATFORMS.md), [1MM-DB-02](../database/1MM-DB-02-MIGRATIONS.md) |

**What this document is for and when to open it.** It states who may change this repository and
how a change gets from a branch to `develop` and from `develop` to `production`: the branch model,
the pull-request flow, review, the required checks, the definition of done and the guardrails that
get a pull request rejected. Open it before your first pull request, when you add a dependency,
and when you review someone else's work.

## 1. Who may contribute

| Contributor          | Access                                                                  | How they contribute                                                                                          |
| -------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Code owners          | Write access; listed in `.github/CODEOWNERS`                            | Review and merge. Their own changes still go by pull request and need another code owner's approval.         |
| Team engineers       | Write access (may push branches, cannot push to the protected branches) | Branch in the repository, pull request into `develop`.                                                       |
| Coding agents        | The access of the engineer who runs them; never their own admin rights  | Same flow as an engineer, under [1MM-STD-02](1MM-STD-02-AGENTIC-OPERATIONS.md). They never approve or merge. |
| Outside contributors | Read (the repository is public)                                         | Fork, pull request from the fork (section 9).                                                                |
| Dependabot           | Opens pull requests into `develop` (`.github/dependabot.yml`)           | Reviewed like any dependency change (section 12).                                                            |

The repository is public: anyone can read both branches. The rules below control who can change
them (`docs/USAGE.md` §8). The product specifications are held outside the repository; a
contribution that needs a fact from them cites it through the documents in `docs/`
([1MM-STD-02](1MM-STD-02-AGENTIC-OPERATIONS.md) §2).

## 2. Access model

- Access is given per person, at the lowest level that lets them work. Admin rights on the
  repository belong to the repository owner only; only an admin can change rulesets
  (`docs/USAGE.md` §8).
- Every account with access uses two-factor sign-in with a passkey or security key, and
  fine-grained, expiring tokens limited to this repository (`docs/USAGE.md` §8).
- Nobody shares an account or a signing key. Agents commit with the signing key of the engineer
  who runs them.
- Access to hosted environments, vendor dashboards and secrets is separate from repository access
  and is not granted by this document ([1MM-STD-11](1MM-STD-11-SECURITY-AND-COMPLIANCE.md)).

## 3. Branch model

There are two long-lived branches and no others.

| Branch       | Role                                 | How it changes                                  | Merge method (ruleset)               |
| ------------ | ------------------------------------ | ----------------------------------------------- | ------------------------------------ |
| `develop`    | Default branch. All work lands here. | Pull request only                               | Squash only; linear history required |
| `production` | What is live                         | Only by an approved pull request from `develop` | Merge commit only                    |

- No `main`, no release branches, no long-lived feature or environment branches.
- A working branch is short-lived: created from `develop`, merged or closed within days, deleted
  after the merge.
- A fix for production is made on `develop` first and released by the normal `develop` →
  `production` pull request. Nothing is committed to `production` that is not on `develop`.

### 3.1 Branch naming

The history so far uses `<kind>/<short-kebab-description>` (`ci/free-secret-scan`,
`security/hardening`, `chore/repo-posture`, `feature/documentations`). The rule from here on:

```
<kind>/<task-id-lower>-<short-kebab-description>
```

| Kind       | Use                                             | Example                                |
| ---------- | ----------------------------------------------- | -------------------------------------- |
| `feature`  | A module task                                   | `feature/mod-07-api-03-discovery-feed` |
| `fix`      | A defect in merged work                         | `fix/mod-03-api-02-otp-lockout-window` |
| `docs`     | Documentation only                              | `docs/std-13-new-problem-type`         |
| `chore`    | Tooling, dependencies, housekeeping             | `chore/bump-hono`                      |
| `ci`       | Workflows and checks                            | `ci/docs-link-check`                   |
| `security` | Security hardening that is not a private report | `security/tighten-cors`                |

Lower-case, hyphens, no personal names. Work with no module task (`chore`, `ci`, `docs`) omits the
task id.

## 4. What the rulesets enforce

The rules are code: `.github/rulesets/develop.json` and `.github/rulesets/production.json`. The
repository owner imports them once (`docs/USAGE.md` §8). They are the authority; this table reads
them.

| Rule (ruleset `type`)                 | `develop`        | `production`     | What it means for you                                                                        |
| ------------------------------------- | ---------------- | ---------------- | -------------------------------------------------------------------------------------------- |
| `deletion`                            | Yes              | Yes              | The branch cannot be deleted.                                                                |
| `non_fast_forward`                    | Yes              | Yes              | No force pushes.                                                                             |
| `required_linear_history`             | Yes              | No               | `develop` has no merge commits.                                                              |
| `pull_request`                        | Yes              | Yes              | No direct pushes; every change is a pull request.                                            |
| · `required_approving_review_count`   | 1                | 1                | One approving review.                                                                        |
| · `require_code_owner_review`         | true             | true             | The approval must come from a code owner.                                                    |
| · `require_last_push_approval`        | true             | true             | The last push must be approved by someone other than the person who pushed it.               |
| · `dismiss_stale_reviews_on_push`     | true             | true             | A new push cancels earlier approvals.                                                        |
| · `required_review_thread_resolution` | true             | true             | Every review conversation is resolved before the merge.                                      |
| · `allowed_merge_methods`             | `squash`         | `merge`          | Squash into `develop`; merge commit into `production`.                                       |
| `required_status_checks`              | `verify`, strict | `verify`, strict | The `verify` job is green, on a branch that is up to date with its base.                     |
| `required_signatures`                 | Yes              | Yes              | Commits are signed ([1MM-STD-10](1MM-STD-10-COMMITS-AND-LOCAL-CI.md) §4).                    |
| `code_scanning` (CodeQL)              | Yes              | Yes              | No new CodeQL security alert of severity high or higher, and no CodeQL alert at error level. |

Changing a ruleset is a pull request to these files, reviewed by a code owner, then re-imported
by the repository owner. Nobody weakens a rule to get a change through.

## 5. The pull-request flow

1. **Pick the task.** One task id from one module plan. Follow the operating loop in
   [1MM-STD-02](1MM-STD-02-AGENTIC-OPERATIONS.md) §5, including the API gate check.
2. **Branch** from an up-to-date `develop`, named as in section 3.1.
3. **Build and test.** Commit in small, signed commits
   ([1MM-STD-10](1MM-STD-10-COMMITS-AND-LOCAL-CI.md)).
4. **Run the local checks** until green ([1MM-STD-10](1MM-STD-10-COMMITS-AND-LOCAL-CI.md) §8).
   Nothing is pushed with a red local check.
5. **Write the records:** the progress-log entry, and where they apply the gap rows, the ADR, the
   module plan's change log and the index (section 11).
6. **Push and open the pull request** into `develop`. Fill the template completely (section 6).
   Open it as a draft if it is not ready for review.
7. **Checks run:** the `verify` job and CodeQL (GitHub default set-up).
8. **Review:** a code owner who is not the author reviews (section 7). Answer every comment;
   resolve conversations only when the point is settled. A new push needs a new approval.
9. **Keep it current:** the branch must be up to date with `develop` before it merges (strict
   status checks). Rebase or update, re-run the checks.
10. **Merge:** a code owner squash-merges. The squash commit's subject is the pull-request title,
    so the title follows the commit convention ([1MM-STD-10](1MM-STD-10-COMMITS-AND-LOCAL-CI.md) §2).
11. **After the merge:** delete the branch. If the merge passed a gate, the status board already
    changed in the same pull request ([1MM-STD-07](1MM-STD-07-PROGRESS-UPDATES.md) §5).

### 5.1 Releasing to `production`

1. A code owner opens a pull request from `develop` into `production`. It lists the pull requests
   it carries.
2. `verify` and CodeQL run against it. Another code owner approves.
3. It is merged as a **merge commit** (never squashed, never rebased), so `production` records
   exactly which `develop` commits are live.
4. Database migrations run as a gated release step, never automatically from a client deploy
   [TR §17.3], ([1MM-DB-02](../database/1MM-DB-02-MIGRATIONS.md)).
5. The release is recorded in [1MM-LOG-01](../1MM-LOG-01-PROGRESS.md).

Agents do not open, approve or merge release pull requests unless a code owner asks for one to be
prepared ([1MM-STD-02](1MM-STD-02-AGENTIC-OPERATIONS.md) §13).

## 6. One task per pull request, and the template

- A pull request carries **one module task**, and its title starts with the task id:
  `MOD-07-API-03: Serve the discovery feed`. Work with no module task (tooling, CI, documents)
  names what it is instead.
- A task that is too large to review in one sitting is split in the module plan first (new task
  ids), not delivered as one large pull request. **Recommendation:** aim for under about 600
  changed lines excluding generated files and lockfiles.
- A pull request does not mix layers. The order API → admin → web → mobile is kept across pull
  requests: a client pull request is opened only after the module's API gate is recorded as
  passed ([1MM-STD-06](1MM-STD-06-API-FIRST.md)).
- Unrelated refactors, formatting sweeps and drive-by fixes go in their own pull request.

The template is `.github/pull_request_template.md`. Today it asks for:

| Section       | Content                                                                                                                                               |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| What and why  | One or two sentences, naming the spec module if there is one                                                                                          |
| Order of work | Tick-boxes: API (route and contract, `pnpm contracts:generate` run), admin console, website, member app, or "not applicable to the unticked surfaces" |
| Checks        | `pnpm check` passes locally; a database change ships as a new numbered migration; no secrets and no real member data                                  |

Until the template is extended (GAP-STD08-01), the author adds these to "What and why" by hand:
the task id; the progress-log entry id; gaps raised or closed; the ADR number if one was written;
for a client task, the entry id that records the API gate; and for a visible change, a screenshot
or recording in both themes.

## 7. Code-owner review

`.github/CODEOWNERS` makes the code owners the default owners of every path, and names the
sensitive areas explicitly so they stay owned if the default line changes:

| Path                                                                      | Why it is named                                                |
| ------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `/.github/`                                                               | Workflows, rulesets, code owners                               |
| `/infra/`                                                                 | Deployment configuration                                       |
| `/packages/db/`                                                           | Schema, migrations, roles                                      |
| `/apps/api/`                                                              | The only program that touches the database                     |
| `/.env.example`                                                           | The list of settings and which are client-visible              |
| `/package.json`, `/pnpm-lock.yaml`, `/pnpm-workspace.yaml`, `/turbo.json` | A changed lockfile or install setting is a supply-chain change |
| `/scripts/`                                                               | The checks themselves                                          |
| `/packages/contracts/`, `/packages/tokens/`                               | The API contract and the design tokens every client consumes   |

What review means here:

1. The reviewer is a code owner and is not the author. An author never approves their own work,
   and an agent's work is reviewed by a human code owner.
2. The reviewer reads the diff, not only the description, and checks it against the task's
   definition of done in the module plan and against section 10.
3. Changes to authentication, payments or the admin surface get a security review before
   approval [TR §17.3], ([1MM-STD-11](1MM-STD-11-SECURITY-AND-COMPLIANCE.md)).
4. The reviewer checks the records: progress-log entry, gaps, ADR, index
   ([1MM-STD-07](1MM-STD-07-PROGRESS-UPDATES.md) §7).
5. Approval is given on the final push. A push after approval dismisses it.
6. Review comments are answered in the thread. The person who opened a thread, or the reviewer,
   resolves it.

A code owner must have write access for the rule to count (`.github/CODEOWNERS`). The file names
one code owner by GitHub handle and one by e-mail address. The e-mail entry is there at the
owner's explicit request and is the one standing exception to the rule that personal e-mail
addresses stay out of the repository; it is not copied into any other file.

## 8. Required checks

| Check      | Where it is defined                                                                                                             | What it covers                                                                                                                                                                                                                               |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `verify`   | `.github/workflows/ci.yml`                                                                                                      | Frozen install, dependency audit, secret scan, format, lint, banned terms, repository rules, schema and roles on PostgreSQL 16 + PostGIS, generated client up to date, no breaking API change, type-check, tests, builds, client-bundle scan |
| CodeQL     | The `code_scanning` rule in both rulesets; the analysis runs through GitHub CodeQL default set-up, so there is no workflow file | Static security analysis; blocks on high-severity security alerts and on errors                                                                                                                                                              |
| Signatures | The `required_signatures` rule                                                                                                  | Every commit is signed                                                                                                                                                                                                                       |
| Review     | The `pull_request` rule                                                                                                         | Section 7                                                                                                                                                                                                                                    |

The step-by-step content of `verify`, and the local command for each step, is in
[1MM-STD-10](1MM-STD-10-COMMITS-AND-LOCAL-CI.md) §7. The workflow has read-only permissions and
`pull_request_target` is banned (`scripts/check-repo-rules.mjs`). The checks the Technical
Reference also lists (browser, device, accessibility, bundle-budget and query-plan checks
[TR §17.3]) are added by [MOD-00](../execution/1MM-EXE-MOD-00-FOUNDATIONS.md) and become required
when they exist.

A red check is fixed, never bypassed, skipped, retried until it passes by luck, or removed.

## 9. Fork pull requests

- Outside contributors work from a fork and open a pull request into `develop`.
- CI does not run on a fork's pull request until a maintainer approves the run, and CI never has
  write access or secrets for fork code (`docs/USAGE.md` §8). A maintainer reads the diff,
  including any change under `.github/`, `scripts/`, `package.json` or the lockfile, before
  approving the run.
- The same rules apply: one focused change, signed commits, the template, green checks,
  code-owner review.
- A fork pull request does not change `.github/`, `infra/`, the rulesets, the lockfile or the
  supply-chain settings unless a code owner asked for it in an issue first.
- A contribution must be the contributor's own work and must not contain third-party code or
  assets whose licence does not allow it. The repository has no licence file yet
  (GAP-STD05-01 in [1MM-STD-05](1MM-STD-05-README-STANDARD.md)); until the owner decides, a code
  owner agrees the terms with an outside contributor before merging.
- Feature work follows the module plans. An outside pull request that adds a feature outside the
  plan is closed with a pointer to this document.

## 10. Definition of done

A task is done when all of these are true. The first six are the Technical Reference's definition
[TR §17.3]; the rest are how this repository proves them.

| #   | Item                                                                                                                | Proof                                                                                                                                      |
| --- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Tests [TR §17.3]                                                                                                    | The tests the module plan §9 names exist and pass: expected, unexpected, variables changing ([1MM-STD-01](1MM-STD-01-TESTING-STRATEGY.md)) |
| 2   | Accessibility check [TR §17.3]                                                                                      | For every UI change, per [1MM-STD-01](1MM-STD-01-TESTING-STRATEGY.md) and [1MM-STD-20](1MM-STD-20-DESIGN-SYSTEM.md)                        |
| 3   | Haptic and sensory tags implemented [TR §17.3]                                                                      | For mobile screens, as the module plan §7 lists them                                                                                       |
| 4   | Analytics events [TR §17.3]                                                                                         | The events the module plan lists are emitted                                                                                               |
| 5   | Security review for auth, payments and admin changes [TR §17.3]                                                     | Recorded in the pull request by the reviewing code owner                                                                                   |
| 6   | Docs [TR §17.3]                                                                                                     | Section 11                                                                                                                                 |
| 7   | The task's own definition of done in the module plan §8 is met                                                      | Stated in the pull request                                                                                                                 |
| 8   | The order was kept: the API exists in `packages/contracts` before any client uses it; the API gate precedes clients | Progress log                                                                                                                               |
| 9   | Nothing a person reads and no rule that can change is hard-coded; it is served by the API and editable in the admin | Module plan §3.4                                                                                                                           |
| 10  | `verify` and CodeQL are green; every commit is signed                                                               | The pull request's checks                                                                                                                  |
| 11  | A code owner approved the final push and every conversation is resolved                                             | The pull request                                                                                                                           |
| 12  | Nothing is orphaned ([1MM-STD-02](1MM-STD-02-AGENTIC-OPERATIONS.md) §12)                                            | Reviewer's check                                                                                                                           |

## 11. Documentation duties

Every pull request carries its own records. A pull request that changes behaviour and no
document is incomplete.

| If the pull request…                    | It also…                                                                                                              |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Does any module work                    | Adds a progress-log entry ([1MM-STD-07](1MM-STD-07-PROGRESS-UPDATES.md))                                              |
| Passes a gate                           | Adds a gate entry and changes the status board                                                                        |
| Needs something no source has           | Adds a gap row; waits for the extension ([1MM-STD-02](1MM-STD-02-AGENTIC-OPERATIONS.md) §7, §8)                       |
| Settles an engineering choice           | Adds an ADR and its index row ([1MM-STD-02](1MM-STD-02-AGENTIC-OPERATIONS.md) §6)                                     |
| Changes scope, order or a task          | Updates the module plan and its change log                                                                            |
| Changes a visible design                | Has a row in [1MM-LOG-02](../1MM-LOG-02-UI-UPDATES.md)                                                                |
| Adds or changes a migration             | Updates `packages/db/SCHEMA_DATA_DICTIONARY.md` and follows [1MM-DB-02](../database/1MM-DB-02-MIGRATIONS.md)          |
| Adds a setting                          | Adds it to `.env.example` with what it is for and where to get it; never a value that is a secret                     |
| Adds a root script, an app or a package | Updates the READMEs ([1MM-STD-05](1MM-STD-05-README-STANDARD.md)), `docs/USAGE.md` and `AGENTS.md` where they list it |
| Adds, renames or removes a document     | Updates [1MM-INDEX](../1MM-INDEX.md) and every link to it                                                             |
| Changes a rule in a standard            | Adds a change-log row to that standard                                                                                |

## 12. Adding a dependency

A new dependency is a supply-chain change. `package.json`, `pnpm-lock.yaml` and
`pnpm-workspace.yaml` are code-owned for that reason.

Guards already in the repository:

| Guard                                                | Where                                      | Effect                                                                                                                                                                                                |
| ---------------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `catalog:`                                           | `pnpm-workspace.yaml`                      | One version of every shared dependency, declared once; workspaces reference it with `catalog:`                                                                                                        |
| `onlyBuiltDependencies` with `strictDepBuilds: true` | `pnpm-workspace.yaml`                      | Install scripts run only for the allow-listed packages; an install fails if any other package wants to run one                                                                                        |
| `minimumReleaseAge: 4320`                            | `pnpm-workspace.yaml`                      | A version published less than 3 days ago is never resolved                                                                                                                                            |
| `trustPolicy: no-downgrade`                          | `pnpm-workspace.yaml`                      | A version whose publishing trust is weaker than an earlier version of the same package is refused                                                                                                     |
| Frozen lockfile                                      | `verify`: `pnpm install --frozen-lockfile` | CI installs exactly what was reviewed                                                                                                                                                                 |
| Audit                                                | `verify`: `pnpm audit:deps`                | Fails on high and critical advisories                                                                                                                                                                 |
| Workspace rules                                      | `pnpm check:repo`                          | Every workspace is `private`; packages declare `exports`; internal references are `workspace:*`; apps are never imported; `react`, `react-dom`, `react-native`, `typescript` and `zod` use `catalog:` |
| Dependabot cool-down                                 | `.github/dependabot.yml`                   | Updates are proposed 5 days after release, weekly for npm (minor and patch grouped), monthly for GitHub Actions                                                                                       |
| Pinned actions                                       | `pnpm check:repo`                          | Every GitHub Action is pinned to a full commit hash                                                                                                                                                   |

Procedure:

1. **Ask whether it is needed.** Prefer the platform, the standard library, or a dependency
   already in the workspace. Check [1MM-RES-01](../resources/1MM-RES-01-OPEN-SOURCE-AND-PLATFORMS.md)
   for the approved choice for that need.
2. **Check it:** licence compatible with a commercial product, maintained, no open high or
   critical advisory, reasonable size for a client bundle, no install script unless unavoidable.
3. **Record why.** A runtime dependency, a vendor SDK, a framework or a build tool needs an ADR
   ([1MM-STD-02](1MM-STD-02-AGENTIC-OPERATIONS.md) §6.1). A small development-only utility needs
   one sentence in the pull request.
4. **Add it in the workspace that uses it**, never at the root for convenience. If more than one
   workspace uses it, add it to `catalog:` and reference it with `catalog:`.
5. **Do not widen the guards.** Adding a package to `onlyBuiltDependencies`, lowering
   `minimumReleaseAge` or changing `trustPolicy` is its own decision, stated in the pull request
   and approved by a code owner. Never override the age guard to get a release sooner.
6. **Commit the lockfile** from a clean `pnpm install`. Never hand-edit it.
7. **Keep the dependency pull request separate** from feature work when it can be.
8. A dependency for `apps/mobile` matches the version the Expo SDK expects; React Native stays
   pinned in the catalogue.

## 13. Security reports

Security problems are never reported in a public issue or pull request. `SECURITY.md` gives the
route: e-mail the security role mailbox named there with what was found and how to reproduce it;
the team replies within 3 working days; testers do not access, change or keep other people's data.

For contributors:

- A fix for a reported vulnerability is prepared privately and merged by a code owner; the pull
  request does not describe the exploit before the fix is live.
- A leaked secret is revoked and replaced at the vendor straight away. Deleting the commit is not
  enough (`docs/USAGE.md` §8).
- Three nets catch secrets: the pre-commit hook, GitHub push protection and the CI secret scan
  ([1MM-STD-10](1MM-STD-10-COMMITS-AND-LOCAL-CI.md) §6).

## 14. What gets a pull request rejected

A reviewer closes or sends back a pull request, without further review, for any of these:

1. No task id for module work, more than one task, or mixed layers.
2. Client code for a module whose API gate is not recorded as passed; a client calling an
   endpoint that is not in `packages/contracts`; a stub or mock in place of an API.
3. An invented fact: an endpoint, table, column, permission, config key or screen id with no
   source and no extension.
4. Hard-coded copy, limits, option lists or rules that the admin should manage.
5. A secret, an `.env` file other than `.env.example`, real member data, a personal e-mail
   address or phone number, or content from the private spec pack.
6. Investor, revenue, competitor, persona-research or budget content.
7. Unsigned commits, a commit made with `--no-verify`, or a red check.
8. A check, a test or a lint rule weakened, skipped or deleted to get green.
9. A change to `.github/rulesets/`, `.github/workflows/`, `.github/CODEOWNERS` or the
   supply-chain settings that loosens a guard without a stated, approved reason.
10. An applied migration edited; a schema change with no migration; generated files edited by
    hand; a breaking change to the API contract.
11. A new dependency with no reason, or one that fails section 12.
12. Missing records: no progress-log entry, a gap worked around instead of raised, a decision
    with no ADR, a new document not in the index.
13. Banned product terms: the retired fifth plan, or the Black Badge described as a subscription.
14. Another contributor's unmerged work overwritten or reverted
    ([1MM-STD-02](1MM-STD-02-AGENTIC-OPERATIONS.md) §11).
15. A template left unfilled, or a description that does not match the diff.

## 15. Gaps raised

Dispositions are recorded in [1MM-LOG-03](../1MM-LOG-03-TECHNICAL-REFERENCE-EXTENSIONS.md)
(Technical Reference and schema), [1MM-LOG-02](../1MM-LOG-02-UI-UPDATES.md) (UI) and
[1MM-LOG-04](../1MM-LOG-04-OPEN-DECISIONS-AND-FOLLOW-UPS.md) (owner decisions and repository
follow-ups).

| Gap id       | Type | Where found                                     | What is missing or conflicting                                                                                                                                                                                                                                                                        | Proposed resolution                                                                                                                                                                                                                                                                                                                                                                            | Blocks                                     |
| ------------ | ---- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| GAP-STD08-01 | REPO | `.github/pull_request_template.md`              | The template has no field for the task id, the progress-log entry, gaps, ADRs, the API-gate evidence for client work, the definition-of-done items of [TR §17.3] (accessibility, sensory tags, analytics events, security review) or screenshots. It lists `pnpm check` only, which is not all of CI. | Extend the template with: "Task id"; "Records" tick-boxes (progress-log entry id, gaps raised or closed, ADR, module plan change log, index); "API gate entry id (client tasks)"; "Definition of done" tick-boxes for the six [TR §17.3] items; "Screenshots (both themes)"; and replace the `pnpm check` line with the full local run of [1MM-STD-10](1MM-STD-10-COMMITS-AND-LOCAL-CI.md) §8. | Nothing; section 6 states the interim rule |
| GAP-STD08-02 | REPO | `.github/CODEOWNERS`                            | Each line names one GitHub handle and one owner by a personal e-mail address. The repository is public, and the project's own rule keeps personal e-mail addresses out of it. An e-mail entry also only counts if it belongs to a GitHub account with write access.                                   | Checked: no change needed. The code owner is named by e-mail address at the owner's explicit request (CHK-02 in [1MM-LOG-04](../1MM-LOG-04-OPEN-DECISIONS-AND-FOLLOW-UPS.md)); an e-mail entry counts as a code owner only if it belongs to a GitHub account with write access.                                                                                                                | Nothing                                    |
| GAP-STD08-03 | REPO | `.github/rulesets/*.json`, `.github/workflows/` | Both rulesets require CodeQL results (`code_scanning`), but the repository has no CodeQL workflow file, and `docs/USAGE.md` §8 does not list switching on CodeQL default setup among the settings to enable. If CodeQL is not producing results, the rule cannot be evaluated as intended.            | Checked: no change needed. CodeQL runs through GitHub default set-up on this repository, so no workflow file is needed and the CodeQL requirement of both rulesets is satisfied (CHK-01 in [1MM-LOG-04](../1MM-LOG-04-OPEN-DECISIONS-AND-FOLLOW-UPS.md)). Listing the set-up step in `docs/USAGE.md` §8 is follow-up REP-059 in the same log.                                                  | Nothing                                    |
| GAP-STD08-04 | TR   | [TR §17.2], [TR §17.3]                          | The Technical Reference says "trunk-based development" and, in the phase 0 exit check, "staging deploys from main". The repository has no `main`: it has `develop` (default, staging on merge) and `production`.                                                                                      | Correct [TR §17.2] and [TR §17.3] to name the two branches: `develop` is the trunk and deploys to staging on merge; `production` changes only by an approved merge commit from `develop`.                                                                                                                                                                                                      | Nothing                                    |
| GAP-STD08-05 | REPO | Remote branches (`git branch -a`)               | A merged working branch (`ci/free-secret-scan`) still exists on the remote, which the two-branch model does not allow to linger.                                                                                                                                                                      | Delete it, and switch on "Automatically delete head branches" in the repository settings.                                                                                                                                                                                                                                                                                                      | Nothing                                    |

The missing licence file, which affects outside contributions (section 9), is raised as
GAP-STD05-01 in [1MM-STD-05](1MM-STD-05-README-STANDARD.md).

## Change log

| Version | Date        | Change            |
| ------- | ----------- | ----------------- |
| v1.0    | 24 Nov 2026 | Approved baseline |
