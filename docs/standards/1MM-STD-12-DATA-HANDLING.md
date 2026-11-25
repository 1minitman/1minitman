# 1MM-STD-12 · Store considerations: how data is held on the client and the server

|              |                                                                                                                                                                                                                                                                                                                  |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Document** | 1MM-STD-12                                                                                                                                                                                                                                                                                                       |
| **Status**   | Approved baseline · v1.0 · 24 Nov 2026                                                                                                                                                                                                                                                                           |
| **Audience** | Engineers and coding agents                                                                                                                                                                                                                                                                                      |
| **Owner**    | Engineering lead (code owners); interim DPO for retention and residency                                                                                                                                                                                                                                          |
| **Sources**  | [TR §4.1–§4.4], [TR §5.1], [TR §5.3], [TR §6.2], [TR §7.1], [TR §8.1], [TR §10.2], [TR §10.3], [TR §13], [TR §14], [TR §16], [DD Conventions], [DD §1–§14], [SQL], [ADM §1.1–§1.5], [ADM A01], [ADM A03], [ADM A04], [WEB §3.1], [WEB §3.8], [WEB §3.10–§3.12], [OD-06], [OD-10], [OD-11]                        |
| **Related**  | [1MM-STD-11](1MM-STD-11-SECURITY-AND-COMPLIANCE.md), [1MM-STD-15](1MM-STD-15-DATA-STRUCTURES-AND-MODELS.md), [1MM-STD-16](1MM-STD-16-DEFENSIVE-PROGRAMMING.md), [1MM-STD-18](1MM-STD-18-NOTIFICATIONS.md), [1MM-DB-05](../database/1MM-DB-05-SECURITY.md), [1MM-DB-06](../database/1MM-DB-06-DATA-PROTECTION.md) |

**What this document is for and when to open it.** It says where each kind of data may be kept, for
how long and under what protection: on the phone, in each browser app, and in every server store.
Open it before you persist anything new (a column, a Redis key, a cache, a file, a cookie, a job
payload, a log field) and use the decision table in section 12. The threats these rules answer are
in [1MM-STD-11](1MM-STD-11-SECURITY-AND-COMPLIANCE.md); the life cycle of each entity is in
[1MM-STD-15](1MM-STD-15-DATA-STRUCTURES-AND-MODELS.md).

Rules marked **Recommendation** are engineering rules set by this standard where the sources are
silent; the sources they extend are named, and GAP-STD12-01 asks for them to be adopted into the
Technical Reference.

## 1. Principles

1. **PostgreSQL is the system of record.** Everything else (Redis, client caches, analytics, search)
   can be lost and rebuilt. "Anything that must survive a cache flush also has a Postgres row"
   [DD §14].
2. **The server decides, the client displays.** A client store never holds the only copy of
   anything except an unsent outbox item, and never holds a rule (a limit, a price, an entitlement)
   as truth [TR §4.2], [TR §8.1].
3. **Collect the least, keep it the shortest.** Coarse location, private real names, hashed
   identifiers where a hash is enough [TR §16.2].
4. **Classify before you store.** Every stored field has a PII class (section 2) and a retention
   rule (section 11) before the migration is written.
5. **Personal data never enters logs, traces, crash reports, URLs, job payloads or analytics
   properties** [TR §14], [WEB §3.10].
6. **Real personal data exists only in production** [TR §4.4], [OD-10].

## 2. PII classes and the handling rule for each

The classes are those of the data dictionary [DD Conventions]. Each table's class is in [DD §1–§13].

| Class                       | Meaning [DD Conventions]                                                  | Examples                                                                                                                          | Handling rule                                                                                                                                                                                                                                                                                                                                                                           |
| --------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **none**                    | No personal data                                                          | Catalogues, plans, prices, `remote_config`, `feature_flags`, `i18n_strings`, `usage_counters`                                     | May be cached anywhere, sent to any client that is allowed the feature, logged. Public subset only through the public endpoints                                                                                                                                                                                                                                                         |
| **personal**                | Identifies or relates to a member                                         | `users`, `profiles`, `media_assets`, `messages`, `reactions`, `matches`, `transactions`, `support_tickets`                        | Server: TLS in transit, encrypted at rest by the provider, read through the role for the surface (section 8), masked by default in the admin console and revealed with an audited reason [ADM §1.3]. Client: memory or the app sandbox only, cleared on sign-out (sections 3–6). Never in logs, URLs or job payloads                                                                    |
| **personal (pseudonymous)** | Tied to an id, not to a name                                              | `analytics_events`, research tables, `edge_security_events` (IP prefixes), `api_request_samples.user_hash`                        | As personal. Only after analytics consent for product events [TR §14]. IPs truncated to a prefix. Exports and the `app_readonly` role see aggregates only                                                                                                                                                                                                                               |
| **sensitive**               | Health, faith, live location during a date, credentials, safety incidents | `password_credentials`, `profile_answers` (genotype, faith), `safety_checkins`, `safety_escalations`, `age_verification_requests` | As personal, plus: collected only with its own consent where the option set says `needs_consent` [DD §1]; never shown to other members (genotype and faith are matching inputs only [TR §16.2]); never cached on a client beyond the screen that edits it; never in notifications, analytics or support exports; reveal in the admin console needs a permission with reason and step-up |
| **biometric**               | Face templates and liveness media                                         | `liveness_sessions` (vendor), `face_templates`; `media_assets` while in quarantine is a biometric source [DD §3]                  | Held at the vendor; we keep an encrypted reference (`vendor_template_ref_enc`) and a one-way `dedupe_fingerprint`. Never on a client after upload, never in a backup we can avoid, never in a lower environment. Deleted on consent withdrawal or erasure; the fingerprint survives only for banned accounts [TR §16.1]                                                                 |
| **third party**             | A person who is not a member                                              | `trusted_contacts` (name, phone), website form senders, story partners                                                            | As personal. Use only for the purpose consented (a YES reply for trusted contacts [TR §16.2]); addresses of non-members stored encrypted with a hash for lookup (section 7.7)                                                                                                                                                                                                           |

## 3. Mobile app (`apps/mobile`)

Stack facts: TanStack Query, Zustand for local state, generated API client, MMKV offline outbox,
expo-secure-store for refresh tokens, expo-image with a disk cache, expo-notifications, Sentry,
PostHog after consent [TR §5.1].

### 3.1 What may be stored where

