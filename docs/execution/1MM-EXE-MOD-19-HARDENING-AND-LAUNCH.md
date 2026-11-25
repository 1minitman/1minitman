# 1MM-EXE-MOD-19 · Hardening, end-to-end verification and launch

|                  |                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Document**     | 1MM-EXE-MOD-19                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **Status**       | Approved baseline · v1.0 · 24 Nov 2026                                                                                                                                                                                                                                                                                                                                                                                                       |
| **Audience**     | Engineers and coding agents                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Owner**        | Engineering lead (code owners)                                                                                                                                                                                                                                                                                                                                                                                                               |
| **Sources**      | [TR §2.4], [TR §2.6], [TR §4.3], [TR §4.4], [TR §5.1], [TR §5.3], [TR §10.3], [TR §13], [TR §13.4], [TR §14], [TR §15.1], [TR §16.2], [TR §17], [ADM §3], [ADM §4], [WEB §7], [WEB §8], [UF §13], [UF §15], [OD-01], [OD-06], [OD-09], [OD-10], [OD-11], [OD-12], [OD-20], [PACK] known limits, [SQL]                                                                                                                                        |
| **Related**      | [1MM-EXE-00](1MM-EXE-00-MASTER-PLAN.md), [1MM-STD-01](../standards/1MM-STD-01-TESTING-STRATEGY.md), [1MM-STD-03](../standards/1MM-STD-03-MOBILE-BUILD-STRATEGY.md), [1MM-STD-11](../standards/1MM-STD-11-SECURITY-AND-COMPLIANCE.md), [1MM-STD-19](../standards/1MM-STD-19-OTA-UPDATES.md), [1MM-DB-02](../database/1MM-DB-02-MIGRATIONS.md), [1MM-DB-06](../database/1MM-DB-06-DATA-PROTECTION.md), [1MM-LOG-01](../1MM-LOG-01-PROGRESS.md) |
| **Apps touched** | All six apps and every package, for verification and release only. No feature code.                                                                                                                                                                                                                                                                                                                                                          |
| **Depends on**   | Every module, [MOD-00](1MM-EXE-MOD-00-FOUNDATIONS.md) to [MOD-18](1MM-EXE-MOD-18-ANALYTICS-OVERVIEW-AND-RESEARCH.md), with its own exit gate ticked                                                                                                                                                                                                                                                                                          |
| **Unlocks**      | Real members: the private beta, then public launch                                                                                                                                                                                                                                                                                                                                                                                           |

This module adds no features. It proves the whole product end to end on real devices, closes the
launch gates of the admin and website specs, runs the independent checks (penetration test, load
test, accessibility audit, DPIA), and releases from `develop` to `production`. Open it when
planning the release, when deciding whether a finding blocks launch, and on launch day.

## 1. Outcome

- **Member:** a person in Lagos can install the app from the App Store or Google Play, sign up,
  get verified, match, hold a 1-Minute Intro, chat, pay and get help, on a phone or a tablet, and
  every promise the website makes is true of that build [WEB §8]. Elsewhere in Nigeria the same
  works with an invite; everywhere else the person can join the waitlist [OD-09].
- **Admin:** the console passes its final QA checklist [ADM §4]; every queue, approval and audit
  path has been exercised by a full journey, not only by its own module's tests.
- **Business:** no critical finding is open [TR §17.2 phase 4]; the legal minimum of [OD-10] is
  met before the first real person's data enters production; a release can be rolled back; the
  people on call have a runbook.

## 2. Scope

**In scope**

| Area                  | Content                                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------------------ |
| Cross-module journeys | Section 7.2, on an iOS phone, an Android phone and a tablet                                                  |
| Final QA              | Admin [ADM §4]; website [WEB §8]                                                                             |
| Independent checks    | Penetration test, k6 load test against [TR §15.1], accessibility audit, restore drill                        |
| Legal steps           | DPIA, lawyer review, interim DPO, NDPC registration, vendor DPAs [TR §16.2], [OD-10]                         |
| Production            | Provisioning the production environment (deferred here by MOD-00), paid tiers before public launch [TR §4.3] |
| Stores                | App Store and Google Play review preparation, EAS builds, staged rollout, OTA policy                         |
| Beta and launch       | Private beta, market states of [OD-09], launch-day runbook, rollback                                         |
| Exit                  | [TR §17.2] phase 4, and confirmation of phases 0 to 3                                                        |

**Out of scope**

- Any new endpoint, table, screen or setting. A defect found here is fixed in the owning module
  under its own task ids and re-verified here.
- The OTA mechanism and the device test matrix themselves: defined in
  [1MM-STD-19](../standards/1MM-STD-19-OTA-UPDATES.md) and
  [1MM-STD-03](../standards/1MM-STD-03-MOBILE-BUILD-STRATEGY.md). This plan applies them.
- Research recruitment and budget. The Lagos usability round is a gate here; its mechanics are in
  MOD-18.

**Deferred (verified as off, not built)**

| Item                    | Switch                                  | Decision   | Launch check                                        |
| ----------------------- | --------------------------------------- | ---------- | --------------------------------------------------- |
| Calls MF4               | `calls.enabled` = false                 | [OD-20]    | MF4 shows "Coming soon"; no call endpoint reachable |
| Offers A22, W24         | `offers.enabled` = false                | [OD-01]    | No offer anywhere (crawl)                           |
| GD1 live phone check    | `verification.carrier_check` = false    | [OD-06]    | Screen hidden; Gold flow starts at GD2              |
| French UI in the app    | `locale.fr` = false until native review | [TR §17.1] | Not selectable unless reviewed                      |
| Markets outside Nigeria | `cities.market_status = 'waitlist'`     | [OD-09]    | Sign-up leads to the waitlist                       |

## 3. Data first

### 3.1 Data inventory

No object is created. These existing objects hold the launch state and are checked or set during
this module. Each was confirmed in the schema by grep on 24 Nov 2026.

