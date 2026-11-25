# 1MM-STD-13 · Error codes and error handling

|              |                                                                                                                                                                                                                                                                           |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Document** | 1MM-STD-13                                                                                                                                                                                                                                                                |
| **Status**   | Approved baseline · v1.0 · 24 Nov 2026                                                                                                                                                                                                                                    |
| **Audience** | Engineers and coding agents                                                                                                                                                                                                                                               |
| **Owner**    | Engineering lead (code owners)                                                                                                                                                                                                                                            |
| **Sources**  | [TR §8.1], [TR §8.2], [TR §8.3], [TR §8.4], [TR §11], [TR §12], [TR §13.1–13.3], [TR §14], [ADM §1.1–1.5], [ADM A03], [ADM A06], [WEB §3.13], [WEB §5.10], [INV A0·E, L1·E, X1, S1·E, C1·X, A5·E, H6, AS1, AS6, OB1, ES5, ES6], [SQL], repo `apps/api/src/platform/http/` |
| **Related**  | [1MM-STD-06](1MM-STD-06-API-FIRST.md), [1MM-STD-16](1MM-STD-16-DEFENSIVE-PROGRAMMING.md), [1MM-STD-01](1MM-STD-01-TESTING-STRATEGY.md), [1MM-STD-17](1MM-STD-17-LANGUAGE-CONFIGURATION.md), [1MM-EXE-MOD-00](../execution/1MM-EXE-MOD-00-FOUNDATIONS.md)                  |

**What this document is for and when to open it.** It is the single registry of every error the
API can return and the rule for how each client shows it. Open it before you add an error to a
route, before you write a client error state, and when a module plan names an error condition:
the code in section 4 is the canonical one, whatever the plan called it. Task `MOD-00-API-01`
implements this document in `packages/contracts`.

## 1. What exists today

| Piece           | Where                                            | Behaviour                                                                                                                                                              |
| --------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Problem shape   | `packages/contracts/src/schemas/problem.ts`      | `ProblemSchema`: `type` (default `about:blank`), `title`, `status`, `detail?`, `instance?`, `request_id`, `reason?`                                                    |
| Throwing        | `apps/api/src/platform/http/problem.ts`          | `ProblemError(status, title, extra)`; `extra` may carry `detail`, `reason`, `type` and any extension member                                                            |
| Formatting      | same file                                        | `problemResponse()` writes `application/problem+json` with `instance` = request path and `request_id`; `errorHandler` maps `ProblemError`, Hono `HTTPException`, other |
| Unknown route   | same file                                        | `notFoundHandler` → 404 "Not found"                                                                                                                                    |
| Unhandled error | same file                                        | Logged with message and stack; the response is 500 "Something went wrong" with no internals                                                                            |
| Validation      | `apps/api/src/platform/http/router.ts`           | `createRouter()` `defaultHook` → 422 "Validation failed", `reason: "validation"`, `errors: [{path, message}]`                                                          |
| Rate limiting   | `apps/api/src/platform/rate-limit/middleware.ts` | 429 "Too many requests", `reason: "rate_limited"`, `retry_after_seconds`, headers `Retry-After`, `RateLimit-Limit`, `RateLimit-Remaining`                              |
| Request id      | `apps/api/src/platform/http/middleware.ts`       | Inbound `X-Request-Id` kept when it matches `^[A-Za-z0-9_-]{8,64}$`, otherwise a UUID; echoed in the `X-Request-Id` header, the problem body and every log line        |
| Test            | `apps/api/src/app.test.ts`                       | Asserts problem+json and the request id on an unknown route                                                                                                            |

The sources fix four things: errors are RFC 9457 problem+json with a request id; gating errors
carry a machine reason and the upsell target, with the examples
`403 {reason:"entitlement", entitlement:"chat.full", upsell:"D15?plan=premium"}`, `403 restricted`
and `402 quota_exhausted` [TR §8.1]; a hidden admin action returns
`403 {reason:"permission", permission:"users.ban"}` [ADM §1.1]; a stale `If-Match` is a `412`
[ADM §1.4]. Everything else in this document that assigns a status or a code is a
**Recommendation** made binding by this standard, and is recorded for the Technical Reference in
GAP-STD13-01.

## 2. The problem document

### 2.1 Members

This is the target shape. Until `MOD-00-API-01` closes GAP-STD13-02 the scaffold sends
`errors: [{path, message}]` with no `code`, and `reason` is optional; clients must not depend on
`errors[].code` before then ([1MM-STD-21](1MM-STD-21-CLIENT-INPUT-VALIDATION.md) §7).

| Member                | Required                  | Rule                                                                                                                                                                             |
| --------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `type`                | yes                       | `tag:1minitman.com,2026:problem:<reason>`. An identifier, never fetched. `about:blank` is no longer emitted once `MOD-00-API-01` lands (GAP-STD13-02).                           |
| `title`               | yes                       | Short English summary of the problem type, the same for every occurrence. For logs and API readers. **Never shown to a member or admin as the message.**                         |
| `status`              | yes                       | The HTTP status, equal to the response status.                                                                                                                                   |
| `detail`              | no                        | English, occurrence-specific, safe to show to a developer. No personal data, no SQL, no stack, no vendor payload.                                                                |
| `instance`            | yes                       | The request path without the query string (query strings can carry personal data; the scaffold already does this).                                                               |
| `request_id`          | yes                       | Section 7.                                                                                                                                                                       |
| `reason`              | yes                       | **The error code.** One snake_case value from section 4, unique per condition, stable for ever. Clients branch on `reason` only, never on `title`, `detail` or the status alone. |
| `errors`              | with `validation`         | `[{path, code, message}]`: `path` is the dotted field path, `code` a field code from section 4.3, `message` the zod message (English, for developers).                           |
| `entitlement`         | with `entitlement`        | The entitlement key from `packages/entitlements` (for example `chat.full`) [TR §8.1].                                                                                            |
| `upsell`              | with gating codes         | The upsell target: a screen id and optional query, for example `D15?plan=premium` or `B0` [TR §8.1]. Section 5.1.                                                                |
| `permission`          | with `permission`         | The admin permission key, for example `users.ban` [ADM §1.1].                                                                                                                    |
| `retry_after_seconds` | with retry-after codes    | Whole seconds; the `Retry-After` header carries the same value.                                                                                                                  |
| `until`               | with `locked`, `cooldown` | ISO 8601 UTC instant when the condition ends.                                                                                                                                    |
| `tries_left`          | with `code_wrong`         | Remaining attempts before the lock [TR §13.2].                                                                                                                                   |
| `limit`, `used`       | with `quota_exhausted`    | The cap and the count, as returned by `spend_spec_view()` (`o_limit`, `o_used`) [SQL].                                                                                           |

Rules:

1. One name per condition. The code is `reason`; there is no second `code` member at the top level.
   The `type` URI is built from it, and the i18n key is built from it (section 5.2).
2. Codes are lower snake_case, `^[a-z][a-z0-9_]{2,48}$`. This matches the values the sources
   already use (`entitlement`, `quota_exhausted`, `rate_limited`, the website's
   `code → UI message key` list in [WEB §5.10], and the enum `send_failure_t` in [SQL]).
3. A code is never renamed, never reused for another meaning and never removed while any released
   app version may receive it. A removed code stays in the registry marked "retired".
4. A new extension member is added to the registry and to `ProblemSchema` before it is sent.
5. Nothing in a problem document reveals whether an account, e-mail address, phone number, block or
   out-of-scope row exists [TR §13.2], [ADM §1.1]. Section 4 marks the codes where this matters.
