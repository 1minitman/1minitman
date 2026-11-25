# 1MM-LOG-04 · Open decisions and follow-ups

|              |                                                                                                                                                                                                                                                               |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Document** | 1MM-LOG-04                                                                                                                                                                                                                                                    |
| **Status**   | Running log · started 24 Nov 2026 · v1.0                                                                                                                                                                                                                      |
| **Audience** | The owner and the people who answer for the owner (lawyer, design, trust-and-safety lead); engineers and coding agents                                                                                                                                        |
| **Owner**    | Engineering lead (code owners)                                                                                                                                                                                                                                |
| **Sources**  | The "Gaps raised" tables of every document under `docs/execution/`, `docs/standards/`, `docs/database/` and `docs/resources/`; the repository as it stands on 24 Nov 2026; [TR], [SQL], [OD-nn], [ADM], [WEB], [INV], [BG], [UF]                              |
| **Related**  | [1MM-LOG-01](1MM-LOG-01-PROGRESS.md), [1MM-LOG-02](1MM-LOG-02-UI-UPDATES.md), [1MM-LOG-03](1MM-LOG-03-TECHNICAL-REFERENCE-EXTENSIONS.md), [1MM-EXE-MOD-00](execution/1MM-EXE-MOD-00-FOUNDATIONS.md), [1MM-STD-02](standards/1MM-STD-02-AGENTIC-OPERATIONS.md) |

**What this document is for and when to open it.** Two registers built from the gaps the
documents raised. Part A lists the questions only the owner (or the lawyer, design or the
trust-and-safety lead) can answer, in the order the build reaches them. Part B lists the changes
the repository scaffold needs, each checked against the code. Open Part A before starting a
module, to see which answers it waits on; open Part B when planning MOD-00.

## 1. Summary

| Register                        | Entries                                                              | Gaps consolidated                                                                                                            |
| ------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Part A · Owner decisions needed | 51 (`DEC-001` to `DEC-051`)                                          | 52 of the 55 gaps whose type includes DECISION (GAP-EXE00-01 to -03 were resolved by task assignment in the master plan §13) |
| Part B · Repository follow-ups  | 60 (`REP-001` to `REP-060`) and 2 checked items (`CHK-01`, `CHK-02`) | 71 gaps of type REPO                                                                                                         |

Decisions by the point at which the build reaches them:

| Needed by | Now | MOD-00 | MOD-01 | MOD-02 | MOD-03 | MOD-04 | MOD-06 | MOD-07 | MOD-09 | MOD-10 | MOD-11 | MOD-12 | MOD-13 | MOD-14 | MOD-15 | MOD-16 | MOD-17 | MOD-18 | MOD-19 |
| --------- | --- | ------ | ------ | ------ | ------ | ------ | ------ | ------ | ------ | ------ | ------ | ------ | ------ | ------ | ------ | ------ | ------ | ------ | ------ |
| Decisions | 1   | 6      | 3      | 4      | 3      | 3      | 2      | 1      | 1      | 3      | 2      | 2      | 4      | 4      | 1      | 3      | 2      | 1      | 3      |

9 decisions are legal questions and are marked "needs the lawyer's confirmation": DEC-001, DEC-021, DEC-023, DEC-035, DEC-039, DEC-041, DEC-042, DEC-043, DEC-049.

Repository follow-ups by size: 39 small, 20 medium, 1 large.

## 2. How to use and update this log

1. **Answering a decision.** The person named under "Who answers" writes the answer in the
   entry (a line **Answer**, with the date and who gave it) and sets **Status** to `Answered`.
   Where the standing instruction to apply recommended defaults is used, write "default applied"
   and the date. An answer that changes the product is also recorded as an ADR.
2. **Acting on an answer.** The engineer who owns the blocked task carries the answer into the
   module plan; any Technical Reference or schema consequence goes to
   [1MM-LOG-03](1MM-LOG-03-TECHNICAL-REFERENCE-EXTENSIONS.md) and any board consequence to
   [1MM-LOG-02](1MM-LOG-02-UI-UPDATES.md) (its section 8 lists the decisions that change a board).
3. **Building before an answer.** **Recommendation:** a module may be built to the recommended default only where
   the entry gives one and it is reversible without a migration; otherwise the blocked task waits.
   Legal questions are never settled by a default.
4. **Closing a repository follow-up.** The pull request that makes the change names the `REP` id;
   when it merges, set **Status** to `Done` with the pull request number.
5. **Adding entries.** Raise the gap in the source document first (type `DECISION` or `REPO`),
   then add an entry here with the next free number and add the gap to the index in Part C.
   Numbers are never reused. For a `REPO` gap, read the file it names before listing it; if the
   claim is wrong, list it under "Checked and not needed" with the reason.
6. This repository is public. Entries are engineering questions only; answers that contain
   commercial terms, contracts or personal details are kept outside the repository and the entry
   records only that the answer exists and what the build must do.

## Part A · Owner decisions needed

Ordered by when the execution sequence (MOD-00 to MOD-19) reaches the blocked work. "Now" means
the question is already live. All entries are **Open**.

### A.1 Overview

| Id      | Needed by      | Question                                                                                                                                                                                                                                    | Who answers                                                |
| ------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| DEC-001 | Now            | On what terms may other people use, copy and contribute to the code in this public repository?                                                                                                                                              | Owner; needs the lawyer's confirmation                     |
| DEC-002 | MOD-00         | When Redis is unreachable, should the rate limiter refuse requests on the lockout policies instead of letting them through?                                                                                                                 | Owner (engineering lead may answer)                        |
| DEC-003 | MOD-00         | Which error-tracking set-up do the five apps use, given that the free Sentry plan is for a single user?                                                                                                                                     | Owner                                                      |
| DEC-004 | MOD-00         | Are the coverage floors and the flaky-test policy proposed in the testing strategy the ones CI should enforce?                                                                                                                              | Owner or engineering lead                                  |
| DEC-005 | MOD-00         | Do phones support landscape?                                                                                                                                                                                                                | Owner, with design                                         |
| DEC-006 | MOD-00         | What does the "Help" item in the admin console's top bar open, given that the admin spec it points to is private and not hosted?                                                                                                            | Owner                                                      |
| DEC-007 | MOD-00         | Are over-the-air updates code-signed from the first public build? Signing needs a paid Expo plan tier, while the hosting decisions prefer free tiers [OD-06].                                                                               | Owner                                                      |
| DEC-008 | MOD-01         | How is e-mail to staff (invite link, security alert) sent, given that the template catalogue and the notification outbox have no staff recipient?                                                                                           | Owner                                                      |
| DEC-009 | MOD-01         | Which outside services supply (a) the country, city and network of an IP address for the impossible-travel rule and (b) the breached-password check?                                                                                        | Owner                                                      |
| DEC-010 | MOD-01         | Is the permission scope kind `own` used at launch?                                                                                                                                                                                          | Owner                                                      |
| DEC-011 | MOD-02         | Which switch decides whether a language is offered, in the app and on the website?                                                                                                                                                          | Owner                                                      |
| DEC-012 | MOD-02         | Which record is the authority for maintenance mode: `maintenance_windows` or `site_settings.maintenance`?                                                                                                                                   | Owner                                                      |
| DEC-013 | MOD-02         | How are the admin console's own strings managed, given that the console is English only but the owner requires its constants to be admin-managed?                                                                                           | Owner                                                      |
| DEC-014 | MOD-02         | In French, are prices written in the brand format (`$2.50`) or in French locale format?                                                                                                                                                     | Owner, with the French reviewer                            |
| DEC-015 | MOD-03         | Is the password rule a length minimum plus a breached-password check only, or does it also require letters and numbers?                                                                                                                     | Owner                                                      |
| DEC-016 | MOD-03         | Does version 1 offer the optional OLED theme that the tokens define?                                                                                                                                                                        | Owner, with design                                         |
| DEC-017 | MOD-03         | Can a member change their e-mail address in the app in version 1?                                                                                                                                                                           | Owner                                                      |
| DEC-018 | MOD-04         | Premium profile sections (P1–P4, GD4) are filled in before payment: does the API accept and store them from any verified member, and may uploads go up to the target plan's cap during an open upgrade?                                     | Owner                                                      |
| DEC-019 | MOD-04         | Which providers do the media jobs use for face comparison of profile media, image moderation, the AI-generated score, the colour-filter check and transcription, and what are the thresholds for match, no match and manual review?         | Owner, with the trust-and-safety lead                      |
| DEC-020 | MOD-04         | Which moderation outcomes get their own member notification: media rejected, prompt removed, account banned, account unbanned?                                                                                                              | Owner, with the trust-and-safety lead                      |
| DEC-021 | MOD-06         | When a member withdraws Black Badge consent (PM4): (a) is it intended that a Premium or Gold member drops to the basic role while billing continues; (b) does verifying again need a new payment; (c) when is the status `withdrawn` set?   | Owner; the consent wording needs the lawyer's confirmation |
| DEC-022 | MOD-06         | When is the carrier (mobile network) check scheduled, and through which vendor?                                                                                                                                                             | Owner                                                      |
| DEC-023 | MOD-07         | Does "Share profile" on D4 ship, and if so what does a shared link expose and does the shared member consent?                                                                                                                               | Owner; needs the lawyer's confirmation                     |
| DEC-024 | MOD-09         | What are the steps and look-back periods of the sanctions ladder for each category, and are the extra action verbs on the board kept?                                                                                                       | Owner and the trust-and-safety lead                        |
| DEC-025 | MOD-10         | On the web checkout, is card data entered only in the payment provider's hosted or inline fields, so that only a token reaches our API?                                                                                                     | Owner                                                      |
| DEC-026 | MOD-10         | How is the "one trial per verified person" rule kept on the app stores, where an introductory offer is granted per store account?                                                                                                           | Owner                                                      |
| DEC-027 | MOD-10         | What are the real App Store and Google Play product ids and the Flutterwave payment-plan ids?                                                                                                                                               | Owner                                                      |
| DEC-028 | MOD-11         | Can staff send newsletter issues to subscribers at launch?                                                                                                                                                                                  | Owner                                                      |
| DEC-029 | MOD-11         | With discreet mode off, what may a push notification show on the lock screen?                                                                                                                                                               | Owner, with the trust-and-safety lead                      |
| DEC-030 | MOD-12         | What does the group share link `1minitman.com/g/<slug>` open, given that the website is information-only?                                                                                                                                   | Owner                                                      |
| DEC-031 | MOD-12         | What happens to the groups a member owns when their plan lapses below the ownership limit?                                                                                                                                                  | Owner                                                      |
| DEC-032 | MOD-13         | Who hosts and builds the public trusted-contact page at `1minitman.com/s/<token>`?                                                                                                                                                          | Owner                                                      |
| DEC-033 | MOD-13         | Does "Talk to our safety team" on H2 raise a safety escalation or open support chat?                                                                                                                                                        | Owner, with the trust-and-safety lead                      |
| DEC-034 | MOD-13         | Do check-ins, `POST /v1/safety/help`, the trusted-contact page and the escalation job keep working during maintenance and read-only windows, and does an urgent website safety report raise a desk escalation?                              | Owner, with the trust-and-safety lead                      |
| DEC-035 | MOD-13         | Is it accepted that member e-mail, phone, birth date, message bodies and trusted-contact phone numbers are stored in clear (protected by at-rest encryption, roles and row-level security), while non-member addresses are field-encrypted? | Owner and the interim DPO; needs the lawyer's confirmation |
| DEC-036 | MOD-14         | How are website uploads virus-scanned, given that a resident ClamAV daemon needs about 3 GiB of memory and so an always-on service the lean-hosting decisions did not plan for?                                                             | Owner                                                      |
| DEC-037 | MOD-14         | How does a help e-mail become a support ticket, given that there is no inbound e-mail webhook?                                                                                                                                              | Owner                                                      |
| DEC-038 | MOD-14         | Do support chat attachments ship?                                                                                                                                                                                                           | Owner                                                      |
| DEC-039 | MOD-14         | How is a "was this helpful" vote from the website stored, when the row needs an anonymous device hash and the site keeps no device id?                                                                                                      | Owner and the interim DPO; needs the lawyer's confirmation |
| DEC-040 | MOD-15         | Are the careers, press and investor-documents collections English only at launch?                                                                                                                                                           | Owner                                                      |
| DEC-041 | MOD-16         | What is the effect of a privacy request of kind `object` or `restrict_processing`?                                                                                                                                                          | Owner and the lawyer; needs the lawyer's confirmation      |
| DEC-042 | MOD-16         | What are the consent-receipt retention period, the confirmed privacy response deadlines (`privacy.sla_days.*`) and the NDPC registration reference?                                                                                         | Lawyer, through the owner; needs the lawyer's confirmation |
| DEC-043 | MOD-16         | Must a material change to a legal document also be announced by e-mail, for members who do not open the app?                                                                                                                                | Owner; needs the lawyer's confirmation                     |
| DEC-044 | MOD-17         | What are the starting values of the eight security detection thresholds (`security.detect.*`), and what is their JSON shape?                                                                                                                | Owner                                                      |
| DEC-045 | MOD-17         | Who owns a security incident, who are the deputies, and who notifies the regulator and members?                                                                                                                                             | Owner                                                      |
| DEC-046 | MOD-18         | What is the "active members" denominator for the per-1,000 safety rates?                                                                                                                                                                    | Owner, with the trust-and-safety lead                      |
| DEC-047 | MOD-19         | What load level must the launch load test reach (concurrent members, messages per second, duration)?                                                                                                                                        | Owner                                                      |
| DEC-048 | MOD-19         | What are the beta stages: is the pre-launch private beta of the whole product separate from the invite-only market state, and is Lagos open to anyone during the private beta?                                                              | Owner                                                      |
| DEC-049 | MOD-19         | Who approves the store privacy declarations (App Store privacy details, Google Play data safety) and the age rating?                                                                                                                        | Owner and the interim DPO; needs the lawyer's confirmation |
| DEC-050 | MOD-10, MOD-15 | When the deferred offers scope (admin module A22, the three `offers.*` jobs, website W24) or the optional website sections W19 are switched on, who schedules them and under which task ids?                                                | Owner                                                      |
| DEC-051 | MOD-18, MOD-19 | Who runs Lagos usability round 1 (the Technical Reference phase 3 exit check), and on which build?                                                                                                                                          | Owner                                                      |

