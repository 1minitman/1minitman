# 1MM-ADR-0078 · Over-the-air update policy: `appVersion` runtime, one-way channels, staged rollout

|                  |                                                                                                                                                                  |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**       | Proposed                                                                                                                                                         |
| **Date decided** | 24 Nov 2026 (proposed)                                                                                                                                           |
| **Decided by**   | Engineering recommendation in 1MM-STD-19; code signing decided by the owner (DEC-007, 26 Nov 2026: signed from the first public build)                           |
| **Sources**      | `docs/standards/1MM-STD-19-OTA-UPDATES.md`, `apps/mobile/app.config.ts`, `apps/mobile/eas.json`, [TR §5.1], [TR §17.3], [ADM A31], [OD-06], [SQL `app_versions`] |
| **Affects**      | apps/mobile, CI workflows, apps/admin (A31); MOD-00, MOD-02, every mobile release                                                                                |

## Context

The Technical Reference asks for "EAS Update with a runtime-version pin" and staged rollouts
[TR §5.1], [TR §17.3], without naming the channels or what may ship over the air (the `appVersion` policy was
added in v3.6, TRX-018).
Two mechanisms keep members on working code: an update changes the JavaScript inside an
installed build; the OB1 version gate, managed by admins in A31 through `app_versions`, decides
whether a build may run at all. The scaffold has the runtime policy set but `expo-updates` is not
installed and no workflow publishes updates (GAP-STD19-01, GAP-STD19-02).

## Decision

1. **Runtime version policy `appVersion`.** The runtime version is the `version` in
   `app.config.ts`, so it reads the same as `app_versions.min_supported` and `latest`. Any change
   to the native layer must raise `version` in the same pull request; a CI fingerprint guard
   fails the pull request when it does not.
2. **Channels map one-to-one and one way:** `development`, `preview` (git branch `develop`,
   staging) and `production` (git branch `production`). An update reaches `production` only from
   the `production` branch, and the same commit has already run on `preview`.
3. **What ships over the air:** screen code, styles, pure TypeScript workspace packages and
   JavaScript-imported assets. Anything that changes the native project, the update
   configuration or purchases ships as a store build. Limits, labels and option lists need no
   update at all: they come from the API.
4. **Staged rollout** 10%, then 50%, then 100%, with holds; roll back first, diagnose second.
5. **Update first, gate second:** a JavaScript defect is fixed by an update; `min_supported` is
   raised only for native faults, security fixes that need native changes, a contract about to
   drop something old builds use, or retiring a runtime version.
6. **Code signing of updates** is recommended before the first public store build; until it is
   on, the compensating controls in section 7 of the standard are an accepted risk.

Full rules: [1MM-STD-19](../standards/1MM-STD-19-OTA-UPDATES.md).

## Alternatives considered

**Analysis** (the sources give none beyond "runtime-version pin"):

- **The `fingerprint` runtime policy.** It would catch native changes automatically, but its
  opaque strings no longer match what an admin types into `app_versions`. Kept in reserve "if the
  guard proves leaky" (section 2 of the standard).
- **No over-the-air updates, store builds only.** Simplest and fully reviewed by the stores, but
  a fix would take days to reach members on slow connections who update rarely.
- **Publishing straight to all members.** Rejected: staged rollouts are required by the
  Technical Reference.

## Consequences

- Easier: one readable version number across the build, the update and the admin gate; fixes
  reach members in hours.
- Harder: the "raise `version` on native change" rule depends on a guard that does not exist yet.
- Harder: an update cannot be forced by the app itself; a member who never reopens the app keeps
  a bad update, and OB1 is the backstop.
- Cost: update code signing needs a paid Expo plan, which conflicts with the free-tier-first
  hosting decision [OD-06]: an owner decision (GAP-STD19-04).

## How it is applied

- Configuration lands in MOD-00's mobile task (section 12 of the standard); the OB1 gate is
  [MOD-02](../execution/1MM-EXE-MOD-02-PLATFORM-CONFIG-AND-CATALOGUES.md); branches follow
  [1MM-ADR-0037](1MM-ADR-0037-TWO-BRANCH-MODEL.md).
- Contracts may grow but not shrink while a supported build uses them
  ([1MM-STD-06 §7](../standards/1MM-STD-06-API-FIRST.md)).
- Checks: the release checklists in section 10 of the standard; every rollback is entered in
  [the progress log](../1MM-LOG-01-PROGRESS.md).

## Revisit when

The owner decides GAP-STD19-04, the fingerprint guard misses a native change, or the server
learns which update a device runs (GAP-STD19-03) and can gate on it.
