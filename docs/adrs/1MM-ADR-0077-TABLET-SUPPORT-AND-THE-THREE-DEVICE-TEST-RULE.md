# 1MM-ADR-0077 · Tablets are a supported target, and every mobile task is tested on three devices

|                  |                                                                                                                                               |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**       | Proposed                                                                                                                                      |
| **Date decided** | 24 Nov 2026 (proposed)                                                                                                                        |
| **Decided by**   | Engineering recommendation in 1MM-STD-03, following the owner's request that the mobile strategy cover phones and tablets; awaiting the owner |
| **Sources**      | `docs/standards/1MM-STD-03-MOBILE-BUILD-STRATEGY.md` §2, §3, §12, §15, `apps/mobile/app.config.ts`, [TR §5.3], [BG §07], [TOK], [INV]         |
| **Affects**      | apps/mobile, packages/ui-native, packages/tokens; every `MOD-nn-MOB-nn` task                                                                  |

## Context

The Technical Reference sets the minimum devices and the floor device (a 2 GB RAM Android phone
on 3G) [TR §5.3]. Until v3.6 it did not address tablets (TRX-013 now states that phones and tablets are both
supported). The scaffold excludes them:
`ios.supportsTablet: false` and `orientation: 'portrait'` in `apps/mobile/app.config.ts`. The
brand guide and tokens give only a tablet grid and two breakpoints, 600 and 1024 [BG §07], [TOK],
and no design board shows a tablet, landscape or foldable layout (GAP-STD03-04). The mobile
build strategy was asked to cover phones and tablets on iOS and Android.

## Decision

1. **Tablets are required targets**: iPad and Android tablets, including foldables and
   split-screen ([1MM-STD-03 §2](../standards/1MM-STD-03-MOBILE-BUILD-STRATEGY.md)).
2. **Layout follows window width, never device name.** Six classes from `phone-small` to
   `tablet-wide`; the 600 and 1024 steps come from the tokens, the finer steps (360, 400, 840)
   are recommendations awaiting tokens (GAP-STD03-03).
3. **The three-device rule:** every mobile task, and every later change to a screen, is run on
   **at least one iOS phone, one Android phone and one tablet** before review. The pull request
   names the devices and attaches a light and a dark screenshot per class touched; a task with no
   tablet evidence is not reviewed.
4. Wider coverage (small phone, the floor device, an Android tablet, a foldable, real devices) is
   required at the points listed in section 12.1 of the standard, chiefly module exit gates.

## Alternatives considered

**Analysis** (the sources give none):

- **Phones only**, as scaffolded. Cheapest, and it matches the boards. Rejected because the
  owner asked for tablet coverage, and because an Android app is installable on tablets and
  foldables whether or not they were designed for; an undesigned stretched layout is the result.
- **Tablets "supported" by letting the phone layout scale.** Rejected: it fails the "no
  stretched phone layout" check and wastes the width on chat and discovery screens.
- **Testing on two devices** (one per platform). Rejected: the tablet class is exactly where
  untested layouts break.

## Consequences

- Easier: split-screen, foldables and rotation work without special cases, because code asks
  only "how wide is my window".
- Harder: every mobile task costs more to verify, and tablet layouts for the screens that change
  structure have no boards yet, so they rest on recommendations until GAP-STD03-04 closes.
- Harder: the scaffold must change first (GAP-STD03-02), and `packages/ui-native` needs a
  device-class hook and screen wrapper (GAP-STD03-05).
- Open: phone landscape is undecided (GAP-STD03-07); and the minimum iOS version in the
  Technical Reference cannot be met by the installed Expo SDK (GAP-STD03-01).

## How it is applied

- The matrix and per-device checks are [1MM-STD-03 §12](../standards/1MM-STD-03-MOBILE-BUILD-STRATEGY.md);
  the definition of done for a mobile task is its section 13; the framework choice is
  [1MM-ADR-0031](1MM-ADR-0031-MOBILE-EXPO-ROUTER-NATIVEWIND.md).
- Changing `supportsTablet` or `orientation` is a native change and ships as a store build
  ([1MM-ADR-0078](1MM-ADR-0078-OTA-UPDATE-POLICY.md)).
- Check: review of the device list and screenshots in each mobile pull request; Maestro flows on
  one iOS and one Android target in CI.

## Revisit when

The owner rules on tablet scope or on GAP-STD03-07, tablet boards arrive (replace the
recommendations), or device-farm automation makes a wider matrix cheap enough for every task.