6. The response `Content-Type` is always `application/problem+json`, on every surface, including
   `/webhooks`.

### 2.2 Status codes in use

| Status | Meaning here                                                                  | Notes                                                                                                                        |
| ------ | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 400    | The request cannot be read (broken JSON, bad header, missing required header) | Not used for field validation.                                                                                               |
| 401    | Not signed in, or the credential is wrong, expired, revoked                   | The client may sign in again.                                                                                                |
| 402    | Payment or quota: paying or upgrading resolves it                             | `quota_exhausted` is fixed by [TR §8.1].                                                                                     |
| 403    | Signed in, but not allowed now                                                | Gating (`entitlement`, `permission`, `restricted`) and policy refusals.                                                      |
| 404    | Not found, or not visible to this caller                                      | Also used for out-of-scope admin rows [ADM §1.1], a feature whose flag is off, and rows hidden by RLS or a block.            |
| 409    | The request is valid but the current state refuses it                         | Every 409 has a specific code.                                                                                               |
| 410    | The thing existed and its window has closed                                   | Expired codes, links, appeal windows.                                                                                        |
| 412    | `If-Match` did not match                                                      | [ADM §1.4], [TR §8.1].                                                                                                       |
| 413    | Body or file too large                                                        | Body-size limits [TR §13.1].                                                                                                 |
| 415    | Wrong `Content-Type`                                                          | Website forms check it [WEB §5.10].                                                                                          |
| 422    | Well-formed but invalid input                                                 | The scaffold's validation hook. Module plans that wrote "400 validation" use 422.                                            |
| 423    | Locked for a time                                                             | X1 and the OTP locks [TR §13.2].                                                                                             |
| 428    | `If-Match` is required and missing                                            |                                                                                                                              |
| 429    | Rate limited                                                                  | [TR §13.3].                                                                                                                  |
| 500    | Our fault, unexpected                                                         | Never carries internals.                                                                                                     |
| 502    | A vendor answered with an error                                               |                                                                                                                              |
| 503    | Maintenance or a dependency is down                                           | `Retry-After` set. `GET /ready` returns 503 with its own JSON body (not a problem document): it is a probe, not an API call. |
| 504    | A vendor did not answer in time                                               |                                                                                                                              |

`202 Accepted` is a success, not an error. It is used where the action was received but has not
happened yet: an approval request (section 4.6) and asynchronous submissions such as website forms
[WEB §5.10].

## 3. Retry classes

Every code has one retry class. Clients implement the class, not a per-code rule.

| Class     | Meaning                                         | Client behaviour                                                                                                                                            |
| --------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `never`   | Repeating the same request cannot succeed.      | Show the message. No Retry button. Offer the next step if there is one.                                                                                     |
| `fix`     | Succeeds after the person changes the input.    | Keep the form filled, mark the fields, focus the first invalid field.                                                                                       |
| `auth`    | Succeeds after signing in or re-authenticating. | Run the sign-in or step-up flow, then resend the original request with the same `Idempotency-Key` [ADM A03].                                                |
| `refresh` | Succeeds after re-reading current state.        | Re-fetch the resource, show what changed, let the person decide again. Never resend automatically.                                                          |
| `after`   | Succeeds after a stated time.                   | Disable the action and show a countdown from `retry_after_seconds` or `until`. Do not poll.                                                                 |
| `backoff` | May succeed if repeated.                        | Automatic retry for safe (GET) and idempotent requests only: at most 3 tries, exponential backoff with jitter, same `Idempotency-Key`. Then a Retry button. |
| `upgrade` | Succeeds after buying or upgrading.             | Open the `upsell` target (section 5.1).                                                                                                                     |

The retry counts and delays above are a **Recommendation**; they live in one place per client (the
query-client configuration) so they can be changed without touching screens.

## 4. The registry

Columns: **Code** is `reason`. **i18n key** is always `error.<code>` (section 5.2), so it is not
repeated per row. "Hides existence" means the response is identical whether or not the underlying
thing exists.

### 4.1 Platform codes (any route)

| Code                       | Status | When                                                                                                                               | Retry     | Client behaviour                                                                              |
| -------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------- | --------- | --------------------------------------------------------------------------------------------- |
| `bad_request`              | 400    | Body is not valid JSON, a header is malformed                                                                                      | `never`   | Generic error state; a client bug, reported to Sentry                                         |
| `validation`               | 422    | Any zod failure on params, query, headers or body; an unknown sort or filter field [ADM §1.4]                                      | `fix`     | Field messages from `errors[]` (section 4.3)                                                  |
| `unauthenticated`          | 401    | No token or cookie, malformed token, expired access token                                                                          | `auth`    | Member clients refresh once, then sign in. Admin: sign-in page                                |
| `session_expired`          | 401    | Session revoked, on the denylist `sess:deny:{session}`, or (admin) past idle or absolute expiry [TR §8.1], [ADM A03]               | `auth`    | Sign in again. Admin keeps unsaved form drafts in memory and restores them [ADM A03]          |
| `token_reuse`              | 401    | A rotated refresh token was presented again; the family is revoked [TR §8.1]                                                       | `auth`    | Clear tokens, go to sign-in, show the security notice                                         |
| `reauth_required`          | 403    | Route needs M+ (re-auth within 5 min) [TR §8.2], or an admin permission with `requires_reauth` and MFA older than 5 min [ADM §1.2] | `auth`    | Member: re-auth sheet (`POST /v1/auth/reauth`). Admin: StepUpDialog, then resume [ADM A03]    |
| `permission`               | 403    | Admin lacks the permission now; carries `permission` [ADM §1.1]                                                                    | `never`   | Admin "no permission" state [ADM §1.5]                                                        |
| `entitlement`              | 403    | The member's role lacks the entitlement; carries `entitlement`, `upsell` [TR §8.1]                                                 | `upgrade` | Upsell (section 5.1)                                                                          |
| `quota_exhausted`          | 402    | A counted allowance is used up (daily specs, Direct Specs per week); carries `upsell`, `limit`, `used` [TR §8.1], [TR §8.5]        | `upgrade` | AS6 for specs [INV AS6]; otherwise the upsell target                                          |
| `restricted`               | 403    | A live `account_restrictions` row forbids this action [TR §8.1], [SQL]                                                             | `never`   | Route to AS1 [INV AS1]                                                                        |
| `suspended`                | 403    | The account is suspended or banned                                                                                                 | `never`   | Route to H6 [INV H6]                                                                          |
| `blocked`                  | 403    | A write against a pair where either blocked the other (`is_blocked_pair()`); never says who blocked [TR §8.4], [SQL]               | `never`   | Neutral message; remove the item from view. Reads of a blocked member return `not_found`      |
| `not_found`                | 404    | Unknown route or id; a row hidden by RLS, admin scope, a block, or non-membership. Hides existence                                 | `never`   | Not-found state; lists drop the row                                                           |
| `feature_disabled`         | 404    | The feature flag for the route is off (for example `calls.enabled`, `offers.enabled`, `spotlight.enabled`) [SQL], [WEB §5.10]      | `never`   | The client should not have called: re-read config and hide the entry point                    |
| `precondition_required`    | 428    | A route that requires `If-Match` was called without it                                                                             | `never`   | Client bug, reported to Sentry                                                                |
| `precondition_failed`      | 412    | `If-Match` does not match the current `updated_at` / `version` [ADM §1.4], [TR §8.1]                                               | `refresh` | "Someone else changed this. Reload to see their version." with a diff [ADM §1.4]              |
| `idempotency_key_required` | 400    | A route that requires `Idempotency-Key` was called without one, or the key is malformed                                            | `never`   | Client bug, reported to Sentry                                                                |
| `idempotency_key_reused`   | 409    | The same key arrived with a different request body                                                                                 | `never`   | Client bug, reported to Sentry                                                                |
| `idempotency_in_progress`  | 409    | The first request with this key is still running                                                                                   | `backoff` | Wait and resend with the same key; the stored response is replayed                            |
| `rate_limited`             | 429    | A `rate_limit_policies` limit was hit; carries `retry_after_seconds` [TR §13.3]                                                    | `after`   | Countdown; no automatic retry                                                                 |
| `locked`                   | 423    | A lockout is running (`lockout_seconds` of the policy, `account_lockouts`, `admin_users.locked_until`); carries `until` [TR §13.2] | `after`   | X1 for password sign-in [INV X1]; inline countdown elsewhere                                  |
| `payload_too_large`        | 413    | Body or declared file size over the limit [TR §13.1]                                                                               | `fix`     | Say the limit                                                                                 |
| `unsupported_media_type`   | 415    | Wrong `Content-Type`, or a file type that is not allowed                                                                           | `fix`     | Say the allowed types                                                                         |
| `maintenance`              | 503    | A maintenance window is active; carries `retry_after_seconds` [WEB §5.10], [SQL `maintenance_windows`]                             | `after`   | App: OB1 kind Maintenance [INV OB1]. Website: W06 banner and paused forms. Admin: error panel |
| `dependency_unavailable`   | 503    | Postgres, Redis or the queue is unreachable                                                                                        | `backoff` | Generic error with Retry                                                                      |
| `provider_error`           | 502    | A vendor returned an error (OTP sender, OAuth provider, payment, liveness)                                                         | `backoff` | Error with Retry; flow-specific fallback where one exists (A5·E) [INV A5·E]                   |
| `provider_timeout`         | 504    | A vendor did not answer within the timeout [TR §13.1]                                                                              | `backoff` | As `provider_error`                                                                           |
| `internal`                 | 500    | Any unhandled error                                                                                                                | `backoff` | Generic error with the request id and Retry                                                   |
| `expired`                  | 410    | A token, link, code session, invite, upload URL or window has passed                                                               | `never`   | Offer to start again                                                                          |