| Object                                                                                                                                                                                   | What launch needs from it                                                           | PII          | Source           |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------ | ---------------- |
| `feature_flags` rows `registration.open`, `offers.enabled`, `calls.enabled`, `locale.fr`, `locale.pcm`, `verification.carrier_check`, `payments.flutterwave_web`                         | Values match section 2; production changes go through approval                      | none         | [SQL]            |
| `remote_config` row `markets.beta_requires_invite` (true)                                                                                                                                | Beta cities need an invite                                                          | none         | [SQL], [OD-09]   |
| `remote_config` rows named in [ADM §4]: `intro.window_hours` 24, `discovery.daily_cap.basic` 25, `discovery.daily_cap.verified_free` 50, `billing.refund_approval_threshold_usd_cents` 0 | Owner decisions hold in production seeds                                            | none         | [ADM §4]         |
| `cities.market_status`                                                                                                                                                                   | Lagos `live`; other Nigerian cities `beta`; everything else `waitlist`              | none         | [SQL], [OD-09]   |
| `countries.emergency_number`, `.emergency_number_verified_by`, `.emergency_number_verified_at`                                                                                           | NG 112 verified by an admin before go-live (carried from MOD-02)                    | none         | [SQL]            |
| `beta_invites`, function `redeem_beta_invite()`, `waitlist_entries`                                                                                                                      | Invites issued (`waitlist.invite`), redeemed once, expired by `beta_invites.expire` | personal     | [SQL], [TR §6.1] |
| `app_versions` (`min_supported`, `latest`, `store_url`, `runtime_version`, `download_mb`, `min_os_version`)                                                                              | The released versions; OB1 gate                                                     | none         | [SQL], [TR §5.1] |
| `maintenance_windows`; `site_settings` maintenance                                                                                                                                       | Maintenance mode rehearsed                                                          | none         | [SQL]            |
| `legal_documents.counsel_review_ref` (CHECK `ck_legal_counsel_ref`)                                                                                                                      | Published Terms, Privacy and Guidelines carry the review reference                  | none         | [SQL], [ADM §4]  |
| `prices.provider_product_id`                                                                                                                                                             | No `TBD:*` placeholder left on any product sold at launch                           | none         | [SQL], [OD-12]   |
| `transactions.environment`                                                                                                                                                               | Sandbox rows never counted in production revenue                                    | none         | [SQL]            |
| `v_role_drift`, `v_admin_mfa_gaps`                                                                                                                                                       | Both empty                                                                          | none         | [SQL]            |
| `admin_audit_chain_runs`                                                                                                                                                                 | Chain verified over the whole history                                               | none         | [SQL]            |
| `ip_access_rules`                                                                                                                                                                        | Production admin allow-list set and verified                                        | none         | [SQL], [ADM §4]  |
| `security_incidents`                                                                                                                                                                     | Incident log ready; NDPA 72-hour clock [TR §13.4]                                   | none         | [SQL]            |
| `vendor_settings`, `vendor_health_checks`                                                                                                                                                | Every launch vendor connected and probed; carrier "Not connected at launch"         | none         | [SQL]            |
| `worker_jobs` (`is_active`, `cron`)                                                                                                                                                      | Every job in [TR §11] active and scheduled in production                            | none         | [SQL]            |
| `research_studies` row `LAGOS-R1`, `v_research_summary`                                                                                                                                  | The usability scorecard for the [TR §17.2] phase 3 check                            | pseudonymous | [SQL]            |
| `privacy_requests`, `legal_holds`                                                                                                                                                        | Register working before real data arrives                                           | personal     | [SQL]            |

### 3.2 UI against data

This module owns no screen. The final comparison of UI against data is done three ways:

| Check                                                                         | Method                                                                                    | Source                                             |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Every table, column, enum and permission the console uses exists              | Schema lint against the generated Drizzle models                                          | [ADM §4]                                           |
| Every input, state and action of the 154 live screens exists and is reachable | Screen coverage run: each `[INV]` id is visited by at least one journey or a Maestro flow | [TR §17.1], [INV]                                  |
| Every feature claim on the website is true of the store build                 | Claims list checked against the inventory on launch day                                   | [WEB §8]                                           |
| Nothing a person reads is a literal                                           | Bundle search for limits, prices and sentences in all four clients; banned-terms check    | each module's exit gate; `pnpm check:banned-terms` |

### 3.3 Assets

Store listing assets (icon, screenshots, feature graphic) are prepared from the logo pack and
the illustration set; people in screenshots are illustrations, never real members [WEB §8],
[OD-24]. The exact files are chosen in MOD-19-OPS-06 and recorded in the licence log.

### 3.4 Dynamic content and constants

No new constant. This module proves the rule for the whole product with one drill per channel:

| Channel                 | Drill                                                                       | Owner module   |
| ----------------------- | --------------------------------------------------------------------------- | -------------- |
| Remote config           | Change a public key in A24 with approval; all clients show it within 60 s   | MOD-02         |
| Feature flag            | Turn a kill switch off (immediate) and on (approval)                        | MOD-02         |
| i18n                    | Edit a string in A25; it appears in app, site and console without a release | MOD-02         |
| CMS                     | Edit, review, schedule and publish a page; live within 5 minutes            | MOD-15         |
| Entitlements            | Change a cap through approval; `GET /v1/me/entitlements` reflects it        | MOD-10         |
| Legal                   | Publish a new version; the re-accept sheet appears on the due date          | MOD-16         |
| Notification template   | Edit N-template copy; next send uses it                                     | MOD-11         |
| Admin console constants | Change a queue SLA or claim timeout; the console follows                    | MOD-04, MOD-09 |

## 4. API (built first)

### 4.1 Endpoints

None. The API-first rule is applied here as a freeze: the release candidate is cut only when the
OpenAPI documents of all four surfaces are regenerated with no diff, every route has a contract
test, and the admin permission enumeration test passes over the whole of `/admin/v1` [ADM §4].

### 4.2 Realtime, jobs and webhooks

Nothing new. Verified in production before real members arrive: every webhook endpoint of
[TR §12] receives a signed test event and rejects an unsigned one; every job of [TR §11] has run
at least once; WebSocket and admin SSE connect through Cloudflare.

### 4.3 Rules this module enforces

1. No real personal data enters any environment until the [OD-10] steps are recorded.
2. No production data is copied to a lower environment [TR §4.4].
3. `production` changes only by an approved merge commit from `develop`.
4. Migrations run as a gated step with `app_migrator`, expand-then-contract; no applied migration
   is edited [TR §10.3].
5. A release with an open critical finding does not ship [TR §17.2].
6. A change that needs a new native binary is never sent over the air
   ([1MM-STD-19](../standards/1MM-STD-19-OTA-UPDATES.md)); EAS Update is pinned to a runtime
   version [TR §5.1].
7. Every production config change during launch goes through approval, except turning a kill
   switch off [ADM §3] M7.