### A.2 Entries

#### Needed now

**DEC-001** · On what terms may other people use, copy and contribute to the code in this public repository?

- **Options:** (a) Keep the code proprietary: add a `LICENSE` file that reserves all rights, with a line on how contributions are accepted. (b) Choose an open-source licence.
- **Recommended default:** (a), until the owner decides otherwise. The root README's Licence section is updated in the same pull request as the file.
- **Blocks:** Nothing in the build. Accepting outside contributions waits for it ([1MM-STD-08](standards/1MM-STD-08-CONTRIBUTING.md) §9).
- **Who answers:** Owner; needs the lawyer's confirmation
- **Gaps:** GAP-STD05-01
- **Status:** Open

#### Needed by MOD-00

**DEC-002** · When Redis is unreachable, should the rate limiter refuse requests on the lockout policies instead of letting them through?

- **Options:** (a) Fail closed for `otp.verify.sms`, `otp.verify.email`, `login.account` and `admin.login`; fail open for every other policy. (b) Fail open everywhere, as the scaffold does today (`apps/api/src/platform/rate-limit/middleware.ts`).
- **Recommended default:** (a). Failing open on the lockout policies leaves a brute-force window during an outage.
- **Blocks:** `MOD-00-API-03` (rate-limit policy loader, lockouts)
- **Who answers:** Owner (engineering lead may answer)
- **Gaps:** GAP-STD16-04
- **Status:** Open

**DEC-003** · Which error-tracking set-up do the five apps use, given that the free Sentry plan is for a single user?

- **Options:** (1) Start on Sentry's free plan with alerts routed to the shared alert channel, and move to the team plan before the private beta. (2) Self-host GlitchTip as an always-on service.
- **Recommended default:** (1). Create the Sentry organisation in the EU region from the start, because the region cannot be changed later; add the chosen line to the paid-tier list in [TR §4.3].
- **Blocks:** `MOD-00-API-09`, `MOD-00-OPS-06`, `MOD-19-OPS-04`
- **Who answers:** Owner
- **Gaps:** GAP-RES01-02
- **Status:** Open

**DEC-004** · Are the coverage floors and the flaky-test policy proposed in the testing strategy the ones CI should enforce?

- **Options:** (a) Confirm the floors in [1MM-STD-01](standards/1MM-STD-01-TESTING-STRATEGY.md) §4.1 and the retry and quarantine rules in §4.3. (b) Set other numbers.
- **Recommended default:** (a). They are the document's own recommendations, not owner-set numbers.
- **Blocks:** Enforcing coverage in CI (`MOD-00-API-01`, `MOD-00-ADM-02`, `MOD-00-MOB-01`)
- **Who answers:** Owner or engineering lead
- **Gaps:** GAP-STD01-11
- **Status:** Open

**DEC-005** · Do phones support landscape?

- **Options:** (a) Phones are portrait only, except full-screen media and calls; tablets rotate freely. (b) Phones rotate on every screen.
- **Recommended default:** (a). No source addresses phone landscape; the scaffold is portrait only.
- **Blocks:** [1MM-STD-03](standards/1MM-STD-03-MOBILE-BUILD-STRATEGY.md) §3.3; the orientation setting in `MOD-00-MOB-01`
- **Who answers:** Owner, with design
- **Gaps:** GAP-STD03-07
- **Status:** Open

**DEC-006** · What does the "Help" item in the admin console's top bar open, given that the admin spec it points to is private and not hosted?

- **Options:** (a) Remove the item. (b) Point it at staff help articles managed in A27 with a staff-only audience.
- **Recommended default:** None stated in the gap. **Recommendation:** (a) for the first release, (b) when staff articles exist.
- **Blocks:** One top-bar item in A04 (`MOD-00-ADM-02`)
- **Who answers:** Owner
- **Gaps:** GAP-MOD00-08
- **Status:** Open

**DEC-007** · Are over-the-air updates code-signed from the first public build? Signing needs a paid Expo plan tier, while the hosting decisions prefer free tiers [OD-06].

- **Options:** (a) Take the plan before the first public build and sign updates. (b) Launch unsigned, with the compensating controls of [1MM-STD-19](standards/1MM-STD-19-OTA-UPDATES.md) §7 recorded as an accepted risk.
- **Recommended default:** (a).
- **Blocks:** Update configuration in `MOD-00-MOB-01`; must be settled before the first public build (MOD-19)
- **Who answers:** Owner
- **Gaps:** GAP-STD19-04
- **Status:** Open

#### Needed by MOD-01

**DEC-008** · How is e-mail to staff (invite link, security alert) sent, given that the template catalogue and the notification outbox have no staff recipient?

- **Options:** (1) Extend the outbox: add `admin` to the `notifications.recipient_kind` CHECK and seed two templates (the DDL is in the gap and in [1MM-LOG-03](1MM-LOG-03-TECHNICAL-REFERENCE-EXTENSIONS.md)). (2) Send staff e-mail directly from the API with copy from `i18n_strings`, recorded in the audit log.
- **Recommended default:** (1), so the outbox rule of [TR §4.2] holds for every message.
- **Blocks:** Invite e-mail in `MOD-01-API-08`
- **Who answers:** Owner
- **Gaps:** GAP-MOD01-07
- **Status:** Open

**DEC-009** · Which outside services supply (a) the country, city and network of an IP address for the impossible-travel rule and (b) the breached-password check?

- **Options:** For (a): Cloudflare's visitor-location request headers (no new vendor), or a separate IP-location provider. For (b): one k-anonymity range API shared by the admin and member APIs, or none.
- **Recommended default:** Cloudflare headers for location and network [OD-06]; one k-anonymity range API shared with MOD-03. Each adds an external dependency, so the owner confirms both.
- **Blocks:** Alert rules in `MOD-01-API-09`; the password check in `MOD-03-API-01`
- **Who answers:** Owner
- **Gaps:** GAP-MOD01-08
- **Status:** Open

**DEC-010** · Is the permission scope kind `own` used at launch?

- **Options:** (a) Not used: the API refuses it. (b) Used: name the permissions whose `allowed_scopes` include it.
- **Recommended default:** (a). The value is in `scope_kind_t`, but no seeded permission lists it and the A05 grant form does not offer it.
- **Blocks:** Nothing
- **Who answers:** Owner
- **Gaps:** GAP-MOD01-12
- **Status:** Open

#### Needed by MOD-02

**DEC-011** · Which switch decides whether a language is offered, in the app and on the website?

- **Options:** (a) App locales = `languages.is_app_locale` and the flag `locale.<code>` (`en` always on); website locales = `site_settings.locales[].enabled`; the two may differ. (b) One switch for both.
- **Recommended default:** (a). `locale.fr` is off for the app while the website launches core pages in French, so the two already differ.
- **Blocks:** OB2 (`MOD-02-MOB-03`), W04 (`MOD-02-WEB-01`)
- **Who answers:** Owner
- **Gaps:** GAP-MOD02-06
- **Status:** Open

**DEC-012** · Which record is the authority for maintenance mode: `maintenance_windows` or `site_settings.maintenance`?

- **Options:** (a) `maintenance_windows` is the authority for the app, the web app and API read-only mode; `site_settings.maintenance` is the website's own lighter switch; `GET /public/v1/config` reports maintenance when either is active for `web`; the OB1 link uses `maintenance_windows.status_page_url`. (b) A single source for all surfaces.
- **Recommended default:** (a).
- **Blocks:** `MOD-02-API-03`, `MOD-02-API-04`
- **Who answers:** Owner
- **Gaps:** GAP-MOD02-08
- **Status:** Open

**DEC-013** · How are the admin console's own strings managed, given that the console is English only but the owner requires its constants to be admin-managed?

- **Options:** (a) Keep the console English only and hold its strings in `i18n_strings` under an `admin.` prefix (locale `en`), edited in A25. (b) Keep them in code. (c) Translate the console.
- **Recommended default:** (a).
- **Blocks:** `MOD-02-ADM-01` onwards
- **Who answers:** Owner
- **Gaps:** GAP-MOD02-10
- **Status:** Open

**DEC-014** · In French, are prices written in the brand format (`$2.50`) or in French locale format?

- **Options:** (a) Keep the brand format in every locale. (b) Use locale currency formatting in `fr`.
- **Recommended default:** (a), until `locale.fr` is turned on for the app.
- **Blocks:** The French launch set; not needed while `locale.fr` is off
- **Who answers:** Owner, with the French reviewer
- **Gaps:** GAP-STD17-02
- **Status:** Open

#### Needed by MOD-03

**DEC-015** · Is the password rule a length minimum plus a breached-password check only, or does it also require letters and numbers?

- **Options:** (a) Length and breach check only [TR §13.2], [OD-07]; correct the board text on PM7, E5 and R3. (b) Add a composition rule as the board text says.
- **Recommended default:** (a).
- **Blocks:** `MOD-03-API-01`
- **Who answers:** Owner
- **Gaps:** GAP-MOD03-11
- **Status:** Open

**DEC-016** · Does version 1 offer the optional OLED theme that the tokens define?

- **Options:** (a) Leave it out. (b) Add it: `ALTER TYPE theme_t ADD VALUE 'oled';` and a fourth option on the D17 theme row.
- **Recommended default:** (a). `user_settings.theme` stores only system, light and dark.
- **Blocks:** D17 theme row (`MOD-03-MOB-08`)
- **Who answers:** Owner, with design
- **Gaps:** GAP-MOD03-12
- **Status:** Open

**DEC-017** · Can a member change their e-mail address in the app in version 1?

- **Options:** (a) No: support handles it. (b) Yes: specify the screen and a `POST /v1/me/email` flow (the schema already has a change-e-mail OTP purpose).
- **Recommended default:** (a).
- **Blocks:** Nothing at launch
- **Who answers:** Owner
- **Gaps:** GAP-MOD03-13
- **Status:** Open

#### Needed by MOD-04

**DEC-018** · Premium profile sections (P1–P4, GD4) are filled in before payment: does the API accept and store them from any verified member, and may uploads go up to the target plan's cap during an open upgrade?

- **Options:** (a) Accept and store premium-section writes from any verified member, and show and use them only while the entitlement is held; accept media up to the target plan's cap during an open upgrade flow and keep extras hidden (new `hidden_reason` value `pending_upgrade`); "Skip for now" leaves the media step open. (b) Refuse the writes until the plan is paid and reorder the flow.
- **Recommended default:** (a). It matches "kept and restored on re-subscribe" [UF §10.3].
- **Blocks:** `MOD-04-API-02`, `MOD-04-API-04`, `MOD-04-MOB-04`
- **Who answers:** Owner
- **Gaps:** GAP-MOD04-02
- **Status:** Open

**DEC-019** · Which providers do the media jobs use for face comparison of profile media, image moderation, the AI-generated score, the colour-filter check and transcription, and what are the thresholds for match, no match and manual review?

- **Options:** Providers chosen within the lean-hosting rule [OD-06], [OD-11]. Thresholds are then seeded as config keys, for example `media.face_match.match_min` and `media.face_match.review_min`.
- **Recommended default:** None stated: the owner chooses.
- **Blocks:** `MOD-04-WRK-01`, `MOD-04-WRK-02`
- **Who answers:** Owner, with the trust-and-safety lead
- **Gaps:** GAP-MOD04-04
- **Status:** Open

**DEC-020** · Which moderation outcomes get their own member notification: media rejected, prompt removed, account banned, account unbanned?

- **Options:** For media rejected and prompt removed: (a) add two templates in MOD-11 (category `account`, push and in-app), or (b) an in-app inbox item only. For ban and unban: (a) reuse N36 "Account suspended" with a ban message key, or (b) add a template in MOD-11.
- **Recommended default:** None stated: the owner decides. A13 already says the member is told, so some notice is required.
- **Blocks:** MOD-04 rules 17 and 19; the ban notification in MOD-05 (`MOD-05-ADM-03`)
- **Who answers:** Owner, with the trust-and-safety lead
- **Gaps:** GAP-MOD04-06, GAP-MOD05-04
- **Status:** Open

#### Needed by MOD-06

**DEC-021** · When a member withdraws Black Badge consent (PM4): (a) is it intended that a Premium or Gold member drops to the basic role while billing continues; (b) does verifying again need a new payment; (c) when is the status `withdrawn` set?

- **Options:** Answer each part. The gap's proposal: warn with the plan named and link to BL1; re-verify without a new charge, reusing the original transaction; set `withdrawn` on an open application when consent is withdrawn mid-flow.
- **Recommended default:** The proposal above.
- **Blocks:** `MOD-06-API-06` (copy and re-entry)
- **Who answers:** Owner; the consent wording needs the lawyer's confirmation
- **Gaps:** GAP-MOD06-05
- **Status:** Open

**DEC-022** · When is the carrier (mobile network) check scheduled, and through which vendor?

- **Options:** Mobile-network APIs directly, or an aggregator; the feature is deferred [OD-06], so the open point is the date.
- **Recommended default:** None stated: decide when the check is scheduled after launch.
- **Blocks:** `MOD-06-API-09` only
- **Who answers:** Owner
- **Gaps:** GAP-MOD06-10
- **Status:** Open

#### Needed by MOD-07

**DEC-023** · Does "Share profile" on D4 ship, and if so what does a shared link expose and does the shared member consent?

- **Options:** (a) Keep the action hidden behind a new kill-switch flag `profile.share`, seeded off, until the privacy decision. (b) Define the link, its content and the consent rule, and build it.
- **Recommended default:** (a).
- **Blocks:** The D4 share action only (`MOD-07-MOB-05`)
- **Who answers:** Owner; needs the lawyer's confirmation
- **Gaps:** GAP-MOD07-03
- **Status:** Open