### 4.2 Client-side conditions (no HTTP response)

These are not sent by the API. They are listed so that clients use the same names in their own
error objects, analytics and i18n keys.

| Code            | When                                                         | Client behaviour                                                                                  |
| --------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `no_connection` | The device is offline or the request never reached the API   | App: A0·E at launch, ES5 banner in the app, ES6 for a message [INV]. Admin and website: section 6 |
| `timeout`       | The client's own request timeout fired                       | As `no_connection`, with Retry                                                                    |
| `bad_response`  | The response did not match the contract schema (section 6.5) | Generic error; reported to Sentry with the request id                                             |

`no_connection` is also a value of `send_failure_t` [SQL].

### 4.3 Field codes inside `validation`

`errors[].code` says why one field failed. Clients map `error.field.<code>` to a message, with
the field's own label.

| Field code         | Meaning                                                                                              | Source                                        |
| ------------------ | ---------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `required`         | Missing or empty                                                                                     | zod                                           |
| `invalid_format`   | Wrong shape (e-mail, phone in E.164, URL, date, enum value, unknown query field)                     | zod; [WEB §5.10] `invalid_*`, `invalid_phone` |
| `too_short`        | Under the minimum length (for example a password under `auth.password_min_length`)                   | [TR §13.2]                                    |
| `too_long`         | Over the maximum length (for example text over `intro.text_max_chars`)                               | module plans                                  |
| `out_of_range`     | Number, date or count outside the allowed range                                                      | zod, CHECK constraints                        |
| `contact_details`  | The contact-detail filter refused the text (nickname, name, bio, job title, group name, DM note)     | [TR §13.4]                                    |
| `reserved`         | A reserved name                                                                                      | MOD-03                                        |
| `breached`         | Password found in a breached-password list                                                           | [TR §13.2]                                    |
| `disposable_email` | Disposable e-mail domain                                                                             | [WEB §5.10]                                   |
| `voip_blocked`     | Virtual or VoIP number                                                                               | [WEB §5.10], MOD-06                           |
| `not_allowed`      | A valid value that is not permitted for this caller or market (inactive option, country not allowed) | module plans                                  |
| `self`             | The target is the caller (react to, report, block or invite yourself)                                | [SQL `record_reaction`]                       |

### 4.4 Authentication and onboarding (MOD-03)

| Code                     | Status | When                                                                                                      | Retry     | Client behaviour                           |
| ------------------------ | ------ | --------------------------------------------------------------------------------------------------------- | --------- | ------------------------------------------ |
| `invalid_credentials`    | 401    | Wrong e-mail or password. Hides existence: identical for an unknown e-mail [TR §13.2]                     | `fix`     | L1·E [INV L1·E]                            |
| `provider_token_invalid` | 401    | Google or Apple token failed verification                                                                 | `fix`     | A5·E, try the provider again [INV A5·E]    |
| `code_wrong`             | 422    | Wrong OTP; carries `tries_left` [TR §13.2]                                                                | `fix`     | Inline under the code field                |
| `code_expired`           | 410    | OTP past its 10 minutes [TR §13.2]                                                                        | `never`   | Offer resend                               |
| `cooldown`               | 409    | An action with a waiting period was repeated too soon (resend interval, nickname change); carries `until` | `after`   | Countdown on the control                   |
| `channel_unavailable`    | 422    | The chosen code channel cannot be used for this account                                                   | `fix`     | Offer the other channels                   |
| `phone_not_linked`       | 422    | Phone sign-in for a number with no verified, sign-in-enabled account [TR §8.2]                            | `never`   | The P1 "number not linked" state           |
| `integrity_failed`       | 403    | Play Integrity / App Attest verdict refused [TR §13.2]                                                    | `never`   | Message with a help link; no bypass        |
| `registration_closed`    | 403    | Flag `registration.open` is off [SQL]                                                                     | `never`   | Closed message                             |
| `age_gate_blocked`       | 403    | Under 18, or the device carries the 30-day flag [TR §13.2]                                                | `never`   | C1·X [INV C1·X]                            |
| `invite_required`        | 403    | Beta city and `markets.beta_requires_invite` is true [TR §6.1]                                            | `fix`     | Ask for the invite code                    |
| `market_waitlist`        | 403    | The member's city is not live (MOD-03 GAP-MOD03-09)                                                       | `never`   | Waitlist state                             |
| `last_method`            | 409    | Removing the last sign-in method [TR §8.2]                                                                | `never`   | Explain; offer to add another method first |
| `already_answered`       | 409    | A security sign-in prompt (PM6) was already answered                                                      | `refresh` | Show the recorded answer                   |
| `onboarding_incomplete`  | 409    | `POST /v1/me/onboarding/complete` before all 10 steps [TR §2.2]                                           | `refresh` | Resume at `users.onboarding_step`          |
| `version_not_current`    | 422    | A consent names a document version that is not the published one                                          | `refresh` | Re-fetch the legal document, ask again     |

`POST /v1/auth/oauth/*` returns `signed_in`, `link_required`, `not_linked` or `account_exists` as
**successful outcomes** in the body [TR §8.2]. They are not problem codes; S1·E is driven by
`not_linked`.

