# 1MM-STD-18 · Notifications standard (mobile)

|              |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Document** | 1MM-STD-18                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **Status**   | Approved baseline · v1.0 · 24 Nov 2026                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **Audience** | Engineers and coding agents                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **Owner**    | Engineering lead (code owners)                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **Sources**  | [INV], [TR §2.2], [TR §2.4], [TR §2.5], [TR §4.2], [TR §5.1], [TR §8.2], [TR §11], [TR §14], [TR §16.1], [TR §18.3], [BG §15], [DD §1], [DD §11], [DD §14], [SQL], [UF §15.20], [ADM A25], [ADM A26], [ADM A31], [INV C7], [INV D16], [INV NT1], [INV NT2], [INV NT4], [CN notif-rules], [OD-06], [OD-20]; Expo SDK 58 `expo-notifications` and push service reference (docs.expo.dev, read 24 Nov 2026)                                                                               |
| **Related**  | [MOD-11](../execution/1MM-EXE-MOD-11-NOTIFICATIONS-AND-COMMUNICATIONS.md) (owns the build plan) · [MOD-02](../execution/1MM-EXE-MOD-02-PLATFORM-CONFIG-AND-CATALOGUES.md) · [MOD-03](../execution/1MM-EXE-MOD-03-MEMBER-IDENTITY-AND-AUTH.md) · [1MM-STD-03](1MM-STD-03-MOBILE-BUILD-STRATEGY.md) · [1MM-STD-12](1MM-STD-12-DATA-HANDLING.md) · [1MM-STD-13](1MM-STD-13-ERROR-CODES.md) · [1MM-STD-17](1MM-STD-17-LANGUAGE-CONFIGURATION.md) · [1MM-STD-19](1MM-STD-19-OTA-UPDATES.md) |

**What this document is for and when to open it.** It is the rule book for push notifications in
`apps/mobile` and for the part of the server that produces them: channels, permission, tokens, the
payload, privacy on the lock screen, deep links, badges, quiet hours, wording and testing. Open it
before you enqueue a notification from any module, touch push handling in the app, or add a
template. [MOD-11](../execution/1MM-EXE-MOD-11-NOTIFICATIONS-AND-COMMUNICATIONS.md) says when each
part is built and by which task; this document says how it must behave. Where the two differ,
raise it: MOD-11 wins on order of work, this standard on device behaviour.

## 1. Model in one page

1. A module never sends a push. It calls `NotificationOutbox.enqueue()` with a template code inside
   the transaction that causes the message; nothing is sent for a change that rolled back
   [TR §4.2], [MOD-11 §4.2].
2. The worker job `notifications.deliver` decides, renders and sends: preferences, required
   channels, consent, throttles, collapse, quiet hours, discreet mode, locale [TR §11].
3. Push goes through the Expo push service to APNs and FCM [CN notif-rules]; tokens are Expo push
   tokens in `push_tokens` [SQL].
4. Every push also writes an in-app row (`inbox_items`) shown in D16 [SQL], so a member who
   refuses push still sees what happened.
5. The app's job is small: ask permission at the right moment, keep the token current, show or
   hide a push in the foreground, open the right screen on a tap, keep badges honest.

The app holds no wording, no category list and no throttle of its own. All of it is data edited in
the admin console (A25, A26, A31).

## 2. Categories and channels

### 2.1 Member-facing categories (sourced)

`notification_categories`, shown in NT1 in `sort` order [SQL]:

| Key        | Label key       | Transactional (locked on) | Push default | E-mail default | Marketing                       |
| ---------- | --------------- | ------------------------- | ------------ | -------------- | ------------------------------- |
| `likes`    | `ncat.likes`    | no                        | on           | off            | no                              |
| `msgs`     | `ncat.msgs`     | no                        | on           | off            | no                              |
| `groups`   | `ncat.groups`   | no                        | off          | off            | no                              |
| `daily`    | `ncat.daily`    | no                        | on           | off            | no                              |
| `news`     | `ncat.news`     | no                        | off          | off            | yes (needs `marketing` consent) |
| `account`  | `ncat.account`  | yes                       | on           | on             | no                              |
| `billing`  | `ncat.billing`  | yes                       | on           | on             | no                              |
| `security` | `ncat.security` | yes                       | on           | on             | no                              |
| `service`  | `ncat.service`  | yes                       | on           | on             | no                              |

Preferences are per category × channel in `notification_preferences`; a missing row means the
category default. Billing and security cannot be switched off [UF §15.20].

### 2.2 Android notification channels

No source defines the Android channels (GAP-STD18-01). **Recommendation:** one Android channel per
category, with the category key as the channel id, so that the member's choices in Android settings
line up with NT1.

| Channel id | Name (i18n key) | Importance | Lock-screen visibility | Sound and vibration | Badge |
| ---------- | --------------- | ---------- | ---------------------- | ------------------- | ----- |
| `likes`    | `ncat.likes`    | default    | private                | default             | yes   |
| `msgs`     | `ncat.msgs`     | high       | private                | default             | yes   |
| `groups`   | `ncat.groups`   | default    | private                | default             | yes   |
| `daily`    | `ncat.daily`    | low        | public                 | none                | no    |
| `news`     | `ncat.news`     | low        | public                 | none                | no    |
| `account`  | `ncat.account`  | default    | private                | default             | yes   |
| `billing`  | `ncat.billing`  | high       | private                | default             | yes   |
| `security` | `ncat.security` | high       | private                | default             | yes   |
| `service`  | `ncat.service`  | default    | public                 | default             | no    |

