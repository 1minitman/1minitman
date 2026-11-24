# 1MM-ADR-0042 · The 1-Minute Intro window is 24 hours

|                  |                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------- |
| **Status**       | Accepted                                                                              |
| **Date decided** | 18 Nov 2026                                                                           |
| **Decided by**   | Owner decision OD-02                                                                  |
| **Sources**      | [OD-02], [UF §12.3 D46], [TR §2.3], [TR §18.3], [ADM App. D AD-30], [SQL]             |
| **Affects**      | apps/api, apps/worker, apps/mobile (D5, D8, MF1), packages/db; MOD-07, MOD-08, MOD-11 |

## Context

The sources disagreed: the change brief said 24 hours, while the matching rules, MF1, ES3 and
notification N03 said 48 hours [ADM App. D AD-30]. The window drives a countdown on D5, the expiry
of fresh matches on D8, a reminder notification and an expiry job, so one value had to win.

## Decision

1. A match or maybe match must start its 1-Minute Intro within **24 hours** [OD-02].
2. The value is remote config `intro.window_hours` = 24; `matches.intro_expires_at` is
   `created_at` plus that value [SQL], [TR §2.3].
3. Every "48 hours" that refers to the intro or maybe-match window becomes 24 hours. The other
   48-hour rules stay: meet-up invite expiry and the re-match wait after unblocking [OD-02].

## Alternatives considered

- **48 hours**, as in the older matching rules and screens [ADM App. D AD-30]. Not chosen: the
  recorded rationale is that a shorter window fits the product promise and keeps matches fresh
  [UF §12.3 D46].

The sources record no other option. **Analysis:** a per-plan window would add a gate with no
source asking for it.

## Consequences

- Easier: one number, read from config, for the API, the expiry job, the countdown and the copy.
- Harder: copy and notification templates that state the window must take the number from the
  config value, not from a literal, or they drift when an admin tunes it.
- Cost: none.

## How it is applied

- The API computes expiry from `intro.window_hours`; no handler or client holds the number
  ([1MM-STD-06 §6](../standards/1MM-STD-06-API-FIRST.md)).
- Plans: [MOD-07](../execution/1MM-EXE-MOD-07-DISCOVERY-AND-MATCHING.md) (match creation, D5),
  [MOD-08](../execution/1MM-EXE-MOD-08-INTRO-CHAT-AND-DIRECT-SPECS.md) (intro, expiry).
- Checks: an API test that changes the config value and sees `intro_expires_at` follow; a test
  that the meet-up invite expiry and the re-match wait are unaffected.

## Revisit when

Usability research or match-to-intro data shows the window is too short or too long. The value
changes in the admin console; this ADR is reopened only if the window stops being one global
number.
