# 1MM-ADR-0061 · Recommended defaults applied by the owner's standing instruction

|                  |                                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------------ |
| **Status**       | Accepted                                                                                                     |
| **Date decided** | 19 Nov 2026                                                                                                  |
| **Decided by**   | Owner decision OD-31 (standing instruction)                                                                  |
| **Sources**      | [OD-31], [ODT P-1 to P-4, T-7, T-8], [UF §12.3 D62–D66], [TR §2.1], [TR §2.3], [TR §18.3], [SQL]             |
| **Affects**      | apps/api, packages/db (seeds), packages/entitlements, apps/mobile (D1, D7F, D9, PM8); MOD-04, MOD-07, MOD-08 |

## Context

After answering the first tracker items, the owner instructed that every remaining open item take
its recommended approach, and that only decisions involving critical infrastructure or cost come
back for an answer [ODT "Owner instruction"]. This ADR records the instruction and the product
defaults it settled that engineering must enforce. The admin and website registers settled the
same way are in [1MM-ADR-0071](1MM-ADR-0071-ADMIN-CONSOLE-GOVERNANCE-RULES.md) and
[1MM-ADR-0072](1MM-ADR-0072-WEBSITE-PRIVACY-FIRST-CONSENT-AND-REGISTER-DEFAULTS.md).

## Decision

| Item                                 | Default applied                                                                                                                         | Where it lives                                                                                                     |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Gold fair use (P-1)                  | "Unlimited" conversations has a soft cap of 100 new conversations a day, with a gentle message; existing chats are never blocked        | `chat.gold_new_conversations_daily_soft_cap` = 100 [SQL]                                                           |
| Rewind (P-2)                         | Gold's Rewind lives in the "Passed" list (match history); the 6-second Undo after a Pass stays for everyone                             | `discovery.rewind` entitlement; `discovery.pass_undo_seconds` [SQL]                                                |
| Likes sort and filter, prompts (P-3) | D7F sort and filter is Premium and Gold; PM8 prompts are for everyone                                                                   | `likes.sort_filter` entitlement                                                                                    |
| Scarcity card (P-4)                  | Shown when new verified members who joined in the member's city this week fall below a threshold; real counts only                      | `discovery.scarcity_threshold` = 5 [SQL]                                                                           |
| Seeded timings (T-7)                 | Keep the seeds: intro text 280 characters, DM request expiry 14 days, unmatch cooldown 30 days, call ring 45 seconds; all admin-tunable | `intro.text_max_chars`, `dm_request.expiry_days`, `unmatch.cooldown_days`, `calls.ring_timeout_seconds` [TR §18.3] |
| Catalogues (T-8)                     | Launch with the starter vibe-tag and message-effect catalogues                                                                          | Seeds; see [1MM-ADR-0067](1MM-ADR-0067-MESSAGE-EFFECTS-SET.md)                                                     |

The same standing instruction is the basis for the design-data-review defaults OD-32 to OD-40;
the owner can reverse any of them [OD-32 to OD-40 preamble].

## Alternatives considered

Each row had a question and a recommendation in the tracker; the recommendation was applied
unchanged [ODT]. The tracker records no competing option for P-1 to P-4 beyond the open question.
**Analysis:** the alternative to the instruction itself was to hold every item for an individual
answer, which would have blocked the schema seeds.

## Consequences

- Easier: every value above is a config key, an entitlement or a seed, so reversing a default is
  a data change, not a release.
- Harder: a soft cap is not an error. The API allows the conversation and signals the gentle
  message; it must never return a blocking problem for it.
- Harder: defaults taken without individual review are the likeliest values to change after
  research, so none may be hard-coded.

## How it is applied

- Plans: [MOD-07](../execution/1MM-EXE-MOD-07-DISCOVERY-AND-MATCHING.md) (Rewind, likes filter,
  scarcity), [MOD-08](../execution/1MM-EXE-MOD-08-INTRO-CHAT-AND-DIRECT-SPECS.md) (fair use,
  timings), [MOD-04](../execution/1MM-EXE-MOD-04-PROFILE-MEDIA-AND-PROMPTS.md) (prompts).
- Checks: tests change each config value and each role ("variables change",
  [1MM-STD-01](../standards/1MM-STD-01-TESTING-STRATEGY.md)); the entitlement keys in code equal
  the seed (GAP-STD14-06).

## Revisit when

Usability research returns, or the owner reverses a default. A pending change is already
recorded for the scarcity threshold (5 to 8) [ODT P-4].