#### Needed by MOD-09

**DEC-024** · What are the steps and look-back periods of the sanctions ladder for each category, and are the extra action verbs on the board kept?

- **Options:** Set steps and look-back days per category (only `minor` is seeded). Verbs: (a) keep warn / restrict / suspend / ban only and correct the board; (b) add "Remove content + warning", "Remove photos + re-verify", "Restrict payments".
- **Recommended default:** (a) for the verbs. The steps and look-backs must be set before the beta.
- **Blocks:** MOD-09 exit gate; `MOD-09-ADM-03`
- **Who answers:** Owner and the trust-and-safety lead
- **Gaps:** GAP-MOD09-13
- **Status:** Open

#### Needed by MOD-10

**DEC-025** · On the web checkout, is card data entered only in the payment provider's hosted or inline fields, so that only a token reaches our API?

- **Options:** (a) Yes: Flutterwave-hosted or inline fields only; state it in [TR §4.6]. (b) Our own card fields posting to our API, which puts the origin in card-data scope.
- **Recommended default:** (a).
- **Blocks:** Web checkout (`MOD-10-WEB-01`)
- **Who answers:** Owner
- **Gaps:** GAP-MOD10-06
- **Status:** Open

**DEC-026** · How is the "one trial per verified person" rule kept on the app stores, where an introductory offer is granted per store account?

- **Options:** (a) Sell the trial through an offer only our server can authorise for an eligible member, and a no-trial price otherwise; confirm each store's current mechanism during the build. (b) Accept the stores' per-account rule.
- **Recommended default:** (a).
- **Blocks:** BL7 on the stores (`MOD-10-MOB-03`)
- **Who answers:** Owner
- **Gaps:** GAP-MOD10-07
- **Status:** Open

**DEC-027** · What are the real App Store and Google Play product ids and the Flutterwave payment-plan ids?

- **Options:** The owner supplies them; they are loaded as price versions [OD-12].
- **Recommended default:** Not applicable: values to supply.
- **Blocks:** Every sandbox purchase test in MOD-10
- **Who answers:** Owner
- **Gaps:** GAP-MOD10-12
- **Status:** Open

#### Needed by MOD-11

**DEC-028** · Can staff send newsletter issues to subscribers at launch?

- **Options:** (a) Add "newsletter subscribers by topic and locale" as a broadcast audience in A26 (recipient kind `newsletter`, same approval). (b) Keep the list collect-only at launch.
- **Recommended default:** None stated: the owner decides.
- **Blocks:** Sending newsletter issues (`MOD-11-ADM-02`)
- **Who answers:** Owner
- **Gaps:** GAP-MOD11-07
- **Status:** Open

**DEC-029** · With discreet mode off, what may a push notification show on the lock screen?

- **Options:** (a) A title may carry the other member's nickname; no push ever carries message text, a real name, or a detail of a security or billing event; the wording still to be written follows this. (b) A different rule.
- **Recommended default:** (a).
- **Blocks:** Template wording (`MOD-11-DB-01`), native-language review
- **Who answers:** Owner, with the trust-and-safety lead
- **Gaps:** GAP-STD18-02
- **Status:** Open

#### Needed by MOD-12

**DEC-030** · What does the group share link `1minitman.com/g/<slug>` open, given that the website is information-only?

- **Options:** (a) A universal link that opens D13A in the app and otherwise redirects through `/get`; no public group page in version 1. (b) A public group page. Until decided, GC5 ships without the share link.
- **Recommended default:** (a).
- **Blocks:** `MOD-12-MOB-02`
- **Who answers:** Owner
- **Gaps:** GAP-MOD12-08
- **Status:** Open

**DEC-031** · What happens to the groups a member owns when their plan lapses below the ownership limit?

- **Options:** (a) Existing groups stay; the owner cannot create more and cannot post without the `groups.post` entitlement (the room continues for members); staff may transfer. (b) Groups are paused or must be transferred.
- **Recommended default:** (a).
- **Blocks:** `MOD-12-WRK-01`; the lapse work in MOD-10
- **Who answers:** Owner
- **Gaps:** GAP-MOD12-12
- **Status:** Open

#### Needed by MOD-13

**DEC-032** · Who hosts and builds the public trusted-contact page at `1minitman.com/s/<token>`?

- **Options:** (a) A static shell in `apps/site` with a Cloudflare Pages rewrite for `/s/*`, rendering from `GET /public/v1/share/{token}`; correct the stale paths in the website spec and the inventory; add the page to [TR §6.1]. (b) A page served by the API.
- **Recommended default:** (a).
- **Blocks:** `MOD-13-WEB-01`
- **Who answers:** Owner
- **Gaps:** GAP-MOD13-01
- **Status:** Open

**DEC-033** · Does "Talk to our safety team" on H2 raise a safety escalation or open support chat?

- **Options:** (a) It opens support chat H1B with the safety topic; only "I need help" raises an escalation. (b) It raises a `need_help` escalation.
- **Recommended default:** (a).
- **Blocks:** `MOD-13-API-04`; `MOD-13-MOB-01`, `MOD-13-MOB-04`
- **Who answers:** Owner, with the trust-and-safety lead
- **Gaps:** GAP-MOD13-04
- **Status:** Open

**DEC-034** · Do check-ins, `POST /v1/safety/help`, the trusted-contact page and the escalation job keep working during maintenance and read-only windows, and does an urgent website safety report raise a desk escalation?

- **Options:** (a) The safety paths are exempt from maintenance and read-only mode, on the reasoning of [OD-32], and an urgent W34 report raises an `urgent_report` escalation. (b) They pause with everything else.
- **Recommended default:** (a).
- **Blocks:** `MOD-13-API-04`, `MOD-13-API-06`; W34 in MOD-14 (`MOD-14-WEB-03`)
- **Who answers:** Owner, with the trust-and-safety lead
- **Gaps:** GAP-MOD13-12
- **Status:** Open

**DEC-035** · Is it accepted that member e-mail, phone, birth date, message bodies and trusted-contact phone numbers are stored in clear (protected by at-rest encryption, roles and row-level security), while non-member addresses are field-encrypted?

- **Options:** (a) Confirm the current design as accepted: searchable identity columns stay in clear. (b) Ask for field-level encryption of `trusted_contacts.phone` first (third-party data, never searched).
- **Recommended default:** None stated: the owner and the interim DPO confirm one.
- **Blocks:** The DPIA in MOD-19; if (b), the trusted-contact work in `MOD-13-API-05`
- **Who answers:** Owner and the interim DPO; needs the lawyer's confirmation
- **Gaps:** GAP-STD12-05
- **Status:** Open

#### Needed by MOD-14

**DEC-036** · How are website uploads virus-scanned, given that a resident ClamAV daemon needs about 3 GiB of memory and so an always-on service the lean-hosting decisions did not plan for?

- **Options:** (1) Run ClamAV as its own always-on service. (2) Re-encode every image with `sharp` and scan only document uploads (CVs) with ClamAV started on demand by the scan job, after a one-day spike measures time and memory. (3) A hosted scanning API, which adds a data processor.
- **Recommended default:** (2).
- **Blocks:** `MOD-14-WRK-01`, `MOD-15-API-09`
- **Who answers:** Owner
- **Gaps:** GAP-RES01-01
- **Status:** Open

**DEC-037** · How does a help e-mail become a support ticket, given that there is no inbound e-mail webhook?

- **Options:** (a) Staff create e-mail tickets by hand through a new admin route `POST /admin/v1/support/tickets`. (b) Add inbound e-mail parsing later.
- **Recommended default:** (a) for launch.
- **Blocks:** The e-mail channel only (`MOD-14-ADM-01`)
- **Who answers:** Owner
- **Gaps:** GAP-MOD14-04
- **Status:** Open

**DEC-038** · Do support chat attachments ship?

- **Options:** (a) No, deferred. (b) Yes: `ALTER TYPE media_kind_t ADD VALUE 'support_attachment';`, an attach control on H1B, and reuse of the shared upload URL.
- **Recommended default:** None stated: the owner decides; the item is treated as deferred until then.
- **Blocks:** Deferred item (`MOD-14-MOB-03`, `MOD-14-ADM-01`)
- **Who answers:** Owner
- **Gaps:** GAP-MOD14-07
- **Status:** Open

**DEC-039** · How is a "was this helpful" vote from the website stored, when the row needs an anonymous device hash and the site keeps no device id?

- **Options:** (a) Hash a random per-visit id held in `sessionStorage` (strictly necessary, not a fingerprint). (b) Do not record website votes.
- **Recommended default:** (a).
- **Blocks:** The vote in `MOD-14-WEB-01`
- **Who answers:** Owner and the interim DPO; needs the lawyer's confirmation
- **Gaps:** GAP-MOD14-12
- **Status:** Open

#### Needed by MOD-15

**DEC-040** · Are the careers, press and investor-documents collections English only at launch?

- **Options:** (a) Yes: the tables have no `locale` column and non-core pages may fall back to English [WEB §3.8]. (b) Add `locale` and `translation_group_id` columns now.
- **Recommended default:** (a); add locale columns later if needed.
- **Blocks:** Nothing at launch
- **Who answers:** Owner
- **Gaps:** GAP-MOD15-06
- **Status:** Open

#### Needed by MOD-16

**DEC-041** · What is the effect of a privacy request of kind `object` or `restrict_processing`?

- **Options:** (a) Without new DDL: withdraw the `marketing`, `research` and `analytics` consents, hide the profile, and record the request in `notes`. (b) Add a flag: `ALTER TABLE users ADD COLUMN processing_restricted_at timestamptz;` and define what it stops.
- **Recommended default:** (a) as the default until counsel defines the effect.
- **Blocks:** Completing those two request kinds in A36 (`MOD-16-ADM-02`)
- **Who answers:** Owner and the lawyer; needs the lawyer's confirmation
- **Gaps:** GAP-MOD16-08
- **Status:** Open

**DEC-042** · What are the consent-receipt retention period, the confirmed privacy response deadlines (`privacy.sla_days.*`) and the NDPC registration reference?

- **Options:** Values to supply after the legal review [OD-31], [OD-38], [OD-10]. The retention period needs a new config key `consent_receipts.retention_days`, seeded as null until then.
- **Recommended default:** Not applicable: values to supply; the current deadlines stay provisional.
- **Blocks:** Production launch
- **Who answers:** Lawyer, through the owner; needs the lawyer's confirmation
- **Gaps:** GAP-MOD16-10
- **Status:** Open

**DEC-043** · Must a material change to a legal document also be announced by e-mail, for members who do not open the app?

- **Options:** (a) No: the in-app sheet and the website banner are enough. (b) Yes: add a template through MOD-11.
- **Recommended default:** None stated: the owner decides.
- **Blocks:** Nothing
- **Who answers:** Owner; needs the lawyer's confirmation
- **Gaps:** GAP-MOD16-11
- **Status:** Open

#### Needed by MOD-17

**DEC-044** · What are the starting values of the eight security detection thresholds (`security.detect.*`), and what is their JSON shape?

- **Options:** Values are approved after a staging baseline. Shape proposed: `{"window_seconds": int, "threshold": int, "min_distinct": int | null}`, validated in `packages/contracts`.
- **Recommended default:** The proposed shape; values after the baseline. All eight are null today.
- **Blocks:** A32 checklist item 3 (`MOD-17-ADM-02`)
- **Who answers:** Owner
- **Gaps:** GAP-MOD17-07
- **Status:** Open

**DEC-045** · Who owns a security incident, who are the deputies, and who notifies the regulator and members?

- **Options:** The owner names the incident owner and deputies; MOD-17 then writes the three playbooks, with severity definitions and the on-call rota.
- **Recommended default:** Not applicable: names to supply.
- **Blocks:** The MOD-19 launch gate
- **Who answers:** Owner
- **Gaps:** GAP-STD11-11
- **Status:** Open

#### Needed by MOD-18

**DEC-046** · What is the "active members" denominator for the per-1,000 safety rates?

- **Options:** (a) Members with `users.last_active_at` in the period (operational data, not analytics), labelled as such. (b) An analytics-based count, which is consent-gated and therefore incomplete.
- **Recommended default:** (a).
- **Blocks:** Sign-off of the safety KPI tab (`MOD-18-ADM-02`)
- **Who answers:** Owner, with the trust-and-safety lead
- **Gaps:** GAP-MOD18-07
- **Status:** Open

#### Needed by MOD-19

**DEC-047** · What load level must the launch load test reach (concurrent members, messages per second, duration)?

- **Options:** The owner sets the target; the latency budgets exist [TR §15.1] but no load level does.
- **Recommended default:** Size it from the "few thousand members" assumption of [TR §15.2].
- **Blocks:** `MOD-19-QA-03`
- **Who answers:** Owner
- **Gaps:** GAP-MOD19-02
- **Status:** Open

**DEC-048** · What are the beta stages: is the pre-launch private beta of the whole product separate from the invite-only market state, and is Lagos open to anyone during the private beta?

- **Options:** Confirm the stages set out in [1MM-EXE-MOD-19](execution/1MM-EXE-MOD-19-HARDENING-AND-LAUNCH.md) §7.8, or restate them.
- **Recommended default:** The stages of §7.8.
- **Blocks:** `MOD-19-OPS-08`
- **Who answers:** Owner
- **Gaps:** GAP-MOD19-04
- **Status:** Open

**DEC-049** · Who approves the store privacy declarations (App Store privacy details, Google Play data safety) and the age rating?

- **Options:** The declarations are drafted in MOD-19 from [1MM-STD-12](standards/1MM-STD-12-DATA-HANDLING.md); the owner and the interim DPO approve them.
- **Recommended default:** Approval by the owner and the interim DPO.
- **Blocks:** Store submission
- **Who answers:** Owner and the interim DPO; needs the lawyer's confirmation
- **Gaps:** GAP-STD11-10
- **Status:** Open

