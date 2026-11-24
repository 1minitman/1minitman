# 1MM-ADR-0074 · Twenty-module execution order and shared-endpoint ownership (rulings R1 to R30)

|                  |                                                                                                                         |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Status**       | Proposed                                                                                                                |
| **Date decided** | 24 Nov 2026 (proposed)                                                                                                  |
| **Decided by**   | Coordinator rulings R1 to R30, made on 24 Nov 2026 while the module plans were written and reviewed; awaiting the owner |
| **Sources**      | `docs/execution/1MM-EXE-00-MASTER-PLAN.md`, the module plans `docs/execution/1MM-EXE-MOD-00` to `-19`, [TR §8.2]        |
| **Affects**      | Every module plan; apps/api module boundaries                                                                           |

## Context

The build is split into twenty modules, MOD-00 Foundations to MOD-19 Hardening and launch, whose
numbers are the execution order. Each screen, admin module and website module has one owner. The
Technical Reference groups endpoints by area [TR §8.2], and several areas are needed by more than
one module, sometimes before their natural owner runs. The module plans were written in parallel,
so overlaps were settled by ruling. The rulings' permanent home is section 7 of the
[master plan](../execution/1MM-EXE-00-MASTER-PLAN.md), which holds their full text; this ADR
summarises them. R25 to R30 settle the six scheduling conflicts the master plan found.

## Decision

The order is the module number. Ownership of shared pieces is:

