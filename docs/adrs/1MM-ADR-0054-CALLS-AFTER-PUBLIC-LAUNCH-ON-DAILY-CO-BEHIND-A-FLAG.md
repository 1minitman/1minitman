# 1MM-ADR-0054 · In-app calls switch on after public launch, on daily.co, behind `calls.enabled`

|                  |                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------- |
| **Status**       | Accepted                                                                              |
| **Date decided** | 20 Nov 2026                                                                           |
| **Decided by**   | Owner decision OD-20 (tracker items C-3, P-6); Technical Reference §18.1 baseline T12 |
| **Sources**      | [OD-20], [ODT C-3, P-6], [UF §12.3 D61, D66], [TR §18.1], [TR §2.5], [SQL]            |
| **Affects**      | apps/api, apps/mobile (MF4, MF5, D9), packages/entitlements; MOD-08                   |

## Context

Audio and video calls (MF4) are a Gold feature marked "later release" in the change brief. The
tracker asked when they ship [ODT P-6]; the provider was a cost decision reserved for the owner
[ODT C-3].

## Decision

1. Calls switch on **after public launch** [OD-20].
2. The provider is **daily.co**, on its free monthly allowance first, then pay per minute
   [OD-20].
3. Until then MF4 shows "Coming soon": feature flag `calls.enabled` is seeded off and is a kill
   switch [SQL `feature_flags` seed].
4. The ring timeout stays at the seeded 45 seconds, admin-tunable as
   `calls.ring_timeout_seconds` [UF §12.3 D66].

## Alternatives considered

- **Ship calls at launch.** Not chosen: the recommendation was after public launch [ODT P-6]; the
  recorded rationale is a lean launch [UF §12.3 D61].

The sources record no alternative provider; daily.co was already the Technical Reference
baseline [TR §18.1 T12].

## Consequences

- Easier: launch does not depend on a media vendor, call quality testing or call moderation.
- Harder: the call entry point on D9, the `calls.audio_video` entitlement and the `call-start`
  sound ([1MM-ADR-0057](1MM-ADR-0057-ILLUSTRATIONS-ONLY-AND-FREE-LIBRARY-SOUNDS.md)) exist in the
  design from day one, so the flag-off state must be a designed state, not a missing screen.
- Cost: usage-based after the free allowance; the allowance is a number to watch once on.

## How it is applied

- A route for a feature whose flag is off answers `404`
  ([1MM-STD-13 §2.2](../standards/1MM-STD-13-ERROR-CODES.md)); the app reads the flag from the
  config bootstrap.
- Scope and the vendor port are in
  [MOD-08](../execution/1MM-EXE-MOD-08-INTRO-CHAT-AND-DIRECT-SPECS.md) ("deferred behind a
  flag").
- Adding the vendor SDK is a native change and ships as a store build
  ([1MM-STD-19 §4](../standards/1MM-STD-19-OTA-UPDATES.md)).
- Checks: client and API tests in both flag states; a test that a non-Gold member is refused when
  the flag is on.

## Revisit when

Public launch has happened and the owner asks for calls, or usage outgrows the provider's
pay-per-minute terms.
