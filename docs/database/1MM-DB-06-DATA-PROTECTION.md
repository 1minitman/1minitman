# 1MM-DB-06 · Data protection in the database

|              |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Document** | 1MM-DB-06                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **Status**   | Approved baseline · v1.0 · 24 Nov 2026                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **Audience** | Engineers and coding agents; interim DPO                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **Owner**    | Engineering lead (code owners); interim DPO for retention, requests and residency                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **Sources**  | [SQL] (`packages/db/migrations/0001_baseline_v3_4.sql`), `packages/db/SCHEMA_DATA_DICTIONARY.md` ([DD Conventions], [DD §1–§13B]), `packages/db/roles/roles.sql`, `.env.example`, [TR §4.3], [TR §4.4], [TR §7.1], [TR §10.3], [TR §11], [TR §13.1], [TR §13.2], [TR §13.4], [TR §14], [TR §16.1], [TR §16.2], [ADM §1.3], [ADM A10], [ADM A36], [OD-06], [OD-10], [OD-11], [OD-38]                                                                                                                                                                               |
| **Related**  | [1MM-DB-01](1MM-DB-01-SCHEMAS.md), [1MM-DB-02](1MM-DB-02-MIGRATIONS.md), [1MM-DB-04](1MM-DB-04-INDEXING.md), [1MM-DB-05](1MM-DB-05-SECURITY.md), [1MM-STD-11](../standards/1MM-STD-11-SECURITY-AND-COMPLIANCE.md), [1MM-STD-12](../standards/1MM-STD-12-DATA-HANDLING.md), [MOD-06](../execution/1MM-EXE-MOD-06-BLACK-BADGE-VERIFICATION.md), [MOD-16](../execution/1MM-EXE-MOD-16-LEGAL-PRIVACY-AND-DATA-OPERATIONS.md), [MOD-17](../execution/1MM-EXE-MOD-17-NETWORK-AND-SECURITY-OPERATIONS.md), [MOD-19](../execution/1MM-EXE-MOD-19-HARDENING-AND-LAUNCH.md) |

**What this document is for and when to open it.** It says, for the PostgreSQL database, which data
is personal and how sensitive, how it is encrypted, how long it is kept, how it is erased, exported
and held, and what to check when a table or column is added. Open it before you add or change a
column that holds anything about a person, before you write a purge, erasure or export step, and
during an incident. Client-side storage, Redis, logs and files are in
[1MM-STD-12](../standards/1MM-STD-12-DATA-HANDLING.md); roles and policies are in
[1MM-DB-05](1MM-DB-05-SECURITY.md); the member and admin flows are in
[MOD-16](../execution/1MM-EXE-MOD-16-LEGAL-PRIVACY-AND-DATA-OPERATIONS.md).

**This is an engineering document, not legal advice.** It records what the sources state and what
the schema does. Wherever a point depends on law (lawful basis, retention periods, transfer
mechanism, what may be kept after erasure, notification duties) it is marked **Counsel** and waits
for the lawyer review required by [OD-10]. The applicable frameworks named by the sources are NDPA
2023, with GDPR principles for EU users [TR §13], [TR §16].

## 1. PII classification

### 1.1 The classes

Every table comment ends with its class, and the data dictionary repeats it [SQL conventions],
[DD Conventions].

| Class         | Meaning [DD Conventions]                                                  |
| ------------- | ------------------------------------------------------------------------- |
| **none**      | No personal data                                                          |
| **personal**  | Identifies or relates to a member                                         |
| **sensitive** | Health, faith, live location during a date, credentials, safety incidents |
| **biometric** | Face templates and liveness media                                         |

The dictionary also qualifies a class in places: "personal (hashed)", "personal (pseudonymous)",
"personal (third party)", "personal (credential digest)", "biometric (vendor)". The qualifier
describes the protection, not a lower class: treat each as its base class.

### 1.2 Tables by class, per domain

From the "PII" column of [DD §1–§13] and the new-table lists [DD §13A.1], [DD §13B]. A table listed
as "x / y" in the dictionary appears under its higher class with a note.

