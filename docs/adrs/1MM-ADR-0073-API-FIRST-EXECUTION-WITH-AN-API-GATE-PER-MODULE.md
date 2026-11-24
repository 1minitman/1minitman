# 1MM-ADR-0073 · API-first execution with an API gate per module

|                  |                                                                                                                                            |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Status**       | Proposed                                                                                                                                   |
| **Date decided** | 24 Nov 2026 (proposed)                                                                                                                     |
| **Decided by**   | The owner's build rules give the principle; the gate and its checklist are an engineering recommendation in 1MM-STD-06, awaiting the owner |
| **Sources**      | `docs/standards/1MM-STD-06-API-FIRST.md`, `AGENTS.md`, [TR §8.1], [TR §17.3]                                                               |
| **Affects**      | Every module (MOD-00 to MOD-19), every app and package                                                                                     |

## Context

The owner's rules for the build are binding: every part is built with its API in place and fully
supplied first; the order inside every module is API, then admin, then web, then mobile; every
module starts with the data; every element a person reads or meets is served by the API and
managed in the admin console ([1MM-STD-06 §1](../standards/1MM-STD-06-API-FIRST.md)). The rules
state the principle. They do not say how "the API is in place" is proven, and the Technical
Reference states the contract tooling but not the build order or a gate (GAP-STD06-05).

## Decision

1. Every feature follows the eleven-step sequence in
   [1MM-STD-06 §2](../standards/1MM-STD-06-API-FIRST.md): data review, schema, contract, OpenAPI,
   handler and tests, supply, generated client, **API gate**, admin, web, mobile.
2. **The API gate:** no task of kind `ADM`, `WEB` or `MOB` in a module starts until that module's
   gate is green. The gate is the fourteen-item checklist G1 to G14 (section 3 of the standard),
   ticked in the pull request that closes the module's last `API`, `WRK` or `DB` task, and
   recorded as a line in `docs/1MM-LOG-01-PROGRESS.md`.
3. **"Fully supplied"** is part of the gate (G8): schema, grants, seeds, config keys, flags,
   rate-limit policies, i18n keys, permissions, entitlements, error codes, templates, jobs,
   assets, fixtures and route documentation (section 4 of the standard).
4. A dependency on a later module is a port with a named stub adapter. A stub lets an earlier
   **API** proceed; it never lets a **client** proceed (ruling R7, [master plan](../execution/1MM-EXE-00-MASTER-PLAN.md) section 7).
5. No screen is built on mock data, a local JSON file or a fake server (section 6 of the
   standard). A component test that fakes the network at the client boundary is a test, not a
   mock-only screen.

## Alternatives considered

The sources record no alternatives; the principle is an owner rule. **Analysis** of how to
enforce it:

- **Parallel client and API work against an agreed contract with mocks.** Faster on paper, but it
  is exactly what the owner's rule forbids, and it hides contract mistakes until integration.
- **A gate per endpoint.** Finer, but most screens need several endpoints plus seeds and config;
  the module (or a named slice) is the smallest unit a client can really start on.
- **No formal gate, reviewer judgement only.** Not checkable by an agent or a second reviewer.

## Consequences

- Easier: a client task never waits on a backend; contract mistakes surface in API tests.
- Harder: client work cannot start early to "save time"; idle client capacity moves to another
  module's API or to tests.
- Harder: where a small piece is needed early, it must be scheduled as a slice with its own gate
  (rulings R8, R21), which makes the master plan more detailed.

## How it is applied

- Each module plan states its API gate in section 8 and its exit gate in section 10; the order
  across modules is [1MM-ADR-0074](1MM-ADR-0074-MODULE-EXECUTION-ORDER-AND-SHARED-ENDPOINT-RULINGS.md).
- Tooling: `pnpm contracts:generate` must leave no diff; `scripts/check-contract-breaking.mjs`
  and `pnpm check` run in the CI job `verify` (gate items G10, G11). Contract-first REST is
  [1MM-ADR-0003](1MM-ADR-0003-HONO-ON-BUN-CONTRACT-FIRST-REST.md).
- Known holes in enforcement are recorded as GAP-STD06-01 to GAP-STD06-03 (lint for direct
  `fetch`, the breaking-change script's coverage, a test script for `packages/contracts`).

## Revisit when

The owner confirms or changes the gate, or the first two modules show a gate item that cannot be
evidenced as written.
