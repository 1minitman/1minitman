# 1MM-EXE-MOD-05 · Member administration

|                  |                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Document**     | 1MM-EXE-MOD-05                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **Status**       | Approved baseline · v1.0 · 24 Nov 2026                                                                                                                                                                                                                                                                                                                                                                                                      |
| **Audience**     | Engineers and coding agents                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **Owner**        | Engineering lead (code owners)                                                                                                                                                                                                                                                                                                                                                                                                              |
| **Sources**      | [TR §7], [TR §8.1], [TR §8.2] "Trust and safety, account state" and "Admin", [TR §8.3], [TR §11], [TR §13.4], [TR §16], [DD §2], [DD §9], [DD §13], [DD §14], [SQL], [UF §5.2], [UF §15.11], [UF §15.16], [INV H6, AS1], [ADM §1], [ADM A04], [ADM A09], [ADM A10], [ADM A11], [ADM A16], [ADM App. A.2], [ADM App. B], [ADM App. D], [ADM App. E], [OD-28], [OD-35], [DDR], [CN]                                                           |
| **Related**      | [1MM-EXE-00](1MM-EXE-00-MASTER-PLAN.md), [1MM-STD-06](../standards/1MM-STD-06-API-FIRST.md), [1MM-STD-11](../standards/1MM-STD-11-SECURITY-AND-COMPLIANCE.md), [1MM-STD-12](../standards/1MM-STD-12-DATA-HANDLING.md), [1MM-STD-13](../standards/1MM-STD-13-ERROR-CODES.md), [1MM-DB-05](../database/1MM-DB-05-SECURITY.md), [1MM-DB-06](../database/1MM-DB-06-DATA-PROTECTION.md)                                                          |
| **Apps touched** | `apps/api`, `apps/worker`, `apps/admin`, `apps/mobile`; packages `contracts`, `db`, `entitlements`, `i18n`, `ui-web`, `ui-native`                                                                                                                                                                                                                                                                                                           |
| **Depends on**   | [MOD-00](1MM-EXE-MOD-00-FOUNDATIONS.md), [MOD-01](1MM-EXE-MOD-01-ADMIN-ACCESS-AND-GOVERNANCE.md) (admin session, step-up, RBAC and scope, approvals, audit, exports), [MOD-02](1MM-EXE-MOD-02-PLATFORM-CONFIG-AND-CATALOGUES.md) (remote config, i18n, flag overrides), [MOD-03](1MM-EXE-MOD-03-MEMBER-IDENTITY-AND-AUTH.md) (member sessions and devices), [MOD-04](1MM-EXE-MOD-04-PROFILE-MEDIA-AND-PROMPTS.md) (profile, media, prompts) |
| **Unlocks**      | [MOD-06](1MM-EXE-MOD-06-BLACK-BADGE-VERIFICATION.md) (forced re-verification), [MOD-09](1MM-EXE-MOD-09-TRUST-AND-SAFETY.md) (sanctions from cases, appeal decisions), [MOD-10](1MM-EXE-MOD-10-BILLING-PLANS-AND-ENTITLEMENTS.md) (billing effects of sanctions, comp grants), [MOD-14](1MM-EXE-MOD-14-SUPPORT-AND-HELP.md), [MOD-16](1MM-EXE-MOD-16-LEGAL-PRIVACY-AND-DATA-OPERATIONS.md) (erasure, data requests)                          |

**What this document is for and when to open it.** It is the build plan for how staff find a
member, see everything they are allowed to see about that member, and act on the account; and for
the two member screens those actions produce (H6 suspended or banned, AS1 restricted). Open it
before building any admin view that shows member data, any sanction, or any code that checks
whether an account is restricted.

## 1. Outcome

- **Admin.** Staff with `users.read` find any member in scope by id, exact email, exact phone or
  nickname prefix, with personal data masked (A09). Member 360 (A10) shows one member across 15
  tabs from the listed tables only, with no message content, no sensitive answers, no biometrics
  and no coordinates. Every action in A11 runs with the reason, step-up and second-admin approval
  its permission flags require, and writes the audit events listed for it.
- **Member.** A restricted member sees AS1 and can send their side; a suspended or banned member
  sees H6 and can appeal once per decision. The member-facing message is always a localised fixed
  key, never free text [ADM A11].
- **Business.** Sanctions are consistent, reversible with credit for lost paid days, provable from
  an immutable audit log, and PII access is minimal and logged [TR §13.4].

## 2. Scope

**In scope**