| Domain                                           | biometric                                                   | sensitive                                                                                                       | personal                                                                                                                                                                                                                                                                                                                                                                                     | none                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------ | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Catalogues [DD §1]                               | –                                                           | –                                                                                                               | –                                                                                                                                                                                                                                                                                                                                                                                            | all (`countries`, `cities`, `languages`, `option_sets`, `options`, `vibe_tags`, `industries`, `prompts`, `report_reasons`, `message_effects`, `venues`, `plans`, `entitlements`, `role_entitlements`, `products`, `prices`, `i18n_strings`, notification catalogue, `legal_documents`, help catalogue, `decision_reasons`, `plan_compare_rows`)                                                                                                                                              |
| Identity and auth [DD §2]                        | –                                                           | `password_credentials`                                                                                          | `users`, `oauth_identities`, `phone_numbers`, `devices`, `sessions`, `otp_challenges` (hashed), `login_attempts`, `account_lockouts`, `password_resets`, `new_device_challenges`                                                                                                                                                                                                             | `refresh_tokens`, `age_gate_blocks`, `role_history`                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Profile [DD §3]                                  | `media_assets` is a biometric source while in quarantine    | `profile_answers` (genotype, faith), `partner_preference_options` and `_sections` (same answers as preferences) | `profiles`, `nickname_history`, `profile_languages`, `profile_vibes`, `prompt_answers`, `media_assets`, `profile_media`, `partner_preferences`, `partner_preference_languages`, `international_countries`                                                                                                                                                                                    | `user_settings`                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Verification [DD §4]                             | `face_templates`, `liveness_sessions` (media at the vendor) | –                                                                                                               | `badge_applications`, `pending_actions`, `verification_records`, `carrier_checks`                                                                                                                                                                                                                                                                                                            | `upgrade_progress`, `safety_briefing_acks`                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Discovery and matching [DD §5]                   | –                                                           | –                                                                                                               | `feed_impressions`, `reactions`, `reaction_history`, `pair_cooldowns`, `hidden_profiles`, `matches`, `intro_sessions`, `intro_messages`, `intro_decisions`, `spotlight_rotations`                                                                                                                                                                                                            | `usage_counters`                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Messaging [DD §6]                                | –                                                           | –                                                                                                               | `conversations`, `conversation_participants`, `messages`, `message_attachments`, `message_reactions`, `dm_requests`, `calls`, `call_feedback`                                                                                                                                                                                                                                                | `message_client_ids`, `message_failures`                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Groups [DD §7]                                   | –                                                           | –                                                                                                               | `groups`, `group_members`, `group_invites`, `group_messages`, `group_message_reactions`                                                                                                                                                                                                                                                                                                      | `group_rules`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Meet-ups and safety [DD §8]                      | –                                                           | `safety_checkins`, `safety_escalations`, `safety_escalation_updates`                                            | `meetups`, `meetup_rsvps`, `meetup_time_proposals`, `meetup_feedback`, `trusted_contacts` (third party), `trusted_contact_messages`, `meetup_shares`                                                                                                                                                                                                                                         | –                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Trust and safety [DD §9]                         | –                                                           | `age_verification_requests`                                                                                     | `blocks`, `reports`, `report_evidence`, `moderation_cases`, `moderation_actions`, `account_restrictions`, `appeals`, `appeal_evidence`, `account_deletions`, `abuse_rule_hits`, `risk_devices`, `risk_ips`, `identity_links`, `trust_signals`, `reverification_requests`                                                                                                                     | `abuse_rules`, `moderation_case_watchers`                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Billing [DD §10]                                 | –                                                           | –                                                                                                               | `billing_customers`, `subscriptions`, `trials`, `transactions`, `payment_methods`, `invoices`, `lapse_choices`, `webhook_events` (payload)                                                                                                                                                                                                                                                   | `subscription_events`, `refunds`, `disputes`, `entitlement_grants`, `billing_credits`, `reconciliation_items`, `reconciliation_runs`, `payouts`                                                                                                                                                                                                                                                                                                                                              |
| Notifications, support, legal [DD §11]           | –                                                           | –                                                                                                               | `push_tokens`, `notifications`, `inbox_items`, `email_suppressions`, `support_tickets`, `support_messages`, `feedback`, `consent_records`, `data_export_requests`, `privacy_requests`, `feature_waitlist`, `legal_holds`                                                                                                                                                                     | `notification_preferences`, `help_article_votes`                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Analytics and research [DD §12]                  | –                                                           | –                                                                                                               | `analytics_events` (pseudonymous), `research_participants`, `research_sessions`, `research_task_results`, `research_findings` (pseudonymous)                                                                                                                                                                                                                                                 | `research_studies`, `research_tasks`, `analytics_saved_reports`, `scheduled_exports`, `store_installs_daily`                                                                                                                                                                                                                                                                                                                                                                                 |
| Admin and platform [DD §13], [DD §13A.1]         | –                                                           | –                                                                                                               | `admin_users`, `admin_mfa_factors`, `admin_sessions`, `admin_login_attempts`, `admin_audit_log`, `admin_recovery_codes` (credential digest), `admin_trusted_devices`, `admin_security_alerts` (IP), `admin_saved_views` (when member ids are set), `ip_access_rules`, `api_request_samples`, `api_request_ip_rollups`, `security_detections`, `edge_security_events` (pseudonymous prefixes) | `admin_permissions`, `admin_roles`, `admin_role_permissions`, `admin_user_roles`, `admin_approvals`, `admin_audit_chain_runs`, `admin_notifications`, `admin_exports` (the file is personal), `admin_macros`, `feature_flags`, `feature_flag_overrides`, `remote_config`, `app_versions`, `maintenance_windows`, `rate_limit_policies`, `api_request_rollups`, `vendor_health_checks`, `vendor_settings`, `worker_jobs`, `security_incidents`, `broadcast_campaigns`, `in_app_announcements` |
| Website and CMS [DD §13], [DD §13A.1], [DD §13B] | –                                                           | –                                                                                                               | `job_applications`, `contact_submissions`, `newsletter_subscribers`, `waitlist_entries`, `offer_claims`, `journal_authors`, `web_uploads`, `beta_invites` (hashed identifier), `story_consents`, `investor_document_grants` (hashed e-mail), `stories` and their `content_revisions`                                                                                                         | CMS content tables, `consent_receipts` (pseudonymous), `offer_campaigns`, `offer_code_pools`, `offer_codes`, `redirects`, `site_settings`, `cms_publish_runs`, `web_redirects_daily`                                                                                                                                                                                                                                                                                                         |

Notes:

- The dictionary groups the website tables in one row as "none / personal". The split above follows
  each table's own comment in [SQL]; confirm a table's class from its comment before relying on
  this row.
- `feature_flag_overrides` has a `user_id` and is classed "none" with its parent row in [DD §13].
  Treat a row that names a member as personal when exporting or erasing.
- Free-text and JSON columns can hold personal data whatever the table's class: `payload`
  (`webhook_events`), `before` / `after` (`admin_audit_log`), `properties` (`analytics_events`),
  `notes`, `reason`. The class of the table is a floor.

## 2. Special-category and biometric data

"Special category" is used here as an engineering label for the data the sources handle under
separate, explicit consent [TR §16.2]. Whether each item is special-category or sensitive personal
data in law is for **Counsel**.

| Data                                | Where it is                                                                              | What is stored                                                                                                                                                      | Kept for [TR §16.1]                                                                                                                                                                                 | Consent [TR §16.2]                                                                                   |
| ----------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Liveness video and selfie frames    | At the vendor (AWS Rekognition Face Liveness [OD-06]); our row is `liveness_sessions`    | `vendor`, `vendor_session_id`, `attempt_no` (1 to 3), `status`, `video_deleted_at`. No media column                                                                 | Until the review decision, at most 30 days; deleted at the vendor and by us (job `liveness.purge`). The row stays for the account's life [DD §4]                                                    | Biometric consent at B3 with its own notice; `consent_kind_t` value `biometric`                      |
| Face template                       | `face_templates`                                                                         | `vendor_template_ref_enc` (an encrypted reference to the template the vendor holds), `dedupe_fingerprint` (SHA-256 domain), `consent_record_id`, `retained_for_ban` | While the account is active and consent stands. Deleted on consent withdrawal (PM4) or erasure. A one-way fingerprint is kept only for banned accounts, stated basis fraud prevention [SQL comment] | Same; `face_templates.consent_record_id` points at the consent row                                   |
| Verification photos and clips       | `media_assets` (kinds `photo`, `clip`), R2 objects                                       | The media row and file; "biometric source while in quarantine" [DD §3] because the face match runs there                                                            | Account; soft-deleted media 30 days                                                                                                                                                                 | Biometric consent covers the face match                                                              |
| Age-check ID                        | `age_verification_requests`, with evidence in media                                      | Request, status, decision                                                                                                                                           | 12 months after the decision [DD §9]                                                                                                                                                                | Not a consent flow; an admin request under [OD-33]. Basis: **Counsel**                               |
| Genotype (health) and faith answers | `profile_answers`, mirrored as preferences in `partner_preference_options` / `_sections` | The chosen option per set                                                                                                                                           | While consent stands; erased within 30 days of withdrawal (job `sensitive.erase`)                                                                                                                   | Separate consents `genotype` and `faith` at P3 / LG6. Used only for matching, never shown [TR §16.2] |
| Live location during a date         | `safety_checkins.last_coarse_location`                                                   | A coarse point                                                                                                                                                      | Deleted 30 days after the meet-up (job `safety.location.purge`)                                                                                                                                     | Consent kind `location`; trusted-contact sharing needs the contact's YES                             |
| Safety incidents                    | `safety_escalations`, `safety_escalation_updates`                                        | Timeline, including "reveal" steps                                                                                                                                  | 24 months [DD §8]                                                                                                                                                                                   | Not consent-based; basis: **Counsel**                                                                |
| Credentials                         | `password_credentials`, `admin_users.password_hash`, `admin_mfa_factors`                 | Hashes and an encrypted TOTP secret (section 3)                                                                                                                     | Account                                                                                                                                                                                             | n/a                                                                                                  |

Rules that follow from the sources:

1. No biometric media is stored in PostgreSQL. The database holds references, statuses and a
   fingerprint.
