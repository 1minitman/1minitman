# 1MM-STD-15 · Data structures and models: collection, preparation, storage, use, state over time

|              |                                                                                                                                                                                                                                                                                                                                    |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Document** | 1MM-STD-15                                                                                                                                                                                                                                                                                                                         |
| **Status**   | Approved baseline · v1.0 · 24 Nov 2026                                                                                                                                                                                                                                                                                             |
| **Audience** | Engineers and coding agents                                                                                                                                                                                                                                                                                                        |
| **Owner**    | Engineering lead (code owners)                                                                                                                                                                                                                                                                                                     |
| **Sources**  | [SQL] (`packages/db/migrations/0001_baseline_v3_4.sql`), [DD Conventions], [DD §1–§14], [TR §2.1], [TR §4.2], [TR §4.6], [TR §6.1], [TR §8.1–§8.4], [TR §10.1–§10.3], [TR §11], [TR §12], [TR §14], [TR §16], [ADM §1.1–§1.3], [WEB §3.10], [OD-02], [OD-03], [OD-33], [OD-35], [OD-37], [OD-40]                                   |
| **Related**  | [1MM-STD-12](1MM-STD-12-DATA-HANDLING.md), [1MM-STD-11](1MM-STD-11-SECURITY-AND-COMPLIANCE.md), [1MM-STD-06](1MM-STD-06-API-FIRST.md), [1MM-STD-13](1MM-STD-13-ERROR-CODES.md), [1MM-STD-14](1MM-STD-14-CODING-CONVENTIONS.md), [1MM-DB-01](../database/1MM-DB-01-SCHEMAS.md), [1MM-DB-03](../database/1MM-DB-03-SQL-STRUCTURE.md) |

**What this document is for and when to open it.** It describes every kind of data in 1minitman
from the moment it is collected to the moment it is deleted: where it enters, what validates it,
how it is prepared, which tables hold it, what is derived from it, how it is served, what changes
it and when it ends. It also fixes the modelling conventions and the state machines with their
real enum values. Open it when you design a table, a schema in `packages/contracts`, a state
change or a client view model. Where and how long data may be held is in
[1MM-STD-12](1MM-STD-12-DATA-HANDLING.md).

## 1. How to read this document

- Table, column, enum and function names are those of schema v3.4 ([SQL]); the data dictionary
  ([DD]) gives each table's purpose, screens, retention and PII class.
- Screen ids are the canvas ids used in [TR §8.2] and [DD]. Endpoints are those of [TR §8.2].
- "Request schema" means the zod schema in `packages/contracts` for that endpoint. Only the
  `system` module exists today; each schema is built by the module plan that owns the endpoint
  (module map in the master plan). Database CHECKs quoted here already exist.
- **State tables.** The schema fixes the _values_. A _transition_ is listed only when a source
  describes it (a function, a job, an endpoint or a data-dictionary rule). A value with no
  described transition is listed as "not described" and collected in GAP-STD15-01. A transition
  that is not in a table is not allowed.

## 2. Modelling conventions

### 2.1 Identifiers

| Kind                                | Rule                                                                                                                                                                                                                                                                                                                | Source                       |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| Entity rows                         | `uuid` primary key, default `uuid_v7()` (our own PG16-compatible function, not the native `uuidv7()`). Time-ordered, unique across shards and devices, not guessable                                                                                                                                                | [DD Conventions], [TR §10.2] |
| Client-generated ids                | The app may generate UUID v7 ids for the offline outbox: `reactions.client_reaction_id` (unique per actor), `message_client_ids (sender, client_msg_id)`. A replay returns the original outcome                                                                                                                     | [TR §8.4], [DD §5], [DD §6]  |
| Catalogues                          | `smallint` or `text` keys (`products.id`, `industries.id`, `plans.code`, `prompts.key`, `message_effects.key`)                                                                                                                                                                                                      | [DD Conventions], [SQL]      |
| Append-only logs nothing references | `bigint` sequences (`analytics_events.id`). Sequences, not identity columns, on partitioned tables                                                                                                                                                                                                                  | [DD Conventions], [SQL]      |
| Human references                    | `PREFIX-n` from a sequence: `R-` reports, `S-` support tickets, `SR-` website safety reports, `SE-` escalations, `A-` appeals, `RF-` refunds, `PR-` privacy requests, `LH-` legal holds, `SI-` security incidents, `J-`, `W-`. Invoices keep `1MM-YYYY-Rnnnnn`. Shown to people; never used as a key in an API path | [OD-40], [DD §10]            |
| Pair tables                         | The pair is stored ordered (`matches.user_a < user_b`) so one row represents both directions; direction tables (`reactions`) store actor and target                                                                                                                                                                 | [DD §5]                      |
| In API paths                        | Always the uuid. Tokens for people without an account are random strings stored only as a hash ([1MM-STD-12](1MM-STD-12-DATA-HANDLING.md) §7.7)                                                                                                                                                                     | [TR §8.2]                    |

### 2.2 Domains

Six domains carry format rules once, for every column that uses them [SQL], [TR §10.1]:

| Domain        | Base type | Rule                   |
| ------------- | --------- | ---------------------- |
| `e164`        | `text`    | `^\+[1-9][0-9]{6,14}$` |
| `iso_country` | `char(2)` | `^[A-Z]{2}$`           |
| `app_locale`  | `text`    | `en`, `pcm` or `fr`    |
| `usd_cents`   | `bigint`  | `>= 0`                 |
| `hex_colour`  | `text`    | `^#[0-9A-Fa-f]{6}$`    |
| `sha256_hash` | `bytea`   | exactly 32 bytes       |

The zod schema for a field that maps to a domain uses the same rule (one shared schema per domain in
`packages/contracts`), so the API rejects what the database would reject.

### 2.3 Timestamps and time zones

1. Every instant is `timestamptz`, stored in UTC; `created_at` and `updated_at` default to `now()`
   and `updated_at` is maintained by the `set_updated_at()` trigger [SQL].
2. Calendar dates with no time are `date` (`profiles.birth_date`, `data_export_requests.requested_on`).
   Age is computed with `age_years()` against the day the birth date was locked [SQL].
3. The API sends and accepts instants as ISO 8601 strings in UTC. Clients format them in the
   device time zone. **Recommendation** (the wire format is not stated in the sources; it follows
   from zod / OpenAPI `date-time`).
4. A member's own time zone is `profiles.timezone` (IANA name, default `Africa/Lagos`); cities
   carry `cities.timezone` [SQL], [DD §1]. It is used for rules that follow the member's day:
   daily spec caps reset at local midnight (`quota:specs:{user_id}:{local_date}`) [OD-03], the N10
   push at 18:00 local (`quota.reset`, hourly per time zone) [TR §11], quiet hours [DD §3],
   Spotlight turns at local peak hours [TR §11].
5. Weekly windows are ISO weeks (`quota:ds:{user_id}:{iso_week}`) [DD §14].
6. Durations are stored as the end instant, not as a countdown: `intro_expires_at`, `ends_at`,
   `decide_by`, `undo_until`, `expires_at`, `sla_due_at`, `purge_after`. Clients render the
   countdown from the instant and the server clock offset; the server alone decides expiry.
7. Timer lengths come from `remote_config` (`intro.window_hours` 24, `intro.decision_window_hours`
   24, `unmatch.cooldown_days`, `dm_request.expiry_days` 14, `appeals.window_days` 30,
   `appeals.sla_hours` 48) and are read through `config_int()` or by the API [DD §13], [DD §13B.3].
   Column literals stay as the seeded defaults.
8. Admin rules that name a wall clock use WAT (off-hours super-admin alert 00:00–05:00 WAT)
   [ADM A03].

### 2.4 Money

| Rule                                                                                                                                                                                                                                                                                                         | Source                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------- |
| Amounts are integers in minor units. Our ledger currency is the US dollar: every `*_usd_cents` column uses the `usd_cents` domain (`bigint`, `>= 0`). No floats, no `numeric` for money                                                                                                                      | [SQL], [DD §10]             |
| List prices are USD, versioned in `prices` (`amount_usd_cents`, `currency` CHECK = `'USD'`, `version`, `valid_from` / `valid_to`). A price is never edited: a change is a new version                                                                                                                        | [TR §4.6], [DD §1], [OD-12] |
| Stores show local currency. What the member was actually charged is kept beside the USD amount: `transactions.charged_amount_minor` (`bigint`) and `charged_currency` (`^[A-Z]{3,5}$`)                                                                                                                       | [TR §4.6], [SQL]            |
| Revenue is aggregated in US cents (`mv_revenue_daily`), production transactions only (`environment = 'production'`)                                                                                                                                                                                          | [TR §4.6], [DD §13B.3]      |
| Direction is carried by `transactions.kind` (`purchase`, `renewal`, `upgrade`, `trial_conversion`, `refund`, `chargeback`, `chargeback_reversal`), not by a sign: amounts are never negative                                                                                                                 | [SQL]                       |
| Proration is its own column (`proration_credit_usd_cents`); invoice total = subtotal − credit. Tax and fee are separate columns (`tax_usd_cents`, `fee_usd_cents`, NULL = not yet known)                                                                                                                     | [SQL], [DD §10]             |
| Every money write has an idempotency key (`transactions.idempotency_key` UNIQUE, `refunds.idempotency_key` UNIQUE) and a provider reference (`UNIQUE (provider, provider_transaction_id)`)                                                                                                                   | [SQL]                       |
| Config thresholds in money carry the unit in the key (`billing.refund_approval_threshold_usd_cents`)                                                                                                                                                                                                         | [OD-05]                     |
| In DTOs: an integer `amount_usd_cents` plus, where shown, `charged_amount_minor` and `charged_currency` (wire fields are snake_case, [1MM-STD-14](1MM-STD-14-CODING-CONVENTIONS.md) §4.1). Clients format with the locale; they never multiply, divide or round money. **Recommendation** on the field names | Recommendation              |

The number of minor units per charged currency (for formatting `charged_amount_minor`) is not
stated in the sources: GAP-STD15-02.

### 2.5 Enums, text-with-CHECK and catalogues

| Use                               | When                                                                                                                                                                               | Examples                                                                                                                                          |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| PostgreSQL enum (101 in v3.4)     | A closed set that code branches on, and that only a release changes                                                                                                                | `account_status_t`, `member_role_t`, `plan_t`, `match_status_t`, `subscription_status_t`                                                          |
| `text` with a CHECK list          | A closed set added or extended after the baseline, or small and local to one table. (A new enum value can be used only after the statement that added it has committed [TR §10.3]) | `refunds.status`, `privacy_requests.status`, `web_uploads.scan_status`, `sessions.revoke_reason`                                                  |
| Catalogue table                   | A list an admin edits, that carries labels, ordering or per-item rules                                                                                                             | `option_sets` / `options`, `vibe_tags`, `industries`, `prompts`, `report_reasons`, `message_effects`, `decision_reasons`, `plans`, `entitlements` |
| `remote_config` / `feature_flags` | A number, timer, switch or small JSON rule that changes without a release                                                                                                          | `discovery.daily_cap.basic`, `calls.enabled`, `safety.sanctions_ladder`                                                                           |
| `i18n_strings`                    | Any text a person reads. Catalogue rows hold a `label_key` / `text_key` / `member_message_key`, not the words                                                                      | [DD §1]                                                                                                                                           |

