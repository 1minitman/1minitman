# 1MM-ADR-0031 · The member app is one Expo codebase with Expo Router and NativeWind

|                  |                                                                                                         |
| ---------------- | ------------------------------------------------------------------------------------------------------- |
| **Status**       | Accepted                                                                                                |
| **Date decided** | 18 Nov 2026                                                                                             |
| **Decided by**   | Technical Reference §3 (kept from the product plan) and §5.1                                            |
| **Sources**      | [TR §3], [TR §4.2], [TR §5.1], [TR §5.3], [TR §17.3], `apps/mobile/package.json`, `pnpm-workspace.yaml` |
| **Affects**      | apps/mobile, packages/ui-native, packages/tokens, every module with `MOB` tasks                         |

## Context

The product plan named "Expo via EAS, NativeWind, security modules". The Technical Reference
kept it: "One codebase; over-the-air JavaScript fixes" [TR §3]. The app has 154 live screens for
iOS and Android, must run on Android 9+ and iOS 16.4+ (v3.6, TRX-013), be "usable on a 2 GB RAM Android phone on
3G" and target a download under 30 MB [TR §5.3]. The team is small, and the admin and web apps
are already React.

## Decision

1. `apps/mobile` is an Expo app (New Architecture, Hermes), TypeScript strict, for iOS and
   Android from one codebase [TR §5.1]. The repository pins Expo SDK 58 and React Native 0.88.1
   (the exact version the SDK ships with, in the pnpm catalogue).
2. **Navigation:** Expo Router, with file-based routes in `apps/mobile/src/app/` [TR §5.1].
3. **Styling:** NativeWind with the brand tokens, light and dark themes, tier tokens [TR §5.1];
   shared components in `packages/ui-native`.
4. **Data:** TanStack Query, Zustand for local state, the generated API client, and an MMKV
   offline outbox [TR §5.1], [TR §4.2].
5. **Builds and releases:** EAS Build and Submit; EAS Update with a runtime-version pin; staged
   rollouts; the OB1 version gate [TR §5.1].
6. Native capabilities come from Expo modules where they exist (secure store, haptics,
   notifications, camera, calendar); the Rekognition liveness component is wrapped as an Expo
   native module behind an adapter [TR §5.1].

## Alternatives considered

The sources record no alternatives; the stack is carried from the product plan [TR §3].

**Analysis:** (a) two native apps (Swift and Kotlin) would double client work and lose the
shared contracts, entitlements, i18n and tokens; (b) Flutter would add a second language
against [1MM-ADR-0002](1MM-ADR-0002-TYPESCRIPT-EVERYWHERE.md); (c) bare React Native without
Expo would mean owning the native build, update and module tooling that EAS provides.

## Consequences

- Easier: one team ships both platforms; JavaScript fixes go out over the air; schemas and
  entitlement rules are shared with the API.
- Harder: the app is tied to the Expo SDK release cycle and to the React Native version each
  SDK pins; Expo and React Native need a flat `node_modules` layout (`nodeLinker: hoisted`),
  which shapes the whole workspace; the low-end device budget needs attention to list and image
  performance (FlashList, expo-image) [TR §5.1]; an over-the-air update cannot change native
  code.
- Cost: EAS usage.

## How it is applied

- `apps/mobile/` (Expo SDK 58, `expo-router`, `nativewind`); `packages/ui-native`;
  `react-native` in the pnpm catalogue so every workspace resolves one version
  (`scripts/check-repo-rules.mjs` enforces `catalog:`).
- Standards: [1MM-STD-03 Mobile build strategy](../standards/1MM-STD-03-MOBILE-BUILD-STRATEGY.md),
  [1MM-STD-19 OTA updates](../standards/1MM-STD-19-OTA-UPDATES.md),
  [1MM-STD-18 Notifications](../standards/1MM-STD-18-NOTIFICATIONS.md).
- Checks: Maestro end-to-end tests using `data-testid` hooks [TR §5.1], [TR §17.3]; bundle
  budgets in CI [TR §17.3]; no mobile task starts before its module's API gate.

## Revisit when

A required capability cannot be delivered as an Expo module, or the app cannot meet the low-end
device and download-size targets [TR §5.3] on this stack.