Rules:

1. Channels are created at start-up, **before** the token is requested: on Android 13 and later the
   permission prompt appears only once at least one channel exists (Expo SDK 58 reference).
2. After a channel exists, only its name and description can be changed (Expo SDK 58 reference).
   Importance, sound and visibility are therefore decided once. A change means a new channel id
   (`msgs_v2`) and deleting the old one, in a store build or OTA update, with the reason recorded.
3. Channel names are re-applied on every launch and on a locale change so they follow the member's
   language ([1MM-STD-17](1MM-STD-17-LANGUAGE-CONFIGURATION.md)).
4. "Private" means the system hides the content on a secure lock screen when the member has chosen
   to hide sensitive content. It does not replace discreet mode (section 6).
5. No custom sound file ships. Only `match-chime` and `call-start` exist and both play in-app
   [TR §2.5].
6. The worker sets `channelId` on every push from the template's `category_key`.

### 2.3 iOS categories and interruption levels

iOS has no channels. Two things map instead (both **Recommendation**, GAP-STD18-01):

| Template group                                                                                         | `interruptionLevel` | Why                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------ | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Templates with `bypass_quiet_hours` (N18, N21, N25, N36 on push)                                       | `timeSensitive`     | Security alerts and the safety check-in must be seen; they may break through Focus. Needs the Time Sensitive Notifications capability on the app id |
| Every other push outside quiet hours                                                                   | `active`            | Normal delivery                                                                                                                                     |
| Any push delivered inside quiet hours without bypass, and every row with `notifications.silent` = true | `passive`           | Delivered to the list without sound or wake [SQL `notifications` comment]                                                                           |
| `critical`                                                                                             | never used          | Needs a special entitlement and is out of proportion for this product                                                                               |

iOS notification categories (action buttons on the notification) are **not used in v1**: every
push has one action, the tap, so no `categoryId` is sent. If a later module adds actions (for
example "I'm OK" on N25), the category identifier must not contain `:` or `-` (Expo SDK 58
reference) and the action still calls the API with the member's token.

Threads: pushes that share a `collapse_key` (chat messages per thread, support replies per ticket)
set `threadId` to the same value so iOS groups them.

## 3. Permission priming and timing

| Rule                                                                                                                                                                               | Source                                              |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Permission is asked **in context at the first match**, not during sign-up: D5 "Get notified when Zara replies" → C7 primer → OS prompt → back to D5                                | [TR §2.2], [UF §15.20], [SQL `push_tokens` comment] |
| C7 is a primer in our own UI ("Know the moment someone likes you"; actions "Turn on notifications" and "Not now"). The OS prompt is shown only after "Turn on notifications"       | [INV C7]                                            |
| "Not now" never opens the OS prompt, so the one-shot iOS prompt is not wasted. The primer is offered again only in context (a later match, a first message, NT1), never on a timer | [MOD-11 §7]                                         |
| Discreet mode is suggested on the primer; default off                                                                                                                              | [CN notif-rules]                                    |
| The result is reported to the server (`os_permission`: `granted`, `denied`, `provisional`) with the token; consent kind `push` is recorded through `POST /v1/consents`             | [SQL], [MOD-11 §3.2]                                |
| When the OS setting is off, NT1 shows "Off in phone settings" with "Open settings" (`Linking.openSettings()`); the app re-reads the OS status on every resume and on opening NT1   | [INV NT1]                                           |
| iOS: read `ios.status`, not the root status; provisional authorisation is stored as `provisional`                                                                                  | Expo SDK 58 reference; [SQL]                        |
| Android 12 and earlier have no runtime prompt: the primer still shows, and the status is read from the OS                                                                          | Platform behaviour                                  |
| Restricted or suspended members are not shown the primer                                                                                                                           | **Recommendation**                                  |

The inventory places C7 at `app/(onboarding)/notifications.tsx` [INV C7]. The route stays; the
screen is entered from D5 as above, and the onboarding flow does not stop on it [TR §2.2].

## 4. Push token lifecycle

| Event                                                      | App                                                                                                                                                                                                   | Server                                                                                          |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Permission granted                                         | Create channels (Android), then `getExpoPushTokenAsync({ projectId })` with the EAS project id from `extra.eas.projectId`; `POST /v1/me/push-tokens` with token, platform, device and `os_permission` | Upsert on `push_tokens.token` (unique); link `device_id` [SQL], [MOD-11 §4.1]                   |
| Every launch and resume                                    | Re-read permission; if the token or the permission changed, post again                                                                                                                                | Update the row                                                                                  |
| Token rotated by the OS                                    | `addPushTokenListener` posts the new token                                                                                                                                                            | New row active; **Recommendation:** deactivate other rows of the same `device_id`               |
| Sign-in on a device                                        | Post the token for the new member                                                                                                                                                                     | The unique token moves to the new member, so the previous member stops receiving on that device |
| Sign-out                                                   | `DELETE /v1/me/push-tokens` before the session is cleared; clear the icon badge and delivered notifications                                                                                           | Row removed or deactivated [MOD-11 §4.1]                                                        |
| Permission revoked in OS settings                          | Post `os_permission: 'denied'` on next resume                                                                                                                                                         | Row kept, push skipped; NT1 shows the state                                                     |
| Provider says the token is invalid (`DeviceNotRegistered`) | –                                                                                                                                                                                                     | `is_active` false, `invalidated_at` set, never retried [SQL], [MOD-11 §4.3 rule 12]             |
| Successful send                                            | –                                                                                                                                                                                                     | `last_success_at` updated                                                                       |
| App uninstalled                                            | –                                                                                                                                                                                                     | Found through `DeviceNotRegistered` on a later send                                             |
| Account erased                                             | –                                                                                                                                                                                                     | Rows cascade with the member [SQL]                                                              |