| #   | Ruling                                                                                                                                                                                                                                                   |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Media upload URL and the `media.process` pipeline are built once in MOD-04; other modules add their kinds and rules                                                                                                                                      |
| R2  | The read-only entitlement resolver and `GET /v1/me/entitlements` are MOD-03; MOD-10 owns purchases and whatever changes entitlements                                                                                                                     |
| R3  | MOD-03 builds base `GET /v1/me`, onboarding writes, location, settings; MOD-04 profile, media, prompts; vibes MOD-06; status and likes filter MOD-07; international settings MOD-10                                                                      |
| R4  | `GET /v1/discovery/count` is MOD-07's; if MOD-04 needs it first, it builds the first version                                                                                                                                                             |
| R5  | `GET /v1/me/account-status` and appeal submission are first built in MOD-05; MOD-09 owns the appeals workflow                                                                                                                                            |
| R6  | Member 360 (A10) has a tab per domain; each later module's exit gate verifies its tab against real data                                                                                                                                                  |
| R7  | An earlier module depends on a later one through a port with a stub adapter; no client work starts against a stub                                                                                                                                        |
| R8  | Blocks and reports are MOD-09's; that API slice is scheduled before the mobile work of MOD-08, MOD-12 and MOD-13                                                                                                                                         |
| R9  | The abuse-rule evaluator is first built in MOD-03 behind a port; MOD-09 owns and completes it                                                                                                                                                            |
| R10 | Before MOD-10 and MOD-11 exist, callers use the seeded entitlement matrix and the notification outbox; both modules re-verify those callers                                                                                                              |
| R11 | MOD-02 owns the catalogue API, the i18n API, `GET /v1/options/{type}` and the config bootstrap; MOD-07 keeps A24 tuning, MOD-11 keeps A25 templates                                                                                                      |
| R12 | MOD-03 builds `GET /v1/me`, the onboarding endpoints, nickname, location, settings, consents and the legal read, and MOD-04 and MOD-16 do not rebuild them; MOD-16 owns legal authoring; first legal texts are seeded as non-production drafts in MOD-03 |
| R13 | The site banner and maintenance switch are edited in A28 (MOD-15); MOD-02 builds the read path and W06                                                                                                                                                   |
| R14 | MOD-06 runs before MOD-10 against a fake payment port; the real-money run of B9 is in MOD-10's exit gate, and B9's screen ships only after MOD-10's API gate                                                                                             |
| R15 | Minimal `GET /v1/matches/{id}` and the match events are MOD-07's; MOD-08 extends them                                                                                                                                                                    |
| R16 | Review-queue claim, release and the stale-claim job are built once in MOD-04 and reused by MOD-06 and MOD-09                                                                                                                                             |
| R17 | Analytics event names are proposed per module; MOD-18 publishes the single catalogue. Statuses and problem types follow 1MM-STD-13                                                                                                                       |
| R18 | Task kinds include `OPS` (provisioning, deploys, alerts)                                                                                                                                                                                                 |
| R19 | Flow row 15.21 (empty and offline states) is split across MOD-00, MOD-07, MOD-08 and MOD-12                                                                                                                                                              |
| R20 | The admin shell is built in two stages around MOD-01's API gate; each module seeds the cron values of its own jobs                                                                                                                                       |
| R21 | MOD-11 delivery slices keep their task ids but are scheduled early: A in MOD-00, B in MOD-03 before its API gate, C after MOD-03's API gate. MOD-10 owns `PUT /v1/me/international` and `POST /v1/me/safety-briefing/ack`                                |
| R22 | Consent receipts are MOD-16's; additive blocks on another module's endpoint are allowed when recorded as a gap in both                                                                                                                                   |
| R23 | Every module registers its tables in MOD-16's erasure and export manifests, and its purge jobs report per-rule counts                                                                                                                                    |
| R24 | The shared public form pipeline and first public upload are built in MOD-14 and reused; MOD-14's website tasks run after MOD-15's API gate and `MOD-15-WEB-01`; MOD-15 builds every A29 view                                                             |
| R25 | `MOD-14-API-05` (the form pipeline of R24) is pulled forward ahead of `MOD-11-API-07`                                                                                                                                                                    |
| R26 | `MOD-11-WEB-01` (W36) runs after MOD-15's website gate, like W32 to W34                                                                                                                                                                                  |
| R27 | MOD-08 ships named slots for Block and Report; `MOD-09-MOB-04` wires them; MOD-09's blocks-and-reports API slice lands before MOD-08's mobile work                                                                                                       |
| R28 | `MOD-18-OPS-01` runs in the early analytics stage                                                                                                                                                                                                        |
| R29 | The stale-claim release job is built once with `MOD-04-API-05`; `MOD-06-WRK-02` and `MOD-09-WRK-01` register their queues with it (GAP-MOD06-08 and GAP-MOD09-04 are the same gap)                                                                       |
| R30 | `MOD-06-MOB-05` (B9, B10, B11) waits for MOD-10's API gate and never runs against the payment fake                                                                                                                                                       |

## Alternatives considered

The sources record no alternatives. **Analysis:** (a) a shared "platform" module owning every
cross-cutting endpoint would grow MOD-00 into a second monolith and break "first module that
needs it builds it"; (b) ordering by the Technical Reference's four phases [TR §17] does not give
a per-screen owner; (c) letting each module build what it needs would produce duplicate endpoints.

## Consequences

- Easier: every shared endpoint has one owner and one first builder; exit gates say who
  re-verifies what.
- Harder: ports and stubs (R7) add interfaces that exist only for ordering; early slices (R8,
  R21, R25, R28) make scheduling finer than "one module at a time".

## How it is applied

- [1MM-EXE-00 Master plan](../execution/1MM-EXE-00-MASTER-PLAN.md) schedules the modules and
  slices; each module plan lists its ports in section 8 and its obligations in section 10.
- The gate rule is [1MM-ADR-0073](1MM-ADR-0073-API-FIRST-EXECUTION-WITH-AN-API-GATE-PER-MODULE.md).
- Check: review of a pull request against the owning module's plan; a second implementation of a
  ruled endpoint is rejected.

## Revisit when

The owner sets delivery phases ([1MM-ADR-0052](1MM-ADR-0052-DELIVERY-PHASES-SET-AFTER-THE-DEMO.md))
that cut across this order, or a ruling proves unworkable in build. A changed ruling is a new ADR.
