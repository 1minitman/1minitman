# 1MM-STD-03 · Mobile build strategy

|              |                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Document** | 1MM-STD-03                                                                                                                                                                                                                                                                                                                                                                                                                |
| **Status**   | Approved baseline · v1.0 · 24 Nov 2026                                                                                                                                                                                                                                                                                                                                                                                    |
| **Audience** | Engineers and coding agents                                                                                                                                                                                                                                                                                                                                                                                               |
| **Owner**    | Engineering lead (code owners)                                                                                                                                                                                                                                                                                                                                                                                            |
| **Sources**  | [TR §2.4], [TR §2.5], [TR §4.3], [TR §4.6], [TR §5.1], [TR §5.3], [TR §15], [TR §17.3], [BG §05], [BG §06], [BG §07], [BG §08], [BG §09], [BG §10], [BG §11], [BG §13], [BG §15], [BG §17], [BG §18], [TOK], [SQL], [INV], [CN onboarding-edge-rules], [CN sensory-system], [CN ES5 note], [OD-12]; repo: `apps/mobile`, `packages/ui-native`, `packages/tokens`; Expo SDK 58 reference (docs.expo.dev, read 24 Nov 2026) |
| **Related**  | [1MM-STD-01](1MM-STD-01-TESTING-STRATEGY.md) · [1MM-STD-04](1MM-STD-04-BRAND-GUIDE.md) · [1MM-STD-12](1MM-STD-12-DATA-HANDLING.md) · [1MM-STD-17](1MM-STD-17-LANGUAGE-CONFIGURATION.md) · [1MM-STD-18](1MM-STD-18-NOTIFICATIONS.md) · [1MM-STD-19](1MM-STD-19-OTA-UPDATES.md) · [1MM-STD-20](1MM-STD-20-DESIGN-SYSTEM.md) · [MOD-00](../execution/1MM-EXE-MOD-00-FOUNDATIONS.md)                                          |

**What this document is for and when to open it.** It fixes how every screen of `apps/mobile` is
laid out, sized, themed and tested so that it fits each class of phone and tablet on iOS and
Android. Open it before you build or review any mobile task (`MOD-nn-MOB-nn`): section 3 gives the
sizes, section 12 the test matrix that every mobile pull request must pass, and section 14 the
build profiles. Sizes the sources do not give are marked **Recommendation**.

## 1. Principles

1. **Tokens only.** Colour, type, spacing, radius, motion and sizes come from
   `packages/tokens/tokens.json` through the NativeWind preset. No raw hex value and no pixel font
   size in a component [BG §17].
2. **Lay out by window width, not by device name.** A layout asks "how wide is my window", never
   "is this an iPad". Split-screen, foldables and rotated tablets then work without special cases.
3. **One codebase, platform conventions kept.** Brand surfaces are flat Ink and Paper; native
   system components (sheets, tab bars, menus) may take the platform's look [BG §18].
4. **The floor device decides.** A 2 GB RAM Android phone on 3G must be usable [TR §5.3]. Anything
   that only works on a flagship is not done.
5. **Every swipe has a button; every state exists.** Buttons always work without swiping
   [TR §5.1]; every list has loading, empty, error and content states [TR §5.3].
6. **Accessibility is a release blocker**, not a backlog item [BG §13].

## 2. Supported platforms

| Item         | Value                                                                                                                                                                                   | Source                                |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Framework    | Expo SDK 58, React Native 0.88, New Architecture, Hermes, TypeScript strict                                                                                                             | `apps/mobile/package.json`, [TR §5.1] |
| Android      | Technical Reference: Android 9+. Expo SDK 58 itself supports Android 7+, compile SDK 37, target SDK 36                                                                                  | [TR §5.3]; Expo SDK 58 reference      |
| iOS          | iOS 16.4+. The Technical Reference said iOS 15+ until v3.6; **Expo SDK 58 requires iOS 16.4+**, so it was corrected (GAP-STD03-01, TRX-013)                                             | [TR §5.3]; Expo SDK 58 reference      |
| Floor device | 2 GB RAM Android phone, 3G, download under 30 MB, first useful screen under 2 s                                                                                                         | [TR §5.3], [TR §15.1]                 |
| Tablets      | Required by this standard (iPad and Android tablets). The scaffold disables them today (`ios.supportsTablet: false`, `orientation: 'portrait'`): GAP-STD03-02                           | `apps/mobile/app.config.ts`           |
| Stores       | App Store and Google Play; the listings and products already exist (live since 1 Jul 2026). `bundleIdentifier` and `package` are set to the existing listing ids before the first build | [OD-12], `app.config.ts` comments     |

## 3. Device classes and breakpoints

### 3.1 The classes

Widths are the **window** width in density-independent units (dp on Android, pt on iOS; the same
number React Native reports from `useWindowDimensions()`). The brand guide and tokens give two
breakpoints: 600 (`breakpoint.tablet`) and 1024 (`breakpoint.desktop`), with a phone grid below 600
and a tablet grid from 600 to 1023 [BG §07], [TOK]. The finer steps at 360, 400 and 840 are a
**Recommendation** (GAP-STD03-03 asks for them as tokens).

| Class          | Window width | Typical devices (portrait unless stated)                                                                                   | Basis                                  |
| -------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| `phone-small`  | 320–359      | Small or older Android phones; any phone with display zoom or a large system font and display size                         | **Recommendation**                     |
| `phone`        | 360–399      | Most Android phones (360), iPhone SE (375), iPhone 16 (393)                                                                | **Recommendation**                     |
| `phone-large`  | 400–599      | Pixel 9 (412), Galaxy S Ultra (412), iPhone Pro Max (440), foldable cover screens, phones in landscape                     | **Recommendation**                     |
| `tablet-small` | 600–839      | Foldables unfolded, 7 to 8 inch Android tablets, iPad mini (744), iPad 11 inch portrait (820–834), tablets in split-screen | 600 from [TOK]; 840 **Recommendation** |
| `tablet-large` | 840–1023     | 10 to 11 inch Android tablets in portrait, large foldables in landscape                                                    | **Recommendation**                     |
| `tablet-wide`  | ≥ 1024       | iPad 13 inch portrait (1024–1032), every 10 inch or larger tablet in landscape                                             | 1024 from [TOK]                        |

