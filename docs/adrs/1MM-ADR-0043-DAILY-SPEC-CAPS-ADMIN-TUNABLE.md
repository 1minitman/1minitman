# 1MM-ADR-0043 · Daily spec caps of 25 and 50 for Free, none for paid plans, admin-tunable

|                  |                                                                                                        |
| ---------------- | ------------------------------------------------------------------------------------------------------ |
| **Status**       | Accepted                                                                                               |
| **Date decided** | 18 Nov 2026                                                                                            |
| **Decided by**   | Owner decision OD-03                                                                                   |
| **Sources**      | [OD-03], [UF §12.1 D3], [UF §12.3 D47], [TR §2.3], [ADM App. D AD-31], [ADM §0.4 #11], [SQL], [DD §14] |
| **Affects**      | apps/api, packages/db, packages/entitlements, apps/mobile (D1, AS6), apps/admin (A24, A31); MOD-07     |

## Context

Unverified Free members were capped at 25 specs a day (D3). The open question was whether a
verified Free member keeps that cap [ADM App. D AD-31]. The answer sets a quota, a counter on D1,
the AS6 cap screen and its upsell target.

## Decision

1. Free, unverified (`BASIC`, and `PENDING_REVIEW`): **25** specs a day [OD-03], [TR §2.3].
2. Free, verified with the Black Badge (`ACTIVE`): **50** specs a day [OD-03].
3. Premium and Gold: no daily limit [OD-03].
4. The count resets at the member's local midnight [OD-03].
5. Both numbers are remote config: `discovery.daily_cap.basic` = 25 and
   `discovery.daily_cap.verified_free` = 50, read by the database function `daily_spec_cap()`
   [SQL]. They replace the older key `discovery.free_specs_per_day` [ADM §0.4 #11].
6. The cap screen AS6 offers the Black Badge to an unverified member and Premium to a verified
   one [OD-03].

## Alternatives considered

- **Cap only unverified Free members** (verified Free unlimited), the reading AD-31 asked about.
  Not chosen: the owner capped both kinds, with verification visibly earning more and Premium
  keeping a clear reason [UF §12.3 D47].
- **Hard-coded numbers.** Not chosen: the decision itself makes both admin-tunable.

## Consequences

- Easier: tuning needs no release; the cap is enforced in one database function.
- Harder: "per day" is per member time zone, so the quota key carries the local date
  (`quota:specs:{user_id}:{local_date}` [DD §14]) and tests must cover the midnight edge.
- Cost: none.

## How it is applied

- A spent quota is a `402` with reason `quota_exhausted` and the `limit` and `used` members
  ([1MM-STD-13](../standards/1MM-STD-13-ERROR-CODES.md), [TR §8.1]).
- The counter text on D1 and the AS6 copy take the numbers from the API, never a literal.
- Plan: [MOD-07](../execution/1MM-EXE-MOD-07-DISCOVERY-AND-MATCHING.md).
- Checks: schema tests cover the 25 and 50 caps [TR §10]; API tests change each config value, the
  role and the local date.

## Revisit when

Usage data shows either cap is wrong (change the config value), or a new role or plan needs its
own cap (a new key and a change to `daily_spec_cap()`).
