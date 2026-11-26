# 1MM-STD-19 · Over-the-air updates (mobile)

|              |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Document** | 1MM-STD-19                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **Status**   | Approved baseline · v1.0 · 24 Nov 2026                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **Audience** | Engineers and coding agents                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **Owner**    | Engineering lead (code owners)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **Sources**  | [TR §4.4], [TR §5.1], [TR §5.3], [TR §8.2], [TR §15.1], [TR §17.3], [SQL], [UF §15.17], [ADM A31], [INV OB1], [CN onboarding-edge-rules], [OD-06], [OD-12]; repo: `apps/mobile/app.config.ts`, `apps/mobile/eas.json`, `apps/mobile/package.json`, `docs/USAGE.md`; Expo SDK 58 EAS Update and `expo-updates` reference (docs.expo.dev, read 24 Nov 2026)                                                                                                                                                                          |
| **Related**  | [MOD-02](../execution/1MM-EXE-MOD-02-PLATFORM-CONFIG-AND-CATALOGUES.md) (owns OB1 and `app_versions`) · [MOD-00](../execution/1MM-EXE-MOD-00-FOUNDATIONS.md) · [MOD-19](../execution/1MM-EXE-MOD-19-HARDENING-AND-LAUNCH.md) · [1MM-STD-03](1MM-STD-03-MOBILE-BUILD-STRATEGY.md) · [1MM-STD-06](1MM-STD-06-API-FIRST.md) · [1MM-STD-10](1MM-STD-10-COMMITS-AND-LOCAL-CI.md) · [1MM-STD-11](1MM-STD-11-SECURITY-AND-COMPLIANCE.md) · [1MM-STD-17](1MM-STD-17-LANGUAGE-CONFIGURATION.md) · [1MM-STD-18](1MM-STD-18-NOTIFICATIONS.md) |

**What this document is for and when to open it.** It sets how JavaScript and asset changes reach
installed copies of the member app without a store release, using Expo EAS Update, and how that
works together with the admin-managed version gate (OB1). Open it before you publish an update,
cut a store build, change anything native in `apps/mobile`, raise `min_supported` in the admin
console, or remove something from an API contract. Section 12 lists the configuration the scaffold
still needs.

EAS Update commands and settings in this document were checked against the Expo documentation for
SDK 58 on 24 Nov 2026. Check them again when the SDK is upgraded.

## 1. How it works

| Term            | Meaning (Expo documentation)                                                                                                                  |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Build           | The binary installed from a store or an internal link. It contains the native layer and one embedded JavaScript bundle                        |
| Update          | A JavaScript bundle and its assets (images, fonts), published to EAS and downloaded by builds                                                 |
| Runtime version | A string that names the native layer. A build only accepts updates with exactly its runtime version and its platform                          |
| Channel         | A label fixed into a build at build time (`eas.json`). It points to a branch                                                                  |
| Branch (EAS)    | A server-side list of updates; the newest is the active one. By default a channel points to the EAS branch of the same name. Not a git branch |

A build receives the newest update on its channel's branch that matches its platform and runtime
version. By default it checks when it cold-starts, downloads in the background without blocking
start-up, and runs the new update on the following launch.

Two mechanisms keep members on working code, and they are different things:

| Mechanism                  | Controls                                                                                 | Managed by                                      |
| -------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------- |
| EAS Update (this document) | Which JavaScript runs inside an installed build                                          | Engineers, through the release procedure        |
| OB1 version gate           | Whether an installed **build** may run at all (Required), or should update (Recommended) | Admins in A31, through `app_versions` [ADM A31] |

## 2. Runtime version policy

