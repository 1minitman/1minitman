# 1MM-ADR-0053 · Spotlight rotates three times a week, with Gold placed first

|                  |                                                                                                        |
| ---------------- | ------------------------------------------------------------------------------------------------------ |
| **Status**       | Accepted                                                                                               |
| **Date decided** | 19 Nov 2026                                                                                            |
| **Decided by**   | Owner decision OD-18 (tracker item T-6)                                                                |
| **Sources**      | [OD-18], [ODT T-6], [UF §12.1 D19], [UF §12.3 D60], [TR §18.3], [ADM App. D AD-32], [SQL]              |
| **Affects**      | apps/api, apps/worker, packages/db, packages/entitlements, apps/mobile (MF6), apps/admin (A24); MOD-07 |

## Context

Spotlight shows verified paid members at local peak hours [SQL `spotlight_rotations`]. The open
question was how many turns a Premium member gets each week [ODT T-6], [ADM App. D AD-32]. The
earlier rule gave Premium one turn and Gold two.

## Decision

1. Spotlight rotates **three times a week** (for example Monday, Wednesday, Friday) [OD-18].
2. In each rotation **every eligible Premium and Gold member gets a turn**; **Gold is placed
   first** [OD-18].
3. Both values are remote config: `spotlight.rotations_per_week = 3` and
   `spotlight.gold_priority = true` [OD-18], [SQL].
4. This replaces "Premium 1 / Gold 2 a week" [OD-18].

## Alternatives considered

- **One turn a week for Premium, two with priority for Gold**: this was the tracker's
  recommendation [ODT T-6]. The owner chose differently; the recorded rationale is fair exposure
  for every paying member while Gold keeps a clear edge [UF §12.3 D60].

## Consequences

- Easier: eligibility is one rule (verified and paid); the tier only affects order.
- Harder: every eligible member in every rotation means rotation size grows with the paid
  population of a city, so the job and the read path must page and must not assume a small set.
- Harder: the entitlement keys `spotlight.turns_per_week` and `spotlight.priority` in
  `packages/entitlements/src/keys.ts` must agree with the two config values; the schema tests
  cover a third turn and refuse a fourth [TR §10].

## How it is applied

- Rotations are built by a worker job and tuned in A24
  ([MOD-07](../execution/1MM-EXE-MOD-07-DISCOVERY-AND-MATCHING.md)); the job's schedule is a
  seeded `worker_jobs.cron` value (ruling R20, [master plan](../execution/1MM-EXE-00-MASTER-PLAN.md) section 7).
- Checks: worker tests that run the rotation twice (gate item G9 in
  [1MM-STD-06 §3](../standards/1MM-STD-06-API-FIRST.md)), change `rotations_per_week` and switch
  `gold_priority` off; an API test that an unverified or Free member is never placed.

## Revisit when

Rotation size in a city makes a full turn for everyone impractical, or the owner changes the
Gold advantage.