8. Sandbox purchases are never counted as revenue (`transactions.environment`).

### 4.4 Contract deliverables

None new. The frozen OpenAPI documents and generated clients of the release candidate are tagged
with the release.

## 5. Admin: final QA

The checklist is [ADM §4]; every item is ticked on staging against the release candidate, and
the production-only items again in production. How each group is proven:

| Group                          | Proof                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Security and access            | Enumeration test over the OpenAPI spec (403/404 without permission); MFA with no bypass, break-glass with the hardware key; production IP allow-list refused from outside and allowed from the office or VPN; idle 30 min and absolute 8 h server-side; audit chain verified, tampering detected; penetration test with no open high finding |
| Data protection                | Automated response scan for the forbidden fields listed in [ADM §4]; masking and audited reveals; personal exports need approval and expire after 24 h; aggregated exports suppress cells below 10; A36 retention checks read zero                                                                                                           |
| Correctness against the schema | Schema lint; banned-terms check on the console bundle; entitlement matrix equals the seed; `v_role_drift` empty; owner decisions OD-01 to OD-09 hold in seeds and UI                                                                                                                                                                         |
| Legal staging                  | Section 7.5                                                                                                                                                                                                                                                                                                                                  |
| Quality                        | axe on every route, both themes, at 1280, 1024, 768 and 375 px; keyboard-only and screen-reader runs (NVDA + Firefox, VoiceOver + Safari) of the ten named tasks; list first content < 1.5 s, 50-row pages < 1 s, dashboard < 2.5 s, SSE < 2 s; standard states on every list; every Appendix D item at its decided value                    |

The milestone gates M1 to M8 [ADM §3] are re-read once as a whole; any item ticked against a stub
in an earlier module is re-run against the real dependency.

## 6. Web: final QA

The checklist is [WEB §8]. It is run on the production build of `apps/site` before any form
collects real data, and the billing web app is checked with it where an item applies.

| Group                       | Proof                                                                                                                                                                                                                                                                                                                           |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Content and honesty         | Automated search for banned terms and placeholder text; prices and caps read from the API; markets shown as Lagos live, rest of Nigeria "Beta · invite only", others waitlist; only NG 112 published; crawl proves no offer or `/offer*` page; pcm and fr native-reviewed                                                       |
| Brand and design            | Visual review of every template in light and dark; licence log complete                                                                                                                                                                                                                                                         |
| Accessibility               | axe with 0 violations on every template, both themes, three locales; manual keyboard, NVDA, VoiceOver and TalkBack passes on the eight named pages; accessibility statement published with the audit date                                                                                                                       |
| Performance                 | Above the fold < 500 KB; Lighthouse ≥ 95 in all four categories ([TR §6.1], TRX-066; the "≥ 90" of [WEB §8] is superseded); LCP ≤ 2.5 s, CLS ≤ 0.1, INP ≤ 200 ms; WebPageTest 3G Fast LCP ≤ 4 s on Home; zero pre-consent third-party requests                                                                                  |
| SEO                         | Titles, canonical, hreflang, sitemaps, JSON-LD validation; 404 returns 404; staging `noindex`                                                                                                                                                                                                                                   |
| Privacy, security and legal | Consent banner and GPC; cookie scan matches the cookie table; header scan A or better; CSP without `unsafe-inline` scripts; uploads quarantined and scanned; rate limits tested; the trusted-contact page (`/s/*` [OD-13]; the checklist still writes the stale `/t/*`) excluded from analytics, caching and the service worker |
| Flows                       | Download user-agent matrix; QR on real iOS and Android; waitlist (with beta invite requests), newsletter, contact, safety (urgent path), careers and investor contact end to end with test data; maintenance and banner; status page reachable with the origin down                                                             |
| Operations                  | Monitoring, the five named runbooks, and recorded sign-offs: Product Owner, legal, T&S, accessibility, security                                                                                                                                                                                                                 |

Billing web app: sign-in, checkout and billing pages pass axe and the keyboard run; Flutterwave
hosted checkout completes in test mode on staging and in live mode with one real low-value
purchase and refund in production (section 7.2, J10).

## 7. Mobile and cross-module verification

### 7.1 Devices and conditions

| Device class  | Minimum                                                                                | Source                        |
| ------------- | -------------------------------------------------------------------------------------- | ----------------------------- |
| Android phone | Android 9+, 2 GB RAM, on a 3G profile and on 4G                                        | [TR §5.3], [TR §15.1]         |
| iOS phone     | iOS 16.4+                                                                              | [TR §5.3] (v3.6, TRX-013)     |
| Tablet        | One tablet; layouts per [1MM-STD-03](../standards/1MM-STD-03-MOBILE-BUILD-STRATEGY.md) | brief section 7; GAP-MOD19-03 |

Exact models are fixed in [1MM-STD-03](../standards/1MM-STD-03-MOBILE-BUILD-STRATEGY.md). Every
journey runs on all three with store-distributed builds (TestFlight, Play internal testing), not
development clients, in light and dark. One full pass is run in `pcm`, with text size at 200%
and reduced motion on [TR §2.4].

### 7.2 Journey list

Built from the exit gates of the module plans MOD-00 to MOD-18. The exit gates and risk tables
of MOD-11 to MOD-17 were read against this list in review (GAP-MOD19-05, now closed): J11 to J17
and J20 were extended to cover what those gates require end to end, and the items those plans
carry to launch were added to section 7.3. The ids are unchanged.