| Item                      | Rule                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Policy                    | `runtimeVersion: { policy: 'appVersion' }`, as scaffolded. The runtime version is the `version` in `app.config.ts` (currently `0.1.0`)                                                                                                                                                                                                                                                            |
| Why this policy           | The Technical Reference asks for "EAS Update with a runtime-version pin" [TR §5.1]; `app_versions.runtime_version` records the pin per released version [SQL]; `min_supported` and `latest` are semver strings an admin types [SQL]. With `appVersion`, the three are the same readable number. **Recommendation**                                                                                |
| The obligation it creates | **Any change to the native layer must raise `version`** in the same pull request. If it does not, an update built against the new native layer could be offered to old builds and crash them                                                                                                                                                                                                      |
| Guard                     | **Recommendation:** CI computes the native fingerprint with `@expo/fingerprint` on every pull request that touches `apps/mobile` or its dependencies and fails when the fingerprint changed and `version` did not. The Expo `fingerprint` policy would do this automatically, at the cost of opaque runtime strings that no longer match `app_versions`; revisit by ADR if the guard proves leaky |
| Build numbers             | iOS `buildNumber` and Android `versionCode` are managed by EAS (`appVersionSource: remote`, `autoIncrement` on `production`). They are not part of the runtime version                                                                                                                                                                                                                            |
| Version numbers           | Semver `MAJOR.MINOR.PATCH`, matching the CHECK on `app_versions` [SQL]. Patch: native fix. Minor: new native capability or SDK patch. Major: by owner decision. JavaScript-only changes do **not** change `version`; they ship as updates on the current one                                                                                                                                      |

## 3. Channels, branches and environments

| Git branch   | EAS build profile | Channel       | EAS environment | `APP_ENV`    | API                     | Who gets it                                                                                                                     |
| ------------ | ----------------- | ------------- | --------------- | ------------ | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| any (local)  | `development`     | `development` | `development`   | `dev`        | Local or shared dev API | Engineers with a development client. Development builds load from Metro; the channel is used only to preview a published update |
| `develop`    | `preview`         | `preview`     | `preview`       | `staging`    | Staging                 | Internal testers and usability builds [TR §4.4]                                                                                 |
| `production` | `production`      | `production`  | `production`    | `production` | Production              | Members, through the stores                                                                                                     |

Rules:

1. **One direction.** An update reaches `production` only from the git branch `production`, which
   is itself updated only by an approved merge from `develop`. Nothing is published to the
   `production` channel from a feature branch or a laptop.
2. **Same commit, tested first.** The commit published to `production` has already run as an
   update on `preview` against staging.
3. **Channels stay mapped to the EAS branch of the same name.** `eas channel:edit` is used only
   for a branch-based rollout or an emergency, and the change is recorded in the progress log.
4. **Environment values are fixed at publish time.** `eas update` requires `--environment`; only
   that EAS environment's variables are used. `EXPO_PUBLIC_API_URL` and every other `EXPO_PUBLIC_`
   value must exist in the EAS environments `preview` and `production`, with values for staging and
   production. They are public by nature; no secret is ever an `EXPO_PUBLIC_` value
   (`src/lib/env.ts`).
5. **An update published for one environment never reaches a build of another**, because the
   channel is inside the build.
6. The demo environment [TR §4.4] uses `preview` builds against demo data; it has no
   channel of its own. **Recommendation.**

## 4. What may ship over the air

| Change                                                                                                                                                                                                                                                                  | Over the air                                 | Store build                                      |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------ |
| Screen code, components, navigation, styles (NativeWind classes), hooks, state                                                                                                                                                                                          | ✓                                            |                                                  |
| Bundled `packages/i18n` catalogues and other workspace packages that are pure TypeScript (`contracts`, `entitlements`, `tokens`, `ui-native`)                                                                                                                           | ✓                                            |                                                  |
| Images, fonts and other assets imported by JavaScript                                                                                                                                                                                                                   | ✓                                            |                                                  |
| Bug fixes and copy fixes in the above                                                                                                                                                                                                                                   | ✓                                            |                                                  |
| Adding, removing or upgrading any package with native code (anything that changes the iOS or Android project)                                                                                                                                                           |                                              | ✓                                                |
| Expo SDK or React Native upgrade                                                                                                                                                                                                                                        |                                              | ✓                                                |
| Anything in `app.config.ts` that feeds the native project: plugins, permissions and their usage texts, `scheme`, icons, splash, `orientation`, `supportsTablet`, bundle id and package, entitlements and capabilities, notification icon and channels defined by plugin |                                              | ✓                                                |
| The update configuration itself (`updates.*`, `runtimeVersion`, code-signing certificate)                                                                                                                                                                               |                                              | ✓                                                |
| A new in-app purchase product or a change to how purchases work                                                                                                                                                                                                         | Store review decides; treat as a store build | ✓                                                |
| A change that alters what the app is or does for store review (new feature area, new data collection)                                                                                                                                                                   |                                              | ✓, with updated store listing and privacy labels |

Further rules:

1. **Store policy.** Over-the-air updates may fix and improve the reviewed app. They must not
   change its primary purpose or add a feature the store has not reviewed. When in doubt, ship a
   build.