### 4.5 Domain codes by module

Every 409, 402, 403 and 410 that a module plan names has a code here. Conditions that a plan
describes as 404 use `not_found`; as 422, `validation` with a field code; as 429, `rate_limited`;
as 423, `locked`; as 412, `precondition_failed`.

| Code                      | Status | When                                                                                                                    | Retry     | Module         |
| ------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------- | --------- | -------------- |
| `consent_missing`         | 403    | A required consent is not on record (biometric consent before liveness, marketing consent for the `news` category)      | `fix`     | MOD-04, 06, 11 |
| `cap_reached`             | 403    | A fixed product cap that no plan lifts is reached                                                                       | `never`   | MOD-04         |
| `media_not_ready`         | 409    | The media asset is still processing, in quarantine or not an active photo                                               | `backoff` | MOD-04         |
| `upload_mismatch`         | 409    | The uploaded object is missing or does not match the declared type or size                                              | `fix`     | MOD-04         |
| `slot_taken`              | 409    | The photo or prompt slot is occupied (`uq_profile_media_slot`, `uq_prompt_slot`) [SQL]                                  | `refresh` | MOD-04         |
| `prompt_already_used`     | 409    | The prompt is already answered (`uq_prompt_once`) [SQL]                                                                 | `fix`     | MOD-04         |
| `main_photo_required`     | 409    | The main photo would be removed or moved out of slot 1; or a step needs a main photo                                    | `fix`     | MOD-04, 06     |
| `nickname_unavailable`    | 409    | The nickname is held (`nickname_history`) or claimed by another member; a reserved name is `validation` with `reserved` | `fix`     | MOD-04         |
| `already_requested`       | 409    | The same request is already open (export, re-verification, appeal: returns the first)                                   | `refresh` | MOD-04, 05, 09 |
| `window_closed`           | 410    | The time window for the action has passed (appeal outside `appeals.window_days`, undo, edit)                            | `never`   | MOD-04, 05, 09 |
| `illegal_state`           | 409    | A state change the current status does not allow, where no more specific code exists                                    | `refresh` | all            |
| `already_claimed`         | 409    | A review-queue item is claimed by another reviewer [ADM A12]                                                            | `refresh` | MOD-04, 06, 09 |
| `badge_steps_incomplete`  | 409    | Black Badge submit with steps missing, or a fix step not redone                                                         | `fix`     | MOD-06         |
| `badge_already_submitted` | 409    | An open application exists (`uq_badge_open`), or it is already completed [SQL]                                          | `refresh` | MOD-06         |
| `vendor_result_pending`   | 409    | The liveness result is not available yet                                                                                | `backoff` | MOD-06         |
| `number_in_use`           | 409    | The phone number is verified on another account (`uq_phone_one_account`) [SQL]                                          | `fix`     | MOD-06         |
| `payment_required`        | 402    | The step needs a paid transaction that does not exist                                                                   | `upgrade` | MOD-06, 10     |
| `nothing_to_undo`         | 409    | Undo or Rewind with nothing to reverse, or the undo window passed [TR §8.4]                                             | `never`   | MOD-07         |
| `not_pending`             | 409    | Answering a request, invite or approval that is no longer pending                                                       | `refresh` | MOD-08, 12     |
| `already_decided`         | 409    | A second intro decision (decisions are final: trigger `trg_intro_decisions_final`) [SQL]                                | `refresh` | MOD-08         |
| `intro_not_ended`         | 409    | Deciding before the intro has ended                                                                                     | `backoff` | MOD-08         |
| `conversation_exists`     | 409    | A pending request or live thread already exists (`uq_dm_pending_pair`, `uq_conv_live_pair`) [SQL]                       | `refresh` | MOD-08         |
| `conversation_not_live`   | 409    | Sending to a conversation that is not open                                                                              | `never`   | MOD-08         |
| `already_sent`            | 409    | A one-per-session item was already sent                                                                                 | `refresh` | MOD-08         |
| `safety_filter`           | 422    | The safety filter refused the message (`send_failure_t`) [SQL], [TR §13.4]                                              | `fix`     | MOD-08         |
| `conversation_limit`      | 403    | The open-conversations limit is reached (`send_failure_t`); carries `upsell` where a plan lifts it                      | `upgrade` | MOD-08         |
| `payment_declined`        | 402    | The provider declined the charge                                                                                        | `fix`     | MOD-10         |
| `already_paid`            | 409    | The one-off product is already paid for                                                                                 | `refresh` | MOD-10         |
| `subscription_exists`     | 409    | A live subscription exists (`uq_subs_one_live`, includes `on_hold`) [SQL], [OD-37]                                      | `refresh` | MOD-10         |
| `store_billed`            | 409    | A web billing action on a store-billed subscription [ADM A21]                                                           | `never`   | MOD-10         |
| `trial_already_used`      | 409    | One trial per verified person                                                                                           | `never`   | MOD-10         |
| `verification_required`   | 403    | The action needs a verified (ACTIVE or higher) member and is not sold as an entitlement                                 | `upgrade` | MOD-10         |
| `offers_disabled`         | 409    | Publishing an offer while `offers.enabled` is off [ADM A22]                                                             | `never`   | MOD-10         |
| `not_rendered`            | 409    | A document (invoice, receipt) is not rendered yet                                                                       | `backoff` | MOD-10         |
| `category_locked`         | 409    | A notification category or channel that cannot be switched off                                                          | `never`   | MOD-11         |
| `group_full`              | 409    | The group is at capacity                                                                                                | `never`   | MOD-12         |
| `group_paused`            | 409    | The group is paused                                                                                                     | `never`   | MOD-12         |
| `group_banned`            | 403    | The member is banned from this group                                                                                    | `never`   | MOD-12         |
| `group_role_required`     | 403    | The action needs the owner, an admin of the group, or membership (invite-only, admins-only)                             | `never`   | MOD-12         |
| `already_member`          | 409    | Joining or inviting someone who is already a member                                                                     | `refresh` | MOD-12         |
| `own_limit_reached`       | 409    | The member owns `groups.own_max` groups already                                                                         | `never`   | MOD-12         |
| `owner_cannot_leave`      | 409    | The owner tries to leave or be removed (`uq_group_one_owner`) [SQL]; MOD-12 GAP-MOD12-05                                | `never`   | MOD-12         |
| `ticket_closed`           | 409    | Writing to a closed support ticket                                                                                      | `never`   | MOD-14         |
| `duplicate`               | 409    | A unique name, key, code or vote already exists (a unique index refused the insert)                                     | `fix`     | MOD-14, 18     |
| `already_published`       | 409    | Editing a published legal document (immutable once published) [TR §6.1]                                                 | `never`   | MOD-16         |
| `deletion_state`          | 409    | Account deletion already scheduled, or nothing scheduled to cancel (`uq_deletion_scheduled`) [SQL]                      | `refresh` | MOD-16         |

Website form codes in [WEB §5.10] map as follows. Those under the offer endpoints stay unbuilt
while `offers.enabled` is off [OD-01].