Rules:

1. A token is personal data [DD §11]. It is never logged, never sent to analytics and never put in
   a deep link or a URL [TR §14].
2. Tokens are requested only on a real device with a development, preview or production build.
   Remote push does not work in Expo Go on Android (Expo SDK 58 reference), so push work needs a
   development build.
3. Each environment's build registers tokens only with its own API (`EXPO_PUBLIC_API_URL`); a
   staging token never reaches production.
4. The API accepts only tokens of the provider's known format (422 otherwise) [MOD-11 §4.1].
5. Sends to the Expo push service carry the server-side access token when enhanced push security is
   turned on for the project (`EXPO_PUSH_ACCESS_TOKEN` in `.env.example`).

## 5. Payload contract and versioning

[MOD-11 §4.4] places the push payload shape (title, body, `deep_link`, `collapse_key`, `silent`) in
`packages/contracts`. The full field list below is a **Recommendation** to be fixed there as a zod
schema (GAP-STD18-01).

### 5.1 Message sent to the Expo push service

| Field                       | Value                                                                                                                                                |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `to`                        | The member's active Expo tokens                                                                                                                      |
| `title`, `body`             | Rendered server-side from the template's `title_key` / `body_key` in the row's `locale`; the discreet text when discreet mode is on (section 6)      |
| `data`                      | The object in 5.2                                                                                                                                    |
| `channelId` (Android)       | The template's `category_key`                                                                                                                        |
| `interruptionLevel` (iOS)   | Section 2.3                                                                                                                                          |
| `sound`                     | `default`, or omitted when `silent`                                                                                                                  |
| `priority`                  | `high` for `msgs`, `billing`, `security`; `default` otherwise                                                                                        |
| `collapseId` and `threadId` | `notifications.collapse_key` when set                                                                                                                |
| `badge` (iOS)               | Section 8                                                                                                                                            |
| `ttl`                       | Short for time-bound messages (an intro, a call, a check-in); the provider default otherwise. Values are template data once GAP-MOD11-01 is resolved |

Limits of the service: at most 100 messages per request, 600 notifications a second per project,
4096 bytes per payload (Expo push reference). The worker batches and paces accordingly; the
broadcast rate ceiling is `notifications.broadcast_rate_per_minute` [SQL].

### 5.2 The `data` object

| Key               | Type             | Meaning                                                                                                     |
| ----------------- | ---------------- | ----------------------------------------------------------------------------------------------------------- |
| `v`               | integer          | Payload version. Starts at 1                                                                                |
| `template`        | string           | Template code (`N06`)                                                                                       |
| `notification_id` | uuid             | `notifications.id`, for receipts and dedupe on the device                                                   |
| `deep_link`       | string           | The template's screen code (`D9-Chat`), exactly as stored in `notification_templates.deep_link` [SQL]       |
| `target`          | object           | Ids the route needs, by name (`conversation_id`, `match_id`, `group_id`, `meetup_id`, `intro_id`). Ids only |
| `collapse_key`    | string, optional | As stored                                                                                                   |
| `silent`          | boolean          | True for quiet-hours delivery                                                                               |

Rules:

1. **`data` never carries personal content**: no names, no message text, no photo URLs, no e-mail
   addresses, no tokens. Only ids and codes. The screen fetches what it shows with the member's
   session.
2. The payload stays far below 4096 bytes; `params` used for rendering stay on the server.
3. **Versioning.** Adding an optional key keeps `v`. Removing or changing the meaning of a key
   raises `v`. The app accepts every `v` it knows; for a higher `v` it ignores `target`, and a tap
   opens D16, where the inbox row (rendered by the API) is always correct. The server keeps sending
   a `v` that every app version at or above `app_versions.min_supported` understands
   ([1MM-STD-19](1MM-STD-19-OTA-UPDATES.md)).
4. An unknown `deep_link` code is treated the same way: open D16.

## 6. Lock-screen privacy

| Rule                                                                                                                                                                                                     | Source                                         |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| **Discreet mode** (`user_settings.discreet_mode`) replaces the title and body with the fixed text "1minitman · You have a new notification". Default off; suggested at C7; switched in NT1               | [CN notif-rules], [SQL]                        |
| The replacement is done **on the server** before sending, so the private text never reaches the device or the push providers                                                                             | [MOD-11 §4.3 rule 9]                           |
| The discreet text is an i18n key like any other and is previewed in A25 and NT2                                                                                                                          | [ADM A25], [INV NT2]                           |
| No push body ever contains a chat message, an intro recording transcript, a report detail, a payment card detail, an address or a one-time code                                                          | [TR §14]; **Recommendation** for the body rule |
| Whether a nickname may appear in a push title when discreet mode is off is decided by the template wording. The NT4 board shows wording for N01–N22 only; the default for the rest is open: GAP-STD18-02 | [INV NT4], [UF §15.20]                         |
| Security and billing pushes say that something happened and where to look, never the detail ("New sign-in to your account", not the device or city)                                                      | **Recommendation**                             |
| Android channels for personal categories use private lock-screen visibility (section 2.2)                                                                                                                | **Recommendation**                             |
| Screens opened from a push on a locked device still require the app's own session; nothing is shown before unlock                                                                                        | [1MM-STD-12](1MM-STD-12-DATA-HANDLING.md)      |
| Application logs and analytics never hold a push title, body or token                                                                                                                                    | [TR §14]                                       |