2. **Limits, labels, option lists and flags do not need an update at all.** They come from
   `GET /v1/config`, the catalogues and the i18n catalogue and are changed in the admin console
   (owner rule 4). An update is not the tool for changing a number or a sentence.
3. **Catalogue floor.** The bundled catalogue is the floor; until the runtime overlay in
   GAP-MOD02-04 is decided, wording changes reach apps by update
   ([MOD-02 §7](../execution/1MM-EXE-MOD-02-PLATFORM-CONFIG-AND-CATALOGUES.md)).
4. **Keep updates small.** Large media is never bundled; it is served from the CDN. The download
   budget on 3G applies to updates too [TR §5.3].
5. An update that depends on a native capability is published only for a runtime version whose
   build contains it. The fingerprint guard (section 2) is the check.

## 5. Publishing, staged rollout and rollback

### 5.1 Publishing

| Step        | `preview`                                                                                       | `production`                                                                                                         |
| ----------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Trigger     | Merge to `develop` with a change under `apps/mobile` or a package it bundles                    | Approved merge of `develop` into `production` [TR §17.3]                                                             |
| Who runs it | CI with the robot token `EXPO_TOKEN`. The workflow does not exist yet: GAP-STD19-02             | CI, after a manual approval by a code owner                                                                          |
| Command     | `eas update --channel preview --environment preview --message "<commit subject> (<short sha>)"` | `eas update --channel production --environment production --rollout-percentage=10 --message "<version>+<short sha>"` |
| Signed      | Yes, once code signing is on (section 7)                                                        | Yes                                                                                                                  |
| Platforms   | iOS and Android in the same publish, unless a fix is platform-specific                          | Same                                                                                                                 |

The message always carries the git commit so an update can be traced to its source. Run locally
only through `pnpm --filter @1minitman/mobile eas …` and only for `development` and `preview`.

### 5.2 Staged rollout

| Stage | Share | Hold before moving on | Go / no-go signal                                                                                                                          |
| ----- | ----- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 1     | 10%   | 2 hours               | Crash-free sessions and start-up errors in Sentry for the new update id no worse than the control; no rise in API 4xx/5xx from that update |
| 2     | 50%   | 12 hours              | Same, plus support and feedback channels quiet                                                                                             |
| 3     | 100%  | –                     | –                                                                                                                                          |

The percentages and holds are a **Recommendation**; the sources only require staged rollouts
[TR §5.1], [TR §17.3].

- Progress: `eas update:edit`, choose the update, enter the new percentage. Finish by setting 100.
- Only one rollout can be active per branch, platform and runtime version. A rollout cannot be
  replaced by another rollout: finish or revert it first.
- An urgent fix during a rollout is published with `--force-end-active-rollout` (EAS CLI 24.9.0 or
  later), which ends the active rollout and sends the new update to everyone on that branch,
  platform and runtime version.
- A security fix, or a fix for a defect that blocks sign-in or payment, may go straight to 100% with
  a code-owner approval recorded in the progress log.
- Store builds have their own staged rollout in App Store Connect and Google Play.

### 5.3 Rollback

| Situation                                                            | Action                                                                                                                                  |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| A rollout looks bad before 100%                                      | `eas update:revert-update-rollout`: members return to the control update                                                                |
| A fully rolled-out update is bad and an earlier update was good      | `eas update:rollback`, choose "previously published update": the earlier update is republished as the newest                            |
| Every update on this runtime version is suspect                      | `eas update:rollback`, choose "embedded update" (or `eas update:roll-back-to-embedded`): builds run the bundle they were installed with |
| The embedded bundle of a build is itself bad, or the fault is native | Ship a fixed store build and raise `min_supported` in A31 so OB1 moves members off the bad build (section 6)                            |
| The fault is on the server                                           | Roll back the API, not the app                                                                                                          |

Rules:

1. Roll back first, diagnose second. A rollback is never held for a root cause.
2. A rollback reaches a device on its next check (section 8), not instantly. A member who never
   reopens the app keeps the bad update until they do; the OB1 gate is the backstop.
3. After a rollback, the next publish goes to all clients again, so the fix follows the normal
   path: `develop` → `preview` → `production`.
4. Every rollback gets an entry in [the progress log](../1MM-LOG-01-PROGRESS.md) with the update
   ids, the trigger and the follow-up.
5. Roll forward (a new update with the fix) is preferred when the fix is small, already reviewed
   and the faulty update does not crash on start.