Device names are examples for orientation only; code never branches on them.

### 3.2 What changes at each class

| Property                                             | `phone-small`                                                          | `phone`     | `phone-large` | `tablet-small`                                             | `tablet-large`                             | `tablet-wide`                                | Basis                                                                           |
| ---------------------------------------------------- | ---------------------------------------------------------------------- | ----------- | ------------- | ---------------------------------------------------------- | ------------------------------------------ | -------------------------------------------- | ------------------------------------------------------------------------------- |
| Grid columns                                         | 4                                                                      | 4           | 4             | 8                                                          | 8                                          | 12                                           | [BG §07] (12 columns is the ≥ 1024 grid)                                        |
| Side gutter and margin                               | 16 (`size.screen-gutter`)                                              | 16          | 16            | 24                                                         | 24                                         | 24                                           | [BG §07], [TOK]                                                                 |
| Content max width (reading, lists, settings)         | full                                                                   | full        | full          | 640                                                        | 640                                        | 640                                          | **Recommendation**, from the 640 form rule                                      |
| Form max width                                       | full                                                                   | full        | full          | 640                                                        | 640                                        | 640                                          | [BG §07]                                                                        |
| Primary button                                       | full width, in the bottom third                                        | same        | same          | max 400, centred under the form                            | same                                       | same                                         | [BG §07]; 400 is a **Recommendation**                                           |
| Deck card (D1), 3:4 photo frame                      | width = window − 32; height capped so the reaction bar stays on screen | same        | same          | max width 480, centred                                     | max width 480                              | card (max 480) and details pane side by side | 3:4 from [BG §09]; side by side at ≥ 1024 from [BG §07]; 480 **Recommendation** |
| Grid lists (Likes D7, groups D12, photo grids)       | 2 columns                                                              | 2           | 2             | 3                                                          | 4                                          | 4                                            | **Recommendation**                                                              |
| Chats (D8 list, D9 thread)                           | one pane                                                               | one pane    | one pane      | one pane                                                   | list (320–360) + thread                    | list (360) + thread                          | **Recommendation**                                                              |
| Main navigation                                      | bottom tab bar, 56 high, 5 items                                       | same        | same          | bottom tab bar                                             | side rail, 80 wide, same 5 items and order | side rail                                    | 56 and 5 items from [TOK]; rail **Recommendation**                              |
| Drawer D3                                            | overlay                                                                | overlay     | overlay       | overlay, max 360                                           | overlay, max 360                           | overlay, max 360                             | **Recommendation**                                                              |
| Sheets (D2, D1·F, H4, confirm sheets, OB2)           | bottom sheet, top corners `radius.sheet` (16)                          | same        | same          | centred sheet, max width 560, max height 85% of the window | same                                       | same                                         | bottom sheet and 16 from [BG §07], [BG §11]; centred form **Recommendation**    |
| Full-screen modals (camera, liveness, call, payment) | full screen                                                            | full screen | full screen   | full screen                                                | full screen                                | full screen                                  | [TR §5.1]                                                                       |
| Toasts (Undo)                                        | above the tab bar, full width − 32                                     | same        | same          | max 480, bottom centre                                     | same, clear of the rail                    | same                                         | 4 px radius [BG §07]; widths **Recommendation**                                 |
| Type scale                                           | unchanged in every class: 12 · 14 · 16 · 17 · 20 · 24 · 32 · 40        |             |               |                                                            |                                            |                                              | [TOK `typography.scale`]                                                        |
| Touch target                                         | ≥ 44 × 44 in every class                                               |             |               |                                                            |                                            |                                              | [TOK `size.touch-min`]                                                          |

Rules that go with the table:

1. **Tablets are not stretched phones.** From 600 up, content is centred in a column with the
   maximum widths above; the area outside the column takes the `bg` colour, never a second copy of
   the content.
2. **`phone-small` must fit without horizontal scrolling.** Rows of three reaction buttons
   (`size.reaction` 60), the five tab items and two-button footers are checked at 320. If a row does
   not fit, the gap shrinks to `space.2` (8) before anything else changes; target sizes never go
   below 44.
3. **Two-pane layouts keep one route tree.** The thread route (`app/chat/[id].tsx`) stays the
   source of truth; on wide classes the list is rendered beside it by the layout. Deep links
   ([1MM-STD-18](1MM-STD-18-NOTIFICATIONS.md)) work the same in every class.
4. **The boards show phones only.** No tablet, landscape or foldable board exists for any of the
   154 screens: the inventory's preview levers are theme, state and platform, never size [INV].
   Until GAP-STD03-04 is answered, tablets use the rules in this section, and each module records
   its tablet behaviour in its "Phone and tablet" line.

### 3.3 Orientation

| Class                                       | Portrait  | Landscape                                                                | Basis                                                                                               |
| ------------------------------------------- | --------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Phones (window width under 600 in portrait) | Supported | Locked to portrait, except full-screen media and calls, which may rotate | The scaffold is portrait only (`app.config.ts`); media exception **Decided** (DEC-005, 26 Nov 2026) |
| Tablets and unfolded foldables              | Supported | Supported; the class is recomputed from the new width                    | **Recommendation**; needs GAP-STD03-02                                                              |