| Id  | Journey (member side → admin side)                                                                                                                                                                                                                                                                                                                                                                                                                                         | Modules            | Proves                                                                                                              |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------- |
| J01 | Cold start, splash, offline shell and back online; required and recommended update; maintenance; language choice                                                                                                                                                                                                                                                                                                                                                           | 00, 02             | Rows 15.1, 15.17, 15.21 (ES5); first useful screen < 2 s on the 2 GB phone                                          |
| J02 | Sign up by e-mail through the 10 steps to My Specs; again with Google and with Apple; resume after kill at each step                                                                                                                                                                                                                                                                                                                                                       | 03                 | Rows 15.5, 15.6; download → My Specs in under 3 minutes                                                             |
| J03 | Sign in, new-device challenge, lockout, password reset, phone sign-in, "not me" answer; sessions revoked from the console                                                                                                                                                                                                                                                                                                                                                  | 03, 05             | Rows 15.2–15.4; Member 360 sessions tab                                                                             |
| J04 | Build a profile: photos, clip, prompts with voice, preferences; a filtered photo and a face mismatch are refused; moderator removes a prompt in A13                                                                                                                                                                                                                                                                                                                        | 04                 | Row 15.18; media pipeline; A13 queue                                                                                |
| J05 | Black Badge B0 to B11 with a real store purchase in sandbox: approved; needs fix (no second charge); not approved (refund on Google Play and Flutterwave, Apple step on iOS); fraud (no refund); reviewed in A12                                                                                                                                                                                                                                                           | 06, 10             | Row 15.12; effort under 7 minutes; MOD-06 items carried to MOD-10                                                   |
| J06 | Two members discover each other, react, hit the daily cap as unverified and verified Free, undo, match and maybe-match; scarcity card with real counts; tuning changed in A24                                                                                                                                                                                                                                                                                              | 07, 02             | Rows 15.7, 15.19; "a tester can sign up, get verified and match" [TR §17.2] phase 1                                 |
| J07 | Match → 1-Minute Intro on two devices (timed, reduced motion, expiry at 24 h) → keep talking → chat with media, reactions, read receipts by plan → Direct Spec request accepted and declined → unmatch                                                                                                                                                                                                                                                                     | 08                 | Row 15.8; chat delivery budget on real networks                                                                     |
| J08 | Report from chat, profile and group; block and undo; unblock; money phrase blocked in early chat; the case is triaged with evidence behind step-up; reporter notified; reported person learns nothing                                                                                                                                                                                                                                                                      | 09, 08             | Row 15.11; A14, A17                                                                                                 |
| J09 | Restrict, suspend and ban a member; the app shows AS1 and H6; appeal filed and overturned; paid days credited                                                                                                                                                                                                                                                                                                                                                              | 05, 09, 10         | Row 15.16; A11, A16; four-eyes on ban                                                                               |
| J10 | Buy Premium, upgrade to Gold (prorated), start and cancel a trial, payment failure through grace to lapse and restore; on iOS, Android and the billing web app (Flutterwave); refund through approval; dispute pack; drift re-sync                                                                                                                                                                                                                                         | 10                 | Rows 15.13–15.15; "end-to-end purchase and chat on real devices (sandbox)" [TR §17.2] phase 2; `v_role_drift` empty |
| J11 | Push permission in context; N-templates arrive by push, e-mail and in-app with quiet hours and discreet mode (checked on a locked iOS and Android phone); preferences with Billing and Security locked on; a hard bounce stops further mail; a broadcast through approval, cancelled half-way, sends nothing further; an in-app announcement                                                                                                                               | 11                 | Row 15.20; A25, A26; one delivery per template and channel from its real trigger (MOD-11 exit gate)                 |
| J12 | A Premium member creates a group in the five steps; it stays hidden until approved in A18; a Free member reads along and meets the posting upsell; invite a match, join, chat, mute, report the group, leave; the tab disappears with `groups.enabled` off                                                                                                                                                                                                                 | 12, 09             | Rows 15.9, 15.10; ES4                                                                                               |
| J13 | Plan a date from a chat at a listed venue (a private address is refused), add a trusted contact (YES reply; STOP ends it), share link `1minitman.com/s/<token>` opens without login and ends 24 h after the meet-up, check in; miss a check-in and see the contact messaged and the safety desk alerted within 5 s and worked on a phone at 375 px, with reveals under a reason; after-date feedback; a group event with its pinned card and RSVP                          | 13, 11             | Rows 15.22, 15.23 (LG4, LG5); A15 [ADM §3] M4; the MOD-13-QA-01 drill, repeated on each release candidate           |
| J14 | Help search and article vote; support chat round-trip showing the agent's display name, with N30 opening H1B and an internal note never reaching the member; website help search without JavaScript; website contact and safety report routed to the console; an anonymous safety report accepted while maintenance is on, its urgent category reaching the urgent queue; a web privacy request arriving in A36 with a PR-n reference                                      | 14, 15, 16         | Row 15.11 (help); A27; W32–W34; [OD-32]                                                                             |
| J15 | Website: device-aware download, QR on real phones, waitlist with double opt-in, newsletter confirm and one-click unsubscribe (W36), careers apply with a scanned CV, a story published only with both partners' confirmation and withdrawn to a 410; the consent banner (W03) loads no analytics before a choice, honours GPC and logs a receipt; a CMS edit reviewed and published within 5 minutes, a failed publish rolled back; banner and maintenance; en, pcm and fr | 15, 02, 11, 16     | [WEB §5]; A28, A29; W03, W36                                                                                        |
| J16 | Read Terms, Privacy, Guidelines, the same text for the same version in the app and on W35; a material change published through approval in A30 and re-accepted; download my data once a day; withdraw sensitive and biometric consent; delete account, keep account within the grace period, erasure at day 14 leaving only the lawful records; legal hold blocks erasure; the A36 retention checks read zero                                                              | 16, 06             | Rows 15.16, 15.23; A30, A36                                                                                         |
| J17 | A simulated credential-stuffing run is detected, an approved deny rule syncs to Cloudflare within 60 s and lapses at its expiry, an incident is logged with the NDPA clock; an admin locked with that incident open cannot be unlocked early without a second admin [OD-29]                                                                                                                                                                                                | 17, 01             | A32 [ADM §3] M7                                                                                                     |
| J18 | Analytics off before consent, on after; overview tiles move after the journeys above and link to the records; a research session entered on the tablet                                                                                                                                                                                                                                                                                                                     | 18                 | A33–A35; MOD-18 exit gate                                                                                           |
| J19 | Closed beta: an invite is sent from the waitlist, redeemed once at sign-up in a beta city, refused when reused or expired; a waitlist-only city cannot sign up                                                                                                                                                                                                                                                                                                             | 03, 15, 02         | [OD-09]; `redeem_beta_invite()`                                                                                     |
| J20 | Admin leaver: an admin holding claimed cases, support tickets, an escalation and assigned website contact items is deactivated; all work is released and reassignable                                                                                                                                                                                                                                                                                                      | 01, 09, 13, 14, 15 | Carried from MOD-01; reassigners of MOD-09, MOD-13, MOD-14, MOD-15                                                  |
| J21 | Entitlement sweep: one account per role (BASIC, ACTIVE, CLASSIC, SUPER, and PENDING_REVIEW) walks every gated action; results equal the matrix                                                                                                                                                                                                                                                                                                                             | all                | [TR §9]                                                                                                             |
| J22 | Dynamic-content drills of section 3.4                                                                                                                                                                                                                                                                                                                                                                                                                                      | 02, 10, 11, 15, 16 | Owner rule 4                                                                                                        |

