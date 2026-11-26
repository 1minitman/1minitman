# 1MM-STD-16 · Defensive programming

|              |                                                                                                                                                                                                                                                                                                                              |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Document** | 1MM-STD-16                                                                                                                                                                                                                                                                                                                   |
| **Status**   | Approved baseline · v1.0 · 24 Nov 2026                                                                                                                                                                                                                                                                                       |
| **Audience** | Engineers and coding agents                                                                                                                                                                                                                                                                                                  |
| **Owner**    | Engineering lead (code owners)                                                                                                                                                                                                                                                                                               |
| **Sources**  | [TR §5.1], [TR §5.3], [TR §8.1], [TR §8.4], [TR §8.5], [TR §11], [TR §12], [TR §13.1–13.4], [TR §14]; [ADM §1.1–1.4], [ADM A03], [ADM A06]; [WEB §3.12], [WEB §5.10]; [SQL]; repo `apps/api/src`, `apps/worker/src`, `packages/db`, `eslint.config.mjs`, `docs/USAGE.md`                                                     |
| **Related**  | [1MM-STD-13](1MM-STD-13-ERROR-CODES.md), [1MM-STD-06](1MM-STD-06-API-FIRST.md), [1MM-STD-01](1MM-STD-01-TESTING-STRATEGY.md), [1MM-STD-11](1MM-STD-11-SECURITY-AND-COMPLIANCE.md), [1MM-STD-12](1MM-STD-12-DATA-HANDLING.md), [1MM-STD-14](1MM-STD-14-CODING-CONVENTIONS.md), [1MM-DB-05](../database/1MM-DB-05-SECURITY.md) |

**What this document is for and when to open it.** The rule is "nothing goes through without
checks". This document says which check belongs at which boundary, which invariants the database
already enforces, and what a reviewer looks for. Open it when you write a handler, a job, a
webhook, a vendor adapter or any client code that reads data it did not create; use section 13 as
the review checklist.

## 1. Principles

1. **Parse at the boundary, trust inside.** Data crossing into a process is parsed with a zod
   schema into a typed value once. Code past the boundary takes the typed value and does not
   re-check shape.
2. **Check in layers.** A rule that matters is enforced where the person meets it (client, for
   speed), where the decision is made (API, always) and where the data lives (database, as the
   backstop). The client check is a courtesy; the other two are the rule.
3. **Fail closed.** When a check cannot be completed, the answer is "no" (section 8).
4. **Make wrong states unrepresentable.** Prefer a constraint, a unique index, a discriminated
   union or an exhaustive switch to a comment or a convention.
5. **Every write can arrive twice, late, or at the same time as another.** Design for it
   (sections 4 and 5).
6. **Every dependency can be slow or down.** Bound it (section 6).
7. **An error is a typed result.** It has a registry code from
   [1MM-STD-13](1MM-STD-13-ERROR-CODES.md); nothing is swallowed.

Security controls and threat mitigations are in
[1MM-STD-11](1MM-STD-11-SECURITY-AND-COMPLIANCE.md); this document is about the coding habits that
make them hold.

## 2. Validation at every boundary

