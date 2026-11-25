# 1MM-ADR-0070 · Accessibility baseline WCAG 2.2 AA with 44 px targets; haptics, sound and motion as tagged requirements

|                  |                                                                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Status**       | Accepted                                                                                                                       |
| **Date decided** | 18 Nov 2026                                                                                                                    |
| **Decided by**   | Product decision D42 [UF §12.2]; Technical Reference §2.4 and §2.5                                                             |
| **Sources**      | [CB §7], [UF §12.2 D42], [TR §2.4], [TR §2.5], [BG §13], [ADM §1.9], [WEB §3.6], [SQL]                                         |
| **Affects**      | apps/mobile, apps/admin, apps/site, apps/web, packages/ui-native, packages/ui-web, packages/tokens; every module with a client |

## Context

The product is designed for a mid-range Android phone on 3G, used one-handed and in public places
[UF §12.2 D42]. The brand guide makes accessibility "a release blocker, not a backlog item"
[BG §13]. The designs also tag haptics, sounds and motion per element; without a rule those tags
would be treated as decoration and dropped.

## Decision

**Accessibility**

1. The target is **WCAG 2.2 level AA** on every screen of the app [BG §13], the admin console
   [ADM §1.9] and the website [WEB §3.6].
2. **Touch targets are at least 44 × 44 px**; small chips get an invisible 44 px hit area
   [TR §2.4]. On the admin desktop layout, pointer targets are at least 24 × 24 px [ADM §1.9].
3. Contrast: body text ≥ 7:1, secondary text ≥ 4.5:1, UI graphics ≥ 3:1. Colour is never the
   only signal [TR §2.4].
4. Text scales to 200% without clipping. Real controls only; icon buttons are labelled in context
   [TR §2.4].

**Sensory system: each tag is a requirement, not a suggestion**

5. Haptics are tagged in the design as `data-haptic` with seven kinds (selection, light, medium,
   success, double-soft, warning, error). Code maps them through one `useHaptic(kind)` hook to
   `expo-haptics`, respecting `user_settings.haptics_enabled` [TR §2.5].
6. Only two sounds exist, `match-chime` and `call-start`; sound is off by default [TR §2.5].
7. Motion runs 150–250 ms with ease-out, no bounce and no parallax. The one signature motion is
   the 1-Minute ring. Reduced motion has an alternative for each animation: the ring counts down
   in 10-second steps and the match animation is static [TR §2.4], [TR §2.5].

## Alternatives considered

The sources record no alternatives. **Analysis:** WCAG 2.1 AA is the more common contractual
baseline, but the sources name 2.2 on all three surfaces, and 2.2 adds the target-size and
focus-not-obscured criteria the designs already meet. Treating haptics as optional polish would
leave the warning haptic on destructive confirms untested.

## Consequences

- Easier: one hook, one token set and one test list; a screen is accepted or rejected on stated
  criteria.
- Harder: every mobile task carries screen-reader, 200% text, reduced-motion and target-size
  checks, and haptics can be proven only on a real device.
- Harder: tooling named by the sources is not all configured yet (GAP-STD03-06).

## How it is applied

- Mobile rules and the per-task checks: [1MM-STD-03 §7, §8, §12](../standards/1MM-STD-03-MOBILE-BUILD-STRATEGY.md);
  tokens and components: [1MM-STD-20](../standards/1MM-STD-20-DESIGN-SYSTEM.md);
  assets: [1MM-ADR-0057](1MM-ADR-0057-ILLUSTRATIONS-ONLY-AND-FREE-LIBRARY-SOUNDS.md).
- Each module plan's section 7 lists the haptic and sound tags of its screens.
- Checks: CI runs axe on web and admin and an accessibility check on the Maestro flows
  [TR §2.4]; VoiceOver and TalkBack passes are manual for each release [BG §13]; the
  accessibility audit is a launch-gate item in
  [MOD-19](../execution/1MM-EXE-MOD-19-HARDENING-AND-LAUNCH.md).
- Forms: labels, error identification and suggestions, `autocomplete` and accessible authentication follow [1MM-STD-21](../standards/1MM-STD-21-CLIENT-INPUT-VALIDATION.md) and [1MM-ADR-0080](1MM-ADR-0080-CLIENT-INPUT-VALIDATION-STRATEGY.md).

## Revisit when

A market's law sets a different standard, WCAG 3 is adopted, or research shows a haptic or sound
rule does not work in public use.
