# 1MM-ADR-0038 · Supply-chain hardening: guarded installs, pinned actions, secret scanning

|                  |                                                                                                                                                                                                                                                                   |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**       | Accepted                                                                                                                                                                                                                                                          |
| **Date decided** | 23 Nov 2026 (pull requests #5 and #6); 24 Nov 2026 (pull request #7)                                                                                                                                                                                              |
| **Decided by**   | Repository hardening (commits `58732fe`, `3ae6870`, `eb1a417`)                                                                                                                                                                                                    |
| **Sources**      | `pnpm-workspace.yaml`, `.github/workflows/ci.yml`, `.github/dependabot.yml`, `.husky/pre-commit`, `scripts/check-repo-rules.mjs`, `scripts/check-secrets.mjs`, `scripts/check-client-bundles.mjs`, `docs/USAGE.md`, [TR §13.1], [TR §13.4], [TR §17.3], `git log` |
| **Affects**      | The whole repository; CI; every dependency change                                                                                                                                                                                                                 |

## Context

The repository is public, installs several hundred npm packages and runs third-party GitHub
Actions. The Technical Reference asks for "dependency and container scanning" [TR §13.1],
"gitleaks; no cloud keys in clients" and, until v3.5, "Renovate, CodeQL, image scanning"
[TR §13.4] (v3.6 names Dependabot, TRX-061). The
hardening pull requests implemented these and added install-time guards that pnpm 10 provides.

## Decision

1. **Install guards** (`pnpm-workspace.yaml`): build scripts run only for the packages in
   `onlyBuiltDependencies`, and `strictDepBuilds` fails the install for any other; versions
   published less than 3 days ago are never resolved (`minimumReleaseAge: 4320`);
   `trustPolicy: no-downgrade` refuses a version whose publishing trust is weaker than an
   earlier version of the same package.
2. **CI installs exactly what was reviewed:** `pnpm install --frozen-lockfile`, then
   `pnpm audit:deps`, which fails on high or critical advisories.
3. **Actions are pinned to full commit hashes.** `pull_request_target` and
   `permissions: write-all` are banned; every workflow declares top-level `permissions`, and the
   CI token is read-only.
4. **Secrets:** a pre-commit hook (`scripts/check-secrets.mjs --staged`, plus gitleaks when
   installed), GitHub secret scanning with push protection, and a gitleaks scan in CI using the
   free binary, downloaded at a pinned version and verified by SHA-256.
5. **Client bundles:** only `VITE_`, `PUBLIC_` and `EXPO_PUBLIC_` settings can reach a client;
   CI scans the built bundles for server-only names and values.
6. **Updates:** Dependabot proposes npm (weekly) and Actions (monthly) updates against
   `develop`, with a 5-day cool-down. CodeQL results gate both branches.
7. Dependency and build configuration (`package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`,
   `turbo.json`, `scripts/`, `.github/`) is owned in `.github/CODEOWNERS`.

## Alternatives considered

- **The gitleaks marketplace action:** dropped in pull request #5 because it "requires a paid
  licence for organisation repositories"; the free binary is run instead (`git log`).
- **Renovate** [TR §13.4]: the repository uses Dependabot. The sources record no reason.
  **Analysis:** Dependabot is built into GitHub, free on a public repository and supports the
  cool-down used here.
- **Actions pinned by tag:** rejected in pull request #7: "a tag can be moved to malicious code;
  a full commit hash cannot" (`scripts/check-repo-rules.mjs`).

## Consequences

- Easier: a freshly published malicious release, a hijacked maintainer token, a moved action tag
  or a committed key is stopped before it reaches `develop`.
- Harder: a genuine urgent fix published today cannot be installed for 3 days without a reviewed
  exception; a new dependency with a build script fails the install until it is allow-listed;
  pinned hashes need regular Dependabot updates.
- Container image scanning [TR §13.4] is not in the repository yet; it is due with the first
  hosted deployment.

## How it is applied

- CI job `verify` runs, in order: frozen install, audit, secret scan, format, lint, banned
  terms, `pnpm check:repo`, migrations, roles, contract freshness, breaking-change check,
  type-check, tests, build, `pnpm check:client-bundles`.
- Local equivalents: [1MM-STD-10](../standards/1MM-STD-10-COMMITS-AND-LOCAL-CI.md); threat
  model: [1MM-STD-11](../standards/1MM-STD-11-SECURITY-AND-COMPLIANCE.md).

## Revisit when

pnpm changes these settings, the 3-day release age blocks a security fix more than once, or the
project adopts signed build provenance for its own deployables.