A fold, unfold, rotation or split-screen resize must keep the screen, its scroll position, typed
text and any running timer (the 1-Minute ring keeps counting from the server's time). This is a
required test case (section 12).

### 3.4 How it is implemented

- One hook in `packages/ui-native`, `useDeviceClass()`, returns the class from
  `useWindowDimensions().width`. One layout component, `Screen`, applies safe areas, gutter and the
  content max width. Screens do not compute widths themselves. Both are additions to the package
  (GAP-STD03-05).
- NativeWind breakpoints come from the tokens preset (`sm` = 600, `md` = 1024 today, in
  `packages/tokens/build.mjs`). Responsive class names (`sm:px-6`) are used for spacing and
  columns; structural changes (rail instead of tab bar, two panes) use the hook.
- Never read `Dimensions.get('screen')`, the device model or `Platform.isPad` to choose a layout.

## 4. Safe areas, cut-outs, gesture bars and the keyboard

| Topic                             | Rule                                                                                                                                                                                                                                                                                                                                   |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Safe areas                        | `SafeAreaProvider` wraps the app (`src/providers/app-providers.tsx`). Every screen takes its insets from `react-native-safe-area-context` through the `Screen` component; no hard-coded status-bar or home-indicator heights.                                                                                                          |
| Notch, Dynamic Island, punch-hole | Content and controls stay inside the top inset. Full-bleed photos may run under it with a scrim behind any text [BG §13].                                                                                                                                                                                                              |
| Landscape cut-outs                | Left and right insets are honoured on tablets and rotated media.                                                                                                                                                                                                                                                                       |
| Gesture bar and home indicator    | Bottom-anchored buttons add the bottom inset to their padding. The tab bar's 56 height excludes the inset. Nothing tappable sits in the system gesture zone at the very bottom edge.                                                                                                                                                   |
| Android edge-to-edge              | The app draws behind the status and navigation bars and pads with insets; the bars are transparent and their icon colour follows the theme. Android 15 and later enforce this for apps targeting it, and SDK 58 targets API 36. **Recommendation:** build every screen edge-to-edge from the start.                                    |
| Android back gesture              | Side-edge swipes belong to the system. Horizontal carousels and the deck leave a 16 dp dead zone at each edge or rely on buttons.                                                                                                                                                                                                      |
| Keyboard                          | Inputs are never hidden: forms scroll the focused field into view; a bottom primary button moves above the keyboard; chat composers stick to the keyboard. Tapping outside dismisses. The keyboard type, `autoComplete` and `textContentType` match the field (`one-time-code` on iOS and SMS Retriever on Android for OTP [TR §5.1]). |
| Input text size                   | Never below 16 px, which also stops iOS zooming into the field [BG §06].                                                                                                                                                                                                                                                               |
| Hardware keyboard (tablets)       | Tab order follows reading order; Return submits a single-field form; Escape closes a sheet. **Recommendation.**                                                                                                                                                                                                                        |
| Secure screens                    | Liveness and payment screens set `FLAG_SECURE` on Android [TR §5.1].                                                                                                                                                                                                                                                                   |

## 5. iOS and Android differences

| Topic                       | iOS                                                                           | Android                                                                                                       | Shared rule                                                                                                                                                                               |
| --------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Navigation                  | Stack with edge-swipe back                                                    | Stack with system back (button or gesture)                                                                    | Expo Router; tabs My Specs · Likes · Chats · Groups · Profile; drawer D3; sheets [TR §5.1]                                                                                                |
| Back                        | Swipe from the left edge; a visible back control on every pushed screen       | System back must do exactly what the visible back control does; on a tab root it leaves the app               | Blocking states (OB1 Required, H6, AS1) cannot be backed out of. A dirty form asks before discarding                                                                                      |
| Sheets                      | Native sheet presentation                                                     | Bottom sheet with scrim; system back closes it                                                                | 16 px top corners; confirm sheets name the destructive action exactly [BG §11]                                                                                                            |
| Haptics                     | Taptic engine                                                                 | Vibrator; weaker or absent on low-end devices                                                                 | `useHaptic(kind)` only (`src/lib/haptics.ts`); never the only feedback [TR §2.5]                                                                                                          |
| Permissions                 | One system prompt per permission; after a refusal only Settings can change it | Runtime prompts; "Don't ask again" after refusals; notification permission is a runtime prompt on Android 13+ | Always a primer screen first, in context (C6 location, C7 notifications); "Open settings" uses `Linking.openSettings()` [CN onboarding-edge-rules]                                        |
| Location                    | May grant approximate only                                                    | May grant approximate only                                                                                    | OB3 handles denied, revoked and approximate [CN onboarding-edge-rules]                                                                                                                    |
| Fonts                       | Manrope bundled                                                               | Manrope bundled                                                                                               | Four weights loaded in `src/providers/fonts.ts`; on native each weight is its own family (`font-body`, `font-caption`, `font-title`, `font-display`); the splash is held until fonts load |
| Font scaling                | Dynamic Type                                                                  | Font size and display size settings                                                                           | Section 7                                                                                                                                                                                 |
| Status bar                  | Text colour follows the theme                                                 | Same, plus the navigation bar                                                                                 | `<StatusBar style="auto" />` in the root layout                                                                                                                                           |
| Edge-to-edge                | Always                                                                        | Section 4                                                                                                     | Insets from the safe-area context                                                                                                                                                         |
| Payments                    | App Store sheet                                                               | Google Play sheet                                                                                             | RevenueCat; the pay step has a platform switch [TR §4.6]                                                                                                                                  |
| OTP auto-fill               | `one-time-code`                                                               | SMS Retriever                                                                                                 | [TR §5.1]                                                                                                                                                                                 |
| Device integrity            | App Attest                                                                    | Play Integrity                                                                                                | At sign-up, login and payment [TR §5.1]                                                                                                                                                   |
| Touch target                | 44 pt                                                                         | 44 dp minimum, 48 dp preferred                                                                                | [BG §13]                                                                                                                                                                                  |
| Switches and system pickers | Platform look                                                                 | Platform look                                                                                                 | Toggles follow the platform [BG §07]                                                                                                                                                      |
| OB1 store button            | App Store URL                                                                 | Google Play URL                                                                                               | `app_versions.store_url` per platform [SQL]                                                                                                                                               |

Use `Platform.select` only for the differences in this table. A new platform branch is recorded in
the pull request with the reason.

## 6. Tokens every screen uses

Values are from `packages/tokens/tokens.json` (the repo copy of [TOK]).

| Group                  | Tokens                                                                                                                                                                                  | Rule                                                                                                                                                                            |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Spacing (4-point grid) | `space.0` 0 · `1` 4 · `2` 8 · `3` 12 · `4` 16 · `5` 20 · `6` 24 · `8` 32 · `10` 40 · `12` 48 · `16` 64 · `20` 80 · `24` 96                                                              | Only these steps. 16 is the phone gutter; 32 to 48 separate sections on a screen [BG §07]                                                                                       |
| Type scale             | `display` 40/44 · `h1` 32/38 · `h2` 24/30 · `h3` 20/26 · `title` 17/24 · `body` 16/24 · `body-sm` 14/20 · `caption` 12/16 · `label` 12/16 caps                                          | Manrope only. Screen titles are `h1`. Nothing below 12. Body never below 16, secondary never below 14 [BG §06]. Use `<Text variant>` from `packages/ui-native`, not raw classes |
| Radius                 | `radius.sm` 4 (default) · `radius.md` 8 (menus, tooltips only) · `radius.sheet` 16 (sheet top corners) · `radius.full` (avatars, tier rings, the 1-Minute ring, round reaction buttons) | Circles are for people and rings only [BG §07]                                                                                                                                  |
| Borders                | hairline 1 · control 1.5 · focus 2                                                                                                                                                      | Depth comes from borders and surfaces; only two shadows exist (menu, sheet) [BG §07]                                                                                            |
| Sizes                  | `size.touch-min` 44 · `button-height` 48 · `input-height` 48 · `reaction` 60 · `tabbar-height` 56 · `icon` 24 · `screen-gutter` 16 · `tabbar-items` 5                                   | Small chips, links and Undo keep their look and get an invisible 44 hit area (`hitSlop`), with 8 between targets [BG §13]                                                       |
| Icons                  | Feather through `@expo/vector-icons`; 24 px grid, 2 px stroke; sizes 16, 20, 24, 32                                                                                                     | Outline = available, filled = active. No emoji in UI chrome [BG §08]                                                                                                            |
| Motion                 | `fast` 150 ms · `base` 200 ms · `slow` 250 ms · `intro` 60 s (linear) · `undo-toast` 6 s; easing `standard` (0.2, 0, 0, 1), `exit` (0.4, 0, 1, 1)                                       | No bounce, no spring overshoot, no parallax [TOK]                                                                                                                               |
| Themes                 | `theme.light.*`, `theme.dark.*` semantic colours; `tier.*` ring colours                                                                                                                 | Semantic classes only (`bg-bg`, `text-fg`, `text-fg-2`, `border-border`)                                                                                                        |

## 7. Text size, themes, motion, screen readers, contrast

### 7.1 Dynamic type and font scaling

- Text follows the system text size up to 200% without clipping; layouts reflow, they do not
  truncate [TR §2.4], [BG §06]. `<Text>` in `packages/ui-native` sets `maxFontSizeMultiplier={2}`;
  never set `allowFontScaling={false}`.
- Fixed-height containers that hold text use `min-h-*`, not `h-*`. Buttons grow in height; rows
  wrap; a row of two buttons stacks when it no longer fits.
- **Recommendation:** elements with no room to grow (tab bar labels, the countdown number inside
  the ring, badges on avatars) cap at 1.3× and must have an accessible label carrying the full
  text. The tab bar label is set through navigation options today (`(tabs)/_layout.tsx`), so the cap
  is applied there.
- Android "display size" changes the dp width: a 360 dp phone at the largest display size becomes
  `phone-small`. Test it (section 12).

### 7.2 Themes

- Light and dark, chosen by `user_settings.theme` (`system`, `light`, `dark`) [SQL]; `system`
  follows the device (`userInterfaceStyle: 'automatic'`). `ThemeProvider` in `packages/ui-native`
  turns the token themes into CSS variables; APIs that cannot take a class use `useThemeColor()`.
  The provider follows the device only today; honouring the member's stored choice is part of the
  settings work in MOD-03.
- Every screen is built and reviewed in both themes. Illustrations follow the dark-theme plate rule
  [BG §09]. The splash has a light and a dark variant (`app.config.ts`).
- The tokens also define `theme.oled.*` as an optional theme [BG §05]. `theme_t` has no value for
  it [SQL], so it is not offered in v1.

### 7.3 Reduced motion

`user_settings.reduce_motion` overrides the system setting; `NULL` follows the system [SQL]. With
reduced motion on: transitions become a 150 ms cross-fade, the 1-Minute ring counts down as a
number in 10 s steps, the match animation shows its final frame, skeletons stop pulsing [TOK
`motion.reduced.*`], [BG §10]. One hook, `useReducedMotion()`, is the only place this is decided
(GAP-STD03-05).

### 7.4 Screen readers (VoiceOver and TalkBack)

1. Real controls only: `Pressable` with `accessibilityRole` (button, link, switch, radio,
   checkbox) and state. Never a tappable `View` without a role [TR §2.4].
2. Icon buttons are labelled in context: "Like Amaka", "Block Tunde", not "heart" [TR §2.4].
3. A card or list row that acts as one thing is one focus stop with the full sentence; decorative
   images are hidden from the reader.
4. Photos get automatic alternative text ("Photo 2 of 6 of Amaka") plus the member's caption
   [BG §13].
5. Match, timer and toast events are announced politely (`AccessibilityInfo.announceForAccessibility`
   or a live region); the remaining time of the 1-Minute ring is also available as text [BG §10],
   [BG §13].
6. Focus moves to the title of a new screen or sheet and returns to the opener when a sheet closes.
7. Every swipe has a button; the 1-Minute Intro can be extended or switched to an untimed first
   message in accessibility settings [BG §13].
8. Each screen root carries the design's hooks as `testID` (`data-screen`, `data-route`,
   `data-testid`) [TR §2.4]. `Button` in `packages/ui-native` requires a `testID`.