## 6. Forced update and minimum version (OB1)

Owned by [MOD-02](../execution/1MM-EXE-MOD-02-PLATFORM-CONFIG-AND-CATALOGUES.md); summarised here
because every release touches it.

| Item                                          | Rule                                                                                                                                                                                                                                                                                                            | Source                                                         |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Data                                          | `app_versions`: `platform` (`ios`, `android`), `min_supported`, `latest` (semver, `latest ≥ min_supported`), `store_url`, `release_notes_key`, `runtime_version`, `effective_at`, `download_mb`, `min_os_version`. Rows are append-only; the current row per platform is the newest with `effective_at ≤ now()` | [SQL], [ADM A31]                                               |
| Who changes it                                | Admin console `/platform/app-versions`, permission `config.app_versions` (step-up re-authentication, reason), audit `config.app_version.create`. The form previews the effect and shows the share of active devices below a new `min_supported` (from `devices.app_version`) before confirm                     | [ADM A31], [MOD-02 §4.1]                                       |
| How the app learns                            | The splash (A0) calls `GET /v1/config` with `platform` and the installed `version`; the gate is in `app/_layout.tsx`. The provider refreshes on resume and every 60 s in the foreground                                                                                                                         | [CN onboarding-edge-rules], [INV OB1], [MOD-02 §7]             |
| Below `min_supported`                         | **Required**: blocks the app with one action, the store button (`store_url`); no way past; shown on every launch until the build is supported                                                                                                                                                                   | [UF §15.17]                                                    |
| Below `latest`                                | **Recommended**: dismissible; "Not now" snoozes for `app.recommended_update_snooze_days` (seeded 3)                                                                                                                                                                                                             | [SQL], [UF §15.17]                                             |
| Maintenance                                   | A third OB1 state from `maintenance_windows`, with retry and the status-page link; not a version matter                                                                                                                                                                                                         | [ADM A31]                                                      |
| Seed                                          | No `app_versions` row is seeded; the first rows are created in A31 before the first store build (MOD-02-DB-02)                                                                                                                                                                                                  | [MOD-02 §3.1]                                                  |
| No row, or config unreachable on first launch | The app must not lock a member out because the gate could not be read: it proceeds with the last cached answer, or as "none" if there is none; a cached **Required** stays in force offline                                                                                                                     | [MOD-02 §9]; fail-open on first launch is a **Recommendation** |

How the two mechanisms combine:

1. The version sent to `GET /v1/config` is the **native build version** (`version` from the build,
   read from the native application version), never a number carried in the JavaScript bundle. An
   update must not be able to make an old build look new.
2. `app_versions.runtime_version` is filled with the runtime version of the `latest` build. With
   the `appVersion` policy it equals `latest`. It is a record for operators; the app does not
   compare it.
3. **Update first, gate second.** A JavaScript defect is fixed by an update on the affected
   runtime versions. `min_supported` is raised only when (a) the fault is native or in an embedded
   bundle, (b) a security fix needs a native change, (c) an API contract is about to drop something
   old builds use (section 9), or (d) a runtime version is being retired.
4. **Retiring a runtime version.** Updates are published only for runtime versions at or above
   `min_supported`. Before raising `min_supported`, the new build must be live in both stores for
   every device it supports, and the devices-below share is read in A31.
5. Raising `min_supported` and publishing a store build are two separate, ordered steps: build
   approved and available in both stores → `latest` raised (Recommended) → after the adoption
   window, `min_supported` raised (Required).
6. The app cannot force an over-the-air update by itself: `expo-updates` has no built-in mandatory
   update. Section 8 defines the one case where the app applies an update at once.

The config response does not yet carry the fields this needs in a specified form (GAP-MOD02-01),
and the server is not told which update a device runs (GAP-STD19-03).

## 7. Code signing of updates