2. Withdrawing biometric consent removes verification and blocks new uploads but does not cancel
   billing [TR §16.2]. It deletes the `face_templates` row unless the account is banned.
3. A36 returns only counts of biometric records, never a template or a video [ADM A36].
4. No ethnicity or tribe filter exists, and none may be added [TR §16.2].
5. The vendor reference for liveness is AWS; the AWS region is not stated in the sources
   (GAP-STD12-07 in [1MM-STD-12](../standards/1MM-STD-12-DATA-HANDLING.md)).
6. The NDPC data-controller registration is filed before any real user, because of the biometric
   data [OD-10]. Its reference is held in remote config `privacy.ndpc_registration` (seeded
   `null`).

## 3. Encryption

### 3.1 At rest and in transit

| Layer               | Fact                                                                                      | Source                                                   |
| ------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Database at rest    | Neon encrypts at rest (provider-managed)                                                  | [TR §4.3]                                                |
| Database in transit | TLS only; per-environment credentials                                                     | [TR §4.3], [TR §13.1]; client enforcement is GAP-DB05-06 |
| Redis               | TLS                                                                                       | [TR §4.3]                                                |
| Media and exports   | R2, private buckets, short-lived presigned URLs; admin export files are encrypted objects | [TR §4.3], [SQL comment on `admin_exports`]              |
| Database dumps      | Nightly `pg_dump` to the R2 `backups` bucket. Encryption before upload is not stated      | [TR §10.3]; GAP-STD11-09                                 |
| Field level         | Envelope encryption: data keys under a key in AWS KMS                                     | [TR §13.4], [OD-11]                                      |

### 3.2 Encrypted columns

Found by listing every `bytea` column and every column ending `_enc` in the table definitions
(script B of [1MM-DB-04](1MM-DB-04-INDEXING.md)). Nine columns are application-encrypted:

| Column                                   | Holds                                   | What the source states                                                                              |
| ---------------------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `admin_mfa_factors.totp_secret_enc`      | Admin TOTP secret                       | "secret encrypted with a KMS data key" [SQL comment]                                                |
| `face_templates.vendor_template_ref_enc` | Reference to the vendor's face template | "Encrypted reference" [DD §4]; algorithm not stated                                                 |
| `notifications.recipient_enc`            | Address of a non-member recipient       | "KMS-encrypted address"; `recipient_hash` de-duplicates [SQL comment]                               |
| `newsletter_subscribers.email_enc`       | Subscriber e-mail                       | "encrypted with a KMS data key"; the plaintext column was removed [SQL comment]                     |
| `waitlist_entries.identifier_enc`        | E-mail or phone                         | "identifier encrypted (KMS) + SHA-256 hash" [SQL comment]                                           |
| `offer_claims.identifier_enc`            | Claim identifier                        | Plain identifier deleted 30 days after the offer ends; the hash stays [DD §13A.1]                   |
| `offer_codes.code_enc`                   | Store offer code                        | "Encrypted at rest (code_enc, KMS) only while available"; wiped on issue by a `CHECK` [SQL comment] |
| `contact_submissions.payload_enc`        | Extra form fields                       | "encrypted JSON (KMS)" [SQL comment]                                                                |
| `story_consents.email_enc`               | Story partner's e-mail                  | Column present with `email_hash`; algorithm not stated                                              |

`admin_mfa_factors.webauthn_credential_id` and `webauthn_public_key` are `bytea` but are public-key
material, not ciphertext.

The sources say "KMS data key" and "envelope encryption". They do not state the cipher, where the
key identifier travels with the ciphertext, or how rotation works: GAP-DB06-02.

### 3.3 Hashed columns

The domain `sha256_hash` is `bytea` with a length check of 32 bytes; its comment reads "32-byte
SHA-256 digest (tokens, codes and identifiers are stored hashed, never raw)" [SQL].

| Purpose                        | Columns                                                                                                                                                                                                                                                                                                                                                                                                                    | Algorithm stated                                                                                                                                                                               |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Passwords                      | `password_credentials.password_hash` (`CHECK … LIKE '$argon2id$%'`), `admin_users.password_hash`                                                                                                                                                                                                                                                                                                                           | Argon2id [SQL], [TR §13.2]                                                                                                                                                                     |
| Session and refresh tokens     | `refresh_tokens.token_hash`, `admin_sessions.token_hash`                                                                                                                                                                                                                                                                                                                                                                   | SHA-256; refresh tokens "stored as SHA-256 only" [SQL comment]                                                                                                                                 |
| One-time codes                 | `otp_challenges.code_hash` (text), `admin_recovery_codes.code_hash`, `beta_invites.code_hash`, `offer_codes.code_hash`                                                                                                                                                                                                                                                                                                     | Codes "stored hashed" [TR §13.2]; recovery codes "SHA-256 of the normalised code", plain code never stored or logged [SQL comment]. The algorithm for `otp_challenges.code_hash` is not stated |
| Link and invite tokens         | `admin_users.invite_token_hash`, `meetup_shares.token_hash`, `newsletter_subscribers.confirm_token_hash` and `manage_token_hash`, `waitlist_entries.confirm_token_hash`, `story_consents.confirm_token_hash`                                                                                                                                                                                                               | SHA-256 (domain)                                                                                                                                                                               |
| Identifier lookups             | `otp_challenges.destination_hash`, `login_attempts.identifier_hash`, `account_lockouts.subject_hash`, `admin_login_attempts.email_hash`, `notifications.recipient_hash`, `newsletter_subscribers.email_hash`, `waitlist_entries.identifier_hash`, `offer_claims.identifier_hash`, `beta_invites.identifier_hash`, `story_consents.email_hash`, `investor_document_grants.recipient_email_hash`, `trials.identity_key_hash` | SHA-256 (domain). Plain or keyed is not stated: GAP-STD12-04                                                                                                                                   |
| Device and person fingerprints | `devices.fingerprint_hash`, `login_attempts.device_fingerprint_hash`, `risk_devices.fingerprint_hash`, `age_gate_blocks.device_hash`, `help_article_votes.anon_device_hash`, `admin_trusted_devices.device_cert_fingerprint`, `face_templates.dedupe_fingerprint`, `api_request_samples.user_hash`                                                                                                                         | SHA-256 (domain)                                                                                                                                                                               |
| Content integrity              | `media_assets.sha256`, `web_uploads.sha256`, `consent_records.text_hash`, `newsletter_subscribers.consent_text_hash`, `message_failures.body_hash`, `admin_audit_log.prev_hash` / `row_hash`                                                                                                                                                                                                                               | SHA-256; the audit formula is in [1MM-DB-05](1MM-DB-05-SECURITY.md) section 6.2                                                                                                                |

Tokenised, not stored: card data never reaches our systems [TR §13.4]. `payment_methods` holds the
provider's token reference (`provider_token_ref`) and `card_last4`; `transactions` holds
`card_last4`. `vendor_settings` holds `secret_ref` (`vault://…`), `secret_version` and
`secret_last4`, never a secret.

### 3.4 Stored in clear