| Boundary                       | What is validated                                                                                                                                                                                                                                                                                                                                                       | With                                                                                                                          | On failure                                                                                                      | State in the repo                                                                  |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| HTTP request                   | Path params, query, headers, body: types, lengths, ranges, enums, formats. Unknown sort and filter fields refused [ADM §1.4]. Body-size limit [TR §13.1]. `Content-Type` and origin on form routes [WEB §5.10]                                                                                                                                                          | The route's zod schemas in `packages/contracts`, applied by `createRouter()`                                                  | 422 `validation` before any use case runs                                                                       | Exists (`apps/api/src/platform/http/router.ts`)                                    |
| HTTP response                  | The handler returns exactly the declared schema: no extra fields (no accidental PII), no missing ones                                                                                                                                                                                                                                                                   | Typed `c.json()` against the route; response parsing in tests                                                                 | Type error at build; contract test failure                                                                      | Typing exists; contract tests are MOD-00                                           |
| WebSocket frame, SSE event     | Each inbound frame is parsed as an event schema; `message.send` has the same validation as REST [TR §8.3]                                                                                                                                                                                                                                                               | Event schemas in `packages/contracts`                                                                                         | Error event with the registry code; repeated bad frames close the socket                                        | MOD-00 / MOD-08                                                                    |
| Webhook                        | Signature over the **raw** body first; then provider and event id; then the payload shape for the event types we use; then the fact itself is re-fetched from the provider before access is granted [TR §12], [TR §13.4]                                                                                                                                                | Per-vendor verifier port; zod schema per event                                                                                | 401 `webhook_signature_invalid`; unknown types stored as `ignored`                                              | Router exists, empty (`createWebhooksRouter`)                                      |
| Queue payload                  | Ids only: never secrets, tokens, codes or personal data (`apps/worker/src/platform/job.ts`). Each job parses its payload with a zod schema, then loads rows by id and re-checks that they still qualify                                                                                                                                                                 | A payload schema on each `defineJob`                                                                                          | The job fails without retry for a malformed payload; logs the job name and id                                   | `defineJob` takes an untyped `object` today: GAP-STD16-01                          |
| Environment                    | Every variable, once, at start-up; the process refuses to start on a bad value                                                                                                                                                                                                                                                                                          | `EnvSchema` + `loadEnv()` in `apps/api/src/config/env.ts` and `apps/worker/src/config/env.ts`; each client's `src/lib/env.ts` | Exit with the variable name                                                                                     | Exists                                                                             |
| Database rows read back        | Typed columns through the Drizzle models. `jsonb` columns (`remote_config.value`, `feature_flags.rules`, payloads) are parsed with a schema keyed by `value_type` or by kind before use. Enum columns are switched exhaustively                                                                                                                                         | Drizzle models in `packages/db/src/schema/`; zod for `jsonb`                                                                  | Treated as a server fault: 500 `internal`, alert. A bad config value falls back to the coded default and alerts | Models exist for `remote_config`, `feature_flags`                                  |
| Redis values                   | Cached JSON is parsed on read; a parse failure is a cache miss, never an error to the caller                                                                                                                                                                                                                                                                            | zod                                                                                                                           | Re-read from PostgreSQL, overwrite the key                                                                      | MOD-00                                                                             |
| Third-party responses          | Status, content type and body shape of every vendor answer (Termii, Twilio, Resend, RevenueCat, Flutterwave, AWS Rekognition, Expo Push, Cloudflare)                                                                                                                                                                                                                    | A zod schema inside the vendor adapter in `infrastructure/`; the adapter returns a domain type or a typed failure             | `provider_error` / `provider_timeout`; never pass a vendor body through to a client or a log                    | Arrives with each adapter                                                          |
| API responses in clients       | The generated client gives compile-time types. At run time clients parse the responses they persist or branch on (tokens, entitlements, config bootstrap, problem documents)                                                                                                                                                                                            | zod schemas from `@1minitman/contracts`                                                                                       | `bad_response` ([1MM-STD-13](1MM-STD-13-ERROR-CODES.md) section 4.2); keep the previous good value              | Arrives with each client feature                                                   |
| Client storage                 | Anything read from MMKV, `expo-secure-store`, `localStorage` or the query cache is untrusted: old app versions wrote it. Each stored value has a schema and a version; a failed parse discards the value                                                                                                                                                                | zod; a `version` field per store                                                                                              | Drop and refetch; for tokens, sign out                                                                          | [1MM-STD-12](1MM-STD-12-DATA-HANDLING.md)                                          |
| Deep links and universal links | Route and every parameter parsed against an allow-list of routes; ids validated as ids; no parameter is ever rendered as HTML or used as a URL to open. A link to a gated screen passes the same auth and entitlement checks as in-app navigation                                                                                                                       | A link schema per route                                                                                                       | Open the default screen; never crash, never act                                                                 | Mobile, MOD-00 / MOD-03                                                            |
| Push payloads                  | Parsed as a notification schema; carry ids and a type, not content to trust. Tapping one navigates through the deep-link validator and refetches from the API                                                                                                                                                                                                           | zod                                                                                                                           | Ignore the payload; show nothing                                                                                | [1MM-STD-18](1MM-STD-18-NOTIFICATIONS.md)                                          |
| File uploads                   | Type and size declared when the presigned URL is issued; on completion the object is checked against the declaration, type-checked by content, re-encoded (strips EXIF, GPS and payloads), moderated, and only then leaves quarantine [TR §13.1], [TR §11 `media.process`]. Website uploads: quarantine prefix, AV and type checks before staff can open them [TR §6.1] | Server-side checks in the upload-complete use case and the `media.process` job                                                | The asset stays quarantined or is rejected; `upload_mismatch`, `unsupported_media_type`, `payload_too_large`    | MOD-04 ([ruling R1](../execution/1MM-EXE-00-MASTER-PLAN.md#7-coordinator-rulings)) |
| Text a member writes           | Length; the contact-detail filter on nicknames, names, bios, job titles, group names and DM notes; money and move-app phrases in early chats [TR §13.4]. Stored and rendered as text; no auto-links in chat [TR §13.1]                                                                                                                                                  | Shared filter in the API; a live copy in the app for feedback only [TR §5.1]                                                  | 422 `validation` + `contact_details`; `safety_filter`                                                           | MOD-03 / MOD-08 / MOD-09                                                           |
| URLs from users                | The server never fetches a user-supplied URL [TR §13.1]                                                                                                                                                                                                                                                                                                                 | No such code path                                                                                                             | n/a                                                                                                             | Rule                                                                               |
| Admin-entered configuration    | A config value is checked against `value_type`, `min_value`, `max_value` before it is saved; the constraint `rc_range_chk` keeps the range itself sane [SQL]                                                                                                                                                                                                            | API validation plus the table's CHECKs                                                                                        | 422 `validation`                                                                                                | MOD-02                                                                             |

Rules for schemas:

- Request schemas are **strict about what matters**: bounded strings (always a `max`), bounded
  arrays, bounded numbers, enums rather than free strings, `z.coerce` only for query strings.
- Clients parse responses **leniently about additions**: unknown fields are ignored, so the API can
  grow ([1MM-STD-06](1MM-STD-06-API-FIRST.md) section 7).
- One schema per shape, in `packages/contracts`; the app's forms reuse it (react-hook-form + zod
  [TR §5.1]). A copy of a rule in a client is a bug waiting for the server rule to change. A
  schema with config-driven limits is exported as a function of those limits, so the API and the
  client build it with the same live values ([1MM-STD-21](1MM-STD-21-CLIENT-INPUT-VALIDATION.md) §3).
- Validation never echoes the rejected value into logs or problem documents.

## 3. Authorisation: four checks, every request

Authentication says who is calling. These four say whether this call is allowed. They are
separate questions and each one is asked on the server.

| Check       | Question                                                                                              | Mechanism                                                                                                                                                                                             | Failure                                                                     |
| ----------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Entitlement | Does this member's role include the capability?                                                       | `packages/entitlements` resolved from `role_entitlements`; the role itself is recomputed by `refresh_member_role()`; drift is watched by `entitlements.reconcile` on `v_role_drift` [TR §9], [TR §11] | 403 `entitlement` with `upsell`; 402 `quota_exhausted` [TR §8.1]            |
| Permission  | Does this admin hold the permission now, in scope, from an allowed IP, with fresh MFA where required? | The server-side list in [ADM §1.1]: live session, active admin, `v_admin_effective_permissions`, scope, `ip_access_rules`, re-auth within 5 minutes for `requires_reauth`                             | 403 `permission`; 404 out of scope; 403 `reauth_required`; 202 for approval |
| RLS         | Can the database role see or write this row for this member?                                          | `app_api` is subject to row-level security; every member transaction runs `SET LOCAL app.user_id`; policies compare with `app_current_user_id()` [TR §8.1], [SQL]                                     | The row does not exist for the caller → 404 `not_found`                     |
| Ownership   | Is the caller a party to this specific thing?                                                         | An explicit predicate in the query (`WHERE user_id = :me`, participant of the conversation, member of the group), even where RLS also applies                                                         | 404 `not_found`                                                             |

Rules:

1. Every route declares its auth and gate in its definition; a route with neither is `public` and
   has a rate-limit policy. The contract test planned in MOD-00 enumerates operations and fails on
   one that declares nothing.
2. RLS is on for ten tables in the baseline (`profiles`, `reactions`, `conversation_participants`,
   `messages`, `inbox_items`, `consent_records`, `trusted_contacts`, `blocks`,
   `data_export_requests`, `reverification_requests`) [SQL]. For every other table the ownership
   predicate is the only row-level guard, so it is never omitted. `app_admin_api` and `app_worker`
   bypass RLS (`packages/db/roles/roles.sql`): their code carries the whole burden, and admin
   writes are audited in the same transaction [ADM §1.3].
3. A member transaction without `SET LOCAL app.user_id` must not run: the repository helper that
   opens member transactions takes the member id as a required argument. With the setting absent,
   `app_current_user_id()` is NULL and the ownership policies match nothing, with one exception:
   `profiles_read` still returns every non-hidden profile (GAP-DB05-03 in
   [1MM-DB-05](../database/1MM-DB-05-SECURITY.md)). RLS is therefore not a guard for unauthenticated
   code: the public surface must not query member tables at all.
4. Authorise against **current** state inside the transaction that acts, not against a value read
   earlier or sent by the client (plan, role, group role, restriction, block).
5. Blocks and restrictions are checked on every interaction between two members
   (`is_blocked_pair()`, `account_restrictions`) [SQL].
6. Not-found and not-allowed are indistinguishable wherever existence is itself private: other
   members' rows, out-of-scope admin rows, blocks, whether an e-mail has an account [ADM §1.1],
   [TR §13.2].
7. The UI hides what a caller cannot do and never relies on hiding [ADM §1.1].
8. Each of the four has a negative test per route (API gate G6 in
   [1MM-STD-06](1MM-STD-06-API-FIRST.md)).

## 4. Idempotency

| Kind of write                         | Key                                                                                     | Mechanism                                                                                                                                                   | Source              |
| ------------------------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| Payments, Black Badge submit, exports | `Idempotency-Key` header                                                                | Stored response under Redis `idem:{route}:{idempotency_key}` for 24 h; a replay returns it; payment rows also carry a UNIQUE `idempotency_key` column [SQL] | [TR §8.1], [DD §14] |
| Every admin write                     | `Idempotency-Key` (UUID v4 created when the dialog opens)                               | The same; a step-up resume reuses the key [ADM A03]                                                                                                         | [ADM §1.4]          |
| Every website form                    | `Idempotency-Key` header                                                                | The same                                                                                                                                                    | [WEB §5.10]         |
| Reactions                             | `client_reaction_id`                                                                    | `record_reaction()` returns the original outcome on a replay of `(actor, client_reaction_id)`                                                               | [TR §8.4], [SQL]    |
| Messages                              | `clientMsgId` (source spelling of [TR §8.2]; `client_msg_id` on the wire, GAP-STD15-03) | `message_client_ids` (primary key `sender_id, client_msg_id`), inserted in the same transaction as the message                                              | [TR §8.1], [SQL]    |
| Webhooks                              | `(provider, event_id)`                                                                  | UNIQUE on `webhook_events`; a duplicate is acknowledged and not processed                                                                                   | [TR §12], [SQL]     |
| Notifications                         | `dedupe_key`                                                                            | `uq_notifications_dedupe`, `uq_notifications_recipient_dedupe`                                                                                              | [SQL]               |
| Jobs                                  | The job's own state                                                                     | A job is written so a second run changes nothing: it selects rows still in the triggering state and moves them in one transaction                           | [TR §11]            |

Rules:

1. The same key with a different body is `idempotency_key_reused`; a key still in flight is
   `idempotency_in_progress` ([1MM-STD-13](1MM-STD-13-ERROR-CODES.md)).
2. A client generates the key once per user intent and reuses it for every retry of that intent,
   including after a sign-in or step-up detour. The app's offline outbox stores the key with the
   request [TR §15.2].
3. The durable guard is always in PostgreSQL (a unique key or a state predicate). Redis is the fast
   path; if it is lost, the unique index still refuses the second write.
4. Effects outside the database (send a message to a vendor, charge, refund) are made from the
   outbox or a job after the transaction commits, and use the vendor's own idempotency key where
   it has one [TR §13.1 "outbox for notifications"].
5. `PUT` and `DELETE` are idempotent by design; `POST` routes say in their definition whether they
   require the header.

## 5. Concurrency

The reference pattern is race-free matching [TR §8.4]. `record_reaction()` runs in one
transaction: replay check, role check, block check, then
`pg_advisory_xact_lock(hashtextextended(low_id || ':' || high_id, 0))` so only the two people
involved wait, then the upsert of the reaction, the read of the other person's live reaction, and
the insert of the match through the partial unique index `uq_matches_active_pair` [SQL]. Two likes
arriving in the same millisecond produce exactly one match.

| Situation                                   | Technique                                                                                                                | Example in the schema or sources                                                                          |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| "Only one live X per Y"                     | Partial unique index; catch the unique violation and map it to the registry code                                         | `uq_matches_active_pair`, `uq_conv_live_pair`, `uq_subs_one_live`, `uq_badge_open`, `uq_restriction_live` |
| Two parties acting on one pair              | Advisory transaction lock on the ordered pair                                                                            | `record_reaction()`                                                                                       |
| Spending a counted allowance                | `SELECT … FOR UPDATE` on the counter row, then update, in one transaction                                                | `spend_spec_view()` on `usage_counters`; Redis `quota:*` is the fast path, this is the truth [TR §8.5]    |
| Two editors of one record                   | Optimistic concurrency: `If-Match` with `updated_at` or `version`; `UPDATE … WHERE version = :expected`; zero rows → 412 | Profile edits [TR §8.1]; admin forms [ADM §1.4]; `remote_config.version`                                  |
| Claiming work from a queue                  | `UPDATE … WHERE claimed_by IS NULL … RETURNING`, or `FOR UPDATE SKIP LOCKED`                                             | Review queues (ruling R16); pg-boss for jobs                                                              |
| A decision that is final                    | Append-only row plus a trigger that refuses change                                                                       | `trg_intro_decisions_final` on `intro_decisions`; `decide_intro()`                                        |
| Approving a change made against older state | Store the `If-Match` value in the approval payload; re-validate against current state at approval                        | [ADM A06]                                                                                                 |
| Multi-row change                            | One transaction; notifications through the outbox                                                                        | [TR §13.1]                                                                                                |
| Cache and database                          | Write the database, then invalidate the key; never write the cache first                                                 | `billing.sync` clears `ent:*` after `refresh_member_role()` [TR §11]                                      |

Rules:

1. Never "check, then act" across two statements without a lock or a constraint. If a rule says
   "only one", there is a unique index for it; if there is not, raise a SCHEMA gap.
2. Locks are taken in a fixed order (lower id first, as `record_reaction()` does with `LEAST` /
   `GREATEST`) so two transactions cannot deadlock.
3. Transactions are short: no vendor call, no file transfer and no `await` on anything but the
   database inside one.
4. A unique violation is an expected outcome with a registry code, not a 500.
5. Concurrency rules are proven with **parallel connections** against a real database
   [TR §17.3], [1MM-STD-01](1MM-STD-01-TESTING-STRATEGY.md) section 3.

## 6. Timeouts, retries and circuit breaking

Every outbound call has a timeout [TR §13.1]. The scaffold shows the shape:
`createCheckReadiness()` races each probe against a 2-second timer and reports `down` rather than
hanging (`apps/api/src/modules/system/application/check-readiness.ts`).

| Concern            | Rule                                                                                                                                                                                                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Timeout            | Every vendor adapter, database statement and Redis command has one, passed as an `AbortSignal` or a driver option. No call inherits "no limit"                                                                                                                           |
| Request budget     | A request's outbound timeouts add up to less than the API latency budgets (reads < 200 ms, writes < 400 ms p95 at the origin [TR §15.1]) unless the route is declared slow; slow work goes to a job                                                                      |
| Retry              | Only for idempotent operations, only on timeouts, connection errors and 5xx / 429 from the vendor, at most a small fixed number of times with exponential backoff and jitter, honouring `Retry-After`. Never retry a 4xx                                                 |
| Where retries live | In jobs, not in request handlers, wherever the person does not need the answer now. pg-boss carries retry and backoff; `webhooks.retry` alerts after 5 attempts [TR §11]                                                                                                 |
| Circuit breaking   | Each vendor adapter tracks recent failures; when open it fails fast with `provider_error` and stops adding load. `vendor.health` probes every minute, writes `vendor_health_checks`, and drives OTP failover Termii → Twilio [TR §11], [TR §14]                          |
| Fallback           | Declared per vendor: a second provider (OTP), a degraded but honest answer (liveness unavailable → the step says so and can be resumed), or a queued effect (notification stays in the outbox). Never a silent success                                                   |
| Bulkhead           | A slow vendor must not use up the API's connections: bounded concurrency per adapter; database pool sized for the Neon pooler [TR §15.2]                                                                                                                                 |
| Clients            | Request timeout on every call; automatic retry only by the retry class of the error ([1MM-STD-13](1MM-STD-13-ERROR-CODES.md) section 3); writes made offline go to the MMKV outbox with their client ids [TR §15.2]; the admin console queues nothing offline [ADM §1.5] |

The numbers (timeouts per vendor, retry counts, breaker thresholds) are not in the sources. They
are **Recommendation** values to be held in `remote_config` so the admin can tune them
(GAP-STD16-02), with coded defaults used when the config cannot be read.

## 7. Invariants enforced in the database

The API validates first, for good messages. The database enforces as well, because the API is not
the only writer (jobs, migrations, the admin API, a future bug). These are real objects in
`packages/db/migrations/0001_baseline_v3_4.sql`:

| Invariant                                                                                             | Object                                                                                                                                                                                                                                           | Kind                    |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------- |
| Members are 18 or over on the day the birth date was locked                                           | `CHECK (age_years(birth_date, (birth_date_locked_at AT TIME ZONE 'UTC')::date) >= 18)` on `profiles`                                                                                                                                             | CHECK                   |
| Partner age range is sane                                                                             | `CHECK (age_min >= 18 AND age_max <= 99 AND age_min <= age_max)` on `partner_preferences`                                                                                                                                                        | CHECK                   |
| One live account per e-mail; one verified phone per account                                           | `uq_users_email`, `uq_phone_one_account`, `uq_phone_user_current`                                                                                                                                                                                | Partial unique index    |
| One active match and one live conversation per pair                                                   | `uq_matches_active_pair`, `uq_conv_live_pair`                                                                                                                                                                                                    | Partial unique index    |
| One live subscription per member                                                                      | `uq_subs_one_live`                                                                                                                                                                                                                               | Partial unique index    |
| One open Black Badge application; one live restriction of a kind                                      | `uq_badge_open`, `uq_restriction_live`                                                                                                                                                                                                           | Partial unique index    |
| One main photo; one item per slot; a prompt used once                                                 | `uq_profile_media_main`, `uq_profile_media_slot`, `uq_prompt_slot`, `uq_prompt_once`                                                                                                                                                             | Unique index            |
| One active owner per group; one pending invite per person                                             | `uq_group_one_owner`, `uq_group_invite_pending`                                                                                                                                                                                                  | Partial unique index    |
| One scheduled deletion; one live legal hold per scope                                                 | `uq_deletion_scheduled`, `uq_legal_hold_live`                                                                                                                                                                                                    | Partial unique index    |
| At most 10 vibes per profile                                                                          | Constraint trigger `trg_profile_vibes_max` → `enforce_max_children('user_id', '10')`                                                                                                                                                             | Deferred trigger        |
| The audit log is a hash chain and cannot be changed                                                   | `trg_audit_chain` (`admin_audit_chain()`), `trg_audit_immutable` (`forbid_mutation()`), `uq_audit_chain_seq`; `REVOKE UPDATE, DELETE` in `roles.sql`                                                                                             | Triggers, index, grants |
| Consents, moderation actions, escalation updates, content revisions, consent receipts are append-only | `trg_consents_immutable`, `trg_mod_actions_immutable`, `trg_esc_updates_immutable`, `trg_revisions_immutable`, `trg_consent_receipts_immutable`                                                                                                  | Trigger                 |
| Intro decisions are final                                                                             | `trg_intro_decisions_final`                                                                                                                                                                                                                      | Trigger                 |
| Nobody approves their own request                                                                     | `CHECK (decided_by IS NULL OR decided_by <> requested_by)` on `admin_approvals`                                                                                                                                                                  | CHECK                   |
| A translation is not reviewed by its last editor                                                      | `i18n_review_not_editor` on `i18n_strings`                                                                                                                                                                                                       | CHECK                   |
| A reason is 5 to 2,000 characters                                                                     | `CHECK (char_length(reason) BETWEEN 5 AND 2000)` on `admin_approvals`                                                                                                                                                                            | CHECK                   |
| An admin session lasts at most 8 hours                                                                | `CHECK (expires_at <= created_at + interval '8 hours')`                                                                                                                                                                                          | CHECK                   |
| Production config changes carry an approved approval                                                  | `trg_flags_approval`, `trg_rconfig_approval`, `trg_rlp_approval`, `trg_vendor_approval`, `trg_site_settings_approval`, `trg_countries_approval`, `trg_cities_approval` → `enforce_config_approval()` (enforced when `app_env()` is `production`) | Trigger                 |
| Admin refunds above the threshold carry an approval                                                   | `refund_approval_guard()` with `billing.refund_approval_threshold_usd_cents`                                                                                                                                                                     | Trigger                 |
| Config keys and flag keys are well-formed; rollout is 0–100; a config range is ordered                | `CHECK (key ~ '^[a-z0-9_.]{2,80}$')`, `CHECK (rollout_percent BETWEEN 0 AND 100)`, `rc_range_chk`                                                                                                                                                | CHECK                   |
| No plain secrets in vendor settings                                                                   | CHECK using `jsonb_has_secret_keys()` on `vendor_settings.settings`                                                                                                                                                                              | CHECK                   |
| A webhook is stored once and its provider is known                                                    | `UNIQUE (provider, event_id)`, `CHECK (provider IN (…))`, `CHECK (status IN (…))` on `webhook_events`                                                                                                                                            | Unique, CHECK           |
| Redirects do not chain; offers respect their rules; CMS rows follow the workflow                      | `trg_redirects_no_chain`, `trg_offer_campaign_guard`, `trg_offer_claim_guard`, `content_workflow_guard()`                                                                                                                                        | Trigger                 |
| A published legal document is immutable                                                               | `legal_published_immutable()`                                                                                                                                                                                                                    | Trigger                 |
| The member API cannot run DDL or read admin-only tables; the queue role sees no member data           | Roles `app_api`, `app_admin_api`, `app_worker`, `app_queue`, `app_readonly`, `app_migrator` (`packages/db/roles/roles.sql`), proven by `packages/db/src/roles.test.ts`                                                                           | Grants                  |
| Members read only their own rows                                                                      | 14 policies on 10 tables, for example `profiles_read`, `messages_send`, `blocks_own`                                                                                                                                                             | RLS                     |

Rules:

1. A new "only one", "at most N", "never changes" or "A before B" rule gets a constraint, index or
   trigger in the migration that introduces it, and a schema behaviour test.
2. The API maps the database's refusal to a registry code (unique violation → the specific 409;
   `42501` from `record_reaction()` → `blocked` or `entitlement` by its hint; CHECK violation →
   `validation` or `illegal_state`). A raw database error never reaches a client.