9. Text in another language is tagged with its language so it is pronounced correctly [BG §13]
   (`accessibilityLanguage` on iOS; see [1MM-STD-17](1MM-STD-17-LANGUAGE-CONFIGURATION.md)).

### 7.5 Contrast

Body text ≥ 7:1, secondary text ≥ 4.5:1, UI graphics (controls, borders, focus, tier rings) ≥ 3:1.
Colour is never the only signal: tier rings always carry the plan name; errors carry an icon and
text [TR §2.4], [BG §13]. Text on photos always sits on a scrim. The semantic tokens already meet
these ratios; a component that mixes its own colours is rejected in review.

## 8. The sensory system

| Tag (`data-haptic`) | Used on                                                | Call                                  | Source           |
| ------------------- | ------------------------------------------------------ | ------------------------------------- | ---------------- |
| `selection`         | Tabs, chips, Undo                                      | `selectionAsync()`                    | [TR §2.5]        |
| `light`             | Pass, Somewhat                                         | `impactAsync(Light)`                  | [TR §2.5]        |
| `medium`            | Like                                                   | `impactAsync(Medium)`                 | [TR §2.5]        |
| `success`           | Match (D5), Black Badge approved                       | `notificationAsync(Success)`          | [TR §2.5]        |
| `double-soft`       | 10 s left on the ring (A3, MF2, MF4)                   | two `impactAsync(Soft)`, 120 ms apart | [TR §2.5], [TOK] |
| `warning`           | Confirm on Unmatch, Block, Delete account, Leave group | `notificationAsync(Warning)`          | [TR §2.5]        |
| `error`             | Only when something failed                             | `notificationAsync(Error)`            | [TR §2.5]        |