Member e-mail (`users.email`), phone (`phone_numbers.e164`), trusted-contact phone
(`trusted_contacts.phone`), birth date (`profiles.birth_date`), names and message bodies are stored
in clear and rely on at-rest encryption, roles, row-level security and admin masking. Whether any
should be field-encrypted is an owner decision already raised as GAP-STD12-05. One inconsistency is
new: `email_suppressions.email` is a clear-text primary key, while every other non-member address
is encrypted with a hash for lookup (GAP-DB06-03, first noted in the MOD-11 risk table).

### 3.5 Key management and rotation

What the sources state: envelope encryption keys in AWS KMS [TR §13.4], [OD-11]; one KMS key per
environment (staging and production have separate KMS keys [TR §4.4]); `.env.example` carries
`AWS_KMS_KEY_ID` and an IAM user limited to Rekognition Face Liveness and one KMS key; Terraform
manages the KMS key [TR §4.3].

Rules (**Recommendations** until GAP-DB06-02 is answered):

1. The application never holds the KMS key. It asks KMS for a data key, encrypts locally with an
   authenticated cipher, and stores the wrapped data key or its identifier with the ciphertext.
2. Every ciphertext carries a version marker so a later change of cipher or key can be told apart
   without a new column.
3. Decryption happens only in the code path that needs the clear value (sending a message to a
   waitlist address, verifying a TOTP code). Lists and exports of staff views show masked values.
4. An `_enc` column that must be looked up has a `_hash` companion; uniqueness is on the hash.
5. KMS key rotation is switched on. Rotating the wrapping key does not require re-encrypting rows;
   a suspected data-key compromise does, through a worker job that reads and rewrites each row.
6. Credentials for KMS are per environment and are never available to a client build.
7. Lower environments use their own key. A production ciphertext cannot be decrypted elsewhere,
   which is a second barrier against production data in a lower environment (section 12).

## 4. Minimisation and pseudonymisation patterns in the schema

| Pattern                                                                                                        | Where                                                                                                                                                                                         | Source                         |
| -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| Coarse location only: a point on about a 1 km grid; the exact location is never stored                         | `profiles.location`; the halfway suggestion uses rounded points                                                                                                                               | [SQL comment], [TR §16.2]      |
| Truncated IP addresses, enforced by a `CHECK` (/24 for IPv4, /48 for IPv6)                                     | `api_request_samples.ip_prefix`, `api_request_ip_rollups.ip_prefix`, `offer_claims.ip_prefix`. `contact_submissions.ip_prefix` is also a truncated prefix by its comment, without the `CHECK` | [SQL]                          |
| Hashed member id in request samples                                                                            | `api_request_samples.user_hash`                                                                                                                                                               | [SQL comment]                  |
| Hash instead of the value for throttling and de-duplication                                                    | section 3.3 identifier and fingerprint rows                                                                                                                                                   | [SQL]                          |
| A device flag, not an account, for an under-18 attempt: no account is created; the device hash is kept 30 days | `age_gate_blocks.device_hash`                                                                                                                                                                 | [TR §13.2]                     |
| No body kept for a refused message, only a hash                                                                | `message_failures.body_hash`                                                                                                                                                                  | [SQL]                          |
| Research participants by code                                                                                  | `research_participants.pseudonym` (`P` plus two digits)                                                                                                                                       | [SQL]                          |
| Analytics after consent only, keyed by member or anonymous id                                                  | `analytics_events` (`user_id`, `anon_id`), classed pseudonymous                                                                                                                               | [TR §14], [DD §12]             |
| Website consent log without IP or user agent                                                                   | `consent_receipts`                                                                                                                                                                            | [SQL comment], [MOD-16]        |
| Short-lived plain values                                                                                       | `offer_codes.code_enc` wiped on issue; `offer_claims` plain identifier deleted 30 days after the offer; liveness video at most 30 days                                                        | [SQL], [DD §13A.1], [TR §16.1] |
| Private real names; nickname shown                                                                             | `users.first_name`, `last_name` never shown; `profiles.nickname`                                                                                                                              | [SQL comment], [TR §16.2]      |
| Sensitive answers used for matching, never displayed                                                           | `profile_answers` genotype and faith                                                                                                                                                          | [TR §16.2]                     |
| Aggregates for analytics, not rows                                                                             | The `mv_*` views; `app_readonly` sees only those                                                                                                                                              | `roles.sql`                    |
| Job payloads carry ids only                                                                                    | `pgboss`                                                                                                                                                                                      | `apps/worker/src/main.ts`      |
| Logs never contain bodies, passwords, codes, tokens, face data or card data                                    | –                                                                                                                                                                                             | [TR §14]                       |

Rules for new work:

1. Collect what a screen or rule needs and no more. A column with no reader is removed, not kept
   "in case".
2. Prefer a hash when you only compare, a truncated value when you only group, and a count when you
   only report.
3. A pseudonymous table is still personal data while the key that links it to a member exists.
4. Do not copy personal data into `jsonb` snapshots, audit `before` / `after`, analytics properties
   or job payloads when an id will do.

## 5. Retention schedule

The schedule is [TR §16.1]; each table's own rule is in its dictionary row. "Account" means kept
while the account exists and erased 14 days after a deletion request by `erasure.run`
[DD Conventions]. Job names are from the 66 seeded `worker_jobs` rows and [TR §11].

