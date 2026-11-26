# 1MM-LOG-02 · UI updates

|              |                                                                                                                                                                                                                                                                                                                                  |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Document** | 1MM-LOG-02                                                                                                                                                                                                                                                                                                                       |
| **Status**   | Running log · started 24 Nov 2026 · v1.0                                                                                                                                                                                                                                                                                         |
| **Audience** | UI and design agents; engineers and coding agents who find a UI need during implementation                                                                                                                                                                                                                                       |
| **Owner**    | Engineering lead (code owners)                                                                                                                                                                                                                                                                                                   |
| **Sources**  | The "Gaps raised" tables of every document under `docs/execution/`, `docs/standards/`, `docs/database/` and `docs/resources/`; [INV], [ADM], [WEB], [TR], [SQL], [TOK], [BG], [DDR], [CN], [UF], [OD-nn]                                                                                                                         |
| **Related**  | [1MM-LOG-01](1MM-LOG-01-PROGRESS.md), [1MM-LOG-03](1MM-LOG-03-TECHNICAL-REFERENCE-EXTENSIONS.md), [1MM-LOG-04](1MM-LOG-04-OPEN-DECISIONS-AND-FOLLOW-UPS.md), [1MM-STD-03](standards/1MM-STD-03-MOBILE-BUILD-STRATEGY.md), [1MM-STD-13](standards/1MM-STD-13-ERROR-CODES.md), [1MM-STD-20](standards/1MM-STD-20-DESIGN-SYSTEM.md) |

**What this document is for and when to open it.** Every change the design boards and UI specs
need so that they match the data, the API and the rules the build enforces. Each entry names the
exact UI part and can be acted on without opening another document. UI agents open it to pick up
work; engineers open it before a client task to see whether its board is waiting on an entry,
and add an entry when implementation finds a UI need. Bracket codes such as `[INV A5]` cite the
private spec pack, which is not in this repository.

## 1. Summary

39 entries: 34 from 31 gaps of type UI (including mixed types), and UIU-035 to UIU-039 from owner decisions. Each entry's **Status** line shows where it stands.

| Surface         | Blocks an API gate | Blocks a client task | Polish | Total  |
| --------------- | ------------------ | -------------------- | ------ | ------ |
| Mobile app      | 6                  | 9                    | 2      | 17     |
| Admin console   | 2                  | 5                    | 4      | 11     |
| Public website  | 0                  | 1                    | 1      | 2      |
| Billing web app | 0                  | 1                    | 0      | 1      |
| Cross-surface   | 0                  | 2                    | 1      | 3      |
| **Total**       | **8**              | **18**               | **8**  | **34** |

Priorities:

- **Blocks an API gate**: the design answer decides an endpoint, a field, a seed or a rule that
  the owning module must ship before its API gate, so it is needed first.
- **Blocks a client task**: the API can be built, but the named admin, web or mobile task cannot
  be finished to its definition of done without the board.
- **Polish**: a correction of text, a label or a token on a board; the build already follows
  the data and nothing waits on it.

## 2. How to use and update this log

### 2.1 Picking up an entry (UI agents)

1. Take entries in priority order: "Blocks an API gate" first, then "Blocks a client task" in
   module order (the task id in **Blocks** starts with the module number; modules run MOD-00 to
   MOD-19), then "Polish".
2. Read the whole entry. **UI part** names the screen id and name, admin module and view, or
   website module, and the element. **Change** says what to add, correct or remove. **Why**
   gives the data, endpoint or rule the design must match.
3. Design to the rules that apply to every board: both themes; the states loading, empty, error,
   offline and restricted where the screen has data; no text baked into a board that cannot be
   supplied as a string key (give the English source text); tokens only, no new colours, sizes
   or durations; phone layout plus the tablet behaviour of entries in section 7.
4. Where an entry offers alternatives ("either (a) … or (b) …"), choose one and write the choice
   in the entry when you close it. Where an entry depends on an owner decision, it names the
   decision in [1MM-LOG-04](1MM-LOG-04-OPEN-DECISIONS-AND-FOLLOW-UPS.md); do not design past it.
5. Set **Status** to `In design` with the date while you work, so two agents do not take the
   same entry.

### 2.2 Closing an entry

An entry is closed when all of these are true:

1. The board, the UI inventory entry and the relevant spec text (admin or website module) are
   updated in the spec pack, and the new or changed screen id, state name and element names are
   written into the entry under a line **Delivered**.
2. Any English source text is listed so that it can be seeded into the string catalogue.
3. The engineer who owns the blocked task confirms that the design matches the API (fields,
   states, error reasons) and sets **Status** to `Closed`, with the date and the pull request or
   pack version that carries it.
4. The originating gap rows in the source documents stay as they are; this log is the record of
   the resolution. Add a row to the change log at the end of this file.