| [WEB §5.10] code                                                 | Canonical                                         |
| ---------------------------------------------------------------- | ------------------------------------------------- |
| `invalid_*`, `invalid_phone`, `voip_blocked`, `disposable_email` | `validation` with the field code                  |
| `attachment_type`, `type_not_allowed`                            | `unsupported_media_type`                          |
| `attachment_size`, `too_large`                                   | `payload_too_large`                               |
| `wrong_code`                                                     | `code_wrong`                                      |
| `code_expired`, `token_expired`, `offer_ended`, `job_closed`     | `expired`                                         |
| `token_invalid`                                                  | `not_found`                                       |
| `too_soon`                                                       | `cooldown`                                        |
| `locked`, `rate_limited`                                         | unchanged                                         |
| `already_claimed` (offer), `duplicate_recent`                    | `duplicate`                                       |
| `city_live`                                                      | `illegal_state` (the city is live: show Download) |
| `not_eligible_country`, `cap_reached`                            | `cap_reached` / `validation` + `not_allowed`      |
| `upload_not_clean`                                               | `media_not_ready`                                 |

### 4.6 Admin step-up and approval

[ADM §1.2] defines three permission flags but not the API's answers for two of them (MOD-01
GAP-MOD01-11). This standard settles them:

| Situation                                                                   | Response                                                                                                                                                | Client behaviour                                                                           |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `requires_reason`, reason missing or outside 5–2,000 characters             | 422 `validation`, field `reason`                                                                                                                        | Field error in the confirm dialog                                                          |
| `requires_reauth`, MFA older than 5 minutes                                 | 403 `reauth_required`                                                                                                                                   | StepUpDialog; on success resend the same request with the same `Idempotency-Key` [ADM A03] |
| Step-up factor wrong                                                        | 422 `code_wrong`; after the `admin.login` limit, 423 `locked` [TR §13.3]                                                                                | Inline in the dialog                                                                       |
| `requires_approval`                                                         | **202** with `{approval_id, status: "pending", expires_at}`. Not an error: the target is unchanged                                                      | "Sent for approval" with a link to the request [ADM §1.2]                                  |
| Approver is the requester                                                   | 403 `approval_self` (the CHECK `decided_by <> requested_by` is the backstop) [ADM A06], [SQL]                                                           | Approve hidden; "Waiting for another admin"                                                |
| Approver lacks the approval's `permission_key`                              | 403 `permission` with that key [ADM A06]                                                                                                                | "You can't approve this: you don't hold …"                                                 |
| Approval is expired, cancelled, rejected or executed                        | 409 `not_pending`                                                                                                                                       | Show the current status                                                                    |
| Target changed since the request                                            | 409 `approval_target_changed`                                                                                                                           | "The record changed after this request. Ask for a new one." [ADM A06]                      |
| Execution failed after approval                                             | The approve call returns the vendor code (`provider_error`, …); the approval stays `approved` [ADM A06]                                                 | "Retry execution" (idempotent)                                                             |
| IP not on the admin allow-list                                              | 403 `ip_not_allowed` [ADM §1.1]                                                                                                                         | Full-page message; no data                                                                 |
| Row outside the admin's scope                                               | 404 `not_found`, never 403, so scope cannot be probed [ADM §1.1]                                                                                        | Not-found state                                                                            |
| A production config write without an approved approval reaches the database | The trigger `enforce_config_approval()` raises [SQL]; the API must have returned 202 before this point, so reaching it is a bug → 500 `internal`, alert | Generic error                                                                              |

### 4.7 Webhooks (`/webhooks`)

Vendors are the callers, so the body matters less than the status. The intake pipeline is: read
the raw body, verify the signature, insert once into `webhook_events`, acknowledge, enqueue
[TR §12], [MOD-00](../execution/1MM-EXE-MOD-00-FOUNDATIONS.md).

| Situation                                             | Response                        | Effect                                                                                                                                   |
| ----------------------------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Signature missing or invalid                          | 401 `webhook_signature_invalid` | Nothing is processed. Counted and alerted on a spike [TR §14]                                                                            |
| Unknown provider path                                 | 404 `not_found`                 |                                                                                                                                          |
| Body unreadable                                       | 400 `bad_request`               |                                                                                                                                          |
| Duplicate event (`UNIQUE (provider, event_id)`) [SQL] | **200**, same as the first time | Not processed again. A duplicate is expected, not an error                                                                               |
| Event type we do not use                              | **200**                         | Stored with `status = 'ignored'`                                                                                                         |
| Stored, processing fails later                        | The vendor already has its 200  | `status = 'failed'`, `attempts`, `last_error`, `attempt_log`; `webhooks.retry` retries with backoff and alerts after 5 attempts [TR §11] |
| Cannot store (database down)                          | 503 `dependency_unavailable`    | The vendor retries on its own schedule                                                                                                   |

A processing failure is never reported to the vendor as 4xx: a 4xx tells most vendors to stop
retrying.

### 4.8 WebSocket and server-sent events

`message.send` over `/v1/ws` has the same validation as REST [TR §8.3]. A failed frame is answered
with an error event that carries the same `reason`, `request_id` and extension members as the
problem document, and the client id of the frame. A failed message send is stored client-side with
a `send_failure_t` reason for ES6; every value except `other` is a registry code, and `other`
stands for any code not in the enum [SQL], [INV ES6]. The socket's authentication errors and close
codes are open in MOD-00 GAP-MOD00-11; when settled they use the codes `unauthenticated`,
`session_expired` and `rate_limited` from this registry.

## 5. Gating, messages and upsell

### 5.1 Gating errors and upsell targets