- **Haptics.** Call `useHaptic(kind)`; never call `expo-haptics` directly. The hook must respect
  `user_settings.haptics_enabled` (default on) [TR §2.5], [SQL]; the scaffold's hook does not yet
  (noted in `src/lib/haptics.ts`; wired with the settings work in MOD-03). Haptics never carry
  meaning on their own [BG §10].
- **Sound.** Off by default (`user_settings.sounds_enabled` false). Only `match-chime` (D5) and
  `call-start` (MF4) exist [TR §2.5]. Sound respects the device's silent switch.
- **Motion.** 150 to 250 ms, ease-out. The only loops are skeletons, spinners and the countdown
  ring; nothing flashes more than three times a second [TR §2.5], [BG §10]. The ring animates on
  the UI thread with Reanimated [TR §15.2].
- A screen is not done until its haptic and sensory tags are implemented [TR §17.3].

## 9. Performance, slow networks and offline

### 9.1 Budgets

| Measure                                         | Budget                              | Source     |
| ----------------------------------------------- | ----------------------------------- | ---------- |
| Cold start to first useful screen, 2 GB Android | < 2 s                               | [TR §15.1] |
| App download size                               | < 30 MB                             | [TR §15.1] |
| Deck card                                       | 60 fps; next card visible instantly | [TR §15.1] |
| Card photo                                      | < 80 KB, AVIF or WebP               | [TR §15.1] |
| Transitions                                     | 150–250 ms                          | [TR §15.1] |
| API seen from Lagos on 4G (p95)                 | reads < 450 ms, writes < 650 ms     | [TR §15.1] |
| Network floor                                   | Usable on 3G; data-saver mode       | [TR §15.1] |
| Skeletons                                       | Shown only after 300 ms             | [TR §5.3]  |

### 9.2 Techniques (required)

| Area            | Rule                                                                                                                                                                                             | Source                          |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------- |
| Start-up        | Hermes; camera, liveness and calls are lazy-loaded and never imported by the root layout                                                                                                         | [TR §15.2]                      |
| Lists           | FlashList for every list that can exceed one screen; memoised rows; stable keys                                                                                                                  | [TR §5.1], [TR §15.2]           |
| Deck            | Prefetch the next 10 cards and their main photos; a swipe never waits on the network                                                                                                             | [TR §5.3]                       |
| Images          | `expo-image` with disk cache; AVIF or WebP variants requested at the rendered size for the device class and pixel density; never the original. Variants are served by short-lived presigned URLs | [TR §5.1], [TR §4.3]            |
| Data saver      | `user_settings.data_saver`: extra photos load only on tap; no clip autoplay                                                                                                                      | [TR §5.3], [SQL]                |
| Requests        | Batched on resume; TanStack Query cache; no polling where a socket event exists                                                                                                                  | [TR §15.2]                      |
| Uploads         | Straight to R2 through presigned URLs, in the background; the app never holds cloud keys                                                                                                         | [TR §5.3]                       |
| Video and audio | `expo-video` (HLS for clips), `expo-audio` (Opus voice ≤ 20 s); no autoplay with sound                                                                                                           | [TR §5.1], [TR §15.2], [BG §13] |
| Memory          | **Recommendation:** on the floor device keep at most 3 full-size photos decoded at once; release camera and video players when their screen loses focus                                          | –                               |
| Bundle          | **Recommendation:** CI records the download size per platform on every `preview` build and fails over 30 MB                                                                                      | [TR §15.1]                      |