| Item                | Rule                                                                                                                                                                                                                                                                                                        |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Why                 | A signed update proves it was published by us. The build embeds a certificate and rejects any update whose signature does not verify, even if the update service or the account were compromised                                                                                                            |
| Plan requirement    | Expo offers update code signing only on its Production and Enterprise plans (Expo documentation). The hosting decision is free or pay-as-you-go tiers first [OD-06]: GAP-STD19-04 asked the owner to decide. **Decided** (DEC-007, 26 Nov 2026): turn it on before the first public store build             |
| Keys                | Generated with `npx expo-updates codesigning:generate` (key output directory outside the repository, certificate output directory inside `apps/mobile`). The certificate (`certificate.pem`) is committed; the private key never is                                                                         |
| Configuration       | `npx expo-updates codesigning:configure` adds `updates.codeSigningCertificate` and `updates.codeSigningMetadata` (`keyid`, `alg: 'rsa-v1_5-sha256'`) to the app configuration                                                                                                                               |
| First use           | The certificate is part of the native build, so signing starts with a new build on a new runtime version                                                                                                                                                                                                    |
| Publishing          | `eas update … --private-key-path <path>`: EAS CLI signs locally and sends only the signature. In CI the key is a secret file available only to the release job on the protected branches                                                                                                                    |
| Custody             | The private key is held in the organisation's secret store, readable by code owners only, never on a laptop, never in the repository, logs or an `EXPO_PUBLIC_` value ([1MM-STD-11](1MM-STD-11-SECURITY-AND-COMPLIANCE.md))                                                                                 |
| Rotation            | Before the certificate expires, or at once on suspected exposure: back up the old pair, generate a new pair (new `keyid`), ship a build on a new runtime version, sign updates for that runtime with the new key. Builds with an expired certificate stop applying updates, so rotation has a calendar date |
| Until signing is on | The publish path is protected by the robot token (CI only), branch protection on `develop` and `production`, and two-person approval of the production merge. Record this as an accepted risk in the launch checklist                                                                                       |

## 8. Update checks, failure and fallback

### 8.1 Checks

| Moment                         | Behaviour                                                                                                                                                                                                                  | Basis                                                        |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Cold start                     | `checkAutomatically: 'ON_LOAD'` with `fallbackToCacheTimeout: 0`: start with what is on the device, check and download in the background, apply on the next launch                                                         | `expo-updates` defaults; start-up budget [TR §15.1]          |
| Resume from background         | If the last check is older than 15 minutes, `Updates.checkForUpdateAsync()`; when one is available, `Updates.fetchUpdateAsync()`                                                                                           | Expo documentation pattern; interval is a **Recommendation** |
| Applying a downloaded update   | On the next cold start. Or on resume, by `Updates.reloadAsync()`, only when the app has been in the background for more than 30 minutes and no timer, call, upload, purchase, liveness check or unsent text is in progress | **Recommendation**                                           |
| Critical update                | When the config bootstrap marks the running update as too old (GAP-STD19-03), the app shows a short blocking "Updating…" state, fetches and reloads. Never during the cases above                                          | **Recommendation**                                           |
| Data saver, metered network    | Checks still run (the manifest is small); the download waits for the next cold start on data saver                                                                                                                         | **Recommendation**                                           |
| Development builds and Expo Go | No update checks; `checkForUpdateAsync()` rejects there and the code must guard for it                                                                                                                                     | Expo documentation                                           |

The check never blocks the first screen and never shows a spinner of its own, except in the
critical case.

### 8.2 Failure and fallback

| Failure                                        | Behaviour                                                                                                                                              |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| No network, or the check or download fails     | Keep running the current update; try again on the next check. Not shown to the member; not reported as an error more than once per session             |
| Signature does not verify                      | The update is rejected by the library; the build keeps its current update. Report to Sentry as a security event                                        |
| A new update fails to launch                   | The library does not launch an update that previously failed and falls back to the last good update or the embedded bundle                             |
| Emergency launch                               | `Updates.isEmergencyLaunch` is true when the app had to fall back to the embedded bundle; report `Updates.emergencyLaunchReason` to Sentry at start-up |
| Server sends a rollback to embedded            | Applied on the next launch                                                                                                                             |
| Embedded bundle is older than the API supports | The OB1 gate handles it (Required)                                                                                                                     |

Operating rules:

1. `updates.enabled` stays true and anti-bricking measures stay on; the update URL and headers are
   never overridden at runtime in production builds.
2. Every Sentry event and every analytics session carries `Updates.updateId`, `Updates.channel`,
   `Updates.runtimeVersion` and whether the launch was embedded, so a fault can be tied to one
   update.
3. The root layout renders even if the newest features fail: an error boundary at the root offers
   "Try again" and never leaves a blank screen.
4. Persisted client data (MMKV outbox, query cache, settings) is versioned. An update that changes
   a stored shape migrates it forwards and must tolerate the old shape after a rollback
   ([1MM-STD-12](1MM-STD-12-DATA-HANDLING.md)).

