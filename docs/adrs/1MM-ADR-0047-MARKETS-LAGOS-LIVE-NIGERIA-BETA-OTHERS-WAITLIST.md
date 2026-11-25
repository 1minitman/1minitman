# 1MM-ADR-0047 · Markets: Lagos live, rest of Nigeria invite beta, everywhere else waitlist

|                  |                                                                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Status**       | Accepted                                                                                                                             |
| **Date decided** | 18 Nov 2026                                                                                                                          |
| **Decided by**   | Owner decision OD-09                                                                                                                 |
| **Sources**      | [OD-09], [UF §12.1 D15], [UF §12.3 D53], [TR §2.6], [WEB §9 DN-03, DN-16], [ADM App. D AD-33], [SQL]                                 |
| **Affects**      | apps/api, packages/db, apps/mobile (C6, D1, H2), apps/site (W14, W25), apps/admin (A29, A31); MOD-02, MOD-03, MOD-07, MOD-13, MOD-15 |

## Context

The sources listed several cities and a diaspora audience without saying which are open at
launch [WEB §9 DN-03]. Emergency numbers were needed per country [WEB §9 DN-16], and the admin
spec asked which markets allow international discovery [ADM App. D AD-33].

## Decision

1. **Lagos** is the only live market at launch [OD-09].
2. The **rest of Nigeria** is a closed beta by invite: `cities.market_status = beta`,
   `markets.beta_requires_invite = true`, single-use codes in `beta_invites` [TR §2.6], [SQL].
3. **Every other city and country** is waitlist only (`waitlist_entries`, website module W25)
   [OD-09], [TR §2.6].
4. **Emergency numbers ship for Nigeria only (112)** (`countries.emergency_number`,
   `site_settings.emergency_numbers`). Others are added, with a verified source, as each market
   opens [OD-09], [TR §2.6].
5. No country other than Nigeria allows international discovery until it opens. Gold's
   International tab shows "Opening soon" with a waitlist count, never empty results, and Gold
   copy must not overstate international discovery before then [OD-09], [TR §2.6].

## Alternatives considered

- **Nigeria first, then two more countries in the first wave** (the earlier decision D15):
  narrowed by OD-09 [UF §12.1].
- **A two-city private beta** [WEB §9 DN-03]: not chosen.

The recorded rationale is density in one city first, and no empty screens or promises that cannot
be kept yet [UF §12.3 D53].

## Consequences

- Easier: one live market to operate, moderate and support.
- Harder: sign-up location (C6) has three outcomes (live, invite needed, waitlist), each with its
  own screen state and API answer; the app still ships `en`, `pcm` and `fr` strings [UF §12.1].
- Harder: opening a market is a data change (city status, emergency number, legal review), and
  must work without a release.

## How it is applied

- Market status and emergency numbers are admin-managed data (A31 markets tab, A29 waitlist
  invites) served by the API; no client holds a city or number list
  ([1MM-STD-06 §5](../standards/1MM-STD-06-API-FIRST.md)).
- Plans: [MOD-02](../execution/1MM-EXE-MOD-02-PLATFORM-CONFIG-AND-CATALOGUES.md) (markets),
  [MOD-07](../execution/1MM-EXE-MOD-07-DISCOVERY-AND-MATCHING.md) (International tab),
  [MOD-13](../execution/1MM-EXE-MOD-13-MEETUPS-AND-PERSONAL-SAFETY.md) (H2 safety centre).
- Checks: API tests for each `market_status`; a test that a country without a verified number
  shows none.

## Revisit when

A market opens: its status, verified emergency number and per-market legal review
([1MM-ADR-0048](1MM-ADR-0048-STAGED-LEGAL-MINIMUM-AND-INTERIM-DPO.md)) land together.