### 9.3 Offline and the outbox

| Behaviour                   | Rule                                                                                                                | Source                                    |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Detection                   | NetInfo drives the ES5 banner in the root layout (states Offline, Back online)                                      | [CN ES5 note], [INV ES5]                  |
| What is queued              | Reactions, reads and status changes go into an outbox persisted in MMKV and replay in order on reconnect            | [CN ES5 note], [TR §5.1]                  |
| Idempotency                 | Every queued item carries a client-generated id, so a replay never doubles a reaction                               | [TR §5.3]                                 |
| Messages                    | Never queued silently: a message that cannot be sent shows as failed (ES6) with "tap to retry" and "Delete message" | [CN ES5 note], [INV ES6]                  |
| Cached content              | The last fetch, up to 20 cards; lists show their last loaded data with the offline banner                           | [CN ES5 note]                             |
| Writes that need the server | Payments, verification and settings switches are disabled offline with the reason shown                             | **Recommendation**                        |
| Replay failures             | A queued item the server refuses (4xx) is dropped and the affected screen refreshes; it is never retried forever    | **Recommendation**                        |
| Sign-out                    | Clears the outbox and every cache                                                                                   | [1MM-STD-12](1MM-STD-12-DATA-HANDLING.md) |

Refresh tokens live only in `expo-secure-store` [TR §5.1]; nothing sensitive goes into MMKV.

## 10. NativeWind and `packages/ui-native`

1. **Shared components first.** Use `Text`, `Button`, `EmptyState`, `ThemeProvider`, `useScheme`,
   `useThemeColor` from `@1minitman/ui-native`. A component used by two screens moves into the
   package. Every new shared component ships with both themes, 200% text, a `testID` prop and an
   accessible name.
2. **Tailwind config is closed.** `apps/mobile/tailwind.config.js` takes colours, radius, spacing
   and type sizes from `@1minitman/tokens/tailwind-preset` and adds only the font families. Add
   nothing by hand; a missing value is a token change.
3. **Semantic colour classes only**: `bg-bg`, `bg-surface`, `text-fg`, `text-fg-2`, `text-fg-3`,
   `border-border`, `bg-inverse-bg`, `text-inverse-fg`, the signal colours and tier colours. No
   palette class (`n500`) in a screen, no `dark:` variant: the theme variables switch.
4. **No arbitrary values** (`w-[137px]`, `text-[13px]`, `#hex`) in screens. The line-height and
   letter-spacing brackets inside `packages/ui-native/src/text.tsx` are the one sanctioned
   exception, because they encode the type tokens.
5. **Type through `<Text variant>`**, never a raw `react-native` `Text` with size classes.
6. **Sizing classes:** `h-12` (48) for buttons and inputs, `min-w-touch` / `min-h-touch` (44) for
   targets, `px-4` (16) for the phone gutter, `sm:px-6` (24) from 600 up.
7. **Class names are static strings.** Build variants with a lookup object (as `text.tsx` does),
   not string concatenation of partial class names, so NativeWind can see them. Both `./src` and
   `packages/ui-native/src` are in the Tailwind `content` list.
8. **`style` is for values that cannot be classes**: safe-area insets, animated values, measured
   sizes. Colours passed to native APIs come from `useThemeColor()`.
9. **Every visible string comes from `packages/i18n`** through the translator for the member's
   locale ([1MM-STD-17](1MM-STD-17-LANGUAGE-CONFIGURATION.md)). No literal copy in a component.

## 11. Ease of use, usability and flexibility

- One primary button per screen, 48 high, full width on phones, in the bottom third for one-handed
  use [BG §07], [BG §11].
- Disabled buttons say why nearby; loading keeps the label and adds a spinner so the width does not
  jump [BG §11].
- Destructive actions confirm in a sheet and, where possible, offer Undo (Pass: 6 s toast) [BG §11].
- Errors say what happened and how to fix it; never only "Something went wrong" [BG §15]. Messages
  come from `error.<reason>` keys ([1MM-STD-13](1MM-STD-13-ERROR-CODES.md)).
- Every step is resumable: onboarding saves each step to the server and reopens at
  `users.onboarding_step` [TR §5.3]; drafts are kept.
- No time limits on reading except the 1-Minute Intro [BG §13].
- Limits, option lists, labels and timers are never literals: they come from the config bootstrap,
  catalogues, entitlements and the i18n catalogue (owner rule 4; [MOD-02](../execution/1MM-EXE-MOD-02-PLATFORM-CONFIG-AND-CATALOGUES.md)).
- Layouts tolerate longer text (Naijá and French run longer than English), larger text and
  narrower windows at the same time; see the expansion rules in
  [1MM-STD-17](1MM-STD-17-LANGUAGE-CONFIGURATION.md).
- Pull to refresh on every list; scroll position is kept when returning to a list.

## 12. Mandatory test matrix

Every mobile implementation (each `MOD-nn-MOB-nn` task and every later change to a screen) is run
on **at least one iOS phone, one Android phone and one tablet** before review. The named devices
are a **Recommendation**; a substitute must be in the same class and is named in the pull request.

### 12.1 Reference devices