- Admin modules A09, A10, A11 [ADM A09–A11]; the API group "Admin · Members" [TR §8.2].
- Member screens H6 and AS1 [INV H6, AS1] and the endpoints they cannot ship without:
  `GET /v1/me/account-status` and `POST /v1/appeals` (submission only). The API group "Trust and
  safety, account state" is MOD-09's; this module builds these two endpoints first because rule 1
  (API first) forbids H6 and AS1 waiting on a later module. MOD-09 extends them (appeals against
  warnings, A16 decisions). This split is ruling R5 in the
  [master plan §7](1MM-EXE-00-MASTER-PLAN.md#7-coordinator-rulings).
- The server-side account-state guard: `403 restricted` and the suspended / banned session rule.
- Worker job `restrictions.expire` [TR §11].

**Out of scope (owned elsewhere)**

| Item                                                                                                             | Owner                                       |
| ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Admin sign-in, step-up dialog, RBAC, approvals inbox (A06), audit log viewer (A07), `admin_exports` builder jobs | MOD-01                                      |
| Global search field and saved views in the shell (A04)                                                           | MOD-00; A09 reuses the same search rules    |
| `PUT /config/flags/:key/overrides/:user_id` (A11 "Set feature flag override")                                    | MOD-02                                      |
| A13 queue; contents of the Media and Prompts tabs                                                                | MOD-04 (this module renders the tabs)       |
| A12 badge queue; the `badge_applications` row created by forced re-verification                                  | MOD-06                                      |
| A14 reports and cases, A16 appeal decisions and the sanctions ladder, A17 risk and identity-link review          | MOD-09                                      |
| Pausing, re-activating and cancelling Flutterwave (web) subscriptions on sanction                                | MOD-10 (called through a port defined here) |
| Erasure execution (`POST /privacy/deletions/:user_id/erase-now`), data-subject exports, `export.build`           | MOD-16                                      |
| Notification delivery (N21, N28, N35, N36)                                                                       | MOD-11                                      |

**Deferred behind a flag**

- Carrier-check data on the Verification tab is empty at launch (`verification.carrier_check` off,
  [OD-06]) [ADM A10].
- Tabs whose owning module has not shipped render their empty state; each owning module verifies
  its tab in its own QA task (section 8, MOD-05-QA-02).

## 3. Data first

### 3.1 Data inventory

Every table named in A09, A10 and A11 was confirmed by grep in
`packages/db/migrations/0001_baseline_v3_4.sql` [SQL]; all exist in the v3.4 baseline. This module
**writes** only the objects in the first table; it **reads** the rest.

**Written by this module**

| Object                                                                                                                                                                    | Purpose                                                                                                                                                                                                                                                                | PII class                      | Retention                       | Source                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ------------------------------- | ---------------------- |
| `account_restrictions`                                                                                                                                                    | Sanction row: `kind` (`restricted`, `suspended`, `banned`), `scope[]` (5 scopes, ≥ 1), `source`, `reason_code`, `member_message_key`, `action_id`, `ends_at`, `lifted_at`, `lifted_by`, `paid_days_credited`. One live row per member and kind (`uq_restriction_live`) | personal                       | account                         | [DD §9], [SQL]         |
| `moderation_actions`                                                                                                                                                      | Ledger: `action`, `reason_code`, `note`, `case_id`, `ladder_suggestion`, `off_ladder_reason`, `reverses_action_id`, `approval_id`                                                                                                                                      | personal                       | 7 years                         | [TR §16.1], [DDR A22]  |
| `users`                                                                                                                                                                   | `status` (`account_status_t`), rectified `first_name`, `last_name`, `locale`, `country`                                                                                                                                                                                | personal                       | account                         | [SQL]                  |
| `profiles`                                                                                                                                                                | `is_hidden`, `hidden_reason`, cleared `bio` / `status_note` / `job_title` / `employer`, reset `nickname`, `nickname_is_default`                                                                                                                                        | personal                       | account                         | [ADM A11]              |
| `nickname_history`                                                                                                                                                        | Row on nickname reset                                                                                                                                                                                                                                                  | personal                       | 90 days                         | [DD §3]                |
| `sessions`                                                                                                                                                                | `revoked_at`, `revoke_reason` (`admin`, `suspended`)                                                                                                                                                                                                                   | personal                       | per [TR §16.1]                  | [SQL]                  |
| `appeals`                                                                                                                                                                 | Member appeal: `text` (1–1500), `restriction_id` or `moderation_action_id` (exactly one, each UNIQUE), `public_ref` `A-n`, `status`                                                                                                                                    | personal                       | account                         | [DD §9], [DDR A16–A19] |
| `moderation_cases`                                                                                                                                                        | Case of kind `appeal` opened for each appeal                                                                                                                                                                                                                           | personal                       | 7 years with actions            | [ADM A16]              |
| `reverification_requests`                                                                                                                                                 | One open request per member                                                                                                                                                                                                                                            | personal                       | account                         | [ADM App. C.1-7]       |
| `entitlement_grants` (`source = 'admin_comp'`), `billing_credits` (`days` 1–366; `reason` in `restriction_cleared`, `suspension_overturned`, `service_issue`, `goodwill`) | Comp plan and credit days                                                                                                                                                                                                                                              | personal                       | 7 years (billing)               | [SQL], [ADM A11]       |
| `face_templates.retained_for_ban`, `risk_devices` (`banned_at`, `banned_by`, `ban_approval_id`)                                                                           | Ban side effects                                                                                                                                                                                                                                                       | biometric / none               | per [TR §16.1]                  | [SQL]                  |
| `identity_links` (`review_status`, `reviewed_by`, `reviewed_at`)                                                                                                          | Duplicate review outcome                                                                                                                                                                                                                                               | personal                       | account                         | [DDR A29]              |
| `account_deletions` (`source = 'admin_duplicate'`, reason `duplicate`, `requested_by_admin`, `approval_id`)                                                               | Innocent duplicate closed by scheduled erasure                                                                                                                                                                                                                         | personal                       | per MOD-16                      | [DDR A30]              |
| `admin_approvals`, `admin_audit_log`, `admin_exports`, `admin_saved_views`                                                                                                | Governance rows (tables owned by MOD-01)                                                                                                                                                                                                                               | none / personal in masked form | audit 7 years; export file 24 h | [ADM §1.2–1.4]         |

**Read by this module**

| Group                  | Objects                                                                                                                                                                                                                                                                                                                     | Source            |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| Views and functions    | `v_member_entitlements`, `v_role_drift`, `v_current_consents`, `v_admin_effective_permissions`, `refresh_member_role()`, `compute_member_role()`, `has_legal_hold()`                                                                                                                                                        | [SQL], [TR §10.2] |
| Directory indexes      | `idx_users_created_id`, `idx_users_last_active`, `idx_users_country`, `idx_profiles_nick_prefix`, `idx_users_status`, `idx_users_role`, `uq_users_email`                                                                                                                                                                    | [SQL], [DDR A35]  |
| Member 360 tabs        | The tables listed per tab in section 3.2 (identity, profile, verification, billing, safety, connections, consents, notifications, support, privacy)                                                                                                                                                                         | [ADM A10]         |
| Catalogues             | `decision_reasons` (domain `sanction`, 12 codes including `permanent_minor`), `i18n_strings`                                                                                                                                                                                                                                | [SQL], [DDR A21]  |
| Remote config          | `appeals.window_days` = 30 (public); `appeals.sla_hours` = 48; `safety.sanctions_ladder` (JSON, permission `sanctions.manage`); `cases.claim_timeout_minutes` = 30                                                                                                                                                          | [SQL], [OD-28]    |
| Permissions (seeded)   | `users.read`, `users.pii.read`, `users.update`, `users.restrict`, `users.suspend`, `users.ban`, `users.erase`, `users.export`, `users.reverify`, `users.merge`, `sessions.revoke`, `entitlements.grant`; tab permissions `billing.read`, `conversations.read_reported`, `support.tickets`, `audit.read`, `privacy.requests` | [ADM App. A.2]    |
| Redis                  | `ent:{user_id}` (deleted on moderation events), `sess:deny:{session_id}` (15 min), `admin:reauth:{admin_session_id}` (5 min), `idem:{route}:{idempotency_key}`                                                                                                                                                              | [DD §14]          |
| Notification templates | N21 Account restricted, N35 Restriction lifted, N36 Account suspended, N28 Appeal decided                                                                                                                                                                                                                                   | [SQL]             |
| Worker job             | `restrictions.expire` (every 15 min)                                                                                                                                                                                                                                                                                        | [TR §11]          |
| RLS                    | `reverify_own` lets a member read their own request; other tables are reached through `app_admin_api`                                                                                                                                                                                                                       | [SQL]             |

### 3.2 UI against data

**A09 · Member directory** [ADM A09]

| Element                                                                                                                                                              | Data                                                                                                                                                                                                                                                                                                                                                            | Endpoint (`/admin/v1`)                         | Mismatch                                                             |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | -------------------------------------------------------------------- |
| Columns: photo, nickname + age, id (last 8), tier, status, verified, country / city, signed up, last active, onboarding, flags                                       | `profile_media.is_main`, `profiles.nickname`, `profiles.birth_date` → age only, `users.id`, `users.role` / `plan`, `users.status`, `is_verified` / `verified_at`, `users.country`, `profiles.city_name`, `created_at`, `last_active_at`, `onboarding_step`, live `account_restrictions`, `deletion_scheduled_for`, open `reports` count, `identity_links` count | `GET /members`                                 | none                                                                 |
| Filters: status, role, plan, verified, country, city, sign-up path, onboarding step, date ranges, restriction, open reports, deletion pending, **gender, intention** | columns above; `profiles.gender`, `profiles.intention`                                                                                                                                                                                                                                                                                                          | `GET /members?…`                               | The API line has no `gender` or `intention` parameter → GAP-MOD05-03 |
| Sort: `created_at` (default desc), `last_active_at`, `nickname`                                                                                                      | indexes in 3.1                                                                                                                                                                                                                                                                                                                                                  | same                                           | none                                                                 |
| Search: exact id, last-8 id, exact email, exact E.164 phone, nickname prefix                                                                                         | `users.id`, `users.email`, `phone_numbers.e164`, `profiles.nickname`                                                                                                                                                                                                                                                                                            | same                                           | none                                                                 |
| "Blur photos" preference                                                                                                                                             | not stored in any table                                                                                                                                                                                                                                                                                                                                         | none                                           | storage undefined → GAP-MOD05-05                                     |
| Bulk: add to saved list, revoke sessions (max 50), export selected                                                                                                   | `admin_saved_views.member_ids` (≤ 5000), `sessions`, `admin_exports`                                                                                                                                                                                                                                                                                            | `POST /members/exports`; others → GAP-MOD05-01 | "max 50" has no config key → GAP-MOD05-05                            |
| Erased member row "Erased on …"                                                                                                                                      | `users.status = 'deleted'`, `account_deletions.executed_at`                                                                                                                                                                                                                                                                                                     | `GET /members`                                 | none                                                                 |

**A10 · Member 360** [ADM A10]. No concrete API paths are given for A10 → GAP-MOD05-01.

| Tab                | Shows                                                                                                                                                                                                                                                                                                            | Tables                                                                                                                                                                                                                                                          | Extra permission                                  |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Header (all tabs)  | photo, nickname, age, city / country, tier, status, verified, id, member since, last active; banners Restricted, Suspended, Banned, Deletion pending, Role drift                                                                                                                                                 | `users`, `profiles`, `profile_media`, `account_restrictions`, `v_role_drift`                                                                                                                                                                                    | `users.read`                                      |
| Overview           | summary, strength, plan and entitlements, live restrictions, open reports and cases, last 10 timeline items                                                                                                                                                                                                      | `users`, `profiles.profile_strength`, `v_member_entitlements`, `account_restrictions`, `reports`, `moderation_cases`                                                                                                                                            |                                                   |
| Profile            | nickname and history, age (full date on reveal), gender, interested in, intention, bio, height, relationship history, work fields, languages, location as city / country / `location_source`, presence, status note, hidden state, vibes, answers by set, partner preferences, international countries, settings | `profiles`, `nickname_history`, `profile_languages`, `profile_vibes`, `profile_answers`, `option_sets`, `options`, `partner_preferences`, `partner_preference_options`, `partner_preference_sections`, `international_countries`, `user_settings`, `industries` | reveal: `users.pii.read`                          |
| Media              | slots in order with status, face match and score, face count, moderation status and labels, colour-filter flag, AI score, duration, upload time; history until `purge_after`                                                                                                                                     | `profile_media`, `media_assets`                                                                                                                                                                                                                                 |                                                   |
| Prompts            | up to 3 answers, voice playback with transcript, moderation status, removed answers                                                                                                                                                                                                                              | `prompt_answers`, `prompts`, `media_assets`                                                                                                                                                                                                                     |                                                   |
| Verification       | applications, records, liveness sessions (never the video), face template metadata only, carrier checks (empty at launch), masked phone, briefing acks, upgrade progress, pending actions                                                                                                                        | `badge_applications`, `verification_records`, `liveness_sessions`, `face_templates`, `carrier_checks`, `phone_numbers`, `safety_briefing_acks`, `upgrade_progress`, `pending_actions`                                                                           |                                                   |
| Billing            | live subscription, events, transactions, invoices, refunds, disputes, grants, trials, credits, lapse choices, customer ids, role history, usage counters                                                                                                                                                         | `subscriptions`, `subscription_events`, `transactions`, `invoices`, `refunds`, `disputes`, `entitlement_grants`, `trials`, `billing_credits`, `lapse_choices`, `billing_customers`, `role_history`, `usage_counters`                                            | `billing.read`                                    |
| Devices & sessions | devices (`last_ip` masked), sessions, sign-in attempts, new-device challenges, lockouts, password resets, sign-in methods (never the hash), push tokens                                                                                                                                                          | `devices`, `sessions`, `login_attempts`, `new_device_challenges`, `account_lockouts`, `password_resets`, `oauth_identities`, `password_credentials` (`set_at`, `breach_checked_at`, `must_change` only), `push_tokens`                                          | reveal IP: `users.pii.read`                       |
| Safety             | reports by and against, blocks (counts for support roles; ids for T&S roles), hidden-by count, cases, actions, restrictions, appeals, rule hits, trust signals, identity links, trusted contacts (masked; never to support), check-ins and escalations                                                           | `reports`, `blocks`, `hidden_profiles`, `moderation_cases`, `moderation_actions`, `account_restrictions`, `appeals`, `abuse_rule_hits`, `trust_signals`, `identity_links`, `trusted_contacts`, `safety_checkins`, `safety_escalations`                          | evidence: `conversations.read_reported`           |
| Connections        | metadata only: matches, intro sessions, conversations, DM requests, groups, meet-ups, calls, reaction counts, spotlight turns                                                                                                                                                                                    | `matches`, `intro_sessions`, `conversations`, `conversation_participants`, `dm_requests`, `groups`, `group_members`, `meetups`, `meetup_rsvps`, `calls`, `reactions`, `spotlight_rotations`                                                                     |                                                   |
| Consents           | current state per kind and append-only history (IP and user agent only on reveal)                                                                                                                                                                                                                                | `consent_records`, `v_current_consents`, `legal_documents`                                                                                                                                                                                                      |                                                   |
| Notifications      | preferences, push permission, quiet hours, log (params masked), inbox count, suppression                                                                                                                                                                                                                         | `notification_preferences`, `notification_categories`, `push_tokens`, `user_settings`, `notifications`, `inbox_items`, `email_suppressions`                                                                                                                     |                                                   |
| Support            | tickets, feedback, help votes                                                                                                                                                                                                                                                                                    | `support_tickets`, `feedback`, `help_article_votes`                                                                                                                                                                                                             | `support.tickets`                                 |
| Data requests      | exports, deletion, privacy requests                                                                                                                                                                                                                                                                              | `data_export_requests`, `account_deletions`, `privacy_requests`                                                                                                                                                                                                 | `privacy.requests` (status only for `users.read`) |
| Timeline           | merged, newest first                                                                                                                                                                                                                                                                                             | the tables above                                                                                                                                                                                                                                                |                                                   |
| Audit              | admin actions on this member                                                                                                                                                                                                                                                                                     | `admin_audit_log`                                                                                                                                                                                                                                               | `audit.read`                                      |

Reveal display window "5 minutes" [ADM A10] has no config key → GAP-MOD05-05.

**A11 · Member actions and sanctions** [ADM A11]. No concrete API paths are given → GAP-MOD05-01.

| Dialog field                                               | Column                                                              | Source of options                                                                        | Mismatch                                                                                                 |
| ---------------------------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Sanction: Restrict · Suspend · Ban, with ladder suggestion | `account_restrictions.kind`; `moderation_actions.ladder_suggestion` | `safety.sanctions_ladder` (A16, MOD-09)                                                  | Until MOD-09 ships the ladder steps are empty except `minor` → ban; the suggestion shows "No suggestion" |
| Scope (Restrict)                                           | `scope[]`                                                           | 5 values in `ck_restr_scope`                                                             | none                                                                                                     |
| Duration                                                   | `ends_at`                                                           | Restrict: none · 24 h · 7 days · 30 days · custom; Suspend: 7 days · 30 days · Permanent | Option lists are fixed in the spec, no key → GAP-MOD05-05                                                |
| Reason code                                                | `reason_code`                                                       | `decision_reasons` domain `sanction`                                                     | none                                                                                                     |
| Member message                                             | `member_message_key`                                                | `decision_reasons.member_message_key` → `i18n_strings`, preview en / pcm / fr            | none                                                                                                     |
| Linked case / report                                       | `moderation_actions.case_id`                                        | cases (MOD-09)                                                                           | none                                                                                                     |
| Note to file (≤ 2,000)                                     | `moderation_actions.note`                                           | free text                                                                                | none                                                                                                     |
| Reason (5–2,000)                                           | `admin_audit_log.reason`                                            | free text                                                                                | none                                                                                                     |
| Also: revoke sessions, hide profile                        | `sessions`, `profiles.is_hidden`                                    | forced on for suspend and ban                                                            | none                                                                                                     |

**H6 · Account suspended** [INV H6], [UF §15.11]

| Element                                                                              | Data                                                                                        | Endpoint                                                     | Admin control                                                                                 |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `{{title}}` and body; lever temporary / permanent                                    | live `account_restrictions` (`kind`, `ends_at`, `reason_code`), `member_message_key` → i18n | `GET /v1/me/account-status`                                  | A11 dialog; text in A25 i18n editor                                                           |
| "Appeal this decision" → "Tell us your side", textarea max 1500, Send appeal, Cancel | `appeals.text` (CHECK 1–1500); one per restriction (UNIQUE); window `appeals.window_days`   | `POST /v1/appeals`                                           | A31 remote config                                                                             |
| Reply promise "within 48 hours" [DDR M30]                                            | `appeals.sla_hours` (not a public key)                                                      | returned by `GET /v1/me/account-status` (**Recommendation**) | A31                                                                                           |
| Download my data                                                                     | data export (MOD-16)                                                                        | `POST /v1/me/export`                                         | shown only when the account-status response lists the action (**Recommendation**, section 11) |
| Read the Community Guidelines, Help, Sign out                                        | LG3 (MOD-16), H1 (MOD-14), `POST /v1/auth/logout` (MOD-03)                                  |                                                              |                                                                                               |
| Which calls a suspended or banned session may make                                   | not stated in any source → GAP-MOD05-02                                                     |                                                              |                                                                                               |

**AS1 · Account under review (restricted)** [INV AS1], [UF §15.16], [CN]

| Element                                                          | Data                                                                                     | Endpoint                    | Admin control        |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | --------------------------- | -------------------- |
| `{{title}}`; stages Under review → Your side sent → Cleared      | live restriction; `appeals` row exists; `lifted_at` set                                  | `GET /v1/me/account-status` | A11                  |
| What is limited                                                  | `account_restrictions.scope[]`                                                           | same                        | A11 scope checkboxes |
| "Tell us your side · optional", max 600, Send to the review team | `appeals.text`; the 600 limit is a board constant below the column's 1500 → GAP-MOD05-05 | `POST /v1/appeals`          | proposed key         |
| Cleared: lost paid days credited back                            | `account_restrictions.paid_days_credited`, `billing_credits`                             | same                        | A11 lift             |
| Home banner                                                      | `v_member_entitlements.is_restricted`                                                    | `GET /v1/me/account-status` |                      |
| Links D1, H2                                                     | MOD-07, MOD-13                                                                           |                             |                      |

### 3.3 Assets

| Asset                                                                                                                                                                                                                          | Use                                             | Source                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------- | --------------------------------- |
| No illustration file names H6 or AS1                                                                                                                                                                                           | Screens are text and icon only                  | `02_brand/ILLUSTRATIONS/` listing |
| Tokens: tier tokens for `TierBadge` (always with the plan name), signal colours only for state with icon and text, `radius.sm`, `shadow.menu`, `shadow.sheet`, `border.width.focus`, `breakpoint.tablet`, `breakpoint.desktop` | A09–A11                                         | [ADM §1.7–1.9]                    |
| Destructive button style (`--destructive`) with the verb as label                                                                                                                                                              | Ban and suspend confirms                        | [ADM A11]                         |
| Haptics: none specified for H6 or AS1; `error` only when a send fails                                                                                                                                                          | H6, AS1                                         | [TR §2.5]                         |
| Sound, motion                                                                                                                                                                                                                  | None beyond the standard 150–250 ms transitions | [TR §2.5]                         |

Member photos stay full colour in both admin themes; thumbnails are blurred when the preference is
on and are then hidden from screen readers ("Photo hidden") [ADM A09].

### 3.4 Dynamic content and constants

| Constant                                                                                | Lives in                                                     | Changed by                                                                                            | Reaches clients by                                        |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Sanction reason codes and member messages                                               | `decision_reasons`, `i18n_strings`                           | i18n text in A25; codes by migration (no editor specified, [DDR A21])                                 | admin API; member sees the localised key                  |
| Sanctions ladder                                                                        | `remote_config` `safety.sanctions_ladder`                    | A16 with `sanctions.manage` (approval)                                                                | admin API                                                 |
| Appeal window and reply target                                                          | `appeals.window_days`, `appeals.sla_hours`                   | A31 remote config (four-eyes in production)                                                           | `GET /v1/config` (window) and `GET /v1/me/account-status` |
| Permission flags (reason, re-auth, approval), allowed scopes, dependencies              | `admin_permissions`                                          | seeds; system roles are not editable ([ADM App. D AD-15])                                             | `GET /me` of the admin API                                |
| Approval expiry 72 h, reason length 5–2,000                                             | `admin_approvals` default and CHECK                          | migration                                                                                             | admin API                                                 |
| Re-auth window 5 min                                                                    | Redis TTL `admin:reauth:{admin_session_id}` [ADM §1.1]       | MOD-01                                                                                                | n/a                                                       |
| Restriction scopes                                                                      | `ck_restr_scope`                                             | migration                                                                                             | zod enum in `packages/contracts`                          |
| Bulk limit 50, reveal window 5 min, duration options, AS1 text limit 600, "Blur photos" | spec constants → GAP-MOD05-05                                | proposed `remote_config` keys                                                                         | admin bootstrap; `GET /v1/config`                         |
| Console copy                                                                            | English only ([ADM App. D AD-23]); `packages/i18n` `en` keys | A25, `i18n.manage` (path: GAP-MOD02-10 in [MOD-02](1MM-EXE-MOD-02-PLATFORM-CONFIG-AND-CATALOGUES.md)) | console catalogue                                         |
| Notification templates N21, N28, N35, N36                                               | `notification_templates` + `i18n_strings`                    | A25                                                                                                   | MOD-11                                                    |

## 4. API (built first)

### 4.1 Endpoints

**Member surface `/v1`** [TR §8.2]

| Method and path             | Auth / gate                                              | Request → response                                                                                                                                                                            | Errors                                                                                                                                  | Idempotency      | Analytics (proposed names, `screen.action` per [TR §14]) |
| --------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | -------------------------------------------------------- |
| `GET /v1/me/account-status` | M; allowed for restricted, suspended and banned accounts | → `{status, restriction: {kind, scope, ends_at, message_key, reason_category}, appeal: {public_ref, status} \| null, can_appeal, appeal_until, appeal_reply_hours, credited_days, actions[]}` | 401                                                                                                                                     | n/a              | `h6.view`, `as1.view`                                    |
| `POST /v1/appeals`          | M; one per decision; inside `appeals.window_days`        | `{restriction_id, text}` → `{public_ref, status}`; opens a `moderation_cases` row of kind `appeal` with `sla_due_at` = now + `appeals.sla_hours`                                              | 409 `already_requested` (returns the first), 410 `window_closed`, 422 `validation` (text length), 404 `not_found` (not own restriction) | natural (UNIQUE) | `h6.appeal.submit`, `as1.side.send`                      |

**Admin surface `/admin/v1`**, auth A. Only `GET /members` and `POST /members/exports` are given
by the admin spec; [TR §8.2] (v3.5) named the domain as `users`, `users/{id}/pii`, restrictions,
suspensions, bans, erasure, sessions. The remaining paths below were **proposed in GAP-MOD05-01**
and are accepted by TRX-026 [TR §20.2], which names the resource `/members` (with
`members/{id}/pii`) and adds the `gender` and `intention` filters. Every write sends
`Idempotency-Key`; forms send `If-Match` [ADM §1.4].

| Method and path                                                    | Permission (flags)                         | Effect                                                                                     | Audit event                                                                  |
| ------------------------------------------------------------------ | ------------------------------------------ | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| `GET /members?…`                                                   | `users.read`                               | Directory, cursor, 25 / 50 / 100                                                           | `member.search.identifier` when `q` is an email or phone (query masked)      |
| `POST /members/exports`                                            | `users.export` (reason, approval, re-auth) | Approval, then `admin_exports` job                                                         | `member.export.request`                                                      |
| `GET /members/:id`                                                 | `users.read`                               | Header and overview                                                                        | `member.view`                                                                |
| `GET /members/:id/{tab}`                                           | tab permission (3.2)                       | One tab, lazily                                                                            | `member.tab.view` for billing, safety, devices                               |
| `POST /members/:id/pii/reveal`                                     | `users.pii.read` (reason, re-auth)         | Returns the named fields unmasked                                                          | `member.pii.reveal` with the fields                                          |
| `PATCH /members/:id`                                               | `users.update` (reason)                    | Rectify first name, last name, locale, country                                             | `member.update`                                                              |
| `POST /members/:id/nickname/reset`                                 | `users.update` (reason)                    | Nickname = first name (≤ 20), history row                                                  | `member.nickname.reset`                                                      |
| `POST /members/:id/content/clear`                                  | `users.update` (reason)                    | Clear bio, status note, job title or employer; `moderation_actions` (`remove_content`)     | `member.content.clear`                                                       |
| `POST /members/:id/profile/hide`                                   | `users.restrict`                           | `is_hidden = true`, `hidden_reason = 'restricted'`                                         | `member.profile.hide`                                                        |
| `POST /members/:id/reverification`                                 | `users.reverify` (reason)                  | `reverification_requests` + case `face_mismatch_review`; badge application added by MOD-06 | `member.reverify.request`                                                    |
| `POST /members/:id/sessions/revoke`; bulk variant (≤ 50)           | `sessions.revoke` (reason)                 | `sessions.revoked_at`, `sess:deny:*`                                                       | `member.sessions.revoke`                                                     |
| `POST /members/:id/restrictions` · `POST …/restrictions/:rid/lift` | `users.restrict` (reason)                  | Rules 9–10                                                                                 | `member.restriction.create`, `member.restriction.lift`                       |
| `POST /members/:id/suspensions` · `POST …/suspensions/:rid/lift`   | `users.suspend` (reason, re-auth)          | Rules 11–12                                                                                | `member.suspension.create`, `member.suspension.lift`                         |
| `POST /members/:id/bans` · `POST …/bans/:rid/lift`                 | `users.ban` (reason, approval, re-auth)    | Rules 13–14                                                                                | `member.ban.request` → `member.ban`; `member.unban.request` → `member.unban` |
| `POST /members/:id/grants` · `POST /members/:id/credits`           | `entitlements.grant` (reason)              | Comp plan (`ends_at` required) or credit days                                              | `member.entitlement.grant`, `member.credit.create`                           |
| `POST /members/duplicates/resolve`                                 | `users.merge` (reason, approval, re-auth)  | Rule 16                                                                                    | `member.duplicate.resolve.request` → `member.duplicate.resolve`              |
| `POST /members/:id/exports`                                        | `users.export` (reason, approval, re-auth) | Data-subject export (MOD-16 builder) or internal `admin_exports` job                       | `member.export.request`                                                      |

Errors on every admin route: `403 {reason:"permission", permission}`; `404 not_found` for a row
outside scope; `403 reauth_required` when re-auth is stale; `412 precondition_failed` on a stale
`If-Match`; `422 validation` for invalid input; `409 illegal_state` for an illegal state change
(for example a second live restriction of the same kind); an approval-gated action answers `202`
with `approval_id` and `expires_at` [ADM §1.1–1.4]. The codes are those of
[1MM-STD-13](../standards/1MM-STD-13-ERROR-CODES.md).

### 4.2 Realtime, jobs and webhooks

- **Member socket.** `account.restricted` and `entitlements.changed` are sent when a sanction is
  created or lifted [TR §8.3], [ADM A11].
- **Admin stream.** `case.updated` for the member's cases; an "Updated · Refresh" banner when
  restrictions or plan change; `approval.created` / `approval.decided` for ban, unban, duplicate
  and export requests [ADM §1.6], [ADM A10].
- **Job.** `restrictions.expire` every 15 minutes: lifts ended suspensions and credits paid days
  (`billing_credits`) [TR §11].
- **Notifications (enqueued here, delivered by MOD-11).** N21 on restrict, N35 on lift, N36 on
  suspend, N28 when an appeal is decided (MOD-09). No template is named for a ban → GAP-MOD05-04.
- **Webhooks.** None.

### 4.3 Rules the API must enforce

1. Every admin request passes the server checks in [ADM §1.1]: live session, active admin,
   permission held now, scope, IP allow-list and, for re-auth permissions, MFA within 5 minutes.
2. Scope: a country- or city-scoped admin never sees a member outside scope; lists exclude the row
   and direct access returns 404 [ADM §1.1].
3. Email, phone, birth date, real name, device IP and consent IP / user agent are masked in every
   response (`a***@g***.com`, `+234 *** *** 0123`, age instead of birth date). They are returned
   only by the reveal endpoint, to a holder of `users.pii.read`, with a reason and step-up, and
   each reveal writes `member.pii.reveal` naming the fields [ADM §1.3], [ADM A10].
4. Email and phone search need the full value; a partial value returns nothing; the search is
   audited with the query masked [ADM A09].
5. Member 360 never returns: chat, intro or DM text, conversation previews or Direct Spec notes;
   values of sensitive option sets (`faith`, `faith_practice`, `genotype`: answered / consent
   state only); liveness video; face template content (metadata only); password hashes;
   `profiles.location` or `safety_checkins.last_coarse_location`; trusted-contact phone numbers
   unmasked; the identities behind blocks to support roles [ADM A10].
6. Each tab reads the tables listed for it and nothing else (contract test on the response schema)
   [ADM A10].
7. Opening a member writes `member.view`; one audit row per write and per reveal, in the same
   transaction as the change, with only changed fields in `before` / `after` and personal fields
   masked [ADM §1.3].
8. Admins remove or reset member-written content; no endpoint accepts free text for a member's
   bio, prompts or messages. `profiles.birth_date` is never editable here [ADM A11].
9. Restrict: writes `account_restrictions` (`kind = 'restricted'`, `scope`, `reason_code`,
   `member_message_key`, `ends_at`, with `source = 'moderator'`) and `moderation_actions`
   (`restrict`); sets `users.status = 'restricted'`; deletes `ent:{user_id}`; enqueues N21. From
   that moment the member API returns `403 restricted` for new conversations, Direct Specs and
   group posts, and discovery and Spotlight exclude the member; replies in existing chats still
   work [ADM A11], [CN].
10. Lift restriction: sets `lifted_at`, `lifted_by`; `moderation_actions` (`lift_restriction`);
    status recomputed; optional `billing_credits`; N35.
11. Suspend: `kind = 'suspended'` with `ends_at` = +7 or +30 days, or NULL with a `permanent_*`
    reason code; sessions revoked; `users.status = 'suspended'`; profile hidden; the billing port
    is called to pause a Flutterwave (web) subscription. Store subscriptions keep billing and the
    dialog says so [ADM A11], [ADM App. D AD-25].
12. Unsuspend (manual or by `restrictions.expire`): lifts, recomputes status, re-activates the web
    subscription through the port, credits lost paid days.
13. Ban: never executes directly. It creates `admin_approvals` with the exact payload and 72 h
    expiry; a second admin with `approvals.decide` approves; the server then executes the stored
    payload: `kind = 'banned'` (no `ends_at`), `users.status = 'banned'`, sessions revoked,
    `face_templates.retained_for_ban = true`, `risk_devices.banned_at` for the member's devices,
    profile hidden, web subscription cancelled at period end. The requester cannot approve their
    own request (`admin_approvals` CHECK) [ADM §1.2], [ADM A11].
14. Unban follows the same approval path and reverses the device and face flags.
15. Every sanction needs a `reason_code` from `decision_reasons` (domain `sanction`) and a
    `member_message_key`; sanctions are one member at a time; an under-18 finding is a ban with
    reason `minor` [ADM A11], [ADM App. D AD-29].
16. Resolve duplicates means close one account, never merge data: a ban-evasion duplicate is
    banned (approval); an innocent one gets an `account_deletions` row (reason `duplicate`,
    `source = 'admin_duplicate'`), and the member is emailed and can object within the 14-day
    grace. Subscriptions, matches, chats and media are never moved
    [ADM A11], [ADM App. D AD-12].
17. Comp grants require `ends_at` and call `refresh_member_role()`; `v_role_drift` returns no row
    afterwards [ADM A11].
18. A banned member's record allows only Unban and data requests [ADM A10].
19. Appeals: one per decision; only for the member's own live or recent sanction; inside
    `appeals.window_days`; the case is due within `appeals.sla_hours` [OD-28], [OD-35].
20. An approved request whose execution fails is marked `failed` with `execution_error`, never
    silently retried [ADM App. C.1-21].

### 4.4 Contract deliverables

| Package                 | Deliverable                                                                                                                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/contracts`    | Routes and zod schemas for section 4.1 on `/v1` and `/admin/v1`; one response schema per Member 360 tab; a shared `MaskedString` type and reveal schema; restriction scope and reason enums |
| `packages/entitlements` | `isRestricted(scope)` helper used by every later module's guard; mapping of account status to allowed routes                                                                                |
| `packages/db`           | Drizzle models for the written tables; read models for the tab queries; no DDL                                                                                                              |
| `packages/i18n`         | H6 and AS1 keys in en, pcm, fr; keys behind `decision_reasons.label_key` and `member_message_key` (`sanction.*`)                                                                            |

## 5. Admin: what it consumes and how

- **Routes.** `/members` (A09) and `/members/:id` with 15 tabs (A10, A11) [ADM App. B]. Tabs the
  admin cannot open are hidden; a direct link shows the no-access state with the permission key
  [ADM §1.5].
- **Directory.** Table with cursor pagination (50), filters and sort in the URL, saved views,
  debounced search (300 ms, 2 characters; exact identifiers excepted) [ADM §1.4]. Row click opens
  the Member 360 drawer with "Open full record".
- **Member 360.** Header with banners; each tab fetches lazily; masked values carry a Reveal
  control that opens the reason dialog, then step-up if MFA is older than 5 minutes, then shows
  the value for the reveal window [ADM A10].
- **Actions menu.** Filtered by permission. Approval-gated actions end in "Sent for approval" with
  a link to the request in A06 [ADM §1.2].
- **States.** Loading (skeleton after 300 ms), empty, no permission, error with `request_id`,
  offline (writes disabled, nothing queued), stale ("Updated · Refresh"), erased member, banned
  member [ADM §1.5], [ADM A10].
- **Responsive.** Card list below 600 px; tabs become a select below 1024 px; Member 360 is
  read-only on mobile except "Revoke sessions"; sanction dialogs need ≥ 1024 px [ADM A09–A11].
- **Accessibility.** ARIA tabs pattern with an `<h2>` per tab; table semantics with `aria-sort`;
  row actions labelled in context; the ladder suggestion is text; voice playback has keyboard
  controls and the transcript [ADM §1.9], [ADM A10], [ADM A11].
- **Acceptance.** The A09, A10 and A11 acceptance checklists apply in full.

## 6. Web: website and billing web app

Not applicable: no website or billing web app surface belongs to this module. A suspended member
who opens the billing web app is handled by MOD-10 using the account-state guard built here.

## 7. Mobile: what it adapts and uses

| Screen | Route                         | Entry                                                          | States                                                                                                                             |
| ------ | ----------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| AS1    | `app/account/restricted.tsx`  | Next launch after a restriction, N21 deep link, home banner    | Under review; Your side sent; Cleared (credited days shown); loading; error with retry; offline (last status, send disabled)       |
| H6     | `app/(blocked)/suspended.tsx` | Any launch or sign-in while suspended or banned; N36 deep link | Temporary (end date); Permanent; Banned; appeal form; appeal sent (reference `A-n`); appeal window closed; loading; error; offline |

- **Guard.** On every app start and on the `account.restricted` socket event the app reads
  `GET /v1/me/account-status`. Suspended and banned accounts are routed to the `(blocked)` group
  and cannot leave it; restricted accounts keep the app with the home banner and AS1.
- **Gating and upsell.** None: account states are never an upsell.
- **Copy.** Title and body come from the `member_message_key`; nothing about the reason is written
  in the client.
- **Accessibility.** Textareas have visible labels and a character count; errors are linked to the
  field; the end date is text, not a countdown animation; targets ≥ 44 px [TR §2.4].
- **Phone and tablet.** Single column on phone; on tablet a centred column per
  [1MM-STD-03](../standards/1MM-STD-03-MOBILE-BUILD-STRATEGY.md).

## 8. Work breakdown (strict order)

| Id            | Built                                                                                                                          | Needs                      | Done when                                                                   |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------- | --------------------------------------------------------------------------- |
| MOD-05-DB-01  | Drizzle models; behaviour tests for `uq_restriction_live`, the suspension and ban CHECKs, `ck_restr_scope`, `ck_appeal_target` | MOD-00                     | Tests green                                                                 |
| MOD-05-API-01 | Masking library and reveal endpoint; `member.view` and reveal audit                                                            | MOD-01                     | Rules 1–4, 7 tested; no unmasked PII in any snapshot                        |
| MOD-05-API-02 | Directory `GET /members` and export request                                                                                    | GAP-MOD05-01, GAP-MOD05-03 | Every filter uses an index; 50-row page within 1 s on staging [ADM A09]     |
| MOD-05-API-03 | Member 360 header and the 15 tab endpoints                                                                                     | MOD-04                     | Rules 5–6 tested by schema contract tests                                   |
| MOD-05-API-04 | Non-sanction actions: rectify, nickname reset, content clear, hide, sessions revoke, comp grant, credit                        | MOD-03                     | Rules 8, 17 tested                                                          |
| MOD-05-API-05 | Restrict, suspend, lift; account-state guard; billing port (no-op adapter until MOD-10)                                        | MOD-05-API-04              | Rules 9–12, 15 tested                                                       |
| MOD-05-API-06 | Ban, unban, duplicate resolution through approvals                                                                             | MOD-01 approvals           | Rules 13, 14, 16, 18, 20 tested                                             |
| MOD-05-API-07 | `GET /v1/me/account-status`, `POST /v1/appeals`, socket events                                                                 | GAP-MOD05-02               | Rule 19 tested                                                              |
| MOD-05-WRK-01 | `restrictions.expire`                                                                                                          | MOD-05-API-05              | Ended suspension lifted and credited within one run; safe to run twice      |
| MOD-05-ADM-01 | A09 directory                                                                                                                  | **API gate**               | A09 checklist ticked                                                        |
| MOD-05-ADM-02 | A10 Member 360                                                                                                                 | API gate                   | A10 checklist ticked                                                        |
| MOD-05-ADM-03 | A11 actions and dialogs                                                                                                        | API gate                   | A11 checklist ticked                                                        |
| MOD-05-MOB-01 | AS1, H6 and the app guard                                                                                                      | API gate                   | Maestro flows for each state on phone and tablet                            |
| MOD-05-QA-01  | End-to-end: restrict → AS1 → side sent → lift → credit; suspend → H6 → appeal; ban with two admins                             | all above                  | Passes on staging                                                           |
| MOD-05-QA-02  | Tab verification hooks: each later module (06–14, 16) runs the Member 360 contract test for its tab when it ships              | later modules              | Listed in each module's exit gate                                           |
| MOD-05-API-08 | Forced re-verification completes with a `badge_applications` row at `face_check`, no charge                                    | MOD-06 API gate            | Runs after MOD-06; `reverification_requests.status = 'completed'` reachable |

**API gate (must be green before any ADM or MOB task starts):** tasks API-01 to API-07 and WRK-01
merged; OpenAPI published and clients regenerated (`pnpm contracts:generate`); `pnpm check` green;
the audit contract test passes (each write endpoint emits exactly its listed action,
[ADM App. E]); the "never returns" test of rule 5 passes; GAP-MOD05-01 and GAP-MOD05-02 resolved.

## 9. Tests

Method and tooling are in [1MM-STD-01](../standards/1MM-STD-01-TESTING-STRATEGY.md).

| Layer            | Expected                                                       | Unexpected                                                                                                                                                                                                                                                                                                                       | Variables change                                                                                                                                                                                            |
| ---------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API · directory  | Each search form finds the member; masks applied; scope filter | Partial email or phone; SQL-like or wildcard input; out-of-scope id (404); `limit` outside 25 / 50 / 100; expired scoped grant                                                                                                                                                                                                   | Role (support, reviewer, T&S, DPO); scope global / country / city; 0, 1 and many results; erased and deletion-pending members                                                                               |
| API · Member 360 | Each tab returns only its tables                               | Seeded chat text, intro note, DM note, genotype and faith values, coordinates, password hash and liveness reference must not appear in any response; tab without its permission (403); reveal without reason; reveal with stale MFA (step-up); reveal by a role without `users.pii.read`                                         | Member in every `account_status_t` value; member with no profile yet (onboarding); empty tabs before later modules ship                                                                                     |
| API · sanctions  | Rules 9–18                                                     | Second live restriction of the same kind (409); suspend without `ends_at` and without a `permanent_*` code; ban with `ends_at`; empty scope; requester approves own ban; approval expired after 72 h; approved ban whose execution fails (`failed`); double submit with the same `Idempotency-Key`; sanction on an erased member | Durations 24 h / 7 d / 30 d / permanent; store-billed vs web-billed vs no plan; lifting before and after `ends_at`; clock at the expiry boundary; two admins acting on the same member at once (`If-Match`) |
| API · member     | Status payload per state; appeal created with case and SLA     | Second appeal (409 with the first); appeal after the window (410); appeal on another member's restriction (404); text of 0 and 1,501 characters; suspended session calling any other route                                                                                                                                       | `appeals.window_days` 30 → 0; `appeals.sla_hours` 48 → 24; locale en / pcm / fr for the message key                                                                                                         |
| Worker           | Ended suspensions lifted, days credited                        | Job overlap; restriction lifted manually during the run; permanent suspension never lifted                                                                                                                                                                                                                                       | Many expiries in one run; time-zone boundaries                                                                                                                                                              |
| Admin            | Each checklist item in A09–A11                                 | Offline (writes disabled); session expiry mid-dialog; stale row update while a dialog is open                                                                                                                                                                                                                                    | Width 1280 / 1024 / 600 / 320 px; light and dark; role without each permission; keyboard-only use                                                                                                           |
| Mobile           | Each state in section 7                                        | Socket event while on another screen; sanction lifted while H6 is open; offline at launch                                                                                                                                                                                                                                        | Text size 200%; reduced motion; tablet; three locales                                                                                                                                                       |

Adjustable thresholds under test: `appeals.window_days`, `appeals.sla_hours`, the re-auth window,
the approval expiry, and the keys proposed in GAP-MOD05-05 once accepted.

## 10. Exit gate

- [ ] A09, A10 and A11 acceptance checklists ticked by a reviewer [ADM A09–A11].
- [ ] Milestone M3 demonstration passes [ADM §3].
- [ ] Automated proof that no Member 360 response contains message content, sensitive answers,
      biometric content, coordinates or password material.
- [ ] Every PII reveal, member view, identifier search and write has its audit row; the hash chain
      verifies after the test run.
- [ ] Ban, unban, duplicate resolution and export cannot execute without a second admin.
- [ ] `403 restricted` is returned by the shared guard for the three restricted actions; the
      helper is published in `packages/entitlements` for later modules.
- [ ] AS1 and H6 show only localised keys; no reason text is hard-coded.
- [ ] Every gap in section 12 is resolved or has an owner-approved deferral.

## 11. Risks and open questions

| Risk or question                                                             | Effect                                                                        | Handling                                                                                                                               |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| A10 and A11 have no concrete API paths                                       | Contract cannot be written                                                    | GAP-MOD05-01 before MOD-05-API-02                                                                                                      |
| `GET /v1/me/account-status` and `POST /v1/appeals` sit in MOD-09's API group | Double build                                                                  | Built here, extended by MOD-09 (ruling R5)                                                                                             |
| H6 "Download my data" needs MOD-16's export                                  | Action unavailable until MOD-16                                               | **Recommendation:** the account-status response lists the available actions; the client renders only those; MOD-16 turns the action on |
| Member 360 tabs read tables whose modules ship later                         | Tabs are empty at first; a later schema use could drift from the tab contract | MOD-05-QA-02 in every later module's exit gate                                                                                         |
| Billing effects of suspend and ban need MOD-10                               | Web subscriptions not paused until then                                       | **Recommendation:** a port with a no-op adapter that records the intent; MOD-10 replays open intents at its gate                       |
| Ladder values are not set (structure only, [ADM App. D AD-29])               | No suggestion in the dialog                                                   | Dialog works without a suggestion; values set by the T&S lead in A16                                                                   |
| Insider snooping                                                             | Privacy harm                                                                  | `member.view` and reveal audit rows exist to detect it [ADM §1.3]; reviewed through A07                                                |
| Mis-scoped query leaks a member across countries                             | Privacy harm                                                                  | Scope applied in one shared query builder, tested per role                                                                             |

## 12. Gaps raised

Dispositions are recorded in [1MM-LOG-03](../1MM-LOG-03-TECHNICAL-REFERENCE-EXTENSIONS.md) (Technical Reference and schema), [1MM-LOG-02](../1MM-LOG-02-UI-UPDATES.md) (UI) and [1MM-LOG-04](../1MM-LOG-04-OPEN-DECISIONS-AND-FOLLOW-UPS.md) (owner decisions and repository follow-ups).

| Gap id       | Type     | Where found                                                     | What is missing or conflicting                                                                                                                                                               | Proposed resolution                                                                                                                                                                                                                                                                                                                                                                              | Blocks                  |
| ------------ | -------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------- |
| GAP-MOD05-01 | TR       | [ADM A10], [ADM A11] (no "API" line), [TR §8.2] Admin · Members | Member 360 and member actions have no concrete endpoints; the Technical Reference says `users/{id}/pii` while the admin spec uses `/members`                                                 | Adopt `/members` and add the paths in section 4.1 to the Technical Reference and `packages/contracts`, including the bulk session revoke and saved-list endpoints (settled by TRX-026)                                                                                                                                                                                                           | MOD-05-API-02 to API-06 |
| GAP-MOD05-02 | TR       | [TR §8.2], [UF §15.11], [ADM A11]                               | Suspend and ban revoke sessions, yet H6 needs an authenticated member to read status, appeal, download data and sign out. No source says which routes a suspended or banned account may call | State the allow-list: sign-in succeeds into a limited session that may call only `GET /v1/me/account-status`, `POST /v1/appeals`, `POST / GET /v1/me/export`, `GET /v1/legal/{kind}`, the help endpoints and `POST /v1/auth/logout`; every other route returns 403 with the account state (settled by TRX-005)                                                                                   | MOD-05-API-07, MOB-01   |
| GAP-MOD05-03 | TR / UI  | [ADM A09]                                                       | Filters list Gender and Intention, but the API query string has neither, and no directory index covers them                                                                                  | Add `gender=` and `intention=` to `GET /members`; index need assessed in [1MM-DB-04](../database/1MM-DB-04-INDEXING.md), or drop the two filters from the board (settled by TRX-026)                                                                                                                                                                                                             | MOD-05-API-02           |
| GAP-MOD05-04 | DECISION | [ADM A11], `notification_templates`                             | N36 covers "Account suspended"; no template is named for a ban or for an unban                                                                                                               | Owner decides: reuse N36 with the ban message key, or add a template in MOD-11                                                                                                                                                                                                                                                                                                                   | Ban notification        |
| GAP-MOD05-05 | SCHEMA   | [ADM A09], [ADM A10], [ADM A11], [INV AS1]                      | Constants with no config key: bulk limit 50; PII reveal window 5 min; restrict and suspend duration options; AS1 text limit 600; where the "Blur photos" preference is stored                | Seed `remote_config`: `('admin.bulk_action_max','50','int',…,false,'A09')`, `('admin.pii_reveal_seconds','300','int',…,false,'A10')`, `('safety.sanction_durations','{"restrict_hours":[24,168,720],"suspend_days":[7,30]}','json',…,false,'A11')`, `('appeals.restricted_text_max','600','int',…,true,'AS1')`; keep "Blur photos" per browser and say so in the admin spec (settled by TRX-052) | Admin and AS1 constants |

## Change log

| Version | Date        | Change        |
| ------- | ----------- | ------------- |
| v1.0    | 24 Nov 2026 | First version |