## 9. Updates and API contract versions

An update changes the client faster than a store release, but old builds and old updates stay in
use. The API therefore stays compatible with every supported client
([1MM-STD-06 §7](1MM-STD-06-API-FIRST.md)).

| Rule                                     | Detail                                                                                                                                                                                                                       |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Server first                             | An update that calls a new endpoint or field is published only after the API change is live in that environment (API first)                                                                                                  |
| Additive by default                      | The API adds; it does not remove or rename while a supported client uses the old shape. The check `scripts/check-contract-breaking.mjs` enforces this in CI                                                                  |
| "Supported" is defined by `app_versions` | A field or route may be removed only when no build at or above `min_supported`, running its embedded bundle, uses it. Embedded bundles count: a build that has never fetched an update still calls the API                   |
| Removing something                       | Expand, move clients (by update and by build), raise `min_supported` past the last build whose embedded bundle uses the old shape, wait for the adoption window, then remove, with the approval and ADR that STD-06 requires |
| Generated client                         | The typed client in `packages/contracts` is bundled into each update, so an update always matches the contract of its commit. Publish order is therefore API deploy → `eas update`                                           |
| Rollback pairing                         | Rolling back an update returns clients to an older contract view; since the API only added, the older client still works. Rolling back the API while a newer update is live is not safe: roll the update back first          |
| Push payload                             | The payload version in [1MM-STD-18 §5](1MM-STD-18-NOTIFICATIONS.md) follows the same rule: the server sends only what every supported client understands                                                                     |
| Config and flags                         | A feature that needs server and client together ships dark behind a feature flag (`feature_flags`, A31) and is turned on after the update has rolled out; flag rules can target an app version range [ADM A31]               |

## 10. Release checklist

### 10.1 Over-the-air update to production

- [ ] The change is JavaScript and assets only (section 4); the fingerprint guard is green.
- [ ] `pnpm check` and the mobile test matrix ([1MM-STD-03 §12](1MM-STD-03-MOBILE-BUILD-STRATEGY.md)) passed on the commit.
- [ ] The same commit ran as an update on the `preview` channel against staging on a real iPhone and a real Android phone, installed over the currently released build (not a fresh install).
- [ ] The API the update needs is live in production; no contract removal rides with it.
- [ ] Strings the update uses exist in `en` and are published; `pcm` reviewed or falling back.
- [ ] Stored-data shapes are backward compatible (section 8.2 rule 4).
- [ ] Runtime versions targeted are all at or above `min_supported`.
- [ ] The production merge is approved; CI publishes at 10% with the commit in the message; the update is signed.
- [ ] Sentry release created for the update id; the rollout stages in 5.2 are followed and recorded.
- [ ] The rollback command for this update is written in the release entry before the rollout starts.
- [ ] Entry in [the progress log](../1MM-LOG-01-PROGRESS.md): update ids, percentages, times, result.

### 10.2 Store build

- [ ] `version` raised in `app.config.ts`; the reason for a native build is stated in the pull request.
- [ ] `eas build --profile preview` tested on the device matrix; then `eas build --profile production` from the `production` branch.
- [ ] Update from the previous store version tested (data migration, sign-in kept, push token re-registered).
- [ ] Download size under 30 MB per platform [TR §15.1]; `download_mb` noted for A31.
- [ ] Store listing, screenshots, privacy labels and review notes updated when the feature set or data use changed.
- [ ] `eas submit --profile production`; TestFlight and Play internal testing pass; staged store rollout started.
- [ ] After the build is available to everyone in both stores: new `app_versions` rows in A31 (`latest`, `runtime_version`, `store_url`, `release_notes_key`, `download_mb`, `min_os_version`); release notes key translated.
- [ ] Updates continue for the previous runtime version until `min_supported` passes it.
- [ ] `min_supported` raised only after the adoption window and the devices-below check.

## 11. Testing updates