## 7. Receiving and opening

### 7.1 Foreground, background, killed

| App state                                                                                                          | Behaviour                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Foreground, the push is about what is on screen (the open chat thread, the open group room, the open support chat) | Not shown: the handler returns no banner, no sound. The screen updates from the WebSocket or a refetch. The inbox row is still written [MOD-11 §7]                                                                                                              |
| Foreground, anything else                                                                                          | Shown as a system banner and in the list (`shouldShowBanner`, `shouldShowList`); sound only if the row is not `silent`. Tab badges refresh. The handler must answer within 3 seconds (Expo SDK 58 reference), so it decides from memory, never from the network |
| Background                                                                                                         | Shown by the OS. On resume the app refetches unread counts and the active list                                                                                                                                                                                  |
| Killed                                                                                                             | Shown by the OS. A tap cold-starts the app; the response is read once (`useLastNotificationResponse`) after the gates below, then cleared so it is not handled twice                                                                                            |
| Signed out                                                                                                         | Sign-out removes the token, so nothing should arrive. If one does, a tap goes to sign-in; after sign-in the link continues only if the notification belongs to the member who signed in [MOD-11 §7]                                                             |

Data-only background pushes are not used in v1: every push is user-visible, and state is refreshed
on resume. The iOS background remote-notification mode stays off. **Recommendation.**

### 7.2 Deep links into Expo Router

A tap is routed through one function, `openNotification(data)`, which is the only place a push
turns into navigation:

1. Wait for the root gates: fonts, config, the OB1 version gate, maintenance, session, and account
   state. A member who must update, or is suspended, sees that state first; restricted and
   suspended members land on their account-state screen [MOD-11 §7].
2. Map `deep_link` (screen code) to a route and fill it from `target`.
3. Navigate so that Back leads somewhere sensible: tab root first, then the target.
4. If the target no longer exists (unmatched, deleted group, expired intro), open D16 [MOD-11 §7].
5. Mark the matching inbox row read when its screen opens.

Screen codes used by the seeded member templates and their routes [SQL], [INV]:

| Screen code          | Expo Router route (file)           | Templates      |
| -------------------- | ---------------------------------- | -------------- |
| `D1-Home`            | `app/(tabs)/index.tsx`             | N10, N11, N34  |
| `D5-Match`           | `app/match/[id].tsx`               | N03            |
| `MF1-Maybe-Match`    | `app/match/[id].tsx?kind=maybe`    | N02            |
| `D7-Likes`           | `app/(tabs)/likes.tsx`             | N01            |
| `MF2-Intro-Voice`    | `app/intro/[id].tsx?mode=voice`    | N04            |
| `D9-Chat`            | `app/chat/[id].tsx`                | N05, N06       |
| `H7-DM-Requests`     | `app/messages/requests.tsx`        | N07            |
| `D13-Group-Room`     | `app/group/[id].tsx`               | N08, N31, N32  |
| `MF6-Spotlight`      | `app/spotlight.tsx`                | N09            |
| `MF4-Call`           | `app/call/[id].tsx`                | N33 (deferred) |
| `EV4-Invite`         | `app/meetup/[id].tsx`              | N23, N24       |
| `EV5-Check-In`       | `app/meetup/[id]/check-in.tsx`     | N25            |
| `B11-Approved`       | `app/badge/approved.tsx`           | N12            |
| `B4-Main-Photo`      | `app/badge/photo.tsx`              | N13            |
| `B10-Under-Review`   | `app/badge/status.tsx`             | N29            |
| `BL1-Plan-Billing`   | `app/settings/billing.tsx`         | N26            |
| `BL2-History`        | `app/settings/billing/history.tsx` | N14            |
| `BL5-Payment-Failed` | `app/settings/billing/recover.tsx` | N15            |
| `BL6-Lapsed`         | `app/settings/billing/lapsed.tsx`  | N17            |
| `BL7-Trial`          | `app/upgrade/trial.tsx`            | N16            |
| `PM5-Security`       | `app/settings/security.tsx`        | N19            |
| `PM6-New-Sign-In`    | `app/security/new-sign-in.tsx`     | N18            |
| `AS1-Restricted`     | `app/account/restricted.tsx`       | N21, N35       |
| `AS5-Keep-Account`   | `app/account/pending-deletion.tsx` | N20            |
| `H6-Suspended`       | `app/(blocked)/suspended.tsx`      | N28, N36       |
| `H2-Safety`          | `app/safety/index.tsx`             | N22            |
| `H1B-Support-Chat`   | `app/help/chat.tsx`                | N30            |
| `LG6-Privacy-Data`   | `app/settings/privacy.tsx`         | N27            |