| #   | Slot           | Reference                                                                                                         | Class                          | Required                                                                                                             |
| --- | -------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| 1   | iOS phone      | iPhone 16 simulator (393 pt), current iOS                                                                         | `phone`                        | Every task                                                                                                           |
| 2   | Android phone  | Pixel 9 emulator (412 dp), API 36                                                                                 | `phone-large`                  | Every task                                                                                                           |
| 3   | Tablet         | iPad (A16) 11 inch simulator, portrait and landscape                                                              | `tablet-small` / `tablet-wide` | Every task                                                                                                           |
| 4   | Small phone    | iPhone SE (3rd generation) simulator (375 pt), plus an Android emulator profile at 320 dp                         | `phone` / `phone-small`        | Every task that adds or changes a layout                                                                             |
| 5   | Floor device   | A real Android phone with 2 GB RAM on Android 9 (or an emulator set to 2 GB RAM, API 28), network throttled to 3G | `phone`                        | Every module exit gate; every list, deck, media or start-up change                                                   |
| 6   | Android tablet | Pixel Tablet emulator, portrait and landscape                                                                     | `tablet-large` / `tablet-wide` | Every module exit gate                                                                                               |
| 7   | Foldable       | Pixel 9 Pro Fold emulator, folded and unfolded                                                                    | `phone` ↔ `tablet-small`       | Every module exit gate                                                                                               |
| 8   | Real devices   | One real iPhone and one real Android phone                                                                        | –                              | Anything a simulator cannot prove: push, haptics, camera, liveness, payments, biometrics, OTP auto-fill, performance |

### 12.2 What is checked on each

| Check                                                                                        | iOS phone                   | Android phone                                          | Tablet                                           |
| -------------------------------------------------------------------------------------------- | --------------------------- | ------------------------------------------------------ | ------------------------------------------------ |
| Layout matches the board in light and dark                                                   | ✓                           | ✓                                                      | Follows section 3; no stretched phone layout     |
| Safe areas: notch or island, home indicator                                                  | ✓                           | Status bar, gesture bar and 3-button bar, edge-to-edge | Both orientations                                |
| Back behaviour                                                                               | Edge swipe and back control | System back, on every pushed screen and sheet          | Same as its platform                             |
| Keyboard does not hide the field or the primary button                                       | ✓                           | ✓                                                      | With the on-screen keyboard, floating and docked |
| Text at 200% (and the largest display size on Android): nothing clipped, nothing unreachable | ✓                           | ✓                                                      | ✓                                                |
| Screen reader pass: order, labels, state, announcements                                      | VoiceOver                   | TalkBack                                               | The platform's reader                            |
| Reduced motion on                                                                            | ✓                           | ✓                                                      | ✓                                                |
| Touch targets ≥ 44 and 8 apart                                                               | ✓                           | ✓                                                      | ✓                                                |
| States: loading (skeleton after 300 ms), empty, error, offline, restricted                   | ✓                           | ✓                                                      | ✓                                                |
| Offline and back online; outbox replay                                                       | ✓                           | ✓                                                      | –                                                |
| Haptic tags fire and respect the setting                                                     | Real device                 | Real device                                            | –                                                |
| Rotation, split-screen, fold and unfold keep state                                           | –                           | Foldable, at exit gate                                 | ✓                                                |
| Locales `en` and `pcm` (and `fr` when `locale.fr` is on); longest strings                    | ✓                           | ✓                                                      | ✓                                                |
| Performance budgets (section 9.1)                                                            | –                           | Floor device                                           | –                                                |
| Deep links from a push open the right screen                                                 | Real device                 | Real device                                            | Two-pane layouts open the right pane             |

### 12.3 Automation and evidence

- Maestro end-to-end flows use the `testID` hooks and run on one iOS and one Android target in CI;
  an accessibility check runs on the Maestro flows [TR §2.4], [TR §17.3]. Flow design is in
  [1MM-STD-01](1MM-STD-01-TESTING-STRATEGY.md).
- The brand guide names `eslint-plugin-react-native-a11y` for mobile CI [BG §13]; the repo's ESLint
  setup does not include it yet (GAP-STD03-06).
- The pull request lists the devices used and attaches a light and a dark screenshot per class
  touched. A task with no tablet evidence is not reviewed.
- VoiceOver and TalkBack passes are manual for each release [BG §13].

## 13. Definition of done for a mobile task

1. The module's API gate is green; the screen uses the generated client only (owner rule 1).
2. Every string, limit and option comes from the catalogue or config; none is a literal.
3. All states exist; skeletons appear only after 300 ms.
4. Tokens only; both themes; 200% text; reduced motion; screen-reader labels; `testID` hooks.
5. Haptic and sound tags implemented through the hooks.
6. Phone-small to tablet-wide behaviour implemented per section 3 and recorded in the module.
7. The matrix in section 12 passed, with evidence in the pull request.
8. Analytics events present under the naming rule (MOD-18 owns the catalogue).

## 14. EAS build profiles and store targets

`apps/mobile/eas.json` as scaffolded (`cli.version` ≥ 16.0.0, `appVersionSource: remote`):

| Profile       | Distribution                 | Channel       | `APP_ENV`    | Use                                                                                                                 |
| ------------- | ---------------------------- | ------------- | ------------ | ------------------------------------------------------------------------------------------------------------------- |
| `development` | internal, development client | `development` | `dev`        | Engineers' devices and simulators with a dev client; needed as soon as a feature uses custom native code (USAGE §7) |
| `preview`     | internal                     | `preview`     | `staging`    | Release candidates and usability builds against staging; built from `develop`                                       |
| `production`  | store (`autoIncrement` on)   | `production`  | `production` | Store releases; built from `production`; submitted with `eas submit` (`submit.production`)                          |