| Case                                                                     | Expected                                                                             |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| Install the released build, publish an update to `preview`, open twice   | Second launch runs the update (`Updates.updateId` changes, `isEmbeddedLaunch` false) |
| Update with a different runtime version                                  | Not received                                                                         |
| Offline at launch, slow 3G at launch                                     | App starts within budget on current code; update arrives later                       |
| Download interrupted                                                     | Current code keeps running; retried next time                                        |
| Update that throws at start-up (test channel only)                       | Falls back to the previous update or the embedded bundle; emergency launch reported  |
| Rollout at 10% on a test branch                                          | Roughly one device in ten receives it; revert returns them                           |
| Rollback to embedded                                                     | Next launch runs the embedded bundle                                                 |
| Wrong or missing signature (once signing is on)                          | Rejected; current code keeps running                                                 |
| Resume after 30 minutes with an update pending and a draft message typed | No reload; the draft survives                                                        |
| Build below `min_supported` with an update pending                       | OB1 Required shows; the update does not bypass it                                    |
| Old build on its embedded bundle against the current API                 | Every journey still works (contract compatibility)                                   |

These run on a real iPhone and a real Android phone with `preview` builds. Maestro cannot drive
the update service; the cases are a scripted manual run recorded at each module's exit gate that
ships mobile work, and in full in MOD-19.

## 12. Configuration additions needed in the scaffold

Described here, not applied: this document does not edit application files (GAP-STD19-01).

### 12.1 What exists today