**DEC-050** · When the deferred offers scope (admin module A22, the three `offers.*` jobs, website W24) or the optional website sections W19 are switched on, who schedules them and under which task ids?

- **Options:** (a) Leave them unscheduled until the owner decides to turn `offers.enabled` or the W19 site flags on, then add deferred task ids to MOD-10 and MOD-15 with a fresh data-first review, as MOD-08 does for calls. (b) Add the deferred task ids now so the work is already sized.
- **Recommended default:** (a). Offers are off by owner decision [OD-01]; planning them now would describe a feature that may change before it is switched on.
- **Blocks:** Nothing before launch. Blocks switching on `offers.enabled` or W19.
- **Who answers:** Owner
- **Gaps:** GAP-EXE00-04
- **Status:** Open

**DEC-051** · Who runs Lagos usability round 1 (the Technical Reference phase 3 exit check), and on which build?

- **Options:** The research tooling (A35, study `LAGOS-R1`) is built in MOD-18 and the scorecard is checked in MOD-19's exit gate, but recruiting, running the sessions and fixing what they find belong to no task. (a) Run the round on the stage 40 build, enter the sessions through A35 and fix the themes before `MOD-19-QA-06`. (b) Run it earlier on a staging build and enter the sessions afterwards.
- **Recommended default:** (a), with a named person responsible for the round.
- **Blocks:** MOD-19's exit gate (the launch gate depends on the scorecard).
- **Who answers:** Owner
- **Gaps:** GAP-EXE00-05
- **Status:** Open

## Part B · Repository follow-ups

Every claim below was checked against the repository on 24 Nov 2026 by reading the file named;
the **Verified** line says what was found. Sizes are estimates: small (under a day), medium (one
to three days), large (more). Where a module plan already has a task that should carry the change, it is
named; "no task yet" means the coordinator adds one to
[1MM-EXE-MOD-00](execution/1MM-EXE-MOD-00-FOUNDATIONS.md) or the named module. All entries are **Open**.

### B.1 Overview

| Id      | Area                           | Change                                                                        | Task                                                                                                                         | Size   |
| ------- | ------------------------------ | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------ |
| REP-001 | Database tooling               | Migration runner: non-transactional file kind for concurrent index builds     | No task yet; add to `MOD-00-DB-02`. Needed before the first post-launch index on a large table                               | medium |
| REP-002 | Database tooling               | Fix the stale "next number is 0006" text and the `db:pull` wording            | No task; a documentation pull request at the start of MOD-00                                                                 | small  |
| REP-003 | Database tooling               | `pnpm db:roles` fails closed when `APP_ENV` is unset                          | `MOD-00-OPS-03` (hosted release pipeline)                                                                                    | small  |
| REP-004 | Database tooling               | Migration ordering checks and a migrator test                                 | No task yet; add to `MOD-00-DB-02`. Needed before more than one contributor writes migrations                                | medium |
| REP-005 | Database tooling               | EXPLAIN plan tests for hot queries in CI                                      | `MOD-00-DB-02`; also listed under `MOD-00-OPS-05`                                                                            | medium |
| REP-006 | Database tooling               | `app_migrator` owns the schema; migrator and read-only logins                 | `MOD-00-OPS-03`, `MOD-00-DB-01`                                                                                              | medium |
| REP-007 | Database tooling               | Tighter `REVOKE` list for the member API role                                 | No single task: each module adds its tables in its `DB` task; checked in the exit gates of MOD-01, MOD-09, MOD-16 and MOD-17 | medium |
| REP-008 | Database tooling               | Synthetic seed command and test factories                                     | No task yet; first needed by MOD-03 (`MOD-03-DB-01`)                                                                         | medium |
| REP-009 | Database tooling               | Database tests fail, not skip, in CI                                          | No task yet; add to `MOD-00-DB-02`                                                                                           | small  |
| REP-010 | Database tooling               | `pnpm dev` creates the local database logins                                  | No task; a small pull request at the start of MOD-00                                                                         | small  |
| REP-011 | Test harness                   | Vitest and Testing Library for admin, web and `ui-web`                        | `MOD-00-ADM-02`                                                                                                              | medium |
| REP-012 | Test harness                   | Jest (`jest-expo`) for mobile and `ui-native`                                 | `MOD-00-MOB-01`                                                                                                              | medium |
| REP-013 | Test harness                   | Coverage thresholds (`bunfig.toml`) and `test` scripts for contracts and i18n | `MOD-00-API-01`                                                                                                              | small  |
| REP-014 | Test harness                   | Playwright and axe for admin, web and site                                    | `MOD-00-ADM-02`; site milestone M1 (`MOD-00-WEB-01`)                                                                         | medium |
| REP-015 | Test harness                   | Maestro smoke flow and device runner                                          | `MOD-00-MOB-01`                                                                                                              | medium |
| REP-016 | Test harness                   | Lighthouse CI for the website                                                 | `MOD-00-OPS-05`                                                                                                              | small  |
| REP-017 | Test harness                   | Bundle and app size budget script                                             | `MOD-00-OPS-05`                                                                                                              | small  |
| REP-018 | Test harness                   | Visual regression snapshots of the `/_design` gallery                         | With `MOD-00-ADM-01` (A01), after the Playwright entry above                                                                 | small  |
| REP-019 | Test harness                   | Entitlement keys compared with the database seed                              | With the entitlement resolver in MOD-03 (ruling R2); checked at MOD-03's exit                                                | small  |
| REP-020 | Lint and formatting            | Lint: no raw hex or pixel font sizes; React Native accessibility plugin       | No task yet; add to `MOD-00-ADM-01` (web) and `MOD-00-MOB-01` (native)                                                       | medium |
| REP-021 | Lint and formatting            | Lint: no direct `fetch` or server route imports in clients                    | No task yet; before the first client feature in MOD-00                                                                       | small  |
| REP-022 | Lint and formatting            | Lint: type-checked rules and a ban on string-built SQL                        | No task yet; add to MOD-00 before `MOD-00-QA-01`                                                                             | medium |
| REP-023 | Lint and formatting            | Lint: env access, cross-module imports, worker layering                       | No task yet; add to MOD-00                                                                                                   | small  |
| REP-024 | Lint and formatting            | Format and lint `.astro` files                                                | No task yet; site milestone M1 (`MOD-00-WEB-01`)                                                                             | small  |
| REP-025 | Lint and formatting            | Sort Tailwind classes with Prettier                                           | No task; with `MOD-00-ADM-01`                                                                                                | small  |
| REP-026 | Lint and formatting            | Import-order lint rule                                                        | No task; any early MOD-00 pull request                                                                                       | small  |
| REP-027 | Lint and formatting            | Add `.gitattributes`                                                          | No task; any early MOD-00 pull request                                                                                       | small  |
| REP-028 | Lint and formatting            | Shared editor settings (`.vscode/`)                                           | No task; any early MOD-00 pull request                                                                                       | small  |
| REP-029 | Lint and formatting            | Stricter compiler options for the mobile app                                  | No task; with `MOD-00-MOB-01`                                                                                                | small  |
| REP-030 | API and contracts              | Problem registry, extension members and a framework-free throwable error      | `MOD-00-API-01`                                                                                                              | medium |
| REP-031 | API and contracts              | `error.*` message keys and their enumeration test                             | `MOD-00-API-01`; later codes arrive with their routes                                                                        | small  |
| REP-032 | API and contracts              | One key pattern for i18n keys (lower snake)                                   | When the catalogue sync is built: `MOD-02-API-08` (i18n API)                                                                 | small  |
| REP-033 | API and contracts              | ICU formatting, locale providers and i18n tests                               | `MOD-02-API-08` and the MOD-00 client tasks (`MOD-00-ADM-02`, `MOD-00-MOB-01`)                                               | large  |
| REP-034 | API and contracts              | Wider breaking-change check for contracts                                     | `MOD-00-API-01`                                                                                                              | small  |
| REP-035 | API and contracts              | Log redaction backstop in the API logger                                      | `MOD-00-API-05` (which already names log redaction)                                                                          | small  |
| REP-036 | API and contracts              | CMS block schemas live in `packages/contracts` (no new package)               | `MOD-15-API-01`                                                                                                              | small  |
| REP-037 | Worker                         | One logger for the API and the worker                                         | `MOD-00-WRK-01` (MOD-00 observability)                                                                                       | small  |
| REP-038 | Worker                         | Job payload schemas in the worker                                             | `MOD-00-WRK-01`; first needed by the first job with a payload (MOD-03)                                                       | small  |
| REP-039 | Mobile app                     | Enable tablets and rotation in the app configuration                          | `MOD-00-MOB-01`                                                                                                              | small  |
| REP-040 | Mobile app                     | Device-class hook, `Screen`, reduced-motion hook and `Sheet` in `ui-native`   | `MOD-00-MOB-01` (before `MOD-00-MOB-04`)                                                                                     | medium |
| REP-041 | Mobile app                     | Install and configure `expo-notifications`                                    | `MOD-11-MOB-01`                                                                                                              | small  |
| REP-042 | Mobile app                     | Install `expo-updates`; signing, environments and submit settings             | `MOD-00-MOB-01` ("EAS channels")                                                                                             | medium |
| REP-043 | Mobile app                     | Mobile build and update workflows                                             | No task yet; add to `MOD-00-OPS-03` (CD)                                                                                     | medium |
| REP-044 | Mobile app                     | App icon variants (Android monochrome, iOS dark and tinted)                   | Store submission in MOD-19                                                                                                   | small  |
| REP-045 | Mobile app                     | Add the two sound files and their licence rows                                | D5 in MOD-07 (`MOD-07-MOB-07`); MF4 in MOD-08 (later release)                                                                | small  |
| REP-046 | Mobile app                     | Development-only component gallery in the mobile app                          | No task yet; add to `MOD-00-MOB-01`                                                                                          | small  |
| REP-047 | Tokens and UI packages         | Breakpoint and size tokens for tablets                                        | No task yet; add to `MOD-00-MOB-01` after design confirms the values                                                         | small  |
| REP-048 | Tokens and UI packages         | Typography utilities emitted by the token build                               | `MOD-00-ADM-01` (A01); before the hex and pixel lint rule above                                                              | medium |
| REP-049 | Tokens and UI packages         | Border, reduced-motion, spacing and `--art-plate` variables                   | `MOD-00-ADM-01` (A01); W08 and W10 illustrations in MOD-15                                                                   | small  |
| REP-050 | Tokens and UI packages         | Contrast test in the tokens package                                           | No task yet; add to `MOD-00-ADM-01`                                                                                          | small  |
| REP-051 | Tokens and UI packages         | shadcn colour mapping aligned with the brand guide                            | A01 visual sign-off (`MOD-00-ADM-01`); needs design                                                                          | small  |
| REP-052 | Tokens and UI packages         | Shared brand icons                                                            | Before the MOD-07 reaction bar (`MOD-07-MOB-01`) and the A01 `TierBadge` (`MOD-00-ADM-01`)                                   | medium |
| REP-053 | Documents and READMEs          | A README in every app and package                                             | Mostly MOD-00; each module's first task in a workspace                                                                       | medium |
| REP-054 | Documents and READMEs          | `scripts/check-docs.mjs` in CI                                                | No task yet; add to MOD-00 (a `MOD-00-OPS` task)                                                                             | small  |
| REP-055 | Documents and READMEs          | Reconcile MOD-19 journeys with the exit gates of MOD-11 to MOD-17             | Coordinator or the next editor of MOD-19; no code task                                                                       | medium |
| REP-056 | GitHub and repository settings | Fuller pull-request template                                                  | No task; a small pull request at the start of MOD-00, with the next entry                                                    | small  |
| REP-057 | GitHub and repository settings | `check:ci` script that mirrors the `verify` job                               | No task; a small pull request at the start of MOD-00                                                                         | small  |
| REP-058 | GitHub and repository settings | Pull-request title check for task ids                                         | No task yet; add to MOD-00 (a `MOD-00-OPS` task)                                                                             | small  |
| REP-059 | GitHub and repository settings | Record CodeQL default set-up in `docs/USAGE.md`                               | No task; a documentation pull request                                                                                        | small  |
| REP-060 | GitHub and repository settings | Delete the stale remote branch; auto-delete head branches                     | No task; a repository setting for the owner                                                                                  | small  |

### B.2 Entries

#### Database tooling

**REP-001** · Migration runner: non-transactional file kind for concurrent index builds

- **Change:** `packages/db/src/migrator.ts`: add a non-transactional migration kind (one statement per file, sent alone, ledger row written after it succeeds, `IF NOT EXISTS` required, an `INVALID` index from a failed concurrent build dropped before a retry), with a test. The marker is a first-line comment `-- migrate: no-transaction` ([1MM-DB-02](database/1MM-DB-02-MIGRATIONS.md), GAP-DB02-01); document it in `packages/db/migrations/README.md`. Until the runner supports it, a large-table index is built in a reviewed manual step.
- **Why:** Every file runs as one transaction, so `CREATE INDEX CONCURRENTLY` cannot ship as a migration and an index on a large live table could only be added with a write-blocking lock [TR §15.2].
- **Verified:** Confirmed: `migrator.ts` line 101 sends `sql.unsafe(file + ledger).simple()`, one multi-statement query per file.
- **Task:** No task yet; add to `MOD-00-DB-02`. Needed before the first post-launch index on a large table
- **Size:** medium
- **Gaps:** GAP-DB02-01, GAP-DB04-04
- **Status:** Open

**REP-002** · Fix the stale "next number is 0006" text and the `db:pull` wording