1. The API decides. A client may hide or lock a control from `GET /v1/me/entitlements`, but the
   route still checks, and the client must handle the gating error even for a control it showed
   as available (the member's plan may have changed a second ago) [TR §8.1].
2. `upsell` is `<screen id>[?query]` using the ids of the UI inventory: `D15` (plans), `B0`
   (Black Badge), with `plan=premium` or `plan=gold` [TR §8.1], [INV AS6]. Each client owns one
   table from screen id to its own route: the app to Expo Router paths, the billing web app to its
   pages. The API never returns a client path.
3. Which upsell applies is the API's decision from the member's role: an unverified Free member
   who hits the daily cap gets `B0`; a verified Free member gets `D15?plan=premium` [TR §8.5],
   [INV AS6].
4. Gating errors are expected events, not faults: they are not sent to Sentry, and they are
   counted for analytics by the owning module.
5. `restricted` and `suspended` are also pushed as the WebSocket event `account.restricted`
   [TR §8.3], so the app can route to AS1 or H6 before the next request fails.

### 5.2 Messages and i18n

1. The API returns codes, not prose for people. `title` and `detail` are English and for
   developers.
2. Every client resolves the message as `error.<reason>` from the i18n catalogue
   (`i18n_strings`, bundled defaults in `packages/i18n`), so wording is managed in the admin
   console like all other text (owner rule 4). Field messages use `error.field.<code>`.
3. A screen may override with a more specific key, `error.<reason>.<screen id>` (for example X1's
   heading "Let's pause for 15 minutes" [INV X1]). Lookup order: screen key, then `error.<reason>`,
   then `error.internal`.
4. Every code in section 4 has an `en` entry in `packages/i18n` before the route that returns it
   merges. A test enumerates the registry and fails on a missing key (section 8).
5. Messages say what happened and what to do next. "Something went wrong" alone is not allowed
   [WEB §3.13]. `error.internal` therefore includes the next step (try again; contact support with
   the reference).
6. `en` is the fallback for `pcm` and `fr` (`packages/i18n`). The admin console is English only
   [ADM §1.9] and uses the same keys.

## 6. How each client presents errors

### 6.1 Shared rules

1. One error module per client turns a response into a typed object
   `{reason, status, requestId, retry, fields, upsell, until, retryAfterSeconds}` using
   `ProblemSchema` from `packages/contracts`. Screens never read `response.status` directly.
2. Unknown `reason` (a newer API than the client): treat by status class. 4xx → `never` with
   `error.internal` wording; 5xx → `backoff`. Never crash on an unknown code.
3. The request id is shown, copyable, on every generic error state and attached to Sentry events.
4. Expected codes (`validation`, gating, `rate_limited`, `locked`, `not_found`, `cooldown`,
   `code_wrong`, `invalid_credentials`) are not reported to Sentry. `internal`, `bad_request`,
   `bad_response`, `idempotency_key_*`, `precondition_required` always are.
5. Errors are announced to assistive technology: field errors linked with `aria-describedby` on
   web [ADM §1.5]; an accessibility announcement on mobile.

### 6.2 Admin console

The standard states of [ADM §1.5] apply to every list, detail and form.

| Condition                         | Presentation                                                                                                                          |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Any error without a specific rule | Inline error panel: the message, `request_id` (copyable), Retry (only for `backoff` codes) [ADM §1.5]                                 |
| `validation`                      | Field errors under the field, linked with `aria-describedby` [ADM §1.5]                                                               |
| `permission`                      | Route: "You don't have access to this page" with the permission key and the roles that hold it. Action: toast with the key [ADM §1.5] |
| `reauth_required`                 | StepUpDialog, then automatic resume [ADM A03]                                                                                         |
| 202 approval                      | "Sent for approval" with a link to `/access/approvals/:id` [ADM §1.2]                                                                 |
| `precondition_failed`             | "Someone else changed this. Reload to see their version." with a diff [ADM §1.4]                                                      |
| `session_expired`                 | Locked screen or `/signed-out?reason=revoked`; drafts kept in memory [ADM A03]                                                        |
| `no_connection`                   | Top bar "You're offline. Changes are paused."; writes disabled; nothing is queued [ADM §1.5]                                          |
| `rate_limited`, `locked`          | Panel or dialog message with the countdown                                                                                            |

### 6.3 Website

[WEB §3.13]: an inline message that says what happened and how to fix it, plus Retry. Form
endpoints map each code to a UI message key [WEB §5.10]. `maintenance` shows the W06 banner and
pauses forms, except the safety form [OD-32]. Offline navigation is served `/offline` by the
service worker [WEB §3.13]. Pages are static, so a failed data call never blanks a page: the
section falls back to its built content or is hidden.

### 6.4 Billing web app

No source defines a separate state set for the billing web app [TR §6.2]. **Recommendation:** it
uses the website's shared states [WEB §3.13] and the mobile mapping for payment and sign-in codes
(`payment_declined`, `store_billed`, `subscription_exists`, `invalid_credentials`, `locked`),
because it shows the web versions of B9, P5, GD5 and BL1–BL3. Recorded as GAP-STD13-04.

### 6.5 Member app

| Condition                                             | Screen or state                                                                                     | Source     |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ---------- |
| `no_connection` at launch                             | A0·E "You're offline": Open phone settings, Try again                                               | [INV A0·E] |
| `no_connection` in the app                            | ES5 network banner (Offline, Back online); cached content stays                                     | [INV ES5]  |
| A message failed to send                              | ES6 "Not sent · tap to retry", Try again, Delete message, with the `send_failure_t` reason          | [INV ES6]  |
| `invalid_credentials`                                 | L1·E on the sign-in screen                                                                          | [INV L1·E] |
| `locked` on password sign-in                          | X1 "Let's pause for 15 minutes": Reset password, Back to the start                                  | [INV X1]   |
| OAuth outcome `not_linked`                            | S1·E "No account uses this login"                                                                   | [INV S1·E] |
| `provider_error`, `provider_token_invalid` at sign-up | A5·E (reasons: cancelled, no connection)                                                            | [INV A5·E] |
| `age_gate_blocked`                                    | C1·X "1minitman is for adults only"                                                                 | [INV C1·X] |
| `suspended`                                           | H6 (temporary or permanent), with appeal                                                            | [INV H6]   |
| `restricted`                                          | AS1 "Account under review"                                                                          | [INV AS1]  |
| `quota_exhausted` on specs                            | AS6 "That's all for today", with the Black Badge or Premium upsell                                  | [INV AS6]  |
| `entitlement`, other `quota_exhausted`                | Navigate to the `upsell` target (D15, B0)                                                           | [TR §8.1]  |
| `maintenance`, required update                        | OB1 (kinds Required, Recommended, Maintenance), driven by `GET /v1/config`                          | [INV OB1]  |
| `validation`                                          | Inline under the field (react-hook-form + the shared zod schemas [TR §5.1])                         | [TR §5.1]  |
| Anything else                                         | The list or screen error state with the message, the request id and Retry where the class allows it | [TR §5.3]  |

Every list has loading, empty, error and content states [TR §5.3]. Empty states (ES1–ES4) are not
errors and are never shown for a failed request.

## 7. Request ids and logging

1. Every response carries `X-Request-Id`; every problem document carries `request_id`; every log
   line of that request carries `request_id` [TR §14]. Clients may send their own id in
   `X-Request-Id` (8 to 64 characters of `A–Z a–z 0–9 _ -`); anything else is replaced.
2. The id travels on: into job payloads enqueued by the request, into `admin_audit_log.request_id`
   [ADM §1.3], and into vendor calls where the vendor accepts a correlation header.
3. Log one line per error at the API:

   | Status class                                | Level   | Fields                                                    |
   | ------------------------------------------- | ------- | --------------------------------------------------------- |
   | 4xx expected (validation, gating, 404, 429) | `info`  | `request_id`, `reason`, `status`, route template, surface |
   | 401 / 403 on admin routes, `token_reuse`    | `warn`  | the same, plus the admin or session id                    |
   | 5xx                                         | `error` | the same, plus error message and stack (server side only) |

4. Never logged: message bodies, passwords, codes, tokens, face data, card data; IPs are truncated
   in samples [TR §14]. The path is logged without the query string (already so in
   `requestContext`). `errors[].message` may be logged; the rejected **values** may not.
5. 5xx and unexpected codes go to Sentry with the request id as a tag [TR §14]. Error rates per
   route and status class feed `api_request_rollups` and the alerts in [TR §14].
6. Support flow: the person quotes the reference on the error state; staff search logs and Sentry
   by `request_id`.

## 8. Adding or changing a code

1. Check section 4. If an existing code has the same client behaviour, use it with a clearer
   `detail`. A new code is justified only when a client must behave differently or show different
   words.
2. Add the row to this document (code, status, when, retry class, client behaviour, module) in the
   same pull request as the route.
3. Add the code to the registry in `packages/contracts` (one `as const` object: code → status,
   title, retry class, extension members). `ProblemError` is constructed from a registry code, not
   from a free status and title (GAP-STD13-02).
4. Declare the error on the route definition, so it appears in the OpenAPI document and the
   generated client types [1MM-STD-06](1MM-STD-06-API-FIRST.md).
5. Add `error.<code>` to `packages/i18n` (`en`), and seed it for A25.
6. Add the client mapping only if the retry class or the screen is new.
7. Tests ([1MM-STD-01](1MM-STD-01-TESTING-STRATEGY.md)): one API test that provokes the code and
   asserts status, `reason`, `type`, `request_id` and the extension members; the registry tests
   below stay green.

Registry tests (written in `MOD-00-API-01`):

| Test                                                                                           | Fails when                                      |
| ---------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Codes are unique, match the pattern, and each has a status, title and retry class              | A duplicate or malformed code is added          |
| Every code has `error.<code>` in the `en` catalogue                                            | A message is missing                            |
| Every OpenAPI operation declares its error responses, each using `ProblemSchema`               | A route returns an undeclared error shape       |
| A sweep over every route with a bad token, bad body and unknown id returns only registry codes | A handler invents a code or leaks `about:blank` |
| The list of codes in this document equals the registry in code                                 | The document and the code drift                 |

Removing a code or changing its status is a breaking contract change: it follows the rules in
[1MM-STD-06](1MM-STD-06-API-FIRST.md) section 7.

## 9. Reconciliation of the slugs proposed in the module plans

The module plans in `docs/execution/` proposed slugs and statuses before this registry existed.
The canonical code replaces the proposal: the plans are aligned to this registry, and this table
is the mapping used to align them. Where a plan still shows a kebab-case slug or "400 validation",
the canonical code and status below apply.

| Plan                  | Proposed                                                                                                                                                                                                      | Canonical                                                                                                                                                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MOD-00                | reasons `entitlement`, `restricted`, `quota_exhausted`, `permission`, `rate_limited`, `validation`                                                                                                            | unchanged                                                                                                                                                                                                              |
| MOD-00                | 409 for the same idempotency key with a different body                                                                                                                                                        | 409 `idempotency_key_reused`                                                                                                                                                                                           |
| MOD-01                | 401 no session · 403 `permission` · 404 out of scope · 412 stale `If-Match` · 422 validation · 429                                                                                                            | `unauthenticated` · `permission` · `not_found` · `precondition_failed` · `validation` · `rate_limited`                                                                                                                 |
| MOD-01 (GAP-MOD01-11) | 403 `reauth_required`; 202 with `approval_id` and `expires_at`                                                                                                                                                | adopted as written (section 4.6)                                                                                                                                                                                       |
| MOD-02                | 400 _invalid-query_                                                                                                                                                                                           | 422 `validation`                                                                                                                                                                                                       |
| MOD-02                | 404 _unknown-catalogue_, 404 _unknown-locale_                                                                                                                                                                 | 404 `not_found`                                                                                                                                                                                                        |
| MOD-02                | 503 with `Retry-After`                                                                                                                                                                                        | 503 `maintenance`                                                                                                                                                                                                      |
| MOD-03                | 401 _invalid-credentials_, _provider-token-invalid_, _token-reuse_, _session-revoked_                                                                                                                         | `invalid_credentials`, `provider_token_invalid`, `token_reuse`, `session_expired`                                                                                                                                      |
| MOD-03                | 422 _email-invalid_, _email-disposable_, _password-too-short_, _password-breached_, _contact-details_, _reserved-name_                                                                                        | 422 `validation` with field codes `invalid_format`, `disposable_email`, `too_short`, `breached`, `contact_details`, `reserved`                                                                                         |
| MOD-03                | 422 _code-wrong_, _code-expired_                                                                                                                                                                              | 422 `code_wrong`; 410 `code_expired`                                                                                                                                                                                   |
| MOD-03                | 422 _channel-unavailable_, _phone-not-linked_, _version-not-current_                                                                                                                                          | same names in snake_case                                                                                                                                                                                               |
| MOD-03                | 423 _locked_ · 429 _rate-limited_ · 409 _cooldown_                                                                                                                                                            | `locked` · `rate_limited` · `cooldown`                                                                                                                                                                                 |
| MOD-03                | 403 _registration-closed_, _age-gate-blocked_, _integrity-failed_, _invite-required_, _market-waitlist_, _suspended_                                                                                          | same names in snake_case                                                                                                                                                                                               |
| MOD-03                | 409 _last-method_, _already-answered_, _onboarding-incomplete_                                                                                                                                                | same names in snake_case                                                                                                                                                                                               |
| MOD-03                | 502 _provider-error_                                                                                                                                                                                          | 502 `provider_error`                                                                                                                                                                                                   |
| MOD-04                | 400 validation, 400 type or size                                                                                                                                                                              | 422 `validation`; 415 `unsupported_media_type`; 413 `payload_too_large`                                                                                                                                                |
| MOD-04                | 403 `entitlement` (cap reached), 403 cap reached, 403 no biometric consent                                                                                                                                    | `entitlement` where a plan lifts the cap, else `cap_reached`; `consent_missing`                                                                                                                                        |
| MOD-04                | 409 slot taken, prompt already used, main photo rules, media not ready / still processing, object missing, held or reserved, claimed by another, cooldown, consent missing, already requested, CHECK violated | `slot_taken`, `prompt_already_used`, `main_photo_required`, `media_not_ready`, `upload_mismatch`, `nickname_unavailable`, `already_claimed`, `cooldown`, `consent_missing` (403), `already_requested`, `illegal_state` |
| MOD-04, 05, 06, 09    | 410 window passed / closed / expired                                                                                                                                                                          | `window_closed`, `expired`                                                                                                                                                                                             |
| MOD-05                | "step-up-required problem"; 409 illegal state change; 409 already appealed; 400 text length                                                                                                                   | `reauth_required`; `illegal_state`; `already_requested`; 422 `validation`                                                                                                                                              |
| MOD-06                | 403 re-auth needed, consent missing, account restricted                                                                                                                                                       | `reauth_required`, `consent_missing`, `restricted`                                                                                                                                                                     |
| MOD-06                | 402 no paid transaction · 409 payment missing                                                                                                                                                                 | 402 `payment_required` for both                                                                                                                                                                                        |
| MOD-06                | 409 steps missing, already submitted / completed, vendor result pending, number in use, no main photo, stale document version, nothing to withdraw, "Already claimed by"                                      | `badge_steps_incomplete`, `badge_already_submitted`, `vendor_result_pending`, `number_in_use`, `main_photo_required`, `version_not_current` (422), `illegal_state`, `already_claimed`                                  |
| MOD-06                | 422 wrong code, virtual or VoIP number · 423 locked · 429 send limit, no tries left · 502 vendor error · 404 feature disabled                                                                                 | `code_wrong`, `validation` + `voip_blocked` · `locked` · `rate_limited`, `locked` · `provider_error` · `feature_disabled`                                                                                              |
| MOD-07                | 403 `entitlement`, 403 `restricted`, 402 `quota_exhausted`                                                                                                                                                    | unchanged                                                                                                                                                                                                              |
| MOD-07                | 403 pair blocked · 404 blocked                                                                                                                                                                                | writes 403 `blocked`; reads 404 `not_found`                                                                                                                                                                            |
| MOD-07                | 409 nothing to undo / rewind, window passed · 422 self, note over 40 or contact details · 404 flag off                                                                                                        | `nothing_to_undo` · `validation` + `self`, `too_long`, `contact_details` · `feature_disabled`                                                                                                                          |
| MOD-08                | `reason` values of [TR §8.1] and `send_failure_t`                                                                                                                                                             | `safety_filter`, `conversation_limit`, `blocked`, `restricted`, `rate_limited`                                                                                                                                         |
| MOD-08                | 409 not pending, already decided, intro not ended, expired or decided, pending request or live thread exists, not live, already sent · 403 not the sender                                                     | `not_pending`, `already_decided`, `intro_not_ended`, `expired` (410), `conversation_exists`, `conversation_not_live`, `already_sent` · 404 `not_found`                                                                 |
| MOD-09                | 409 already appealed · 410 outside `appeals.window_days` · 422 self-report, unknown reason · 400 text over the limit                                                                                          | `already_requested` · `window_closed` · `validation` + `self`, `not_allowed`, `too_long`                                                                                                                               |
| MOD-10                | 402 declined · 409 already paid, live subscription exists, store-billed, trial already used, `offers_disabled`, not rendered · 403 not verified, restricted                                                   | `payment_declined` · `already_paid`, `subscription_exists`, `store_billed`, `trial_already_used`, `offers_disabled`, `not_rendered` · `verification_required`, `restricted`                                            |
| MOD-11                | 409 locked category or required channel · 409 `news` without `marketing` consent · 422 bad token                                                                                                              | `category_locked` · 403 `consent_missing` · `validation`                                                                                                                                                               |
| MOD-12                | 403 `entitlement`, `restricted`, `banned`, not owner, not a member, invite-only, admins-only                                                                                                                  | `entitlement`, `restricted`, `group_banned`, `group_role_required`                                                                                                                                                     |
| MOD-12                | 409 group full, group paused, already member, own limit reached, owner cannot leave / be removed, not pending, expired or answered · 412 stale                                                                | `group_full`, `group_paused`, `already_member`, `own_limit_reached`, `owner_cannot_leave`, `not_pending` · `precondition_failed`                                                                                       |
| MOD-14                | 409 closed, duplicate name / key, second vote, different member, workflow · 503 maintenance                                                                                                                   | `ticket_closed`, `duplicate`, `illegal_state` · `maintenance`                                                                                                                                                          |
| MOD-16                | 403 re-auth needed · 429 `rate_limited` · 409 already scheduled, nothing scheduled, once published                                                                                                            | `reauth_required` · `rate_limited` · `deletion_state`, `already_published`                                                                                                                                             |
| MOD-18                | 409 duplicate name, code, pseudonym, `task_no`, one session per participant                                                                                                                                   | `duplicate`                                                                                                                                                                                                            |
| MOD-11 (W36)          | _token_invalid_, _token_expired_ on newsletter confirm, preferences and unsubscribe [WEB §5.10]                                                                                                               | 404 `not_found`, 410 `expired`                                                                                                                                                                                         |
| MOD-13                | 403 not a participant · 403 not a group admin · 409 at the snooze limit, at the maximum of trusted contacts                                                                                                   | 404 `not_found` · 403 `group_role_required` · 403 `cap_reached`                                                                                                                                                        |
| MOD-13                | 409 open invite already exists, duplicate number, feedback already given · 409 expired · 409 cancelled, full, not open, already ended, already answered, already alerted, before the end                      | `duplicate` · 410 `expired` · `illegal_state`                                                                                                                                                                          |
| MOD-15                | 409 slug in use · 409 not allowed (workflow), block in use, approval pending, redirect chain or loop, city not live · 409 scan pending · 403 approver is the last editor · 410 withdrawn story                | `duplicate` · `illegal_state` · `media_not_ready` · `approval_self` · `expired`                                                                                                                                        |
| MOD-15                | [WEB §5.10] names _city_live_, _token_invalid_, _token_expired_, _job_closed_, _duplicate_recent_, _upload_not_clean_, _invalid\_\*_                                                                          | 409 `illegal_state`, 404 `not_found`, 410 `expired`, 410 `expired`, 409 `duplicate`, 409 `media_not_ready`, 422 `validation` (the table at the end of section 4.5)                                                     |
| MOD-17                | 401 · 403 · 409 not open, already removed · 409 live rule exists · 422                                                                                                                                        | `unauthenticated` · `permission` · `illegal_state` · `duplicate` · `validation`                                                                                                                                        |
| MOD-19                | builds no endpoint and names no code                                                                                                                                                                          | –                                                                                                                                                                                                                      |

Every one of the twenty module plans has a row above. A code a plan needs later is added by the
procedure in section 8.

## 10. Gaps raised

Dispositions are recorded in [1MM-LOG-03](../1MM-LOG-03-TECHNICAL-REFERENCE-EXTENSIONS.md)
(Technical Reference and schema), [1MM-LOG-02](../1MM-LOG-02-UI-UPDATES.md) (UI) and
[1MM-LOG-04](../1MM-LOG-04-OPEN-DECISIONS-AND-FOLLOW-UPS.md) (owner decisions and repository
follow-ups).

| Gap id       | Type | Where found                                                                          | What is missing or conflicting                                                                                                                                                                                                                                     | Proposed resolution                                                                                                                                                                                                                                                                        | Blocks                    |
| ------------ | ---- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------- |
| GAP-STD13-01 | TR   | [TR §8.1]                                                                            | [TR §8.1] gives the problem shape and three gating examples only. Statuses and machine reasons for every other condition (validation, idempotency, lockout, step-up, approval, webhooks, vendor failure, maintenance) are not in any source                        | Add to [TR §8.1]: "`reason` is the unique error code; the registry is 1MM-STD-13", the status table of section 2.2 and the extension members of section 2.1. This also closes MOD-01 GAP-MOD01-11                                                                                          | MOD-00-API-01             |
| GAP-STD13-02 | REPO | `packages/contracts/src/schemas/problem.ts`, `apps/api/src/platform/http/problem.ts` | `ProblemSchema` has no `errors`, `entitlement`, `upsell`, `permission`, `retry_after_seconds`, `until`, `tries_left`; `type` is always `about:blank`; `reason` is optional; `ProblemError` accepts any status and title; the 404 and 500 handlers send no `reason` | In `MOD-00-API-01`: add the registry object and the extension members to `packages/contracts`; make `reason` required; build `type` from it; make `ProblemError` take a registry code; give `notFoundHandler` `not_found` and the 500 path `internal`; add `code` to validation `errors[]` | MOD-00-API-01             |
| GAP-STD13-03 | REPO | `packages/i18n/src/locales/en.json`                                                  | The catalogue has 12 keys and no `error.*` keys; there is no test tying error codes to message keys                                                                                                                                                                | Add `error.<code>` and `error.field.<code>` keys for sections 4.1–4.3 in `MOD-00-API-01`; later codes arrive with their routes; add the enumeration test of section 8                                                                                                                      | First client error state  |
| GAP-STD13-04 | UI   | [TR §6.2]                                                                            | The billing web app has no defined loading, empty, error and offline states; the admin and website specs each define theirs                                                                                                                                        | Adopt [WEB §3.13] for the billing web app and record it in [TR §6.2]                                                                                                                                                                                                                       | MOD-10 web tasks          |
| GAP-STD13-05 | UI   | [INV ES6] against `send_failure_t` [SQL]                                             | Already raised as MOD-08 GAP-MOD08-10 (the board shows three of seven reasons). Listed here only because section 4.8 depends on it; no second entry is needed in the log                                                                                           | As GAP-MOD08-10                                                                                                                                                                                                                                                                            | MOD-08-MOB-04             |
| GAP-STD13-06 | TR   | [WEB §5.10]                                                                          | The website endpoint table lists its own error names (`wrong_code`, `too_soon`, `token_invalid`, `attachment_type`, …) that differ from the names used on the member surface for the same conditions                                                               | Replace them with the canonical codes in the table at the end of section 4.5 when [WEB §5.10] is next revised (its `/web/v1` prefix is already stale)                                                                                                                                      | MOD-15, MOD-14 form tasks |

## Change log

| Version | Date        | Change                                                                                                      |
| ------- | ----------- | ----------------------------------------------------------------------------------------------------------- |
| v1.0    | 24 Nov 2026 | First issue: problem document, retry classes, registry, client presentation, reconciliation of module slugs |