| Table group                                                                                       | Kept for                                                             | Then                                                                        | Enforced by                                                                      |
| ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Liveness media (vendor) and `liveness_sessions.video_deleted_at`                                  | Until the decision, max 30 days                                      | Deleted at the vendor and by us                                             | `liveness.purge` (daily)                                                         |
| `face_templates`                                                                                  | While active and consent stands                                      | Deleted on withdrawal or erasure; fingerprint kept only for banned accounts | Consent withdrawal path; `erasure.run`                                           |
| Profile, photos, prompts, preferences                                                             | Account                                                              | Erased 14 days after the request                                            | `erasure.run` (daily)                                                            |
| Genotype and faith answers                                                                        | While consent stands                                                 | Erased within 30 days of withdrawal                                         | `sensitive.erase` (daily)                                                        |
| Soft-deleted media; media hidden after a lapse                                                    | 30 days; 90 days                                                     | Deleted                                                                     | `media_assets.purge_after` (`idx_media_purge`); `lapse.purge` (daily)            |
| `intro_messages` voice notes                                                                      | 30 days unless both kept talking                                     | Deleted                                                                     | `intro.audio.purge` (daily), `delete_after`                                      |
| `messages` and attachments                                                                        | While the conversation exists                                        | Deleted on unmatch (after an evidence snapshot), block or erasure           | Message purge on unmatch; `erasure.run`; `has_legal_hold()` checked first        |
| `report_evidence`, `appeal_evidence`                                                              | 12 months after resolution                                           | Deleted unless on legal hold                                                | `retention.purge`                                                                |
| `safety_checkins` location                                                                        | 30 days after the meet-up                                            | Location deleted                                                            | `safety.location.purge` (daily)                                                  |
| `meetup_shares` links                                                                             | 24 h after the meet-up                                               | Expired; rows purged at 30 days                                             | `share_links.expire` (hourly); `retention.purge`                                 |
| `pair_cooldowns`                                                                                  | Until expiry                                                         | Deleted                                                                     | `cooldowns.purge` (daily)                                                        |
| Payments, invoices, subscriptions and the other billing tables                                    | 7 years (tax)                                                        | Kept, member pseudonymised                                                  | Erasure pseudonymises; no purge job at 7 years is seeded                         |
| `consent_records`                                                                                 | Account + 6 years                                                    | Accountability evidence                                                     | No job; blocked by the append-only trigger (GAP-DB05-04)                         |
| `moderation_actions`, `moderation_cases`, `account_restrictions`, `appeals`, `admin_audit_log`    | 7 years                                                              | Cold storage                                                                | `partitions.retain` for the audit log; no job for the others                     |
| `otp_challenges` / `login_attempts`, `account_lockouts` / `refresh_tokens`                        | 30 days / 90 days / 7 days after expiry                              | Deleted                                                                     | `retention.purge` (daily)                                                        |
| `feed_impressions` / `notifications` / `inbox_items`                                              | 90 / 90 / 180 days                                                   | Deleted                                                                     | `partitions.retain` (impressions); `retention.purge`                             |
| `analytics_events`                                                                                | 13 months raw                                                        | Aggregated                                                                  | `partitions.retain`                                                              |
| `api_request_samples` / `api_request_rollups` / `api_request_ip_rollups` / `edge_security_events` | 14 days / 13 months / 30 days / 90 days                              | Deleted                                                                     | `partitions.retain`; `ip_rollups.purge` (daily)                                  |
| `support_tickets`, `support_messages`, `feedback`                                                 | 24 months after close                                                | Deleted                                                                     | `retention.purge`                                                                |
| `data_export_requests` and the export file                                                        | Link valid 7 days                                                    | File deleted at expiry, row at 30 days                                      | `exports.purge` (daily)                                                          |
| `admin_exports` file                                                                              | 24 h (row 7 years)                                                   | File deleted                                                                | `exports.admin.purge` (daily)                                                    |
| `privacy_requests`                                                                                | Register kept 6 years                                                | –                                                                           | No job seeded                                                                    |
| `legal_holds`                                                                                     | Release + 6 years                                                    | –                                                                           | No job seeded; `holds.review` (daily) only notifies                              |
| `job_applications` / `contact_submissions`                                                        | 12 / 24 months, by `retention_until`                                 | Deleted, legal holds respected                                              | `applications.purge`, `contact.retention` (daily)                                |
| `web_uploads`                                                                                     | Unattached 24 h; attached with the parent                            | Deleted; infected files at once                                             | `web_uploads.purge` (hourly)                                                     |
| `newsletter_subscribers`                                                                          | Unconfirmed 7 days; unsubscribed + 30 days                           | Deleted                                                                     | `newsletter.purge` (daily)                                                       |
| `waitlist_entries`                                                                                | Unconfirmed 7 days; 30 days after the launch message unless opted in | Deleted                                                                     | `waitlist.purge` (daily)                                                         |
| `offer_claims` plain identifier                                                                   | 30 days after the offer ends                                         | Identifier deleted, hash kept                                               | `offers.purge_identifiers` (daily)                                               |
| `consent_receipts`                                                                                | `retention_until`; the period is set with the lawyer                 | Deleted                                                                     | `retention.purge`; period is GAP-MOD16-10; delete is blocked today (GAP-DB05-04) |
| `message_client_ids`                                                                              | 7 days                                                               | Deleted                                                                     | `retention.purge`                                                                |

Rules:

1. Every purge calls `has_legal_hold()` before deleting and logs what it skipped
   ([MOD-16](../execution/1MM-EXE-MOD-16-LEGAL-PRIVACY-AND-DATA-OPERATIONS.md) rule 19).
2. Destructive jobs cannot be run on demand (`worker_jobs` `CHECK`); each returns per-rule counts
   in its run record for the A36 retention view (ruling R23).
3. A purge deletes the R2 object and the row in a way that survives a crash between the two: mark,
   delete the object, then delete the row.
4. Time-partitioned tables lose data by partition, never by `DELETE`
   ([1MM-DB-04](1MM-DB-04-INDEXING.md) section 8).
5. A period in this table is a source fact, not a legal conclusion. The periods themselves
   (7 years, 6 years, 13 months and the rest) are confirmed in the [OD-10] review: **Counsel**.

Open points in the schedule: no seeded job enforces the long-tail periods (7-year billing and
moderation records, 6-year registers, 24-month safety and trust rows, 12-month calls and meet-ups).
None is due before 2027 at the earliest; GAP-DB06-04 records it so it is not forgotten.

## 6. Deletion and anonymisation design

### 6.1 The sequence

1. **Request.** The member re-authenticates and confirms (AS2–AS3). In one transaction the account
   becomes `deletion_pending`, the profile is hidden, every session is revoked and N20 is queued
   with an undo link. An `account_deletions` row is written with `scheduled_for = requested_at +
14 days`, enforced by a `CHECK`; one scheduled row per member (`uq_deletion_scheduled`)
   [SQL], [TR §16.2]. The seeded key `deletion.grace_days` cannot change that period today
   (GAP-MOD16-06).
2. **Grace.** Day 7 reminder (`deletion.remind`). Any sign-in reaches AS5; Keep cancels and
   restores the account.
3. **Erasure.** On day 14 `erasure.run` erases the profile, media, chats and the face template
   unless banned; payments are pseudonymised; a web (Flutterwave) plan is cancelled
   (`web_billing_cancelled_at`); store subscriptions cannot be cancelled by us, so the member is
   warned (`store_cancel_warned`) [TR §11], [SQL]. Members under a legal hold are skipped.
4. **Proof.** `account_deletions.status` becomes `executed` with `executed_at`; the row is kept
   pseudonymised as proof of erasure [SQL comment].

Admin-initiated erasure uses the same table with `source` `admin_duplicate`, `admin_erase` or
`privacy_request`, the requesting admin and an approval [SQL].

### 6.2 Erased, retained, pseudonymised

| Outcome                        | Data                                                                                                                                                                                                                   | Source                                           |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Erased                         | Profile and its child tables, media rows and R2 objects, prompts, preferences, messages and conversations, reactions and matches, sessions, devices, push tokens, the face template (unless banned), sensitive answers | [TR §16.1], [TR §11]                             |
| Retained, member pseudonymised | Billing: `billing_customers`, `subscriptions`, `trials`, `transactions`, `invoices` for 7 years (tax)                                                                                                                  | [TR §16.1]; [SQL comment on `billing_customers`] |
| Retained as evidence           | `consent_records` (account + 6 years); `moderation_actions`, `moderation_cases`, `account_restrictions`, `appeals` (7 years); `admin_audit_log` (7 years)                                                              | [TR §16.1], [DD §9]                              |
| Retained for fraud prevention  | A one-way face fingerprint, only for banned accounts (`face_templates.retained_for_ban`, `account_deletions.keep_face_fingerprint`)                                                                                    | [TR §16.1], [SQL comment]                        |
| Retained as proof              | The `account_deletions` row, pseudonymised                                                                                                                                                                             | [SQL comment]                                    |

Whether each "retained" row may lawfully be kept after an erasure request, and for how long, is for
**Counsel**. The schema implements what the sources state.

### 6.3 Tombstones: what the foreign keys force