| Topic              | Rule                                                                                                                                                                                                                                   |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Branch mapping     | `develop` → `preview` profile and channel (staging); `production` → `production` profile and channel. Details and the over-the-air rules are in [1MM-STD-19](1MM-STD-19-OTA-UPDATES.md)                                                |
| App identity       | `name` 1minitman, `slug` 1minitman, `owner` minitnetwork, scheme `oneminitman`, EAS project id in `extra.eas.projectId` (public identifier). `ios.bundleIdentifier` and `android.package` are the ids of the existing listings [OD-12] |
| Versions           | `version` in `app.config.ts` is the member-visible version and, through `runtimeVersion: { policy: 'appVersion' }`, the runtime version. Build numbers are managed by EAS (`appVersionSource: remote`, `autoIncrement`)                |
| Environment values | Only `EXPO_PUBLIC_` names reach the app and all of them are public; `src/lib/env.ts` validates them at boot. Hosted values are set in EAS, never in files                                                                              |
| Secrets            | `EXPO_TOKEN` (robot user) lets EAS run locally and in CI; store credentials are held by EAS                                                                                                                                            |
| Running EAS        | `pnpm --filter @1minitman/mobile eas <command>`                                                                                                                                                                                        |
| iOS target         | App Store, iPhone and iPad (after GAP-STD03-02); TestFlight for `production` builds before release                                                                                                                                     |
| Android target     | Google Play, phones and tablets; internal testing track before staged rollout. **Recommendation:** ship Android App Bundles so the per-device download stays under 30 MB                                                               |
| Staged rollout     | Store releases roll out in stages [TR §5.1], [TR §17.3]; the OB1 version gate (admin-managed `app_versions`) forces or recommends updates                                                                                              |
| Store review       | Screenshots are needed for phone and tablet sizes once tablets are supported; they come from the test matrix devices                                                                                                                   |

## 15. Gaps raised

Dispositions are recorded in [1MM-LOG-03](../1MM-LOG-03-TECHNICAL-REFERENCE-EXTENSIONS.md)
(Technical Reference and schema), [1MM-LOG-02](../1MM-LOG-02-UI-UPDATES.md) (UI) and
[1MM-LOG-04](../1MM-LOG-04-OPEN-DECISIONS-AND-FOLLOW-UPS.md) (owner decisions and repository
follow-ups).

| Gap id       | Type     | Where found                                                                       | What is missing or conflicting                                                                                                                                                                                                                            | Proposed resolution                                                                                                                                                                                                                                                                     | Blocks                                       |
| ------------ | -------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| GAP-STD03-01 | TR       | [TR §5.3] vs Expo SDK 58 reference                                                | The Technical Reference requires iOS 15+; Expo SDK 58 (in the repo) supports iOS 16.4 and later only                                                                                                                                                      | Correct [TR §5.3] to "Android 9+ and iOS 16.4+" and set `app_versions.min_os_version` to match; the Android floor stays at 9                                                                                                                                                            | Store listing minimums, OB1 `min_os_version` |
| GAP-STD03-02 | REPO     | `apps/mobile/app.config.ts`                                                       | `ios.supportsTablet: false` and `orientation: 'portrait'` exclude iPads and tablet landscape, while tablets are a required target                                                                                                                         | Set `ios.supportsTablet: true`; set `orientation: 'default'` and lock phones to portrait at runtime (for example with `expo-screen-orientation`); confirm large-screen behaviour on Android against the Expo documentation when the change is made                                      | Section 3.3, tablet test slot                |
| GAP-STD03-03 | REPO     | `packages/tokens/tokens.json` ([TOK] `breakpoint.*`), `packages/tokens/build.mjs` | Only `breakpoint.tablet` (600), `desktop` (1024) and `max` (1200) exist; the preset exposes `sm` and `md` only. No token for small phones, large phones or large tablets, and none for the tablet gutter (24), the form max width (640) or the rail width | Add to [TOK] and the repo copy: `breakpoint.phone` 360, `breakpoint.phone-large` 400, `breakpoint.tablet-large` 840; `size.screen-gutter-tablet` 24, `size.content-max` 640, `size.sheet-max` 560, `size.card-max` 480, `size.rail-width` 80; expose them in the preset                 | Section 3 values becoming tokens             |
| GAP-STD03-04 | UI       | [INV] (all 154 screens), [BG §07]                                                 | No board shows a tablet, landscape or foldable layout; the brand guide gives only the grid (8 columns, 24 gutters, 640 for forms)                                                                                                                         | Add tablet boards for the layouts that change structure: tab shell with rail, D1 deck with details pane, D8/D9 two-pane chats, D7 and D12 grids, D14 profile, a form screen, a sheet (centred), OB1, camera and liveness screens; confirm or replace the Recommendations in section 3.2 | Final tablet layouts; store screenshots      |
| GAP-STD03-05 | REPO     | `packages/ui-native/src`                                                          | The package has `Text`, `Button`, `EmptyState` and the theme only. No device-class hook, screen wrapper, reduced-motion hook or sheet that switches form by class                                                                                         | Add `useDeviceClass()`, `Screen`, `useReducedMotion()` and `Sheet` to `packages/ui-native` in MOD-00's mobile task                                                                                                                                                                      | Every screen task                            |
| GAP-STD03-06 | REPO     | Root ESLint configuration; [BG §13]                                               | The brand guide requires `eslint-plugin-react-native-a11y` and a rule banning raw hex values and pixel font sizes in components; neither is configured                                                                                                    | Add both to the ESLint setup for `apps/mobile` and `packages/ui-native`                                                                                                                                                                                                                 | Automated accessibility gate                 |
| GAP-STD03-07 | DECISION | [TR §5.3], `app.config.ts`                                                        | Phone landscape is not addressed by any source                                                                                                                                                                                                            | Owner confirms: phones are portrait only except full-screen media and calls; tablets rotate freely                                                                                                                                                                                      | Section 3.3                                  |

## Change log

| Version | Date        | Change      |
| ------- | ----------- | ----------- |
| v1.0    | 24 Nov 2026 | First issue |
