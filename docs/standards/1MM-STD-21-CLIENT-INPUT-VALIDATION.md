# 1MM-STD-21 · Client input validation

|              |                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Document** | 1MM-STD-21                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **Status**   | Proposed · v1.0 · 25 Nov 2026 (engineering recommendation awaiting the owner, [1MM-ADR-0080](../adrs/1MM-ADR-0080-CLIENT-INPUT-VALIDATION-STRATEGY.md))                                                                                                                                                                                                                                                                                         |
| **Audience** | Engineers, designers and coding agents building any screen that takes input                                                                                                                                                                                                                                                                                                                                                                     |
| **Owner**    | Engineering lead (code owners)                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Sources**  | [TR §5.1], [TR §13.1], [TR §13.2], [TR §13.4], [ADM §1.4], [ADM §1.5], [WEB §3.13], [WEB §5.10], [BG §13], [BG §15], [SQL] `remote_config`; OWASP Input Validation Cheat Sheet; OWASP ASVS 5.0; WCAG 2.2 (SC 1.3.5, 3.3.1–3.3.4, 3.3.7, 3.3.8, 4.1.3); NIST SP 800-63B §3.1.1; RFC 5321 §4.5.3; ITU-T E.164; Unicode UAX #15 and UAX #29                                                                                                        |
| **Related**  | [1MM-STD-13](1MM-STD-13-ERROR-CODES.md), [1MM-STD-16](1MM-STD-16-DEFENSIVE-PROGRAMMING.md), [1MM-STD-06](1MM-STD-06-API-FIRST.md), [1MM-STD-04](1MM-STD-04-BRAND-GUIDE.md), [1MM-STD-17](1MM-STD-17-LANGUAGE-CONFIGURATION.md), [1MM-STD-20](1MM-STD-20-DESIGN-SYSTEM.md), [1MM-STD-01](1MM-STD-01-TESTING-STRATEGY.md), [1MM-ADR-0006](../adrs/1MM-ADR-0006-PROBLEM-JSON-ERRORS.md), [1MM-ADR-0075](../adrs/1MM-ADR-0075-ERROR-CODE-SCHEME.md) |

**What this document is for and when to open it.** It says how every client (member app, admin
console, billing web app, website) checks what a person types or picks before it is sent: types,
limits, lengths, formats, input controls, timing and how a failure is shown. Open it before you
design or build any screen with an input, and when you review one. It adds nothing to the server's
rules: the API stays the authority ([1MM-STD-16](1MM-STD-16-DEFENSIVE-PROGRAMMING.md) §2), and the
error shape, codes and presentation are those of [1MM-STD-13](1MM-STD-13-ERROR-CODES.md).

## 1. Principles