- **Change:** `packages/db/migrations/README.md` and `docs/USAGE.md` §4: replace "the next number is `0006`" with "the next unused number"; in the README, reword the last line to "then `pnpm db:pull` and copy the changed tables from `.introspected/` into `src/schema/`".
- **Why:** A contributor who follows the text would collide with an applied file, and `pnpm db:pull` does not write to `src/schema/`.
- **Verified:** Confirmed: `0006_partition_function_definer.sql` exists; both files still say `0006`; `drizzle.config.ts` writes to `./.introspected`.
- **Task:** No task; a documentation pull request at the start of MOD-00
- **Size:** small
- **Gaps:** GAP-DB02-02, GAP-STD05-03, GAP-STD06-04
- **Status:** Open

**REP-003** · `pnpm db:roles` fails closed when `APP_ENV` is unset

- **Change:** `packages/db/src/cli/roles.ts`: fail closed. Require `APP_ENV`; create the local logins only when it is `local` and the database host is `localhost`, `127.0.0.1` or the CI service; otherwise exit with an error. Add a test.
- **Why:** With `APP_ENV` unset the command assumes a local database and creates the throwaway login users (two with `BYPASSRLS`) with a published password; a hosted release step that forgets the variable would create them.
- **Verified:** Confirmed: line 13 is `(process.env.APP_ENV ?? 'local') === 'local'`.
- **Task:** `MOD-00-OPS-03` (hosted release pipeline)
- **Size:** small
- **Gaps:** GAP-DB02-03
- **Status:** Open

**REP-004** · Migration ordering checks and a migrator test

- **Change:** `scripts/check-repo-rules.mjs` and `packages/db/src/migrator.ts`: (a) `pnpm check:repo` fails on duplicate migration numbers and on a number not greater than every number on the base branch (`0002`–`0005` are the one documented hole); (b) `migrate()` refuses a pending file that sorts before the last applied one and warns on a ledger row without a file; (c) add `migrator.test.ts` (applies once, second run is a no-op, an edited file is refused, a failing file leaves no ledger row, two concurrent runners serialise).
- **Why:** A late-merged branch can add a file that sorts before an applied one, and the runner has no automated test.
- **Verified:** Confirmed: `check-repo-rules.mjs` covers workflows and workspaces only; `packages/db` has `roles.test.ts`, `schema/schema.test.ts` and (added with schema change set 0007) `change-set-0007.test.ts`, and no migrator test.
- **Task:** No task yet; add to `MOD-00-DB-02`. Needed before more than one contributor writes migrations
- **Size:** medium
- **Gaps:** GAP-DB02-04
- **Status:** Open

**REP-005** · EXPLAIN plan tests for hot queries in CI

- **Change:** `packages/db`: add the plan-assertion ("EXPLAIN") test and the synthetic fixture loader described in [1MM-DB-04](database/1MM-DB-04-INDEXING.md) §12, run in the `verify` job after `pnpm db:roles`.
- **Why:** [TR §15.2] names EXPLAIN checks in CI for hot queries; no test, fixture or CI step exists.
- **Verified:** Confirmed: `.github/workflows/ci.yml` has no such step and `packages/db/src` no such test.
- **Task:** `MOD-00-DB-02`; also listed under `MOD-00-OPS-05`
- **Size:** medium
- **Gaps:** GAP-DB04-03
- **Status:** Open

**REP-006** · `app_migrator` owns the schema; migrator and read-only logins

- **Change:** `packages/db/roles/roles.sql`, `roles/local-logins.sql`, `src/cli/migrate.ts`, `src/cli/roles.ts`, `.env.example`, `src/roles.test.ts`: create a migration login in role `app_migrator`; issue `SET ROLE app_migrator` before running files so every object is owned by the group; a one-off `REASSIGN OWNED` for existing databases; add `minitman_migrator` and `minitman_readonly` logins, a `READONLY_DATABASE_URL`, and tests for the admin, read-only and migrator logins.
- **Why:** `app_migrator` is created but owns nothing: the schema is owned by whichever login ran the migrations, so "migrations run as `app_migrator`" [TR §10.3] is not true as implemented.
- **Verified:** Confirmed: no `SET ROLE` in the CLI or the migrator; `local-logins.sql` creates four logins (api, admin, worker, queue) and none for the migrator or read-only roles.
- **Task:** `MOD-00-OPS-03`, `MOD-00-DB-01`
- **Size:** medium
- **Gaps:** GAP-DB05-05
- **Status:** Open

**REP-007** · Tighter `REVOKE` list for the member API role

- **Change:** `packages/db/roles/roles.sql`: extend the `REVOKE ALL … FROM app_api` list with the staff-credential, governance, privacy-operations, security-operations and moderation-internal tables named in [1MM-DB-05](database/1MM-DB-05-SECURITY.md), each confirmed by its owning module against the member endpoints it serves; add `safety_escalation_updates` to the `REVOKE UPDATE, DELETE` line.
- **Why:** The member API role has full DML on tables it has no reason to touch [TR §13.1].
- **Verified:** Confirmed: `app_api` is granted `SELECT, INSERT, UPDATE, DELETE` on all tables and the `REVOKE ALL` list holds five tables (`admin_recovery_codes`, `vendor_settings`, `offer_codes`, `offer_claims`, `waitlist_entries`).
- **Task:** No single task: each module adds its tables in its `DB` task; checked in the exit gates of MOD-01, MOD-09, MOD-16 and MOD-17
- **Size:** medium
- **Gaps:** GAP-DB05-07
- **Status:** Open

**REP-008** · Synthetic seed command and test factories

- **Change:** `packages/db`: add a seed command for synthetic development and demo data (it refuses `APP_ENV=production`) and shared test factories per domain, grown by each module.
- **Why:** [TR §4.4] requires synthetic data for development and demo; none exists.
- **Verified:** Confirmed: the package scripts are `migrate`, `status`, `roles`, `pull`, `typecheck`, `test`; there is no seed or factory code.
- **Task:** No task yet; first needed by MOD-03 (`MOD-03-DB-01`)
- **Size:** medium
- **Gaps:** GAP-STD01-08
- **Status:** Open

**REP-009** · Database tests fail, not skip, in CI

- **Change:** `packages/db/src/roles.test.ts`, `packages/db/src/schema/schema.test.ts`: when `CI` is set, fail instead of skip if the database variables are absent.
- **Why:** A mis-configured CI run passes with the database tests silently skipped.
- **Verified:** Confirmed: both use `describe.skipIf(...)`, and so does `packages/db/src/change-set-0007.test.ts` (added with schema change set 0007), which the change must cover too.
- **Task:** No task yet; add to `MOD-00-DB-02`
- **Size:** small
- **Gaps:** GAP-STD01-09
- **Status:** Open

**REP-010** · `pnpm dev` creates the local database logins

- **Change:** `scripts/dev.mjs`: run `pnpm db:roles` after `pnpm db:migrate` (it is idempotent); or correct the comment in `.env.example` and add the step to `docs/USAGE.md` §2.
- **Why:** `.env.example` says `pnpm dev` creates the local database users, but on a new or reset database the API's login did not exist until `pnpm db:roles` was run by hand. Fixed on 24 Nov 2026: `scripts/dev.mjs` now runs it.
- **Verified:** Confirmed at first check: `dev.mjs` ran `db:migrate` only; `.env.example` line 34 says "Locally `pnpm dev` creates these users for you". Re-checked later on 24 Nov 2026: `scripts/dev.mjs` now runs `pnpm db:roles` after `pnpm db:migrate` (added with schema change set 0007), so the code half of this entry is done; what remains is to align the documents that still tell the reader to run `pnpm db:roles` by hand.
- **Task:** No task; a small pull request at the start of MOD-00
- **Size:** small
- **Gaps:** GAP-STD10-04
- **Status:** Open

#### Test harness

**REP-011** · Vitest and Testing Library for admin, web and `ui-web`

- **Change:** `apps/admin`, `apps/web`, `packages/ui-web`: add Vitest, Testing Library and jsdom, a `test` script and a `vitest.config.ts` with the coverage thresholds of [1MM-STD-01](standards/1MM-STD-01-TESTING-STRATEGY.md) §4.1.
- **Why:** No unit, component or route test runner, so `turbo run test` skips these workspaces.
- **Verified:** Confirmed: none of the three `package.json` files has a `test` script.
- **Task:** `MOD-00-ADM-02`
- **Size:** medium
- **Gaps:** GAP-STD01-01
- **Status:** Open

**REP-012** · Jest (`jest-expo`) for mobile and `ui-native`

- **Change:** `apps/mobile`, `packages/ui-native`: add Jest with the `jest-expo` preset and React Native Testing Library, and a `jest.config.js` with coverage thresholds.
- **Why:** No unit or component test runner for the app.
- **Verified:** Confirmed: neither `package.json` has a `test` script.
- **Task:** `MOD-00-MOB-01`
- **Size:** medium
- **Gaps:** GAP-STD01-02
- **Status:** Open

**REP-013** · Coverage thresholds (`bunfig.toml`) and `test` scripts for contracts and i18n

- **Change:** Root `bunfig.toml` with `[test] coverage = true` and `coverageThreshold`; add `"test": "bun test"` to `packages/contracts` and `packages/i18n`; add the contract enumeration tests (every operation declares auth, errors and a rate-limit policy; schemas round-trip).
- **Why:** No coverage is measured, and contract tests have nowhere to run (API gate item G2).
- **Verified:** Confirmed: no `bunfig.toml` anywhere; `packages/contracts` and `packages/i18n` have no `test` script.
- **Task:** `MOD-00-API-01`
- **Size:** small
- **Gaps:** GAP-STD01-03, GAP-STD06-03
- **Status:** Open

**REP-014** · Playwright and axe for admin, web and site

- **Change:** `apps/admin`, `apps/web`, `apps/site`: add `@playwright/test` and `@axe-core/playwright`, one `playwright.config.ts` per app with the viewports of [1MM-STD-01](standards/1MM-STD-01-TESTING-STRATEGY.md) §3.4 and §3.6, and a CI job with read-only permissions and pinned actions. This is also the automated accessibility check the brand guide requires; the native side is covered by the two mobile entries below (accessibility lint, Maestro).
- **Why:** Playwright and axe are named in [TR §17.3] and [BG §13] but are not installed; no end-to-end suites or CI job exist.
- **Verified:** Confirmed: no Playwright or axe dependency in any `package.json`; `ci.yml` has the single `verify` job.
- **Task:** `MOD-00-ADM-02`; site milestone M1 (`MOD-00-WEB-01`)
- **Size:** medium
- **Gaps:** GAP-STD01-04, GAP-STD04-02
- **Status:** Open

**REP-015** · Maestro smoke flow and device runner

- **Change:** `apps/mobile/.maestro/`: add a smoke flow and choose where devices run (simulator in CI or a device farm).
- **Why:** Maestro is named in [TR §17.3] but there are no flows and no CI step. The tablet leg also needs the tablet setting below.
- **Verified:** Confirmed: `apps/mobile/.maestro` does not exist.
- **Task:** `MOD-00-MOB-01`
- **Size:** medium
- **Gaps:** GAP-STD01-05
- **Status:** Open

**REP-016** · Lighthouse CI for the website

- **Change:** Add Lighthouse CI for `apps/site` (`lighthouserc.json`) with the assertions of [1MM-STD-01](standards/1MM-STD-01-TESTING-STRATEGY.md) §4.2.
- **Why:** The website spec says budgets are enforced in CI [WEB §3.7]; nothing enforces them.
- **Verified:** Confirmed: no `lighthouserc.json` and no Lighthouse dependency.
- **Task:** `MOD-00-OPS-05`
- **Size:** small
- **Gaps:** GAP-STD01-06
- **Status:** Open

**REP-017** · Bundle and app size budget script

- **Change:** Add `scripts/check-bundle-budgets.mjs`, reading one budgets file (site transfer limits, app size under 30 MB, recorded admin and web baselines), and a root script `check:budgets`.
- **Why:** [TR §17.3] requires bundle budgets; no script checks size.
- **Verified:** Confirmed: `scripts/check-client-bundles.mjs` checks for server-only settings in bundles, not size.
- **Task:** `MOD-00-OPS-05`
- **Size:** small
- **Gaps:** GAP-STD01-07
- **Status:** Open

**REP-018** · Visual regression snapshots of the `/_design` gallery

- **Change:** Snapshot the admin `/_design` gallery in light and dark in CI (visual regression of core components).
- **Why:** [BG §17] requires visual regression snapshots in both themes; none exist.
- **Verified:** Confirmed: the gallery route is not built yet (`apps/admin/src/routes` has `index`, `overview` and the catch-all only) and no snapshot tooling is installed.
- **Task:** With `MOD-00-ADM-01` (A01), after the Playwright entry above
- **Size:** small
- **Gaps:** GAP-STD04-03
- **Status:** Open

**REP-019** · Entitlement keys compared with the database seed

- **Change:** Add a test that compares `packages/entitlements/src/keys.ts` with the `entitlements` seed in the database.
- **Why:** The comment in `keys.ts` says the API test suite compares the two; no such test exists.
- **Verified:** Confirmed: the comment is on line 3; the package test only asserts that there are 25 keys.
- **Task:** With the entitlement resolver in MOD-03 (ruling R2); checked at MOD-03's exit
- **Size:** small
- **Gaps:** GAP-STD14-06
- **Status:** Open

#### Lint and formatting

**REP-020** · Lint: no raw hex or pixel font sizes; React Native accessibility plugin

- **Change:** `eslint.config.mjs`: (a) ban raw hex colours and pixel font sizes in components (string literals and class names such as `text-[<n>px]`) for `apps/{admin,web,mobile}` and `packages/ui-*`, with an allow-list for `apps/mobile/app.config.ts` and HTML `theme-color` metas; (b) add `eslint-plugin-react-native-a11y` for `apps/mobile` and `packages/ui-native`.
- **Why:** Required by [BG §13], [BG §17], [WEB §3.1] and the A01 checklist; neither is configured.
- **Verified:** Confirmed: `eslint.config.mjs` has no such rule and no accessibility plugin; 24 `text-[<n>px]` classes exist in the web apps today, so (a) depends on the typography utilities entry below.
- **Task:** No task yet; add to `MOD-00-ADM-01` (web) and `MOD-00-MOB-01` (native)
- **Size:** medium
- **Gaps:** GAP-STD04-01, GAP-STD03-06
- **Status:** Open