Rules: enum values are lower snake case (member roles are the upper-case exception); the zod enum in
`packages/contracts` lists exactly the database values and CI's contract check catches drift; a
client treats an unknown enum value as "unknown" and does not crash (a later release may add one);
reason codes from `decision_reasons` are validated by the API, not bound by a foreign key [DD §1];
legacy values that new code must never write stay documented (`payment_provider_t` `stripe`,
`pay_method_t` `link` / `usdc`) [SQL].

### 2.6 Soft delete, hard delete and append-only

| Pattern                     | How it looks                                                                                         | Used for                                                                                            | What ends it                                           |
| --------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Undo window                 | `undo_until` (Pass 6 s), `removed_at` + `undo_until` (prompts), block Undo                           | Actions a member may reverse at once                                                                | The window passes; the action stands                   |
| Soft delete with purge date | `deleted_at` + `purge_after` (`media_assets`), `status = 'deleted'`, `removed_at`                    | Member content with a restore period (media 30 days)                                                | A purge job hard-deletes the row and its objects       |
| Hidden, not deleted         | `profiles.is_hidden` + `hidden_reason`; `profile_media.hidden_reason` (plan_lapsed) + `hidden_until` | Deletion grace, sanctions, age check, lapse (90 days)                                               | Restored, or deleted when the period ends              |
| Status close                | `conversations.state = 'closed'`, `matches.status`, `groups.status = 'deleted'`                      | Relationships that end                                                                              | Purge after the evidence snapshot or the stated period |
| Hard delete by cascade      | `ON DELETE CASCADE` from `users`                                                                     | Erasure of member-owned rows                                                                        | `erasure.run`                                          |
| Pseudonymise and keep       | `ON DELETE RESTRICT` (`transactions`, `subscriptions`); `account_deletions` "row kept pseudonymised" | Records with a legal retention (7 years)                                                            | Retention period                                       |
| Append-only                 | UPDATE and DELETE revoked; `forbid_mutation()` triggers                                              | `admin_audit_log`, `consent_records`, `moderation_actions`, `content_revisions`, `consent_receipts` | Partition retention only                               |
| Final rows                  | Updates refused                                                                                      | `intro_decisions`; published `legal_documents` (`legal_published_immutable()`); price versions      | Never                                                  |

Rules: every list query and unique rule states how it treats soft-deleted rows (unique indexes are
partial: `users.email` is unique "while not deleted" [DD §2]); a DTO never exposes a soft-deleted
row to another member; a correction to an append-only record is a new row that references the old
one (`moderation_actions.reverses_action_id`) [DD §9].

### 2.7 Optimistic concurrency and idempotency

- `profiles.version` (integer) backs `PATCH /v1/me/profile` with `If-Match`: the write succeeds only
  if the version matches, then increments it [SQL], [TR §8.1]. Versioned content tables
  (notification templates, CMS rows, site settings) carry `version` the same way [SQL].
- "Only one" rules are database constraints, not application checks: one active match per pair, one
  reaction per direction, one intro message per sender (`UNIQUE (session, sender)`), one live
  subscription (`uq_subs_one_live`), one export per day (`UNIQUE (user_id, requested_on)`), one
  appeal per decision [TR §13.1], [SQL].
- Pair operations take `pg_advisory_xact_lock` on the ordered pair [TR §8.4]; quota spends use
  `SELECT … FOR UPDATE` (`spend_spec_view()`) [TR §13.1].
- `Idempotency-Key` on payments, badge submit and exports; client ids on reactions and messages
  [TR §8.1].

### 2.8 Partitioned tables

Nine tables are partitioned by month on their time column: `messages` (`created_at`),
`group_messages` (`created_at`), `analytics_events` (`occurred_at`), `admin_audit_log`
(`created_at`), `feed_impressions` (`shown_at`), `api_request_rollups` (`bucket_start`),
`api_request_samples` (`at`), `api_request_ip_rollups` (`bucket_start`), `edge_security_events`
(`occurred_at`) [SQL], [DD Changelog].

- Partitions are created by `ensure_monthly_partitions()` (job `partitions.ensure`, next 3 months)
  with DEFAULT partitions as a safety net; `partitions.retain` detaches and archives past retention
  [TR §10.2], [TR §11].
- A unique key on a partitioned table includes the partition key: `messages` has
  `PRIMARY KEY (conversation_id, id, created_at)`. A reference to a message is therefore the
  triple, and children use a composite foreign key (`group_message_reactions`) [SQL], [DD §7].
- Because of that, message idempotency lives in a separate table, `message_client_ids` [TR §10.2].
- Every query on a partitioned table filters on the partition key (a time range or a keyset cursor
  that contains it).

### 2.9 Layers of a model in code

| Layer                | Lives in                                                                                                          | Shape                                                                                  | Rules                                                                                                                                                                                   |
| -------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Database row      | `packages/db` (Drizzle schema); used only in `apps/api/src/modules/<name>/infrastructure` and worker repositories | Snake-case columns, database types, every column                                       | Never leaves the infrastructure layer. No row type is imported by `http`, by `packages/contracts` or by a client                                                                        |
| 2. Domain entity     | `apps/api/src/modules/<name>/domain`                                                                              | Camel-case, business types (a `Money` value, a status union), behaviour and invariants | No Drizzle, no Hono, no zod. State changes are methods that enforce the state tables in section 4                                                                                       |
| 3. Application       | `apps/api/src/modules/<name>/application`                                                                         | Use cases; ports for repositories, vendors and other modules                           | Authorisation, entitlement and transaction boundaries live here                                                                                                                         |
| 4. DTO / contract    | `packages/contracts` (zod schemas, route definitions, OpenAPI per surface, generated clients)                     | The wire shape of one endpoint on one surface                                          | The same zod schema validates the request, shapes the response and generates the client [TR §8.1]. A member DTO, an admin DTO and a public DTO of the same entity are different schemas |
| 5. Client view model | Each app (`apps/mobile`, `apps/admin`, `apps/web`, `apps/site`)                                                   | What a screen needs: formatted labels, derived flags, i18n keys resolved               | Built from DTOs by a mapper beside the query hook. Never sent back to the API                                                                                                           |

**Clients never see database shapes.** In practice:

1. A response is built by an explicit mapper from the domain entity to the DTO, and parsed by the
   response schema before sending, so an added column cannot leak.
2. A DTO carries only what its audience may see. Another member's DTO has no real name, e-mail,
   phone, birth date (age only), coordinates, genotype or faith, moderation labels, risk scores or
   internal ids of other tables [TR §16.2]. The admin DTO masks personal fields unless the call is
   an audited reveal [ADM §1.3].
3. Storage details do not cross: object keys become signed URLs, hashes and `_enc` values are
   never serialised, foreign keys the client cannot follow are omitted.
4. Derived values the server owns (role, plan, entitlements, counters, `canX` flags, upsell
   targets) are computed by the server and sent; the client does not recompute them [TR §8.1].
5. A request body is a strict schema of the fields a member may set; server-owned columns
   (`role`, `plan`, `status`, `is_verified`, `user_id`) are never in it
   ([1MM-STD-11](1MM-STD-11-SECURITY-AND-COMPLIANCE.md) THR-45).
6. Renaming a column is invisible to clients; changing a DTO is an API change and goes through the
   breaking-change check in CI (`scripts/check-contract-breaking.mjs`).

## 3. Life cycles by entity family

Each table follows one piece of data through eight stages. Sanctions are covered with reports and
cases (3.11) and entitlements with subscriptions and transactions (3.12), so 19 tables cover the 21
entity families. "End of life" cites [TR §16.1] and the
table's [DD] row.

### 3.1 Account and identity

| Stage            | What happens                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Collected        | E1–E5 e-mail and password, G1 / AP1 social sign-in, C1–C6 onboarding, B1 / B2 phone: `POST /v1/auth/email/start` · `/verify`, `/v1/auth/oauth/*`, `PATCH /v1/me/onboarding`, `POST /v1/verification/phone/start` · `/confirm` [TR §8.2]                                                                                                                                                                                                        |
| Validated        | Request schemas; password minimum `auth.password_min_length` (8) and breached-password check; e-mail CHECK `email = lower(btrim(email))`; `e164` domain; VoIP and virtual numbers cannot be verified (CHECK); rate limits `otp.*`, `signup.*`, `login.*` [TR §13.2], [SQL]                                                                                                                                                                     |
| Prepared         | E-mail trimmed and lower-cased; password → Argon2id; code → hash; device fingerprint → `sha256_hash`; login identifier → hash; provider token verified and reduced to `provider_sub` [DD §2]                                                                                                                                                                                                                                                   |
| Stored           | `users` (`email citext`, `first_name`, `last_name`, `status account_status_t`, `role member_role_t`, `plan plan_t`, `onboarding_step smallint 1–10`, `locale app_locale`), `password_credentials`, `oauth_identities`, `phone_numbers` (`e164`), `devices`, `sessions`, `refresh_tokens` (`token_hash`), `otp_challenges`, `login_attempts`, `account_lockouts`, `password_resets`, `new_device_challenges`, `age_gate_blocks`, `role_history` |
| Derived / cached | `users.role` and `users.plan` are caches refreshed by `refresh_member_role()`; `v_member_entitlements` → Redis `ent:{user_id}`; `sess:deny:{session_id}`; `lock:*`, `otp:cooldown:*` [TR §10.2], [DD §14]                                                                                                                                                                                                                                      |
| Served           | `GET /v1/me` (own account: first name, masked contact points, role, plan, onboarding step), `GET /v1/me/sessions` (PM5), `GET /v1/me/sign-in-methods`; admin: `users` with PII masked, reveal through `users/{id}/pii` [TR §8.2]. Never served to other members: e-mail, phone, real name                                                                                                                                                      |
| Changed by       | Onboarding steps, `PUT /v1/me/password` (M+), sign-in method link / unlink, PM6 "It wasn't me", sanctions, billing and verification events (role), admin `users.update`                                                                                                                                                                                                                                                                        |
| End of life      | Deletion request → 14-day grace → `erasure.run`. OTP challenges 30 days, login attempts and lockouts 90 days, refresh tokens 7 days after expiry, resets and new-device challenges 1 year, `role_history` 7 years [DD §2]                                                                                                                                                                                                                      |

### 3.2 Profile and preferences