| Data                                                                              | Store                                                      | Lifetime                                                                            | Protection and rule                                                                                                                                                                                                                                      | Source                           |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| Refresh token                                                                     | expo-secure-store (Keychain / Keystore)                    | 30 days, rotated on every use                                                       | The only long-lived credential on the device. **Recommendation:** stored "this device only, after first unlock" so it is not restored to another device from a backup                                                                                    | [TR §5.1], [TR §8.1], [TR §13.4] |
| Access token (JWT, 15 min)                                                        | Memory only                                                | Until expiry or app kill                                                            | **Recommendation:** never written to disk; a cold start uses the refresh token                                                                                                                                                                           | [TR §8.1]                        |
| Device identifier used for the fingerprint                                        | expo-secure-store                                          | Life of the install                                                                 | The server stores only `devices.fingerprint_hash`. **Recommendation:** the raw value never leaves secure storage except in the auth requests that need it                                                                                                | [DD §2], [SQL]                   |
| Offline outbox: reactions, reads, status changes, each with a client-generated id | MMKV                                                       | Until acknowledged by the server; **Recommendation:** dropped after 7 days unsent   | Holds target ids and the action only, never message text: messages are never queued silently, they show as failed (ES6). Replayed in order; replays are idempotent. **Recommendation:** the MMKV instance is encrypted with a key kept in secure storage | [TR §4.2], [TR §5.3]             |
| Server data cache (TanStack Query): deck, profiles, chat list, messages, settings | Memory                                                     | Per query (section 3.3)                                                             | Not persisted to disk, with the exceptions in section 3.3                                                                                                                                                                                                | [TR §5.1]; Recommendation        |
| Local UI state (Zustand): navigation state, drafts in progress, toggles           | Memory; non-personal preferences may persist in MMKV       | Session; preferences until sign-out                                                 | No personal data of another member; an unsent chat draft is memory only                                                                                                                                                                                  | [TR §5.1]; Recommendation        |
| Config bootstrap (`GET /v1/config`), flags, i18n catalogue, option catalogues     | MMKV                                                       | Refreshed at start and on resume; stale copy used offline                           | PII class none. Lets the app render OB1 and offline states                                                                                                                                                                                               | [TR §8.2], [DD §13]              |
| Entitlements (`GET /v1/me/entitlements`)                                          | Memory                                                     | Refetched on `entitlements.changed` and on resume                                   | A display hint only: the server re-checks every gate                                                                                                                                                                                                     | [TR §8.3], [TR §4.6]             |
| Images: deck photos, avatars, chat images                                         | expo-image disk cache in the app's cache directory         | Evicted by size and age; **Recommendation:** cleared on sign-out and account switch | Fetched through short-lived presigned URLs; the cache key is the versioned variant key, never the signed URL. Cache directories are not backed up                                                                                                        | [TR §5.1], [TR §15.2]            |
| Media being captured or uploaded: photos, clips, voice notes                      | App cache directory (temporary file)                       | Deleted as soon as the upload completes or is cancelled                             | Never saved to the device gallery by the app                                                                                                                                                                                                             | [TR §5.3]; Recommendation        |
| Liveness camera frames                                                            | Memory, inside the liveness component                      | The session                                                                         | Never written to disk by our code; the screen is protected (section 3.4)                                                                                                                                                                                 | [TR §5.1], [TR §16.1]            |
| Push token                                                                        | Held by the OS; sent to `POST /v1/me/push-tokens`          | Until invalid; removed with `DELETE /v1/me/push-tokens` on sign-out                 | Server row in `push_tokens`                                                                                                                                                                                                                              | [TR §8.2], [DD §11]              |
| Analytics identifiers (PostHog distinct id, `anon_id`, `session_id`)              | PostHog SDK storage; MMKV for our own ids                  | Created only after analytics consent; reset on sign-out and on consent withdrawal   | Pseudonymous. No event before consent                                                                                                                                                                                                                    | [TR §14], [SQL]                  |
| Logs and crash reports                                                            | Sentry                                                     | Vendor retention                                                                    | No PII in logs or crash reports: no names, e-mails, phone numbers, message text, tokens, coordinates. Ids only                                                                                                                                           | [TR §13.4]                       |
| Purchases                                                                         | RevenueCat SDK and the OS store                            | Managed by the SDK                                                                  | No card data in the app. "Restore purchases" re-syncs from RevenueCat                                                                                                                                                                                    | [TR §4.6], [TR §5.1]             |
| Member settings (theme, data saver, haptics, sounds, reduced motion)              | Server (`user_settings`); mirrored in MMKV for first paint | Until sign-out                                                                      | PII class none [DD §3]                                                                                                                                                                                                                                   | [DD §3]                          |

### 3.2 What must never be persisted on the device

Passwords and one-time codes (beyond the field while typing); the access token; full message
history in plain files; another member's exact or coarse coordinates; genotype or faith answers;
liveness frames or the selfie after upload; payment card details; admin or support internal notes;
presigned URLs; any server secret or cloud key ("the app never holds cloud keys" [TR §5.3]).

### 3.3 Query-cache rules (TanStack Query)

**Recommendation** (the sources name the library and the outbox only [TR §5.1]):

1. The query cache lives in memory. Disk persistence of the query cache is off by default.
2. A query may be persisted only if its data is PII class none (config, catalogues, i18n) or is the
   member's own settings. Persisted entries carry the user id in the key and a `buster` equal to
   the app's runtime version.
3. Query keys start with the surface and the user id (`['v1', userId, 'conversations', …]`) so one
   call clears everything for a member.
4. Sensitive queries (own genotype and faith answers, sessions list, billing history, verification
   state, export status) use `gcTime: 0` once the screen unmounts.
5. Server events invalidate rather than patch where a rule is involved: `entitlements.changed`,
   `account.restricted` [TR §8.3] refetch `me`, entitlements and account status.
6. Lists use the server's keyset cursors [TR §8.1]; a cursor is never stored beyond the session.
7. Offline shows the last in-memory data with its age (ES5); writes other than the outbox kinds are
   refused, not queued [TR §4.2].

### 3.4 Screens, clipboard and backups

| Topic                            | Rule                                                                                                                                                                                                                                                                                                                                                    | Source                |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| Screenshots and recording        | FLAG_SECURE on the liveness and payment screens (Android). **Recommendation:** on iOS, where there is no equivalent flag, those screens hide their content while the screen is being captured and in the app-switcher snapshot; the same snapshot cover applies to chats, the trusted-contacts screen and PM5 / PM6 on both platforms. See GAP-STD12-02 | [TR §5.1], [TR §13.4] |
| Clipboard                        | **Recommendation:** the app never copies a token, code or personal field to the clipboard on its own. OTP entry uses platform auto-fill (iOS `one-time-code`, Android SMS Retriever), not clipboard reading. Copying a message is a member action                                                                                                       | [TR §5.1]             |
| Device backups                   | **Recommendation:** Android `allowBackup` is off (or the backup rules exclude MMKV, caches and secure storage); on iOS, MMKV and cache files are flagged "do not back up" and Keychain items are "this device only". A restored phone therefore starts signed out and meets the new-device check                                                        | [TR §13.2]            |
| Notifications on the lock screen | Discreet mode and quiet hours are applied by the server before sending [TR §11]; rules for payloads are in [1MM-STD-18](1MM-STD-18-NOTIFICATIONS.md). No message text or sensitive field in a push payload when discreet mode is on                                                                                                                     | [TR §11], [DD §3]     |
| Keyboard                         | **Recommendation:** password and code fields disable keyboard learning and suggestions                                                                                                                                                                                                                                                                  | Recommendation        |

### 3.5 Clearing data