Reading the foreign keys to `users` (117 in all: 91 `CASCADE`, 20 `SET NULL`, 6 `RESTRICT`; script
B of [1MM-DB-04](1MM-DB-04-INDEXING.md)):

- The six `RESTRICT` keys are `billing_customers`, `subscriptions`, `trials`, `transactions`,
  `invoices` and `groups.owner_id`. A member with any billing row **cannot be deleted from
  `users`**; the comment on `billing_customers` says so on purpose.
- `account_deletions.user_id` and `face_templates.user_id` are `ON DELETE CASCADE`. Deleting the
  `users` row would delete the proof of erasure and the retained fingerprint.

So erasure cannot be `DELETE FROM users`. The `users` row stays as a **tombstone**: status
`deleted` (`account_status_t`), `deleted_at` set, identifying columns overwritten. The schema
supports this: `uq_users_email` is unique only `WHERE deleted_at IS NULL`, so the address is free
for a new sign-up. Child data is deleted table by table by the erasure job.

What the sources do not define is the tombstone's content. `users.email` and `first_name` are
`NOT NULL` and e-mail has a lower-case `CHECK`, so they need replacement values, and "pseudonymised"
is not defined for the billing rows or for the `account_deletions` row: GAP-DB06-01.

### 6.4 Erasure manifest

[MOD-16](../execution/1MM-EXE-MOD-16-LEGAL-PRIVACY-AND-DATA-OPERATIONS.md) owns the erasure and
export manifests; every module registers its tables (ruling R23). For each table that refers to a
member the manifest states one action:

| Action      | Meaning                                                                                               |
| ----------- | ----------------------------------------------------------------------------------------------------- |
| `delete`    | Rows for the member are removed (with their R2 objects)                                               |
| `anonymise` | The row stays; identifying columns are overwritten or nulled                                          |
| `keep`      | The row stays unchanged, with the stated reason and period                                            |
| `detach`    | The reference to the member is nulled (`SET NULL` columns: reports about others, messages in a group) |

**Recommendation** (already in the MOD-16 risk table): a test fails when a table with a foreign key
to `users` is in neither manifest and not on an explicit keep list. The list of those tables comes
from the catalogue, not from memory; 99 tables have such a key today.

Erasure steps are idempotent and ordered so a crash leaves the account more erased, never less:
revoke access, delete R2 objects, delete child rows, overwrite the tombstone, mark the deletion
`executed`. Performance of per-member deletes depends on the indexes in GAP-DB04-02.

## 7. Legal hold

`legal_holds` places a hold on a `user`, `report` or `conversation`, with a reason, reference,
review date, status and an LH reference; one live hold per subject (`uq_legal_hold_live`) [SQL].

- `has_legal_hold(kind, id)` is true while a hold is `pending_approval` or `live` and not released.
  A hold waiting for approval already protects the data [SQL].
- `erasure.run`, `retention.purge` and the message purge call it before deleting [SQL comment].
- Placing and releasing need permission `privacy.legal_holds` and approval [ADM A36].
- "Erase now" is refused while a hold is live ([MOD-16] rule 20).
- A hold does not stop an export ([MOD-16] GAP-MOD16-07 recommendation).
- `holds.review` notifies the owner at `review_at`; the register is kept for release + 6 years.

A hold keeps data that an erasure request would otherwise remove. When the two conflict, the
member-facing answer and timing are for **Counsel**.

## 8. Data-subject requests as database operations

The register is `privacy_requests` (`privacy_request_t`: `access`, `export`, `rectify`,
`erase_account`, `erase_sensitive`, `object`, `restrict_processing`), with a PR reference, `source`
(`app`, `web_form`, `email`, `admin`), `identity_verified_at` and `due_at` from
`privacy.sla_days.<kind>` [SQL]. Every `privacy.sla_days.*` is 30 days and **provisional** until
counsel confirms [OD-38]. A request not made by a signed-in member cannot be completed until
identity is verified ([MOD-16] rule 22).

| Request                              | Database operation                                                                                                                                                                                                                                               | Tables                                                                                            |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Access / export                      | A `data_export_requests` row (once a day per member by `UNIQUE (user_id, requested_on)`); `export.build` reads the member's rows through the export manifest and writes a ZIP to the `exports` bucket; link valid 7 days; file and row purged by `exports.purge` | `data_export_requests`, export manifest                                                           |
| Deletion                             | Section 6: `account_deletions`, then `erasure.run`                                                                                                                                                                                                               | `account_deletions`, erasure manifest                                                             |
| Erase sensitive answers              | A `withdrawn` consent row plus a request of kind `erase_sensitive`; `sensitive.erase` deletes the genotype and faith answers within 30 days                                                                                                                      | `consent_records`, `profile_answers`, `partner_preference_options`, `partner_preference_sections` |
| Withdraw biometric consent           | A `withdrawn` consent row; the face template is deleted; verification is removed                                                                                                                                                                                 | `consent_records`, `face_templates`, `users.is_verified`                                          |
| Rectification                        | The member edits their own profile. Birth date is locked (`birth_date_locked_at`) and is changed only from a privacy request with evidence and approval ([MOD-16] rule 28)                                                                                       | `profiles`, `privacy_requests.evidence_media_ids`, `admin_approvals`                              |
| Objection, restriction of processing | No processing-restriction column exists and the effect is not defined                                                                                                                                                                                            | GAP-MOD16-08 (owner and counsel)                                                                  |

Rules:

1. The export runs as the worker and bypasses row-level security, so the manifest, not a policy,
   decides what is included. It never includes another member's private data beyond messages the
   member received, face-template data or internal risk scores ([MOD-16] rule 12, to be confirmed
   in the lawyer review).
2. Every admin step on a request is audited; the request row records who handled it.
3. An export is personal data at rest: the object is private, short-lived and purged.

## 9. Audit of access to personal data

| Access                                                                    | Record                                                                                                          |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Admin reveal of a masked field (e-mail, phone, birth date)                | `admin_audit_log`, action `member.pii.reveal`, naming the fields, with reason and step-up [ADM §1.3], [ADM A10] |
| Admin search by e-mail or phone                                           | `admin_audit_log`, action `member.search.identifier`, query masked [ADM A04]                                    |
| Every admin write                                                         | `admin_audit_log`, with before and after [TR §7.1]                                                              |
| Admin exports                                                             | An `admin_exports` row per export; approval where the permission requires it [SQL]                              |
| Reveal of a trusted contact, phone or location during a safety escalation | `safety_escalation_updates` (kinds `reveal_phone`, `reveal_contact`, `reveal_location`), append-only            |
| Member data export                                                        | `data_export_requests` (`downloaded_at`)                                                                        |
| Consent given and withdrawn                                               | `consent_records`, append-only, with the text hash and version                                                  |

The audit log is append-only and hash-chained ([1MM-DB-05](1MM-DB-05-SECURITY.md) section 6). It is
itself personal data (IP, and member data in before and after, "masked where possible"
[SQL comment]) and is kept 7 years.

What is not recorded: ordinary reads by the member API and the worker, and direct database access
by a person. The second is why direct production access is confined to break-glass
([1MM-DB-05](1MM-DB-05-SECURITY.md) section 10.2).

## 10. Backups, erasure and point-in-time recovery

