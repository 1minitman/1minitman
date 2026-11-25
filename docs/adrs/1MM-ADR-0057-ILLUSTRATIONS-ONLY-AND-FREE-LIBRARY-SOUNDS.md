# 1MM-ADR-0057 · Illustrations only (no stock photos) and two free library sounds

|                  |                                                                                                           |
| ---------------- | --------------------------------------------------------------------------------------------------------- |
| **Status**       | Accepted                                                                                                  |
| **Date decided** | 20 Nov 2026                                                                                               |
| **Decided by**   | Owner decisions OD-24 and OD-25 (tracker items C-7 and C-8)                                               |
| **Sources**      | [OD-24], [OD-25], [ODT C-7, C-8, B-5], [UF §12.2 D38], [CB §7, §8], [TR §2.5], [WEB §3.4], [WEB §9 DN-08] |
| **Affects**      | apps/mobile, apps/site, apps/admin (media library), packages/ui-native, asset folders; MOD-00, MOD-15     |

## Context

Marketing and onboarding need imagery, and two moments need a sound: the match chime on D5 and
the call start on MF4 [CB §7]. The illustration system was already decided: one line-drawn cast,
Ink on Paper, from a CC0 source, with a licence log [UF §12.2 D38]. Open were marketing
photography [WEB §9 DN-08] and the sound assets [ODT B-5].

## Decision

1. **Illustrations only.** The website and marketing use the illustration cast; **no stock
   photos**. A consented photo shoot is reconsidered after the beta [OD-24].
2. **Two free, royalty-free library sounds**: `match-chime` and `call-start`. No other sounds
   exist [OD-25], [TR §2.5].
3. Sound is **off by default** (`user_settings.sounds_enabled` defaults to false) [OD-25], [SQL].
4. Every asset has a licence record: the sounds and illustrations in the pack's licence log
   [OD-25], and every website media item in the media library before it can be published
   [WEB §3.4].
5. Real member photos are always shown in full colour; illustrations stay Ink on Paper on a Paper
   plate in the dark theme [CB §8].

## Alternatives considered

- **Photography:** commission a consented shoot, or use members who opt in [WEB §9 DN-08]. Not
  chosen now; reconsidered after the beta.
- **Sounds:** commission two custom sounds before the beta, which was the tracker's
  recommendation [ODT B-5]. The owner chose free library sounds; custom sounds are reconsidered
  after launch [OD-25].

## Consequences

- Easier: every bundled asset is licence-clean and small; no model releases or consent records
  are needed for launch imagery.
- Harder: website blocks designed for member photographs (for example hero member cards) cannot
  be published; the CMS blocks illustrations in those blocks [WEB §4 W08], so the illustrated
  variant is the launch state.
- Cost: none.

## How it is applied

- Assets a screen needs are listed by file name in each module plan's section 3.3 and are part of
  "fully supplied" ([1MM-STD-06 §4](../standards/1MM-STD-06-API-FIRST.md)).
- Brand and asset rules: [1MM-STD-04](../standards/1MM-STD-04-BRAND-GUIDE.md) and
  [1MM-STD-20](../standards/1MM-STD-20-DESIGN-SYSTEM.md); the sensory rules are in
  [1MM-ADR-0070](1MM-ADR-0070-ACCESSIBILITY-BASELINE-AND-SENSORY-SYSTEM.md).
- Checks: review rejects an asset without a licence record; a CMS validation test that media
  without a licence record cannot be published.

## Revisit when

The beta ends (photography) or launch has happened (custom sounds).