Status values: `Open`, `In design`, `Delivered` (design done, waiting for the engineer's check),
`Closed`, `Withdrawn` (with the reason).

### 2.3 Adding an entry during implementation

1. First raise the gap in the "Gaps raised" table of the module or standard you are working
   from, with type `UI` (or a mixed type), as the gap protocol requires. Never patch around a
   missing board in code.
2. Add an entry here with the next free `UIU` number, under its surface, in the same format.
   Numbers are never reused or renumbered; new entries may therefore be out of numeric order
   inside a section.
3. Fill every field. **UI part** must name the screen id and name, admin module and view, or
   website module, and the element. If you cannot name the element, the gap is not ready to log.
4. Add the gap id to the index in section 9 and update the counts in section 1.
5. If the same change is already logged, add your gap id to that entry instead of a new entry.

### 2.4 Entry format

| Field    | Meaning                                                                                                 |
| -------- | ------------------------------------------------------------------------------------------------------- |
| Heading  | `UIU-nnn` and the UI part in short                                                                      |
| Gaps     | Originating gap ids                                                                                     |
| Surface  | Mobile app, Admin console, Public website, Billing web app or Cross-surface                             |
| UI part  | Screen id and name / admin module and view / website module, and the element                            |
| Change   | What must change or be added: new board, new state, new element, copy correction, removal, token change |
| Why      | The data, API or rule it must match, with the source                                                    |
| Blocks   | Module task ids that wait on it                                                                         |
| Priority | Blocks an API gate / Blocks a client task / Polish                                                      |
| Status   | Open until closed as in 2.2                                                                             |

## 3. Mobile app

By screen id from the UI inventory, in flow order.

### UIU-001 · A5 · Create your account: "Sign-ups are paused" state

- **Gaps:** GAP-MOD03-09
- **Surface:** Mobile app
- **UI part:** Screen A5 "Create your account" [INV A5]. Element: a whole-screen state that replaces the three sign-up buttons (Continue with email, Google, Apple). The "Sign in" link stays.
- **Change:** New state on the A5 board: title and one line of body saying new sign-ups are paused, no sign-up buttons, "Sign in" still available. Both themes. Copy comes from the i18n catalogue (no hard-coded text); supply the `en` wording on the board.
- **Why:** The kill switch `registration.open` is seeded on; when an admin turns it off (A31 flags) the API refuses new sign-ups with problem reason `registration_closed` (403, never retried) [SQL], [1MM-STD-13](standards/1MM-STD-13-ERROR-CODES.md). The board has no state for it.
- **Blocks:** `MOD-03-MOB-02` (A1–A5)
- **Priority:** Blocks a client task
- **Status:** Open

### UIU-002 · C6 · Location: "Invite code" and "Not open in your city yet" states

- **Gaps:** GAP-MOD03-09
- **Surface:** Mobile app
- **UI part:** Screen C6 "Location" [INV C6]. Elements: (1) an invite-code input with its error text; (2) a whole-screen waitlist state with a link out.
- **Change:** Add two states to the C6 board. (1) **Invite code**: shown when the chosen city is in a `beta` market; one text input for the code, a Continue button, and error text for a wrong, used or expired code. (2) **Not open in your city yet**: shown when the city is in a `waitlist` market; explains that the city is not live and offers "Join the waitlist", which opens the website waitlist page (W25). State where the member can change the city from either state.
- **Why:** `PUT /v1/me/location` returns the market status and refuses with `invite_required` (403; the client asks for the code) when `markets.beta_requires_invite` is true [OD-09], [TR §6.1], or with `market_waitlist` (403, never retried) when the city is not live. Invites are single use (`beta_invites`, `redeem_beta_invite()`) [SQL]. Neither state is on the board.
- **Blocks:** `MOD-03-MOB-05` (C1–C8)
- **Priority:** Blocks a client task
- **Status:** Open

### UIU-003 · L2 · Confirm it's you: e-mail channel and one-channel variant

- **Gaps:** GAP-MOD03-10
- **Surface:** Mobile app
- **UI part:** Screen L2 "Confirm it's you" [INV L2]. Element: the channel radio group (today SMS, WhatsApp, voice).
- **Change:** Change the radio group so it lists only the channels the API returns for this member. Add an **Email** option. Add a **one-channel variant** of the board (no radio group: one line saying where the code is sent, and Continue).
- **Why:** A member has a verified phone only after the Black Badge, so every member before it can receive the new-device code by e-mail only [TR §13.2]. The board assumes three phone channels for everyone.
- **Blocks:** `MOD-03-MOB-06` (L1–L4)
- **Priority:** Blocks a client task
- **Status:** Open

### UIU-004 · OB1 · Update the app: state for an operating system that is too old

- **Gaps:** GAP-MOD02-13
- **Surface:** Mobile app
- **UI part:** Screen OB1 "Update the app" [INV OB1]. Element: the screen's state set (today Required, Recommended, Maintenance).
- **Change:** Either (a) add a fourth OB1 state, "Your phone's software is too old": title, body naming the minimum OS version, no Update button, a link to help; or (b) record on the board that the minimum OS version is display text only, shown on the Required state. Design chooses (a) or (b); the entry is closed with the choice written here.
- **Why:** Column `app_versions.min_os_version` exists since schema v3.4 and is served by `GET /v1/config`, but no OB1 state tells a member whose device is below it why the update cannot be installed [SQL].
- **Blocks:** `MOD-02-MOB-02` (OB1 states)
- **Priority:** Blocks a client task
- **Status:** Open

### UIU-005 · New screen · "Passed" list with Rewind (Gold)

- **Gaps:** GAP-MOD07-02
- **Surface:** Mobile app
- **UI part:** No screen exists. A new board and inventory id are needed in the discovery family (next to D1 "Home — My Specs" and D7 "Likes"). Elements: list of specs the member passed, a Rewind action per row, an empty state, the upsell state for members without Gold.
- **Change:** Add the "Passed" screen to the canvas and give it an inventory id and route: list rows (photo, nickname, when passed), a Rewind button per row, empty, loading, error and offline states, and the locked state that leads to D15 for Free and Premium. Say where the screen is entered from (D1 or D3). State on the board whether Rewind is unlimited or show the remaining count.
- **Why:** Rewind is decided to live in the "Passed" list [OD-31 / P-2], [TR §2.3], and the rewind command endpoint is built in MOD-07, but no screen id, route or list endpoint exists. The list endpoint proposed with this gap is `GET /v1/reactions/passed?cursor` (Gold); it is in the module plan's gap row and becomes a Technical Reference extension in [1MM-LOG-03](1MM-LOG-03-TECHNICAL-REFERENCE-EXTENSIONS.md) once the board is agreed; the `rewinds` usage metric has no stated limit.
- **Blocks:** Rewind in the app. No task exists yet: MOD-07 adds an API task for the list and a `MOD-07-MOB` task for the screen when this entry is answered
- **Priority:** Blocks a client task
- **Status:** Open

### UIU-006 · ES6 · Message not sent: four missing failure reasons

- **Gaps:** GAP-MOD08-10, GAP-STD13-05
- **Surface:** Mobile app
- **UI part:** Screen ES6 "Message not sent" [INV ES6]. Element: the reason line and the actions under the failed bubble (today three reasons: No connection, Blocked by safety filter, Conversation limit; actions Try again, Delete message).
- **Change:** Add four states to the ES6 board: **blocked** (no Try again, and no wording that reveals the other member blocked them); **restricted** (the sender's account is restricted: link to AS1); **rate limited** (Try again after a wait; show the wait); **other** (generic failure with Try again). Each failed bubble keeps a text label, not colour alone.
- **Why:** Enum `send_failure_t` has seven values: `no_connection`, `safety_filter`, `conversation_limit`, `blocked`, `restricted`, `rate_limited`, `other` [SQL]. The send endpoint returns the reason and `message_failures.reason` stores it; the board covers three.
- **Blocks:** `MOD-08-MOB-04` (ES6 and the outbox rules)
- **Priority:** Blocks a client task
- **Status:** Open

### UIU-007 · AS1 · Account under review: "Warning" state with an appeal entry

- **Gaps:** GAP-MOD09-03
- **Surface:** Mobile app
- **UI part:** Screen AS1 "Account under review (restricted)" [INV AS1]. Element: a new state for a member who was warned (not restricted), with an "Appeal this decision" button. Also the notification wording for a new template N37 "Warning issued" on board NT4.
- **Change:** Add a **warning** state to AS1 (its stages today are Under review, Your side sent, Cleared): what the warning is for, that the account keeps working, and an "Appeal this decision" action that uses the same "Tell us your side" text box (600 characters) and send button AS1 already has. Add title and body wording for N37 "Warning issued" (push, e-mail, in-app) to NT4 (see the NT4 entry below).
- **Why:** A warning can be appealed [OD-35], and the data exists (`moderation_actions.action = 'warn'`, `appeals.moderation_action_id`) [SQL], but a warned member has no screen that shows the warning, no template among N01–N36 and no way into the appeal. The proposed template `N37` (category `security`) and the appeal request `{restriction_id | moderation_action_id, text, evidence_media_ids}` are in the module plan's gap row and become a Technical Reference extension in [1MM-LOG-03](1MM-LOG-03-TECHNICAL-REFERENCE-EXTENSIONS.md) once the board is agreed.
- **Blocks:** MOD-09 rule 22 for warnings (API); the member-facing AS1 state is built by MOD-05 (owner of AS1) once the board exists
- **Priority:** Blocks an API gate
- **Status:** Open

### UIU-008 · BL1 · Plan & billing: "On hold" state

- **Gaps:** GAP-MOD10-11
- **Surface:** Mobile app
- **UI part:** Screen BL1 "Plan & billing" [INV BL1]. Element: the status banner and its action (the board has five states).
- **Change:** Add an **On hold** state: says access to the plan is paused while the store retries the payment, and offers the store's update-payment action (App Store or Google Play). The same state is needed in the billing web app version of BL1 as a read-only notice for store-billed members.
- **Why:** `subscriptions.status` can be `on_hold` (store account hold: access paused, store retrying) since schema v3.4, and on hold counts as the member's one live subscription [OD-37], [UF §5.2]. `GET /v1/me/billing` returns it; the board has no state, so the member would see an unexplained pause.
- **Blocks:** `MOD-10-MOB-03` (BL1–BL5, BL7); `MOD-10-WEB-02`
- **Priority:** Blocks a client task
- **Status:** Open

### UIU-009 · NT4 · Notification and email catalogue: wording for every template

- **Gaps:** GAP-MOD11-05
- **Surface:** Mobile app
- **UI part:** Board NT4 "Notification and email catalogue" [INV NT4] (a reference board, not an app screen). Element: the title and body text per template and channel.
- **Change:** Extend NT4 from N01–N22 to all 44 templates: add `en` title and body for N23–N36 and for the website templates W01–W08, for each channel the template uses. Keep each text within the length limit the string catalogue holds for its key (`i18n_strings.max_length`). Wording must follow the lock-screen rule of DEC-029 in [1MM-LOG-04](1MM-LOG-04-OPEN-DECISIONS-AND-FOLLOW-UPS.md) once it is answered (recommended default: a title may carry the other member's nickname; no push carries message text, a real name, or a detail of a security or billing event). If template N37 is accepted (AS1 entry above), include it.
- **Why:** Template rows exist in `notification_templates` (N01–N36, W01–W08) but no `i18n_strings` rows are seeded, and boards carry wording for N01–N22 only [UF §15.20], [SQL]. Without `en` source text nothing can be seeded, translated or sent.
- **Blocks:** `MOD-11-DB-01` (wording for every template key in `en`), which is before MOD-11's API gate; native-language review
- **Priority:** Blocks an API gate
- **Status:** Open

### UIU-010 · NT3 · Email templates: layouts for every e-mail template

- **Gaps:** GAP-MOD11-05
- **Surface:** Mobile app
- **UI part:** Board NT3 "Email templates" [INV NT3]. Element: the e-mail body layouts (today eight: N11, N12, N13, N14, N15, N16, N18, N20).
- **Change:** Extend NT3 to every template that has an `email_template`: 25 templates carry one, so 17 more bodies are needed. For each: subject, preheader, heading, body, button label and the registered-entity footer, in `en`.
- **Why:** `notification_templates.email_template` names an MJML layout for 25 templates; the worker renders them and A25 previews them [SQL]. Only eight have a designed body.
- **Blocks:** `MOD-11-DB-01`; `MOD-11-ADM-01` (A25 e-mail preview)
- **Priority:** Blocks an API gate
- **Status:** Open

### UIU-011 · D13A · Group info: owner section

- **Gaps:** GAP-MOD12-05
- **Surface:** Mobile app
- **UI part:** Screen D13A "Group info" [INV D13A]. Element: a new section visible to the group owner (and, where noted, to members with the `admin` group role).
- **Change:** Add an owner section to the D13A board with: Edit group; Join requests (approve, decline); Members (remove, make admin, remove admin); Transfer ownership (pick an admin-role member, confirm); Pause group and Resume; Delete group (with a confirm step). Add the message shown when the owner taps Leave: ownership must be transferred first.
- **Why:** The canvas rule says the owner can transfer, pause or delete the group from Group info [CN group-rules], and the schema has the group role `admin` (`group_role_t`) [SQL], but the D13A board lists none of the owner actions. The endpoints proposed with this gap are `PUT /v1/groups/{id}/members/{userId}/role`, `POST /v1/groups/{id}/transfer`, `POST /v1/groups/{id}/members/{userId}/decline` and paused ↔ active in `PATCH /v1/groups/{id}`; an owner who tries to leave gets `owner_cannot_leave` (409). They are recorded in [1MM-LOG-03](1MM-LOG-03-TECHNICAL-REFERENCE-EXTENSIONS.md). The admin transfer dialog in A18 can only list admin-role members, so it has no valid target until a member can be promoted.
- **Blocks:** `MOD-12-API-08`; `MOD-12-MOB-04`; `MOD-12-ADM-02`
- **Priority:** Blocks an API gate
- **Status:** Open

### UIU-012 · GC4 · Review & create: wrong group limit in the copy

- **Gaps:** GAP-MOD12-07
- **Surface:** Mobile app
- **UI part:** Screen GC4 "Review & create" [INV GC4]. Element: the limit-reached line "You already own 1 group on Premium. Gold lets you run 3."
- **Change:** Copy correction on the board: the Gold number is 10, not 3. Write the line with a number placeholder so the app fills it from the Gold value of the entitlement `groups.own_max`.
- **Why:** The entitlement `groups.own_max` is 10 for Gold [DD §7], [SQL]. The board text contradicts it; the limit-reached error returns the entitlement and leads to D15.
- **Blocks:** `MOD-12-MOB-02` (GC1–GC5)
- **Priority:** Polish
- **Status:** Open

### UIU-013 · GC1 · Create group — basics: group photo (decide, then add or remove)

- **Gaps:** GAP-MOD12-11
- **Surface:** Mobile app
- **UI part:** Screen GC1 "Create group — basics" [INV GC1] (or D13A "Group info" for editing later). Element: a group photo picker. Consequence in the admin console: the "Group avatars" tab of A13 media moderation.
- **Change:** Design decides whether a group has a photo. If yes: add a photo picker to GC1 (and a change-photo row in the D13A owner section), using the standard upload flow. If no: record that groups use icons only, and remove the "Group avatars" tab from the A13 board. No place field is needed on GC1: the API copies the owner's city and rounded location when the group is created.
- **Why:** Columns `groups.avatar_media_id` and the media kind `group_avatar` exist, and A13 has a "Group avatars" tab, but GC1 has no photo input (icons replaced emoji avatars [CN]) [SQL], [ADM A13]. Uploads go through `POST /v1/media/upload-url`, built once in MOD-04.
- **Blocks:** `MOD-12-API-03`; `MOD-12-MOB-02`; the A13 tab in MOD-04
- **Priority:** Blocks an API gate
- **Status:** Open

### UIU-014 · LG4 · Trusted contacts: relationship field and SMS / WhatsApp choice

- **Gaps:** GAP-MOD13-08
- **Surface:** Mobile app
- **UI part:** Screen LG4 "Trusted contacts" [INV LG4]. Element: the add-contact form (today name and phone only, plus "Choose from my contacts").
- **Change:** Add to the add-contact form: an optional **Relationship** field, and a **channel** choice between SMS and WhatsApp for how the contact is reached. Keep "Choose from my contacts" as a picker that returns one contact; add one line of text saying the address book is never uploaded.
- **Why:** Columns `trusted_contacts.channel` and `trusted_contacts.relationship` exist and the admin safety desk (A15) shows the relationship [SQL], [DDR A57], but LG4 has no input for either. The contact picker needs the `expo-contacts` library, which is proposed as an addition to the stack in [1MM-LOG-03](1MM-LOG-03-TECHNICAL-REFERENCE-EXTENSIONS.md) together with the consent record written when a contact is added.
- **Blocks:** `MOD-13-API-05`; `MOD-13-MOB-01` (H2, LG4, LG5 preview)
- **Priority:** Blocks an API gate
- **Status:** Open

### UIU-015 · H1B · Chat with support: satisfaction rating after "solved"

- **Gaps:** GAP-MOD14-03
- **Surface:** Mobile app
- **UI part:** Screen H1B "Chat with support" [INV H1B]. Element: a rating prompt shown in the thread when an agent solves the ticket.
- **Change:** Either (a) add a 1–5 rating state to H1B that appears after the ticket is marked solved (five choices; the member may skip it), or (b) remove "asks for CSAT via the app" from the A27 Solve action. Design and the owner choose; if (b), this entry is closed as "removed" and the A27 text is corrected.
- **Why:** Column `support_tickets.csat` (1–5) exists and A27 says Solve asks for a rating through the app [ADM A27], [SQL], but H1B has no rating element and no endpoint exists; the route proposed with this gap is `POST /v1/support/tickets/{id}/csat`.
- **Blocks:** Nothing at launch if dropped; otherwise `MOD-14-MOB-03` and a new API route in MOD-14
- **Priority:** Polish
- **Status:** Open

### UIU-016 · New boards · Re-accept sheet and blocking re-accept screen (LG family)

- **Gaps:** GAP-MOD16-01
- **Surface:** Mobile app
- **UI part:** No board exists. Two new boards in the LG family, next to LG1 "Terms of Service", LG2 "Privacy Policy" and LG3 "Community Guidelines". Elements: a sheet, and a full blocking screen.
- **Change:** Add (1) a **re-accept sheet**, shown from 14 days before a changed document takes effect: title, the change summary, a link to the full document, Accept, and a way to dismiss until later; (2) a **blocking re-accept screen**, shown after the effective date: same content, Accept only (plus sign out). Accept must be reachable without scrolling through the whole text. Give both an inventory id.
- **Why:** Material changes to a legal document require re-acceptance [TR §16.2], [ADM App. D AD-40]. The data exists (`change_summary`, `reaccept_from`, `effective_at`, `is_material_change`, read against `v_current_consents`) [SQL], and acceptance is `POST /v1/consents`, but neither view is among the 154 screens. The API signal that a re-acceptance is due (a `legal` block on `GET /v1/me/account-status`) is recorded in [1MM-LOG-03](1MM-LOG-03-TECHNICAL-REFERENCE-EXTENSIONS.md) (GAP-MOD16-02).
- **Blocks:** `MOD-16-MOB-01` (re-accept part)
- **Priority:** Blocks a client task
- **Status:** Open

### UIU-017 · LG6 · Privacy & data: "Analytics" consent switch

- **Gaps:** GAP-MOD18-01
- **Surface:** Mobile app
- **UI part:** Screen LG6 "Privacy & data" [INV LG6]. Element: a new switch row. Also the place where the choice is first offered.
- **Change:** Add an **Analytics** switch to LG6, off by default, with one line saying what it allows. State on the boards where it is first offered to a new member (for example a step after sign-up) or that it is offered only in LG6. Record that screens before an account exists send no analytics.
- **Why:** The schema has the consent kind `analytics` and the API accepts analytics events only with it [TR §16.2], [SQL], but no mobile screen asks for it or lets a member withdraw it. A consent row needs a member (`consent_records.user_id` is NOT NULL), so pre-account screens cannot be consented. Until this is answered the app ships with analytics off for everyone.
- **Blocks:** `MOD-18-MOB-01` going live (it ships off); MOD-19 journey J18
- **Priority:** Blocks a client task
- **Status:** Open

## 4. Admin console

By module A01–A36 and view.

### UIU-018 · A04 · App shell (and A02 sign-in): "DEMO" environment badge

- **Gaps:** GAP-MOD00-09
- **Surface:** Admin console
- **UI part:** Admin module A04 "App shell", top bar environment badge; the same badge on A02 "Admin sign-in" [ADM A04], [ADM A02].
- **Change:** Add a "DEMO" badge style to boards A04 and A02: outlined, like the STAGING badge.
- **Why:** The badge defines `production`, `staging`, `dev` and `local`; the platform also has a `demo` environment [TR §4.4], served to the console as `environment` on `GET /admin/v1/me`. It has no badge style.
- **Blocks:** Demo environment only (`MOD-00-ADM-02`, `MOD-00-ADM-03`)
- **Priority:** Polish
- **Status:** Open

### UIU-019 · A09 · Member directory: Gender and Intention filters

- **Gaps:** GAP-MOD05-03
- **Surface:** Admin console
- **UI part:** Admin module A09 "Member directory and search", view: the directory list, filter bar [ADM A09].
- **Change:** Confirm the two filters **Gender** and **Intention** stay on the board (recommended: keep them; the API adds the parameters and no new index is needed), or remove both from the board.
- **Why:** The A09 filter list includes Gender and Intention, but the API line for `GET /admin/v1/members` has neither parameter. The data is `profiles.gender` and `profiles.intention` [SQL]; the indexing review found no new index is required ([1MM-DB-04](database/1MM-DB-04-INDEXING.md)). The parameters `gender=` and `intention=` are recorded in [1MM-LOG-03](1MM-LOG-03-TECHNICAL-REFERENCE-EXTENSIONS.md).
- **Blocks:** `MOD-05-API-02`; `MOD-05-ADM-01`
- **Priority:** Blocks an API gate
- **Status:** Open

### UIU-020 · A17 · Abuse rules: rule form fields

- **Gaps:** GAP-MOD09-11
- **Surface:** Admin console
- **UI part:** Admin module A17 "Abuse rules, macros and risk signals", views `/safety/rules`, `/safety/rules/new`, `/safety/rules/:id`: the rule form [ADM A17].
- **Change:** Update the form and board: add a **Name** field; change the single "Locale" select to a multi-select **Locales** (empty means all locales); add **report** and **email** to the "Applies to" options.
- **Why:** Table `abuse_rules` has `name`, `locales app_locale[]` (empty = all) and an `applies_to` list that includes `report` and `email` since schema v3.4 [SQL]. The form in the spec has one Locale, no Name and lacks the two surfaces.
- **Blocks:** `MOD-09-ADM-04`
- **Priority:** Blocks a client task
- **Status:** Open

### UIU-021 · A21 · Plans: new "Plan presentation" view (perk lines and compare rows)

- **Gaps:** GAP-MOD10-02
- **Surface:** Admin console
- **UI part:** Admin module A21 "Plans, products, prices, entitlements and trials" [ADM A21]. Element: a new view, "Plan presentation", per plan and for the compare table.
- **Change:** Add a view to A21 with two parts. (1) Per plan: the tagline key and the ordered list of key perk lines (each a text key). (2) Compare table: rows with a label key, the entitlement or remote-config key that supplies the value, optional feature flag, and sort order; add, edit, reorder, remove. Guarded by permission `plans.manage`, with the console's standard reason and audit pattern.
- **Why:** The member upgrade screen D15 shows perk lines per plan from `plans.key_perk_keys`, and D15 and the website plans page (W22) show a compare table from `plan_compare_rows`; the data dictionary names A21 / A28 as the writer [DD §1], [SQL]. Neither has a seed nor an editor. The endpoints proposed with this gap are `GET|PUT /admin/v1/plans/:code/presentation` and `GET|PUT /admin/v1/plans/compare-rows`; the seed rows are in [1MM-LOG-03](1MM-LOG-03-TECHNICAL-REFERENCE-EXTENSIONS.md).
- **Blocks:** `MOD-10-DB-01` (compare rows seed); `MOD-10-ADM-03` (A21); D15 perks in `MOD-10-MOB-01`; W22 in `MOD-15-WEB-03`
- **Priority:** Blocks an API gate
- **Status:** Open

### UIU-022 · A24 · Catalogues: vibe categories (8 → 14)

- **Gaps:** GAP-MOD02-11
- **Surface:** Admin console
- **UI part:** Admin module A24 "Engagement and matching ops", catalogue pages `/engagement/catalogues/*`: the vibe tag form, Category picker [ADM A24].
- **Change:** Update the A24 text and board from 8 to the 14 categories: interest, lifestyle, music, food, faith, sport, culture, going_out, travel, fitness, career, pets, home, other. The form reads the list from the API, so the board only needs to show the full set.
- **Why:** The CHECK on `vibe_tags.category` allows 14 values since schema v3.4 (`going_out`, `travel`, `fitness`, `career`, `pets`, `home` were added) [SQL], [DDR M2].
- **Blocks:** `MOD-02-ADM-03` (catalogue pages)
- **Priority:** Blocks a client task
- **Status:** Open

### UIU-023 · A24 / A31 · Remote-config values: remove the cross-environment chip

- **Gaps:** GAP-MOD02-12
- **Surface:** Admin console
- **UI part:** Admin module A24 "Engagement and matching ops", States; also the raw remote-config view in A31 "Platform config" [ADM A24], [ADM A31]. Element: the info chip "Staging: 50" shown when a value differs between environments.
- **Change:** Remove the chip from the board, or replace it with a "Default: n" chip that shows the seeded default from the migration. **Recommendation:** the default chip.
- **Why:** One environment's API cannot read another environment's database, so no endpoint can supply a live value from staging to production or the reverse.
- **Blocks:** The tuning screen in MOD-07 (`MOD-07-ADM-01`) and the A31 raw view (`MOD-02-ADM-01`); neither is held up
- **Priority:** Polish
- **Status:** Open

### UIU-024 · A27 · Help centre: categories, editor limits and four missing fields

- **Gaps:** GAP-MOD14-11
- **Surface:** Admin console
- **UI part:** Admin module A27 "Support inbox, help centre and feedback", help centre views: categories list and article editor [ADM A27].
- **Change:** Update the A27 text and board: (1) categories: 8 are seeded, not six (getting started, verification, matching, chats and groups, billing, safety, privacy, account); (2) editor limits: title 80 characters and summary 160 (not 120 and 300); (3) add four fields to the editor: **Last reviewed** date with a "Mark reviewed" action (an article cannot be published without it), **Related articles** (pick other articles), **Applies to plans**, **Platforms**.
- **Why:** Schema v3.4 seeds 8 `help_categories`, limits `help_articles` title to 80 and summary to 160, and has columns `last_reviewed_at` (required to publish), `related_ids`, `applies_to_plans` and `platforms`, which the website help centre (W32) and the app help screens read [SQL]. The A27 spec text is older than the schema.
- **Blocks:** `MOD-14-ADM-03` (help centre categories, list, editor, preview)
- **Priority:** Blocks a client task
- **Status:** Open

### UIU-025 · A28 · CMS: page templates (9 → 21) and block kinds (14 → 41)

- **Gaps:** GAP-MOD15-09
- **Surface:** Admin console
- **UI part:** Admin module A28 "CMS: pages, blocks, site settings and publishing": the page form's Template picker and the block editor's block-kind picker [ADM A28].
- **Change:** Update the A28 text and board to the schema lists. Templates (21): landing, generic, legal, safety, careers, investors, press, help, contact, how_it_works, plans, download, offer, waitlist, about, stories, journal, newsletter, status, campaign, error. Block kinds: the 41 catalogue kinds in the `site_blocks.kind` CHECK in `packages/db/migrations/0001_baseline_v3_4.sql` (from `hero_promise` to `legal_document_view`); the 12 older kinds kept for compatibility are not offered for new blocks. The pickers read the lists from the API.
- **Why:** The CHECK constraints on `site_pages.template` and `site_blocks.kind` hold 21 templates and 41 catalogue block kinds [SQL], [WEB §6.3]; the A28 text lists 9 and 14.
- **Blocks:** `MOD-15-ADM-01` (A28 pages, editor, blocks)
- **Priority:** Blocks a client task
- **Status:** Open

### UIU-026 · A29 · Careers applications: status list

- **Gaps:** GAP-MOD15-09
- **Surface:** Admin console
- **UI part:** Admin module A29 "CMS collections and inbound forms", Applications list and detail: the Status column, filter and change-status control [ADM A29].
- **Change:** Replace the statuses new / screening / rejected on the board with the schema pipeline: received, reviewing, interview, offer, hired, not_progressed, withdrawn.
- **Why:** The CHECK on `job_applications.status` holds those seven values since schema v3.4 [SQL], [DDR W13].
- **Blocks:** `MOD-15-ADM-04` (labels)
- **Priority:** Blocks a client task
- **Status:** Open

### UIU-027 · A32 · Responses: "tighten an existing policy" wording

- **Gaps:** GAP-MOD17-08
- **Surface:** Admin console
- **UI part:** Admin module A32 "Network and security dashboard", Responses view, response type `rate_limit` [ADM A32]. Element: the helper text "tighten a policy or add a new one".
- **Change:** Copy correction on the board: "tighten an existing policy". Remove any control that suggests creating a policy.
- **Why:** A31 exposes only `GET` and `PATCH /admin/v1/security/rate-limits/:key`, and a policy key takes effect only where code names it. A new policy is a code change with a seeded row, so it cannot be added from the console.
- **Blocks:** Nothing (`MOD-17-ADM-02` builds the corrected text)
- **Priority:** Polish
- **Status:** Open

### UIU-028 · A31 / A32 · Rate limits: "hits per policy" becomes "limited requests per route"

- **Gaps:** GAP-MOD17-09
- **Surface:** Admin console
- **UI part:** Admin module A31 "Platform config", view `/platform/rate-limits`, and the linked panel in A32 "Network and security dashboard" [ADM A31], [ADM A32]. Element: the "hits per policy" figure.
- **Change:** Change the label and the board to show **rate-limited requests per route** for the routes listed in the policy's `applies_to`, labelled as per route. Do not present the number as per policy.
- **Why:** The rollup table `api_request_rollups` counts `rate_limited` per route, not per policy, so two policies on one route (for example `login.account` and `login.ip`) cannot be told apart [SQL]. A per-policy count would need a new sampled column, which would be raised as a Technical Reference extension in [1MM-LOG-03](1MM-LOG-03-TECHNICAL-REFERENCE-EXTENSIONS.md) if chosen.
- **Blocks:** Nothing (`MOD-17-ADM-01`, `MOD-02-ADM-02` build the corrected label)
- **Priority:** Polish
- **Status:** Open

### UIU-035 · A04 · App shell: the "Help" item opens staff help articles

- **Gaps:** GAP-MOD00-08 (DEC-006), GAP-MOD00-14
- **Surface:** Admin console
- **UI part:** Admin module A04 "App shell", top bar "Help" item [ADM A04].
- **Change:** Replace "opens this spec's module help anchor" with: opens the console route `/support/help` (the A27 help-centre list) filtered to staff-audience articles. The item is hidden until A27 and the staff audience exist.
- **Why:** The owner chose option (b) of DEC-006 on 26 Nov 2026; the admin spec the item used to open is private and not hosted.
- **Blocks:** Showing the item (`MOD-14-ADM-03`); `MOD-00-ADM-02` ships it hidden and is not held up
- **Priority:** Blocks a client task
- **Status:** Open

## 5. Public website

By module W01–W40, then the global system.

### UIU-029 · W22 · Plans & pricing: compare table source

- **Gaps:** GAP-MOD10-02
- **Surface:** Public website
- **UI part:** Website module W22 "Plans & pricing" [WEB W22]. Element: the plan cards' perk lines and the compare table; the spec's data note that names `plans.features[]`.
- **Change:** Correct the W22 spec text: perk lines come from `plans.key_perk_keys` and the compare table from `plan_compare_rows` (a label and a value per plan), both through `/public/v1/plans` at site build. No layout change is expected; confirm the table still fits when the row list is edited in the admin (A21 "Plan presentation").
- **Why:** The schema source for the compare table is `plan_compare_rows` [DD §1], [SQL]; `plans.features[]` does not exist. The rows become admin-editable through the A21 view above.
- **Blocks:** W22 render in `MOD-15-WEB-03`
- **Priority:** Blocks a client task
- **Status:** Open

### UIU-030 · Website global system · Motion durations and toast radius

- **Gaps:** GAP-STD20-05
- **Surface:** Public website
- **UI part:** Website spec global system, sections "Shape, layout and grid" and "Motion" [WEB §3.3], [WEB §3.5]. Elements: motion durations, toast corner radius.
- **Change:** Token correction in the website spec and any board that shows them: motion durations are 150 ms and 250 ms (not 120 and 320); toasts use a 4 px radius (not 8).
- **Why:** Design tokens v3.0.0 and the brand guide are newer than the website spec and set 150 / 250 ms and a 4 px toast radius [TOK], [BG §07], [BG §10]. The site is built from the tokens, so the code already follows them.
- **Blocks:** Nothing
- **Priority:** Polish
- **Status:** Open

## 6. Billing web app

The billing-only web app in `apps/web`.

### UIU-031 · Billing web app · Shared loading, empty, error and offline states

- **Gaps:** GAP-STD13-04
- **Surface:** Billing web app
- **UI part:** Billing web app (`apps/web`), every view: sign-in, the web versions of B9, P5, GD5 and BL1–BL3 [TR §6.2]. Element: the shared state set.
- **Change:** Define the state set for the billing web app. **Recommendation:** adopt the public website's shared UI states (loading, empty, error, offline) [WEB §3.13] unchanged, and add boards for the payment and sign-in errors the web app shows: payment declined, billed by a store (read-only), a subscription already exists, wrong credentials, account locked.
- **Why:** The admin and website specs define their own states; no source defines them for the billing web app. The API returns the problem reasons `payment_declined`, `store_billed`, `subscription_exists`, `invalid_credentials` and `locked` to it ([1MM-STD-13](standards/1MM-STD-13-ERROR-CODES.md) §6.4).
- **Blocks:** `MOD-10-WEB-01`, `MOD-10-WEB-02`; `MOD-03-WEB-01`
- **Priority:** Blocks a client task
- **Status:** Open

## 7. Cross-surface

Tablet and landscape boards, tokens, assets, error and state patterns.

### UIU-032 · Tablet · Tab shell and D3 "Menu"

- **Gaps:** GAP-MOD00-10, GAP-STD03-04
- **Surface:** Cross-surface
- **UI part:** Mobile app, tab shell (five tabs) and screen D3 "Menu" [INV D3], at tablet widths (600 px and up).
- **Change:** Add tablet boards for the tab shell and for D3, or confirm in writing the interim rules now used: bottom tab bar (56 high, five items) up to the large-tablet class, then a side rail 80 wide with the same five items and order; D3 stays an overlay with a maximum width of 360; content is centred in a column, never stretched.
- **Why:** The tokens define `breakpoint.tablet` (600 px) [TOK] and tablets are a required target, but no source shows the shell or the drawer at tablet width. The interim rules are engineering recommendations in [1MM-STD-03](standards/1MM-STD-03-MOBILE-BUILD-STRATEGY.md) §3.2.
- **Blocks:** `MOD-00-MOB-04` (tab shell and D3 frame): tablet acceptance of the shell
- **Priority:** Blocks a client task
- **Status:** Open

### UIU-033 · Tablet and landscape · Boards for every layout that changes structure

- **Gaps:** GAP-STD03-04
- **Surface:** Cross-surface
- **UI part:** Mobile app, all 154 screens [INV]; the layouts that change structure on tablets: D1 "Home — My Specs" deck with a details pane, D8 "Chats" and D9 "Chat thread" as two panes, D7 "Likes" and D12 "Groups" grids, D14 "My profile", one form screen, one sheet, OB1 "Update the app", and the camera and liveness screens.
- **Change:** Add tablet boards (portrait and landscape) for those layouts, or confirm or replace the interim rules: side gutter 24; content, form and reading column maximum 640; primary button maximum 400, centred; deck card maximum 480, with card and details pane side by side from 1024; grids 3 columns on tablets and 4 on large tablets; chats as list (320–360) plus thread on large tablets; sheets centred, maximum width 560 and maximum height 85% of the window; toasts maximum 480 at bottom centre; camera, liveness, call and payment stay full screen; type scale and the 44 × 44 touch target unchanged.
- **Why:** No board shows a tablet, landscape or foldable layout; the brand guide gives only the grid (8 columns, 24 gutters, 640 for forms) [BG §07]. Until answered, every module builds to the interim rules in [1MM-STD-03](standards/1MM-STD-03-MOBILE-BUILD-STRATEGY.md) §3.2 and records its tablet behaviour.
- **Blocks:** Final tablet layouts in every `MOD-nn-MOB` task; store screenshots in MOD-19
- **Priority:** Blocks a client task
- **Status:** Open

### UIU-034 · Illustrations · File names that cite screens GD0 and P0

- **Gaps:** GAP-STD04-07
- **Surface:** Cross-surface
- **UI part:** Illustration assets `avatar_kofi…` (file name lists screen `GD0`) and `avatar_zara…` (file name lists screen `P0`) under `assets/illustrations/`. File names encode the screens that use each illustration.
- **Change:** Design confirms which boards `GD0` and `P0` mean (or renames the two files). Neither id is a heading in the UI inventory.
- **Why:** The engineering brand guide maps illustrations to screens from the file names ([1MM-STD-04](standards/1MM-STD-04-BRAND-GUIDE.md)); two ids match no inventory screen [INV]. Until answered the files are used on the screens the inventory does list.
- **Blocks:** Nothing
- **Priority:** Polish
- **Status:** Open

### UIU-036 · PM7 / E5 / R3 · Password rule text

- **Gaps:** GAP-MOD03-11 (DEC-015)
- **Surface:** Member app
- **UI part:** PM7 "Change password", E5 "Create a password", R3 "Create a new password": the password rule text under the field [INV PM7, E5, R3].
- **Change:** Replace "8+ characters, letters and numbers" with the length rule only. The breached-password check gives its own error after submit.
- **Why:** DEC-015 (26 Nov 2026): length minimum plus breach check, no composition rule [TR §13.2], [OD-07].
- **Blocks:** `MOD-03-MOB-*` password screens
- **Priority:** Blocks a client task
- **Status:** Open

### UIU-037 · Admin sanctions board · Action verbs

- **Gaps:** GAP-MOD09-13 (DEC-024)
- **Surface:** Admin console
- **UI part:** Admin sanctions board (cited in the gap as A20): the action verbs.
- **Change:** Keep warn / restrict / suspend / ban only; remove "Remove content + warning", "Remove photos + re-verify" and "Restrict payments".
- **Why:** DEC-024 (26 Nov 2026) kept the four verbs the schema supports.
- **Blocks:** `MOD-09-ADM-03`
- **Priority:** Blocks a client task
- **Status:** Open

### UIU-038 · LG5 and the website route table · Trusted-contact page path

- **Gaps:** GAP-MOD13-01 (DEC-032)
- **Surface:** Member app and public website
- **UI part:** LG5 "What your trusted contact sees": the route shown; website route table row 30 [INV LG5], [WEB].
- **Change:** Correct the stale paths to `1minitman.com/s/<token>`.
- **Why:** DEC-032 (26 Nov 2026): a static shell in `apps/site` serves `/s/*`.
- **Blocks:** `MOD-13-WEB-01`
- **Priority:** Blocks a client task
- **Status:** Open

### UIU-039 · H2 · "Talk to our safety team" button

- **Gaps:** GAP-MOD13-04 (DEC-033)
- **Surface:** Member app
- **UI part:** H2 "Safety centre", "Talk to our safety team" button [INV H2].
- **Change:** The button opens support chat H1B with the safety topic; only "I need help" raises an escalation.
- **Why:** DEC-033 (26 Nov 2026).
- **Blocks:** `MOD-13-MOB-01`, `MOD-13-MOB-04`
- **Priority:** Blocks a client task
- **Status:** Open

## 8. Board changes that wait on an owner decision

These are not entries yet. Each follows from a gap of type DECISION that names a board; when the
decision is answered in [1MM-LOG-04](1MM-LOG-04-OPEN-DECISIONS-AND-FOLLOW-UPS.md), whoever
records the answer adds the entry here (section 2.3) or strikes the row.

| Decision    | Gap                        | UI part                                                                                           | Board change if the recommended default is confirmed                                                             |
| ----------- | -------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| ~~DEC-006~~ | GAP-MOD00-08               | A04 "App shell", top bar "Help" item                                                              | Answered 26 Nov 2026, option (b): entry UIU-035                                                                  |
| ~~DEC-015~~ | GAP-MOD03-11               | PM7 "Change password", E5 "Create a password", R3 "Create a new password": the password rule text | Answered 26 Nov 2026: entry UIU-036                                                                              |
| ~~DEC-016~~ | GAP-MOD03-12               | D17 "Settings", theme row                                                                         | Answered 26 Nov 2026: no board change                                                                            |
| DEC-023     | GAP-MOD07-03               | D4 "Full spec profile", Share action                                                              | Action hidden while the flag is off; no board change until the privacy decision                                  |
| ~~DEC-024~~ | GAP-MOD09-13               | Admin sanctions board (cited in the gap as board A20): the action verbs                           | Answered 26 Nov 2026 (verbs): entry UIU-037                                                                      |
| ~~DEC-030~~ | GAP-MOD12-08               | GC5 "Group created", share link                                                                   | Answered 26 Nov 2026, option (a): the share link stays on GC5; no board change                                   |
| ~~DEC-032~~ | GAP-MOD13-01               | LG5 "What your trusted contact sees": the route shown; website route table row 30                 | Answered 26 Nov 2026: entry UIU-038                                                                              |
| ~~DEC-033~~ | GAP-MOD13-04               | H2 "Safety centre", "Talk to our safety team" button                                              | Answered 26 Nov 2026: entry UIU-039                                                                              |
| DEC-038     | GAP-MOD14-07               | H1B "Chat with support", composer                                                                 | No attach control at launch; add one only if chat attachments are approved                                       |
| DEC-043     | GAP-MOD16-11               | NT3 / NT4                                                                                         | One more e-mail template for a material legal change, only if the owner requires an e-mail notice                |
| DEC-020     | GAP-MOD04-06, GAP-MOD05-04 | NT4                                                                                               | Wording for any new moderation-outcome templates the owner approves (media rejected, prompt removed, ban, unban) |
| DEC-005     | GAP-STD03-07               | All phone boards                                                                                  | No change: phones stay portrait only, except full-screen media and calls                                         |

## 9. Gap index

Every gap whose type includes UI (31), with the entry or entries that carry it. Generated and checked by
script against the "Gaps raised" tables on 24 Nov 2026: no UI-type gap is without an entry, and
no entry cites a gap that is not of type UI.

| Gap id       | Type       | Raised in      | Entry            |
| ------------ | ---------- | -------------- | ---------------- |
| GAP-MOD00-09 | UI         | 1MM-EXE-MOD-00 | UIU-018          |
| GAP-MOD00-10 | UI         | 1MM-EXE-MOD-00 | UIU-032          |
| GAP-MOD02-11 | UI         | 1MM-EXE-MOD-02 | UIU-022          |
| GAP-MOD02-12 | UI         | 1MM-EXE-MOD-02 | UIU-023          |
| GAP-MOD02-13 | UI         | 1MM-EXE-MOD-02 | UIU-004          |
| GAP-MOD03-09 | UI         | 1MM-EXE-MOD-03 | UIU-001, UIU-002 |
| GAP-MOD03-10 | UI         | 1MM-EXE-MOD-03 | UIU-003          |
| GAP-MOD05-03 | TR / UI    | 1MM-EXE-MOD-05 | UIU-019          |
| GAP-MOD07-02 | UI         | 1MM-EXE-MOD-07 | UIU-005          |
| GAP-MOD08-10 | UI         | 1MM-EXE-MOD-08 | UIU-006          |
| GAP-MOD09-03 | UI         | 1MM-EXE-MOD-09 | UIU-007          |
| GAP-MOD09-11 | UI         | 1MM-EXE-MOD-09 | UIU-020          |
| GAP-MOD10-02 | SCHEMA, UI | 1MM-EXE-MOD-10 | UIU-021, UIU-029 |
| GAP-MOD10-11 | UI         | 1MM-EXE-MOD-10 | UIU-008          |
| GAP-MOD11-05 | UI         | 1MM-EXE-MOD-11 | UIU-009, UIU-010 |
| GAP-MOD12-05 | TR, UI     | 1MM-EXE-MOD-12 | UIU-011          |
| GAP-MOD12-07 | UI         | 1MM-EXE-MOD-12 | UIU-012          |
| GAP-MOD12-11 | UI         | 1MM-EXE-MOD-12 | UIU-013          |
| GAP-MOD13-08 | UI, TR     | 1MM-EXE-MOD-13 | UIU-014          |
| GAP-MOD14-03 | UI         | 1MM-EXE-MOD-14 | UIU-015          |
| GAP-MOD14-11 | UI         | 1MM-EXE-MOD-14 | UIU-024          |
| GAP-MOD15-09 | UI         | 1MM-EXE-MOD-15 | UIU-025, UIU-026 |
| GAP-MOD16-01 | UI         | 1MM-EXE-MOD-16 | UIU-016          |
| GAP-MOD17-08 | UI         | 1MM-EXE-MOD-17 | UIU-027          |
| GAP-MOD17-09 | UI         | 1MM-EXE-MOD-17 | UIU-028          |
| GAP-MOD18-01 | UI         | 1MM-EXE-MOD-18 | UIU-017          |
| GAP-STD03-04 | UI         | 1MM-STD-03     | UIU-032, UIU-033 |
| GAP-STD04-07 | UI         | 1MM-STD-04     | UIU-034          |
| GAP-STD13-04 | UI         | 1MM-STD-13     | UIU-031          |
| GAP-STD13-05 | UI         | 1MM-STD-13     | UIU-006          |
| GAP-STD20-05 | UI         | 1MM-STD-20     | UIU-030          |

Notes on merged and split gaps:

- GAP-STD13-05 repeats GAP-MOD08-10 (it says so itself) and is carried by the same entry.
- GAP-MOD00-10 is the tab-shell part of GAP-STD03-04; the two share one entry and GAP-STD03-04
  has a second entry for the other layouts.
- GAP-MOD03-09, GAP-MOD10-02, GAP-MOD11-05 and GAP-MOD15-09 each name more than one UI part and
  are split into one entry per part.
- Mixed-type gaps (TR / UI, SCHEMA, UI, TR, UI and UI, TR) also appear in
  [1MM-LOG-03](1MM-LOG-03-TECHNICAL-REFERENCE-EXTENSIONS.md) for their API or schema part.

## Change log

| Version | Date        | Change                                                                                                                                                                                         |
| ------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| v1.1    | 26 Nov 2026 | UIU-035 to UIU-039 added from DEC-006, DEC-015, DEC-024, DEC-032 and DEC-033; their rows in section 8 are answered, as are DEC-016 and DEC-030 (no board change). DEC-023 waits on the lawyer. |
| v1.0    | 24 Nov 2026 | First issue: 34 entries consolidated from 31 UI-type gaps in the execution, standards, database and resources documents.                                                                       |
