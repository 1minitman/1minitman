# 1MM-EXE-MOD-11 · Notifications and communications

|                  |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Document**     | 1MM-EXE-MOD-11                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **Status**       | Approved baseline · v1.0 · 24 Nov 2026                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **Audience**     | Engineers and coding agents                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **Owner**        | Engineering lead (code owners)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **Sources**      | [TR §2.2], [TR §2.5], [TR §4.2], [TR §6.1], [TR §7.4], [TR §8.1], [TR §8.2] "Notifications, help, legal, privacy, analytics", "Public website", "Webhooks in", [TR §11], [TR §12], [TR §13.3], [TR §14], [TR §16], [TR §18.3], [DD §1], [DD §11], [DD §13A], [DD §13B], [DD §14], [SQL], [UF §15.20], [ADM A25], [ADM A26], [ADM A29], [ADM App. A.5], [WEB W36], [WEB §5.7], [WEB §5.10], [WEB §3.11], [INV C7], [INV D16], [INV NT1–NT4], [CN notif-rules], [DDR], [OD-06], [OD-23]                                                                                                                                                                                                                                                                                                                  |
| **Related**      | [1MM-EXE-00](1MM-EXE-00-MASTER-PLAN.md) · [MOD-00](1MM-EXE-MOD-00-FOUNDATIONS.md) · [MOD-01](1MM-EXE-MOD-01-ADMIN-ACCESS-AND-GOVERNANCE.md) · [MOD-02](1MM-EXE-MOD-02-PLATFORM-CONFIG-AND-CATALOGUES.md) · [MOD-03](1MM-EXE-MOD-03-MEMBER-IDENTITY-AND-AUTH.md) · [MOD-05](1MM-EXE-MOD-05-MEMBER-ADMINISTRATION.md) · [MOD-07](1MM-EXE-MOD-07-DISCOVERY-AND-MATCHING.md) · [MOD-10](1MM-EXE-MOD-10-BILLING-PLANS-AND-ENTITLEMENTS.md) · [MOD-13](1MM-EXE-MOD-13-MEETUPS-AND-PERSONAL-SAFETY.md) · [MOD-15](1MM-EXE-MOD-15-CMS-AND-PUBLIC-WEBSITE.md) · [MOD-16](1MM-EXE-MOD-16-LEGAL-PRIVACY-AND-DATA-OPERATIONS.md) · [1MM-STD-13](../standards/1MM-STD-13-ERROR-CODES.md) · [1MM-STD-17](../standards/1MM-STD-17-LANGUAGE-CONFIGURATION.md) · [1MM-STD-18](../standards/1MM-STD-18-NOTIFICATIONS.md) |
| **Apps touched** | `apps/api`, `apps/worker`, `apps/admin`, `apps/site` (W36), `apps/mobile`. `apps/web` only receives billing e-mails; it has no notification screen.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **Depends on**   | MOD-00 (outbox write helper, webhook intake, worker runtime), MOD-01 (RBAC, approvals, audit), MOD-02 (remote config, flags, the i18n API and `/comms/translations`, [coordinator ruling R11](1MM-EXE-00-MASTER-PLAN.md#7-coordinator-rulings); every ruling cited below by number is in that section of the master plan), MOD-03 (member auth, `user_settings`, `POST /v1/consents`, the C7 primer screen). W36 only: `MOD-14-API-05` (the shared public form pipeline, rulings R24 and R25) before `MOD-11-API-07`, and MOD-15's website gate before `MOD-11-WEB-01` (ruling R26)                                                                                                                                                                                                                    |
| **Unlocks**      | Delivery for every module that writes a notification row (ruling R10); broadcasts for MOD-15's "now open" message; N-templates named by MOD-03 to MOD-16                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

**What this document is for and when to open it.** It plans how 1minitman talks to people: the outbox
and delivery worker, push, e-mail, SMS and the in-app inbox, member preferences and quiet rules, the
template catalogue and its admin, broadcasts and announcements, delivery logs and the website
newsletter. Open it before you enqueue a notification from any module, add or change a template, or
touch `/v1/me/push-tokens`, `/v1/me/notification-preferences`, `/v1/me/activity`,
`/admin/v1/templates`, `/admin/v1/broadcasts` or `/public/v1/newsletter`. Section 2 says which small
part of this module must be built early, and where.

## 1. Outcome

- **Member.** The right message arrives once, on the channel the member allows, in their language,
  with a deep link to the right screen. Nothing private shows on a locked phone in discreet mode;
  nothing but security alerts makes a sound in quiet hours; billing and security messages cannot be
  switched off; marketing is off until the member consents [UF §15.20], [CN notif-rules]. D16 lists
  what happened and clears with one tap [INV D16].
- **Non-member.** A website visitor who joins the newsletter confirms by e-mail before anything is
  sent, and can leave with one click and no account [WEB W36].
- **Admin.** Staff edit templates and their wording, preview every channel and locale, test-send only
  to themselves, send broadcasts only after a second admin approves, run in-app announcements and
  read 90 days of delivery logs with parameters masked [ADM A25], [ADM A26].
- **Business.** No message is sent for a change that rolled back (outbox) [TR §4.2]. Bounces and
  complaints stop further mail [TR §12]. Consent for marketing is recorded and honoured [TR §16.2].

## 2. Scope

**In scope**

- The notification service: enqueue port, renderer, `notifications.deliver`, channel adapters for
  push (Expo), e-mail (Resend) and SMS (Termii), the in-app inbox, throttles, collapse, quiet hours,
  discreet mode, suppression [TR §11], [OD-06].
- Member API: `POST / DELETE /v1/me/push-tokens`, `GET / PUT /v1/me/notification-preferences`,
  `GET /v1/me/activity`, `POST /v1/me/activity/read-all` [TR §8.2].
- Webhooks `/webhooks/resend` (bounces, complaints) and delivery receipts on `/webhooks/termii`
  [TR §8.2], [TR §12].
- Templates N01–N36 and W01–W08 and every template added after them [DD §1].
- Admin A25 (templates, previews, test sends) and A26 (broadcasts, announcements, delivery logs).
- Mobile D16, NT1, NT2 (OS presentation), NT3 (e-mail layouts), NT4 (the catalogue as a generated
  reference), and the permission step behind C7.
- Website W36 newsletter and its endpoints. The form reuses the shared public form pipeline that
  MOD-14 builds in `MOD-14-API-05` (ruling R24); the master plan schedules that task ahead of
  `MOD-11-API-07` (ruling R25). The W36 pages are built after MOD-15's website gate (ruling R26).

**Out of scope (owned elsewhere)**

| Item                                                                                                   | Owner                                                                                                  |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `i18n_strings` API, `/comms/translations` pages, review and publish of strings                         | MOD-02 (ruling R11). A25's template pages call it to pick and check keys                               |
| The C7 primer screen itself, `PUT /v1/me/settings`, `POST /v1/consents`                                | MOD-03 (ruling R12); this module owns the token endpoint and the OS-permission logic behind the primer |
| One-time-code messages (OTP) and their send path                                                       | MOD-03; it uses the vendor senders defined here (section 2, slice A)                                   |
| Deciding when a notification is due (each trigger)                                                     | The module that owns the event; it enqueues by template code                                           |
| Trusted-contact SMS and replies (`trusted_contact_messages`)                                           | MOD-13; shown read-only in A26 logs                                                                    |
| Support chat messages                                                                                  | MOD-14 (N30 is delivered here)                                                                         |
| Newsletter and waitlist lists in the console (`/content/newsletter`), exports, "Send now-open message" | MOD-15 (A29); the message itself is a broadcast through this module                                    |
| Admin console bell (`admin_notifications`) and e-mail to staff                                         | MOD-01 ([MOD-01](1MM-EXE-MOD-01-ADMIN-ACCESS-AND-GOVERNANCE.md) GAP-MOD01-07)                          |
| Maintenance banner and website banner                                                                  | MOD-02, MOD-15 (ruling R13)                                                                            |
| Vendor cards, vendor health and failover (`vendor.health`)                                             | MOD-02                                                                                                 |

**Deferred**

| Item                               | Switch                                    | Decision           | Built now                                                                            |
| ---------------------------------- | ----------------------------------------- | ------------------ | ------------------------------------------------------------------------------------ |
| WhatsApp as a notification channel | No seeded template lists `whatsapp` [SQL] | **Recommendation** | The channel value and the adapter port; the adapter when the first template needs it |
| N33 incoming / missed call         | `calls.enabled` = false                   | [OD-20]            | Template stays seeded and inactive in practice: nothing enqueues it                  |
| Offer delivery messages            | `offers.enabled` = false                  | [OD-01]            | Nothing                                                                              |
| French UI strings                  | `locale.fr` = false                       | [SQL]              | Templates fall back to `en`                                                          |

**The minimal delivery pipeline and where it lands (rulings R10 and R21).** Other modules write notification
rows from MOD-03 onwards, and sign-up cannot work without e-mail. Three slices of this module are
therefore built early, API and worker only, each inside another module's window. No screen depends on
a stub (ruling R7).

| Slice                       | Lands in                                                                         | Tasks                                       | What exists afterwards                                                                                                                                                                                                          | Who needs it first                                           |
| --------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| A · Senders and outbox port | MOD-00, with its outbox helper and webhook intake                                | MOD-11-OPS-01, MOD-11-API-01                | `NotificationOutbox.enqueue()` (writes `notifications` in the caller's transaction); ports `EmailSender` (Resend adapter) and `SmsSender` (Termii adapter); `/webhooks/resend` and `/webhooks/termii` stored through the intake | MOD-03 one-time codes (direct send through the same senders) |
| B · Transactional delivery  | MOD-03, before its API gate                                                      | MOD-11-WRK-01                               | `notifications.deliver` v1: e-mail, SMS and in-app; rendering from `notification_templates` and the bundled `en` strings; required channels; dedupe; retries; `email_suppressions`                                              | N11, N18, N19 (MOD-03); then N12, N13, N29, N21, N35, N36    |
| C · Push and preferences    | After MOD-03's API gate, before MOD-03's C7 primer task and MOD-07's mobile work | MOD-11-API-02, MOD-11-API-03, MOD-11-WRK-02 | Push tokens, Expo adapter, preferences, quiet hours, discreet mode, throttles and collapse, D16 reads                                                                                                                           | C7 from D5 (MOD-07), N01–N07                                 |

Everything else (admin, broadcasts, announcements, the newsletter API, the mobile screens) is built
at this module's own position, except the W36 pages (`MOD-11-WEB-01`), which wait for MOD-15's
website gate (ruling R26), and the full template run (`MOD-11-QA-01`), which closes when the last
enqueuing module has shipped.

## 3. Data first

### 3.1 Data inventory

Every object was confirmed by grep in [SQL].

| Object                     | Purpose                                                                                                                                                                                                                                                                                                         | PII      | Retention                                 | Source                           |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------------------------------------- | -------------------------------- |
| `notification_categories`  | NT1 rows: `likes`, `msgs`, `groups`, `daily`, `news` (marketing), `account`, `billing`, `security`, `service`; `is_transactional`, `default_push`, `default_email`, `is_marketing`, `sort`                                                                                                                      | none     | permanent                                 | [DD §1], [SQL]                   |
| `notification_templates`   | Catalogue: `code` (`^[NW][0-9]{2}$`), `category_key`, `channels[]`, `required_channels[]` (subset of channels), `title_key`, `body_key`, `deep_link`, `email_template`, `throttle_rule` (text), `bypass_quiet_hours`, `is_active`, `version`                                                                    | none     | permanent                                 | [DD §1]                          |
| `push_tokens`              | Expo tokens per device: `token` unique, `platform`, `os_permission` (`granted`, `denied`, `provisional`), `is_active`, `invalidated_at`                                                                                                                                                                         | personal | until invalid                             | [DD §11]                         |
| `notification_preferences` | Category × channel switches; a missing row means the category default                                                                                                                                                                                                                                           | none     | account                                   | [DD §11]                         |
| `notifications`            | Outbox and delivery log: `template_code` or `broadcast_id`, `channel`, `locale`, `params`, `dedupe_key`, `collapse_key`, `status`, `scheduled_for`, `silent`, `provider`, `provider_msg_id`, `attempts`, `error`; non-members through `recipient_kind`, `recipient_enc`, `recipient_hash`, `recipient_ref_id`   | personal | 90 days                                   | [DD §11]                         |
| `inbox_items`              | D16 rows: `template_code`, `params`, `actor_user_id`, `deep_link`, `group_key`, `read_at`                                                                                                                                                                                                                       | personal | 180 days                                  | [DD §11]                         |
| `email_suppressions`       | `hard_bounce`, `complaint`, `unsubscribe_marketing`, `manual`                                                                                                                                                                                                                                                   | personal | permanent                                 | [DD §11]                         |
| `broadcast_campaigns`      | Audience, channels, template or content, schedule, `approval_id`, estimate, stats; statuses `draft`, `pending_approval`, `scheduled`, `sending`, `sent`, `cancelled`                                                                                                                                            | none     | 2 years                                   | [DD §13A]                        |
| `in_app_announcements`     | `title_key`, `body_key`, CTA, `placement[]` (`home_banner`, `inbox`), audience, window, `dismissible`, `priority`, `status`                                                                                                                                                                                     | none     | 2 years                                   | [DD §13A], [DD §13B]             |
| `newsletter_subscribers`   | `email_enc` + `email_hash`, `topics[]` (five allowed values), `locale`, `status` (`pending`, `confirmed`, `unsubscribed`, `bounced`, `complained`), `confirm_token_hash`, `manage_token_hash`, `last_confirm_sent_at`, consent text hash and version, `source_page`, `age_confirmed_at`, `campaign_code`, `src` | personal | unconfirmed 7 days; unsubscribe + 30 days | [DD §13A], [DD §13B], [TR §16.1] |
| `user_settings` (MOD-03)   | `discreet_mode`, `quiet_hours_enabled`, `quiet_hours_start`, `quiet_hours_end`                                                                                                                                                                                                                                  | none     | account                                   | [SQL]                            |
| `feature_waitlist`         | "Notify me" interest; launch notice sets `notified_at`                                                                                                                                                                                                                                                          | personal | 30 days after notice                      | [DD §11]                         |
| Read from other domains    | `profiles.timezone`, `users.locale`, `v_current_consents` (`marketing`), `consent_records` (kinds `push`, `marketing`), `webhook_events`, `trusted_contact_messages`                                                                                                                                            | personal | owning domain                             | [SQL]                            |
| Enums                      | `notif_channel_t` (`push`, `email`, `sms`, `whatsapp`, `in_app`), `delivery_status_t` (`queued`, `batched`, `throttled`, `sent`, `delivered`, `opened`, `failed`, `suppressed`), `subscriber_status_t`                                                                                                          | –        | –                                         | [SQL]                            |
| Views                      | `v_unread_counts` (`activity_unread` and the tab counts)                                                                                                                                                                                                                                                        | –        | –                                         | [DD §11]                         |
| RLS                        | `inbox_items` policy `inbox_own`. `notifications`, `push_tokens` and `notification_preferences` have none: the API filters by member                                                                                                                                                                            | –        | –                                         | [SQL]                            |
| Indexes relied on          | `idx_notifications_due`, `idx_notifications_broadcast`, `idx_inbox_user`, `idx_inbox_unread`, `idx_push_tokens_user`, `idx_broadcast_due`, `idx_announce_live`, `idx_newsletter_status`                                                                                                                         | –        | –                                         | [SQL]                            |
| Redis                      | `notif:throttle:{user_id}:{template}` (1 h likes batch, 24 h for N10), `badge:{user_id}` (60 s, deleted on change)                                                                                                                                                                                              | –        | –                                         | [DD §14]                         |

Seeds:

| Seed                  | Value                                                                                                                                                                                             | Source                |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| Templates             | N01–N22, N23–N36, W01–W08 with channels, deep links and throttle text; `required_channels = channels` for `account`, `billing`, `security`; `bypass_quiet_hours` true for N18, N19, N21, N25, N36 | [SQL]                 |
| `remote_config`       | `notifications.quiet_start` "23:00", `notifications.quiet_end` "07:00" (public); `notifications.broadcast_max_per_day` 1; `notifications.broadcast_rate_per_minute` 2000                          | [SQL]                 |
| `admin_permissions`   | `notifications.templates`, `notifications.broadcast` (approval), `notifications.read`, `announcements.manage`, `i18n.manage`, `newsletter.export`                                                 | [SQL], [ADM App. A.5] |
| `worker_jobs`         | `notifications.deliver` (continuous), `newsletter.purge`, `retention.purge`, `waitlist.notify_launch`                                                                                             | [SQL]                 |
| `rate_limit_policies` | `public.forms` (10 an hour per IP, plus bot check)                                                                                                                                                | [SQL]                 |
| `vendor_settings`     | `expo_push`, `resend`, `termii`, `twilio`, `whatsapp`                                                                                                                                             | [SQL]                 |
| `site_settings`       | `contacts` (role mailboxes), `company_facts`                                                                                                                                                      | [SQL], [OD-23]        |
| Not seeded            | No `i18n_strings` rows, so no template has wording ([MOD-00](1MM-EXE-MOD-00-FOUNDATIONS.md) GAP-MOD00-03; GAP-MOD11-05)                                                                           | [SQL]                 |

### 3.2 UI against data

**Mobile**

| Screen | Element                                                                    | Data                                                                                                                                         | Endpoint                                                                                                | Admin control                                                                               |
| ------ | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| C7     | Primer "Know the moment someone likes you"; Turn on notifications; Not now | OS prompt result → `push_tokens.os_permission`; consent kind `push`                                                                          | `POST /v1/me/push-tokens`; `POST /v1/consents` (MOD-03)                                                 | Copy in A25 translations                                                                    |
| C7     | Discreet mode suggested on the primer [CN notif-rules]                     | `user_settings.discreet_mode`                                                                                                                | GAP-MOD11-03 (which endpoint writes it)                                                                 | –                                                                                           |
| D16    | Rows grouped Today / Earlier, unread mark                                  | `inbox_items` (`created_at`, `read_at`, `template_code`, `params`, `actor_user_id`, `group_key`), rendered from the template's i18n keys     | `GET /v1/me/activity`                                                                                   | Wording through the template keys (A25)                                                     |
| D16    | Row tap → D5, D7, D13, H8, BL1, PM4, NT1 [INV D16]                         | `inbox_items.deep_link` (screen code)                                                                                                        | same                                                                                                    | `notification_templates.deep_link` (A25)                                                    |
| D16    | "Mark all read"                                                            | `read_at`; `badge:{user_id}` deleted                                                                                                         | `POST /v1/me/activity/read-all`                                                                         | –                                                                                           |
| D16    | Announcement card (placement `inbox`)                                      | `in_app_announcements`                                                                                                                       | GAP-MOD11-04                                                                                            | A26 announcements                                                                           |
| D16    | Known copy error "Your Black Badge renews in 3 days" [TR §18.3]            | A Black Badge never renews; N26 is for plans                                                                                                 | –                                                                                                       | Board fix; the template text decides                                                        |
| NT1    | One row per category with channel switches                                 | `notification_categories` in `sort` order; `notification_preferences`; defaults `default_push`, `default_email`                              | `GET / PUT /v1/me/notification-preferences`                                                             | Category labels (`label_key`) in A25 translations; categories change by migration           |
| NT1    | Billing and Security locked on                                             | `is_transactional`; template `required_channels`                                                                                             | same (write refused)                                                                                    | A25 (dropping a required channel needs approval)                                            |
| NT1    | "Tips and offers" off by default, needs consent                            | `news.is_marketing`; consent kind `marketing`                                                                                                | `PUT` preferences + `POST /v1/consents`                                                                 | –                                                                                           |
| NT1    | Quiet hours switch and times; discreet mode                                | `user_settings.quiet_hours_enabled`, `_start`, `_end`, `discreet_mode`; defaults `notifications.quiet_start` / `_end`                        | GAP-MOD11-03                                                                                            | Defaults in A31 remote config                                                               |
| NT1    | State "Off in phone settings", "Open settings"                             | `push_tokens.os_permission = 'denied'`; live OS status on the device                                                                         | `POST /v1/me/push-tokens` reports the status                                                            | –                                                                                           |
| NT1    | "Preview how notifications look" → NT2                                     | Static preview built from template keys                                                                                                      | –                                                                                                       | –                                                                                           |
| NT2    | Lock-screen sets: Matches; Billing and security; Discreet mode             | Title and body keys; discreet text "1minitman · You have a new notification" [CN notif-rules]; `i18n_strings.max_length` as the length limit | Push payload from the worker                                                                            | A25 preview                                                                                 |
| NT3    | E-mail layouts for N11, N12, N13, N14, N15, N16, N18, N20                  | `notification_templates.email_template` (MJML name); body keys; registered-entity footer                                                     | Worker render                                                                                           | A25 e-mail preview. 25 templates carry an `email_template`; the board shows 8: GAP-MOD11-05 |
| NT4    | Catalogue                                                                  | Generated from `notification_templates`; the board shows the first 22 [UF §15.20]                                                            | `GET /admin/v1/templates` (it is a reference board, not an app screen: the inventory gives it no route) | A25                                                                                         |

**Admin**

| View                  | Elements                                                                                                     | Tables                                                                                                                   | Result                                                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| A25 templates list    | Code, category, channels, trigger, deep link, throttle, bypass, active, locales ready, sent 7 days           | `notification_templates`, `i18n_strings.status` per locale, `notifications` counts                                       | Covered. The acceptance text says "22 seeded templates" and code `^N[0-9]{2}$`; 44 are seeded and W-codes exist [SQL]: test for 44 |
| A25 detail and edit   | Channels, required channels, keys, deep link, MJML name, throttle, bypass (security only), active, version   | same                                                                                                                     | Throttle is free text: GAP-MOD11-01                                                                                                |
| A25 preview           | Push (normal and discreet), e-mail, SMS with segment count, WhatsApp, in-app row; en / pcm / fr; ICU plurals | keys through MOD-02's i18n API                                                                                           | Covered                                                                                                                            |
| A25 test send         | "[TEST]" to the admin's own test device or e-mail                                                            | `admin_users.email` for e-mail                                                                                           | No place stores an admin's test device: GAP-MOD11-02                                                                               |
| A26 broadcast builder | Category, audience filters, per-channel and per-locale message, schedule, estimate, approval                 | `broadcast_campaigns` (`audience`, `channels`, `template_code` or `content`, `scheduled_for`, `estimate`, `approval_id`) | Covered                                                                                                                            |
| A26 results           | Sent, delivered, opened, failed, suppressed by channel and locale                                            | `notifications` on `idx_notifications_broadcast`; `broadcast_campaigns.stats`                                            | Covered                                                                                                                            |
| A26 announcements     | Keys, CTA, audience, placement, window, dismissible, priority                                                | `in_app_announcements`                                                                                                   | Covered for editing; member delivery and dismissal: GAP-MOD11-04                                                                   |
| A26 logs              | Notifications, e-mail suppressions, trusted-contact messages                                                 | `notifications`, `email_suppressions`, `trusted_contact_messages`                                                        | Covered. `DELETE /email-suppressions/:email` puts an address in the path: see section 11                                           |

**Website**

| Module                                      | Element                                                  | Data                                                                         | Endpoint                                                      | Result                                              |
| ------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------- |
| W36 form                                    | E-mail, topics, locale, 18+ tick, consent text, honeypot | `newsletter_subscribers` columns in 3.1                                      | `POST /public/v1/newsletter`                                  | Covered                                             |
| W36 block copy                              | Title, body, topic labels, default topics                | CMS block `newsletter_signup` (MOD-15)                                       | `GET /public/v1/pages/{slug}`                                 | Covered; topic keys fixed by `ck_newsletter_topics` |
| W36 confirm, preferences, unsubscribe pages | Token pages, states                                      | `confirm_token_hash`, `manage_token_hash`, `status`                          | Paths exist only under the stale `/web/v1` list: GAP-MOD11-06 | –                                                   |
| W36 confirmation e-mail                     | Template W03, once per address per 24 h                  | `last_confirm_sent_at`; `notifications` with `recipient_kind = 'newsletter'` | worker                                                        | Covered                                             |
| Newsletter issues                           | Sending to subscribers                                   | No admin flow or audience exists: GAP-MOD11-07                               | –                                                             | –                                                   |

### 3.3 Assets

- Push uses the app icon and name; no custom sound ships: only `match-chime` and `call-start` exist
  and both play in-app [TR §2.5]. Haptics on the device follow the OS for pushes; in-app, `selection`
  on switches and "Mark all read" [TR §2.5].
- E-mail: Ink header with the white wordmark, one CTA, registered-entity footer [ADM A25]; logo files
  from the brand logo pack; MJML layouts named by `email_template` [INV NT3].
- D16 actor avatars are members' own photos; the board avatars are placeholders.
- Tokens: colour, type and the 44 px target from `packages/tokens`; light and dark for D16, NT1 and
  the previews [ADM A25].

### 3.4 Dynamic content and constants

| Constant                                                                                 | Lives in                                                                                                                                                                   | Changed by                                                                   | Reaches clients through                    |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------ |
| Template channels, required channels, deep link, throttle, quiet-hours bypass, active    | `notification_templates`                                                                                                                                                   | A25, `notifications.templates` (reason); approval to drop a required channel | Worker reads at send time                  |
| Template wording, category labels, discreet text, e-mail body text                       | `i18n_strings` keys                                                                                                                                                        | A25 translations (MOD-02), `i18n.manage`; reviewer ≠ last editor             | i18n catalogue; worker renders server-side |
| Quiet-hours defaults                                                                     | `notifications.quiet_start`, `notifications.quiet_end`                                                                                                                     | A31 remote config                                                            | `GET /v1/config` (public keys)             |
| Broadcast cap per member per day, send-rate ceiling                                      | `notifications.broadcast_max_per_day`, `notifications.broadcast_rate_per_minute`                                                                                           | A31                                                                          | Server only                                |
| Throttle windows (1 an hour, once a day at 18:00 local)                                  | Free text in `throttle_rule`; the numbers are not data                                                                                                                     | GAP-MOD11-01                                                                 | –                                          |
| Retry count and backoff for delivery                                                     | Not in any table                                                                                                                                                           | GAP-MOD11-08                                                                 | –                                          |
| Sender addresses                                                                         | `site_settings.contacts`; vendor card `resend` (A31). The canvas note's billing@ / hello@ senders are superseded: one mailbox with aliases [OD-23], sender help@ [DDR B78] | A28, A31                                                                     | Server only                                |
| Newsletter topics                                                                        | CHECK `ck_newsletter_topics` (migration); labels in the CMS block                                                                                                          | Migration; A28                                                               | Site build                                 |
| Newsletter timings (24 h re-send, 7-day and 30-day purges)                               | Fixed in [WEB W36] and job descriptions; no config key                                                                                                                     | GAP-MOD11-08                                                                 | –                                          |
| Admin console constants: log default range 24 h, progress refresh 10 s, estimate wording | Console i18n catalogue (`admin.` keys, GAP-MOD02-10)                                                                                                                       | A25                                                                          | Admin bundle                               |

## 4. API (built first)

### 4.1 Endpoints

Problem types and statuses follow [1MM-STD-13](../standards/1MM-STD-13-ERROR-CODES.md); the code
in each cell is the registered `reason`. Analytics names
are proposed under the `screen.action` rule; MOD-18 publishes the catalogue (ruling R17). Website event
names are from [WEB §3.11].

**Member and public**

| Method and path                                             | Auth · gate   | Request → response                                                                                              | Errors                                                                                                                  | Idempotency · rate limit                                                                               | Analytics (proposed)                              |
| ----------------------------------------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------- |
| `POST /v1/me/push-tokens`                                   | M             | Expo token, platform, device, `os_permission` → token row                                                       | 422 `validation` (bad token)                                                                                            | Upsert on `token`                                                                                      | `c7.permission.granted`, `c7.permission.denied`   |
| `DELETE /v1/me/push-tokens`                                 | M             | token → 204                                                                                                     | –                                                                                                                       | Idempotent                                                                                             | –                                                 |
| `GET /v1/me/notification-preferences`                       | M             | → categories in `sort` order with channel values, lock flags, quiet hours, discreet mode, OS-permission summary | –                                                                                                                       | –                                                                                                      | `nt1.view`                                        |
| `PUT /v1/me/notification-preferences`                       | M             | category × channel values (and the quiet-hours block, GAP-MOD11-03) → saved                                     | 409 `category_locked` (locked category or required channel); 403 `consent_missing` (`news` without `marketing` consent) | Idempotent                                                                                             | `nt1.toggle`                                      |
| `GET /v1/me/activity`                                       | M             | cursor → inbox items with rendered title, body, deep link, actor, unread count                                  | –                                                                                                                       | Keyset on `idx_inbox_user`                                                                             | `d16.view`                                        |
| `POST /v1/me/activity/read-all`                             | M             | → 204                                                                                                           | –                                                                                                                       | Idempotent                                                                                             | `d16.read_all`                                    |
| `POST /public/v1/newsletter`                                | P · bot check | e-mail, topics, locale, age tick, consent text version, source page → 202 with the same body for every address  | 422 `validation`; 503 `maintenance`                                                                                     | Idempotency key header [WEB §5.10]; `public.forms`; through the shared form pipeline (`MOD-14-API-05`) | `newsletter_submitted`                            |
| Newsletter confirm, preferences, unsubscribe (GAP-MOD11-06) | P · token     | token (+ topics, locale) → state                                                                                | 404 `not_found`, 410 `expired` (named `token_invalid`, `token_expired` in [WEB §5.10])                                  | Idempotent; `public.forms`                                                                             | `newsletter_confirmed`, `newsletter_unsubscribed` |

**Webhooks (`/webhooks`, auth W)**

| Path                    | Events                                  | Effect                                                                                                         |
| ----------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `POST /webhooks/resend` | delivered, bounced, complained [TR §12] | `notifications.status`; `email_suppressions` (`hard_bounce`, `complaint`); newsletter `bounced` / `complained` |
| `POST /webhooks/termii` | delivery receipts [TR §12]              | `notifications.status` for SMS. Inbound YES / STOP from trusted contacts is routed to MOD-13                   |

**Admin (`/admin/v1`, auth A)** [ADM A25], [ADM A26]

| Path                                                                              | Permission                                                           | Audit event                                        |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------- |
| `GET /templates`, `GET /templates/:code`                                          | `notifications.templates`                                            | read                                               |
| `PATCH /templates/:code`, create                                                  | `notifications.templates` (reason)                                   | `template.update`, `template.create`               |
| `POST /templates/:code/preview`                                                   | `notifications.templates`                                            | –                                                  |
| `POST /templates/:code/test-send`                                                 | `notifications.templates`                                            | `template.test_send`                               |
| `GET\|POST /broadcasts`, `PATCH /broadcasts/:id`, `POST /broadcasts/:id/estimate` | `notifications.templates`                                            | `broadcast.create`, `broadcast.update`             |
| `POST /broadcasts/:id/schedule`                                                   | `notifications.broadcast` (reason, approval)                         | `broadcast.schedule.request`, `broadcast.schedule` |
| `POST /broadcasts/:id/cancel`                                                     | `notifications.broadcast`                                            | `broadcast.cancel`                                 |
| `GET\|POST\|PATCH /announcements`                                                 | `announcements.manage` (reason; approval for an all-member audience) | `announcement.create\|update\|end`                 |
| `GET /notifications/logs`                                                         | `notifications.read`                                                 | read                                               |
| `GET\|DELETE /email-suppressions/:email`                                          | `notifications.read`; removal `notifications.templates` (reason)     | `email_suppression.remove`                         |

### 4.2 Realtime, jobs and webhooks

**Realtime.** When an inbox item is written the worker deletes `badge:{user_id}` and publishes on
`ch:user:{user_id}` so D16 and the tab badges refresh [DD §14]. Which response carries the counts is
[MOD-00](1MM-EXE-MOD-00-FOUNDATIONS.md) GAP-MOD00-06. Admin: broadcast progress refreshes every 10 s
[ADM A26].

**Enqueue port (the only way any module sends).**
`NotificationOutbox.enqueue({ templateCode, recipient, params, dedupeKey?, collapseKey?, scheduledFor?, locale? })`
runs inside the caller's transaction and writes one `notifications` row per channel of the template
[TR §4.2]. A member recipient is a `user_id`; a non-member is `recipient_kind` plus an encrypted address
and its hash [DD §11].

| Job                                                                            | Schedule                          | Work                                                                                                                                                                                                                                                                   | Source     |
| ------------------------------------------------------------------------------ | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `notifications.deliver`                                                        | continuous                        | Claims due rows on `idx_notifications_due`; applies preferences, required channels, consent, suppression, throttle, collapse, quiet hours and discreet mode; renders; sends through the adapter; writes the inbox row; records status, provider id, attempts and error | [TR §11]   |
| Broadcast fan-out (part of `notifications.deliver`; no separate job is seeded) | on approval or at `scheduled_for` | Resolves the audience, writes one row per recipient and channel with `dedupe_key = broadcast:{id}` under the rate ceiling; updates `stats`                                                                                                                             | [ADM A26]  |
| `newsletter.purge`                                                             | daily                             | Unconfirmed after 7 days; unsubscribed after 30 days                                                                                                                                                                                                                   | [TR §11]   |
| `retention.purge` (MOD-16 owns the job)                                        | daily                             | `notifications` at 90 days, `inbox_items` at 180 days                                                                                                                                                                                                                  | [TR §16.1] |
| `waitlist.notify_launch` (MOD-15 triggers)                                     | on approval                       | Queues W02 through this module                                                                                                                                                                                                                                         | [TR §11]   |

Templates and the module that enqueues each (this module re-verifies every caller in its exit gate,
ruling R10):

| Templates                    | Enqueued by                            |
| ---------------------------- | -------------------------------------- |
| N11, N18, N19                | MOD-03                                 |
| N12, N13, N29                | MOD-06                                 |
| N01, N02, N03, N09, N10, N34 | MOD-07                                 |
| N04–N07, N33 (deferred)      | MOD-08                                 |
| N21, N22, N28, N35, N36      | MOD-05, MOD-09                         |
| N14–N17, N26                 | MOD-10                                 |
| N08, N31, N32                | MOD-12                                 |
| N23, N24, N25                | MOD-13                                 |
| N30                          | MOD-14                                 |
| N20, N27                     | MOD-16                                 |
| W01, W02, W04–W08            | MOD-15 (W05 with MOD-14's safety form) |
| W03                          | This module                            |

Templates other modules have asked for and the catalogue lacks: one-time-code and "sign-in method
added" (GAP-MOD03-07), media rejected and prompt removed (GAP-MOD04-06), ban and unban (GAP-MOD05-04),
staff e-mail (GAP-MOD01-07). When the owner accepts them they are added here by migration with codes
from N37; A25's "new templates: code N23–N99" [ADM A25] is read as N37–N99.

### 4.3 Rules the API must enforce

1. A notification row is written in the same transaction as the change that causes it; nothing is
   sent for a rolled-back change [TR §4.2].
2. One send per `dedupe_key`; a replayed job or broadcast never reaches the same member twice
   [DD §11], [ADM A26].
3. An inbox row is written for every push [SQL `inbox_items` comment].
4. Preferences are per category × channel; a missing row means the category default [SQL].
5. Billing and security (and every template's `required_channels`) cannot be switched off by the
   member [UF §15.20], [DD §1].
6. Marketing (`news`) is off by default and needs a current `marketing` consent as well as the
   switch; every marketing e-mail carries an unsubscribe link [CN notif-rules], [ADM A26].
7. Quiet hours (member's `user_settings`, defaults 23:00–07:00 in the member's time zone): pushes are
   delivered silently, except templates with `bypass_quiet_hours`; marketing broadcasts wait until
   quiet hours end [SQL `notifications` comment], [ADM A26].
8. Only `security` templates may bypass quiet hours [ADM A25].
9. Discreet mode replaces the push title and body with the fixed discreet text [CN notif-rules].
10. Throttles: likes batched to at most 1 an hour; chat messages collapsed per thread; N10 at most
    once a day at 18:00 local; N16 exactly 24 h before the charge [UF §15.20], [DDR B27].
11. Push permission is asked in context at the first match, not during sign-up [TR §2.2].
12. A token the provider reports as invalid is deactivated (`invalidated_at`) and not retried
    [SQL `push_tokens`].
13. A hard bounce or complaint adds a suppression; suppressed addresses get no mail, except that
    transactional mail still goes to `unsubscribe_marketing` addresses [SQL `email_suppressions`].
14. Locale: the member's locale; a missing translation falls back to `en` and is marked [ADM A25].
15. A broadcast cannot be scheduled, sent or marked sent without an approval by a second admin; the
    estimate is shown in the approval [ADM A26], [SQL].
16. Broadcast exclusions always apply: suspended, banned, deletion pending, opted out, no marketing
    consent for `news`, suppressed e-mail; at most `notifications.broadcast_max_per_day` per member;
    send rate under `notifications.broadcast_rate_per_minute` [ADM A26].
17. Security templates are never used by broadcasts; transactional categories are not used for
    marketing content [ADM A26].
18. An announcement to all members needs an approval [SQL `in_app_announcements`].
19. Test sends go only to the requesting admin's own destination, prefixed "[TEST]" [ADM A25].
20. Delivery logs show 90 days and mask parameters; trusted-contact logs never show bodies [ADM A26].
21. Newsletter: no address is on a sending list before confirmation; the response is identical
    whether or not the address exists; the confirmation is re-sent at most once per 24 h; the token
    expires after 7 days; unsubscribe is one click with no login and the mail carries
    `List-Unsubscribe` and `List-Unsubscribe-Post` headers [WEB W36], [WEB §5.7].
22. Non-member addresses are stored encrypted with a hash for dedupe; logs never hold them in clear
    [DD §11], [TR §6.1].
23. Message bodies, codes and tokens are never written to application logs [TR §14].

### 4.4 Contract deliverables

| Package                   | Deliverable                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/contracts`      | Schemas and routes for 4.1 on `/v1`, `/public/v1`, `/admin/v1`, `/webhooks`; the template-code and channel enums; the push payload shape (title, body, `deep_link`, `collapse_key`, `silent`); the one map from screen codes to app routes (the deep-link map, [1MM-STD-18](../standards/1MM-STD-18-NOTIFICATIONS.md) §7.2), which the worker, the API and the mobile app all import; regenerated clients |
| `packages/db`             | Drizzle models for 3.1; migrations for accepted gaps (throttle column, test destinations, dismissals, config keys); `worker_jobs.cron` values for this module's jobs (ruling R20)                                                                                                                                                                                                                         |
| `packages/i18n`           | Keys `n01.title` … `n36.body`, `w01.title` … `w08.body`, `ncat.*`, the discreet text, NT1 and D16 copy, in `en`; `pcm` and `fr` after native review                                                                                                                                                                                                                                                       |
| `packages/entitlements`   | Nothing: this module has no plan gate [UF §15.20]                                                                                                                                                                                                                                                                                                                                                         |
| `apps/api`, `apps/worker` | Module `notifications` with ports `NotificationOutbox`, `PushSender` (Expo), `EmailSender` (Resend), `SmsSender` (Termii), `WhatsAppSender` (port only); MJML layouts under the worker's templates folder                                                                                                                                                                                                 |

## 5. Admin: what it consumes and how

| Route                                        | Module | Consumes                                                                       | Notes                                                                                |
| -------------------------------------------- | ------ | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `/comms/templates`, `/comms/templates/:code` | A25    | template endpoints; MOD-02's `GET /i18n` to pick keys and show "Locales ready" | Required-channel change opens an approval; bypass switch disabled outside `security` |
| Preview and test send                        | A25    | `preview`, `test-send`                                                         | Side by side per locale and channel; light and dark; ICU errors with line and column |
| `/comms/translations`                        | A25    | Built by MOD-02 (ruling R11)                                                   | Linked from each template's keys                                                     |
| `/comms/broadcasts[/new\|/:id]`              | A26    | broadcast endpoints, approvals (MOD-01)                                        | Five steps; the audience builder is a form; estimate must be fresh before submit     |
| `/comms/announcements`                       | A26    | announcement endpoints                                                         | Distinct from maintenance and website banners                                        |
| `/comms/logs`                                | A26    | logs, suppressions, trusted-contact messages                                   | Default range 24 h; exact-match search for a masked e-mail                           |

States: missing locale, ICU error, pending publish, audience empty, estimate stale, approval pending,
sending, cancelled [ADM A25], [ADM A26]. Editing needs ≥ 1024 px; results and logs read on a phone.
Member 360 "notifications" tab (A10, MOD-05) reads this module's logs and preferences; it is verified
here (ruling R6).

## 6. Web: website and billing web app

- **W36 (`apps/site`).** The sign-up block (inline in the footer, journal articles and its own
  placements), and three token pages: `/newsletter/confirm`, `/newsletter/preferences`,
  `/newsletter/unsubscribe` [WEB W36]. States: submitted, confirmed, already subscribed (same message
  as submitted), expired token, unsubscribed. The pages are excluded from indexing [WEB §3.9]. Forms
  work without client-side script where possible and follow the maintenance rule (503) [WEB §5.10].
- **Billing web app.** No screen. Web-billed members receive N14–N17 and N26 by e-mail.

## 7. Mobile: what it adapts and uses

| Flow       | Screens                                                                                               | States                                                                                                  |
| ---------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Permission | D5 "Get notified when Zara replies" → C7 primer (MOD-03) → OS prompt → back to D5                     | Granted, denied, provisional (iOS), "Not now" (ask again only in context)                               |
| Activity   | D16                                                                                                   | Loading (skeleton after 300 ms), empty, error, offline (last loaded list), content with Today / Earlier |
| Settings   | D16 or D17 → NT1 → NT2 preview                                                                        | OS permission allowed or "Off in phone settings"; locked rows; saving; offline (switches disabled)      |
| Push tap   | Deep link to D5, D7, D9, D13, MF1, MF2, MF6, B11, B4, BL5–BL7, AS1, AS5, PM5, PM6, H2, H7 [UF §15.20] | Signed out → sign in then continue; target gone → D16                                                   |

- **Token lifecycle.** Register after grant, on every launch if changed, and on sign-in; delete on
  sign-out. Follow [1MM-STD-18](../standards/1MM-STD-18-NOTIFICATIONS.md).
- **Foreground.** A push for the open chat is not shown; the inbox row is still written.
- **Restricted or suspended members.** Still receive account, billing and security messages; deep
  links land on the account-state screen (MOD-05).
- **Gating.** None [UF §15.20].
- **Accessibility.** Switches have labels and state; locked rows say why; unread is not colour only;
  D16 rows are one focus stop with the full sentence [TR §2.4].
- **Phone and tablet.** D16 and NT1 use a readable column on tablets; NT2 previews scale with text
  size. Follow [1MM-STD-03](../standards/1MM-STD-03-MOBILE-BUILD-STRATEGY.md).

## 8. Work breakdown (strict order)

**API gate.** Before any admin, site or mobile task of this module: contracts merged and clients
generated; `pnpm check` green; rules 1–23 tested; a push, an e-mail and an SMS delivered on staging
through the real vendors' test modes; a Resend bounce creates a suppression. Slices A to C are API and
worker only and have no client tasks. The master plan schedules every task: slice A with MOD-00,
slice B before MOD-03's API gate, slice C after it (ruling R21); `MOD-14-API-05` ahead of
`MOD-11-API-07` (ruling R25); `MOD-11-WEB-01` after MOD-15's website gate (ruling R26); and
`MOD-11-QA-01` when the last enqueuing module has shipped.

| #   | Task                                        | Builds                                                                                                                        | Needs                                                                          | Done when                                                        |
| --- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| 1   | MOD-11-OPS-01                               | Vendor accounts and test credentials: Resend domain (SPF, DKIM, DMARC), Termii sender, Expo push credentials for APNs and FCM | MOD-00 environments                                                            | A test message leaves each vendor from staging                   |
| 2   | MOD-11-API-01 (slice A, in MOD-00's window) | `NotificationOutbox.enqueue()`, `EmailSender`, `SmsSender`, webhook routes through the intake                                 | MOD-00 outbox helper and intake                                                | Rule 1 proven with a rolled-back transaction                     |
| 3   | MOD-11-WRK-01 (slice B, in MOD-03's window) | `notifications.deliver` v1: e-mail, SMS, in-app; renderer; required channels; dedupe; retries; suppression                    | API-01, MOD-02 i18n                                                            | N11, N18, N19 delivered; rules 2, 3, 5, 13, 14, 22, 23           |
| 4   | MOD-11-API-02 (slice C)                     | Push tokens; `PushSender` (Expo)                                                                                              | MOD-03 API gate                                                                | Rules 11, 12                                                     |
| 5   | MOD-11-API-03 (slice C)                     | Preferences, quiet hours, discreet mode; activity read and read-all                                                           | API-02, GAP-MOD11-03                                                           | Rules 4–9                                                        |
| 6   | MOD-11-WRK-02 (slice C)                     | Throttle, batch and collapse; quiet-hours scheduling; push receipts                                                           | API-03, GAP-MOD11-01                                                           | Rule 10 with a moved clock                                       |
| 7   | MOD-11-DB-01                                | Migrations for accepted gaps; wording for every template key in `en`; `worker_jobs.cron`                                      | Gap dispositions                                                               | 44 templates render in `en` with no missing key                  |
| 8   | MOD-11-API-04                               | Admin templates, preview, test send                                                                                           | MOD-01, MOD-02                                                                 | Rules 8, 19                                                      |
| 9   | MOD-11-API-05                               | Broadcasts, fan-out, estimate, cancel; announcements                                                                          | API-04, approvals                                                              | Rules 15–18                                                      |
| 10  | MOD-11-API-06                               | Delivery logs, suppressions                                                                                                   | API-04                                                                         | Rule 20                                                          |
| 11  | MOD-11-API-07                               | Newsletter endpoints on the shared public form pipeline, W03, `newsletter.purge`                                              | `MOD-14-API-05` (rulings R24, R25), GAP-MOD11-06                               | Rule 21                                                          |
| 12  | MOD-11-ADM-01                               | A25 templates                                                                                                                 | API gate                                                                       | [ADM A25] checklist (44 templates)                               |
| 13  | MOD-11-ADM-02                               | A26 broadcasts, announcements, logs                                                                                           | ADM-01                                                                         | [ADM A26] checklist                                              |
| 14  | MOD-11-WEB-01                               | W36 block and token pages                                                                                                     | API gate; MOD-15's website gate: its API gate and `MOD-15-WEB-01` (ruling R26) | [WEB W36] acceptance items                                       |
| 15  | MOD-11-MOB-01                               | Token lifecycle, push handling, deep-link routing from the map in `packages/contracts`                                        | API gate                                                                       | Every deep link in section 7 opens its screen on iOS and Android |
| 16  | MOD-11-MOB-02                               | D16                                                                                                                           | MOB-01                                                                         | States in section 7                                              |
| 17  | MOD-11-MOB-03                               | NT1 and the NT2 preview                                                                                                       | MOB-01                                                                         | Locked rows; OS-off state                                        |
| 18  | MOD-11-QA-01                                | Re-verify every enqueuing module's templates end to end; native review of `pcm` (and `fr` when its flag turns on)             | All; earlier modules                                                           | One recorded delivery per template and channel                   |

## 9. Tests

| Layer  | Expected                                                                                                                 | Unexpected                                                                                                                                                                                                               | When variables change                                                                                                                                                                                                                           |
| ------ | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API    | Register a token; change a preference; list and clear activity; newsletter sign-up → confirm → preferences → unsubscribe | Switching off a locked category; `news` on without consent; another member's inbox item (RLS); expired or reused newsletter token; the same address submitted twice in 24 h; malformed push token; forged Resend webhook | Locale en / pcm / fr and a missing translation; role and account state (restricted, suspended, deletion pending); `is_active` false on a template; required channels changed                                                                    |
| Worker | Each template delivered once per channel; likes batched; chat collapsed; N10 at 18:00 local; N16 24 h before the charge  | Job run twice; crash between send and status write; vendor timeout and 5xx; invalid token; bounce; complaint; member erased while a row is queued; 10,000-recipient broadcast cancelled half-way                         | Quiet hours on, off, crossing midnight, changed by the member mid-queue; member time zone and daylight-saving change; discreet mode; `notifications.quiet_start` / `_end`; broadcast cap and rate; vendor failover; two workers on the same row |
| Admin  | Each acceptance item of [ADM A25], [ADM A26]                                                                             | Missing permission; requester approving their own broadcast; stale estimate; test send to another person's address                                                                                                       | Role `content_editor` vs `support`; tablet width; light and dark; audience with only `pcm` members                                                                                                                                              |
| Site   | The [WEB W36] acceptance items; one-click unsubscribe from a mail client                                                 | Bot submission (honeypot, bot check); 11th submission in an hour; maintenance mode                                                                                                                                       | Locale; script disabled; narrow viewport                                                                                                                                                                                                        |
| Mobile | Permission flow from D5; push tap to each target; D16 and NT1 states                                                     | Permission denied then enabled in OS settings; push while signed out; push for a deleted target; token rotated by the OS                                                                                                 | iOS and Android; phone and tablet; text size at maximum; foreground, background and killed app; offline                                                                                                                                         |

Adjustable thresholds under test: the four `notifications.*` config keys, each member's quiet hours,
each template's channels and throttle. Edge cases named above are required test cases.

## 10. Exit gate

- [ ] API gate (section 8) green before the first client task.
- [ ] Slices A, B and C were delivered in the windows named in section 2 and are unchanged in contract.
- [ ] Acceptance checklists of [ADM A25] and [ADM A26] ticked, read as 44 templates and codes N and W.
- [ ] [WEB W36] acceptance criteria ticked; [WEB §8] newsletter items pass on staging with test data.
      This item stays open until `MOD-11-WEB-01` has run after MOD-15's website gate (ruling R26).
- [ ] Every rule in 4.3 has a passing test named after its number.
- [ ] Every template in the table of section 4.2 delivered once, end to end, from its owning module's
      real trigger (ruling R10), on each of its channels, in `en` and `pcm`.
- [ ] `pcm` wording reviewed by a native speaker and marked `reviewed` by someone other than the
      editor; `fr` likewise before `locale.fr` is turned on [ADM A25].
- [ ] Discreet-mode and quiet-hours behaviour recorded on a locked iOS and Android device.
- [ ] No broadcast row exists without an approval; a cancelled broadcast sends nothing further.
- [ ] Member 360 notifications tab verified against real data (ruling R6).
- [ ] Logs hold no message body, code, token or clear non-member address [TR §14].
- [ ] Every admin write appears in the audit log with the names in 4.1.

## 11. Risks and open questions

| Risk or question                                                                         | Effect                                          | Handling                                                                                                                            |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| No wording exists for any template until strings are seeded                              | Nothing can be sent in production               | GAP-MOD11-05 with GAP-MOD00-03; DB-01 loads `en`                                                                                    |
| Delivery is built in three early slices inside other modules' windows                    | Drift between this plan and what is built early | The slices keep this module's task ids; the exit gate re-checks them                                                                |
| SMS cost and delivery in Nigeria                                                         | Spend, missed messages                          | Only W01 and W02 list `sms` at launch [SQL]; push and e-mail first; alert on delivery failure rate [TR §14]                         |
| Free vendor tiers [OD-06] have send limits                                               | Broadcasts throttled or rejected                | The rate ceiling is config; a broadcast larger than the remaining daily allowance is split over days (**Recommendation**)           |
| Expo reports delivery through receipts fetched later, not a webhook                      | `delivered` lags `sent`                         | WRK-02 polls receipts; invalid tokens are deactivated                                                                               |
| `email_suppressions.email` is clear text while non-member addresses are stored encrypted | Inconsistent protection of the same address     | **Recommendation:** key suppressions by hash in a later migration; raise with [1MM-DB-06](../database/1MM-DB-06-DATA-PROTECTION.md) |
| `DELETE /email-suppressions/:email` puts an address in a URL path [ADM A26]              | Address in access logs                          | **Recommendation:** send it in the body or use the row's hash                                                                       |
| `notifications`, `push_tokens` and `notification_preferences` have no RLS policy         | A missing filter leaks rows                     | Repository tests assert the member filter; policy proposal goes to [1MM-DB-05](../database/1MM-DB-05-SECURITY.md)                   |
| Should NT1 show the transactional `account` and `service` categories as locked rows?     | Board and data differ in row count              | Render every category from the table; confirm on the board                                                                          |
| D16 copy error about the Black Badge "renewing" [TR §18.3]                               | Wrong promise                                   | The template wording, not the board, is the source                                                                                  |

## 12. Gaps raised

Dispositions are recorded in [1MM-LOG-03](../1MM-LOG-03-TECHNICAL-REFERENCE-EXTENSIONS.md)
(Technical Reference and schema), [1MM-LOG-02](../1MM-LOG-02-UI-UPDATES.md) (UI) and
[1MM-LOG-04](../1MM-LOG-04-OPEN-DECISIONS-AND-FOLLOW-UPS.md) (owner decisions and repository
follow-ups).

| Gap id       | Type       | Where found                                                       | What is missing or conflicting                                                                                                                                                                                     | Proposed resolution                                                                                                                                                                                                                                                                                                                                                                                          | Blocks                                   |
| ------------ | ---------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------- |
| GAP-MOD11-01 | SCHEMA     | [SQL `notification_templates.throttle_rule`], [ADM A25], [DD §14] | The throttle is free text ("batched, max 1 an hour"); the worker cannot read it, so windows and times would be hard-coded                                                                                          | `ALTER TABLE notification_templates ADD COLUMN throttle jsonb NOT NULL DEFAULT '{"kind":"instant"}'::jsonb CHECK (jsonb_typeof(throttle) = 'object');` with kinds `instant`, `batch` (`window_seconds`), `collapse` (`by`), `daily` (`local_time`), `once`, `schedule` (`days`); seed from the existing text; keep `throttle_rule` as the label                                                              | WRK-02, A25 edit                         |
| GAP-MOD11-02 | SCHEMA     | [ADM A25] test send; [SQL `admin_users`]                          | "The admin's own registered test device" has no table                                                                                                                                                              | `CREATE TABLE admin_test_destinations (admin_id uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE, channel notif_channel_t NOT NULL CHECK (channel IN ('push','sms')), destination_enc bytea NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (admin_id, channel));` e-mail uses `admin_users.email`                                                                            | Push and SMS test sends                  |
| GAP-MOD11-03 | TR         | [TR §8.2], [SQL `user_settings`], [INV NT1]                       | Quiet hours and discreet mode are NT1 controls stored in `user_settings`; the catalogue does not say whether `/v1/me/notification-preferences` or `/v1/me/settings` reads and writes them                          | `/v1/me/notification-preferences` returns and accepts a `quiet_hours` and `discreet_mode` block stored in `user_settings`; `/v1/me/settings` keeps accepting the same columns (**Recommendation**) (settled by TRX-037)                                                                                                                                                                                      | NT1, C7 suggestion                       |
| GAP-MOD11-04 | TR, SCHEMA | [SQL `in_app_announcements` comment], [ADM A26]                   | Announcements are "served with `GET /v1/config`", which is public, yet audiences are by role, plan and city; no dismissal state exists for `dismissible`                                                           | Add `GET /v1/me/announcements` (member-resolved) and `POST /v1/me/announcements/{id}/dismiss` with `CREATE TABLE announcement_dismissals (user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, announcement_id uuid NOT NULL REFERENCES in_app_announcements(id) ON DELETE CASCADE, dismissed_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (user_id, announcement_id));` (settled by TRX-037) | D1 banner, D16 card                      |
| GAP-MOD11-05 | UI         | [INV NT3], [INV NT4], [UF §15.20], [SQL]                          | Wording exists on boards for N01–N22 (NT4) and 8 e-mails (NT3) only; N23–N36, W01–W08 and 17 further e-mail bodies have no source text in any language                                                             | Extend NT4 to all 44 templates and NT3 to every `email_template`, with `en` text; then seed `i18n_strings`                                                                                                                                                                                                                                                                                                   | DB-01, native review                     |
| GAP-MOD11-06 | TR         | [TR §8.2] "Public website", [WEB §5.10]                           | Only `POST /public/v1/newsletter` is in the catalogue; confirm, preferences and unsubscribe are listed only under the stale `/web/v1`; no tokenised unsubscribe exists for marketing e-mail sent to members either | Add `POST /public/v1/newsletter/confirm`, `/preferences`, `/unsubscribe` and `POST /public/v1/email/unsubscribe` (member marketing, writes `unsubscribe_marketing`) to [TR §8.2] (settled by TRX-021)                                                                                                                                                                                                        | W36 pages, rule 6                        |
| GAP-MOD11-07 | DECISION   | [WEB W36], [ADM A26], [ADM A29]                                   | Subscribers choose topics, but no admin flow sends anything to them: the A26 audience builder targets members and A29 only lists                                                                                   | Owner decides: add "newsletter subscribers by topic and locale" as a broadcast audience (recipient kind `newsletter`, same approval), or keep the list collect-only at launch                                                                                                                                                                                                                                | Sending newsletter issues                |
| GAP-MOD11-08 | SCHEMA     | [SQL `remote_config`], [WEB W36], [TR §11]                        | Delivery retry count and backoff, the 24 h confirmation re-send, the 7-day token life and the purge periods have no config key                                                                                     | Seed `notifications.max_attempts`, `notifications.retry_backoff_seconds`, `newsletter.confirm_resend_hours` (24), `newsletter.unconfirmed_purge_days` (7), `newsletter.unsubscribed_purge_days` (30); values for attempts and backoff for the owner to confirm                                                                                                                                               | Rules 21 and retries being admin-managed |
| GAP-MOD11-09 | TR         | [ADM A25]                                                         | The spec text still says 22 templates, code pattern `^N[0-9]{2}$` and "new templates N23–N99"; the schema has 44 templates and `^[NW][0-9]{2}$`                                                                    | Correct [ADM A25]: 44 seeded, N and W codes, new member templates from N37 (settled by TRX-059)                                                                                                                                                                                                                                                                                                              | A25 acceptance wording                   |

## Change log

| Version | Date        | Change      |
| ------- | ----------- | ----------- |
| v1.0    | 24 Nov 2026 | First issue |