Facts [TR §10.3]: Neon point-in-time restore with a window that depends on the plan; a nightly
`pg_dump` to the R2 `backups` bucket kept 30 days; a monthly copy kept 12 months; a restore drill
every quarter; targets RTO under 1 hour and RPO under 5 minutes.

How erasure propagates:

1. Erasure removes data from the live database only. Copies remain in the point-in-time window, in
   nightly dumps for up to 30 days and in monthly copies for up to 12 months, and then age out.
   Backups are not edited.
2. After any restore, erasures and purges that happened after the backup was taken must be applied
   again before the database serves traffic. The record of what to replay is the
   `account_deletions` rows with `executed_at` later than the backup, plus a re-run of every purge
   job. A restore to a point before a deletion was requested loses the `account_deletions` row
   too, so the replay list must also be kept outside the database. This step is a
   **Recommendation** and is not in the sources: GAP-STD12-06.
3. Whether keeping erased data in backups for up to 12 months is acceptable, and what the privacy
   notice must say about it, is for **Counsel**.
4. Dumps contain every class of data. Access and encryption: [1MM-DB-05](1MM-DB-05-SECURITY.md)
   section 13.1 and GAP-STD11-09.
5. A restore drill uses an isolated environment with production-grade access control and is
   destroyed afterwards. It is never restored into staging (section 12).
6. Point-in-time restore is also the recovery path for a mistaken purge. A destructive job that
   deleted too much is an incident; the restore goes to a side database and the missing rows are
   copied back, so that later erasures are not undone.

## 11. Data residency and cross-border notes

As the sources state them:

- The origin is in the EU: the database is Neon on AWS eu-central-1 (Frankfurt); Redis is Upstash
  in eu-central-1; the API and worker run on Railway EU West (Amsterdam); media is in Cloudflare R2
  with EU jurisdiction [TR §4.3], [OD-11].
- None of these providers has a Nigeria region. Member data therefore leaves Nigeria. The
  cross-border transfer is part of the lawyer review under [OD-10]; the mechanism is for
  **Counsel**.
- AWS is used only for Rekognition Face Liveness and KMS [OD-06], [OD-11]. `.env.example` shows
  `AWS_REGION=eu-west-1` as the example value; the Technical Reference does not name the region
  (GAP-STD12-07).
- Vendor data processing agreements and cross-border safeguards are a pre-launch compliance task,
  with a DPIA [TR §16.2].
- Growth path: the origin moves to AWS af-south-1 only if a market requires local hosting or load
  outgrows these tiers [TR §4.3].

For the database this means: no replica, branch, export or backup of production is created in
another region or with another provider without an ADR and an update to
[1MM-STD-12](../standards/1MM-STD-12-DATA-HANDLING.md) §10.

## 12. Environment rules

| Environment | Data allowed [TR §4.4]                                              |
| ----------- | ------------------------------------------------------------------- |
| demo        | Test accounts and dummy data only; never real personal data [OD-10] |
| local       | Seed only                                                           |
| dev         | Synthetic                                                           |
| staging     | Synthetic plus research fixtures                                    |
| production  | Real                                                                |

1. No production data in lower environments [TR §4.4], [TR §13.1]: no dump, no "anonymised" copy,
   no row pasted into a fixture or a test.
2. Staging is a separate Neon project, never a branch of production [TR §4.3]. Staging and
   production have separate credentials, buckets and KMS keys [TR §4.4].
3. The baseline seeds reference data only, no member data [SQL section 24]. Fixtures are written by
   hand or generated, with obviously fake names, reserved example domains and non-routable numbers.
4. Before the [OD-10] steps are done, no environment holds real personal data, including the
   demo build and the research builds [OD-10], [OD-26].
5. The repository is public: no real e-mail address, phone number or member row appears in a
   migration, seed, test or document.
6. Performance testing uses generated data at production shape
   ([1MM-DB-04](1MM-DB-04-INDEXING.md) section 12).

## 13. Breach readiness: what to query in the first hour

The sources require playbooks for a data breach and NDPA notification within 72 hours [TR §13.4];
severity definitions and named people are GAP-STD11-11. Whether an event is notifiable, to whom and
when is for **Counsel** and the DPO. The database's job is to answer four questions quickly. Record
the incident in `security_incidents` (SI reference; `regulator_reference` holds the NDPC reference).

| Question                                  | Where to look                                                                                                                                                                                                  |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Is someone still inside?                  | `pg_stat_activity` by role and `application_name`; provider connection logs. Rotate the affected login ([1MM-DB-05](1MM-DB-05-SECURITY.md) section 9)                                                          |
| Was an admin account used?                | `admin_audit_log` for the suspect `admin_id` or IP over the window (`idx_audit_admin`, date range); `admin_sessions`; `admin_login_attempts`; `admin_security_alerts`; `admin_exports` requested in the window |
| Was the audit trail altered?              | Latest `admin_audit_chain_runs`; run `audit.verify_chain` for the window (at most 7 days per manual check [ADM A07])                                                                                           |
| Was a member account taken over, or many? | `login_attempts`, `new_device_challenges`, `sessions` and `devices` created in the window; `security_detections` (credential stuffing, scraping); `password_resets`                                            |
| What left through the edge or the API?    | `api_request_samples` and `api_request_ip_rollups` by prefix, ASN and route (14 days and 30 days of history only); `edge_security_events` (90 days)                                                            |
| What data was exposed, by class?          | Section 1.2: map the affected tables to classes; count distinct members affected per table                                                                                                                     |
| Who must be told?                         | Affected `users.id` list, joined to `users.email` and locale for notification; members under `legal_holds` flagged                                                                                             |
| Were secrets exposed?                     | `vendor_settings.secret_version` / `secret_last4` identify which secret version was live; rotate through the approved path                                                                                     |

Example, admin actions from one address in a window (run as the admin API role, with the date range
so partitions are pruned):

```sql
SELECT created_at, admin_id, action, target_type, target_id, reason
FROM admin_audit_log
WHERE created_at >= $1 AND created_at < $2 AND ip = $3
ORDER BY created_at;
```

Preserve before you repair: take a point-in-time marker (the time of discovery), keep the provider
logs, and place legal holds on the affected subjects so purges do not remove evidence. Short log
retention (14 days for request samples) means the first hour matters.

## 14. Checklist for every new table or column

- [ ] **PII class** stated in the table comment (`none`, `personal`, `sensitive`, `biometric`),
      and for a new column, the table's class re-checked.
- [ ] **Purpose and reader**: the screen, job or rule that needs it is named. No "in case" data.
- [ ] **Minimisation**: could a hash, a truncated value, a coarse value or a count do instead
      (section 4)?
- [ ] **Retention** stated in the comment, in the dictionary row and in section 5, with the job
      that enforces it. A new period is a `remote_config` key or a `retention_until` column, not a
      constant in code, and is flagged for the lawyer review if it concerns personal data.
- [ ] **Row-level security**: a member-owned table has policies and an isolation test; a table the
      member API must not touch has a `REVOKE` ([1MM-DB-05](1MM-DB-05-SECURITY.md) section 14).
- [ ] **Encryption**: a secret, or an identifier of a non-member, is `_enc` with a `_hash`
      companion for lookups; a token or code is stored hashed; a password uses Argon2id; no card
      data (section 3).