**REP-021** · Lint: no direct `fetch` or server route imports in clients

- **Change:** `eslint.config.mjs`, client blocks (`apps/{admin,web,site,mobile}`, `packages/ui-*`): forbid `fetch(` outside `src/lib/api.ts` and forbid importing `@1minitman/contracts/routes`.
- **Why:** Nothing stops a client from calling the API without the generated typed client, or from importing server route definitions ([1MM-STD-06](standards/1MM-STD-06-API-FIRST.md)).
- **Verified:** Confirmed: the config has `no-restricted-imports` blocks for other purposes, but neither of these two restrictions.
- **Task:** No task yet; before the first client feature in MOD-00
- **Size:** small
- **Gaps:** GAP-STD06-01
- **Status:** Open

**REP-022** · Lint: type-checked rules and a ban on string-built SQL

- **Change:** `eslint.config.mjs`: enable the `typescript-eslint` type-checked rules `switch-exhaustiveness-check`, `no-floating-promises`, `no-misused-promises` and `no-unsafe-*` for `apps/api`, `apps/worker` and `packages/*`; add a rule against `sql.raw` and template-built SQL outside the `packages/db` migration tooling.
- **Why:** [TR §13.1] says "lint bans string-built SQL"; no such rule exists, and no type-aware rules are on.
- **Verified:** Confirmed: no type-checked configuration and no SQL rule in `eslint.config.mjs`.
- **Task:** No task yet; add to MOD-00 before `MOD-00-QA-01`
- **Size:** medium
- **Gaps:** GAP-STD11-02, GAP-STD16-03
- **Status:** Open

**REP-023** · Lint: env access, cross-module imports, worker layering

- **Change:** `eslint.config.mjs`: forbid `process.env` and `import.meta.env` outside the env modules; extend the module-index rule to files inside `apps/api/src/modules/` importing other modules; add a worker rule that `jobs/` imports only `platform/` and packages.
- **Why:** Three conventions of [1MM-STD-14](standards/1MM-STD-14-CODING-CONVENTIONS.md) have no lint rule.
- **Verified:** Confirmed: none of the three is in the config.
- **Task:** No task yet; add to MOD-00
- **Size:** small
- **Gaps:** GAP-STD14-05
- **Status:** Open

**REP-024** · Format and lint `.astro` files

- **Change:** Add `prettier-plugin-astro` (and `astro` to the Prettier `lint-staged` pattern) and `eslint-plugin-astro` with its accessibility rules; remove `**/*.astro` from the ESLint ignores.
- **Why:** `.astro` files are neither formatted nor linted, and the website is built almost entirely from them.
- **Verified:** Confirmed: `eslint.config.mjs` ignores `**/*.astro`; the Prettier `lint-staged` pattern has no `astro`; no Astro plugin is installed.
- **Task:** No task yet; site milestone M1 (`MOD-00-WEB-01`)
- **Size:** small
- **Gaps:** GAP-STD09-01
- **Status:** Open

**REP-025** · Sort Tailwind classes with Prettier

- **Change:** Add `prettier-plugin-tailwindcss`, pointed at `packages/ui-web/src/styles.css` and the site stylesheet; reformat in one pull request.
- **Why:** Tailwind class order is not sorted by any tool.
- **Verified:** Confirmed: no Prettier plugin is installed.
- **Task:** No task; with `MOD-00-ADM-01`
- **Size:** small
- **Gaps:** GAP-STD09-02
- **Status:** Open

**REP-026** · Import-order lint rule

- **Change:** `eslint.config.mjs`: add an import-sorting rule configured to the order in [1MM-STD-09](standards/1MM-STD-09-FORMATTING.md) §5.1 and run `eslint --fix` once.
- **Why:** Import order is a convention only.
- **Verified:** Confirmed: no import-order rule in the config.
- **Task:** No task; any early MOD-00 pull request
- **Size:** small
- **Gaps:** GAP-STD09-03
- **Status:** Open

**REP-027** · Add `.gitattributes`

- **Change:** Add `.gitattributes` with `* text=auto eol=lf` and binary markers for images and fonts.
- **Why:** A Windows checkout with automatic CRLF conversion fails `pnpm format:check`.
- **Verified:** Confirmed: no `.gitattributes` at the root.
- **Task:** No task; any early MOD-00 pull request
- **Size:** small
- **Gaps:** GAP-STD09-04
- **Status:** Open

**REP-028** · Shared editor settings (`.vscode/`)

- **Change:** Commit `.vscode/extensions.json` (EditorConfig, Prettier, ESLint, Astro, Tailwind) and a minimal `.vscode/settings.json` (format on save, workspace TypeScript).
- **Why:** Format-on-save depends on each person's set-up.
- **Verified:** Confirmed: no `.vscode/` folder at the root.
- **Task:** No task; any early MOD-00 pull request
- **Size:** small
- **Gaps:** GAP-STD09-05
- **Status:** Open

**REP-029** · Stricter compiler options for the mobile app

- **Change:** `apps/mobile/tsconfig.json`: add `noImplicitOverride`, `noFallthroughCasesInSwitch`, `verbatimModuleSyntax`, `isolatedModules` and `forceConsistentCasingInFileNames` (it must keep extending `expo/tsconfig.base`).
- **Why:** The mobile app does not extend `tsconfig.base.json` and so lacks the options every other workspace has.
- **Verified:** Confirmed: the file extends `expo/tsconfig.base` and sets only `strict`, `noUncheckedIndexedAccess` and `paths`. Check each option against the Expo base when adding it.
- **Task:** No task; with `MOD-00-MOB-01`
- **Size:** small
- **Gaps:** GAP-STD14-03
- **Status:** Open

#### API and contracts

**REP-030** · Problem registry, extension members and a framework-free throwable error

- **Change:** `packages/contracts/src/schemas/problem.ts` and `apps/api/src/platform/http/problem.ts`: add the problem registry and the extension members (`errors`, `entitlement`, `upsell`, `permission`, `retry_after_seconds`, `until`, `tries_left`); make `reason` required and build `type` from it; make the throwable error take a registry code; give the 404 handler `not_found` and the 500 path `internal`; add `code` to validation `errors[]`. Move the throwable error (no framework types) to `apps/api/src/platform/errors.ts`, keeping `problemResponse` and the handlers in `platform/http/`.
- **Why:** The scaffold's problem shape is smaller than [1MM-STD-13](standards/1MM-STD-13-ERROR-CODES.md) defines, and the comment on `ProblemError` says domain and application code throws it although the lint rule bans `**/http/**` imports for those layers.
- **Verified:** Confirmed: `ProblemSchema` has `type` (default `about:blank`), `title`, `status`, `detail`, `instance`, `request_id` and optional `reason` only; `ProblemError` lives in `platform/http/` and takes a Hono status type; `notFoundHandler` sends no `reason`.
- **Task:** `MOD-00-API-01`
- **Size:** medium
- **Gaps:** GAP-STD13-02, GAP-STD14-01
- **Status:** Open

**REP-031** · `error.*` message keys and their enumeration test

- **Change:** `packages/i18n/src/locales/en.json`: add `error.<code>` and `error.field.<code>` keys for the codes of [1MM-STD-13](standards/1MM-STD-13-ERROR-CODES.md) §4.1–4.3, and the enumeration test that ties every error code to a message key.
- **Why:** A client cannot show an error message for a code that has no key.
- **Verified:** Confirmed: the catalogue has 12 keys and none starts with `error.`.
- **Task:** `MOD-00-API-01`; later codes arrive with their routes
- **Size:** small
- **Gaps:** GAP-STD13-03
- **Status:** Open

**REP-032** · One key pattern for i18n keys (lower snake)

- **Change:** `packages/i18n/src/locales/en.json`: rename the scaffold keys from camelCase segments (`common.getTheApp`, `status.apiOnline`) to the lower snake pattern of the schema seeds (`product.black_badge`, `n01.title`).
- **Why:** Two key patterns cannot both be the rule for `i18n_strings`.
- **Verified:** Confirmed: both example keys are in the file.
- **Task:** When the catalogue sync is built: `MOD-02-API-08` (i18n API)
- **Size:** small
- **Gaps:** GAP-STD14-02
- **Status:** Open

**REP-033** · ICU formatting, locale providers and i18n tests

- **Change:** `packages/i18n/src/index.ts` and the client apps: add an ICU formatter and a `translate(locale, key, args)` signature (library chosen by ADR), a locale provider per app with `useTranslator()`, the formatting-locale map, a pseudo-locale generator, the catalogue tests and a lint rule against literal copy; stop passing the literal locale `'en'` in `apps/mobile/src/app/(tabs)/_layout.tsx`; use the package in `apps/admin` and `apps/web`.
- **Why:** Every source requires ICU messages ([1MM-STD-17](standards/1MM-STD-17-LANGUAGE-CONFIGURATION.md)); the scaffold cannot format a parameterised string.
- **Verified:** Confirmed: `translate(locale, key)` takes no arguments; the tab layout calls `translate('en', …)`; neither `apps/admin` nor `apps/web` imports `@1minitman/i18n`.
- **Task:** `MOD-02-API-08` and the MOD-00 client tasks (`MOD-00-ADM-02`, `MOD-00-MOB-01`)
- **Size:** large
- **Gaps:** GAP-STD17-01
- **Status:** Open

**REP-034** · Wider breaking-change check for contracts

- **Change:** `scripts/check-contract-breaking.mjs`: also compare `parameters` (newly required query, path or header parameters), removed request enum values and removed declared error responses; keep the output format.
- **Why:** A breaking change in those places passes the check today.
- **Verified:** Confirmed: the script's header lists removed paths, operations, success responses, response fields and newly required request fields only.
- **Task:** `MOD-00-API-01`
- **Size:** small
- **Gaps:** GAP-STD06-02
- **Status:** Open

**REP-035** · Log redaction backstop in the API logger

- **Change:** `apps/api/src/platform/logger.ts`: add a key-based redaction step in `createLogger` (password, code, token, authorization, cookie, email, phone), with a unit test.
- **Why:** The logger has no backstop if a caller logs a sensitive field.
- **Verified:** Confirmed: no redaction in `logger.ts`.
- **Task:** `MOD-00-API-05` (which already names log redaction)
- **Size:** small
- **Gaps:** GAP-STD16-05
- **Status:** Open

**REP-036** · CMS block schemas live in `packages/contracts` (no new package)

- **Change:** Do not create `packages/content-schema`: put the CMS block schemas in `packages/contracts` (one pipeline for all schemas) and record the correction to the two specs that name the other package in [1MM-LOG-03](1MM-LOG-03-TECHNICAL-REFERENCE-EXTENSIONS.md).
- **Why:** [WEB §6.3] and [ADM A28] name a package that is not in the scaffold.
- **Verified:** Confirmed: `packages/` holds `contracts`, `db`, `entitlements`, `i18n`, `tokens`, `ui-native` and `ui-web`.
- **Task:** `MOD-15-API-01`
- **Size:** small
- **Gaps:** GAP-MOD15-10
- **Status:** Open

#### Worker

**REP-037** · One logger for the API and the worker