### 7.3 Items carried forward by other modules

| From                   | Item                                                                                                                                                                                                                                                                           | Closed by                                        |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| MOD-00                 | Create the production environment; move to Railway Pro, paid Neon and pay-as-you-go Upstash before public launch; a database dump restored                                                                                                                                     | MOD-19-OPS-01, OPS-02, OPS-04                    |
| MOD-01                 | End-to-end leaver test once reassigners exist                                                                                                                                                                                                                                  | J20                                              |
| MOD-02, MOD-11, MOD-15 | NG 112 verified in A31 before go-live; pcm (and fr) strings, notification templates and core website pages native-reviewed, or the locale switched off                                                                                                                         | MOD-19-QA-06                                     |
| MOD-04                 | Budget review of transcoding compute on Railway                                                                                                                                                                                                                                | MOD-19-QA-03                                     |
| MOD-06                 | NDPC registration and DPIA before real users                                                                                                                                                                                                                                   | MOD-19-OPS-05                                    |
| MOD-08                 | Load test of socket fan-out before public launch; chat delivery budget                                                                                                                                                                                                         | MOD-19-QA-03                                     |
| MOD-09                 | Abuse-rule regex cost measured in the chat load test; the sanctions ladder holds real steps before any real member is sanctioned                                                                                                                                               | MOD-19-QA-03, MOD-19-QA-06                       |
| MOD-10                 | `v_role_drift` empty after the end-to-end runs; reconciliation with no unexplained item                                                                                                                                                                                        | J10                                              |
| MOD-11                 | Every template has `en` wording in production (GAP-MOD11-05); production sender domain (SPF, DKIM, DMARC), Termii sender and push credentials; one push, e-mail and SMS received in Nigeria; the full template run `MOD-11-QA-01` closed                                       | MOD-19-OPS-01, J11, launch-day first-hour checks |
| MOD-12                 | Load test of a full group room (fan-out to 500 members)                                                                                                                                                                                                                        | MOD-19-QA-03                                     |
| MOD-13                 | The missed-check-in drill `MOD-13-QA-01` repeated on the release candidate with real SMS and WhatsApp test numbers; the Lagos venue catalogue imported and reviewed in A18 in place of the starter seed; safety paths rehearsed under maintenance once GAP-MOD13-12 is decided | J13, MOD-19-QA-06, MOD-19-OPS-07                 |
| MOD-14, MOD-15         | Production website forms stay behind the maintenance switch until the legal minimum is confirmed                                                                                                                                                                               | MOD-19-OPS-05, then MOD-19-QA-06                 |
| MOD-15                 | Store ids set in site settings so `/get` reaches a store instead of falling back to the waitlist; production DNS and HSTS preload; hand-over of [WEB §8]                                                                                                                       | MOD-19-OPS-06, MOD-19-OPS-01, MOD-19-QA-06       |
| MOD-16                 | Software evidence for the DPIA and the legal gate; retention verification; counsel's values loaded (consent-receipt retention, `privacy.sla_days.*`, `privacy.ndpc_registration`, GAP-MOD16-10); A36 on test accounts only until the NDPC registration is filed                | MOD-19-OPS-05                                    |
| MOD-17                 | Network rollup tables under load; incident playbooks; the eight `security.detect.*` thresholds set in production from the staging baseline (GAP-MOD17-07); the OD-29 unlock rule verified with MOD-01                                                                          | MOD-19-QA-03, MOD-19-OPS-07, MOD-19-QA-06, J17   |
| MOD-18                 | Analytics consent control decided (GAP-MOD18-01); catalogue coverage run                                                                                                                                                                                                       | J18                                              |
| [PACK]                 | Schema and concurrency tests re-run on a PostgreSQL 16 server before beta                                                                                                                                                                                                      | MOD-19-QA-01                                     |
| [OD-12], [DDR]         | Real App Store and Google Play product ids supplied for the seed                                                                                                                                                                                                               | MOD-19-OPS-06                                    |

### 7.4 Independent checks

| Check               | Scope and pass rule                                                                                                                                                                                                                                                                                                                                                                                                  | Source                                      |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Penetration test    | Independent tester. API and web against OWASP ASVS level 2; app against MASVS L1 plus resilience basics; admin console; website forms and uploads. Pass: no open critical or high finding; mediums have an owner and a date                                                                                                                                                                                          | [TR §13], [TR §13.4], [ADM §4], [WEB §7] M6 |
| k6 load test        | Run against staging sized like production. Budgets: reads p95 < 200 ms, writes < 400 ms, deck < 300 ms at the origin; from Lagos on 4G reads < 450 ms, writes < 650 ms; chat delivery < 500 ms in region and < 700 ms Lagos to Lagos; badge auto-decision 80% within 5 minutes. Scenarios: sign-up burst, deck and reactions, concurrent mutual likes (no duplicate match), chat fan-out, webhook burst, admin lists | [TR §15.1], [TR §8.4]                       |
| Client budgets      | Download size < 30 MB; cold start < 2 s on the 2 GB phone; deck at 60 fps; card photo < 80 KB; website LCP < 2.5 s on 4G                                                                                                                                                                                                                                                                                             | [TR §15.1]                                  |
| Accessibility audit | App: every screen for 44 px targets, labels in context, contrast, 200% text, reduced motion, with VoiceOver and TalkBack. Console and site per sections 5 and 6. Pass: no critical WCAG 2.2 AA failure                                                                                                                                                                                                               | [TR §2.4], [ADM §4], [WEB §8]               |
| Restore drill       | Restore from point-in-time and from the nightly dump; targets RTO < 1 hour, RPO < 5 minutes                                                                                                                                                                                                                                                                                                                          | [TR §10.3]                                  |
| Observability drill | Each alert in [TR §14] is fired once on staging and reaches a person                                                                                                                                                                                                                                                                                                                                                 | [TR §14]                                    |
| Usability           | LAGOS-R1 scorecard meets its targets and no theme raised by three or more people is left unfixed                                                                                                                                                                                                                                                                                                                     | [TR §17.2] phase 3, [UF §13.1]              |

The load levels (virtual users, duration) are not in a source: GAP-MOD19-02.

### 7.5 Legal steps before real users