| Event                                                               | What the app does                                                                                                                                                                                                                                                                       | Source                         |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| Sign-out (member action)                                            | Call `POST /v1/auth/logout` and `DELETE /v1/me/push-tokens`; delete the refresh token; clear the query cache, Zustand stores, the outbox (after one final flush attempt), the image cache, temporary media and analytics ids; keep only PII-class-none config and the device identifier | [TR §8.2]; Recommendation      |
| Account switch on one device                                        | The same as sign-out, then sign-in. No data of the previous member may be visible to the next                                                                                                                                                                                           | Recommendation                 |
| Server revocation (`sess:deny`, token reuse, "It wasn't me", admin) | On the first 401 that refresh cannot recover, run the sign-out clean-up locally and show sign-in                                                                                                                                                                                        | [TR §8.1], [DD §14]            |
| Restriction or suspension (`account.restricted` event)              | Refetch account status; drop cached decks, likes and chats that the restriction scope no longer allows; show AS1. Tokens are kept so the member can read the decision and appeal                                                                                                        | [TR §8.3], [DD §9]             |
| Ban                                                                 | Sessions are revoked by the server; the app runs the sign-out clean-up and shows the account-state screen                                                                                                                                                                               | [SQL] `sessions.revoke_reason` |
| Deletion requested (AS3)                                            | The profile is hidden and the 14-day grace starts; the app keeps a session so the member can cancel (AS5). At execution the session is revoked (`revoke_reason = 'deletion'`) and the app clears everything                                                                             | [TR §16.2], [SQL]              |
| Consent withdrawn (analytics)                                       | Stop sending events, reset analytics ids                                                                                                                                                                                                                                                | [TR §14]                       |
| App uninstall                                                       | The OS removes the sandbox. The Keychain item is "this device only"; on reinstall the app treats any surviving item as invalid and starts signed out                                                                                                                                    | Recommendation                 |

## 4. Admin console (`apps/admin`)

| Data                                                                 | Store                                    | Lifetime                                   | Rule                                                                                                                                                                                                   | Source                |
| -------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------- |
| Session                                                              | HttpOnly, Secure, SameSite=Strict cookie | 30 min idle, 8 h absolute                  | Not readable by script. There is no token in JavaScript and no member token in the console                                                                                                             | [TR §7.1], [ADM §1.1] |
| Member and staff data from `/admin/v1` (lists, Member 360, evidence) | Memory only (TanStack Query)             | The tab; cleared at idle lock and sign-out | Never in `localStorage`, `sessionStorage`, IndexedDB or a service-worker cache. Personal fields arrive masked; a reveal is a separate audited call and its result is not cached after the panel closes | [ADM §1.3], [ADM A01] |
| Unsaved form drafts                                                  | Memory only                              | The tab                                    | "Kept in memory only (never in storage)" and restored after re-auth in the same tab                                                                                                                    | [ADM A03]             |
| Member media in the viewer                                           | Not stored                               | Presigned URL ≤ 5 min                      | Never cached by the service worker; watermarked                                                                                                                                                        | [ADM A01]             |
| Interface preferences: theme, column choices per view                | `localStorage`, wrapped in try/catch     | Until cleared                              | PII class none only. **Recommendation:** any "recent records" list stores ids and record kinds, never names, e-mails or phone numbers, and is cleared on sign-out                                      | [ADM A04], [ADM A01]  |
| Offline                                                              | Nothing queued                           | n/a                                        | Writes are disabled offline and never replayed later                                                                                                                                                   | [ADM §1.5]            |
| Exports                                                              | Downloaded file from a signed link       | File deleted on the server after 24 h      | Created as a job (`admin_exports`); the download is audited. What the admin does with the file is covered by staff policy, not by code                                                                 | [TR §16.1], [ADM A01] |
| Idle lock                                                            | n/a                                      | At 30 minutes                              | Content is blurred and replaced; the query cache is cleared so nothing is readable behind the lock (**Recommendation** on the cache)                                                                   | [ADM A03]             |

## 5. Billing web app (`apps/web`)

| Data                                      | Store                               | Rule                                                                                                                                                     | Source                    |
| ----------------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| Session                                   | Secure HttpOnly cookie              | The same auth as the app; a new device triggers L2 / L3. SameSite and CSRF rule: see GAP-STD11-07 in [1MM-STD-11](1MM-STD-11-SECURITY-AND-COMPLIANCE.md) | [TR §6.2]                 |
| Billing state, history, proration preview | Memory only (TanStack Query)        | Never in browser storage. Cleared on sign-out                                                                                                            | [TR §6.2]; Recommendation |
| Card details                              | Never in our page or our storage    | Entered only in Flutterwave hosted checkout. We show brand, last four digits and expiry from `payment_methods`                                           | [TR §13.4], [DD §10]      |
| Idempotency key for a checkout attempt    | Memory for the attempt              | Sent as `Idempotency-Key`; a retry reuses it                                                                                                             | [TR §8.1]                 |
| Theme and locale preference               | `localStorage` / cookie, class none | Same keys and rules as the website                                                                                                                       | [WEB §3.1], [WEB §3.8]    |
| Analytics                                 | Only after consent                  | No payment data in events                                                                                                                                | [TR §14]                  |

## 6. Public website (`apps/site`)

The website has no sign-in [DD §13]. By default it uses only strictly necessary storage [WEB §3.10].

| Data                                | Store                                                                  | Lifetime                                      | Rule                                                                                                                                                  | Source                   |
| ----------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| Consent state                       | First-party cookie `mm_consent` = `{v, ts, c: {analytics, marketing}}` | 6 months; re-asked on a policy version change | Strictly necessary. A pseudonymous receipt (random id, choices, policy version, timestamp, locale; no IP) is logged server-side in `consent_receipts` | [WEB §3.10], [SQL]       |
| Locale choice                       | Cookie `mm_locale`                                                     | 12 months                                     | Strictly necessary; never an automatic redirect                                                                                                       | [WEB §3.8]               |
| Theme choice                        | `localStorage` key `mm-theme` (`system`, `light`, `dark`)              | Until cleared                                 | Strictly necessary; every read and write in try/catch                                                                                                 | [WEB §3.1]               |
| Banner dismissal                    | `sessionStorage`, per banner id                                        | The tab                                       | Class none                                                                                                                                            | [WEB W06]                |
| A failed form draft (safety report) | `sessionStorage`, on the device only                                   | Cleared on success or when the tab closes     | Only where the website spec allows it (W34); no other form persists its fields                                                                        | [WEB W34]                |
| Analytics (PostHog)                 | PostHog storage                                                        | Only after Analytics consent                  | The library is not loaded at all before consent. Global Privacy Control counts as "Reject all"                                                        | [WEB §3.10], [WEB §3.11] |
| Form contents                       | Never stored in the browser                                            | n/a                                           | Forms always POST; no personal data in URLs or query strings; form endpoints and tokenised pages are `Cache-Control: no-store`                        | [WEB §3.10], [WEB §3.12] |
| Trusted-contact page `/s/<token>`   | Nothing stored                                                         | n/a                                           | `no-store`; the token is in the path only and is never sent to analytics                                                                              | [WEB §3.12], [OD-13]     |

No fingerprinting, no marketing pixels at launch [WEB §3.10].

## 7. Server side

### 7.1 PostgreSQL: the system of record