- **Change:** `apps/worker/src/main.ts`, `apps/worker/src/config/env.ts`: share one logger with the API (move `createLogger` to a small package or copy the interface into the worker's `platform/`), give `JobContext` a `Logger`, and apply `LOG_LEVEL`.
- **Why:** The worker validates `LOG_LEVEL` but never uses it and writes its own JSON line with no level, so the two services log in different shapes.
- **Verified:** Confirmed: `main.ts` writes `console.log(JSON.stringify({ time, service, message, … }))`; `LOG_LEVEL` appears only in `env.ts`.
- **Task:** `MOD-00-WRK-01` (MOD-00 observability)
- **Size:** small
- **Gaps:** GAP-STD14-04
- **Status:** Open

**REP-038** · Job payload schemas in the worker

- **Change:** `apps/worker/src/platform/job.ts`, `runner.ts`: add an optional `payload` zod schema to `JobDefinition`; the runner parses before `handle` and fails the job without retry on a parse error.
- **Why:** A malformed payload reaches the handler unchecked.
- **Verified:** Confirmed: `runner.ts` calls `job.handle((item.data ?? {}) as object, context)`.
- **Task:** `MOD-00-WRK-01`; first needed by the first job with a payload (MOD-03)
- **Size:** small
- **Gaps:** GAP-STD16-01
- **Status:** Open

#### Mobile app

**REP-039** · Enable tablets and rotation in the app configuration

- **Change:** `apps/mobile/app.config.ts`: set `ios.supportsTablet: true` and `orientation: 'default'`, and lock phones to portrait at runtime (for example with `expo-screen-orientation`); confirm Android large-screen behaviour against the Expo documentation when the change is made.
- **Why:** Tablets are a required target; the scaffold excludes iPads and tablet landscape.
- **Verified:** Confirmed: `orientation: 'portrait'` and `supportsTablet: false`. The phone rule depends on the phone-landscape decision in Part A.
- **Task:** `MOD-00-MOB-01`
- **Size:** small
- **Gaps:** GAP-STD03-02
- **Status:** Open

**REP-040** · Device-class hook, `Screen`, reduced-motion hook and `Sheet` in `ui-native`

- **Change:** `packages/ui-native/src`: add `useDeviceClass()`, a `Screen` wrapper (safe areas, gutter, content maximum width), `useReducedMotion()` and a `Sheet` that switches form by device class.
- **Why:** Every screen task needs them ([1MM-STD-03](standards/1MM-STD-03-MOBILE-BUILD-STRATEGY.md) §3.4).
- **Verified:** Confirmed: the package has `button.tsx`, `empty-state.tsx`, `text.tsx`, `theme.tsx` and `index.ts` only.
- **Task:** `MOD-00-MOB-01` (before `MOD-00-MOB-04`)
- **Size:** medium
- **Gaps:** GAP-STD03-05
- **Status:** Open

**REP-041** · Install and configure `expo-notifications`

- **Change:** `apps/mobile/package.json`, `app.config.ts`: add `expo-notifications` (SDK 58 line) and its config plugin with a monochrome notification icon and the Ink colour; add the Time Sensitive capability if [1MM-STD-18](standards/1MM-STD-18-NOTIFICATIONS.md) §2.3 is accepted. Push then needs a development build, not Expo Go.
- **Why:** Push cannot be built without it.
- **Verified:** Confirmed: `expo-notifications` is not a dependency and not in `plugins`.
- **Task:** `MOD-11-MOB-01`
- **Size:** small
- **Gaps:** GAP-STD18-05
- **Status:** Open

**REP-042** · Install `expo-updates`; signing, environments and submit settings

- **Change:** `apps/mobile/package.json`, `app.config.ts`, `eas.json`: install `expo-updates` and apply [1MM-STD-19](standards/1MM-STD-19-OTA-UPDATES.md) §12.2–12.4 (update behaviour, code signing, EAS environments per profile, submit settings, store ids).
- **Why:** No over-the-air update can be published or received.
- **Verified:** Partly confirmed: `expo-updates` is not installed, code signing and submit settings are absent (`"submit": { "production": {} }`). The gap overstates one point: `app.config.ts` already sets `runtimeVersion` (policy `appVersion`) and `updates.url`, and `eas.json` already has a channel and `APP_ENV` per build profile. Code signing depends on the Expo-plan decision in Part A.
- **Task:** `MOD-00-MOB-01` ("EAS channels")
- **Size:** medium
- **Gaps:** GAP-STD19-01
- **Status:** Open

**REP-043** · Mobile build and update workflows

- **Change:** `.github/workflows/`: add the mobile build and update workflows of [1MM-STD-19](standards/1MM-STD-19-OTA-UPDATES.md) §12.5, with a protected `production` environment, required reviewers and a fingerprint guard.
- **Why:** "Staging on merge; production after approval" [TR §17.3] has no mobile implementation.
- **Verified:** Confirmed: `ci.yml` is the only workflow.
- **Task:** No task yet; add to `MOD-00-OPS-03` (CD)
- **Size:** medium
- **Gaps:** GAP-STD19-02
- **Status:** Open

**REP-044** · App icon variants (Android monochrome, iOS dark and tinted)

- **Change:** `assets/brand/`, `apps/mobile/app.config.ts`: export the Android monochrome icon layer and the iOS dark and tinted icon variants from the master artwork and wire them in.
- **Why:** [BG §04] requires the variants.
- **Verified:** Confirmed: no monochrome, dark or tinted icon file in `assets/brand/` and no `monochromeImage` in `app.config.ts`.
- **Task:** Store submission in MOD-19
- **Size:** small
- **Gaps:** GAP-STD04-05
- **Status:** Open

**REP-045** · Add the two sound files and their licence rows

- **Change:** `assets/sounds/`: add the two sounds (`match-chime`, `call-start`: free royalty-free library sounds, under 600 ms, at −18 LUFS) and two rows in `assets/illustrations/LICENCE_LOG.csv`.
- **Why:** The tokens name two sounds [TOK `sound.*`], [OD-25]; the files are not in the repo.
- **Verified:** Confirmed: `assets/` holds `brand/` and `illustrations/` only; the licence log has no sound rows.
- **Task:** D5 in MOD-07 (`MOD-07-MOB-07`); MF4 in MOD-08 (later release)
- **Size:** small
- **Gaps:** GAP-STD04-04
- **Status:** Open

**REP-046** · Development-only component gallery in the mobile app

- **Change:** `apps/mobile`: add a development-only component gallery route, excluded from release builds.
- **Why:** The web has a specified preview surface (`/_design`, A01); native components have none, so states and themes cannot be reviewed in one place.
- **Verified:** Confirmed: `apps/mobile/src/app` has `_layout.tsx`, `index.tsx` and `(tabs)` only.
- **Task:** No task yet; add to `MOD-00-MOB-01`
- **Size:** small
- **Gaps:** GAP-STD20-07
- **Status:** Open

#### Tokens and UI packages

**REP-047** · Breakpoint and size tokens for tablets

- **Change:** `packages/tokens/tokens.json` (and the pack's token file), `packages/tokens/build.mjs`: add `breakpoint.phone` 360, `breakpoint.phone-large` 400, `breakpoint.tablet-large` 840, `size.screen-gutter-tablet` 24, `size.content-max` 640, `size.sheet-max` 560, `size.card-max` 480, `size.rail-width` 80, and expose them in the preset.
- **Why:** The tablet rules of [1MM-STD-03](standards/1MM-STD-03-MOBILE-BUILD-STRATEGY.md) §3 are numbers in prose until they are tokens. The values are that document's recommendations and follow the tablet entries in [1MM-LOG-02](1MM-LOG-02-UI-UPDATES.md); design confirms them first.
- **Verified:** Confirmed: `breakpoint` has `tablet`, `desktop` and `max` only; the preset exposes `sm` and `md`.
- **Task:** No task yet; add to `MOD-00-MOB-01` after design confirms the values
- **Size:** small
- **Gaps:** GAP-STD03-03
- **Status:** Open

**REP-048** · Typography utilities emitted by the token build

- **Change:** `packages/tokens/build.mjs`: emit Tailwind v4 `--text-<name>` variables with line-height, letter-spacing and font-weight companions for the nine `typography.*` styles, after `--text-*: initial`; then replace the hand-written sizes in `apps/admin`, `apps/web` and `apps/site`.
- **Why:** Without them web code writes pixel sizes by hand, which the required lint rule rejects [BG §17], [WEB §4.0].
- **Verified:** Confirmed: the build emits no `--text-*` variables; 24 `text-[<n>px]` classes exist in the web apps and `packages/ui-web`.
- **Task:** `MOD-00-ADM-01` (A01); before the hex and pixel lint rule above
- **Size:** medium
- **Gaps:** GAP-STD20-01
- **Status:** Open

**REP-049** · Border, reduced-motion, spacing and `--art-plate` variables

- **Change:** `packages/tokens/build.mjs`: (a) emit `border.width.*` and `motion.reduced.*`; (b) set `--spacing-*: initial` and emit the 13 `space.*` steps so off-scale values do not compile; (c) emit `--art-plate`.
- **Why:** Components write `border-[1.5px]` by hand, off-scale spacing such as `p-7` compiles, and [WEB §3.4] binds illustrations to `--art-plate`.
- **Verified:** Confirmed: the build emits `--art-ink` and `--art-paper` only and no border-width, reduced-motion or spacing variables; one `border-[1.5px]` class exists.
- **Task:** `MOD-00-ADM-01` (A01); W08 and W10 illustrations in MOD-15
- **Size:** small
- **Gaps:** GAP-STD20-02
- **Status:** Open

**REP-050** · Contrast test in the tokens package

- **Change:** `packages/tokens`: add a contrast test for the colour pairs in [1MM-STD-04](standards/1MM-STD-04-BRAND-GUIDE.md) §3.1 and §4.2 (body 7:1, secondary 4.5:1, graphics 3:1).
- **Why:** A token change that breaks a stated contrast ratio would pass the build.
- **Verified:** Confirmed: `build.mjs` has one sanity check (Paper and Ink backgrounds) and the package has no `test` script.
- **Task:** No task yet; add to `MOD-00-ADM-01`
- **Size:** small
- **Gaps:** GAP-STD04-06
- **Status:** Open

**REP-051** · shadcn colour mapping aligned with the brand guide

- **Change:** `packages/ui-web/src/styles.css`: align the shadcn colour mapping with [BG §17], or record the deviation in an ADR. Design confirms which mapping stands first.
- **Why:** The repo maps `card` and `popover` to `raised` and `secondary` and `muted` to `surface`; the brand guide prints `card` = `surface` and `secondary`, `muted` and `accent` = `sunken` in light.
- **Verified:** Confirmed: `styles.css` lines 18–29 map `card` and `popover` to `--raised`, `secondary` and `muted` to `--surface`, `accent` to `--sunken`.
- **Task:** A01 visual sign-off (`MOD-00-ADM-01`); needs design
- **Size:** small
- **Gaps:** GAP-STD20-03
- **Status:** Open

**REP-052** · Shared brand icons

- **Change:** Add the brand icons (Pair, Pass, Somewhat, Like, Verified, tier marks) to `packages/ui-web` and `packages/ui-native` from one SVG source under `assets/brand/`, or create a small `packages/icons`; decide in an ADR; replace the app-local `BrandMark` copies.
- **Why:** [BG §08] says custom brand icons live in one shared icon package; none exists.
- **Verified:** Confirmed: the mark is drawn in `apps/web/src/components/brand-mark.tsx`, `apps/admin/src/shell/brand-mark.tsx` and `apps/site/src/components/Header.astro`.
- **Task:** Before the MOD-07 reaction bar (`MOD-07-MOB-01`) and the A01 `TierBadge` (`MOD-00-ADM-01`)
- **Size:** medium
- **Gaps:** GAP-STD20-04
- **Status:** Open

#### Documents and READMEs

**REP-053** · A README in every app and package

- **Change:** Add a `README.md` to each of the six apps and seven packages, to [1MM-STD-05](standards/1MM-STD-05-README-STANDARD.md) §3 and §4, written in the first module that touches the workspace so that each describes real code.
- **Why:** Only `infra/README.md`, `assets/README.md` and `packages/db/migrations/README.md` exist below the root.
- **Verified:** Confirmed: no `README.md` in any `apps/*` or `packages/*` folder.
- **Task:** Mostly MOD-00; each module's first task in a workspace
- **Size:** medium
- **Gaps:** GAP-STD05-02
- **Status:** Open

**REP-054** · `scripts/check-docs.mjs` in CI

- **Change:** Add a dependency-free `scripts/check-docs.mjs` and run it in the `verify` job (a root script `check:docs`, or a step of `pnpm check:repo`): every `docs/**/*.md` is named in `docs/1MM-INDEX.md`; file names follow the pattern per folder; the header rows and the change log are present; every relative Markdown link resolves; every `GAP-` id is unique.
- **Why:** The "nothing orphaned" checks are manual, so a renamed file leaves dead links.
- **Verified:** Confirmed: `scripts/` has no docs check and `check-repo-rules.mjs` covers workflows and workspaces only. Note for the script: [1MM-DB-03](database/1MM-DB-03-SQL-STRUCTURE.md) repeats ten module gap ids in a cross-reference table, so "unique" must mean one defining row per id.
- **Task:** No task yet; add to MOD-00 (a `MOD-00-OPS` task)
- **Size:** small
- **Gaps:** GAP-STD02-02, GAP-STD09-06
- **Status:** Open

**REP-055** · Reconcile MOD-19 journeys with the exit gates of MOD-11 to MOD-17

- **Change:** `docs/execution/1MM-EXE-MOD-19-HARDENING-AND-LAUNCH.md` §7.2 and §7.3: read the exit gates of MOD-11 to MOD-17 against journeys J01–J22 and extend the tables.
- **Why:** Those seven plans landed after the journey list was built; only their explicit MOD-19 references were added.
- **Verified:** Not re-verified line by line: this is the author's own statement about the document, and the journey table (J01–J22) is present as described.
- **Task:** Coordinator or the next editor of MOD-19; no code task
- **Size:** medium
- **Gaps:** GAP-MOD19-05
- **Status:** Open

#### GitHub and repository settings

**REP-056** · Fuller pull-request template

- **Change:** `.github/pull_request_template.md`: add "Task id"; "Records" tick-boxes (progress-log entry id, gaps raised or closed, ADR, module plan change log, index); "API gate entry id (client tasks)"; "Definition of done" tick-boxes for the six [TR §17.3] items; "Screenshots (both themes)"; replace the `pnpm check` line with the full local run.
- **Why:** The template does not ask for the records the standards require, and lists `pnpm check` only, which is not all of CI.
- **Verified:** Confirmed: the template has "What and why", "Order of work" and three checks.
- **Task:** No task; a small pull request at the start of MOD-00, with the next entry
- **Size:** small
- **Gaps:** GAP-STD08-01
- **Status:** Open

**REP-057** · `check:ci` script that mirrors the `verify` job

- **Change:** Root `package.json`: add a script (for example `check:ci`) that runs the full `verify` sequence of [1MM-STD-10](standards/1MM-STD-10-COMMITS-AND-LOCAL-CI.md) §8.2, and point the pull-request template and `docs/USAGE.md` §3 at it; keep `pnpm check` as the quick run.
- **Why:** A pull request can pass `pnpm check` and fail CI on the audit, secret scan, banned terms, schema, roles, generated client, contract, build or bundle steps.
- **Verified:** Confirmed: `check` runs format check, lint, `check:repo`, typecheck and test; `ci.yml` runs eleven more steps around them.
- **Task:** No task; a small pull request at the start of MOD-00
- **Size:** small
- **Gaps:** GAP-STD10-02
- **Status:** Open

**REP-058** · Pull-request title check for task ids

- **Change:** `scripts/` and `.github/workflows/ci.yml`: add a dependency-free check in `verify` that fails a pull request whose title neither starts with a task id (`MOD-nn-<KIND>-nn: `) nor is marked as non-module work.
- **Why:** The commit-message convention is a habit, not a rule; the pull-request title becomes the squash commit.
- **Verified:** Confirmed: `.husky/` has a `pre-commit` hook only (lint-staged and the secret scan) and CI has no title check.
- **Task:** No task yet; add to MOD-00 (a `MOD-00-OPS` task)
- **Size:** small
- **Gaps:** GAP-STD10-01
- **Status:** Open

**REP-059** · Record CodeQL default set-up in `docs/USAGE.md`

- **Change:** `docs/USAGE.md` §8: add "CodeQL default set-up (JavaScript / TypeScript)" to the list of settings switched on under Settings → Code security, so the source of the required CodeQL result is written down.
- **Why:** Both rulesets require a CodeQL result (`code_scanning`). It comes from GitHub default set-up, which needs no workflow file, and `docs/USAGE.md` does not yet say so.
- **Verified:** Confirmed: both rulesets require CodeQL; §8 lists secret scanning, push protection, Dependabot alerts and private vulnerability reporting but not CodeQL set-up. The other half of both gaps (add a `codeql.yml` workflow) is not needed: see CHK-01.
- **Task:** No task; a documentation pull request
- **Size:** small
- **Gaps:** GAP-STD08-03, GAP-STD11-01
- **Status:** Open

**REP-060** · Delete the stale remote branch; auto-delete head branches

- **Change:** Delete the merged remote branch `ci/free-secret-scan` and switch on "Automatically delete head branches" in the repository settings.
- **Why:** The two-branch model does not allow working branches to linger.
- **Verified:** Confirmed from the local remote-tracking references only (`remotes/origin/ci/free-secret-scan` is listed); the remote was not contacted, so the branch may already be gone. The owner checks on GitHub.
- **Task:** No task; a repository setting for the owner
- **Size:** small
- **Gaps:** GAP-STD08-05
- **Status:** Open

### B.3 Checked and not needed, or noted

| Id     | Gaps                       | Claim                                                                                                                                   | Result                                                                                                                                                                                                                                                                       |
| ------ | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CHK-01 | GAP-STD08-03, GAP-STD11-01 | A `.github/workflows/codeql.yml` workflow is needed so that the CodeQL requirement in the rulesets can be met.                          | Checked: no change needed. GitHub CodeQL runs through default set-up on this repository, which needs no workflow file, and that satisfies both rulesets. Only the documentation line remains (REP-059).                                                                      |
| CHK-02 | GAP-STD08-02               | `.github/CODEOWNERS` names a code owner by an e-mail address next to a GitHub handle; replace the e-mail entry with a handle or a team. | Checked: no change needed. The file lists one owner by e-mail on every line, at the owner's explicit request. Nobody changes it unless the owner asks. For the record only: an e-mail entry counts as a code owner only if it belongs to a GitHub account with write access. |

## Part C · Gap indexes

Generated and checked by script against the "Gaps raised" tables on 24 Nov 2026: every gap whose
type includes DECISION or REPO has an entry, and no entry cites a gap of another type.

### C.1 DECISION gaps (50)

| Gap id       | Type              | Raised in      | Entry   |
| ------------ | ----------------- | -------------- | ------- |
| GAP-MOD00-08 | DECISION          | 1MM-EXE-MOD-00 | DEC-006 |
| GAP-MOD01-07 | DECISION          | 1MM-EXE-MOD-01 | DEC-008 |
| GAP-MOD01-08 | DECISION          | 1MM-EXE-MOD-01 | DEC-009 |
| GAP-MOD01-12 | DECISION          | 1MM-EXE-MOD-01 | DEC-010 |
| GAP-MOD02-06 | DECISION          | 1MM-EXE-MOD-02 | DEC-011 |
| GAP-MOD02-08 | DECISION          | 1MM-EXE-MOD-02 | DEC-012 |
| GAP-MOD02-10 | DECISION          | 1MM-EXE-MOD-02 | DEC-013 |
| GAP-MOD03-11 | DECISION          | 1MM-EXE-MOD-03 | DEC-015 |
| GAP-MOD03-12 | DECISION          | 1MM-EXE-MOD-03 | DEC-016 |
| GAP-MOD03-13 | DECISION          | 1MM-EXE-MOD-03 | DEC-017 |
| GAP-MOD04-02 | TR / DECISION     | 1MM-EXE-MOD-04 | DEC-018 |
| GAP-MOD04-04 | DECISION          | 1MM-EXE-MOD-04 | DEC-019 |
| GAP-MOD04-06 | SCHEMA / DECISION | 1MM-EXE-MOD-04 | DEC-020 |
| GAP-MOD05-04 | DECISION          | 1MM-EXE-MOD-05 | DEC-020 |
| GAP-MOD06-05 | DECISION          | 1MM-EXE-MOD-06 | DEC-021 |
| GAP-MOD06-10 | DECISION          | 1MM-EXE-MOD-06 | DEC-022 |
| GAP-MOD07-03 | DECISION          | 1MM-EXE-MOD-07 | DEC-023 |
| GAP-MOD09-13 | DECISION          | 1MM-EXE-MOD-09 | DEC-024 |
| GAP-MOD10-06 | TR, DECISION      | 1MM-EXE-MOD-10 | DEC-025 |
| GAP-MOD10-07 | TR, DECISION      | 1MM-EXE-MOD-10 | DEC-026 |
| GAP-MOD10-12 | DECISION          | 1MM-EXE-MOD-10 | DEC-027 |
| GAP-MOD11-07 | DECISION          | 1MM-EXE-MOD-11 | DEC-028 |
| GAP-MOD12-08 | DECISION          | 1MM-EXE-MOD-12 | DEC-030 |
| GAP-MOD12-12 | TR, DECISION      | 1MM-EXE-MOD-12 | DEC-031 |
| GAP-MOD13-01 | TR, DECISION      | 1MM-EXE-MOD-13 | DEC-032 |
| GAP-MOD13-04 | TR, DECISION      | 1MM-EXE-MOD-13 | DEC-033 |
| GAP-MOD13-12 | DECISION          | 1MM-EXE-MOD-13 | DEC-034 |
| GAP-MOD14-04 | DECISION          | 1MM-EXE-MOD-14 | DEC-037 |
| GAP-MOD14-07 | DECISION          | 1MM-EXE-MOD-14 | DEC-038 |
| GAP-MOD14-12 | DECISION          | 1MM-EXE-MOD-14 | DEC-039 |
| GAP-MOD15-06 | DECISION          | 1MM-EXE-MOD-15 | DEC-040 |
| GAP-MOD16-08 | DECISION          | 1MM-EXE-MOD-16 | DEC-041 |
| GAP-MOD16-10 | DECISION          | 1MM-EXE-MOD-16 | DEC-042 |
| GAP-MOD16-11 | DECISION          | 1MM-EXE-MOD-16 | DEC-043 |
| GAP-MOD17-07 | DECISION          | 1MM-EXE-MOD-17 | DEC-044 |
| GAP-MOD18-07 | DECISION          | 1MM-EXE-MOD-18 | DEC-046 |
| GAP-MOD19-02 | DECISION          | 1MM-EXE-MOD-19 | DEC-047 |
| GAP-MOD19-04 | DECISION          | 1MM-EXE-MOD-19 | DEC-048 |
| GAP-RES01-01 | DECISION          | 1MM-RES-01     | DEC-036 |
| GAP-RES01-02 | DECISION          | 1MM-RES-01     | DEC-003 |
| GAP-STD01-11 | DECISION          | 1MM-STD-01     | DEC-004 |
| GAP-STD03-07 | DECISION          | 1MM-STD-03     | DEC-005 |
| GAP-STD05-01 | DECISION          | 1MM-STD-05     | DEC-001 |
| GAP-STD11-10 | DECISION          | 1MM-STD-11     | DEC-049 |
| GAP-STD11-11 | DECISION          | 1MM-STD-11     | DEC-045 |
| GAP-STD12-05 | DECISION          | 1MM-STD-12     | DEC-035 |
| GAP-STD16-04 | DECISION          | 1MM-STD-16     | DEC-002 |
| GAP-STD17-02 | DECISION          | 1MM-STD-17     | DEC-014 |
| GAP-STD18-02 | DECISION          | 1MM-STD-18     | DEC-029 |
| GAP-STD19-04 | DECISION          | 1MM-STD-19     | DEC-007 |

Three DECISION gaps of the master plan (GAP-EXE00-01 to -03) are not in this index: they were
resolved there by task assignment and need no owner answer. GAP-EXE00-04 is DEC-050 and
GAP-EXE00-05 is DEC-051.

GAP-MOD04-06 and GAP-MOD05-04 ask the same question (which moderation outcomes get a member
notification) and share one entry. Mixed-type gaps (TR / DECISION, TR, DECISION, SCHEMA /
DECISION) also appear in [1MM-LOG-03](1MM-LOG-03-TECHNICAL-REFERENCE-EXTENSIONS.md) for their
Technical Reference or schema part.

### C.2 REPO gaps (71)

| Gap id       | Raised in      | Entry           |
| ------------ | -------------- | --------------- |
| GAP-DB02-01  | 1MM-DB-02      | REP-001         |
| GAP-DB02-02  | 1MM-DB-02      | REP-002         |
| GAP-DB02-03  | 1MM-DB-02      | REP-003         |
| GAP-DB02-04  | 1MM-DB-02      | REP-004         |
| GAP-DB04-03  | 1MM-DB-04      | REP-005         |
| GAP-DB04-04  | 1MM-DB-04      | REP-001         |
| GAP-DB05-05  | 1MM-DB-05      | REP-006         |
| GAP-DB05-07  | 1MM-DB-05      | REP-007         |
| GAP-MOD15-10 | 1MM-EXE-MOD-15 | REP-036         |
| GAP-MOD19-05 | 1MM-EXE-MOD-19 | REP-055         |
| GAP-STD01-01 | 1MM-STD-01     | REP-011         |
| GAP-STD01-02 | 1MM-STD-01     | REP-012         |
| GAP-STD01-03 | 1MM-STD-01     | REP-013         |
| GAP-STD01-04 | 1MM-STD-01     | REP-014         |
| GAP-STD01-05 | 1MM-STD-01     | REP-015         |
| GAP-STD01-06 | 1MM-STD-01     | REP-016         |
| GAP-STD01-07 | 1MM-STD-01     | REP-017         |
| GAP-STD01-08 | 1MM-STD-01     | REP-008         |
| GAP-STD01-09 | 1MM-STD-01     | REP-009         |
| GAP-STD02-02 | 1MM-STD-02     | REP-054         |
| GAP-STD03-02 | 1MM-STD-03     | REP-039         |
| GAP-STD03-03 | 1MM-STD-03     | REP-047         |
| GAP-STD03-05 | 1MM-STD-03     | REP-040         |
| GAP-STD03-06 | 1MM-STD-03     | REP-020         |
| GAP-STD04-01 | 1MM-STD-04     | REP-020         |
| GAP-STD04-02 | 1MM-STD-04     | REP-014         |
| GAP-STD04-03 | 1MM-STD-04     | REP-018         |
| GAP-STD04-04 | 1MM-STD-04     | REP-045         |
| GAP-STD04-05 | 1MM-STD-04     | REP-044         |
| GAP-STD04-06 | 1MM-STD-04     | REP-050         |
| GAP-STD05-02 | 1MM-STD-05     | REP-053         |
| GAP-STD05-03 | 1MM-STD-05     | REP-002         |
| GAP-STD06-01 | 1MM-STD-06     | REP-021         |
| GAP-STD06-02 | 1MM-STD-06     | REP-034         |
| GAP-STD06-03 | 1MM-STD-06     | REP-013         |
| GAP-STD06-04 | 1MM-STD-06     | REP-002         |
| GAP-STD08-01 | 1MM-STD-08     | REP-056         |
| GAP-STD08-02 | 1MM-STD-08     | CHK-02          |
| GAP-STD08-03 | 1MM-STD-08     | REP-059, CHK-01 |
| GAP-STD08-05 | 1MM-STD-08     | REP-060         |
| GAP-STD09-01 | 1MM-STD-09     | REP-024         |
| GAP-STD09-02 | 1MM-STD-09     | REP-025         |
| GAP-STD09-03 | 1MM-STD-09     | REP-026         |
| GAP-STD09-04 | 1MM-STD-09     | REP-027         |
| GAP-STD09-05 | 1MM-STD-09     | REP-028         |
| GAP-STD09-06 | 1MM-STD-09     | REP-054         |
| GAP-STD10-01 | 1MM-STD-10     | REP-058         |
| GAP-STD10-02 | 1MM-STD-10     | REP-057         |
| GAP-STD10-04 | 1MM-STD-10     | REP-010         |
| GAP-STD11-01 | 1MM-STD-11     | REP-059, CHK-01 |
| GAP-STD11-02 | 1MM-STD-11     | REP-022         |
| GAP-STD13-02 | 1MM-STD-13     | REP-030         |
| GAP-STD13-03 | 1MM-STD-13     | REP-031         |
| GAP-STD14-01 | 1MM-STD-14     | REP-030         |
| GAP-STD14-02 | 1MM-STD-14     | REP-032         |
| GAP-STD14-03 | 1MM-STD-14     | REP-029         |
| GAP-STD14-04 | 1MM-STD-14     | REP-037         |
| GAP-STD14-05 | 1MM-STD-14     | REP-023         |
| GAP-STD14-06 | 1MM-STD-14     | REP-019         |
| GAP-STD16-01 | 1MM-STD-16     | REP-038         |
| GAP-STD16-03 | 1MM-STD-16     | REP-022         |
| GAP-STD16-05 | 1MM-STD-16     | REP-035         |
| GAP-STD17-01 | 1MM-STD-17     | REP-033         |
| GAP-STD18-05 | 1MM-STD-18     | REP-041         |
| GAP-STD19-01 | 1MM-STD-19     | REP-042         |
| GAP-STD19-02 | 1MM-STD-19     | REP-043         |
| GAP-STD20-01 | 1MM-STD-20     | REP-048         |
| GAP-STD20-02 | 1MM-STD-20     | REP-049         |
| GAP-STD20-03 | 1MM-STD-20     | REP-051         |
| GAP-STD20-04 | 1MM-STD-20     | REP-052         |
| GAP-STD20-07 | 1MM-STD-20     | REP-046         |

## Change log

| Version | Date        | Change                                                                                                                                                 |
| ------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| v1.0    | 24 Nov 2026 | First issue: 49 decisions from 50 DECISION gaps; 60 repository follow-ups and 2 checked items from 71 REPO gaps, each verified against the repository. |