| File            | Present                                                                                                                                                                                                                                                                                                          |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app.config.ts` | `runtimeVersion: { policy: 'appVersion' }`; `updates: { url: 'https://u.expo.dev/<project id>' }`; `extra.eas.projectId`; `version: '0.1.0'`                                                                                                                                                                     |
| `eas.json`      | `cli.version` ≥ 16.0.0, `appVersionSource: remote`; build profiles `development` (dev client, internal, channel `development`, `APP_ENV=dev`), `preview` (internal, channel `preview`, `APP_ENV=staging`), `production` (`autoIncrement`, channel `production`, `APP_ENV=production`); `submit.production` empty |
| `package.json`  | No `expo-updates` dependency, so updates cannot be received yet                                                                                                                                                                                                                                                  |

### 12.2 Additions to `apps/mobile/package.json`

| Addition                                                                          | Why                                                    |
| --------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `expo-updates` on the SDK 58 line (install with `npx expo install expo-updates`)  | The library that checks, downloads and applies updates |
| `@expo/fingerprint` as a dev dependency, and a script that prints the fingerprint | The CI guard in section 2                              |

### 12.3 Additions to `apps/mobile/app.config.ts`

| Field                                              | Value                                       | Why                                                                                                      |
| -------------------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `updates.enabled`                                  | `true`                                      | Explicit                                                                                                 |
| `updates.checkAutomatically`                       | `'ON_LOAD'`                                 | Section 8.1                                                                                              |
| `updates.fallbackToCacheTimeout`                   | `0`                                         | Never block start-up on the network                                                                      |
| `updates.codeSigningCertificate`                   | Path to the committed `certificate.pem`     | Section 7 (signing on: DEC-007)                                                                          |
| `updates.codeSigningMetadata`                      | `{ keyid: 'main', alg: 'rsa-v1_5-sha256' }` | Section 7                                                                                                |
| `updates.requestHeaders['expo-channel-name']`      | Not set by hand                             | EAS Build sets the channel from `eas.json`; setting it here is only for builds made outside EAS          |
| `runtimeVersion`                                   | Unchanged                                   | Section 2                                                                                                |
| `extra.appEnv` (or an `EXPO_PUBLIC_APP_ENV` value) | From `APP_ENV`                              | So Sentry and analytics label the environment; today `APP_ENV` is set for builds but not read by the app |
| `ios.bundleIdentifier`, `android.package`          | Ids of the existing store listings          | Needed before any build can receive an update [OD-12]                                                    |

### 12.4 Additions to `apps/mobile/eas.json`

| Field                                | Value                                                                          | Why                                                                                      |
| ------------------------------------ | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `build.development.environment`      | `"development"`                                                                | Ties the profile to the EAS environment whose variables it uses                          |
| `build.preview.environment`          | `"preview"`                                                                    | Same; `eas update --environment preview` then matches the build                          |
| `build.production.environment`       | `"production"`                                                                 | Same                                                                                     |
| `build.preview.autoIncrement`        | `true`                                                                         | Distinguishable internal builds. **Recommendation**                                      |
| `build.production.android.buildType` | `"app-bundle"`                                                                 | Play requires bundles; keeps the per-device download small. **Recommendation**           |
| `submit.production.ios` / `.android` | App Store Connect app id and Play track (`internal` first)                     | So `eas submit` is repeatable. Ids are identifiers, not secrets; credentials stay in EAS |
| `cli.version`                        | Raise the floor to ≥ 24.9.0 if `--force-end-active-rollout` is to be relied on | Section 5.2                                                                              |

### 12.5 Elsewhere

| Place                                       | Addition                                                                                                                                                                                                                                                                                                |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| EAS environments `preview` and `production` | `EXPO_PUBLIC_API_URL` and the other `EXPO_PUBLIC_` values listed in `.env.example`, per environment                                                                                                                                                                                                     |
| `.github/workflows/`                        | Release workflows: update on merge to `develop` (channel `preview`); update on approved merge to `production` (channel `production`, 10%); the fingerprint guard on pull requests. Workflow tokens stay least-privilege; `EXPO_TOKEN` and the signing key are environment-scoped secrets (GAP-STD19-02) |
| `apps/mobile/src`                           | An `updates` module: resume check, safe-reload rule, start-up report of update id and emergency launch; error boundary at the root                                                                                                                                                                      |
| `docs/USAGE.md`                             | The release commands, once the workflows exist                                                                                                                                                                                                                                                          |

## 13. Gaps raised

Dispositions are recorded in [1MM-LOG-03](../1MM-LOG-03-TECHNICAL-REFERENCE-EXTENSIONS.md)
(Technical Reference and schema), [1MM-LOG-02](../1MM-LOG-02-UI-UPDATES.md) (UI) and
[1MM-LOG-04](../1MM-LOG-04-OPEN-DECISIONS-AND-FOLLOW-UPS.md) (owner decisions and repository
follow-ups).

| Gap id       | Type     | Where found                                                       | What is missing or conflicting                                                                                                                                                                                                                  | Proposed resolution                                                                                                                                                                                                                                                                                                                                                                                                                           | Blocks                                      |
| ------------ | -------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| GAP-STD19-01 | REPO     | `apps/mobile/package.json`, `app.config.ts`, `eas.json`           | `expo-updates` is not installed; update behaviour, code signing, EAS environments per profile, submit settings and the store ids are not configured                                                                                             | Apply section 12.2 to 12.4 in MOD-00's mobile task (MOD-00-MOB-01, "EAS channels")                                                                                                                                                                                                                                                                                                                                                            | Any over-the-air update                     |
| GAP-STD19-02 | REPO     | `.github/workflows/` (only `ci.yml`), [TR §17.3]                  | No workflow publishes updates or builds; "staging on merge; production after approval" has no mobile implementation; no fingerprint guard                                                                                                       | Add the workflows in section 12.5 with a protected `production` environment and required reviewers                                                                                                                                                                                                                                                                                                                                            | Sections 3 and 5                            |
| GAP-STD19-03 | TR       | [TR §8.2] `GET /v1/config`, [SQL `devices`], [SQL `app_versions`] | The server knows a device's `app_version` only. It is not told the runtime version or the update id, so admins cannot see which update members run, and no admin-managed way exists to declare a published update too old (a "critical update") | Clients send `X-App-Version`, `X-App-Runtime-Version` and `X-App-Update-Id` on `GET /v1/config`; add `devices.update_id text` and `devices.runtime_version text`; add `remote_config` key `app.min_update_created_at` (public, JSON null = not set) that the app compares with the running update's creation time to trigger the critical-update path. DDL: `ALTER TABLE devices ADD COLUMN runtime_version text, ADD COLUMN update_id text;` | Section 8.1 critical update; A31 visibility |
| GAP-STD19-04 | DECISION | Expo plan terms vs [OD-06]                                        | Update code signing needs a paid Expo plan (Production or Enterprise); the hosting decision prefers free tiers                                                                                                                                  | Owner decides: pay for the plan before the first public build (recommended), or launch unsigned with the compensating controls in section 7 recorded as an accepted risk                                                                                                                                                                                                                                                                      | Section 7                                   |
| GAP-STD19-05 | TR       | [TR §5.1], [SQL `app_versions.runtime_version`]                   | The Technical Reference says "runtime-version pin" without naming the policy or how `runtime_version` relates to `latest`                                                                                                                       | Add to [TR §5.1]: policy `appVersion`; native changes raise `version`; `app_versions.runtime_version` equals the runtime of `latest`; updates are published only for runtimes at or above `min_supported`                                                                                                                                                                                                                                     | A31 form help text                          |

## Change log

| Version | Date        | Change      |
| ------- | ----------- | ----------- |
| v1.0    | 24 Nov 2026 | First issue |