The map lives once in `packages/contracts` as a typed record from screen code to route pattern and
required `target` keys (MOD-11 §4.4 is aligned to this), used by the app for navigation and by the API to
validate `notification_templates.deep_link` on edit in A25. A test fails when a seeded template's
code is missing from the map. The same map serves D16 row taps (`inbox_items.deep_link`).

The routes in the table are the inventory's [INV]. The scaffold's first tab file is
`app/(tabs)/specs.tsx`, not `app/(tabs)/index.tsx`; the map records the route the app really has
when MOD-00's shell task settles it.

The app's URL scheme is `oneminitman` (`app.config.ts`). A push is never a URL the OS opens by
itself: the app reads `data` and navigates, so a push cannot be used to open an arbitrary link.

## 8. Badges

| Badge                                              | Source of the number                                                                                                                                    | Rule                                                                                                                                                                                                                             |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tab badges (Likes, Chats), D16 unread, H7 requests | `v_unread_counts`: `likes_new`, `chats_unread`, `activity_unread`, `requests_pending`; cached in Redis `badge:{user_id}` for 60 s and deleted on change | Refreshed on resume, on a realtime event on the member's channel, and after any action that reads items [SQL], [DD §14], [MOD-11 §4.2]                                                                                           |
| App icon badge                                     | Not defined by any source: GAP-STD18-03                                                                                                                 | **Recommendation:** `chats_unread + activity_unread`; the worker sets `badge` on each iOS push to that total; the app sets the same total with `setBadgeCountAsync` on resume and whenever counts change, and sets 0 on sign-out |
| Android icon dot                                   | Follows the channel's badge setting (section 2.2)                                                                                                       | The OS manages it                                                                                                                                                                                                                |

"Mark all read" (`POST /v1/me/activity/read-all`) clears `activity_unread` and the delivered
notifications in the system tray for inbox items.