Neon PostgreSQL 16 with PostGIS, citext and pgcrypto, Frankfurt; encrypted at rest; TLS only;
reached through the built-in pooler [TR §4.3]. Schema v3.4: 221 tables, 9 partitioned monthly, 14
RLS policies [TR §10.1]. Rules:

- Every durable fact is a row here first. Notifications and outbound events are outbox rows written
  in the same transaction as the change [TR §4.2].
- Multi-row changes happen in one transaction [TR §13.1].
- Append-only ledgers cannot be edited: `admin_audit_log`, `consent_records`, `moderation_actions`,
  `content_revisions`, `consent_receipts` have UPDATE and DELETE revoked for the application roles
  (`packages/db/roles/roles.sql`).
- Staging is a separate Neon project, never a branch of production [TR §4.3].

### 7.2 Redis: a speed layer (Upstash, Frankfurt, TLS)

The whole keyspace, from [DD §14]. A new key needs a row here, a TTL and a Postgres fallback if it
must survive a flush.

| Key pattern                                       | Type                            | TTL                                                            | Purpose                                         | Personal data in it       | Durable copy                             |
| ------------------------------------------------- | ------------------------------- | -------------------------------------------------------------- | ----------------------------------------------- | ------------------------- | ---------------------------------------- |
| `presence:{user_id}`                              | hash {state, last_seen, device} | 120 s, refreshed by a 30 s heartbeat                           | Active now. Invisible (Gold) is never published | user id, state            | none (ephemeral)                         |
| `ws:conn:{user_id}`                               | set of connection ids           | 120 s                                                          | WebSocket fan-out across API instances          | user id                   | none                                     |
| `ch:user:{user_id}` / `ch:conv:{conversation_id}` | pub/sub channels                | n/a                                                            | match, message, intro and typing events         | event payloads in transit | PostgreSQL (written first)               |
| `typing:{conversation_id}:{user_id}`              | string                          | 6 s                                                            | Typing indicator                                | ids                       | never stored                             |
| `intro:presence:{session_id}`                     | set of user ids                 | 120 s                                                          | Starts the 60 s timer when both are present     | ids                       | `intro_sessions`                         |
| `feed:{user_id}:{tab}`                            | list of 50 candidate ids        | 15 min; refilled when < 15 left                                | Deck tabs                                       | ids                       | rebuilt by `feed.refill`                 |
| `feed:served:{user_id}:{local_date}`              | set                             | 48 h                                                           | No repeats within a day                         | ids                       | `feed_impressions`                       |
| `scarcity:{user_id}:{local_date}`                 | string                          | 1 h                                                            | Scarcity card                                   | id                        | recomputed                               |
| `quota:specs:{user_id}:{local_date}`              | counter                         | until local midnight + 24 h                                    | Daily spec cap                                  | id                        | `usage_counters`                         |
| `quota:ds:{user_id}:{iso_week}`                   | counter                         | 8 days                                                         | 20 Direct Specs a week                          | id                        | `usage_counters`                         |
| `quota:ds_abroad:{user_id}`                       | counter                         | 7 days from the Gold start                                     | Max 2 Direct Specs abroad in the first 7 days   | id                        | `usage_counters`                         |
| `quota:export:{user_id}:{date}`                   | flag                            | 24 h                                                           | Data export once a day                          | id                        | `usage_counters`, `data_export_requests` |
| `rl:{policy}:{subject}`                           | sorted set (sliding window)     | = policy window                                                | Rate limits                                     | subject (IP, id or hash)  | `rate_limit_policies` (the policy)       |
| `lock:{policy}:{subject}`                         | string                          | `lockout_seconds` (15 or 30 min)                               | X1 pause, OTP lock                              | subject hash              | `account_lockouts`                       |
| `otp:cooldown:{destination_hash}`                 | string                          | 60 s                                                           | Resend cooldown                                 | hash only                 | `otp_challenges`                         |
| `ent:{user_id}`                                   | JSON entitlements               | 10 min; deleted on billing, verification and moderation events | Gating on every request                         | id, plan                  | `v_member_entitlements`                  |
| `badge:{user_id}`                                 | hash of unread counts           | 60 s; deleted on change                                        | Tab badges                                      | id, counts                | `v_unread_counts`                        |
| `idem:{route}:{idempotency_key}`                  | stored response                 | 24 h                                                           | Idempotency replay                              | the stored response       | the business row                         |
| `sess:deny:{session_id}`                          | flag                            | 15 min (access-token lifetime)                                 | Immediate revocation                            | session id                | `sessions.revoked_at`                    |
| `spotlight:live:{city_id}`                        | sorted set                      | until the turn ends                                            | Spotlight ordering                              | ids                       | `spotlight_rotations`                    |
| `notif:throttle:{user_id}:{template}`             | counter                         | 1 h (likes batch), 24 h (N10)                                  | Notification throttles                          | id                        | `notifications`                          |
| `cfg:remote` / `cfg:flags`                        | hash                            | 60 s                                                           | Config and flags                                | none                      | `remote_config`, `feature_flags`         |
| `admin:reauth:{admin_session_id}`                 | flag                            | 5 min                                                          | Fresh-MFA window                                | session id                | `admin_sessions.reauth_at`               |
| `call:ring:{call_id}`                             | string                          | `calls.ring_timeout_seconds` (45 s)                            | Ringing timeout (after public launch)           | call id                   | `calls`                                  |

Rules: a key holds ids, counters and flags, not names, contact details, message text or coordinates;
subjects that would be an e-mail or phone are hashed; every key has a TTL; no `KEYS` scans. The
one value that can hold personal data is the `idem:*` stored response: **Recommendation:** store
the status and the resource id, and rebuild the body on replay, for any response that carries
personal fields.

### 7.3 Cloudflare R2 media (EU jurisdiction)

| Bucket             | Holds                                     | Access                                                                                           | Lifecycle                                    | Source                |
| ------------------ | ----------------------------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------- | --------------------- |
| `media-quarantine` | New uploads, unprocessed                  | Private. Written by clients through presigned URLs with type and size limits; read by the worker | Until `media.process` finishes               | [TR §4.3]             |
| `media-originals`  | Processed originals                       | Private. Worker and API only                                                                     | With the asset (`media_assets.purge_after`)  | [TR §4.3]             |
| `media-variants`   | AVIF / WebP sizes, 720p H.264 + HLS, Opus | Private. Served only by short-lived presigned URLs issued by the API                             | With the asset; versioned keys               | [TR §4.3], [TR §15.2] |
| `exports`          | Member data-export ZIPs                   | Private. Signed link valid 7 days                                                                | 7-day lifecycle rule; row deleted at 30 days | [TR §4.3], [TR §16.1] |
| `backups`          | Nightly database dumps                    | Private. Worker only                                                                             | 30-day lifecycle; monthly copy 12 months     | [TR §4.3], [TR §10.3] |
| Website uploads    | An R2 quarantine prefix for `web_uploads` | Private. Opens in the admin console only when `scan_status = 'clean'`                            | Unattached 24 h; infected at once            | [TR §6.1]             |

Rules:

1. No bucket is public. A URL is issued only after the API has checked that the caller may see that
   asset (block state, match or membership, admin permission).
2. The database stores the object key (`media_assets.storage_key`, `variants`), never a URL. Clients
   receive a signed URL in the response DTO and must not store it (sections 3.2, 4).
3. Every upload is re-encoded; EXIF and GPS are stripped; the original bytes are never served
   [TR §13.1].
4. `media_assets.status` moves `quarantine` → `processing` → `active` / `rejected`; only `active`
   assets get read URLs for other members ([1MM-STD-15](1MM-STD-15-DATA-STRUCTURES-AND-MODELS.md) §4.3).
5. Deleting a row is not deleting the data: the purge job deletes the objects in every bucket and
   records it ([coordinator ruling R23](../execution/1MM-EXE-00-MASTER-PLAN.md#7-coordinator-rulings)).
6. Admin viewer URLs last at most 5 minutes [ADM A01]. **Recommendation:** member read URLs last
   minutes, not hours, and the exact lifetime is a `remote_config` key (GAP-STD12-03).

### 7.4 Queues (pg-boss)

pg-boss runs in its own `pgboss` schema owned by `app_queue`, which has no privileges on business
tables (`packages/db/roles/roles.sql`). Therefore:

- **A job payload carries ids and small non-personal parameters only** (`{ mediaId }`,
  `{ userId, templateCode }`), never a name, address, phone number, message text, token, code or
  file content. The handler loads what it needs under `app_worker`.
- Notification content is rendered at delivery from the `notifications` outbox row and the
  template, not carried in the job [TR §4.2].
- Job run records keep counts and ids (per-rule purge counts for A36, ruling R23), not row
  contents.
- pg-boss archives are trimmed by its own retention; nothing personal means nothing to erase there.

### 7.5 Logs, traces and metrics

| Signal               | Where                                           | Contains                                                                  | Must never contain                                                                   | Retention                    | Source     |
| -------------------- | ----------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ---------------------------- | ---------- |
| Application logs     | Structured JSON, Railway                        | Request id, route key, status, latency, ids                               | Message bodies, passwords, codes, tokens, face data, card data; e-mail, phone, names | 30 days hot, 1 year archived | [TR §14]   |
| Traces               | OpenTelemetry, app → API → DB / Redis / vendors | Spans with the request id                                                 | Query parameter values that are personal; request and response bodies                | Vendor                       | [TR §14]   |
| Errors               | Sentry (app, web, admin, API, worker)           | Stack, release, request id                                                | PII; **Recommendation:** scrub request bodies, headers and breadcrumbs before send   | Vendor                       | [TR §14]   |
| Request rollups      | `api_request_rollups` (1-minute buckets)        | Counts and percentiles by route, method, status class, platform, country  | Anything per person                                                                  | 13 months                    | [TR §14]   |
| Request samples      | `api_request_samples` (all 5xx, 1% of the rest) | `user_hash`, `ip_prefix` (/24, /48), route, status, latency               | Full IP, user id, body                                                               | 14 days                      | [ADM A32]  |
| Edge security events | `edge_security_events`                          | Rule, action, IP prefix, ASN, country, user-agent family                  | Full IP                                                                              | 90 days                      | [DD §13]   |
| Audit                | `admin_audit_log`                               | Changed fields only, personal fields masked unless the action is a reveal | Secrets; unmasked personal fields outside reveals                                    | 7 years                      | [ADM §1.3] |

### 7.6 Analytics

Product analytics go to PostHog Cloud (EU hosting) only after consent, plus our own
`analytics_events` copy (partitioned monthly, 13 months raw, then aggregated) [TR §14], [TR §16.1].
Event names follow `screen.action`. `properties` never hold free text typed by a member, contact
details, coordinates, sensitive answers or another member's id in a way that reveals a
relationship beyond what the event needs. Website server-side counts use no cookies or identifiers
and truncate the IP before logging [WEB §3.11]. Reporting reads aggregates through `app_readonly`.

### 7.7 Encryption and hashing

**In transit:** TLS everywhere: clients to Cloudflare, Cloudflare to the origin, and the API and
worker to Neon, Upstash, R2 and vendors; the API and worker talk over Railway's private network
[TR §4.3], [TR §13.1].

**At rest:** Neon is encrypted at rest [TR §4.3]. The Technical Reference states "KMS at rest"
[TR §13.1]; envelope encryption keys are in AWS KMS, one key set per environment [TR §13.4],
[TR §4.4].

**Field-level encryption** (columns ending `_enc`, type `bytea`, encrypted by the application with a
KMS data key before the write; found by grep of [SQL]):

| Column                                   | What it protects                                         | Lookup companion                   |
| ---------------------------------------- | -------------------------------------------------------- | ---------------------------------- |
| `face_templates.vendor_template_ref_enc` | Reference to the vendor face template                    | `dedupe_fingerprint` (one-way)     |
| `admin_mfa_factors.totp_secret_enc`      | Admin TOTP secret                                        | none                               |
| `notifications.recipient_enc`            | E-mail or phone of a non-member recipient                | `recipient_hash`                   |
| `newsletter_subscribers.email_enc`       | Subscriber e-mail                                        | `email_hash` (the only lookup key) |
| `waitlist_entries.identifier_enc`        | Waitlist e-mail or phone (NULL once status is `deleted`) | `identifier_hash`                  |
| `story_consents.email_enc`               | Story partner e-mail                                     | `email_hash`                       |
| `contact_submissions.payload_enc`        | Extra form fields as encrypted JSON                      | none                               |
| `offer_claims.identifier_enc`            | Offer claimant (offers are off at launch)                | `identifier_hash`                  |
| `offer_codes.code_enc`                   | Unissued promo code (set NULL when issued)               | `code_hash`                        |

**Hashed, never stored in clear** (domain `sha256_hash` = 32-byte `bytea`, unless noted):

| Kind                     | Columns                                                                                                                                                                                                                                            |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Passwords                | `password_credentials.password_hash` (Argon2id, enforced by CHECK), `admin_users.password_hash`                                                                                                                                                    |
| Session and reset tokens | `refresh_tokens.token_hash`, `admin_sessions.token_hash`, `admin_users.invite_token_hash`, `admin_recovery_codes.code_hash`                                                                                                                        |
| One-time codes           | `otp_challenges.code_hash` (text), `otp_challenges.destination_hash`                                                                                                                                                                               |
| Link and invite tokens   | `meetup_shares.token_hash`, `beta_invites.code_hash`, `newsletter_subscribers.confirm_token_hash` and `manage_token_hash`, `waitlist_entries.confirm_token_hash`, `story_consents.confirm_token_hash`                                              |
| Identifiers for lookup   | `login_attempts.identifier_hash`, `account_lockouts.subject_hash`, `admin_login_attempts.email_hash`, `trials.identity_key_hash`, `beta_invites.identifier_hash`, `investor_document_grants.recipient_email_hash`, `api_request_samples.user_hash` |
| Devices                  | `devices.fingerprint_hash`, `login_attempts.device_fingerprint_hash`, `risk_devices.fingerprint_hash`, `age_gate_blocks.device_hash`, `help_article_votes.anon_device_hash`, `admin_trusted_devices.device_cert_fingerprint`                       |
| Content integrity        | `media_assets.sha256`, `web_uploads.sha256`, `consent_records.text_hash`, `newsletter_subscribers.consent_text_hash`, `message_failures.body_hash` (no body kept), `admin_audit_log.prev_hash` / `row_hash`                                        |

Rules for new columns:

1. A token or code that we only need to recognise is stored as a hash. Hash low-entropy inputs
   (e-mail, phone, device id) with a keyed hash (HMAC with a server-side key) so the table cannot
   be reversed by enumeration. **Recommendation**; the keyed-hash requirement is not stated in the
   sources (GAP-STD12-04).
2. A value we must read back later and that identifies a non-member, or is a secret, is stored
   `_enc` with a `_hash` companion when it must be looked up.
3. Secrets never go in a table: `vendor_settings` holds a `vault://` reference, a version and the
   last four characters, and its JSON refuses secret-shaped keys (`jsonb_has_secret_keys()`) [SQL].
4. Member-identity columns that are stored in clear because the product queries them (`users.email`,
   `phone_numbers.e164`, `trusted_contacts.phone`, `profiles.birth_date`, `messages.body`) rely on
   at-rest encryption, roles, RLS and admin masking. Whether any of these should move to
   field-level encryption is raised as GAP-STD12-05.

### 7.8 Backups

Neon point-in-time restore (window per plan); a nightly `pg_dump` to the R2 `backups` bucket kept 30
days and a monthly copy kept 12 months; a restore drill every quarter with targets RTO under 1 hour
and RPO under 5 minutes [TR §10.3]. Consequences for data handling:

- A backup contains every class of data, so access to `backups` is as sensitive as access to the
  database (encryption of dumps: GAP-STD11-09 in
  [1MM-STD-11](1MM-STD-11-SECURITY-AND-COMPLIANCE.md)).
- Erased data lingers in backups until they age out: at most 30 days in dumps and 12 months in the
  monthly copy. After any restore, the erasure and retention jobs are re-run before the database
  serves traffic, using `account_deletions` (kept pseudonymised as proof) to replay deletions.
  **Recommendation**; the replay step is not in the sources (GAP-STD12-06).
- A restore drill uses an isolated environment with production-grade access control, never staging.

## 8. Access paths by database role

From `packages/db/roles/roles.sql`. Group roles cannot log in; each environment creates its own
login users as members of exactly one group.

| Role            | Used by                             | Can do                                                                                                                                                                                                      | Cannot do                                                                                                                                                                        |
| --------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app_migrator`  | `pnpm db:migrate` in a release step | Owns the schema; DDL; `schema_migrations`                                                                                                                                                                   | Used by no running service                                                                                                                                                       |
| `app_api`       | Member and public API               | Read and write rows, **subject to row-level security** (`SET LOCAL app.user_id` per transaction)                                                                                                            | DDL; UPDATE / DELETE on the append-only ledgers; any access to `admin_recovery_codes`, `vendor_settings`, `offer_codes`, `offer_claims`, `waitlist_entries`, `schema_migrations` |
| `app_admin_api` | Admin API                           | Read and write rows, bypasses RLS (permissions enforced in code and audited)                                                                                                                                | DDL; UPDATE / DELETE on the ledgers; `schema_migrations`                                                                                                                         |
| `app_worker`    | Background jobs                     | Read and write rows, bypasses RLS; `ensure_monthly_partitions()` (the one DDL action, SECURITY DEFINER)                                                                                                     | Other DDL; UPDATE / DELETE on the ledgers; `schema_migrations`                                                                                                                   |
| `app_queue`     | pg-boss                             | Owns the `pgboss` schema                                                                                                                                                                                    | Anything on business tables                                                                                                                                                      |
| `app_readonly`  | Analytics                           | SELECT on `mv_admin_daily_kpis`, `mv_revenue_daily`, `mv_moderation_sla`, `v_research_summary`, `mv_admin_daily_kpis_by_country`, `mv_active_users_daily`, `store_installs_daily`, `api_request_ip_rollups` | Any table with personal data                                                                                                                                                     |

Rules: one connection pool per role; the public website endpoints run as `app_api` with no
`app.user_id` set and must not query member tables at all. RLS is not the guard there: with
`app.user_id` unset the `profiles_read` policy still returns every non-hidden profile
(GAP-DB05-03 in [1MM-DB-05](../database/1MM-DB-05-SECURITY.md)), so the rule is enforced in the
public surface's code and tests. No service connects as
`app_migrator`; no human queries production with a write role outside the break-glass procedure
([1MM-STD-11](1MM-STD-11-SECURITY-AND-COMPLIANCE.md) THR-59). RLS is enabled on `profiles`,
`reactions`, `conversation_participants`, `messages`, `inbox_items`, `consent_records`,
`trusted_contacts`, `blocks`, `data_export_requests` and `reverification_requests` [SQL]. Detail:
[1MM-DB-05](../database/1MM-DB-05-SECURITY.md).

## 9. Environment separation

| Environment | Data allowed                                                | Payments                                        | OTP and e-mail                       | Source             |
| ----------- | ----------------------------------------------------------- | ----------------------------------------------- | ------------------------------------ | ------------------ |
| demo        | Test accounts and dummy data only; never real personal data | Flutterwave test mode / store sandbox           | Test numbers                         | [TR §4.4], [OD-10] |
| local       | Seed only                                                   | Flutterwave test mode                           | Console sink                         | [TR §4.4]          |
| dev         | Synthetic                                                   | Test mode, store sandbox via RevenueCat sandbox | Test numbers, Resend sandbox domain  | [TR §4.4]          |
| staging     | Synthetic plus research fixtures                            | Sandbox only                                    | Real providers, allow-listed numbers | [TR §4.4]          |
| production  | Real                                                        | Live                                            | Live                                 | [TR §4.4]          |

- Staging and production are fully separate: Railway environments, Neon projects, Upstash databases,
  R2 buckets and KMS keys [TR §4.4].
- No production data in lower environments: no dump, no "anonymised" copy, no screenshot of a real
  member in a fixture or a test. Fixtures are written by hand or generated.
- Sandbox payments are marked `transactions.environment = 'sandbox'` and stay out of revenue
  [DD §10].
- Preview deployments of the web apps talk only to non-production APIs [TR §4.4].
- Until the legal steps of [OD-10] are done, the production website collects no real personal data
  either [WEB §3.10].

## 10. Data residency

The origin is in the EU: API and worker on Railway EU West (Amsterdam), PostgreSQL on Neon and Redis
on Upstash in Frankfurt, R2 with EU jurisdiction; Cloudflare serves Lagos from its local edge
[TR §4.3], [OD-11]. AWS is used only for Rekognition Face Liveness and KMS [OD-06]. PostHog uses EU
hosting [TR §14].

- Member data therefore leaves Nigeria. The transfer is part of the lawyer review under [OD-10];
  the transfer mechanism is **Counsel**'s to confirm
  ([1MM-STD-11](1MM-STD-11-SECURITY-AND-COMPLIANCE.md) §6.1).
- A new vendor or region that stores or processes personal data is a residency change: it needs an
  ADR, a vendor DPA [TR §16.2] and an update to this section.
- The AWS region used for Rekognition and KMS is not stated in the sources: GAP-STD12-07.
- Growth path: the origin moves to AWS af-south-1 only if a market requires local hosting or load
  outgrows these tiers; the code stays portable [TR §4.3].

## 11. Retention and deletion

The schedule is [TR §16.1]; each table's rule is in its [DD] row. Jobs are in [TR §11].

| Data                                             | Kept for                                               | Then                                                                         | Job                                       |
| ------------------------------------------------ | ------------------------------------------------------ | ---------------------------------------------------------------------------- | ----------------------------------------- |
| Liveness video / selfie frames                   | Until the review decision (max 30 days)                | Deleted at the vendor and by us                                              | `liveness.purge`                          |
| Face template (vendor reference)                 | While the account is active and consent stands         | Deleted on consent withdrawal or erasure; one-way fingerprint only if banned | `erasure.run`; PM4 withdrawal             |
| Profile, photos, prompts, preferences            | Account                                                | Erased 14 days after a deletion request                                      | `erasure.run`                             |
| Sensitive answers (genotype, faith)              | While consent stands                                   | Erased within 30 days of withdrawal                                          | `sensitive.erase`                         |
| Media soft-deleted / hidden after a lapse        | 30 days / 90 days                                      | Deleted                                                                      | `retention.purge` / `lapse.purge`         |
| Intro voice notes                                | 30 days unless both kept talking                       | Deleted                                                                      | `intro.audio.purge`                       |
| Messages                                         | While the conversation exists                          | Deleted on unmatch (after evidence snapshot), block or erasure               | `unmatch()`; `erasure.run`                |
| Report evidence                                  | 12 months after resolution                             | Deleted unless there is a legal hold                                         | `retention.purge`                         |
| Check-in location                                | 30 days after the meet-up                              | Deleted                                                                      | `safety.location.purge`                   |
| Trusted-contact links                            | 24 h after the meet-up                                 | Expired; rows purged at 30 days                                              | `share_links.expire`                      |
| Payments, invoices, subscriptions                | 7 years (tax)                                          | Kept with the member pseudonymised                                           | `erasure.run` (pseudonymise)              |
| Consent records                                  | Account + 6 years                                      | Accountability evidence                                                      | `retention.purge`                         |
| Moderation actions, admin audit log              | 7 years                                                | Cold storage                                                                 | `partitions.retain`                       |
| OTP challenges / login attempts / refresh tokens | 30 days / 90 days / 7 days after expiry                | Deleted                                                                      | `retention.purge`                         |
| Feed impressions / notifications / inbox         | 90 / 90 / 180 days                                     | Deleted                                                                      | `retention.purge`, `partitions.retain`    |
| Analytics events                                 | 13 months raw                                          | Aggregated                                                                   | `partitions.retain`                       |
| Request samples / rollups                        | 14 days / 13 months                                    | Deleted                                                                      | `retention.purge`                         |
| Support tickets, feedback                        | 24 months after close                                  | Deleted                                                                      | `retention.purge`                         |
| Data exports                                     | Link valid 7 days                                      | Deleted at 30 days                                                           | `exports.purge`                           |
| Job applications / contact forms                 | 12 / 24 months                                         | Deleted                                                                      | `applications.purge`, `contact.retention` |
| Website uploads                                  | Unattached 24 h; attached with the parent row          | Deleted (infected files at once)                                             | `web_uploads.purge`                       |
| Admin export files                               | 24 h (row 7 years)                                     | Deleted                                                                      | per [TR §16.1]                            |
| Privacy requests                                 | Answered within `privacy.sla_days.*` (30, provisional) | Register kept 6 years                                                        | n/a                                       |
| Newsletter                                       | Until unsubscribe + 30 days                            | Deleted                                                                      | `newsletter.purge`                        |
| Application logs                                 | 30 days hot, 1 year archived                           | Never contain bodies, passwords, codes or tokens                             | platform                                  |

Rules:

1. **Deletion is a 14-day process.** AS3 schedules it (`users.status = 'deletion_pending'`,
   `account_deletions.scheduled_for` = +14 days), day 7 sends a reminder, AS5 cancels, and
   `erasure.run` executes: profile, media, chats and the face template (unless banned) are erased,
   payments are pseudonymised and the web plan is cancelled [TR §11], [DD §9].
2. **Soft delete is a waiting room, not a destination.** A row with `deleted_at` or `purge_after`
   has a job that hard-deletes it and its R2 objects ([1MM-STD-15](1MM-STD-15-DATA-STRUCTURES-AND-MODELS.md) §2.6).
3. **Legal hold wins over purge.** Purge jobs check `has_legal_hold()` and skip held rows
   [TR §11], [SQL].
4. **Every table is in the manifests.** A module that adds a table registers it in the erasure and
   export manifests owned by MOD-16 and returns per-rule purge counts (ruling R23).
5. **Deleting means everywhere:** PostgreSQL row, R2 objects in every bucket, Redis keys for that
   member, the vendor copy (liveness media, Flutterwave card token [DD §10]), analytics identity.
6. Retention periods are those the lawyer confirms (T-9 in [OD-31]); the job is built now.

## 12. Decision table: "I need to store X"

| I need to store…                              | Where                                                                  | How long                                          | Protected how                                                                       |
| --------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------- |
| A durable business fact                       | PostgreSQL table, migration in `packages/db/migrations/`               | Its [TR §16.1] rule; add one if new               | PII class set; role grants; RLS if member-readable; manifests (ruling R23)          |
| A counter or quota that must be fast          | Redis key (section 7.2 pattern) plus `usage_counters`                  | TTL = the window                                  | Ids only; the Postgres row is the truth                                             |
| A lockout                                     | `lock:{policy}:{subject}` plus `account_lockouts`                      | `lockout_seconds`                                 | Subject hashed                                                                      |
| A cache of a computed read                    | Redis with a TTL and an explicit invalidation event                    | Minutes                                           | Ids and class-none data; never the only copy                                        |
| A password                                    | `password_credentials.password_hash`                                   | Account                                           | Argon2id only                                                                       |
| A one-time code or link token                 | A `*_hash` column with `expires_at`                                    | Minutes to days, stated in the row                | Hash only; single use; rate-limited verify                                          |
| A member session                              | `sessions` + `refresh_tokens` (hash); device: secure storage           | 30 days rotating; rows purged 7 days after expiry | Reuse detection; `sess:deny`                                                        |
| An admin session                              | `admin_sessions` (hash); browser: HttpOnly cookie                      | 30 min idle, 8 h absolute                         | SameSite=Strict; IP allow list                                                      |
| A photo, clip or voice note                   | R2 through `POST /v1/media/upload-url`; `media_assets` row             | Account; soft delete 30 days                      | Quarantine → process → private variants; signed reads                               |
| A file from a website visitor                 | R2 quarantine prefix through `POST /public/v1/uploads`; `web_uploads`  | 24 h unattached; else with the parent row         | Type and virus scan; opens only when `clean`                                        |
| An e-mail or phone of a non-member            | `_enc` column + `_hash` companion                                      | The parent row's rule                             | KMS envelope encryption                                                             |
| A vendor secret or API key                    | Railway sealed variable; `vendor_settings.secret_ref` points to it     | Until rotated                                     | Never in a table, the repo, a log or a client bundle                                |
| A tunable limit, timer or label set           | `remote_config` / a catalogue / `i18n_strings`                         | Permanent, versioned by audit                     | Permissioned edit; approval in production                                           |
| A location                                    | `profiles.location` (coarse) or `safety_checkins.last_coarse_location` | Account / 30 days after the meet-up               | Coarse point only; never an exact fix; never sent to other members as coordinates   |
| A sensitive answer (genotype, faith)          | `profile_answers` with the matching `consent_records` row              | While consent stands                              | Matching input only; never displayed, cached client-side or exported to staff views |
| A payment record                              | `transactions` / `refunds` / `invoices` from provider events           | 7 years, pseudonymised after erasure              | No PAN or CVV; idempotency key; provider reference                                  |
| An audit fact                                 | `admin_audit_log` (same transaction as the change)                     | 7 years                                           | Append-only, hash-chained, masked fields                                            |
| A consent                                     | `consent_records` (members) / `consent_receipts` (website)             | Account + 6 years                                 | Append-only; version and text hash                                                  |
| Something to do later                         | pg-boss job                                                            | Until done                                        | Payload = ids only                                                                  |
| Something to tell a member                    | `notifications` outbox row in the same transaction                     | 90 days                                           | Template code and params; rendered at delivery                                      |
| A product analytics event                     | `POST /v1/events` → `analytics_events` and PostHog                     | 13 months raw                                     | Consent first; pseudonymous; no free text                                           |
| A debugging detail                            | A structured log line with the request id                              | 30 days hot                                       | Ids only; no bodies, secrets or contact details                                     |
| On the phone: a credential                    | expo-secure-store                                                      | Until sign-out                                    | Keychain / Keystore, this device only                                               |
| On the phone: an action to replay offline     | MMKV outbox (reactions, reads, status changes only)                    | Until acknowledged                                | Client id; encrypted store; ids only                                                |
| On the phone: server data for display         | TanStack Query memory cache                                            | Session                                           | Cleared on sign-out; not persisted unless class none                                |
| In the admin browser: anything about a person | Memory only                                                            | The tab                                           | Never browser storage                                                               |
| In a browser: a visitor preference            | `mm_consent`, `mm_locale` cookies; `mm-theme` in `localStorage`        | 6 months / 12 months / until cleared              | Strictly necessary, no personal data                                                |
| A copy of production data for testing         | Nowhere                                                                | Never                                             | Use synthetic fixtures (section 9)                                                  |

If X is not in this table, stop and add the row in a pull request to this document before writing
the code.

## 13. Gaps raised

Dispositions are recorded in [1MM-LOG-03](../1MM-LOG-03-TECHNICAL-REFERENCE-EXTENSIONS.md)
(Technical Reference and schema), [1MM-LOG-02](../1MM-LOG-02-UI-UPDATES.md) (UI) and
[1MM-LOG-04](../1MM-LOG-04-OPEN-DECISIONS-AND-FOLLOW-UPS.md) (owner decisions and repository
follow-ups).

| Gap id       | Type     | Where found                                                    | What is missing or conflicting                                                                                                                                                                                                                                      | Proposed resolution                                                                                                                                                                                                        | Blocks                         |
| ------------ | -------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| GAP-STD12-01 | TR       | [TR §5.1], [TR §5.3], [TR §13.4]                               | The Technical Reference names secure storage for refresh tokens and the MMKV outbox, but not: where the access token lives, whether MMKV is encrypted, query-cache persistence, clipboard, device-backup exclusions, or the clean-up on sign-out and account switch | Add a "Client data handling" subsection to [TR §5.3] adopting sections 3.1–3.5, 4 and 5 of this document                                                                                                                   | MOD-00 and MOD-03 mobile tasks |
| GAP-STD12-02 | TR       | [TR §5.1], [TR §13.4]                                          | "FLAG_SECURE on liveness and payment screens" is Android-only. iOS behaviour and the list of other sensitive screens (chat, trusted contacts, sessions) are not stated                                                                                              | State in [TR §13.4]: iOS covers content during capture and in the app-switcher snapshot on the same screens; list the screens by id. Owner to confirm whether chats are covered (a product trade-off)                      | MOD-06, MOD-08, MOD-10 mobile  |
| GAP-STD12-03 | SCHEMA   | [TR §4.3] "short-lived presigned URLs"                         | No config key sets the lifetime of member media read URLs or upload URLs (the admin viewer is ≤ 5 min in [ADM A01])                                                                                                                                                 | Seed two `remote_config` rows, `media.read_url_ttl_seconds` = 300 and `media.upload_url_ttl_seconds` = 600 (values proposed; `is_public` false, `group_key` 'media', `unit` 'seconds', `min_value` 60, `max_value` 3600)   | MOD-04 API gate                |
| GAP-STD12-04 | TR       | [SQL] `sha256_hash` lookup columns                             | The schema stores identifier hashes as 32-byte values but no source says whether they are plain SHA-256 or keyed. A plain hash of a phone number or e-mail can be reversed by enumeration                                                                           | State in [TR §13.4]: identifier and device hashes are HMAC-SHA-256 with a per-environment key held as a sealed variable; token hashes (high entropy) stay plain SHA-256 as [TR §8.1] says for refresh tokens               | MOD-03 API gate                |
| GAP-STD12-05 | DECISION | [SQL] `users`, `phone_numbers`, `trusted_contacts`, `messages` | Member e-mail, phone, trusted-contact phone, birth date and message bodies are stored in clear and rely on at-rest encryption, roles and RLS. Non-member addresses are field-encrypted. The sources do not say this difference is intended                          | Owner and interim DPO confirm the current design as accepted (searchable identity columns stay in clear), or ask for field-level encryption of `trusted_contacts.phone` (third-party data, never searched) as a first step | DPIA in MOD-19                 |
| GAP-STD12-06 | TR       | [TR §10.3]                                                     | Nothing says how erasures are honoured after a restore from backup                                                                                                                                                                                                  | Add to [TR §10.3]: after any restore, replay `account_deletions` and run the retention jobs before serving traffic; record it in the restore drill                                                                         | MOD-00 OPS, MOD-16             |
| GAP-STD12-07 | TR       | [TR §4.3], [OD-06]                                             | The AWS region for Rekognition Face Liveness and KMS is not stated, so the residency statement for biometric processing is incomplete                                                                                                                               | Name the region in [TR §4.3] (an EU region that offers Face Liveness, to match the EU origin) and list it in the DPIA                                                                                                      | MOD-06 OPS                     |

## Change log

| Version | Date        | Change                                                                                              |
| ------- | ----------- | --------------------------------------------------------------------------------------------------- |
| v1.0    | 24 Nov 2026 | First issue: client and server storage rules, Redis keyspace, encryption inventory, decision table. |