- [ ] **Foreign key to `users`**: the delete action is chosen on purpose (`CASCADE` for data that
      dies with the account, `RESTRICT` for records that must outlive it, `SET NULL` for references
      from other people's records) and the column is indexed if erasure or a screen reads by member
      ([1MM-DB-04](1MM-DB-04-INDEXING.md)).
- [ ] **Erasure manifest** entry: `delete`, `anonymise`, `keep` (with reason and period) or
      `detach` (section 6.4).
- [ ] **Export manifest** entry: included or excluded, with the reason.
- [ ] **Legal hold**: any purge of the table calls `has_legal_hold()`.
- [ ] **Special-category data**: a separate consent kind exists and is checked before the write;
      withdrawal has an erasure path (section 2).
- [ ] **Admin view**: masked by default; reveal audited; never in an export without approval.
- [ ] **Logs, analytics and job payloads** do not receive the new value.
- [ ] **Dictionary entry** added or updated in `packages/db/SCHEMA_DATA_DICTIONARY.md` (purpose,
      key columns, screens, retention, PII class), and
      [1MM-DB-01](1MM-DB-01-SCHEMAS.md) if it is a new table.
- [ ] **Fixtures** for the table are synthetic.

## 15. Gaps raised

Dispositions are recorded in [1MM-LOG-03](../1MM-LOG-03-TECHNICAL-REFERENCE-EXTENSIONS.md) (Technical Reference and schema), [1MM-LOG-02](../1MM-LOG-02-UI-UPDATES.md) (UI) and [1MM-LOG-04](../1MM-LOG-04-OPEN-DECISIONS-AND-FOLLOW-UPS.md) (owner decisions and repository follow-ups).

| Gap id      | Type   | Where found                                                                                                                | What is missing or conflicting                                                                                                                                                                                                                                                                                                                                                                                                        | Proposed resolution                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Blocks                                                                        |
| ----------- | ------ | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| GAP-DB06-01 | TR     | [TR §16.1], [TR §11] `erasure.run`; [SQL] foreign keys to `users`, comments on `billing_customers` and `account_deletions` | The foreign keys force the `users` row to survive erasure (six `RESTRICT` keys; `account_deletions` and `face_templates` would be lost by a cascade), but no source defines the tombstone or "pseudonymised": which `users` columns are overwritten and with what (`email` and `first_name` are `NOT NULL`, e-mail has a lower-case `CHECK`), what changes on the billing rows, and what remains on the `account_deletions` proof row | Add to [TR §16.1] a tombstone definition, for example: `status = 'deleted'`, `deleted_at = now()`, `email = 'deleted-' \|\| id \|\| '@invalid'`, `first_name = 'Deleted'`, `last_name`, `country`, `signup_country_hint`, `last_active_at` set to `NULL`; billing rows keep amounts, dates and provider references needed for tax and lose `card_last4` and free text; the proof row keeps `user_id`, dates, `source` and `status` and loses `reason_note`. Counsel confirms what may be kept | MOD-16 `erasure.run`; DPIA in MOD-19                                          |
| GAP-DB06-02 | TR     | [TR §13.4], [OD-11]; [SQL] the nine `_enc` columns                                                                         | "Envelope encryption keys in AWS KMS" is the whole specification. The cipher, the format that carries the wrapped data key or key id with the ciphertext, the version marker, one data key per row or per table, and the rotation procedure are not stated, and `_enc` columns have no key-version column                                                                                                                             | State in [TR §13.4]: authenticated encryption (AES-256-GCM); ciphertext layout `version byte ‖ key id ‖ nonce ‖ ciphertext ‖ tag` so no schema change is needed; data keys from KMS `GenerateDataKey`, cached briefly in memory; KMS automatic rotation on; a worker job re-encrypts rows on a data-key compromise. Implemented once as a `packages/db` or API platform helper in MOD-00                                                                                                      | First module that writes an `_enc` column (MOD-01 TOTP, MOD-06 face template) |
| GAP-DB06-03 | SCHEMA | [SQL] `email_suppressions`; MOD-11 risk table                                                                              | `email_suppressions.email` is a clear-text `citext` primary key, kept permanently, while every other non-member address is stored encrypted with a hash for lookup                                                                                                                                                                                                                                                                    | Key the table by hash: `ALTER TABLE email_suppressions ADD COLUMN email_hash sha256_hash;` backfill; `ALTER TABLE email_suppressions DROP CONSTRAINT email_suppressions_pkey, ADD PRIMARY KEY (email_hash), DROP COLUMN email;` (expand then contract, in separate migrations; no data exists before launch). The hash follows the answer to GAP-STD12-04                                                                                                                                     | MOD-11 suppression handling                                                   |
| GAP-DB06-04 | SCHEMA | [TR §16.1], [DD §8–§13A] against the `worker_jobs` seed                                                                    | Several stated periods have no enforcing job: 7 years for billing, moderation and approvals; 6 years for `privacy_requests`, `legal_holds` and `consent_records`; 24 months for safety and trust rows; 12 months for `calls`, `meetups` and `spotlight_rotations`; 2 years for `carrier_checks`. `retention.purge` is described as covering "logs, impressions, notifications, OTPs, tokens, consent receipts" only                   | Either extend `retention.purge` with a rule table (table, time column, period key, action) seeded per module under ruling R23, or seed named jobs. Periods become `remote_config` keys so the lawyer review can change them without a deploy. Not urgent: nothing reaches its period before late 2027                                                                                                                                                                                         | A36 retention view completeness                                               |
| GAP-DB06-05 | TR     | [DD §13A.1] `admin_exports` against [SQL] comment and [TR §16.1]                                                           | The dictionary says the admin export file is kept 7 days; the schema comment (v3.4) and the Technical Reference say 24 hours                                                                                                                                                                                                                                                                                                          | Correct the dictionary row to "file 24 hours; row 7 years"                                                                                                                                                                                                                                                                                                                                                                                                                                    | none                                                                          |

Gaps owned elsewhere that this document depends on: GAP-STD12-04 (plain or keyed identifier
hashes), GAP-STD12-05 (identity columns in clear), GAP-STD12-06 (replaying erasures after a
restore), GAP-STD12-07 (AWS region), GAP-STD11-09 (encryption of dumps), GAP-STD11-11 (incident
roles), GAP-MOD16-06 (grace-period key against the `CHECK`), GAP-MOD16-08 (objection and
restriction), GAP-MOD16-10 (values waiting on the lawyer), GAP-DB05-01 (row-level security
coverage), GAP-DB05-04 (deleting from append-only ledgers), GAP-DB04-02 (indexes for per-member
erasure).

Items for the lawyer review, collected: the legal class of each item in section 2; the retention
periods in section 5; what may be retained after erasure (section 6.2); hold against erasure
(section 7); the contents of an export (section 8); erased data in backups (section 10); the
transfer mechanism (section 11); notification duties (section 13).

## Change log

| Version | Date        | Change                                                                                                                                                                                                         |
| ------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| v1.0    | 24 Nov 2026 | First issue: classification by domain, special-category data, encryption inventory, retention schedule with jobs, erasure and tombstone design, requests, holds, backups, residency, breach queries, checklist |
