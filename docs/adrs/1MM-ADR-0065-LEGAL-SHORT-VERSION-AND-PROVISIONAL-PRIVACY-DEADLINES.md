# 1MM-ADR-0065 · Legal short version at most 600 characters; privacy deadlines 30 days, provisional

|                  |                                                                                                                   |
| ---------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Status**       | Accepted (the 30-day value is provisional until counsel confirms)                                                 |
| **Date decided** | 21 Nov 2026                                                                                                       |
| **Decided by**   | Owner decisions OD-36 and OD-38 (defaults under the standing instruction)                                         |
| **Sources**      | [OD-36], [OD-38], [OD-10], [DDR W29, B45], [UF §12.3 D73], [ADM App. D AD-18, AD-40], [ODT T-9], [WEB W35], [SQL] |
| **Affects**      | apps/api, apps/admin (A30, A36), apps/site (W35), apps/mobile (LG1–LG3, LG6), apps/worker, packages/db; MOD-16    |

## Context

Two values in the legal and privacy area were inconsistent or missing. The plain-language short
version of a legal document was 600 characters in the website spec and 400 on an admin board
[OD-36]. Privacy requests (access, erasure and the rest) need a due date per kind, which waits on
counsel [ADM App. D AD-18]. The user-flow decisions record them together as D73, and so does this
ADR.

## Decision

1. The short version of a legal document is **at most 600 characters**, enforced by the
   constraint `ck_legal_short`. The admin board aligns to it [OD-36], [SQL].
2. Every `privacy.sla_days.*` value is **30 days, provisional**, until counsel confirms in the
   legal review [OD-38], [SQL].
3. Retention periods for website submissions are also set with counsel; `retention_until` and the
   deletion job are built now [ODT T-9].
4. A member who has not re-accepted a material legal change by its effective date sees a blocking
   re-accept screen on next open; nothing else changes [ADM App. D AD-40].

## Alternatives considered

- **400 characters**, as the admin board showed. Not chosen: the website spec's 600 stands, giving
  one length for the app, website and console [UF §12.3 D73].
- **Wait for counsel before seeding deadlines.** Not chosen: the statutory default is seeded so
  that due dates and timers can be built and tested [OD-38].

## Consequences

- Easier: the privacy queue (A36) and its timers work from day one; changing a deadline is a
  config change per request kind.
- Harder: a provisional value can change after requests exist. Due dates already computed must
  have a stated rule when the config changes. **Recommendation:** store the due date on the
  request at creation and do not recompute it; raise this as a gap in MOD-16 if the sources are
  silent.
- Harder: a length limit on translated text must hold in every locale, not only English.

## How it is applied

- Legal authoring, privacy requests and purge jobs:
  [MOD-16](../execution/1MM-EXE-MOD-16-LEGAL-PRIVACY-AND-DATA-OPERATIONS.md); purge jobs report
  per-rule counts for the A36 retention view (ruling R23, [master plan](../execution/1MM-EXE-00-MASTER-PLAN.md) section 7).
- Published legal documents are immutable, and a new version is a new row [TR §6].
- Checks: a database test for the 600-character limit; API tests that change each
  `privacy.sla_days.*` value; a launch-gate item in
  [MOD-19](../execution/1MM-EXE-MOD-19-HARDENING-AND-LAUNCH.md) that no provisional value remains
  unconfirmed before real users
  ([1MM-ADR-0048](1MM-ADR-0048-STAGED-LEGAL-MINIMUM-AND-INTERIM-DPO.md)).

## Revisit when

Counsel confirms or changes the deadlines and retention periods, or a new market brings a
different statutory period.
