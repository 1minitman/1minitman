# 1MM-ADR-0001 · One monorepo on pnpm workspaces and Turborepo, with Bun as the server runtime

|                  |                                                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Status**       | Accepted                                                                                                           |
| **Date decided** | 23 Nov 2026                                                                                                        |
| **Decided by**   | Repository set-up (commit `d06b662`); layout from the Technical Reference §4.5                                     |
| **Sources**      | [TR §3], [TR §4.5], `pnpm-workspace.yaml`, `turbo.json`, `package.json`, `scripts/check-repo-rules.mjs`, `git log` |
| **Affects**      | Every app and package; MOD-00                                                                                      |

## Context

The Technical Reference puts the whole product in one repository: six apps (`apps/mobile`,
`apps/web`, `apps/site`, `apps/admin`, `apps/api`, `apps/worker`) and shared packages, so that one
contract and one set of tokens serve every client [TR §4.5]. It names the tooling as "Bun
workspaces + Turborepo" [TR §3]. The repository as merged uses **pnpm 10 workspaces** with
Turborepo, and installs Bun as a dependency to run the API and the worker. This ADR records that
difference so nobody "fixes" it back.

## Decision

1. One monorepo. Apps live in `apps/*`, shared code in `packages/*`.
2. **pnpm 10** (`packageManager: pnpm@10.33.0`) is the package manager and workspace tool. Node 24
   (`.nvmrc`) runs the tooling.
3. **Turborepo** orders and caches `build`, `typecheck`, `test`, `openapi:emit` and `generate`.
   Remote caching is off.
4. **Bun** is the runtime of `apps/api` and `apps/worker` only. It is pinned in the pnpm catalogue
   and installed by `pnpm install`.
5. Shared dependency versions are declared once in the pnpm `catalog:`; internal packages are
   referenced as `workspace:*`; every workspace is `private`.

## Alternatives considered

- **Bun workspaces** [TR §3, §4.5]: the documented baseline. The sources record no written reason
  for the change. **Analysis** (from the merged configuration): the repository relies on pnpm
  features that the set-up commits use directly: `nodeLinker: hoisted` for Expo and React Native,
  the `catalog:` for one version of React, React Native, TypeScript and zod, and the supply-chain
  guards `onlyBuiltDependencies`, `strictDepBuilds`, `minimumReleaseAge` and `trustPolicy`
  ([1MM-ADR-0038](1MM-ADR-0038-SUPPLY-CHAIN-HARDENING.md)).
- **Separate repositories per app:** the sources record no such option. **Analysis:** it would
  break the single contract and shared tokens the Technical Reference asks for.

## Consequences

- Easier: one install, one lockfile, one CI job; a contract change and its clients land in one
  pull request.
- Harder: two JavaScript runtimes (Node for tooling and builds, Bun for the servers); code in
  shared packages must run on both.
- The Technical Reference text ("Bun workspaces") was stale on this point; it is corrected in
  v3.6 through the extensions log (TRX-007).

## How it is applied

- `pnpm-workspace.yaml`, `turbo.json`, root `package.json` scripts (`pnpm dev`, `pnpm check`).
- `pnpm check:repo` (`scripts/check-repo-rules.mjs`) fails CI when a workspace is not private, a
  package has no `exports`, an internal dependency is not `workspace:*`, or a lockstep dependency
  does not use `catalog:`.
- `eslint.config.mjs` bans importing an app, importing another workspace by path, and reaching
  into a package's `src`.
- Work plan: [MOD-00 Foundations](../execution/1MM-EXE-MOD-00-FOUNDATIONS.md).

## Revisit when

Bun's workspace tooling offers the same install-time guards and a layout Expo supports, and the
two-runtime cost becomes a real problem; or Turborepo caching no longer fits the CI budget.