1. **The server decides; the client helps.** Client validation exists for speed and clarity. It is
   never a security control (OWASP Input Validation Cheat Sheet; ASVS 5.0 "validation is enforced
   on a trusted service layer"). Every rule is enforced again by the API and, where it is an
   invariant, by the database ([1MM-STD-16](1MM-STD-16-DEFENSIVE-PROGRAMMING.md) §7).
2. **One rule, one place.** The shape of an input is the zod schema of its route in
   `packages/contracts`; forms reuse it through react-hook-form and its zod resolver [TR §5.1],
   ([1MM-RES-01](../resources/1MM-RES-01-OPEN-SOURCE-AND-PLATFORMS.md) "Forms"). A rule copied into
   a client by hand is a defect.
3. **Limits are data.** Every number a person meets (minimum and maximum length, count, range,
   size) comes from `remote_config` through `GET /v1/config` (public keys) or from the feature's
   own response, and is edited in the admin console (owner rule 3,
   [1MM-STD-06](1MM-STD-06-API-FIRST.md) §5). A literal limit in a client is a defect.
4. **Never stricter than the server.** A client rule that refuses what the API accepts blocks real
   people with no way round it. When the client cannot know the current limit (no config yet,
   offline with no cached copy) it skips that check and lets the API answer.
5. **Never silently change what a person typed** beyond the normalisation in §4. No silent
   truncation, no dropped characters.
6. **Messages are text from the catalogue.** Field messages are `error.field.<code>`
   ([1MM-STD-13](1MM-STD-13-ERROR-CODES.md) §4.3, §5.2), with the field's label and limit filled in.
   Client checks use the same field codes as the server, so a field shows the same words whether
   the client or the API caught the problem.
7. **Accessible by default.** Labels, instructions, error identification and suggestions meet
   WCAG 2.2 AA ([1MM-ADR-0070](../adrs/1MM-ADR-0070-ACCESSIBILITY-BASELINE-AND-SENSORY-SYSTEM.md)).

## 2. Where each part of a rule comes from

| Part of the rule                                                                                                              | Source of truth                                                                                       | How the client gets it                                                                                              | Managed in                                                                                                        |
| ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Type, format, required, enum values of a field                                                                                | The route's request schema in `packages/contracts/src/schemas/`                                       | Imported at build time                                                                                              | Code (contract change, reviewed)                                                                                  |
| Numeric limits (lengths, counts, ranges, sizes)                                                                               | `remote_config` rows with `value_type`, `min_value`, `max_value`, `unit` [SQL]                        | `GET /v1/config` for public keys; feature responses otherwise; cached per [1MM-STD-12](1MM-STD-12-DATA-HANDLING.md) | Admin console, remote config (A31)                                                                                |
| Option lists (selects, chips, multi-selects)                                                                                  | Catalogue tables and their seeds                                                                      | The catalogue endpoint of the owning module                                                                         | Admin console, catalogues                                                                                         |
| Labels, hints, placeholders, field messages                                                                                   | `i18n_strings`, defaults in `packages/i18n` ([1MM-ADR-0079](../adrs/1MM-ADR-0079-I18N-KEY-NAMING.md)) | The i18n bundle and its refresh                                                                                     | Admin console, text                                                                                               |
| Fixed ceilings (a CHECK literal with no config key, such as the status note's 40 characters)                                  | The CHECK constraint in the schema [SQL]                                                              | The contract schema carries the same literal, generated from or tested against the CHECK                            | Not admin-managed; a change is a migration. Prefer a config key at or below the ceiling when the limit may change |
| Server-only checks (breached password, disposable e-mail, VoIP number, reserved name, contact details, `self`, `not_allowed`) | The API use case                                                                                      | 422 `validation` with `errors[]` ([1MM-STD-13](1MM-STD-13-ERROR-CODES.md) §2.1)                                     | API and its config                                                                                                |

Every input on a screen is listed in its module plan §3 with its column, config key, catalogue and
i18n keys ([1MM-STD-02](1MM-STD-02-AGENTIC-OPERATIONS.md) "Data first"). An input whose limit has no
config key is a gap (`SCHEMA`), not a literal.

## 3. One schema for client and server

**Recommendation.** A request schema whose limits are configurable is exported from
`packages/contracts` as a function of its limits, so the API and the forms build the same schema
with the same live values:

```ts
// packages/contracts/src/schemas/intro.ts (illustrative shape, not an existing file)
export const introTextSchema = (limits: { maxChars: number }) =>
  z.object({ text: boundedText({ min: 1, max: limits.maxChars }) });
```

- The API passes the values it reads from `remote_config`; the client passes the values from
  `GET /v1/config`. When the client has no value, it passes `undefined` and the helper skips that
  bound (principle 4).
- Helpers such as `boundedText()` live once in `packages/contracts` and attach the field code
  ([1MM-STD-13](1MM-STD-13-ERROR-CODES.md) §4.3) to each issue, so the client and the API raise
  `too_long`, not two different messages.
- Fixed formats that are not configurable (UUID, E.164, ISO 8601 date, enum) are plain schemas.

## 4. Normalisation before validation

Applied in this order, in the shared helper, by the client before it validates and sends, and by
the API again before it validates and stores:

| Step | Rule                                                                                                                                       | Applies to                        |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------- |
| 1    | Unicode NFC normalisation (UAX #15), so the same word has one encoding and one length                                                      | Every text field except passwords |
| 2    | Trim leading and trailing white space. A field that is empty after trimming is `required` when required                                    | Every text field except passwords |
| 3    | Line endings to `\n`; no other control characters (Unicode category Cc) kept                                                               | Multi-line text                   |
| 4    | Remove all control characters, and line breaks                                                                                             | Single-line text                  |
| 5    | Lower-case the domain part only; the local part is kept as typed (RFC 5321 §2.4)                                                           | E-mail                            |
| 6    | Remove spaces, dashes, dots and brackets; parse with the member's country as the default; store and send E.164 (`+` and at most 15 digits) | Phone                             |
| 7    | Nothing: passwords are sent exactly as typed, spaces and all (NIST SP 800-63B)                                                             | Passwords                         |

The person sees the normalised value only where it helps (a phone number reformatted on blur); the
client never rewrites text while the person is typing.

## 5. Length is counted in characters people see

1. **Recommendation:** a length limit counts Unicode code points, the same unit as PostgreSQL
   `char_length()` used by the CHECK constraints, so the client, the API and the database agree.
   JavaScript `string.length` and zod's default `.max()` count UTF-16 code units, so an emoji can
   count twice. The shared `boundedText()` helper counts code points (`[...value].length`);
   GAP-STD21-01.
2. A counter shows "used / limit" from the moment the field reaches 80 % of its limit, and always
   on fields with a limit of 200 characters or fewer. The counter is announced politely to screen
   readers only when the limit is passed (WCAG 4.1.3).
3. Free text is **not** hard-capped with `maxLength`: pasting a long text must not drop the end
   silently. The field accepts the paste, shows the counter over the limit and the `too_long`
   message. Fixed-length codes (OTP) may use a hard cap.

## 6. Rules by kind of input

Field codes are those of [1MM-STD-13](1MM-STD-13-ERROR-CODES.md) §4.3. "Config" means the limit is a
`remote_config` key named in the module plan §3; examples are keys that exist today.

| Kind                                                            | Control (web / native)                                                                                                                                 | Client checks                                                                                                                                                                                                                                                                | Server-only checks                                                                                                         | Field codes                                                                             |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Single-line text (name, nickname, job title, group name)        | `<input type="text">` with `autocomplete` where one fits (`given-name`, `nickname`, `organization-title`) / `TextInput` with `autoComplete`            | Required; length min and max (config)                                                                                                                                                                                                                                        | Contact-detail filter [TR §13.4]; reserved names                                                                           | `required`, `too_short`, `too_long`, `contact_details`, `reserved`                      |
| Multi-line text (bio, prompt answer, intro text, report reason) | `<textarea>` / `TextInput multiline`                                                                                                                   | Required; length max (config, e.g. `intro.text_max_chars`, `chat.message_max_chars`); counter (§5)                                                                                                                                                                           | Contact-detail filter; safety filter on messages                                                                           | `required`, `too_long`, `contact_details`; reason `safety_filter`                       |
| E-mail                                                          | `type="email"`, `autocomplete="email"`, `inputmode="email"` / `keyboardType="email-address"`, `autoComplete="email"`, `autoCapitalize="none"`          | Required; one `@`; a domain with a dot; at most 254 characters (RFC 5321). No stricter pattern                                                                                                                                                                               | Deliverability, disposable domain, existence never revealed                                                                | `required`, `invalid_format`, `too_long`, `disposable_email`                            |
| Phone                                                           | `type="tel"`, `autocomplete="tel"` / `keyboardType="phone-pad"`, `autoComplete="tel"`; a country picker from the markets catalogue                     | Parses to a valid E.164 number for the chosen country                                                                                                                                                                                                                        | VoIP and virtual numbers; number in use                                                                                    | `required`, `invalid_format`, `voip_blocked`; reason `number_in_use`                    |
| Password (new)                                                  | `type="password"`, `autocomplete="new-password"`, show/hide toggle / `secureTextEntry`, `autoComplete="password-new"`, `textContentType="newPassword"` | Minimum length from `auth.password_min_length` (members) or `admin.password_min_length` (admins) ([1MM-ADR-0045](../adrs/1MM-ADR-0045-PASSWORD-MINIMUMS-AND-ADMIN-MFA.md)); paste and password managers allowed; no composition rules, no maximum below 64 (NIST SP 800-63B) | Breached-password check [TR §13.2]                                                                                         | `required`, `too_short`, `breached`                                                     |
| Password (sign-in)                                              | `autocomplete="current-password"` / `autoComplete="password"`                                                                                          | Required only. Never length-check a sign-in password                                                                                                                                                                                                                         | Credentials                                                                                                                | `required`; reason `invalid_credentials`                                                |
| One-time code                                                   | `autocomplete="one-time-code"`, `inputmode="numeric"` / `textContentType="oneTimeCode"`, `autoComplete="sms-otp"`                                      | Digits only, the length the code session states; paste and auto-fill allowed [BG §13]                                                                                                                                                                                        | Code value, expiry, tries                                                                                                  | `required`, `invalid_format`; reasons `code_wrong`, `code_expired`                      |
| Whole number, count, duration                                   | `inputmode="numeric"` (not `type="number"`, which accepts `e` and scrolls) / `keyboardType="number-pad"`; a stepper or slider when the range is small  | Integer; within the config range; the unit from the key's `unit`                                                                                                                                                                                                             | Range against the current row                                                                                              | `required`, `invalid_format`, `out_of_range`                                            |
| Money (admin only)                                              | Decimal entry in the currency's major unit, converted once to integer minor units ([1MM-STD-15](1MM-STD-15-DATA-STRUCTURES-AND-MODELS.md) §2.4)        | Two decimals for USD; not negative; within the config range                                                                                                                                                                                                                  | Threshold and approval rules                                                                                               | `invalid_format`, `out_of_range`                                                        |
| Date of birth                                                   | A date picker or three labelled fields; `autocomplete="bday"`                                                                                          | A real calendar date, not in the future                                                                                                                                                                                                                                      | Age at least 18 in the member's time zone ([1MM-ADR-0069](../adrs/1MM-ADR-0069-TEN-STEP-ONBOARDING-AND-UNDER-18-BLOCK.md)) | `required`, `invalid_format`, `out_of_range`; reason `age_gate_blocked`                 |
| Other dates and times                                           | The platform picker; values sent as ISO 8601 in UTC with the zone where the rule needs it                                                              | A real date; inside the allowed window when the window is known                                                                                                                                                                                                              | Window and state                                                                                                           | `invalid_format`, `out_of_range`                                                        |
| Single choice                                                   | Radio group (≤ 6 options) or select / bottom sheet; options from the catalogue                                                                         | Required when required; the value is one of the options received                                                                                                                                                                                                             | Option still active for this market                                                                                        | `required`, `invalid_format`, `not_allowed`                                             |
| Multiple choice (interests, languages)                          | Checkbox group or chips                                                                                                                                | Count between the config minimum and maximum                                                                                                                                                                                                                                 | Options active                                                                                                             | `required`, `out_of_range`, `not_allowed`                                               |
| Consent and confirmation                                        | Checkbox, never pre-ticked                                                                                                                             | Ticked when required. The legal version comes from the API                                                                                                                                                                                                                   | Document version current                                                                                                   | `required`; reason `version_not_current`                                                |
| URL (admin and CMS only)                                        | `type="url"`, `inputmode="url"`                                                                                                                        | `https:` only; parses as a URL; length max                                                                                                                                                                                                                                   | The server never fetches it [TR §13.1]                                                                                     | `invalid_format`, `too_long`                                                            |
| File or photo                                                   | The platform picker, filtered to the accepted types                                                                                                    | Declared type in the accepted list; size within the config limit; count within the slot limit                                                                                                                                                                                | Content type by inspection, re-encoding, moderation [TR §13.1]                                                             | `invalid_format`, `out_of_range`; reasons `unsupported_media_type`, `payload_too_large` |
| Search and filter text                                          | `type="search"`                                                                                                                                        | Length max; no other check (a search box never blocks)                                                                                                                                                                                                                       | Unknown sort and filter fields refused [ADM §1.4]                                                                          | `too_long`, `invalid_format`                                                            |

Rules that hold for every kind:

1. A field is labelled with visible text, never a placeholder alone (WCAG 3.3.2). A format the
   person must follow is stated before they type ("8 characters or more"), with the number from
   config.
2. Mark optional fields "(optional)" rather than marking required ones, when most are required.
3. `autocomplete` (web) and `autoComplete` / `textContentType` (native) are set on every field that
   collects the person's own data (WCAG 1.3.5) and never set to `off` to defeat password managers
   (WCAG 3.3.8).
4. Information already given in the same flow is pre-filled or selectable, never asked again
   (WCAG 3.3.7).
5. Regular expressions are anchored, bounded and checked for catastrophic backtracking; the length
   check runs before any pattern (OWASP ReDoS guidance).
6. Allow-lists over deny-lists: an enum, a catalogue value or a format, rather than a list of
   forbidden characters. Names accept any script, apostrophes, hyphens and spaces.

## 7. When to validate

| Moment                    | Behaviour                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| While typing, first time  | Nothing, except the length counter. A field is not shown as wrong before the person has left it                                                                                                                                                                                                                                                                                                           |
| On blur                   | Validate that field. Show its message if it fails                                                                                                                                                                                                                                                                                                                                                         |
| While typing, after error | Re-validate on each change and clear the message as soon as the value is valid (react-hook-form `mode: 'onTouched'`, `reValidateMode: 'onChange'`)                                                                                                                                                                                                                                                        |
| On submit                 | Validate every field. On failure: nothing is sent, every failing field shows its message, focus moves to the first invalid field, and forms with more than three fields show an error summary at the top that links to each field (web) or announces the count (native)                                                                                                                                   |
| Server answer 422         | Map each `errors[].path` to the form field with the same dotted name and show `error.field.<code>`; a path with no field on screen shows in the form-level message. Keep every value; focus the first field in error ([1MM-STD-13](1MM-STD-13-ERROR-CODES.md) §3 class `fix`). Until `MOD-00-API-01` adds `errors[].code` (GAP-STD13-02), an item without a code shows `error.validation` under its field |
| Other server answers      | Handled by the client's error module by retry class ([1MM-STD-13](1MM-STD-13-ERROR-CODES.md) §6); the form keeps its values                                                                                                                                                                                                                                                                               |

The submit button stays enabled and the check runs on press. Where a design disables it, the reason
is shown beside it ([1MM-STD-04](1MM-STD-04-BRAND-GUIDE.md) §14 rule 4). While a write is in flight
the button is disabled and keeps its label with a spinner, and the request carries its
`Idempotency-Key` where the route takes one ([1MM-ADR-0008](../adrs/1MM-ADR-0008-IDEMPOTENCY-KEYS-AND-CLIENT-IDS.md)).

## 8. How a failure is shown

1. The message sits directly under its field, starts with what is wrong and says how to fix it,
   with no blame ("Use 40 characters or fewer", not "Invalid input") (WCAG 3.3.1, 3.3.3;
   [1MM-STD-04](1MM-STD-04-BRAND-GUIDE.md) §14 rule 5).
2. The field's state is shown by an icon and text as well as colour, with the semantic error token
   ([1MM-STD-04](1MM-STD-04-BRAND-GUIDE.md) §15 "Colour independence"; [1MM-STD-20](1MM-STD-20-DESIGN-SYSTEM.md) §6).
3. Web: the input has `aria-invalid="true"` and `aria-describedby` pointing at the message and at
   any hint; the error summary is a focusable region with a heading. Native: `accessibilityState`
   and an accessibility announcement of the message ([1MM-STD-13](1MM-STD-13-ERROR-CODES.md) §6.1 rule 5).
4. Message lookup: `error.field.<code>` with `{label}` and the limit (`{min}`, `{max}`) filled in
   from the same config value the check used. Server messages (`errors[].message`) are English for
   developers and are never shown.
5. Validation failures are expected: they are not sent to Sentry and the rejected values are never
   logged or put in analytics events ([1MM-STD-13](1MM-STD-13-ERROR-CODES.md) §6.1 rule 4,
   [1MM-STD-16](1MM-STD-16-DEFENSIVE-PROGRAMMING.md) §11).
6. Before an action that cannot be undone, or that submits legal or financial data, the person can
   review and correct, or confirm (WCAG 3.3.4; confirm sheets per
   [1MM-STD-04](1MM-STD-04-BRAND-GUIDE.md) §14 rule 12).

## 9. Per client

| Client          | Notes                                                                                                                                                                                                                                                                                                                                                                                               |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Member app      | react-hook-form with the shared schemas; limits from the cached `GET /v1/config` ([1MM-STD-12](1MM-STD-12-DATA-HANDLING.md)); the contact-detail filter runs live as feedback only [TR §5.1]; the keyboard type and return key match the field; the form scrolls the first error into view above the keyboard                                                                                       |
| Admin console   | Same library and schemas. A config value is checked against its own row's `value_type`, `min_value` and `max_value` before saving ([1MM-STD-16](1MM-STD-16-DEFENSIVE-PROGRAMMING.md) §2). Reasons on governed actions follow the reason field rule of [1MM-STD-13](1MM-STD-13-ERROR-CODES.md) §4.6. The console's own constants are config too (owner rule 3). Drafts stay in memory only [ADM A03] |
| Billing web app | As the admin console, with the website's shared states ([1MM-STD-13](1MM-STD-13-ERROR-CODES.md) §6.4)                                                                                                                                                                                                                                                                                               |
| Website         | Forms work without JavaScript: the HTML attributes (`required`, `type`, `autocomplete`, `inputmode`) give the browser's own checks, and the server answers with the page and the messages. With JavaScript, the form sets `novalidate` and uses the shared schema so the messages are ours [WEB §5.10]                                                                                              |

## 10. Testing

Following [1MM-STD-01](1MM-STD-01-TESTING-STRATEGY.md):

1. **Schema unit tests** in `packages/contracts` for every shared helper and schema: empty,
   white space only, `min − 1`, `min`, `max`, `max + 1`, a text with emoji and combining marks
   (NFC and NFD forms), right-to-left text, a value with control characters.
2. **Parity test:** the API's route test sends the boundary values and asserts the same field codes
   the client schema produces.
3. **Form component tests:** the message appears on blur and not before, clears when fixed, focus
   moves to the first invalid field on submit, a 422 from a mocked API lands on the right field,
   values are kept.
4. **Config test:** a limit changed in config changes the client check and the hint without a
   release (API gate check T8 in [1MM-STD-01](1MM-STD-01-TESTING-STRATEGY.md)).
5. **Accessibility:** axe (web) and the native accessibility checks on the error state of each form.

## 11. Review checklist for any pull request with an input

- [ ] Every input maps to a contract schema field, a config key for each limit, a catalogue for
      each list and i18n keys for its label, hint and messages (module plan §3).
- [ ] No literal limit, option list or message in the client.
- [ ] The client uses the shared schema; it is not stricter than the API.
- [ ] Normalisation (§4) and length counting (§5) come from the shared helpers.
- [ ] The control, keyboard, `autocomplete` and `inputmode` follow §6.
- [ ] Timing follows §7; a 422 is mapped to fields and the values are kept.
- [ ] Messages are under the field, say how to fix, are linked for assistive technology, and are not
      reported to Sentry.
- [ ] Boundary, parity and form tests (§10) are in the pull request.

## 12. Gaps raised

Dispositions are recorded in [1MM-LOG-03](../1MM-LOG-03-TECHNICAL-REFERENCE-EXTENSIONS.md) and
[1MM-LOG-04](../1MM-LOG-04-OPEN-DECISIONS-AND-FOLLOW-UPS.md).

| Gap id       | Type | Where found                                                                              | What is missing or conflicting                                                                                                               | Proposed resolution                                                                                                                                                  | Blocks                       |
| ------------ | ---- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| GAP-STD21-01 | REPO | `packages/contracts`; zod `.max()`; PostgreSQL `char_length()`                           | zod counts UTF-16 code units; the database counts code points. A text of emoji near the limit passes one and fails the other                 | Add `boundedText()` and the normalisation helpers of §4 to `packages/contracts` in `MOD-00-API-01`, counting code points, and use them in every text schema          | First form with a text limit |
| GAP-STD21-02 | REPO | [1MM-STD-13](1MM-STD-13-ERROR-CODES.md) §2.1 `errors[]`                                  | A server `too_long`, `too_short` or `out_of_range` carries no limit, so a client with a stale config copy shows a message with an old number | Add an optional `params` object (`{min?, max?}`) to each `errors[]` item, registered in `ProblemSchema` with GAP-STD13-02; clients prefer it over their cached value | none (cached value used)     |
| GAP-STD21-03 | REPO | `packages/contracts`; [1MM-RES-01](../resources/1MM-RES-01-OPEN-SOURCE-AND-PLATFORMS.md) | No library is chosen for phone parsing and E.164 validation by country                                                                       | Choose one in an ADR before MOD-03 phone sign-in (candidate: `libphonenumber-js`, MIT, metadata subset for the markets catalogue)                                    | MOD-03 phone, MOD-06 phone   |
| GAP-STD21-04 | UI   | `packages/i18n/src/locales/en.json`                                                      | `error.field.<code>` messages have no agreed placeholders for the label and limit                                                            | Use `{label}`, `{min}`, `{max}` in every `error.field.*` key, added with GAP-STD13-03                                                                                | First client error state     |

## Change log

| Version | Date        | Change                                                    |
| ------- | ----------- | --------------------------------------------------------- |
| v1.0    | 25 Nov 2026 | First issue, proposed with 1MM-ADR-0080 (awaiting owner). |