Nothing below may be skipped for the private beta: [OD-10] applies "including the closed beta".

| Step                                                                                                                                   | Evidence                                                                                                                            | Source                      |
| -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| Lawyer review of Terms, Privacy Policy and Community Guidelines (covers refund wording and the cross-border transfer to the EU origin) | `legal_documents.counsel_review_ref` on the published versions; the non-production drafts seeded in MOD-03 are replaced through A30 | [OD-10], [OD-11], [ADM §4]  |
| Interim DPO named                                                                                                                      | Founder/CTO holds `privacy_officer`; privacy@ routed to A36; named in the Privacy Policy                                            | [OD-10], [ADM §4], [WEB §8] |
| NDPC data-controller registration filed and tier confirmed                                                                             | Reference recorded with the DPIA and in `privacy.ndpc_registration` (shown on A36)                                                  | [OD-10]                     |
| DPIA                                                                                                                                   | Covers biometric processing, sensitive answers, location, cross-border transfer; signed by the DPO                                  | [TR §16.2]                  |
| Vendor DPAs and transfer safeguards                                                                                                    | One record per launch vendor                                                                                                        | [TR §16.2]                  |
| No prize draw or lottery                                                                                                               | Console and site search                                                                                                             | [OD-10]                     |
| Privacy request deadlines                                                                                                              | `privacy.sla_days.*` confirmed or changed by counsel (provisional 30 days, OD-38)                                                   | [DDR B45]                   |
| Demo and staging hold test data only                                                                                                   | Environment audit                                                                                                                   | [OD-10]                     |

### 7.6 Store review preparation

The sources name store review as a deliverable [TR §17.2] but give no checklist
(GAP-MOD19-01). The items below are a **Recommendation**; each must be re-checked against the
current App Store Review Guidelines and Google Play policies at submission time.

| Item                        | Why it matters here                                                                                                                                                                                                                |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Review account and notes    | A verified test account per plan, with steps to reach paid and verified features without a live face check                                                                                                                         |
| In-app purchases            | Premium, Gold and Black Badge products approved in both stores with real ids [OD-12]; restore purchases reachable (BL1); prices and terms shown before purchase; no link-out to web checkout unless the store allows it [TR §17.1] |
| Account deletion in the app | AS2–AS5 reachable from settings                                                                                                                                                                                                    |
| User-generated content      | Report and block on every profile, chat and group; moderation in place; contact for abuse                                                                                                                                          |
| Age                         | 18+ gate (C1) and matching store age rating                                                                                                                                                                                        |
| Privacy                     | Store privacy declarations match the data dictionary; permission prompts carry purpose text and are asked in context [TR §5.1]; biometric consent screen B3                                                                        |
| Sign in with Apple          | Offered alongside Google                                                                                                                                                                                                           |
| Listing                     | Name, description, screenshots without real members, support and privacy URLs; no claim the build cannot honour [WEB §8]                                                                                                           |
| Deferred features           | Calls and international discovery not advertised as available [OD-09], [OD-20]                                                                                                                                                     |

### 7.7 Builds, rollout and OTA

| Topic            | Rule                                                                                                                                                                                | Source                |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| Builds           | EAS Build per environment; EAS Submit to TestFlight and Play testing tracks; build numbers and channels per [1MM-STD-03](../standards/1MM-STD-03-MOBILE-BUILD-STRATEGY.md)          | [TR §5.1]             |
| Staged rollout   | Production releases roll out in stages in both stores; a stage advances only while crash-free rate and error rate hold (**Recommendation** for the stage sizes, set in the runbook) | [TR §17.3]            |
| OTA              | EAS Update for JavaScript-only fixes, pinned to the runtime version; policy in [1MM-STD-19](../standards/1MM-STD-19-OTA-UPDATES.md)                                                 | [TR §5.1]             |
| Version gate     | `app_versions.min_supported` forces OB1 when a build must be retired; `runtime_version` recorded per release                                                                        | [SQL], [TR §5.1]      |
| Web, admin, site | Static builds on Cloudflare Pages from `production`; the site also republishes through `site.publish`                                                                               | [TR §4.3], [TR §11]   |
| API and worker   | Railway services deployed from `production` after the migration step                                                                                                                | [TR §4.3], [TR §17.3] |

### 7.8 Release stages

| Stage                  | State                                                                                                                                                                                        | Entry condition                                                                                       |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| S0 Production cut-over | Production exists; seeds applied; staff test accounts only; `registration.open` off                                                                                                          | Sections 5 and 6 ticked on staging; restore drill passed                                              |
| S1 Private beta        | Builds distributed through TestFlight and Play closed testing; `registration.open` on; Lagos `live`, other Nigerian cities by invite, everything else waitlist; free tiers allowed [TR §4.3] | Section 7.5 complete; penetration test with no open critical or high finding; journeys green          |
| S2 Public launch       | Store listings public with staged rollout; Railway Pro, paid Neon, pay-as-you-go Upstash [TR §4.3]                                                                                           | No critical finding open [TR §17.2]; beta exit review; store approval; load test passed on paid tiers |

How the phase 4 "private beta" relates to the [OD-09] market states is a **Recommendation**
here: GAP-MOD19-04.

### 7.9 Release, rollback and launch day

**Release from `develop` to `production`**

1. Freeze: release candidate commit on `develop`; `verify` and CodeQL green; `pnpm preflight`
   green locally.
2. Staging runs the candidate; journeys and final QA are ticked against it.
3. Open the pull request from `develop` to `production`; a code owner approves; merge with a
   merge commit.
4. Migrations run as the gated step; then API and worker deploy; then admin, web app and site.
5. Smoke test in production with staff accounts: health, sign-in, one read and one write per
   surface, one webhook, one job, SSE and WebSocket.
6. Mobile: promote the tested build; start the staged rollout; set `app_versions`.
7. Record the release in [1MM-LOG-01](../1MM-LOG-01-PROGRESS.md).

**Rollback**