| Stage            | What happens                                                                                                                                                                                                                                                                                                                                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Collected        | C1–C6, B6, B7, PM1, PM3, P1–P3, D1·F, D17: `PATCH /v1/me/profile` (If-Match), `PUT /v1/me/nickname`, `/vibes`, `/answers`, `/preferences`, `/likes-filter`, `/international`, `/settings`, `/status` [TR §8.2]                                                                                                                                                                                                     |
| Validated        | Request schemas; lengths as CHECKs (nickname 2–20, bio ≤ 300, status note ≤ 40, job title ≤ 40); 18+ on the day (`age_years()` CHECK), birth date locked; contact-detail filter (`ck_profiles_nickname_contact`) and abuse rules; option keys must exist in `options`; vibes 3–10; languages ≤ 6; premium fields need Premium; nickname 21-day cooldown [SQL], [DD §3]                                             |
| Prepared         | Text trimmed; nickname defaults to first name; option answers stored by `option_id`, not by label; sensitive sets (`pii_class`, `needs_consent`) require the consent row first [DD §1]                                                                                                                                                                                                                             |
| Stored           | `profiles` (`nickname`, `birth_date date`, `gender gender_t`, `interested_in interest_t`, `intention intention_t`, `bio`, `height_cm smallint`, `presence_pref presence_t`, `is_hidden`, `incognito`, `version integer`), `nickname_history`, `profile_languages`, `profile_answers`, `profile_vibes`, `partner_preferences` (+ `_options`, `_sections`, `_languages`), `international_countries`, `user_settings` |
| Derived / cached | `profiles.profile_strength` (0–100), `premium_sections_done`; deck candidates in `feed:{user_id}:{tab}`; `discovery/count` pool meter [DD §3], [DD §14]                                                                                                                                                                                                                                                            |
| Served           | Own: full profile in `GET /v1/me`. Others: `GET /v1/discovery/deck`, `GET /v1/specs/{userId}` (full profile needs Black Badge): nickname, age (not birth date), city, vibes, visible answers. Genotype and faith are never served; they only filter [TR §16.2]                                                                                                                                                     |
| Changed by       | The member; moderation (`hidden_reason`), deletion grace (`deletion_pending`), age check (`age_check`); plan lapse (premium sections)                                                                                                                                                                                                                                                                              |
| End of life      | Erased 14 days after a deletion request; genotype / faith within 30 days of consent withdrawal (`sensitive.erase`); old nicknames held 90 days [DD §3]                                                                                                                                                                                                                                                             |

### 3.3 Media