The number shown is never colour alone: it is announced to screen readers with its tab ("Chats, 2
unread") [TR §2.4].

## 9. Quiet hours, throttles and collapse

All of this is decided on the server. The app implements none of it and schedules no local
notification in v1.

| Rule                                       | Value                                                                                                                                                                                                                                                 | Source                                   |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Quiet hours                                | Member's `user_settings.quiet_hours_enabled` (default on), `quiet_hours_start`, `quiet_hours_end`; defaults from `notifications.quiet_start` "23:00" and `notifications.quiet_end` "07:00"; evaluated in the member's time zone (`profiles.timezone`) | [SQL], [MOD-11 §4.3 rule 7]              |
| Effect of quiet hours                      | Pushes are delivered silently (`silent` true); templates with `bypass_quiet_hours` are delivered normally; marketing broadcasts wait until quiet hours end                                                                                            | [SQL `notifications` comment], [ADM A26] |
| Who may bypass                             | Only `security` templates. Seeded true for N18, N19, N21, N25, N36                                                                                                                                                                                    | [ADM A25], [SQL]                         |
| Likes (N01, N02)                           | Batched, at most 1 an hour                                                                                                                                                                                                                            | [SQL], [UF §15.20]                       |
| Chat messages (N06), support replies (N30) | Collapsed per chat / per ticket (`collapse_key`)                                                                                                                                                                                                      | [SQL]                                    |
| Daily reset (N10)                          | At most once a day, 18:00 local                                                                                                                                                                                                                       | [SQL], [TR §11]                          |
| New people near you (N34)                  | At most once a day                                                                                                                                                                                                                                    | [SQL]                                    |
| Trial ending (N16)                         | Exactly 24 h before the charge (store rule)                                                                                                                                                                                                           | [CN notif-rules]                         |
| Renewal failed (N15)                       | Day 1, 4 and 6                                                                                                                                                                                                                                        | [SQL]                                    |
| Broadcasts                                 | At most `notifications.broadcast_max_per_day` (1) per member per day                                                                                                                                                                                  | [SQL]                                    |
| Dedupe                                     | One send per `dedupe_key` per member (`uq_notifications_dedupe`)                                                                                                                                                                                      | [SQL]                                    |
| Throttle state                             | Redis `notif:throttle:{user_id}:{template}`                                                                                                                                                                                                           | [DD §14]                                 |

The throttle text in `notification_templates.throttle_rule` is not machine-readable today; the
structured form is GAP-MOD11-01 in MOD-11. Until it is resolved no new throttle may be coded as a
literal outside the delivery job.

## 10. Wording and localisation

1. Push text is rendered **on the server** in the row's `notifications.locale`, taken from
   `users.locale` when the row is written [SQL]. The device language is irrelevant.
2. Locales are `en`, `pcm`, `fr`. A missing or unpublished translation falls back to `en` and is
   marked in A25 [ADM A25]. `fr` is used only when `locale.fr` is on.
3. Keys: `n01.title`, `n01.body` … `n36.body`; category labels `ncat.*` [SQL]. Keys, ICU syntax,
   plural forms and gender-neutral wording follow
   [1MM-STD-17](1MM-STD-17-LANGUAGE-CONFIGURATION.md).
4. Length: `i18n_strings.max_length` is the lock-screen limit hint; A25 refuses a longer value
   [SQL], [MOD-02 §4.3]. **Recommendation:** title ≤ 40 characters and body ≤ 110 characters in
   every locale, so that nothing is cut on a small lock screen; Naijá and French are checked at
   their own length, not the English one.
5. Parameters are named ICU arguments (`{nickname}`); a template never builds a sentence by
   joining pieces. Batched templates use plurals ("{count, plural, …}").
6. The brand name and the slogan are never translated [BG §15].
7. No emoji in titles or bodies [TR §2.4].
8. Android channel names and the discreet text are catalogue keys too.
9. `pcm` (and `fr` before its flag turns on) must be at status `reviewed` by a native speaker who
   is not the last editor [ADM A25], [SQL `i18n_review_not_editor`].
10. No `i18n_strings` rows are seeded, so no template has wording until MOD-11-DB-01 loads `en`
    (GAP-MOD11-05, GAP-MOD02-03).

## 11. Template catalogue

Seeded in `notification_templates` [SQL]. "Push" marks the templates this standard governs on the
device; the others are listed so the catalogue is complete. `account`, `billing` and `security`
templates have `required_channels` equal to their channels [DD §1]. Deep links are in section 7.2.

| Code | Purpose (trigger)                                               | Category   | Channels            | Push | Throttle                 | Bypass quiet hours |
| ---- | --------------------------------------------------------------- | ---------- | ------------------- | ---- | ------------------------ | ------------------ |
| N01  | Someone likes you                                               | `likes`    | push, in_app        | ✓    | batched, max 1 an hour   | no                 |
| N02  | One-sided Somewhat                                              | `likes`    | push, in_app        | ✓    | batched, max 1 an hour   | no                 |
| N03  | Mutual Like                                                     | `likes`    | push, in_app        | ✓    | instant                  | no                 |
| N04  | Other person opened the intro                                   | `msgs`     | push, in_app        | ✓    | instant                  | no                 |
| N05  | Both chose Keep talking                                         | `msgs`     | push, in_app        | ✓    | instant                  | no                 |
| N06  | New chat message                                                | `msgs`     | push, in_app        | ✓    | collapsed per chat       | no                 |
| N07  | Direct Spec received                                            | `msgs`     | push, in_app        | ✓    | instant                  | no                 |
| N08  | Group event reminder (24 h)                                     | `groups`   | push, in_app        | ✓    | 1 per event              | no                 |
| N09  | Spotlight turn starts                                           | `likes`    | push, in_app        | ✓    | 1 per turn               | no                 |
| N10  | Daily specs reset                                               | `daily`    | push                | ✓    | max 1 a day, 18:00 local | no                 |
| N11  | Sign-up complete                                                | `account`  | email               | –    | once                     | no                 |
| N12  | Black Badge approved                                            | `account`  | push, email, in_app | ✓    | once                     | no                 |
| N13  | Review needs a fix                                              | `account`  | push, email, in_app | ✓    | once + 24 h reminder     | no                 |
| N14  | Successful payment                                              | `billing`  | email               | –    | per payment              | no                 |
| N15  | Renewal failed (day 1, 4, 6)                                    | `billing`  | push, email, in_app | ✓    | day 1, 4, 6              | no                 |
| N16  | Trial ends in 24 h                                              | `billing`  | push, email, in_app | ✓    | once (store rule)        | no                 |
| N17  | Plan lapsed                                                     | `billing`  | push, email, in_app | ✓    | once                     | no                 |
| N18  | New device sign-in                                              | `security` | push, email, in_app | ✓    | per new device           | yes                |
| N19  | Password changed                                                | `security` | email               | –    | per change               | yes                |
| N20  | Deletion requested (and day 7)                                  | `account`  | email               | –    | day 0 and day 7          | no                 |
| N21  | Account restricted                                              | `security` | push, email, in_app | ✓    | once                     | yes                |
| N22  | Report reviewed                                                 | `security` | push, in_app        | ✓    | per report class         | no                 |
| N23  | Date invite received                                            | `msgs`     | push, in_app        | ✓    | instant                  | no                 |
| N24  | Date invite accepted / new time suggested                       | `msgs`     | push, in_app        | ✓    | instant                  | no                 |
| N25  | Safety check-in due                                             | `security` | push                | ✓    | per check-in             | yes                |
| N26  | Plan renews in 3 days                                           | `billing`  | push, email, in_app | ✓    | once per period          | no                 |
| N27  | Data export ready                                               | `account`  | email, in_app       | –    | per export               | no                 |
| N28  | Appeal decided                                                  | `security` | push, email, in_app | ✓    | per appeal               | no                 |
| N29  | Black Badge not approved (refund)                               | `account`  | push, email, in_app | ✓    | once                     | no                 |
| N30  | Support agent replied                                           | `account`  | push, in_app        | ✓    | collapsed per ticket     | no                 |
| N31  | Group invite received                                           | `groups`   | push, in_app        | ✓    | instant                  | no                 |
| N32  | Group approved / join request approved                          | `groups`   | push, in_app        | ✓    | instant                  | no                 |
| N33  | Incoming / missed call (deferred: `calls.enabled` off, [OD-20]) | `msgs`     | push                | ✓    | instant                  | no                 |
| N34  | New people near you                                             | `daily`    | push                | ✓    | max 1 a day              | no                 |
| N35  | Restriction lifted                                              | `security` | push, email, in_app | ✓    | once                     | no                 |
| N36  | Account suspended                                               | `security` | push, email, in_app | ✓    | once                     | yes                |

W01–W08 are website templates for people who are not members (e-mail, and SMS for W01 and W02);
they never produce a push and are covered by MOD-11 and MOD-15. Which module enqueues each N-code
is listed in [MOD-11 §4.2].

Notes:

- The `news` category (marketing) and the `service` category have no seeded template; `news` is
  used by broadcasts (A26) [ADM A26].
- N26 is about plans. A Black Badge is a one-off and never renews; the D16 board line that says
  otherwise is a known copy error [TR §18.3].

### 11.1 How admin manages templates (A25)

| Action                       | Rule                                                                                                                                                                                    | Source                                                                                |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Edit a template              | Channels, keys, deep link (a screen code from the inventory), MJML name, throttle, active; permission `notifications.templates` with a reason; audit `template.update`                  | [ADM A25]                                                                             |
| Required channels            | Dropping a required channel of a transactional template needs an approval                                                                                                               | [ADM A25]                                                                             |
| Bypass quiet hours           | Can be enabled only in the `security` category                                                                                                                                          | [ADM A25]                                                                             |
| Wording                      | Edited as `i18n_strings` under `/comms/translations` (built by MOD-02), permission `i18n.manage`; review by a second person; publish                                                    | [ADM A25], [ruling R11](../execution/1MM-EXE-00-MASTER-PLAN.md#7-coordinator-rulings) |
| Preview                      | Push in normal and discreet form, light and dark, en / pcm / fr, with editable sample parameters and all plural forms                                                                   | [ADM A25]                                                                             |
| Test send                    | Only to the admin's own test destination, prefixed "[TEST]" (the store for a test device is GAP-MOD11-02)                                                                               | [ADM A25]                                                                             |
| New template                 | Added by migration with the next code (N37 onwards, GAP-MOD11-09); needs keys in `en`, a category, a screen code present in the deep-link map, and a row in section 11 of this document | This standard; GAP-MOD11-09                                                           |
| Switch off                   | `is_active` false stops sending at once; the worker reads templates at send time                                                                                                        | [MOD-11 §3.4]                                                                         |
| Broadcasts and announcements | A26; a second admin approves; security templates are never used                                                                                                                         | [ADM A26]                                                                             |

Nothing in this list needs an app release, except a new screen code (a new route).

## 12. Delivery receipts and failures

| Stage                                                     | What happens                                                                                                                                                                | Status (`delivery_status_t`)         |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| Row written                                               | In the caller's transaction                                                                                                                                                 | `queued` (or `batched`, `throttled`) |
| Skipped by preference, consent, permission or suppression | Recorded, not sent                                                                                                                                                          | `suppressed`                         |
| Sent to Expo                                              | A push ticket comes back per message; the ticket id is stored in `provider_msg_id`, `provider` = `expo`                                                                     | `sent`                               |
| Ticket error `DeviceNotRegistered`                        | Token deactivated; no retry                                                                                                                                                 | `failed`                             |
| Receipt fetched                                           | Receipts are fetched from the Expo receipts endpoint about 15 minutes after sending, in batches of up to 1000 ids; they are kept by Expo for 24 hours (Expo push reference) | `delivered` or `failed`              |
| Receipt error `DeviceNotRegistered`                       | Token deactivated                                                                                                                                                           | `failed`                             |
| Receipt error `MessageTooBig`                             | A defect: alert; never retried                                                                                                                                              | `failed`                             |
| Receipt error `MessageRateExceeded`                       | Retry with backoff                                                                                                                                                          | stays due                            |
| Receipt errors `MismatchSenderId`, `InvalidCredentials`   | Push credentials are wrong: alert operations; stop sending on that platform until fixed                                                                                     | `failed`                             |
| HTTP 429 or 5xx from Expo, network error                  | Retry with exponential backoff; `attempts` incremented, `error` recorded                                                                                                    | stays due                            |
| HTTP 400                                                  | Malformed request: a defect; no retry                                                                                                                                       | `failed`                             |
| Opened                                                    | The app reports a tap. No endpoint exists for this: GAP-STD18-04                                                                                                            | `opened`                             |

Rules:

1. Retry counts and backoff are not configured anywhere yet (GAP-MOD11-08); they must be config
   keys, not literals.
2. A push that fails never blocks the in-app row or the e-mail of the same template.
3. A retry never duplicates: the dedupe key and the stored ticket id decide.
4. Rows are kept 90 days, inbox items 180 days [TR §16.1].
5. Delivery logs in A26 mask parameters [ADM A26]. Failure rates raise an alert [TR §14].
6. If every token of a member is inactive, the member is treated as push-off. The e-mail and
   in-app rows of the same template are unaffected, which is how `account`, `billing` and
   `security` messages still arrive. **Recommendation.**

## 13. Testing on real devices

Simulators cannot prove push. Every change to push handling, channels, the payload, the deep-link
map or a template's device behaviour is tested on **one real iPhone and one real Android phone**,
with a `preview` build against staging, plus the tablet slot of
[1MM-STD-03 §12](1MM-STD-03-MOBILE-BUILD-STRATEGY.md) for the deep-link landing.

| #   | Case                                                                                                       | iOS | Android                               |
| --- | ---------------------------------------------------------------------------------------------------------- | --- | ------------------------------------- |
| 1   | Primer → allow → token registered; primer → "Not now" → no OS prompt                                       | ✓   | ✓ (13+ and one device on 12 or lower) |
| 2   | Deny at the OS prompt → NT1 shows "Off in phone settings" → enable in settings → resume → token registered | ✓   | ✓                                     |
| 3   | Push while foreground on another screen: banner shown, badges update                                       | ✓   | ✓                                     |
| 4   | Push for the open chat: no banner; message appears                                                         | ✓   | ✓                                     |
| 5   | Push in background and with the app killed: tap opens the right screen with a sensible Back                | ✓   | ✓                                     |
| 6   | Each deep link in section 7.2 that the change touches; target deleted → D16                                | ✓   | ✓                                     |
| 7   | Locked phone: normal mode and discreet mode; private channel with "hide sensitive content"                 | ✓   | ✓                                     |
| 8   | Quiet hours: silent delivery; N18 or N25 still sounds; crossing midnight; time zone changed                | ✓   | ✓                                     |
| 9   | Likes batch (several likes → one push); chat collapse (several messages → one notification, grouped)       | ✓   | ✓                                     |
| 10  | Locale `en` and `pcm` (and `fr` when on): text, length, channel names                                      | ✓   | ✓                                     |
| 11  | Icon badge after reading, after "Mark all read", after sign-out                                            | ✓   | dot                                   |
| 12  | Sign out → no push; sign in as another member on the same phone → only that member's pushes                | ✓   | ✓                                     |
| 13  | Token rotation (reinstall) → new token registered, old one deactivated after the next send                 | ✓   | ✓                                     |
| 14  | Member restricted or suspended: account pushes arrive; tap lands on the account-state screen               | ✓   | ✓                                     |
| 15  | App below `min_supported`: tap leads to OB1 Required, not the target                                       | ✓   | ✓                                     |
| 16  | Battery saver or Doze on a low-end Android device: high-priority message still arrives                     | –   | ✓                                     |
| 17  | Focus mode on: time-sensitive security push breaks through; others do not                                  | ✓   | –                                     |
| 18  | Text size at 200%, VoiceOver / TalkBack reading the notification and the D16 row                           | ✓   | ✓                                     |

Automated tests cover what devices are not needed for: the payload schema and version handling,
the deep-link map against the seeded templates, the foreground handler's decisions, and the worker
rules (MOD-11 §9). MOD-11's exit gate requires one recorded delivery per template and channel, and
discreet-mode and quiet-hours evidence on a locked iOS and Android device.

Test sends use test accounts only; a push is never sent to a real member for testing.

## 14. Gaps raised

Dispositions are recorded in [1MM-LOG-03](../1MM-LOG-03-TECHNICAL-REFERENCE-EXTENSIONS.md)
(Technical Reference and schema), [1MM-LOG-02](../1MM-LOG-02-UI-UPDATES.md) (UI) and
[1MM-LOG-04](../1MM-LOG-04-OPEN-DECISIONS-AND-FOLLOW-UPS.md) (owner decisions and repository
follow-ups).

Gaps already raised by MOD-11 are referenced above by their ids and not repeated here.

| Gap id       | Type     | Where found                                             | What is missing or conflicting                                                                                                                                                                                               | Proposed resolution                                                                                                                                                                                                                              | Blocks                          |
| ------------ | -------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------- |
| GAP-STD18-01 | TR       | [TR §5.1], [TR §8.2], [CN notif-rules]                  | No source defines the Android notification channels, the iOS interruption levels, or the push `data` object and its versioning                                                                                               | Add to the Technical Reference: channel id = `notification_categories.key` with the settings in section 2.2; interruption levels in section 2.3; the payload in section 5 as a schema in `packages/contracts`                                    | MOD-11-API-02, MOD-11-MOB-01    |
| GAP-STD18-02 | DECISION | [CN notif-rules], [INV NT2], [INV NT4]                  | Discreet mode is off by default, so by default a push may show whatever the template says. Wording exists on boards for N01–N22 only, and no rule says whether a nickname or a message preview may appear on the lock screen | Owner confirms: with discreet mode off, a title may carry the other member's nickname; no push ever carries message text, a real name or a detail of a security or billing event; N23–N36 wording follows this when written (GAP-MOD11-05)       | Template wording, native review |
| GAP-STD18-03 | TR       | [SQL `v_unread_counts`], [DD §14]                       | The app-icon badge number is not defined (the view serves tab badges)                                                                                                                                                        | Define it as `chats_unread + activity_unread`, sent as `badge` on iOS pushes and set by the app on resume                                                                                                                                        | Section 8                       |
| GAP-STD18-04 | TR       | [SQL `delivery_status_t`], [TR §8.2]                    | The status `opened` exists, and A26 reports "opened", but no member endpoint lets the app report that a push was tapped                                                                                                      | Add `POST /v1/me/notifications/{id}/opened` (idempotent, member-scoped, no body) to [TR §8.2]; the app calls it from `openNotification`                                                                                                          | A26 open counts for push        |
| GAP-STD18-05 | REPO     | `apps/mobile/package.json`, `apps/mobile/app.config.ts` | `expo-notifications` is not installed and its config plugin is not listed; the notification icon and colour are not set                                                                                                      | Add `expo-notifications` (SDK 58 line) and its plugin entry with a monochrome notification icon and the Ink colour; add the Time Sensitive Notifications capability if section 2.3 is accepted. Push then needs a development build, not Expo Go | MOD-11-MOB-01                   |

## Change log

| Version | Date        | Change      |
| ------- | ----------- | ----------- |
| v1.0    | 24 Nov 2026 | First issue |