| Layer               | Method                                                                                                                                          |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Feature misbehaving | Kill switch in A31 (immediate, no approval to turn off)                                                                                         |
| API, worker         | Redeploy the previous Railway deployment. Safe because migrations are expand-then-contract: the previous code runs on the new schema [TR §10.3] |
| Database            | Never rolled back by editing a migration; a forward fix, or point-in-time restore for data loss [TR §10.3]                                      |
| Website             | `site.publish` rolls back on a failed smoke test; otherwise redeploy the previous Pages build [TR §11]                                          |
| Admin, web app      | Redeploy the previous Pages build                                                                                                               |
| Mobile JavaScript   | Republish the previous update on the same runtime version ([1MM-STD-19](../standards/1MM-STD-19-OTA-UPDATES.md))                                |
| Mobile binary       | Halt the staged rollout; ship a fixed build; raise `min_supported` only if the bad build is unsafe                                              |
| Whole service       | Maintenance mode through approval; status page updated; the website safety report stays open (OD-32)                                            |

**Launch-day runbook (contents)**

| Section           | Content                                                                                                                                                                                         |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Roles             | Release lead, on-call engineer, T&S lead on the queues and safety desk, support, DPO contact                                                                                                    |
| Go / no-go        | The exit gate of section 10, read aloud and signed                                                                                                                                              |
| Watch list        | SLO burn, error rate, webhook failures, `v_role_drift`, badge SLA, unacknowledged escalations, OTP delivery failure, vendor down, audit chain, spend alarms [TR §14]; A33 overview; A32 network |
| First-hour checks | A real sign-up, verification, purchase and refund by staff; one push, e-mail and SMS received in Nigeria                                                                                        |
| Playbooks         | Scam wave, data breach (NDPA notice within 72 hours), account takeover [TR §13.4]; the five website runbooks [WEB §8]; OTP failover Termii → Twilio                                             |
| Communication     | Status page at status.1minitman.com; in-app announcement; site banner                                                                                                                           |
| Close             | Review after 24 hours and after 7 days; findings logged as tasks in the owning modules                                                                                                          |

## 8. Work breakdown (strict order)

There is no client work to gate behind an API here. The equivalent **API gate** is the contract
freeze of section 4.1: no journey run counts until it is green on the release candidate.

| #   | Task          | What is done                                                                                                                         | Needs                 | Done when                                                 |
| --- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------- | --------------------------------------------------------- |
| 1   | MOD-19-QA-01  | Contract freeze; full `pnpm check`; schema and concurrency tests on a PostgreSQL 16 server; permission enumeration over `/admin/v1`  | All module exit gates | Green on the candidate commit                             |
| 2   | MOD-19-QA-02  | Journeys J01–J22 on the three devices; screen coverage run                                                                           | 1                     | Every journey ticked per device; every `[INV]` id covered |
| 3   | MOD-19-QA-03  | k6 load test, client budgets, cost review                                                                                            | 1                     | Section 7.4 budgets met; report filed                     |
| 4   | MOD-19-QA-04  | Accessibility audit of app, console, site, web app                                                                                   | 2                     | No critical failure; statement dated                      |
| 5   | MOD-19-QA-05  | Penetration test and fixes re-tested                                                                                                 | 1                     | No open critical or high finding                          |
| 6   | MOD-19-QA-06  | Final QA: [ADM §4] and [WEB §8]; launch-state audit of section 3.1                                                                   | 2, 4, 5               | Both checklists ticked with evidence links                |
| 7   | MOD-19-OPS-01 | Production environment: Railway, Neon, Upstash, R2 buckets, KMS key, Cloudflare, secrets, roles (`pnpm db:roles`), migrations, seeds | 1                     | Smoke test passes with staff accounts                     |
| 8   | MOD-19-OPS-02 | Backups and restore drill; observability drill                                                                                       | 7                     | RTO and RPO measured; every alert reached a person        |
| 9   | MOD-19-OPS-05 | Legal steps of section 7.5; DPIA signed                                                                                              | drafts from MOD-16    | Every row has evidence                                    |
| 10  | MOD-19-OPS-06 | Store listings, product ids, review accounts, EAS production builds, submission                                                      | 2, 9                  | Both stores approve the build                             |
| 11  | MOD-19-OPS-07 | Runbook, rollback rehearsal on staging (API redeploy, OTA republish, maintenance mode)                                               | 7                     | Each rollback row rehearsed once                          |
| 12  | MOD-19-OPS-08 | S1 private beta: invites, monitoring, weekly review                                                                                  | 6, 8, 9, 10, 11       | Beta exit review held                                     |
| 13  | MOD-19-OPS-04 | Paid tiers; load test repeated on them                                                                                               | 12                    | Budgets met on the launch configuration                   |
| 14  | MOD-19-OPS-09 | S2 public launch and the 24-hour and 7-day reviews                                                                                   | 13                    | Exit gate signed                                          |

Task ids are stable; OPS-03 is unused.

## 9. Tests

| Area              | Expected                                                               | Unexpected                                                                                                                                                    | When variables change                                                                                                                                       |
| ----------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Journeys          | Each journey passes on all three devices with store-distributed builds | Network lost mid-journey; app killed mid-payment; token refresh during a long session; two devices on one account; clock set wrong; storage full              | Light and dark; en, pcm (and fr if on); 200% text; reduced motion; 3G and data saver; each plan and role; phone and tablet, both orientations on the tablet |
| Release           | Deploy order holds; smoke test passes; staged rollout advances         | Migration fails half-way (forward fix, no edit); deploy of API before migration; a webhook arrives during deploy; an old app version calls a changed endpoint | `min_supported` raised; kill switch off during rollout; rollback then roll forward                                                                          |
| Load              | Budgets met at the planned level                                       | Redis unavailable (polling fallback works, quotas fail safe); Neon cold start; one vendor down (OTP failover)                                                 | Replica count 2 → more; free tier → paid tier; rate-limit policy values halved and doubled                                                                  |
| Security          | Controls of [TR §13.1] hold under test                                 | Replayed refresh token; forged webhook; unsigned origin request bypassing Cloudflare; IDOR on every id-bearing route; upload with a disguised type            | Role and scope of the admin; member role; restricted and suspended accounts                                                                                 |
| Beta              | Invite redeemed once; market states enforced                           | Invite reused, expired, revoked; sign-up from a waitlist city; city moved from beta to live mid-sign-up                                                       | `markets.beta_requires_invite` off; `registration.open` off (kill switch)                                                                                   |
| Legal and privacy | Export, deletion and consent withdrawal complete within their periods  | Deletion requested during a suspension; legal hold placed after a deletion request                                                                            | `privacy.sla_days.*` changed by counsel                                                                                                                     |

Adjustable thresholds: rollout stage sizes and hold criteria, load level, alert thresholds,
`min_supported`.

## 10. Exit gate