| Stage            | What happens                                                                                                                                                                                                                                                                                                                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Collected        | B4, B8, P4, GD4, PM2, PM8, D9, MF2, H3: `POST /v1/media/upload-url` → the client uploads straight to R2 quarantine → `POST /v1/media/{id}/complete` (built once in MOD-04, [ruling R1](../execution/1MM-EXE-00-MASTER-PLAN.md#7-coordinator-rulings)) [TR §8.2], [TR §5.3]                                                                                                                             |
| Validated        | Kind (`media_kind_t`), MIME (`^(image\|video\|audio)/…`), size (≤ 100 MB CHECK; presigned type and size limits), duration (clip ≤ 30 s, voice ≤ 20 s), per-plan photo and clip caps by entitlement, `media.upload` 30 an hour [SQL], [TR §13.3]                                                                                                                                                        |
| Prepared         | `media.process`: re-encode and strip EXIF / GPS; AVIF / WebP sizes; clips → 720p H.264 + HLS; voice → Opus; face match against the verified template; image moderation; colour-filter check; `media.transcribe` for voice [TR §11]                                                                                                                                                                     |
| Stored           | `media_assets` (`kind`, `storage_key text UNIQUE`, `mime_type`, `bytes integer`, `sha256`, `phash bigint`, `status media_status_t`, `face_match face_match_t`, `moderation_status moderation_status_t`, `variants jsonb`, `transcript`, `purge_after`); placement in `profile_media` (`position`, `is_main`), `prompt_answers.media_id`, `message_attachments`, `intro_messages.media_id`; bytes in R2 |
| Derived / cached | Variants with versioned keys; `phash` for duplicates; expo-image disk cache on the device                                                                                                                                                                                                                                                                                                              |
| Served           | Signed URLs to private variants inside the owning DTO, only for `status = 'active'` assets and only to callers allowed to see the owner. The object key is never sent                                                                                                                                                                                                                                  |
| Changed by       | Member (`PATCH /v1/me/media/order`, `PUT /v1/me/media/main`, delete / restore, review request); moderation (A13); plan lapse hides extras (`plan_lapsed`)                                                                                                                                                                                                                                              |
| End of life      | Soft delete 30 days then purge; lapsed extras deleted after 90 days (`lapse.purge`); intro voice 30 days unless kept; erased with the account [TR §16.1]                                                                                                                                                                                                                                               |

### 3.4 Verification and biometrics

| Stage            | What happens                                                                                                                                                                                                                                                                                                                                               |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Collected        | B0–B11: phone (B1 / B2), biometric consent (B3, `POST /v1/consents`), selfie and liveness (B4 / B5, `POST /v1/verification/liveness/session` · `/result`), about, vibes, media, pay (B9), `POST /v1/badge/submit` (Idempotency-Key) [TR §8.2]                                                                                                              |
| Validated        | Biometric consent must exist; 3 liveness attempts (`attempt_no` 1–3); payment required before submit (`payment_transaction_id`); one account per number and per face [DD §4], [TR §13.1]                                                                                                                                                                   |
| Prepared         | The liveness result is fetched from the vendor by the server; the template reference is encrypted (`vendor_template_ref_enc`); a one-way `dedupe_fingerprint` is computed; `badge.autodecide` applies risk rules and vendor scores [TR §11]                                                                                                                |
| Stored           | `badge_applications` (`status badge_status_t`, `steps_done badge_step_t[]`, `current_step`, `fix_step`, `sla_due_at`, `decision_reason_code`, `member_message_key`), `verification_records` (`kind`, `result`, `score`), `liveness_sessions`, `face_templates`, `pending_actions`, `upgrade_progress`, `safety_briefing_acks`; `carrier_checks` (deferred) |
| Derived / cached | `users.is_verified`, `verified_at`; role ACTIVE through `compute_member_role()`; `entitlement_grants` (source `badge`)                                                                                                                                                                                                                                     |
| Served           | `GET /v1/badge`, `GET /v1/badge/status`, `GET /v1/me/verification` (PM4): status, steps, a fixed member message. Scores, vendor ids and the template are never served. Admin queue A12                                                                                                                                                                     |
| Changed by       | Member (steps, `POST /v1/badge/fix`), `badge.autodecide`, reviewer (`badges.review`), `DELETE /v1/me/verification/face` (M+, withdraws consent)                                                                                                                                                                                                            |
| End of life      | Liveness video deleted after review (max 30 days) at the vendor and by us; face template deleted on withdrawal or erasure, fingerprint kept only if banned; `pending_actions` 30 days [TR §16.1], [DD §4]                                                                                                                                                  |

### 3.5 Location

| Stage            | What happens                                                                                                                                                                                                                 |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Collected        | C6, OB3: `PUT /v1/me/location` (device fix or chosen city); EV5 check-in: `POST /v1/meetups/{id}/checkin` [TR §8.2]                                                                                                          |
| Validated        | Request schema (coordinate ranges); location consent; `location_source` ∈ `gps`, `city`, `ip` [SQL]                                                                                                                          |
| Prepared         | Coarsened to about 1 km before storage; city resolved (`city_id`, centroid fallback); halfway suggestions use rounded points [TR §16.2], [DD §1]                                                                             |
| Stored           | `profiles.location geography(Point,4326)` (coarse), `location_source`, `city_id`, `city_name`, `country`, `timezone`, `location_updated_at`; `safety_checkins.last_coarse_location`; `groups.location`, `venues.location`    |
| Derived / cached | Distance and "nearby" in the discovery query (GiST); deck lists in Redis                                                                                                                                                     |
| Served           | City name and a distance label to other members (when `show_distance`); never coordinates. Check-in area only to the safety desk in an escalation (audited) and to alerted trusted contacts as the last coarse area [TR §11] |
| Changed by       | The member's device; city change                                                                                                                                                                                             |
| End of life      | With the profile; check-in location deleted 30 days after the meet-up (`safety.location.purge`) [TR §16.1]                                                                                                                   |

### 3.6 Reactions and matches

| Stage            | What happens                                                                                                                                                                                                                                                                                                                                       |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Collected        | D1, D4, MF1: `POST /v1/reactions {targetId, kind, clientId, surface}`, `/reactions/undo`, `/reactions/rewind` [TR §8.2]                                                                                                                                                                                                                            |
| Validated        | Request schema; `reaction_t` ∈ `like`, `somewhat`, `pass`; Like and Somewhat need ACTIVE or higher; not blocked; `reactions.user` 120 a minute; daily spec cap spent by `spend_spec_view()` [TR §8.4], [OD-03]                                                                                                                                     |
| Prepared         | `record_reaction()` in one transaction: replay check, advisory lock on the pair, upsert, read the other side, create the match and its intro session [TR §8.4]                                                                                                                                                                                     |
| Stored           | `reactions` (`UNIQUE (actor, target)`, `client_reaction_id`, `kind`, `undo_until`, `undone_at`, `pass_count`), `reaction_history` (append-only), `pair_cooldowns`, `hidden_profiles`, `matches` (`user_a < user_b`, `kind match_kind_t`, `status match_status_t`, `intro_expires_at`), `feed_impressions`, `usage_counters`, `spotlight_rotations` |
| Derived / cached | `v_likes_received`, `v_fresh_matches`; `quota:specs:*`; `feed:served:*`                                                                                                                                                                                                                                                                            |
| Served           | `GET /v1/likes` (received unblurred needs Black Badge), `/v1/likes/summary`, `GET /v1/matches`; events `match.created`, `maybe.created`                                                                                                                                                                                                            |
| Changed by       | Undo (6 s), Gold Rewind (`undo_reaction()`), `intro.expire`, `decide_intro()`, `unmatch()`, block                                                                                                                                                                                                                                                  |
| End of life      | Reactions and matches with the account; history 13 months; cooldowns until expiry (`cooldowns.purge`); impressions 90 days; Spotlight 12 months [DD §5]                                                                                                                                                                                            |

### 3.7 Intro, conversations and messages

| Stage            | What happens                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Collected        | D6 / MF2 / MF3: `POST /v1/intros/{id}/open` · `/message` · `/decision` · `/skip`; D9: `POST /v1/conversations/{id}/messages {clientMsgId, kind, body, effectKey, replyTo}` (camelCase is the source spelling, to be corrected to snake_case: GAP-STD15-03) or WebSocket `message.send` (same validation); D11: `POST /v1/direct-specs` [TR §8.2], [TR §8.3]                                                                               |
| Validated        | Request schema; body ≤ 2,000 (CHECK), intro text ≤ `intro.text_max_chars` (280), Direct Spec note ≤ 200; one intro message per sender; chat needs Premium; `messages.user` 30 a minute, `messages.daily` 1,000; safety filter (abuse rules) [DD §6], [TR §13.3]                                                                                                                                                                           |
| Prepared         | Safety verdict computed before the write: `clean` or `warned` are stored; a blocked message is not stored (CHECK `safety_verdict <> 'blocked'`) and becomes a `message_failures` row with a body hash only; idempotency through `message_client_ids` [SQL], [DD §6]                                                                                                                                                                       |
| Stored           | `intro_sessions`, `intro_messages`, `intro_decisions`; `conversations` (`kind`, `state conversation_state_t`, `last_message_preview ≤ 120`), `conversation_participants` (`holds_slot`, `unread_count`, `last_read_at`), `messages` (partitioned; `kind message_kind_t`, `body`, `safety_flags text[]`, `safety_verdict`, `edited_at`, `deleted_at`), `message_attachments`, `message_reactions`, `dm_requests`, `calls`, `call_feedback` |
| Derived / cached | Written to PostgreSQL first, then published to `ch:conv:{id}`; `v_chat_list`, `v_unread_counts` → `badge:{user_id}`; `typing:*` and presence only in Redis [TR §4.2], [DD §14]                                                                                                                                                                                                                                                            |
| Served           | `GET /v1/conversations`, `/conversations/{id}/messages?before` (keyset), events `message.new`, `read.updated` (Gold viewers only), `typing`. Safety flags and transcripts are not served to members                                                                                                                                                                                                                                       |
| Changed by       | Read marks, reactions, delete, mute / archive, accept or decline a request, unmatch, block, plan lapse (read-only above the limit), moderation                                                                                                                                                                                                                                                                                            |
| End of life      | Intro messages 30 days unless kept; messages while the conversation exists, deleted on unmatch (after the evidence snapshot), block or erasure; client ids 7 days; failures 30 days; calls 12 months [TR §16.1], [DD §6]                                                                                                                                                                                                                  |

### 3.8 Groups

| Stage            | What happens                                                                                                                                                                                                                                                                           |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Collected        | GC1–GC5, D12, D13, D13A: `POST /v1/groups`, `PATCH /v1/groups/{id}`, `/join`, `/leave`, `/messages`, `/invites`, member approve / remove [TR §8.2]                                                                                                                                     |
| Validated        | Request schema; name 3–40 with the contact filter, description ≤ 140, rules ≤ 5 of ≤ 80 characters, `max_members` ≤ 500; creating needs Premium, `groups.own_max` (Premium 1, Gold 10); invites only to people matched or chatted with, batch ≤ 20 [DD §7]                             |
| Prepared         | Slug generated (unique while not deleted); new groups start `pending_review`                                                                                                                                                                                                           |
| Stored           | `groups` (`status group_status_t`, `join_rule`, `post_rule`, `member_count`, `location`, `slug`), `group_rules`, `group_members` (`role group_role_t`, `status group_member_status_t`), `group_invites` (`invite_status_t`), `group_messages` (partitioned), `group_message_reactions` |
| Derived / cached | `member_count`; unread per member                                                                                                                                                                                                                                                      |
| Served           | `GET /v1/groups?near&q&cursor`, group detail, room messages; event `group.message.new`; admin A18                                                                                                                                                                                      |
| Changed by       | Owner and group admins; group review; admin removal (`removed_by_admin`)                                                                                                                                                                                                               |
| End of life      | Until deleted + 30 days; invites 90 days [DD §7]                                                                                                                                                                                                                                       |

### 3.9 Meet-ups and check-ins

| Stage            | What happens                                                                                                                                                                                                                                                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Collected        | EV1–EV6, GC5: `POST /v1/meetups`, `/rsvp`, `/proposals`, `/cancel`, `/checkin {ok\|need_help}`, `/checkin/snooze`, `/feedback`; `POST /v1/safety/help` [TR §8.2]                                                                                                                                                                |
| Validated        | Request schema; title ≤ 60; venue must be a public place (`venues.is_public_place`); a date is created inside a chat, a group event by a group admin; capacity counts `going` only [DD §8], [OD-30]                                                                                                                             |
| Prepared         | Default length `meetup.default_duration_minutes` (120); invite expiry 48 h; check-in scheduled at the planned end with `respond_by` +15 min                                                                                                                                                                                     |
| Stored           | `meetups` (`kind meetup_kind_t`, `status meetup_status_t`, `starts_at`, `ends_at`, `invite_expires_at`), `meetup_rsvps` (`rsvp_status_t`), `meetup_time_proposals`, `meetup_feedback`, `safety_checkins` (`status checkin_status_t`, `due_at`, `respond_by`, `snooze_count`), `safety_escalations`, `safety_escalation_updates` |
| Derived / cached | Reminders (`meetup.reminders`), check-in jobs (`checkin.due`, `checkin.escalate`)                                                                                                                                                                                                                                               |
| Served           | `GET /v1/meetups/{id}` (EV4); the trusted-contact page (3.10); safety desk A15                                                                                                                                                                                                                                                  |
| Changed by       | Participants; jobs; admin cancel (`cancelled_by_admin`); safety desk                                                                                                                                                                                                                                                            |
| End of life      | Meet-ups 12 months after the event; feedback 24 months; check-in location 30 days; escalations 24 months [DD §8]                                                                                                                                                                                                                |

### 3.10 Trusted contacts

| Stage            | What happens                                                                                                                                                                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Collected        | LG4, H2: `GET / POST / DELETE /v1/me/trusted-contacts`; the contact's YES / STOP arrives by `/webhooks/termii` · `/twilio` · `/whatsapp` [TR §8.2], [TR §12]                                                                                |
| Validated        | Request schema; up to 3; `phone e164`; channel `sms` or `whatsapp`; `trusted_contact` consent row from the member [SQL], [TR §16.2]                                                                                                         |
| Prepared         | Opt-in message sent; nothing is shared until status is `active`; a share creates a random token and stores only its hash                                                                                                                    |
| Stored           | `trusted_contacts` (`name`, `phone`, `channel`, `status trusted_status_t`, `relationship`), `trusted_contact_messages` (`kind`, `direction`, `status`, `channel`), `meetup_shares` (`token_hash`, `expires_at`, `view_count`, `revoked_at`) |
| Derived / cached | None                                                                                                                                                                                                                                        |
| Served           | The member's own list; `GET /public/v1/share/{token}` renders a meet-up summary at `1minitman.com/s/<token>` without sign-in [OD-13]                                                                                                        |
| Changed by       | Member (add, remove), the contact (YES, STOP), `share_links.expire`                                                                                                                                                                         |
| End of life      | Contact until removed; messages 12 months; share link expires 24 h after the meet-up, rows purged at 30 days [DD §8]                                                                                                                        |

### 3.11 Reports, cases and sanctions

| Stage            | What happens                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Collected        | H3 from many screens: `POST /v1/reports`; H4: `POST /v1/blocks`; AS1 / H6: `POST /v1/appeals`; website W34 safety report (`POST /public/v1/contact` family); system hits from abuse rules [TR §8.2]                                                                                                                                                                                                                                                                                                                                                                                          |
| Validated        | Request schema; reason must exist in `report_reasons`; context ∈ `report_context_t`; `reports.user` 20 a day; one appeal per decision, within `appeals.window_days`, text ≤ 1,500 [DD §9]                                                                                                                                                                                                                                                                                                                                                                                                    |
| Prepared         | Evidence frozen at report time (last 50 messages, screenshots, call metadata) into `report_evidence`; severity and `sla_due_at` from the reason; a `moderation_cases` row is opened; website reports get an `SR-n` reference and a priority [DD §9], [TR §6.1]                                                                                                                                                                                                                                                                                                                               |
| Stored           | `reports` (`public_ref`, `status report_status_t`, `severity`, `duplicate_of`), `report_evidence`, `moderation_cases` (`kind case_kind_t`, `status case_status_t`, `priority smallint 1–5`, `sla_due_at`, `claimed_by`, QA fields), `moderation_actions` (append-only, `action moderation_action_t`), `account_restrictions` (`kind restriction_kind_t`, `scope[]`, `ends_at`, `lifted_at`), `appeals` (`status appeal_status_t`), `appeal_evidence`, `age_verification_requests`, `blocks`, `abuse_rules`, `abuse_rule_hits`, `risk_devices`, `risk_ips`, `identity_links`, `trust_signals` |
| Derived / cached | `mv_moderation_sla`; `is_restricted` in `v_member_entitlements`; `users.status`; `ent:{user_id}` deleted on moderation events                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Served           | Member: `GET /v1/me/reports` (status only), `GET /v1/me/account-status` (the fixed `member_message_key` text, scope, end date, appeal state), `GET /v1/me/blocked`. The reported member never learns who reported. Admin: A14, A16, evidence with `conversations.read_reported`                                                                                                                                                                                                                                                                                                              |
| Changed by       | Reviewers (claim, decide), QA, the sanctions ladder (`safety.sanctions_ladder`), approvals for bans, `restrictions.expire`, appeals                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| End of life      | Reports and evidence 12 months after resolution (legal hold respected); cases, actions, restrictions and appeals 7 years; hits 12 months; IP risk 90 days [DD §9]                                                                                                                                                                                                                                                                                                                                                                                                                            |

### 3.12 Subscriptions, transactions and entitlements

| Stage            | What happens                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Collected        | In the apps: store sheet through RevenueCat (B9, P5, GD5). On the web: `POST /v1/billing/flutterwave/checkout` · `/subscription` · `/change` · `/cancel` · `/payment-method`. Truth arrives by `/webhooks/revenuecat` and `/webhooks/flutterwave` [TR §8.2], [TR §12]                                                                                                                                                                                 |
| Validated        | Webhook signature; stored once (`UNIQUE (provider, event_id)`); provider state re-fetched before a grant; `Idempotency-Key`; store rows must use `payment_method = 'store'` (CHECK); one live subscription [SQL], [OD-37]                                                                                                                                                                                                                             |
| Prepared         | `billing.sync` normalises provider events into `subscription_events` and `transactions`; amounts converted to US cents with the charged amount kept beside; grants written; `refresh_member_role()`; `ent:*` cleared [TR §11], [TR §4.6]                                                                                                                                                                                                              |
| Stored           | `billing_customers`, `subscriptions` (`status subscription_status_t`, `current_period_end`, `cancel_at_period_end`, `grace_ends_at`, `scheduled_plan_code`, `environment`), `subscription_events`, `trials`, `transactions` (section 2.4), `payment_methods`, `invoices`, `refunds`, `disputes`, `entitlement_grants` (`source grant_source_t`, `plan_code`, `ends_at`), `billing_credits`, `lapse_choices`, `webhook_events`, `reconciliation_items` |
| Derived / cached | Role and plan (`compute_member_role()` → `users.role`, `users.plan`, `role_history`); `v_member_entitlements` from `role_entitlements` → `ent:{user_id}` (10 min); `v_role_drift` must be empty; `mv_revenue_daily`                                                                                                                                                                                                                                   |
| Served           | `GET /v1/me/entitlements` (role, plan, restriction flag, entitlement map), `GET /v1/me/billing` · `/history` · `/invoices/{id}/pdf`, `GET /v1/billing/proration-preview`, `GET /v1/plans`; event `entitlements.changed`. Card: brand, last four digits and expiry only                                                                                                                                                                                |
| Changed by       | Provider events, `billing.grace` (reminders days 1 / 4 / 6, lapse on day 8), `entitlements.reconcile`, admin refunds (second admin), `restrictions.expire` (credit of paid days), `PUT /v1/me/lapse-choices`                                                                                                                                                                                                                                          |
| End of life      | 7 years with the member pseudonymised; billing webhooks 7 years, others 90 days; `payment_methods` until removed or the account is erased (token deleted at Flutterwave) [DD §10]                                                                                                                                                                                                                                                                     |

### 3.13 Notifications

| Stage            | What happens                                                                                                                                                                                                                                                                             |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Collected        | A business change writes an outbox row in the same transaction; preferences from NT1 (`GET / PUT /v1/me/notification-preferences`); push tokens from C7 (`POST / DELETE /v1/me/push-tokens`) [TR §4.2], [TR §8.2]                                                                        |
| Validated        | Template code matches `^[NW][0-9]{2}$` and exists; `required_channels` cannot be switched off; `dedupe_key` unique; a non-member row needs `recipient_enc` and `recipient_hash` (CHECK) [DD §1], [SQL]                                                                                   |
| Prepared         | `notifications.deliver` applies preferences, throttles, collapse, quiet hours and discreet mode, renders the template in the row's `locale` with `params`, and sends through Expo Push, Resend, Termii, Twilio or WhatsApp [TR §11]                                                      |
| Stored           | `notifications` (`template_code`, `channel notif_channel_t`, `locale`, `params jsonb`, `status delivery_status_t`, `scheduled_for`, `attempts`, `recipient_kind`), `inbox_items` (`template_code`, `params`, `read_at`), `notification_preferences`, `push_tokens`, `email_suppressions` |
| Derived / cached | `notif:throttle:*`; unread counts                                                                                                                                                                                                                                                        |
| Served           | `GET /v1/me/activity` (D16), push and e-mail; admin delivery logs A26                                                                                                                                                                                                                    |
| Changed by       | Provider receipts (`/webhooks/resend`, `/termii`), read marks, preference changes                                                                                                                                                                                                        |
| End of life      | Notifications 90 days; inbox 180 days; push tokens until invalid; suppressions permanent [DD §11]                                                                                                                                                                                        |

### 3.14 Support tickets

| Stage            | What happens                                                                                                                                                                                            |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Collected        | H1, H1A, H1B: `POST /v1/support/tickets`, `/tickets/{id}/messages`, `POST /v1/feedback`, `POST /v1/help/articles/{slug}/vote`; website W33 contact form; help@ e-mail [TR §8.2]                         |
| Validated        | Request schema; feedback rating 1–5, text ≤ 500; channel ∈ `ticket_channel_t`                                                                                                                           |
| Prepared         | `public_ref` S-n; `reply_due_at` from `support.first_response_hours` (2); priority 1–5, higher is more urgent [DD §11]                                                                                  |
| Stored           | `support_tickets` (`status ticket_status_t`, `priority`, `assigned_admin_id`, `merged_into_id`), `support_messages` (`author_kind author_kind_t`, `is_internal_note`), `feedback`, `help_article_votes` |
| Derived / cached | None                                                                                                                                                                                                    |
| Served           | Member: own tickets and messages, never internal notes; event `support.message.new`. Admin: A27                                                                                                         |
| Changed by       | Member and agent replies, assignment, merge, close                                                                                                                                                      |
| End of life      | 24 months after close [DD §11]                                                                                                                                                                          |

### 3.15 Consents and legal acceptances

| Stage            | What happens                                                                                                                                                                                                                                                           |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Collected        | C5 (Terms, Privacy, Guidelines), B3 (biometric), P3 / LG6 (genotype, faith), NT1, LG4: `POST /v1/consents`, `PUT /v1/me/privacy/sensitive`; website W03 consent receipt [TR §8.2], [WEB §3.10]                                                                         |
| Validated        | `kind` ∈ `consent_kind_t`, `action` ∈ `granted`, `withdrawn`; the version must be the published document version; `screen_code` required [SQL]                                                                                                                         |
| Prepared         | The hash of the text shown is stored (`text_hash`); a withdrawal is a new row, never an update                                                                                                                                                                         |
| Stored           | `consent_records` (append-only: `kind`, `action`, `document_id`, `version text`, `screen_code`, `text_hash`, `ip inet`, `user_agent`), `legal_documents` (versioned, immutable once published), `consent_receipts` (website, no IP), `privacy_requests`, `legal_holds` |
| Derived / cached | `v_current_consents` (the latest action per kind)                                                                                                                                                                                                                      |
| Served           | `GET /v1/me/consents` (LG6 history), `GET /v1/legal/{kind}?locale`; re-accept sheet from `reaccept_from`; admin A30, A36                                                                                                                                               |
| Changed by       | Member grants and withdrawals; a new published legal version                                                                                                                                                                                                           |
| End of life      | Account + 6 years; privacy-request register 6 years [TR §16.1]                                                                                                                                                                                                         |

### 3.16 CMS content and website forms

| Stage            | What happens                                                                                                                                                                                                                                                                                                                                  |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Collected        | Staff in A28 / A29; visitors through `POST /public/v1/contact` · `/newsletter` · `/waitlist` · `/careers/{id}/apply` · `/uploads` [TR §8.2]                                                                                                                                                                                                   |
| Validated        | Content: `content_workflow_guard()` and the workflow CHECKs; legal short version ≤ 600. Forms: origin check, per-form token, honeypot, timing, `public.forms`, size limits, HTML stripped; uploads type- and virus-scanned [WEB §3.12]                                                                                                        |
| Prepared         | Each publish snapshots a revision (`content_snapshot()`); the live pointer moves on publish; non-member addresses encrypted with a hash for lookup; safety reports get a reference and priority (`contact_submission_defaults()`) [TR §6.1], [SQL]                                                                                            |
| Stored           | `site_pages`, `site_blocks`, `site_page_sections`, `media_library`, `stories`, `story_consents`, `careers_jobs`, `press_items`, `investor_documents`, `content_revisions`, `site_settings`, `cms_publish_runs`; forms: `contact_submissions`, `newsletter_subscribers`, `waitlist_entries`, `job_applications`, `web_uploads`, `beta_invites` |
| Derived / cached | Static site build (`site.publish`: rebuild, cache purge, sitemap, smoke test, rollback on failure); `v_public_plan_prices`; `web_redirects_daily`                                                                                                                                                                                             |
| Served           | `GET /public/v1/pages/{slug}` · `/stories` · `/careers` · `/press` · `/investors` · `/plans`: published snapshot only. Form rows only to staff in A29                                                                                                                                                                                         |
| Changed by       | Content workflow `draft` → `in_review` → `approved` → `scheduled` → `published` → `archived`; story consent withdrawal (unpublished within 24 h)                                                                                                                                                                                              |
| End of life      | Content permanent; applications 12 months; contact forms 24 months; newsletter until unsubscribe + 30 days; unattached uploads 24 h [DD §13]                                                                                                                                                                                                  |

### 3.17 Config and catalogues

| Stage            | What happens                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Collected        | Seeds in the migrations; staff edits in A31 (config, flags, versions, maintenance), A21 (plans, prices, entitlements), catalogue pages, A25 (templates, translations)                                                                                                                                                                                                                                                                                     |
| Validated        | `remote_config` `min_value` / `max_value` / `unit`; `enforce_config_approval()` in production under the key's `permission_key`; i18n `max_length`, reviewer is not the last editor [DD §13], [DD §1]                                                                                                                                                                                                                                                      |
| Prepared         | None beyond versioning and audit                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Stored           | `remote_config` (`key`, `value jsonb`, `is_public`, `group_key`), `feature_flags`, `feature_flag_overrides`, `app_versions`, `maintenance_windows`, `rate_limit_policies`, `countries`, `cities`, `languages`, `option_sets`, `options`, `vibe_tags`, `industries`, `prompts`, `report_reasons`, `message_effects`, `venues`, `plans`, `entitlements`, `role_entitlements`, `products`, `prices`, `i18n_strings`, `decision_reasons`, `plan_compare_rows` |
| Derived / cached | Redis `cfg:remote`, `cfg:flags` (60 s); client bootstrap copy                                                                                                                                                                                                                                                                                                                                                                                             |
| Served           | `GET /v1/config?platform&version` (public subset), `GET /v1/options/{type}`, `GET /v1/prompts`, `GET /v1/plans`; labels through i18n catalogues                                                                                                                                                                                                                                                                                                           |
| Changed by       | Permissioned admin edits, with approval where flagged                                                                                                                                                                                                                                                                                                                                                                                                     |
| End of life      | Permanent; price versions are never edited [DD §1]                                                                                                                                                                                                                                                                                                                                                                                                        |

### 3.18 Audit events

| Stage            | What happens                                                                                                                                                                                                                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Collected        | Written by the admin API in the same transaction as every write, PII reveal and evidence view [ADM §1.3]                                                                                                                                                                                         |
| Validated        | A required reason where the permission says so (5 to 2,000 characters); approval id where required                                                                                                                                                                                               |
| Prepared         | `before` / `after` hold changed fields only, personal fields masked; trigger `admin_audit_chain()` takes the advisory lock, draws `chain_seq`, sets `prev_hash` and `row_hash = admin_audit_row_hash(prev_hash, to_jsonb(row))` [TR §7.1]                                                        |
| Stored           | `admin_audit_log` (partitioned; `actor_kind`, `admin_id`, `session_id`, `permission_key`, `action`, `target_type`, `target_id`, `reason`, `approval_id`, `before`, `after`, `ip`, `user_agent`, `request_id`, `chain_seq`, `prev_hash`, `row_hash`); `admin_audit_chain_runs`, `admin_approvals` |
| Derived / cached | Nightly verification runs                                                                                                                                                                                                                                                                        |
| Served           | Admin A07 (`audit.read`), export (`audit.export`, re-auth)                                                                                                                                                                                                                                       |
| Changed by       | Nothing: UPDATE and DELETE are refused                                                                                                                                                                                                                                                           |
| End of life      | 7 years, then cold storage [TR §16.1]                                                                                                                                                                                                                                                            |

### 3.19 Analytics events

| Stage            | What happens                                                                                                                                                                                                                                               |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Collected        | Client SDK after consent: `POST /v1/events` (batch); website server-side counts without identifiers [TR §8.2], [WEB §3.11]                                                                                                                                 |
| Validated        | `event_name` matches `^[a-z0-9_.]{2,80}$` and the `screen.action` rule; analytics consent; the event catalogue is published by MOD-18 (ruling R17)                                                                                                         |
| Prepared         | Server stamps `received_at`, plan, country; no free text or contact details in `properties`                                                                                                                                                                |
| Stored           | `analytics_events` (partitioned by `occurred_at`; `id bigint`, `user_id`, `anon_id`, `session_id`, `event_name`, `screen_code`, `platform platform_t`, `app_version`, `locale`, `country`, `plan`, `properties jsonb`); a copy at PostHog; research tables |
| Derived / cached | `mv_admin_daily_kpis`, `mv_active_users_daily`, funnels                                                                                                                                                                                                    |
| Served           | Aggregates to admin A33 / A34 and to `app_readonly`                                                                                                                                                                                                        |
| Changed by       | Nothing (append-only)                                                                                                                                                                                                                                      |
| End of life      | 13 months raw, then aggregated [TR §16.1]                                                                                                                                                                                                                  |

## 4. State machines

Who triggers: **M** member, **A** admin (with the permission named), **S** system (API rule, database
function or job), **P** provider event.

### 4.1 Account state: `users.status` (`account_status_t`)

Values: `onboarding`, `active`, `restricted`, `suspended`, `banned`, `deletion_pending`, `deleted`.

| From                             | To                 | Trigger                                                                                            | Who                       | Source              |
| -------------------------------- | ------------------ | -------------------------------------------------------------------------------------------------- | ------------------------- | ------------------- |
| (new)                            | `onboarding`       | Account created (E1 / G1 / AP1); default                                                           | M                         | [SQL]               |
| `onboarding`                     | `active`           | `POST /v1/me/onboarding/complete` (C8); `onboarding_completed_at` set                              | M                         | [TR §8.2], [SQL]    |
| `active`                         | `restricted`       | Sanction (`moderation_actions.action = 'restrict'`), or auto-restrict by an abuse rule             | A / S                     | [DD §9], [TR §13.4] |
| `active`, `restricted`           | `suspended`        | Sanction `suspend` (7 / 30 days)                                                                   | A (`users.suspend`)       | [DD §9]             |
| any live state                   | `banned`           | Sanction `ban` (second admin approves); confirmed minor                                            | A (`users.ban`, approval) | [TR §7.1], [OD-33]  |
| `restricted`, `suspended`        | `active`           | `lift_restriction` / `unsuspend`; `restrictions.expire` lifts ended suspensions; appeal overturned | A / S                     | [TR §11], [SQL]     |
| `banned`                         | `active`           | `unban`                                                                                            | A (`users.ban`)           | [SQL]               |
| `active` (and sanctioned states) | `deletion_pending` | `POST /v1/me/deletion` (M+), AS3; CHECK ties the state to `deletion_scheduled_for`                 | M / A (erasure, approval) | [TR §8.2], [SQL]    |
| `deletion_pending`               | previous state     | `DELETE /v1/me/deletion` (AS5) within 14 days                                                      | M                         | [TR §8.2]           |
| `deletion_pending`               | `deleted`          | `erasure.run` on day 14                                                                            | S                         | [TR §11]            |

Rule: `users.status` follows the live `account_restrictions` rows; the restriction row (kind, scope,
`ends_at`, `lifted_at`) is the record, the status is the summary.

### 4.2 Member role: `users.role` (`member_role_t`) and plan (`plan_t`)

Values: `BASIC`, `PENDING_REVIEW`, `ACTIVE`, `CLASSIC`, `SUPER`; plans `free`, `premium`, `gold`. The
role is never set directly: `compute_member_role()` derives it from verification and live
`entitlement_grants`, and `refresh_member_role()` writes the cache and `role_history` [TR §10.2].

| From                | To               | Trigger                                                                       | Who   | Source               |
| ------------------- | ---------------- | ----------------------------------------------------------------------------- | ----- | -------------------- |
| `BASIC`             | `PENDING_REVIEW` | Badge submitted                                                               | M     | [TR §2.1]            |
| `PENDING_REVIEW`    | `ACTIVE`         | Badge approved                                                                | S / A | [TR §2.1]            |
| `PENDING_REVIEW`    | `BASIC`          | Badge not approved                                                            | S / A | [TR §2.1], [DD §4]   |
| `ACTIVE`            | `CLASSIC`        | Premium grant (purchase or trial)                                             | P     | [TR §2.1]            |
| `ACTIVE`, `CLASSIC` | `SUPER`          | Gold grant                                                                    | P     | [TR §2.1]            |
| `CLASSIC`, `SUPER`  | `ACTIVE`         | Plan lapses (day 8 after a failed renewal) or ends; verification is permanent | S / P | [TR §4.6], [TR §2.1] |
| `SUPER`             | `CLASSIC`        | Downgrade at period end                                                       | P     | [TR §2.1]            |
| `ACTIVE` and above  | not verified     | Biometric consent withdrawn (PM4) removes VERIFIED; billing is not cancelled  | M     | [TR §16.2]           |

Database rule: `role NOT IN ('ACTIVE','CLASSIC','SUPER') OR is_verified` [SQL]. The role an
unverified member with a live paid grant resolves to after PM4 is not described: GAP-STD15-01.

### 4.3 Media: `media_assets.status` (`media_status_t`)

Values: `quarantine`, `processing`, `active`, `hidden`, `rejected`, `deleted`. Beside it:
`face_match` (`pending`, `match`, `no_match`, `manual_review`, `not_required`) and
`moderation_status` (`pending`, `approved`, `flagged`, `rejected`).

| From               | To           | Trigger                                                                                                                                                           | Who | Source            |
| ------------------ | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | ----------------- |
| (new)              | `quarantine` | Upload URL issued; default                                                                                                                                        | M   | [SQL]             |
| `quarantine`       | `processing` | `POST /v1/media/{id}/complete` starts `media.process`                                                                                                             | S   | [TR §11]          |
| `processing`       | `active`     | Processing passed. CHECK: a photo or clip is `active` only with `face_match` ∈ `match`, `not_required` and `moderation_status = 'approved'`, and no colour filter | S   | [SQL]             |
| `processing`       | `rejected`   | Moderation or checks failed                                                                                                                                       | S   | [TR §11]          |
| `active`           | `hidden`     | Moderator hides content (`media.moderate`)                                                                                                                        | A   | [SQL] permissions |
| `active`, `hidden` | `rejected`   | Moderator rejects                                                                                                                                                 | A   | [SQL] permissions |
| `active`           | `deleted`    | `DELETE /v1/me/media/{id}` (not the main photo first); `purge_after` set                                                                                          | M   | [TR §8.2]         |
| `deleted`          | `active`     | `POST /v1/me/media/{id}/restore` inside the window                                                                                                                | M   | [TR §8.2]         |
| `rejected`         | re-review    | `POST /v1/media/{id}/review-request` ("It's really me") opens a human review                                                                                      | M   | [TR §8.2]         |

### 4.4 Black Badge application: `badge_applications.status` (`badge_status_t`)

Values: `draft`, `submitted`, `in_review`, `needs_fix`, `approved`, `not_approved`, `withdrawn`.

| From        | To             | Trigger                                                                                     | Who                 | Source             |
| ----------- | -------------- | ------------------------------------------------------------------------------------------- | ------------------- | ------------------ |
| (new)       | `draft`        | B0 opens the stepper                                                                        | M                   | [DD §4]            |
| `draft`     | `submitted`    | `POST /v1/badge/submit` with a paid transaction (Idempotency-Key)                           | M                   | [TR §8.2], [DD §4] |
| `submitted` | `approved`     | `badge.autodecide` auto-approves                                                            | S                   | [TR §11]           |
| `submitted` | `in_review`    | `badge.autodecide` routes to a human (24 h SLA)                                             | S                   | [TR §11]           |
| `in_review` | `approved`     | Reviewer approves                                                                           | A (`badges.review`) | [DD §4]            |
| `in_review` | `needs_fix`    | Reviewer asks for a fix (`decision_reason_code`, `member_message_key`, `fix_step` required) | A                   | [SQL]              |
| `in_review` | `not_approved` | Reviewer declines → `badge.refund` unless fraud                                             | A                   | [TR §11]           |
| `needs_fix` | `submitted`    | `POST /v1/badge/fix`                                                                        | M                   | [TR §8.2]          |
| any         | `withdrawn`    | Not described                                                                               |                     | GAP-STD15-01       |

Liveness and other checks use `verification_result_t`: `pending` → `pass` / `fail` / `review` /
`expired` [SQL].

### 4.5 Match: `matches.status` (`match_status_t`) and intro: `intro_sessions.status` (`intro_status_t`)

Match values: `active`, `intro_expired`, `moved_on`, `unmatched`, `blocked`, `closed`.

| From     | To              | Trigger                                                                         | Who | Source            |
| -------- | --------------- | ------------------------------------------------------------------------------- | --- | ----------------- |
| (new)    | `active`        | `record_reaction()`: Like + Like = `match`; a Somewhat on either side = `maybe` | S   | [TR §8.4]         |
| `active` | `intro_expired` | `intro.expire`: no intro started before `intro_expires_at` (24 h)               | S   | [TR §11], [OD-02] |
| `active` | `moved_on`      | `decide_intro()`: at least one Move on; 30-day cooldown both ways               | M   | [SQL]             |
| `active` | `unmatched`     | `unmatch()`; closes the conversation; cooldown `unmatch.cooldown_days`          | M   | [SQL]             |
| `active` | `blocked`       | Either member blocks the other                                                  | M   | [DD §9]           |
| any      | `closed`        | Not described                                                                   |     | GAP-STD15-01      |

Intro values: `waiting`, `live`, `ended`, `decided`, `expired`. Outcome (`intro_sessions.outcome`):
`both_keep`, `moved_on`, `expired`, `skipped_to_chat`.

| From      | To        | Trigger                                                                                                    | Who | Source            |
| --------- | --------- | ---------------------------------------------------------------------------------------------------------- | --- | ----------------- |
| (new)     | `waiting` | Created with the match                                                                                     | S   | [TR §8.4]         |
| `waiting` | `live`    | Both present (`intro:presence:{session_id}`): `started_at` set, `ends_at` = start + 60 s                   | S   | [DD §5], [DD §14] |
| `live`    | `ended`   | 60 s pass; `intro.expire` closes live sessions; `decide_by` = end + `intro.decision_window_hours`          | S   | [TR §11], [DD §5] |
| `ended`   | `decided` | `decide_intro()`: both Keep → `both_keep` and the conversation is created; otherwise `moved_on`            | M   | [SQL]             |
| `waiting` | `expired` | `intro.expire` past `expires_at`                                                                           | S   | [TR §11]          |
| `waiting` | `decided` | `POST /v1/intros/{id}/skip` (Premium): outcome `skipped_to_chat`, conversation `opened_via = 'skip_intro'` | M   | [TR §8.2], [SQL]  |

Decisions are blind and final: `intro_decisions` refuses updates; a first Keep returns `waiting`
until the second decision arrives [SQL]. What happens to an `ended` session with no decision after
`decide_by` is not described: GAP-STD15-01.

### 4.6 Conversation: `conversations.state` (`conversation_state_t`) and Direct Spec: `dm_requests.status` (`dm_status_t`)

Conversation values: `request`, `open`, `read_only`, `closed`. `closed_reason`: `unmatched`,
`blocked`, `account_deleted`, `moderation`, `declined`. `opened_via`: `both_keep`, `skip_intro`,
`dm_accepted`.

| From                | To          | Trigger                                                              | Who       | Source                                       |
| ------------------- | ----------- | -------------------------------------------------------------------- | --------- | -------------------------------------------- |
| (new)               | `open`      | `decide_intro()` both Keep, or skip intro                            | S         | [SQL]                                        |
| (new)               | `request`   | Direct Spec or group-member DM sent                                  | M         | [DD §6]                                      |
| `request`           | `open`      | `POST /v1/requests/{id}/accept` (uses a slot)                        | M         | [TR §8.2]                                    |
| `request`           | `closed`    | Declined (`closed_reason = 'declined'`)                              | M         | [SQL]                                        |
| `open`              | `read_only` | Plan lapse: conversations above the new limit become read-only (BL6) | S         | [TR §4.6]                                    |
| `read_only`         | `open`      | Plan restored or a slot freed                                        | S         | [TR §4.6] (implied; confirm in GAP-STD15-01) |
| `open`, `read_only` | `closed`    | `unmatch()`, block, account erasure, moderation                      | M / S / A | [SQL]                                        |

Direct Spec values: `pending`, `accepted`, `declined`, `blocked`, `expired`, `filtered`. `pending` →
`accepted` / `declined` / `blocked` by the recipient; `pending` → `expired` by `dm.expire` at
`expires_at` (`dm_request.expiry_days` = 14); `filtered` is set at send time by the safety filter.
CHECK: `responded_at` is NULL exactly for `pending`, `filtered`, `expired` [SQL], [TR §11].

### 4.7 Message

A message has no status enum. Its state over time is carried by columns [SQL]:

| Aspect           | Values                                                                                                                                                                         | Who               |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------- |
| Kind             | `message_kind_t`: `text`, `voice`, `image`, `system`, `date_invite`, `intro_recap`                                                                                             | M / S             |
| Safety verdict   | `safety_verdict_t`: `clean`, `warned` stored. `blocked` is never stored (CHECK): the send fails and a `message_failures` row records the reason and a body hash                | S                 |
| On the device    | Sending → sent (server acknowledged, `message.new`) or failed (ES6: safety filter, conversation limit, restricted, rate limited). Messages are never queued silently [TR §4.2] | Client view model |
| Read             | `conversation_participants.last_read_at` watermark, not a per-message flag; `read.updated` goes to Gold viewers only                                                           | M                 |
| Edited / deleted | `edited_at`, `deleted_at` (a text message may have a NULL body only when deleted); event `message.deleted`                                                                     | M                 |
| Purged           | With the conversation, after the evidence snapshot                                                                                                                             | S                 |

### 4.8 Subscription: `subscriptions.status` (`subscription_status_t`)

Values: `trialing`, `active`, `grace`, `on_hold`, `cancelled`, `lapsed`, `paused`, `refunded`,
`revoked`. Every change also writes a `subscription_events` row (`subscription_event_t`).

| From        | To          | Trigger (event)                                                                                                               | Who   | Source                 |
| ----------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------- | ----- | ---------------------- |
| (new)       | `trialing`  | 3-day Premium trial starts (`trial_started`), once per verified person                                                        | M / P | [DD §10]               |
| (new)       | `active`    | Purchase (`created`)                                                                                                          | P     | [TR §12]               |
| `trialing`  | `active`    | Trial converts (`trial_converted`)                                                                                            | P     | [SQL]                  |
| `trialing`  | `cancelled` | Trial cancelled (`trial_cancelled`)                                                                                           | M     | [TR §8.2]              |
| `active`    | `active`    | Renewal (`renewed`), upgrade (`upgraded`, prorated), scheduled downgrade (`downgrade_scheduled` → `downgraded` at period end) | P / M | [TR §2.1], [SQL]       |
| `active`    | `cancelled` | Cancel at period end (`cancel_scheduled`); access continues until `current_period_end`                                        | M     | [TR §2.1], [DD §13B.3] |
| `cancelled` | `active`    | Uncancelled before the period ends (`uncancelled`)                                                                            | M / P | [TR §12]               |
| `active`    | `grace`     | Failed renewal (`billing_issue`, `grace_started`): 7 days of full access, reminders days 1, 4, 6                              | P     | [TR §4.6]              |
| `grace`     | `active`    | Payment recovered (`recovered`)                                                                                               | P     | [SQL]                  |
| `grace`     | `lapsed`    | Day 8 (`lapsed`); role recomputed; BL6 choices apply                                                                          | S     | [TR §4.6]              |
| `cancelled` | `lapsed`    | Period ends                                                                                                                   | S / P | [TR §4.6]              |
| `active`    | `on_hold`   | Store account hold (`on_hold`): access paused, store retrying; still the one live subscription                                | P     | [OD-37]                |
| `on_hold`   | `active`    | Store recovers the payment; resumes without double billing                                                                    | P     | [OD-37]                |
| `active`    | `paused`    | `paused_reason` ∈ `suspension`, `store_pause` (`paused`)                                                                      | S / P | [SQL]                  |
| `paused`    | `active`    | `resumed`                                                                                                                     | S / P | [SQL]                  |
| live states | `refunded`  | Refund (`refunded`)                                                                                                           | P / A | [SQL]                  |
| live states | `revoked`   | Provider revokes (`revoked`)                                                                                                  | P     | [SQL]                  |

"Live" for `uq_subs_one_live` means `trialing`, `active`, `grace`, `on_hold`, `cancelled` (until
period end) and `paused` [DD §13B.3]. Store-billed changes happen in the store; web-billed changes
through our billing API [TR §4.6].

Transaction status (`transaction_status_t`): `pending` → `requires_action` (3-D Secure) →
`succeeded` or `failed`; `succeeded` → `refunded` / `partially_refunded` / `disputed` [SQL].

### 4.9 Refund: `refunds.status` and dispute: `disputes.status`

Refund values: `pending_approval`, `pending`, `processing`, `succeeded`, `failed`, `cancelled`.

| From               | To                 | Trigger                                                                                                    | Who                    | Source            |
| ------------------ | ------------------ | ---------------------------------------------------------------------------------------------------------- | ---------------------- | ----------------- |
| (new)              | `pending_approval` | Admin starts a refund; `refund_approval_guard()` requires a second admin (threshold 0)                     | A (`billing.refund`)   | [OD-05], [DD §10] |
| (new)              | `pending`          | System refund: Black Badge not approved (`badge.refund`), or a store refund mirrored from a provider event | S / P                  | [TR §11], [OD-04] |
| `pending_approval` | `pending`          | Second admin approves                                                                                      | A (`approvals.decide`) | [TR §7.1]         |
| `pending_approval` | `cancelled`        | Approval rejected, expired or withdrawn                                                                    | A                      | [DD §10]          |
| `pending`          | `processing`       | Sent to the provider (`attempts` + 1, same `idempotency_key`)                                              | S                      | [DD §10]          |
| `processing`       | `succeeded`        | Provider confirms; `completed_at`; `access_action` applied                                                 | P                      | [DD §10]          |
| `processing`       | `failed`           | Provider refuses; `failure_message`                                                                        | P                      | [DD §10]          |
| `failed`           | `processing`       | Retry with the same key                                                                                    | A / S                  | [SQL] comment     |

Dispute values (`dispute_status_t`): `needs_response` → `under_review` → `won` / `lost` → `closed`;
`disputes.decision` ∈ `accepted`, `declined` records our choice [SQL]. The edges are implied by the
value names and `evidence_due_by`; they are listed for confirmation in GAP-STD15-01.

### 4.10 Moderation case, report, appeal

Case values (`case_status_t`): `queued`, `claimed`, `awaiting_member`, `decided`, `closed`.

| From              | To                | Trigger                                                                           | Who   | Source                 |
| ----------------- | ----------------- | --------------------------------------------------------------------------------- | ----- | ---------------------- |
| (new)             | `queued`          | A report, badge review, media review, appeal, escalation or rule hit opens a case | S     | [DD §9]                |
| `queued`          | `claimed`         | Reviewer claims (`cases.claim`); queue order priority desc, `sla_due_at` asc      | A     | [OD-27]                |
| `claimed`         | `queued`          | Release, or the stale-claim release job (claim-timeout config keys, ruling R16)   | A / S | Coordinator ruling R16 |
| `claimed`         | `awaiting_member` | "Ask for an age check": profile hidden, `age_verification_requests` opened        | A     | [OD-33]                |
| `awaiting_member` | `queued`          | The member sends ID; the case reopens                                             | M     | [OD-33]                |
| `claimed`         | `decided`         | Decision recorded with a `moderation_actions` row                                 | A     | [DD §9]                |
| `decided`         | `closed`          | QA and follow-up done                                                             | A / S | [DD §9] (QA fields)    |

Report values (`report_status_t`): `open` → `triaged` → `in_review` → `actioned` or `dismissed`;
`duplicate` links to the primary through `duplicate_of` [SQL], [ADM A14].

Appeal values (`appeal_status_t`): `submitted` → `in_review` → `upheld` or `overturned` (both need
`member_message_key` and `decision_note`, CHECK); `withdrawn`. One appeal per decision; a warning
can be appealed; decided within `appeals.sla_hours` (48) [OD-28], [OD-35], [SQL].

Age check (`age_verification_requests.status`): `open` → `passed` / `failed` (confirmed minor → ban
with reason `minor`) / `expired` [OD-33], [SQL].

### 4.11 Data export and deletion

Export values (`export_status_t`): `requested`, `building`, `held`, `ready`, `expired`, `failed`.

| From        | To          | Trigger                                                                           | Who | Source           |
| ----------- | ----------- | --------------------------------------------------------------------------------- | --- | ---------------- |
| (new)       | `requested` | `POST /v1/me/export` (M+), once a day (`UNIQUE (user_id, requested_on)`)          | M   | [TR §8.2], [SQL] |
| `requested` | `building`  | `export.build` starts                                                             | S   | [TR §11]         |
| `requested` | `held`      | A DPO-handled request waits for identity confirmation, or a legal hold applies    | A   | [DD §11]         |
| `held`      | `building`  | Identity confirmed (`privacy_requests.identity_verified_at`)                      | A   | [DD §11]         |
| `building`  | `ready`     | ZIP stored; 7-day link e-mailed                                                   | S   | [TR §11]         |
| `building`  | `failed`    | Build error (`error`)                                                             | S   | [SQL]            |
| `ready`     | `expired`   | `link_expires_at` passes; file deleted by `exports.purge`; row deleted at 30 days | S   | [TR §16.1]       |

Deletion values (`deletion_status_t`): `scheduled` → `cancelled` (AS5) or `executed` (`erasure.run`
on day 14) or `failed`. `source` ∈ `member`, `admin_duplicate`, `admin_erase`, `privacy_request`; an
admin erasure needs approval [SQL], [DD §9].

Privacy request (`privacy_requests.status`): `open` → `in_progress` → `completed` or `rejected`
(`rejection_reason`). Legal hold (`legal_holds.status`): `pending_approval` → `live` or `rejected`;
`live` → `released` [SQL].

### 4.12 Other state sets

Values are exact; the triggers are the ones the sources describe.

| Object                               | Type                    | Values                                                                                                  | Main triggers                                                                                                                             | Source             |
| ------------------------------------ | ----------------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| `groups.status`                      | `group_status_t`        | `pending_review`, `active`, `paused`, `removed`, `deleted`                                              | Group review approves or removes (A); owner deletes (M)                                                                                   | [DD §7]            |
| `group_members.status`               | `group_member_status_t` | `active`, `pending_approval`, `invited`, `left`, `removed`, `banned`                                    | Join, "Ask to join" approval, invite accept, leave, owner / admin removal                                                                 | [DD §7], [TR §8.2] |
| `group_invites.status`               | `invite_status_t`       | `pending`, `accepted`, `declined`, `expired`, `revoked`                                                 | Recipient accepts or declines; expiry                                                                                                     | [SQL]              |
| `meetups.status`                     | `meetup_status_t`       | `draft`, `proposed`, `accepted`, `new_time_suggested`, `scheduled`, `cancelled`, `completed`, `expired` | Propose (EV3), accept, "Suggest another", cancel (member or admin), invite expiry 48 h (`meetup.reminders`), event passes                 | [DD §8], [TR §11]  |
| `meetup_rsvps.status`                | `rsvp_status_t`         | `invited`, `going`, `maybe`, `declined`, `pending_approval`, `waitlist`, `cancelled`                    | `POST /v1/meetups/{id}/rsvp`; capacity counts `going` only                                                                                | [SQL]              |
| `meetup_time_proposals.status`       | text CHECK              | `pending`, `accepted`, `declined`, `superseded`                                                         | The other person answers; a newer proposal supersedes                                                                                     | [SQL]              |
| `trusted_contacts.status`            | `trusted_status_t`      | `waiting_opt_in`, `active`, `opted_out`, `removed`                                                      | YES → `active`; STOP → `opted_out`; member removes. CHECK ties `active` to the timestamps                                                 | [SQL], [DD §8]     |
| `safety_checkins.status`             | `checkin_status_t`      | `scheduled`, `due`, `ok`, `snoozed`, `alerted`, `escalated`, `cancelled`                                | `checkin.due` at the planned end; member answers OK or "Add 1 hour"; after 15 min `checkin.escalate` alerts contacts and the safety queue | [TR §11], [DD §8]  |
| `safety_escalations.status`          | text CHECK              | `open`, `acknowledged`, `contacted_member`, `contacted_authorities`, `resolved`, `false_alarm`          | Safety desk timeline (`safety_escalation_updates`); acknowledge within `safety.ack_target_minutes`                                        | [SQL], [DD §8]     |
| `account_restrictions.kind`          | `restriction_kind_t`    | `restricted`, `suspended`, `banned`                                                                     | Sanction; ends by `ends_at`, `lifted_at`                                                                                                  | [DD §9]            |
| `notifications.status`               | `delivery_status_t`     | `queued`, `batched`, `throttled`, `sent`, `delivered`, `opened`, `failed`, `suppressed`                 | `notifications.deliver`; provider receipts; `email_suppressions`                                                                          | [SQL], [TR §11]    |
| `support_tickets.status`             | `ticket_status_t`       | `open`, `pending_member`, `pending_agent`, `solved`, `closed`                                           | Replies flip the pending side; agent solves; closes                                                                                       | [SQL]              |
| CMS rows                             | `content_status_t`      | `draft`, `in_review`, `approved`, `scheduled`, `published`, `archived`                                  | `content_workflow_guard()`; scheduling job; publish pipeline                                                                              | [SQL], [TR §6.1]   |
| `i18n_strings.status`                | text CHECK              | `draft`, `machine`, `reviewed`, `published`                                                             | Translator, reviewer (not the last editor), publish                                                                                       | [SQL], [DD §1]     |
| `admin_approvals.status`             | `approval_status_t`     | `pending`, `approved`, `rejected`, `expired`, `executed`, `cancelled`, `failed`                         | Second admin decides (never the requester); expiry +72 h; the server executes the stored payload                                          | [ADM §1.2], [SQL]  |
| `admin_users.status`                 | `admin_status_t`        | `invited`, `active`, `suspended`, `deactivated`                                                         | Invite accepted; lock (`locked_at`); break-glass account dormant as `suspended`                                                           | [SQL], [ADM A03]   |
| `webhook_events.status`              | text CHECK              | `received`, `processing`, `processed`, `failed`, `ignored`                                              | Handler; `webhooks.retry` with backoff, alert after 5 attempts                                                                            | [SQL], [TR §11]    |
| `web_uploads.scan_status`            | text CHECK              | `pending`, `clean`, `infected`, `rejected_type`                                                         | Type and virus checks                                                                                                                     | [SQL]              |
| `waitlist_entries.status`            | text CHECK              | `pending`, `confirmed`, `invited`, `notified`, `deleted`                                                | Confirm (link or OTP), staff invite, launch notice, deletion (identifier cleared)                                                         | [SQL]              |
| `beta_invites.status`                | text CHECK              | `sent`, `redeemed`, `expired`, `revoked`                                                                | `redeem_beta_invite()`; `beta_invites.expire`                                                                                             | [SQL]              |
| `newsletter_subscribers` status      | `subscriber_status_t`   | `pending`, `confirmed`, `unsubscribed`, `bounced`, `complained`                                         | Double opt-in; unsubscribe; Resend events                                                                                                 | [SQL]              |
| `contact_submissions.status`         | text CHECK              | `new`, `triaged`, `routed`, `in_progress`, `answered`, `resolved`, `spam`, `closed`                     | Staff in A29                                                                                                                              | [SQL]              |
| `job_applications.status`            | text CHECK              | `received`, `reviewing`, `interview`, `offer`, `hired`, `not_progressed`, `withdrawn`                   | Staff in A29                                                                                                                              | [SQL]              |
| `security_incidents.status`          | text CHECK              | `open`, `contained`, `resolved`, `post_mortem`                                                          | A32; CHECKs require `contained_at` and `resolved_at`                                                                                      | [SQL]              |
| `admin_security_alerts.status`       | text CHECK              | `open`, `expected`, `not_me`, `network_blocked`                                                         | "This was me" / "This wasn't me"                                                                                                          | [SQL]              |
| `calls` status (after public launch) | `call_status_t`         | `ringing`, `active`, `missed`, `declined`, `ended`, `failed`                                            | Ring timeout `calls.ring_timeout_seconds`; answer, decline, end                                                                           | [SQL], [DD §6]     |
| `spotlight_rotations.status`         | text CHECK              | `scheduled`, `live`, `done`, `skipped`, `cancelled`                                                     | `spotlight.schedule` / `spotlight.start`                                                                                                  | [SQL], [TR §11]    |

## 5. Rules for adding or changing a model

1. Start from the life-cycle table: fill in all eight stages for the new data before writing a
   migration. If a stage has no answer in the sources, raise a gap.
2. Give the table its PII class, retention rule and manifest entries
   ([1MM-STD-12](1MM-STD-12-DATA-HANDLING.md) §2, §11).
3. A new status column gets a state table in this document in the same pull request, with who
   triggers each transition, and the transitions are enforced in the domain layer and, where the
   database can, by a constraint.
4. A new value on an existing enum is a migration of its own and a contract change; clients must
   already tolerate unknown values (section 2.5).
5. Never add a column that copies another table's truth without naming the function or job that
   keeps it right (as `users.role` has `refresh_member_role()` and `v_role_drift`).
6. A DTO is designed for a screen and an audience, not generated from a table (section 2.9).

## 6. Gaps raised

Dispositions are recorded in [1MM-LOG-03](../1MM-LOG-03-TECHNICAL-REFERENCE-EXTENSIONS.md)
(Technical Reference and schema), [1MM-LOG-02](../1MM-LOG-02-UI-UPDATES.md) (UI) and
[1MM-LOG-04](../1MM-LOG-04-OPEN-DECISIONS-AND-FOLLOW-UPS.md) (owner decisions and repository
follow-ups).

| Gap id       | Type | Where found                                                   | What is missing or conflicting                                                                                                                                                                                                                                                                                                                                                                                                 | Proposed resolution                                                                                                                                                                                                                                                                                                                                              | Blocks                           |
| ------------ | ---- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| GAP-STD15-01 | TR   | [SQL] status enums; [TR §8.4], [TR §4.6], [DD §4–§10]         | The schema fixes status values but the Technical Reference has no transition tables. Not described: `badge_status_t.withdrawn` (who, when, refund?); `match_status_t.closed`; an `ended` intro with no decision after `decide_by`; `read_only` → `open` on plan restore; the role of a member who withdraws biometric consent while a paid plan is live; dispute edges; `subscription_status_t` `refunded` / `revoked` targets | Add a "State machines" section to the Technical Reference adopting section 4 of this document, and decide the listed cases. Proposed defaults: `withdrawn` = member abandons before submit (no payment taken); `closed` = terminal state set at erasure; undecided intros resolve as `moved_on` at `decide_by`; `read_only` returns to `open` when a slot exists | MOD-06, MOD-08, MOD-10 API gates |
| GAP-STD15-02 | TR   | [SQL] `transactions.charged_amount_minor`, `charged_currency` | The minor-unit exponent per charged currency is not stated, and `charged_currency` allows 3 to 5 letters (legacy crypto assets), so a client cannot format the charged amount from the sources alone                                                                                                                                                                                                                           | State in [TR §4.6] that the exponent follows ISO 4217 for 3-letter codes and that the API returns a pre-formatted `charged_display` string beside the integer, so clients never need the exponent                                                                                                                                                                | MOD-10 API gate                  |
| GAP-STD15-03 | TR   | [TR §8.1]                                                     | The wire format of instants and dates (ISO 8601 UTC strings, `date` as `YYYY-MM-DD`) and the casing of JSON fields (camelCase in the examples of [TR §8.2]; snake_case in the scaffold's contracts, for example `request_id`, `next_cursor`) are implied, not stated                                                                                                                                                           | Add both to [TR §8.1]; [1MM-STD-14](1MM-STD-14-CODING-CONVENTIONS.md) §4.1 carries the rule for the contracts package (snake_case wire fields, as the scaffold has)                                                                                                                                                                                              | MOD-00 contract pipeline         |

## Change log

| Version | Date        | Change                                                                                  |
| ------- | ----------- | --------------------------------------------------------------------------------------- |
| v1.0    | 24 Nov 2026 | First issue: modelling conventions, life cycles for 19 entity families, state machines. |