3. Constraints are not bypassed. `forbid_mutation()` is lifted only by the erasure job's dedicated
   role, as its comment in the schema says [SQL].
4. Queries are parameterised through Drizzle; string-built SQL is banned [TR §13.1]. The lint rule
   for it is GAP-STD16-03.

## 8. Fail-closed defaults

When a check cannot be completed, deny. The exceptions are deliberate, listed here, and nowhere
else.

| Situation                                                        | Default                                                                                                                                                                                                                                                                                                        |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Entitlements cannot be resolved                                  | Treat as the lowest role for the action; never grant                                                                                                                                                                                                                                                           |
| Admin permission, scope, IP rule or re-auth state cannot be read | Deny                                                                                                                                                                                                                                                                                                           |
| `app.user_id` not set                                            | The ownership policies match nothing; `profiles_read` still returns non-hidden profiles (GAP-DB05-03), so unauthenticated code never queries member tables                                                                                                                                                     |
| Feature flag missing or unreadable                               | Off (`feature_flags.enabled` defaults to `false` [SQL])                                                                                                                                                                                                                                                        |
| Kill switch unreadable                                           | The last known value from cache; with no cached value, the feature is off                                                                                                                                                                                                                                      |
| Config value missing or invalid                                  | The coded default that equals the seeded value, plus an alert (the schema's own `config_int(key, default)` works this way [SQL])                                                                                                                                                                               |
| Webhook signature cannot be verified                             | Reject                                                                                                                                                                                                                                                                                                         |
| Device integrity verdict unavailable                             | Treat as failed for sign-up and payment [TR §13.2]                                                                                                                                                                                                                                                             |
| Media moderation or AV result missing                            | Stay in quarantine [TR §11], [TR §6.1]                                                                                                                                                                                                                                                                         |
| Liveness or face-match result missing                            | Not verified; route to a human within the SLA [TR §11]                                                                                                                                                                                                                                                         |
| Unknown enum value, unknown event type, unknown error code       | The safe branch: no access, no action, generic message                                                                                                                                                                                                                                                         |
| Client cannot reach the API                                      | Show cached content read-only; queue only writes that carry a client id; never assume a gated action succeeded                                                                                                                                                                                                 |
| **Exception: rate limiter cannot reach Redis**                   | The scaffold allows the request and logs it, so a limiter outage is not a product outage. **Decided** (DEC-002, 26 Nov 2026): fail closed for the policies that have a lockout (`otp.verify.sms`, `otp.verify.email`, `login.account`, `admin.login`), whose lock state also lives in PostgreSQL. GAP-STD16-04 |
| **Exception: analytics and non-critical telemetry**              | Dropped silently; they never block a request                                                                                                                                                                                                                                                                   |

## 9. TypeScript: exhaustive switches and typed errors

1. **Strictness.** `strict` TypeScript everywhere [TR §5.1]. No `any`, no non-null `!` on data from
   outside the function, no `as` cast on data that crossed a boundary: parse it.
2. **Discriminated unions for state.** A thing with states is a union with a `status` (or `kind`)
   tag, so fields that only exist in one state cannot be read in another. Schema enums
   (`send_failure_t`, `intro_status_t`, …) are mirrored as `z.enum` in `packages/contracts`.
3. **Exhaustive switches.** Every `switch` on a union ends with a `never` check so that adding a
   variant fails the build:

   ```ts
   const assertNever = (value: never): never => {
     throw new Error(`Unhandled variant: ${String(value)}`);
   };

   switch (decision.kind) {
     case 'approved':
       return grant(decision);
     case 'rejected':
       return refuse(decision);
     default:
       return assertNever(decision);
   }
   ```

   On the server the default branch throws (a 500 that alerts). In a **client** switching on a
   value from the API, the default branch renders the safe fallback instead, because a newer API
   may send a value this build has not seen ([1MM-STD-06](1MM-STD-06-API-FIRST.md) section 7.2).

4. **Typed errors.** Domain and application code signals an expected failure with `ProblemError`
   built from a registry code, or returns a typed result union where the caller must branch.
   `throw new Error('…')` is for bugs only. `catch` blocks narrow with `instanceof`; an error that
   is not understood is re-thrown, never swallowed. The global `errorHandler` turns anything
   unhandled into 500 `internal` and logs it (`apps/api/src/platform/http/problem.ts`).
5. **No floating promises.** Every promise is awaited, returned or explicitly `void`-ed with a
   reason. A rejected background promise is a lost error.
6. **Ports for everything outside the process.** Domain and application code depend on interfaces
   (`DependencyProbe` is the example); adapters live in `infrastructure/`. The lint rules in
   `eslint.config.mjs` enforce this, and it is what lets tests inject a failing dependency.
7. **Immutability by default.** `const`, `readonly` fields, `as const` tables; functions do not
   mutate their arguments.
8. **Time and randomness are injected.** Code that depends on "now", a time zone or a random value
   takes a clock or generator, so tests can move time
   ([1MM-STD-01](1MM-STD-01-TESTING-STRATEGY.md)).
9. **Money is integer US cents** (as the schema's `amount_usd_cents` columns), never a float.
   Timestamps are UTC instants; a "local day" is computed from the member's time zone explicitly
   (`spend_spec_view(p_user, p_local_day)` takes it as an argument) [SQL].

Lint rules that would enforce items 1, 3 and 5 are not configured yet (GAP-STD16-03).

## 10. Kill switches and feature flags

`feature_flags` holds every flag: `key`, `enabled`, `rollout_percent`, `rules` (platform, country,
role, app version), `is_kill_switch`; `feature_flag_overrides` gives per-member overrides [SQL].
Seeded kill switches include `calls.enabled`, `groups.enabled`, `spotlight.enabled`,
`discovery.international`, `payments.flutterwave_web`, `registration.open`, `offers.enabled` and
`verification.carrier_check` [SQL].

1. Anything that calls a vendor, costs money, or could harm members if it misbehaves ships behind
   a flag marked `is_kill_switch`. If the baseline has no flag for it, raise a SCHEMA gap with the
   seed row.
2. The **API** enforces the flag: a route whose flag is off returns 404 `feature_disabled`. Clients
   read flags from the config bootstrap only to hide entry points.
3. Off is the default and the fail-closed value (section 8).
4. A flag is evaluated once per request and the result passed down; a job re-reads it at the start
   of each run and stops cleanly if it is off.
5. Turning a kill switch off must be safe at any moment: no half-written state, in-flight work
   finishes or is left in a state the job can resume.
6. In production a flag or config change needs an approved `admin_approvals` row; the trigger
   `enforce_config_approval()` refuses it otherwise [SQL]. The emergency path is the same path with
   a fast second approver, not a bypass.
7. Maintenance and read-only mode use `maintenance_windows`, not a flag [SQL]; routes answer 503
   `maintenance`, and the website safety form stays open [OD-32].
8. Flags are temporary unless they are kill switches. A release flag is removed, with its dead
   branch, once the feature is fully on; the module plan names the flag and the decision that
   retires it.
9. Both states of every flag are tested ([1MM-STD-01](1MM-STD-01-TESTING-STRATEGY.md)).

## 11. Logging without personal data

Logs are structured JSON with a request id on every line [TR §14].

| Never logged [TR §14]                                          | Also never logged (this standard)                                                                                                                                                                  | Logged instead                                                                                      |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Message bodies, passwords, codes, tokens, face data, card data | E-mail addresses, phone numbers, names, birth dates, precise location, free text a member wrote, request and response bodies, query strings, vendor payloads, `Authorization` and `Cookie` headers | Internal ids (uuid), route template, status, registry code, durations, counts, policy and job names |

Rules:

1. Log **ids, not values**. `requestContext` already logs method, path, status and duration, and
   deliberately omits the query string (`apps/api/src/platform/http/middleware.ts`).
2. IPs are truncated in samples [TR §14].
3. Use the request-scoped logger (`c.get('logger')`), never `console.log` in `apps/api` or
   `apps/worker`.
4. Errors are logged once, where they are handled, with the registry code and request id. The
   stack stays server-side.
5. Job payloads, the audit log and analytics follow the same rule: job payloads carry ids only;
   audit `before` / `after` mask personal fields [ADM §1.3]; analytics run only after consent
   [TR §14].
6. Mobile: no PII in logs or crash reports [TR §13.4]. Sentry events are scrubbed before sending
   (no request bodies, no breadcrumbs with text input).
7. A redaction layer in the logger that drops known sensitive keys is the backstop, not the
   method (GAP-STD16-05). The method is not passing the value.

Detail on where personal data may be held is in [1MM-STD-12](1MM-STD-12-DATA-HANDLING.md).

## 12. Client-side defence

| Rule                                                                                                                                        | Source                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Web sessions are HttpOnly, Secure cookies; app tokens live only in `expo-secure-store`. Never one shared storage helper for both            | `docs/USAGE.md` §8, [TR §13.4]                  |
| Only variables prefixed `VITE_`, `PUBLIC_` or `EXPO_PUBLIC_` reach a client; each app validates its settings at start; CI scans the bundles | `docs/USAGE.md` §5, `pnpm check:client-bundles` |
| No `dangerouslySetInnerHTML`; member text is rendered as text                                                                               | [TR §13.1]                                      |
| Every list has loading, empty, error and content states; skeletons only after 300 ms                                                        | [TR §5.3]                                       |
| Buttons that write are disabled while the write is in flight; the idempotency key covers the double tap that still gets through             | [ADM §1.4]                                      |
| The buttons always work without the gesture; a failed animation or haptic never blocks an action                                            | [TR §5.1]                                       |
| Every screen is wrapped in an error boundary that shows the generic error state with the request id where there is one                      | [1MM-STD-13](1MM-STD-13-ERROR-CODES.md)         |
| Admin: unsaved drafts are kept in memory only, never in storage                                                                             | [ADM A03]                                       |
| Sensitive screens (liveness, payment) set FLAG_SECURE                                                                                       | [TR §13.4]                                      |

## 13. Review checklist

A reviewer ticks every line that applies, or writes why it does not.

**Input**

- [ ] Every value entering the process is parsed by a zod schema at the boundary (section 2).
- [ ] Strings, arrays and numbers are bounded; enums are enums.
- [ ] `jsonb`, cache, storage, deep-link, push and vendor data are parsed before use.
- [ ] No rejected value is echoed to a log or a response.

**Authorisation**

- [ ] The route declares auth and gate; entitlement or permission is checked on the server.
- [ ] Member queries run with `SET LOCAL app.user_id` and carry an ownership predicate.
- [ ] Scope, block and restriction are checked against current state inside the transaction.
- [ ] Not-found and not-allowed are indistinguishable where existence is private.
- [ ] There is a negative test for each check.

**Writes**

- [ ] The write is idempotent by key or by state; the durable guard is in PostgreSQL.
- [ ] Every "only one" rule has a unique index; violations map to a registry code.
- [ ] No check-then-act without a lock or constraint; locks are ordered.
- [ ] Multi-row changes are one transaction; no vendor call inside it; side effects go through the
      outbox or a job.
- [ ] `If-Match` is required where two people can edit the same record.
- [ ] Admin writes take a reason where flagged, and write the audit row in the same transaction.

**Dependencies**

- [ ] Every outbound call has a timeout; retries are bounded and only for idempotent calls.
- [ ] The vendor's response is validated; its failure has a typed result and a fallback.
- [ ] The feature has a kill switch if it calls a vendor or costs money; both flag states are
      tested.
- [ ] The default when a check cannot complete is deny (section 8).

**Code**

- [ ] No `any`, unchecked cast or non-null assertion on outside data.
- [ ] Switches on unions are exhaustive; client switches on API values have a safe default.
- [ ] Expected failures use registry codes; nothing is swallowed; no floating promise.
- [ ] Time, time zone and randomness are injected.
- [ ] Limits, durations and thresholds come from `remote_config`, not literals.

**Data and logs**

- [ ] Logs carry ids, codes and durations only.
- [ ] Job payloads carry ids only.
- [ ] No secret, token or personal data in client storage outside the allowed stores.

**Tests** ([1MM-STD-01](1MM-STD-01-TESTING-STRATEGY.md))

- [ ] Expected, unexpected and variables-change cases exist for the change.
- [ ] Concurrency rules have a parallel-connection test.
- [ ] A job is run twice in its test.

## 14. Gaps raised

Dispositions are recorded in [1MM-LOG-03](../1MM-LOG-03-TECHNICAL-REFERENCE-EXTENSIONS.md)
(Technical Reference and schema), [1MM-LOG-02](../1MM-LOG-02-UI-UPDATES.md) (UI) and
[1MM-LOG-04](../1MM-LOG-04-OPEN-DECISIONS-AND-FOLLOW-UPS.md) (owner decisions and repository
follow-ups).

| Gap id       | Type     | Where found                                                        | What is missing or conflicting                                                                                                                                                                       | Proposed resolution                                                                                                                                                                                                                                                                                                                                                                                  | Blocks                            |
| ------------ | -------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| GAP-STD16-01 | REPO     | `apps/worker/src/platform/job.ts`, `runner.ts`                     | `defineJob` types the payload as `object` and `startRunner` casts `item.data` without parsing, so a malformed payload reaches the handler                                                            | Add an optional `payload: z.ZodType<Payload>` to `JobDefinition`; `startRunner` parses before `handle` and fails the job without retry on a parse error                                                                                                                                                                                                                                              | First job with a payload (MOD-03) |
| GAP-STD16-02 | SCHEMA   | [TR §13.1] "timeouts on every outbound call"; `remote_config` seed | No config keys hold vendor timeouts, retry counts or circuit-breaker thresholds, so they would be literals in adapters                                                                               | Seed per-vendor keys when each adapter lands, private (`is_public = false`), `group_key = 'vendors'`, for example `INSERT INTO remote_config (key, value, value_type, description, unit, min_value, max_value, group_key) VALUES ('vendors.default.timeout_ms', '5000', 'int', 'Default outbound timeout', 'ms', 500, 30000, 'vendors');` with the values confirmed by the owner of each integration | Vendor adapters (MOD-03 onwards)  |
| GAP-STD16-03 | REPO     | `eslint.config.mjs`; [TR §13.1] "lint bans string-built SQL"       | The lint configuration has no type-aware rules: nothing enforces exhaustive switches, no floating promises, no explicit `any`-free boundaries, or the ban on string-built SQL that [TR §13.1] claims | Enable `typescript-eslint` type-checked rules `switch-exhaustiveness-check`, `no-floating-promises`, `no-misused-promises`, `no-unsafe-*` for `apps/api`, `apps/worker` and `packages/*`; add a `no-restricted-syntax` rule against `sql.raw` / template-built SQL outside `packages/db`                                                                                                             | MOD-00                            |
| GAP-STD16-04 | DECISION | `apps/api/src/platform/rate-limit/middleware.ts`; MOD-00 rule 5    | The limiter fails open when Redis is unreachable. For lockout policies that is a brute-force window                                                                                                  | Owner to confirm MOD-00's recommendation: fail closed for `otp.verify.sms`, `otp.verify.email`, `login.account`, `admin.login`; fail open for the rest                                                                                                                                                                                                                                               | MOD-00-API (rate-limit task)      |
| GAP-STD16-05 | REPO     | `apps/api/src/platform/logger.ts`                                  | The logger has no redaction backstop for sensitive keys                                                                                                                                              | Add a key-based redaction step (password, code, token, authorization, cookie, email, phone) in `createLogger`, with a unit test                                                                                                                                                                                                                                                                      | MOD-00                            |

## Change log

| Version | Date        | Change                                                                                                                             |
| ------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| v1.0    | 24 Nov 2026 | First issue: boundaries, authorisation, idempotency, concurrency, vendors, database invariants, fail-closed, TypeScript, checklist |