- [ ] Every module plan MOD-00 to MOD-18 has its exit gate ticked, and every item in section 7.3
      is closed.
- [ ] J01–J22 pass on an iOS phone, an Android phone at the floor specification and a tablet,
      with evidence per device.
- [ ] Admin final QA [ADM §4] ticked in full.
- [ ] Website final QA [WEB §8] ticked in full, with the five sign-offs recorded.
- [ ] [TR §17.2] phase checks hold on the release candidate: phase 0 (staging deploys; schema
      tests green on PostgreSQL 16), phase 1 (sign up, get verified, match), phase 2 (purchase and
      chat on real devices in sandbox), phase 3 (Lagos usability round 1 passes), phase 4
      (penetration test, k6 load test, accessibility audit, DPIA, store review, private beta: no
      critical findings open).
- [ ] Every budget in [TR §15.1] is measured and met, or has an owner-accepted exception.
- [ ] Legal steps of section 7.5 are evidenced before the first real person's data.
- [ ] Production holds no sandbox revenue, no test member visible to real members, and no
      `TBD:*` product id on anything sold.
- [ ] `v_role_drift` and `v_admin_mfa_gaps` are empty; the audit chain verifies.
- [ ] Both stores have approved the release build; staged rollout is configured.
- [ ] Each rollback path has been rehearsed; the runbook is signed by the release lead.
- [ ] Restore drill meets RTO < 1 hour and RPO < 5 minutes.
- [ ] Paid hosting tiers are active before S2.
- [ ] Every gap in section 12, and every gap still open in any module plan, is resolved or
      accepted by the owner in writing.

## 11. Risks and open questions

| Risk or question                                                              | Effect                          | Handling                                                                                                       |
| ----------------------------------------------------------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Store review rejects the build (purchases, content moderation, deletion)      | Launch slips                    | Section 7.6 prepared early; submit to review during the beta, not at the end                                   |
| Free tiers during the beta: Neon sleep, Upstash command quota, Railway limits | Slow or failing requests        | Watch quotas; S2 requires paid tiers [TR §4.3]                                                                 |
| EU origin latency from Lagos                                                  | Budgets missed on real networks | Separate Lagos budget [TR §15.1]; measured on devices in Lagos, not only by k6                                 |
| Legal review or NDPC filing takes longer than engineering                     | No real users                   | Start section 7.5 when MOD-16 drafts exist; it gates S1, not S0                                                |
| Thin supply in Lagos at launch                                                | Empty decks                     | Scarcity card and ES1 use real numbers; no padding [TR §8.5]                                                   |
| Penetration test finds a design-level issue late                              | Rework                          | Run a first pass after MOD-10, the full test here (**Recommendation**)                                         |
| Lagos usability round fails its targets                                       | Phase 3 check not met           | Round 2 after fixes [UF §13.1]; launch waits                                                                   |
| Plans for MOD-11 to MOD-17 change the journey list                            | Missed carried items            | Reconciled in review (GAP-MOD19-05); sections 7.2 and 7.3 are re-read whenever one of those exit gates changes |

## 12. Gaps raised

Dispositions are recorded in [1MM-LOG-03](../1MM-LOG-03-TECHNICAL-REFERENCE-EXTENSIONS.md)
(Technical Reference and schema), [1MM-LOG-02](../1MM-LOG-02-UI-UPDATES.md) (UI) and
[1MM-LOG-04](../1MM-LOG-04-OPEN-DECISIONS-AND-FOLLOW-UPS.md) (owner decisions and repository
follow-ups).

| Gap id       | Type     | Where found                                                 | What is missing or conflicting                                                                                                                                                                          | Proposed resolution                                                                                                                                                                                                              | Blocks                                |
| ------------ | -------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| GAP-MOD19-01 | TR       | [TR §17.2] phase 4                                          | "Store review" is a deliverable with no checklist or owner in any source                                                                                                                                | Add the checklist of section 7.6 to the Technical Reference after checking it against the current store policies (settled by TRX-066)                                                                                            | MOD-19-OPS-06                         |
| GAP-MOD19-02 | DECISION | [TR §15.1], [TR §17.2]                                      | Latency budgets exist but no load level (concurrent members, messages per second, duration) for the k6 test                                                                                             | Owner sets the launch load target; **Recommendation:** size it from the "few thousand members" used for the cost estimate in [TR §15.2]                                                                                          | MOD-19-QA-03                          |
| GAP-MOD19-03 | TR       | [TR §5.3]                                                   | Device support names Android 9+ and iOS 15+ only; tablets are required by the owner but absent from the Technical Reference                                                                             | Add tablet support and the device matrix by reference to `1MM-STD-03-MOBILE-BUILD-STRATEGY.md` (settled by TRX-013)                                                                                                              | Nothing (the standard governs)        |
| GAP-MOD19-04 | DECISION | [TR §17.2] "private beta", [TR §4.3] "closed beta", [OD-09] | Two meanings of beta: a pre-launch private beta of the whole product, and the invite-only market state for Nigeria outside Lagos. Whether Lagos is open to anyone during the private beta is not stated | Owner confirms the stages of section 7.8                                                                                                                                                                                         | MOD-19-OPS-08                         |
| GAP-MOD19-05 | REPO     | `docs/execution/` on 24 Nov 2026                            | Plans MOD-11 to MOD-17 landed after the journey list was built: only their explicit MOD-19 references were added (section 7.3); their exit gates were not read against J01–J22                          | Coordinator or the next editor reconciles sections 7.2 and 7.3 with those seven exit gates and extends the tables. Done in review pass 1: J11 to J17 and J20 extended, carried items for MOD-11, MOD-13, MOD-16 and MOD-17 added | Nothing                               |
| GAP-MOD19-06 | TR       | [TR §17.3], [TR §5.1]                                       | "EAS staged rollouts" is stated without stage sizes, hold criteria or who may halt                                                                                                                      | Define them in `1MM-STD-03-MOBILE-BUILD-STRATEGY.md` and reference them from [TR §17.3] (settled by TRX-018)                                                                                                                     | Nothing (runbook sets them meanwhile) |

## Change log

| Version | Date        | Change                                                                                                                                                                                                                  |
| ------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| v1.0    | 24 Nov 2026 | First issue: journeys, final QA, independent checks, legal steps, store preparation, release, rollback and launch runbook. Journeys and carried items reconciled with the exit gates of MOD-11 to MOD-17 (GAP-MOD19-05) |
