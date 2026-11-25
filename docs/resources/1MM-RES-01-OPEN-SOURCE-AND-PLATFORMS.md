# 1MM-RES-01 · Open-source resources and platforms

|              |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Document** | 1MM-RES-01                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **Status**   | Approved baseline · v1.0 · 24 Nov 2026                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **Audience** | Engineers and coding agents                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **Owner**    | Engineering lead (code owners)                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **Sources**  | [TR §3], [TR §4.2], [TR §4.3], [TR §4.5], [TR §5.1], [TR §6.1], [TR §6.2], [TR §7.1], [TR §8.1], [TR §8.3], [TR §10.3], [TR §11], [TR §13], [TR §14], [TR §17.3], [TR §18], [OD-06], [OD-11], [OD-14], [OD-19], [OD-20], [OD-21], [OD-22], [ADM A01], [ADM A04], [ADM A25], [WEB §3], [SQL]; the repo's `package.json` files, `pnpm-workspace.yaml`, `.github/`; the twenty module plans in `docs/execution/`; each project's own licence file and vendor pages, read on 24 Nov 2026 (section 1.3) |
| **Related**  | [1MM-EXE-00](../execution/1MM-EXE-00-MASTER-PLAN.md), [1MM-STD-01](../standards/1MM-STD-01-TESTING-STRATEGY.md), [1MM-STD-08](../standards/1MM-STD-08-CONTRIBUTING.md), [1MM-STD-11](../standards/1MM-STD-11-SECURITY-AND-COMPLIANCE.md), [1MM-STD-12](../standards/1MM-STD-12-DATA-HANDLING.md), [1MM-STD-14](../standards/1MM-STD-14-CODING-CONVENTIONS.md), [1MM-ADR-0000](../adrs/1MM-ADR-0000-INDEX.md)                                                                                       |

**What this document is for and when to open it.** It lists the proven open-source libraries,
frameworks and hosted platforms that each module should use, so that nobody rebuilds what
already exists and nobody adds a heavy platform where the decided lean design is better. Open it
before you add a dependency, before you start a module (section 26 names what each module uses),
and when someone asks "why not use X?" (section 28 answers and says what would change the answer).

---

## 1. How to read this document

### 1.1 What stands and what is a recommendation

1. Owner decisions `[OD-nn]` and the Technical Reference decisions `[TR §18]` stand. Where this
   document repeats one, the row says **Decided** and cites it.
2. Everything else here is a **Recommendation** of the author. A recommendation never overrides a
   decision. Where a recommendation differs from a decided item, it is raised as a gap in
   section 30 and nothing changes until the owner answers.
3. The owner's example question was: "why not Keycloak for authentication, the social logins,
   operator, observability, and future high availability?" Section 2 answers it directly. The same
   question is asked of every capability area.

### 1.2 Verdicts

| Verdict                        | Meaning                                                                                      |
| ------------------------------ | -------------------------------------------------------------------------------------------- |
| **Decided**                    | Chosen by an owner decision or the Technical Reference. Use it.                              |
| **In place**                   | Already installed in the repo (checked in the `package.json` files on 24 Nov 2026).          |
| **Adopt now**                  | Recommendation: add it in the task named in section 27.                                      |
| **Adopt later (trigger: ...)** | Recommendation: do not add it yet. The trigger is the measurable event that reopens it.      |
| **Evaluate (spike)**           | Recommendation: a time-boxed test inside the named task decides. The spike result is logged. |
| **Do not adopt (why)**         | Recommendation: it costs more than it saves here. Section 28 says what would change that.    |

### 1.3 How facts were checked

| Mark             | Meaning                                                                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| (no mark)        | Licence read from the project's own licence file, and last commit date read from its public repository, on 24 Nov 2026.                           |
| (web)            | Taken from the vendor's or project's own page as returned by a web search on 24 Nov 2026. Re-check the page before relying on a limit or a price. |
| (secondary)      | Found only in third-party articles on 24 Nov 2026. Treat as a lead, not a fact.                                                                   |
| **not verified** | Could not be confirmed on 24 Nov 2026. The task that adopts the item must confirm it first.                                                       |

No version number is given for a package that is not already in the repo: versions are chosen at
install time under the supply-chain rules (section 29). Compatibility with Bun, Expo SDK 58 and
React Native 0.88 is **not verified** for any package that is not already installed, unless the
row says otherwise; the adopting task proves it with a test.

### 1.4 The constraints every candidate is judged against

| #   | Constraint                                                                                                                                                            | Source                                                                      |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| C1  | Free or pay-as-you-go tiers first; near-zero fixed cost. A self-hosted server needs its own always-on Railway service, which is a fixed monthly cost per environment. | [OD-06], [OD-11], [TR §4.3]                                                 |
| C2  | The API and the worker run on Bun. A library must run on Bun, or it is not usable there.                                                                              | [TR §3], repo                                                               |
| C3  | TypeScript everywhere; one contract in `packages/contracts`.                                                                                                          | [TR §8.1]                                                                   |
| C4  | PostgreSQL is the system of record. A second data store that holds member data needs its own erasure, export and retention handling.                                  | [TR §10], [TR §16]                                                          |
| C5  | Origin in the EU. Biometric and personal data do not flow to an extra processor without need.                                                                         | [OD-11], [TR §16.2]                                                         |
| C6  | A small team: every extra service is something to patch, monitor and restore.                                                                                         | Recommendation                                                              |
| C7  | The repo is public. A licence must allow our use; copyleft and source-available licences are flagged.                                                                 | [1MM-ADR-0039](../adrs/1MM-ADR-0039-PUBLIC-REPOSITORY-PRIVATE-SPEC-PACK.md) |
| C8  | Supply chain: one catalogue version per shared dependency, releases younger than three days are refused, no trust downgrade, build scripts only for listed packages.  | `pnpm-workspace.yaml`                                                       |
| C9  | Maintenance health: an active repository and a clean security record.                                                                                                 | [TR §13.4]                                                                  |

**Cost yardstick for "always-on".** Railway bills memory and CPU by use (web). A service that
holds memory all month is therefore a fixed monthly cost per environment, in proportion to the
memory it keeps loaded. The tables below compare options by that memory footprint; they give no
prices.

### 1.5 Licence flags used in the tables

| Flag                               | Why it matters here                                                                                                                                                                         |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MIT, ISC, BSD, Apache-2.0, MPL-2.0 | Permissive or file-level copyleft. No concern for a library we link or a tool we run.                                                                                                       |
| LGPL                               | Fine for a tool we run, or a library used unmodified.                                                                                                                                       |
| GPL                                | Fine for a separate program we run (a scanner, a search server). Do not copy its code into the repo.                                                                                        |
| **AGPL-3.0**                       | Network copyleft. Running an unmodified AGPL server or tool is allowed. Modifying one and offering it over a network obliges us to publish the changes. Never link AGPL code into `apps/*`. |
| **BUSL / FSL / MSCL**              | Source-available, not open source. Use is allowed with limits (usually "do not compete with the vendor"). Read the grant before adopting; expect licence changes.                           |
| **Open core**                      | A permissive core with enterprise directories under a commercial licence. Check that the feature you need is in the core.                                                                   |

---

## 2. Member identity and authentication

### 2.1 What is decided

| Item               | Decision                                                                                                                                           | Source              |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| Access token       | JWT signed with EdDSA, 15 minutes                                                                                                                  | [TR §8.1]           |
| Refresh token      | 30 days, rotating, stored as SHA-256 in `refresh_tokens`, one family per device, reuse revokes the family; deny list `sess:deny:{session}`         | [TR §8.1]           |
| Sign-in methods    | E-mail and password on every account; Google and Apple only when linked; phone sign-in only after Black Badge                                      | [TR §13.2]          |
| Passwords          | Argon2id; breached-password check by k-anonymity; members 8 characters, admins 12                                                                  | [TR §13.2], [OD-07] |
| Codes              | 6 digits, 10 minutes, hashed, with the lock rules of [TR §13.2]; sent by Termii, Twilio Verify fallback, WhatsApp second channel, e-mail by Resend | [TR §3], [TR §13.2] |
| Device trust       | Fingerprint, new-device codes, Play Integrity / App Attest, no CAPTCHAs                                                                            | [TR §13.2]          |
| Web app            | Same auth with an HttpOnly cookie session                                                                                                          | [TR §6.2]           |
| Row-level security | The API sets `app.user_id` per transaction                                                                                                         | [TR §8.1]           |
| Admin sign-in      | Password plus mandatory MFA (WebAuthn passkey or TOTP), cookie session, server-side permissions                                                    | [TR §7.1]           |

The schema already holds the identity tables for this design, and
[MOD-03](../execution/1MM-EXE-MOD-03-MEMBER-IDENTITY-AND-AUTH.md) and
[MOD-01](../execution/1MM-EXE-MOD-01-ADMIN-ACCESS-AND-GOVERNANCE.md) plan the work task by task.

### 2.2 Identity platforms compared

| Candidate          | Licence                                             | Last commit | What it would give                                             | What it costs here                                                                                                                                                                                        | Verdict               |
| ------------------ | --------------------------------------------------- | ----------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| Own implementation | ours                                                | n/a         | Exactly the rules of [TR §13.2] on the schema's own tables     | The work of MOD-03-API-01 to -09, built from the small libraries in 2.4                                                                                                                                   | **Decided** [TR §8.1] |
| Keycloak           | Apache-2.0                                          | 24 Nov 2026 | OIDC / SAML server, social login, admin UI, events, clustering | A JVM service: its own sizing guide puts base memory near 1.25 GB per pod (web), so it is a fixed memory cost per environment, plus CPU and its own database. Custom rules need Java extensions. See 2.3. | **Do not adopt**      |
| Ory Kratos + Hydra | Apache-2.0                                          | 29 Jul 2026 | Headless identity (Kratos) and OAuth2 server (Hydra)           | Two more always-on services and their own user store; flows are configured in its model, not ours                                                                                                         | **Do not adopt**      |
| SuperTokens (core) | Apache-2.0 outside `ee/` (**open core**)            | 6 Nov 2026  | Session and login recipes with a Node SDK                      | A Java core service plus its own tables; some features sit in `ee/`                                                                                                                                       | **Do not adopt**      |
| Authentik          | MIT outside `authentik/enterprise/` (**open core**) | 24 Nov 2026 | Identity provider aimed at staff single sign-on                | Server, worker and database; built for workforce apps, not a consumer app's native screens                                                                                                                | **Do not adopt**      |
| Zitadel            | **AGPL-3.0** (since its v3, 2025)                   | 24 Nov 2026 | Multi-tenant identity platform                                 | An always-on service; network copyleft if we ever modify it                                                                                                                                               | **Do not adopt**      |
| Logto              | MPL-2.0                                             | 24 Nov 2026 | OIDC identity for apps, TypeScript                             | An always-on service with its own user store and hosted sign-in experience                                                                                                                                | **Do not adopt**      |
| Better Auth        | MIT                                                 | 24 Nov 2026 | An in-process TypeScript auth framework with plugins           | It brings its own tables and session model, which conflict with schema v3.4 and the EdDSA plus refresh-family design. Its passkey plugin has had an access-control advisory (web); it is young.           | **Do not adopt**      |
| Lucia              | MIT                                                 | 8 Aug 2026  | Formerly a session library                                     | Reported as deprecated since March 2025 (secondary). Its lasting value is the written guidance on building sessions yourself.                                                                             | **Do not adopt**      |

### 2.3 The Keycloak question, answered point by point

| The owner's point        | Honest answer for this product                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication           | Keycloak is a sound server, but its natural shape is a browser redirect to its own login pages. The member app's sign-up, sign-in and recovery screens owned by MOD-03 are native screens (sign-up in 10 steps, code entry, new-device, recovery, linking) whose copy, limits and order are data managed by the admin. Driving those from Keycloak means either its discouraged direct-grant flow or rebuilding every screen against its APIs, with the rules of [TR §13.2] rewritten as Java extensions. |
| Social logins            | Only Google and Apple are in scope, and only when linked to an existing account [TR §13.2]. Each is one identity-token check against the provider's published keys, done with the `jose` library (2.4). A broker for two providers saves nothing.                                                                                                                                                                                                                                                         |
| Operator                 | The Keycloak Operator runs on Kubernetes. The origin is Railway, with no Kubernetes [OD-11]. The operator has nothing to run on until section 24's trigger is met.                                                                                                                                                                                                                                                                                                                                        |
| Observability            | Keycloak emits metrics and login events for itself. The product already has `admin_audit_log`, sign-in logs and alerts in the schema and [TR §14]; a second event stream would have to be joined to them.                                                                                                                                                                                                                                                                                                 |
| Future high availability | Keycloak clusters well, but high availability of sign-in here comes from the stateless API (two replicas) and the database [TR §4.3]. Adding Keycloak adds one more stateful thing to make highly available.                                                                                                                                                                                                                                                                                              |
| Data                     | A second user store means two places to erase, export and retain personal data [TR §16], and a sync between them.                                                                                                                                                                                                                                                                                                                                                                                         |

**Recommendation:** keep the decided own implementation. **What would change it** (any one):

1. The business needs to be an identity provider for other parties (third-party apps signing in
   "with 1minitman"), which needs a certified OAuth2 / OIDC server. Then evaluate Ory Hydra or
   Keycloak in front of the existing user tables.
2. Three or more first-party products must share one account.
3. Staff need single sign-on across many internal tools with SAML. Even then the first step is
   "sign in with the company's Google Workspace" by OIDC in the existing admin auth, not a platform.
4. The move to Kubernetes in section 24 has happened, so an operator-managed service is cheap to run.

Any of these is a platform-level choice and needs an ADR (section 29).

### 2.4 The small libraries that fit the decided design

| Need                                            | Candidate                                              | Licence | Last commit | Notes                                                                                                                                                                                                                            | Verdict                               |
| ----------------------------------------------- | ------------------------------------------------------ | ------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Sign and verify EdDSA JWTs; fetch provider keys | `jose`                                                 | MIT     | 18 Nov 2026 | Web Crypto based, no native code. Also verifies Google and Apple identity tokens against their key sets and signs the Apple client secret. Bun support: **not verified**; MOD-03-API-02 proves it with a test.                   | **Adopt now**                         |
| Argon2id password hashing                       | `Bun.password` (built into Bun)                        | n/a     | n/a         | Bun's own API; defaults to Argon2id and writes the PHC format (web), which matches the `$argon2id$` check the plans use. No package, no build script.                                                                            | **Adopt now**                         |
| Breached-password check                         | Have I Been Pwned range API                            | n/a     | n/a         | k-anonymity as [TR §13.2] requires: only the first five characters of a SHA-1 hash leave the server, so no personal data flows. Free use and terms: **not verified**. Called through a port with a timeout and a fail-open rule. | **Adopt now**                         |
| Google and Apple sign-in, server side           | `jose` (identity-token check)                          | MIT     | 18 Nov 2026 | **Recommendation:** use the identity-token flow on every client and verify on the server. No OAuth client library is needed for that.                                                                                            | **Adopt now**                         |
| Google and Apple sign-in, web redirect flow     | `arctic`                                               | MIT     | 10 Nov 2026 | Only needed if the web app must use the authorisation-code redirect.                                                                                                                                                             | **Evaluate (spike)** in MOD-03-API-06 |
| Apple sign-in on the phone                      | `expo-apple-authentication`                            | n/a     | n/a         | Expo module; SDK 58 compatibility **not verified**.                                                                                                                                                                              | **Evaluate (spike)** in MOD-03-MOB-04 |
| Google sign-in on the phone                     | Native Google sign-in module or `expo-auth-session`    | n/a     | n/a         | Licence, cost tier and SDK 58 compatibility of the native module: **not verified**.                                                                                                                                              | **Evaluate (spike)** in MOD-03-MOB-04 |
| TOTP for admins                                 | `otpauth`                                              | MIT     | 20 Nov 2026 | Small, no native code.                                                                                                                                                                                                           | **Adopt now**                         |
| WebAuthn passkeys for admins                    | `@simplewebauthn/server` and `@simplewebauthn/browser` | MIT     | 21 Nov 2026 | The widely used pair for registration and assertion. The passkey relying-party id depends on the host decision in GAP-MOD01-01.                                                                                                  | **Adopt now**                         |
| Device integrity verdicts                       | Play Integrity API and App Attest verification         | n/a     | n/a         | Decided as a control [TR §13.2]; no library is confirmed for either the client or the server check. **not verified**.                                                                                                            | **Evaluate (spike)** in MOD-03-API-01 |
| Refresh tokens on the phone                     | `expo-secure-store`                                    | n/a     | n/a         | **Decided** [TR §5.1].                                                                                                                                                                                                           | **Decided**                           |
| Cookies, CSRF origin checks                     | Hono's own cookie and security-header helpers          | MIT     | 23 Nov 2026 | Already in the dependency tree with `hono`.                                                                                                                                                                                      | **In place**                          |

---

## 3. Admin authorisation (RBAC)

**Decided** [TR §7.1], [TR §7.3]: permissions live in the schema, are resolved by
`v_admin_effective_permissions`, are checked server-side on every request, can be scoped (global,
country, city, queue), and some require re-authentication or a second admin's approval.
MOD-01-API-03 builds the `PermissionGuard`.

| Candidate              | Licence                              | Last commit | What it is                                        | Fit here                                                                                                                     | Verdict          |
| ---------------------- | ------------------------------------ | ----------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| Schema tables and view | ours                                 | n/a         | The decided model                                 | Roles, grants, scopes, approvals and audit are already designed together; the admin edits them as data                       | **Decided**      |
| CASL                   | MIT                                  | 24 Nov 2026 | In-process ability checks for JavaScript          | Could wrap the permission list the console gets from `GET /me`, but a ten-line `can(permission, scope)` helper does the same | **Do not adopt** |
| Casbin (Node)          | Apache-2.0                           | 21 Nov 2026 | Policy engine with its own model and policy store | A second policy language and store beside the schema's                                                                       | **Do not adopt** |
| OpenFGA                | Apache-2.0                           | 20 Nov 2026 | Relationship-based authorisation server           | An always-on service; built for per-object sharing graphs, which the console does not have                                   | **Do not adopt** |
| Cerbos                 | Apache-2.0                           | 23 Nov 2026 | Policy decision service, policies in files        | An always-on service; policies in files conflict with "a super admin can create custom roles" as data [TR §7.1]              | **Do not adopt** |
| Oso                    | Apache-2.0 (library deprecated, web) | 22 Oct 2026 | Policy library, now a hosted product              | The open-source library is deprecated by its own repository                                                                  | **Do not adopt** |

**What would change it:** per-object sharing between members or between tenants (for example
partner organisations each managing their own staff and venues). Then evaluate OpenFGA.

---

## 4. One-time codes and messaging

| Need                        | Decided choice                                       | Source              | Helper                                                                                                                                                             | Verdict                               |
| --------------------------- | ---------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------- |
| SMS and WhatsApp codes      | Termii, with Twilio Verify as fallback               | [TR §3], [TR §18.1] | A typed `fetch` adapter per vendor behind the `SmsSender` port, with a zod schema on every vendor answer. An official Termii SDK for TypeScript: **not verified**. | **Decided**; adapter is **Adopt now** |
| E-mail                      | Resend                                               | [TR §3], [OD-06]    | See section 20                                                                                                                                                     | **Decided**                           |
| Push                        | Expo Push (APNs / FCM)                               | [TR §3]             | `expo-server-sdk` (MIT, last commit 1 Nov 2026) for chunking and receipts. Bun support **not verified**.                                                           | **Adopt now**                         |
| Code generation and storage | Own: 6 digits, hashed, in `otp_challenges` and Redis | [TR §13.2]          | Web Crypto random values and a hash; no library                                                                                                                    | **Decided**                           |
| Code auto-fill              | iOS `one-time-code`; Android SMS Retriever           | [TR §5.1]           | A React Native module for SMS Retriever: **not verified** for SDK 58                                                                                               | **Evaluate (spike)** in MOD-03-MOB-03 |
| Notification platform       | Own outbox, templates and preferences in the schema  | [TR §4.2], [TR §11] | Hosted or self-hosted notification platforms duplicate `notifications`, `notification_templates` and the A25 / A26 admin pages                                     | **Do not adopt**                      |

**Recommendation:** prefer a thin `fetch` adapter over a vendor SDK on the server when the API is
a handful of REST calls. It keeps Bun compatibility certain, keeps the dependency count down and
lets [1MM-STD-16](../standards/1MM-STD-16-DEFENSIVE-PROGRAMMING.md) validate every response.

---

## 5. Payments helpers

**Decided** [OD-14], [TR §4.6], [TR §13.4]: App Store and Google Play through RevenueCat inside
the app; Flutterwave hosted checkout on the web only; no card data on our systems; every webhook
is signature-checked and re-fetched.

| Need                       | Candidate                                       | Licence | Last commit | Notes                                                                                                                                                   | Verdict                                       |
| -------------------------- | ----------------------------------------------- | ------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| In-app purchases           | `react-native-purchases` (RevenueCat SDK)       | MIT     | 23 Nov 2026 | **Decided** [TR §5.1]. Needs a development build. SDK 58 compatibility **not verified**.                                                                | **Decided**                                   |
| RevenueCat on the server   | REST API and webhooks through a `fetch` adapter | n/a     | n/a         | No server SDK is needed for `billing.sync` and the webhook handler                                                                                      | **Adopt now**                                 |
| Flutterwave on the server  | `fetch` adapter over the Flutterwave API        | n/a     | n/a         | The official Node SDK (`Flutterwave/Node-v3`, MIT) last changed on 17 Jun 2026; its Bun support is **not verified** and the plans need only a few calls | **Adopt now** (adapter); SDK **Do not adopt** |
| Flutterwave in the browser | Redirect to hosted checkout                     | n/a     | n/a         | Hosted checkout is the decision [TR §13.4]; no browser SDK is required                                                                                  | **Decided**                                   |
| Money arithmetic           | Integers in US cents                            | n/a     | n/a         | The contract primitive is money in US cents (MOD-00 section 4.4); no decimal library is needed                                                          | **Decided**                                   |
| Invoice rendering          | HTML rendered by the worker                     | n/a     | n/a         | A PDF library is needed only if invoices must be PDF files; the format is for MOD-10 to state                                                           | **Evaluate (spike)** in MOD-10-WRK-02         |

---

## 6. Realtime and chat

**Decided** [TR §4.2], [TR §8.3]: one WebSocket per signed-in device at `/v1/ws`; a message is
written to PostgreSQL first, then published on Redis, and every API instance relays it; polling
is the fallback. MOD-00-API-07 builds the gateway; MOD-08-API-10 the chat handlers.

| Candidate                                                      | Licence                    | Last commit | What it would give                                                                                                                  | Fit here                                                                                                                                                                                            | Verdict                         |
| -------------------------------------------------------------- | -------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| Own gateway on Bun's WebSocket server, with Hono's Bun adapter | Bun and Hono (MIT)         | n/a         | The decided model; the send pipeline (rate limits, entitlements, blocks, abuse rules) runs in our code before anything is published | Uses the Redis client built into Bun, which the API already uses. No new service.                                                                                                                   | **Decided**                     |
| Centrifugo                                                     | Apache-2.0                 | 23 Nov 2026 | A dedicated realtime server: presence, history, recovery, very large connection counts                                              | One more always-on service per environment. Useful only when connection handling itself becomes the bottleneck.                                                                                     | **Adopt later** (trigger below) |
| Socket.IO                                                      | MIT                        | 23 Nov 2026 | Rooms, acknowledgements, fallbacks                                                                                                  | Adds its own wire protocol on top of the event contract in [TR §8.3]; its Bun engine is recent (web)                                                                                                | **Do not adopt**                |
| Soketi                                                         | **AGPL-3.0**               | 25 Mar 2024 | Pusher-compatible server                                                                                                            | No commit for over two years; network copyleft                                                                                                                                                      | **Do not adopt**                |
| Matrix (Synapse)                                               | **AGPL-3.0** or commercial | 23 Nov 2026 | A federated chat system                                                                                                             | A second system of record for messages, federation the product does not want, and moderation rules (evidence snapshots, abuse rules, no staff access to bodies) that must stay in our send pipeline | **Do not adopt**                |
| PartyKit                                                       | ISC                        | 3 Aug 2026  | Realtime rooms on Cloudflare's edge                                                                                                 | Moves the message path off the EU origin and away from the PostgreSQL-first write                                                                                                                   | **Do not adopt**                |

**Trigger for Centrifugo (Recommendation):** any one of: (1) the two-instance relay tests pass
but production shows API replicas spending most of their CPU on socket fan-out; (2) reconnect
storms after a deploy breach the latency budget in [TR §15.1]; (3) concurrent sockets grow past
what two to four API replicas hold comfortably in the MOD-19 load test. Until then the gateway
must keep its publish and subscribe code behind one port so the transport can be replaced.

---

## 7. Calls

| Candidate | Licence    | Last commit | Notes                                                                                                                                                                                                  | Verdict                         |
| --------- | ---------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------- |
| daily.co  | hosted     | n/a         | **Decided** [OD-20], [TR §18.1 T12]: Gold calls after public launch, behind `calls.enabled`. MOD-08-API-11 ships only the contract stub. Free minutes and prices: **not verified**.                    | **Decided** (post-launch)       |
| LiveKit   | Apache-2.0 | 24 Nov 2026 | The open-source alternative: a media server with client SDKs. Self-hosting needs public UDP media ports and TURN, which is a different kind of hosting from Railway services; a hosted LiveKit exists. | **Adopt later** (trigger below) |

**Trigger (Recommendation):** reopen only after calls are live and one of these holds: the
monthly call bill exceeds the cost of running media servers; a market requires call media to stay
in a named region the vendor cannot offer; or call recording for safety evidence becomes a
requirement the vendor cannot meet. Changing vendor changes [OD-20], so it is an owner decision
with an ADR. Keep calls behind a `CallProvider` port from the first line.

---

## 8. Background jobs

| Candidate       | Licence | Last commit | Needs      | Notes                                                                                                                                                                          | Verdict                   |
| --------------- | ------- | ----------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------- |
| pg-boss         | MIT     | 23 Nov 2026 | PostgreSQL | **Decided** [TR §18.1 T5]. In `apps/worker` on its own role and schema. Jobs are enqueued in the same transaction as the change, which the outbox pattern relies on [TR §4.2]. | **Decided**, **In place** |
| Graphile Worker | MIT     | 5 Nov 2026  | PostgreSQL | Comparable design. No gain that justifies changing a decided, installed tool. Bun support **not verified**.                                                                    | **Do not adopt**          |
| BullMQ          | MIT     | 23 Nov 2026 | Redis      | Needs a Redis client library the repo does not use and constant Redis commands; Upstash bills by command [TR §4.3]. Jobs would no longer commit with the database change.      | **Do not adopt**          |

**What would change it:** job throughput that PostgreSQL cannot carry after tuning (measured in
the MOD-19 load test), at which point the first step is a dedicated queue database, not Redis.

---

## 9. Search

**What exists** [SQL]: `help_articles.search_tsv` and `groups.search_tsv` are generated
`tsvector` columns with GIN indexes. The only extensions the schema needs are PostGIS, citext and
pgcrypto [TR §4.3].

| Candidate                                 | Licence                                                              | Last commit | Notes                                                                                                                                                                                                 | Verdict                               |
| ----------------------------------------- | -------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| PostgreSQL full-text search               | PostgreSQL                                                           | n/a         | Already in the schema for help and groups. One store, one erasure path, row-level security still applies.                                                                                             | **Decided** by the schema             |
| PostgreSQL trigram search (`pg_trgm`)     | PostgreSQL                                                           | n/a         | Useful for "contains" and typo-tolerant lookups in the admin directory. It is an extension the Technical Reference does not list, so the module that needs it must raise a `TR` / `SCHEMA` gap first. | **Evaluate (spike)** in MOD-05-API-02 |
| Meilisearch                               | MIT community edition; enterprise parts **BUSL-1.1** (**open core**) | 23 Nov 2026 | Fast typo-tolerant search server. An always-on service with its own disk, and a copy of profile or group data outside PostgreSQL.                                                                     | **Adopt later** (trigger below)       |
| Typesense                                 | **GPL-3.0**                                                          | 23 Nov 2026 | Same role as Meilisearch. Running it as a separate server is allowed; do not embed its code.                                                                                                          | **Adopt later** (same trigger)        |
| Static site search (for example Pagefind) | n/a                                                                  | n/a         | The help search is planned in MOD-14 on `help_articles.search_tsv` [SQL]; a second index is not needed. **not verified** further.                                                                     | **Do not adopt**                      |

**Trigger (Recommendation):** a search endpoint misses its budget in [TR §15.1] after index
tuning, or the product asks for typo-tolerant, faceted search across more than one table. The
copy must then be covered by the erasure and export manifests (ruling R23) before it ships.

---

## 10. Media processing and storage

**Decided** [TR §4.3], [TR §11], [TR §13.1]: presigned uploads into the R2 quarantine bucket with
type and size limits; `media.process` re-encodes (stripping EXIF and GPS), writes AVIF and WebP
sizes, turns clips into 720p H.264 with HLS and voice into Opus, runs face match, image
moderation and the colour-filter check; `media.transcribe` transcribes voice for moderation.
Ruling R1: built once in MOD-04.

| Need                                             | Candidate                                                        | Licence                            | Last commit | Notes                                                                                                                                                                                                                                                                     | Verdict                               |
| ------------------------------------------------ | ---------------------------------------------------------------- | ---------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Image re-encode, resize, AVIF / WebP, EXIF strip | `sharp` (on libvips)                                             | Apache-2.0                         | 23 Nov 2026 | The standard choice. Its build script is already allowed in `onlyBuiltDependencies`. Running it under Bun in the worker: **not verified**; the first test of MOD-04-WRK-01 proves it. Fallback: run the image step with the Node binary that is already in the toolchain. | **Adopt now**                         |
| Video and audio transcode, HLS, Opus             | `ffmpeg` binary in the worker image                              | LGPL or GPL depending on the build | n/a         | Run as a separate program with fixed arguments, a timeout and resource limits; never pass user text into the command line. Licence of the chosen build and codec licensing: **not verified**, confirm when the image is built.                                            | **Adopt now**                         |
| libvips used directly                            | libvips                                                          | LGPL                               | n/a         | `sharp` already wraps it                                                                                                                                                                                                                                                  | **Do not adopt**                      |
| Storage client for R2                            | Bun's built-in S3 client, or the AWS S3 client                   | n/a                                | n/a         | MOD-00-API-06 needs presigned URLs that accept only the declared type and size. Whether Bun's built-in client can express both limits: **not verified**.                                                                                                                  | **Evaluate (spike)** in MOD-00-API-06 |
| Resumable uploads                                | tus (`tusd`) with Uppy                                           | MIT (both)                         | 23 Nov 2026 | Needs a tus server in front of storage. The files are small (photos, voice of 20 s or less, short clips) [TR §5.1].                                                                                                                                                       | **Do not adopt**                      |
| Large or flaky uploads                           | S3 multipart upload with presigned parts                         | n/a                                | n/a         | The R2-native answer if uploads grow                                                                                                                                                                                                                                      | **Adopt later** (trigger below)       |
| Face match of profile photos                     | Amazon Rekognition face comparison                               | hosted                             | n/a         | AWS is already the processor for liveness [OD-06], so no new processor receives biometric data. Pay per call. Region availability and price: **not verified**.                                                                                                            | **Recommendation** for GAP-MOD04-04   |
| Image moderation (nudity, violence, text)        | Amazon Rekognition moderation and text detection                 | hosted                             | n/a         | Same processor, pay per image; current price **not verified**. An open-source model run in the worker would avoid the call but needs accuracy testing on our own fixtures and more CPU.                                                                                   | **Recommendation** for GAP-MOD04-04   |
| QR code detection in images                      | A QR decoding library in the worker                              | n/a                                | n/a         | Library choice **not verified**                                                                                                                                                                                                                                           | **Evaluate (spike)** in MOD-04-WRK-01 |
| AI-generated image score                         | none proven                                                      | n/a                                | n/a         | No open-source detector is known to be reliable enough to act on. **Recommendation:** store no score at launch and route doubt to human review in A13.                                                                                                                    | **Do not adopt** now                  |
| Voice transcription                              | A Whisper-family model run by the worker, or a hosted speech API | n/a                                | n/a         | A local model keeps audio in our stack but costs CPU and memory; quality for Nigerian Pidgin is **not verified**. A hosted API adds a processor for voice.                                                                                                                | **Evaluate (spike)** in MOD-04-WRK-02 |
| Malware scan of website uploads                  | ClamAV                                                           | **GPL-2.0**                        | 22 Nov 2026 | Proposed in GAP-MOD14-15. Its own documentation recommends 3 GiB or more of memory for the daemon (web), which is a large fixed memory cost per environment if it stays loaded. See GAP-RES01-01.                                                                         | **Evaluate (spike)** in MOD-14-WRK-01 |

The provider choice for face match, moderation and transcription is an open owner decision
(GAP-MOD04-04 in [MOD-04](../execution/1MM-EXE-MOD-04-PROFILE-MEDIA-AND-PROMPTS.md)); the rows
marked "Recommendation for GAP-MOD04-04" are input to that decision, not the decision.

**Trigger for multipart uploads (Recommendation):** the upload failure rate on mobile networks,
measured from analytics, stays above the level MOD-19 sets, or a media kind larger than a single
reliable request is added.

---

## 11. Liveness

**Decided** [OD-06], [TR §18.1 T7], [TR §5.1]: AWS Rekognition Face Liveness, pay per check, with
the Amplify liveness component wrapped as an Expo native module behind an adapter.

| Item                 | Notes                                                                                                                                                                                                                                        | Verdict                  |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| Server calls         | The AWS SDK client for Rekognition, behind the `LivenessVendor` port of MOD-06-API-04. Bun support **not verified**.                                                                                                                         | **Adopt now**            |
| Envelope keys        | The AWS SDK client for KMS [TR §13.4]                                                                                                                                                                                                        | **Adopt now**            |
| Client component     | The Amplify liveness component for iOS and Android, wrapped as a local Expo module. Licence and SDK 58 / New Architecture compatibility **not verified**; MOD-06-MOB-03 starts with this proof.                                              | **Decided**; proof first |
| Region               | AWS lists Face Liveness in Europe (Ireland) among its regions (web); Frankfurt was not in the list returned. This bears on the residency statement already raised as GAP-STD12-07 in [1MM-STD-12](../standards/1MM-STD-12-DATA-HANDLING.md). | Input to GAP-STD12-07    |
| Open-source liveness | No open-source liveness check with independent presentation-attack testing is known to the author. **not verified**.                                                                                                                         | **Do not adopt**         |

---

## 12. Content management

**Decided** [OD-21]: the website CMS lives inside the admin console (A28 to A30), on the schema's
own tables, and is built in [MOD-15](../execution/1MM-EXE-MOD-15-CMS-AND-PUBLIC-WEBSITE.md).

Why not an existing CMS: Payload (MIT), Strapi (MIT outside its `ee/` directories, open core) and
Ghost (MIT) are healthy projects, Directus is now under the source-available Monospace
Sustainable Core License, and Sanity is a hosted product (licence and terms **not verified**).
Each would bring its own database tables or its own hosted store, its own users and roles, and
its own admin screens. The product needs the opposite: one staff identity with MFA, scoped
permissions, four-eyes approval on publishing, a hash-chained audit log [TR §7.1], legal
documents that are immutable once published [TR §6.1], story consents tied to members, and
content that reads live prices and markets from the same database. Bolting those onto a CMS is
more work than the block editor MOD-15 specifies, and it would leave two admin consoles and two
audit trails. **What would change it:** a marketing team of several full-time editors who need
workflows the admin console does not have (visual page building, editorial calendars), on content
that needs none of the controls above. That would be a change to [OD-21] and needs an ADR.

Small helpers that do fit inside the decided CMS:

| Need                             | Candidate                                                          | Notes                                                                                                                                  | Verdict                               |
| -------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Markdown to safe HTML            | A Markdown parser plus an HTML sanitiser                           | Help articles store `body_md` [SQL]. Library choice, licence and Bun support **not verified**. Output must pass the CSP of [TR §13.1]. | **Evaluate (spike)** in MOD-14-API-04 |
| Rich text editing in the console | A headless editor that writes Markdown or the block JSON of MOD-15 | Choice **not verified**; it must be keyboard-accessible [ADM A01]                                                                      | **Evaluate (spike)** in MOD-15-ADM-01 |
| Block schemas                    | zod in `packages/contracts`                                        | Already the contract tool                                                                                                              | **In place**                          |

---

## 13. Admin console building blocks

**Decided** [TR §7.1], [ADM A01]: Vite, React, TypeScript, shadcn/ui, TanStack Router, Query and
Table; forms with react-hook-form and zod schemas shared with the API.

| Need             | Candidate                                                       | Licence                           | Last commit | State in the repo                                                                                                                           | Verdict                               |
| ---------------- | --------------------------------------------------------------- | --------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Components       | shadcn/ui (copied into `packages/ui-web`)                       | MIT                               | 23 Nov 2026 | Pattern in place: Radix slot, `class-variance-authority`, `clsx`, `tailwind-merge`                                                          | **Decided**, **In place**             |
| Routing and data | TanStack Router and Query                                       | MIT                               | 24 Nov 2026 | Installed in `apps/admin`                                                                                                                   | **In place**                          |
| Tables           | TanStack Table                                                  | MIT                               | 24 Nov 2026 | Not installed                                                                                                                               | **Decided** [ADM A01]; **Adopt now**  |
| Forms            | react-hook-form with its zod resolver                           | MIT                               | 22 Nov 2026 | Not installed                                                                                                                               | **Decided** [ADM A01]; **Adopt now**  |
| Command palette  | `cmdk`                                                          | MIT                               | 29 Oct 2025 | Not installed. Quiet for a year but small and stable; the palette of [ADM A04] can also be built on the existing dialog and list components | **Evaluate (spike)** in MOD-00-ADM-02 |
| Charts           | Recharts                                                        | MIT                               | 24 Nov 2026 | Not installed. Charts must meet the colour and text-alternative rules of [ADM A01]                                                          | **Adopt now** (Recommendation)        |
| Dates            | The platform `Intl` API first; date-fns if arithmetic is needed | date-fns licence **not verified** | 23 Oct 2026 | Not installed. Console dates use one configured time zone (GAP-MOD00-05)                                                                    | **Evaluate (spike)** in MOD-00-ADM-01 |
| Icons            | `lucide-react`                                                  | n/a                               | n/a         | Installed in `apps/admin`                                                                                                                   | **In place**                          |
| Live updates     | Server-Sent Events through the browser's `EventSource`          | n/a                               | n/a         | The SSE hub is MOD-00-API-07                                                                                                                | **Decided** [ADM §1.6]                |
| Client state     | TanStack Query cache and URL state                              | n/a                               | n/a         | No global store is specified for the console                                                                                                | **Do not adopt** a store              |

---

## 14. Website (Astro)

**Decided** [TR §6.1], [TR §18.1 T3]: Astro, static, three locales, rendered from the CMS tables,
rebuilt on publish; budgets of [TR §6.1].

| Need                 | Candidate                                                          | State in the repo                             | Notes                                                                                                                                                                                              | Verdict                               |
| -------------------- | ------------------------------------------------------------------ | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Locale routing       | Astro's built-in i18n routing                                      | In use (`en`, `pcm`, `fr`)                    | No extra library                                                                                                                                                                                   | **In place**                          |
| Images               | Astro's built-in image handling (uses `sharp`)                     | `sharp` is allowed in `onlyBuiltDependencies` | CMS images come from R2 renditions (MOD-15-WRK-01); local brand assets go through the built-in pipeline                                                                                            | **Adopt now**                         |
| Sitemap              | The official Astro sitemap integration, or a small custom endpoint | Not installed                                 | [WEB §3] requires an index plus one sitemap per locale, `lastmod` from publish time and exclusions. Whether the integration covers all three, and its compatibility with Astro 7: **not verified** | **Evaluate (spike)** in MOD-15-WEB-02 |
| Structured data      | Hand-built JSON-LD objects, typed                                  | Not installed                                 | [WEB §3] requires validation in CI with a schema validator; validator choice **not verified**                                                                                                      | **Evaluate (spike)** in MOD-15-WEB-02 |
| Consent              | Own banner (W03) and consent receipts API                          | Not built                                     | The banner declines analytics by default and writes receipts to our API (MOD-16). A third-party consent platform would add a processor and a script the CSP must allow.                            | **Do not adopt** a consent platform   |
| Forms and bot checks | Own pipeline: origin check, token, honeypot, minimum time          | Not built                                     | Built once in MOD-14 (ruling R24). See section 18 for Turnstile.                                                                                                                                   | **Decided** [WEB §3]                  |
| Fonts                | Self-hosted Manrope                                                | Installed (`@fontsource-variable/manrope`)    |                                                                                                                                                                                                    | **In place**                          |
| Interactive islands  | Plain scripts or small framework-free components                   | No UI framework installed in `apps/site`      | Keeps the above-the-fold budget of [TR §6.1]                                                                                                                                                       | **Recommendation**                    |
| Offline page         | A hand-written service worker                                      | Not built                                     | MOD-00-WEB-01 needs only an offline page and static error pages; a service-worker library is more than that needs                                                                                  | **Do not adopt** a library            |

---

## 15. Mobile

**Decided** [TR §5.1]. The table lists every row of that stack with its state in
`apps/mobile/package.json`. Install Expo modules with the Expo CLI's version-matched install so
each module matches SDK 58; compatibility of a module not yet installed is **not verified**.
Licences shown as n/a (the Expo modules and the other rows without a licence) were not read:
**not verified**.

| Concern                   | Choice                                                         | Licence                       | State         | Lands in (first use)         | Verdict                              |
| ------------------------- | -------------------------------------------------------------- | ----------------------------- | ------------- | ---------------------------- | ------------------------------------ |
| Navigation and deep links | Expo Router, `expo-linking`                                    | n/a                           | Installed     | MOD-00-MOB-04, MOD-11-MOB-01 | **Decided**, **In place**            |
| Styling                   | NativeWind with the tokens preset                              | n/a                           | Installed     | MOD-00                       | **Decided**, **In place**            |
| Server state              | TanStack Query                                                 | MIT                           | Installed     | MOD-00-MOB-01                | **Decided**, **In place**            |
| Local state               | Zustand                                                        | MIT                           | Not installed | MOD-00-MOB-01                | **Decided**; **Adopt now**           |
| Offline outbox and cache  | `react-native-mmkv`                                            | MIT                           | Not installed | MOD-00-MOB-03                | **Decided**; **Adopt now**           |
| Lists                     | FlashList (`@shopify/flash-list`)                              | MIT                           | Not installed | MOD-07-MOB-01                | **Decided**; **Adopt now**           |
| Gestures and motion       | Gesture Handler, Reanimated                                    | n/a                           | Installed     | MOD-07-MOB-01                | **Decided**, **In place**            |
| Forms                     | react-hook-form with zod                                       | MIT                           | Not installed | MOD-03-MOB-03                | **Decided**; **Adopt now**           |
| Secure storage            | `expo-secure-store`                                            | n/a                           | Not installed | MOD-03-MOB-01                | **Decided**; **Adopt now**           |
| Images                    | `expo-image`                                                   | n/a                           | Not installed | MOD-04-MOB-01                | **Decided**; **Adopt now**           |
| Camera and picker         | `expo-camera`, `expo-image-picker`                             | n/a                           | Not installed | MOD-04-MOB-02                | **Decided**; **Adopt now**           |
| Video and audio           | `expo-video`, `expo-audio`                                     | n/a                           | Not installed | MOD-04-MOB-03, MOD-07-MOB-07 | **Decided**; **Adopt now**           |
| Haptics                   | `expo-haptics`                                                 | n/a                           | Installed     | MOD-00-MOB-04                | **Decided**, **In place**            |
| Notifications             | `expo-notifications`                                           | n/a                           | Not installed | MOD-11-MOB-01                | **Decided**; **Adopt now**           |
| Updates                   | `expo-updates` with EAS Update                                 | n/a                           | Not installed | MOD-00-MOB-01                | **Decided**; **Adopt now**           |
| Calendar                  | `expo-calendar`                                                | n/a                           | Not installed | MOD-13-MOB-03                | **Decided**; **Adopt now**           |
| Purchases                 | `react-native-purchases`                                       | MIT                           | Not installed | MOD-10-MOB-01                | **Decided**; **Adopt now**           |
| Crash and performance     | Sentry React Native SDK                                        | n/a                           | Not installed | MOD-00-MOB-01                | **Decided** [TR §14]; **Adopt now**  |
| Product analytics         | PostHog React Native SDK, only after consent                   | n/a                           | Not installed | MOD-18-MOB-01                | **Decided** [TR §14]; **Adopt now**  |
| End-to-end tests          | Maestro                                                        | Apache-2.0 (**not verified**) | Not installed | MOD-00-MOB-01                | **Decided** [TR §5.1]; **Adopt now** |
| Background uploads        | An Expo file-system upload task or a native upload module      | n/a                           | Not installed | MOD-04-MOB-02                | **Evaluate (spike)**                 |
| Screen-capture protection | A module that sets FLAG_SECURE on liveness and payment screens | n/a                           | Not installed | MOD-06-MOB-03                | **Evaluate (spike)**                 |
| Network state             | A network-information module for the ES5 banner                | n/a                           | Not installed | MOD-00-MOB-03                | **Evaluate (spike)**                 |
| Local biometric unlock    | `expo-local-authentication`                                    | n/a                           | Not installed | none                         | **Do not adopt** (below)             |

Notes:

1. Expo SDK 55 and later run only on the New Architecture (web), and current FlashList and
   Reanimated majors support only the New Architecture (web). That matches the decided stack; it
   means any older native module that lacks New Architecture support cannot be used.
2. **Recommendation** (from [1MM-STD-12](../standards/1MM-STD-12-DATA-HANDLING.md)): the MMKV
   instance is encrypted with a key held in secure storage, and nothing sensitive goes into MMKV.
3. `expo-local-authentication`: no screen in the inventory and no rule in the Technical Reference
   asks for an in-app biometric lock. Adding one would be a new product behaviour and needs a
   `UI` and `TR` gap from the module that wants it, not a library choice.
4. Every native module beyond Expo's own set must be proven in a development build on both
   platforms, phone and tablet, before the task that uses it starts
   ([1MM-STD-03](../standards/1MM-STD-03-MOBILE-BUILD-STRATEGY.md)).

---

## 16. Internationalisation

**Decided** [TR §4.5], [TR §5.1]: ICU catalogues for `en`, `pcm` and `fr`, held in `i18n_strings`
and exported to `packages/i18n`; strings are edited and published in the admin (MOD-02-API-08).
Delivery to running clients is open in GAP-MOD00-03.

| Candidate                                     | Licence                                                        | Last commit | Notes                                                                                                                                                                                                                             | Verdict                               |
| --------------------------------------------- | -------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| FormatJS `intl-messageformat` and its parser  | **not verified** (licence file not found at the expected path) | 24 Nov 2026 | Formats ICU messages at run time, which is needed because published strings arrive from the API. Its parser can validate messages in MOD-02-API-08. Relies on the platform `Intl` plural rules; Hermes coverage **not verified**. | **Evaluate (spike)** in MOD-02-API-08 |
| `@messageformat/core`                         | MIT                                                            | 9 Nov 2026  | Compiles ICU messages to functions; carries its own plural rules, so it does not depend on the device's `Intl` data.                                                                                                              | **Evaluate (spike)** in MOD-02-API-08 |
| i18next                                       | MIT                                                            | 23 Nov 2026 | A full framework with its own message format; ICU needs a plug-in. More than `packages/i18n` needs.                                                                                                                               | **Do not adopt**                      |
| The existing `translate()` in `packages/i18n` | ours                                                           | n/a         | Stays as the single entry point; the chosen library sits behind it                                                                                                                                                                | **In place**                          |

**Recommendation:** one ICU library for all six apps, chosen by one spike that runs the same
plural and select fixtures (including `pcm`) on Bun, in a browser and on Hermes on both phone
platforms. Pick the one that passes everywhere with the smaller client bundle.

---

## 17. Feature flags and remote configuration

**Decided** [SQL], [TR §3]: `feature_flags`, flag overrides and `remote_config` are schema tables,
served by `GET /v1/config` and edited in A31 with audit and approvals
([MOD-02](../execution/1MM-EXE-MOD-02-PLATFORM-CONFIG-AND-CATALOGUES.md)).

| Candidate     | Licence                                                | Last commit | Notes                                                                                                                                                                                        | Verdict                         |
| ------------- | ------------------------------------------------------ | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| Schema tables | ours                                                   | n/a         | Flags and limits change through the same approval and audit path as every other admin write, and are tested as data                                                                          | **Decided**                     |
| Unleash       | **AGPL-3.0** (its licence file today)                  | 23 Nov 2026 | An always-on service and a second place where a rule can change without our audit log                                                                                                        | **Do not adopt**                |
| GrowthBook    | MIT outside its enterprise directories (**open core**) | 24 Nov 2026 | Flags plus experiments; an always-on service and its own data store                                                                                                                          | **Adopt later** (trigger below) |
| Flagsmith     | BSD-3-Clause                                           | 23 Nov 2026 | Same role as Unleash                                                                                                                                                                         | **Do not adopt**                |
| PostHog flags | hosted                                                 | n/a         | PostHog's free tier lists one million flag requests a month (web). Flags there would bypass admin approvals, and a flag check would depend on a vendor the member may not have consented to. | **Do not adopt**                |

**Trigger (Recommendation):** the product starts running controlled experiments that need
statistical analysis (assignment, exposure logging, significance). Then evaluate GrowthBook or
PostHog experiments for the analysis only, with assignment still recorded in our tables.

---

## 18. Analytics, observability and security tooling

### 18.1 Product analytics

**Decided** [OD-06], [TR §14]: PostHog Cloud with EU hosting, only after consent, plus our own
`analytics_events` copy. The free tier lists one million events a month (web).

| Item                   | Notes                                                                                                                                                 | Verdict          |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| PostHog client SDKs    | Web and React Native SDKs, loaded only after consent (MOD-18-WEB-01, MOD-18-MOB-01). Licences **not verified**.                                       | **Adopt now**    |
| PostHog session replay | Screens show profiles, chats and verification steps. **Recommendation:** keep replay off; turning it on would need a privacy review under [TR §16.2]. | **Do not adopt** |
| Self-hosted PostHog    | MIT outside `ee/` (open core). Needs several always-on services.                                                                                      | **Do not adopt** |
| Attribution vendor     | **Decided** [OD-06]: none; `/get` counts go to `web_redirects_daily`                                                                                  | **Decided**      |

### 18.2 Observability

**Decided** [TR §14]: OpenTelemetry tracing with a request id on every response and log line;
Sentry for app, web, admin, API and worker; structured JSON logs; one-minute request rollups in
`api_request_rollups`; Railway, Neon, Upstash and Cloudflare dashboards for infrastructure; a
hosted status page [OD-22]. The trace backend and the alert channel are open in GAP-MOD00-12.

| Signal                 | Candidate                                                     | Licence                                                                 | Notes                                                                                                                                                                                                                                         | Verdict                               |
| ---------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Traces                 | OpenTelemetry API and SDK for JavaScript                      | **not verified** today                                                  | **Decided** as the standard. Automatic instrumentation under Bun is **not verified**; plan for manual spans around the HTTP handler, the database client, Redis and vendor calls.                                                             | **Decided**; **Adopt now**            |
| Errors                 | Sentry (hosted)                                               | Server is **FSL-1.1** (source-available); SDK licences **not verified** | **Decided**. The free Developer plan is one user with about 5,000 errors a month (web, secondary for the number); EU data storage is available on every plan and cannot be changed after the organisation is created (web). See GAP-RES01-02. | **Decided**; **Adopt now**            |
| Errors                 | GlitchTip (self-hosted, speaks the Sentry protocol)           | MIT (secondary)                                                         | The exit path from Sentry: the same SDKs point at it. Needs an always-on web service, a worker and a database.                                                                                                                                | **Adopt later** (trigger below)       |
| Logs                   | Railway logs now; an OpenTelemetry-compatible log store later | n/a                                                                     | [TR §14] wants 30 days hot and one year archived. Railway's log retention: **not verified**. **Recommendation:** archive by shipping JSON logs to the R2 `backups` or a dedicated bucket from the worker.                                     | **Evaluate (spike)** in MOD-00-OPS-06 |
| Logs and traces        | Grafana Loki and Tempo (self-hosted)                          | **AGPL-3.0** (both)                                                     | Always-on services with object storage. Running them unmodified is allowed.                                                                                                                                                                   | **Do not adopt**                      |
| All signals            | Grafana Cloud free tier                                       | hosted                                                                  | Limits **not verified**. An extra processor for logs, which must then be proven free of personal data.                                                                                                                                        | **Evaluate (spike)** in MOD-00-OPS-06 |
| All signals            | SigNoz (self-hosted)                                          | MIT outside `ee/` (**open core**)                                       | Needs a column-store database and several services                                                                                                                                                                                            | **Do not adopt**                      |
| Metrics                | `api_request_rollups` and the A32 dashboard                   | ours                                                                    | **Decided** [TR §14]; no metrics server is needed for the product's own view                                                                                                                                                                  | **Decided**                           |
| Uptime and status page | Better Stack free plan                                        | hosted                                                                  | Lists ten monitors and one status page on a custom sub-domain (secondary). Hosted apart from our stack, as [OD-22] requires.                                                                                                                  | **Adopt now** (Recommendation)        |
| Status page            | Instatus free plan                                            | hosted                                                                  | Named in [TR §4.3] as the alternative; its free plan is reported not to allow a custom domain (secondary), which `status.1minitman.com` needs                                                                                                 | **Do not adopt** unless re-checked    |
| Uptime                 | Uptime Kuma (self-hosted)                                     | MIT                                                                     | A monitor hosted on our own platform goes down with it, which defeats [OD-22]                                                                                                                                                                 | **Do not adopt**                      |

**Recommendation for GAP-MOD00-12:** send traces to Sentry (already a decided vendor, one fewer
processor) with a low sample rate, and keep the option to export OpenTelemetry data elsewhere by
configuration. **Trigger for GlitchTip:** Sentry cost at the launch volume exceeds the cost of
its three services, or a regulator or customer requires error data to stay on our own
infrastructure.

### 18.3 Security tooling

| Need                      | Candidate                                                    | Licence                                   | State                                                                     | Notes                                                                                                                                                                                                                                                                                                     | Verdict                               |
| ------------------------- | ------------------------------------------------------------ | ----------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Secret scanning           | gitleaks                                                     | MIT                                       | In CI and the pre-commit hook                                             |                                                                                                                                                                                                                                                                                                           | **In place**                          |
| Static analysis           | CodeQL                                                       | GitHub service                            | GitHub default set-up (no workflow file); required by the branch rulesets | Cost for a public repository: **not verified**                                                                                                                                                                                                                                                            | **In place**                          |
| Static analysis (second)  | Semgrep engine                                               | LGPL-2.1 (rule licences **not verified**) | Not installed                                                             | Overlaps CodeQL. Worth it only for custom rules, for example "no string-built SQL" [TR §13.1], which an ESLint rule can also enforce                                                                                                                                                                      | **Do not adopt** now                  |
| Dependency audit          | `pnpm audit:deps`                                            | n/a                                       | In CI                                                                     |                                                                                                                                                                                                                                                                                                           | **In place**                          |
| Dependency audit (second) | OSV-Scanner                                                  | Apache-2.0                                | Not installed                                                             | Reads the lockfile against the OSV database; a cheap second opinion                                                                                                                                                                                                                                       | **Evaluate (spike)** in MOD-00-OPS-05 |
| Container image scanning  | Trivy                                                        | Apache-2.0                                | Not installed                                                             | Image scanning is required by [TR §13.4] and planned in MOD-00-OPS-05; the tool is not named there. Trivy's GitHub Action and a release were compromised in March 2026 (web, the maintainer's own advisory). Use it only as a binary pinned by checksum, the way CI pins gitleaks, never by a moving tag. | **Adopt now**, pinned                 |
| Dynamic scan              | ZAP baseline scan                                            | Apache-2.0                                | Not installed                                                             | Run against staging before the penetration test; never against production                                                                                                                                                                                                                                 | **Adopt now**                         |
| Rate limiting             | Own Redis sliding window and `rate_limit_policies`           | ours                                      | Limiter in place                                                          | **Decided** [TR §13.3]                                                                                                                                                                                                                                                                                    | **Decided**, **In place**             |
| Edge protection           | Cloudflare free plan WAF and rate rules                      | hosted                                    | To be provisioned in MOD-00-OPS-01                                        | **Decided** [OD-06]                                                                                                                                                                                                                                                                                       | **Decided**                           |
| Bot protection on forms   | Honeypot, minimum time, origin check, per-form token         | ours                                      | Planned in MOD-14-API-05                                                  | **Decided**: no CAPTCHA puzzles [TR §13.2], [WEB §3]                                                                                                                                                                                                                                                      | **Decided**                           |
| Bot protection (stronger) | Cloudflare Turnstile                                         | hosted                                    | Not used                                                                  | Free plan lists up to 20 widgets with unlimited challenges, including non-interactive modes (web). It is not a puzzle in those modes, but it is a third-party script and a change to the decided approach.                                                                                                | **Adopt later** (trigger below)       |
| Security headers          | Hono's secure-headers helper; `_headers` on Cloudflare Pages | MIT                                       | Hono installed                                                            |                                                                                                                                                                                                                                                                                                           | **Adopt now**                         |

**Trigger for Turnstile (Recommendation):** form spam that passes the decided checks at a rate
that burdens the support or safety queues, measured over two weeks. It must run in a
non-interactive mode, keep the safety form usable when the script fails to load, and be recorded
as an owner decision because [WEB §3] excludes CAPTCHAs.

---

## 19. Testing

The strategy and the per-app pyramids are in
[1MM-STD-01](../standards/1MM-STD-01-TESTING-STRATEGY.md). [TR §17.3] decides Playwright, Maestro,
axe, bundle budgets and EXPLAIN checks.

| Layer                                         | Candidate                                        | Licence                                              | Last commit      | State         | Verdict                                                                                                                                |
| --------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------- | ---------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| API, worker, packages                         | `bun test`                                       | Bun                                                  | n/a              | In use        | **In place**                                                                                                                           |
| Admin, web app, `ui-web` units and components | Vitest with Testing Library                      | Vitest and Testing Library licences **not verified** | n/a              | Not installed | **Adopt now** (Recommendation in 1MM-STD-01)                                                                                           |
| Browser end to end                            | Playwright                                       | **not verified** today                               | n/a              | Not installed | **Decided** [TR §17.3]; **Adopt now**                                                                                                  |
| Accessibility                                 | axe-core through its Playwright binding          | MPL-2.0                                              | 23 Nov 2026      | Not installed | **Decided** [TR §17.3]; **Adopt now**                                                                                                  |
| Mobile end to end                             | Maestro                                          | Apache-2.0 (**not verified**)                        | **not verified** | Not installed | **Decided** [TR §5.1]; **Adopt now**                                                                                                   |
| Performance budgets                           | Lighthouse CI                                    | Apache-2.0                                           | 17 Nov 2026      | Not installed | **Adopt now** (MOD-00-OPS-05)                                                                                                          |
| Load                                          | k6                                               | **AGPL-3.0**                                         | 23 Nov 2026      | Not installed | **Adopt now** as a tool we run, unmodified (MOD-19-QA-03)                                                                              |
| Database in tests                             | The CI PostgreSQL service and `pnpm services:up` | n/a                                                  | n/a              | In use        | **In place**                                                                                                                           |
| Database in tests                             | Testcontainers                                   | MIT                                                  | 19 Nov 2026      | Not installed | **Do not adopt**: the existing services already give a real PostgreSQL 16 with PostGIS, and Bun support is only partly confirmed (web) |
| Network fakes in client tests                 | Contract-typed fixtures at the client boundary   | n/a                                                  | n/a              | Planned       | **Decided** in 1MM-STD-01; a mocking library is optional                                                                               |
| Vendor fakes on the server                    | A local fake HTTP server in `bun test`           | n/a                                                  | n/a              | Planned       | **Decided** in 1MM-STD-01                                                                                                              |

---

## 20. E-mail

**Decided** [TR §3], [OD-06]: Resend. Templates are rows in `notification_templates`; the
`email_template` column names an MJML layout and the console previews rendered MJML [ADM A25];
wording comes from `i18n_strings`.

| Candidate                    | Licence | Last commit | Notes                                                                                                                                                                                                                           | Verdict                              |
| ---------------------------- | ------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| MJML                         | MIT     | 23 Oct 2026 | Named by the schema and the admin spec. Layouts are files or rows that the worker fills with translated strings, so copy stays data. Running the MJML compiler under Bun: **not verified**; MOD-11-WRK-01 proves it first.      | **Decided** [ADM A25]; **Adopt now** |
| React Email                  | MIT     | 17 Nov 2026 | Templates as React components. Good ergonomics, but it moves layout and often copy into code, against rule 3 of `AGENTS.md` (everything is admin-managed), and it is not what [ADM A25] previews.                               | **Do not adopt**                     |
| Resend API                   | hosted  | n/a         | Send through a `fetch` adapter behind `EmailSender` with an idempotency key; verify webhook signatures in the intake. The free plan allows 100 e-mails a day and 3,000 a month, counting received mail (web). See GAP-RES01-03. | **Decided**; adapter **Adopt now**   |
| Local preview and test inbox | n/a     | n/a         | The `local` environment uses a console sink [TR §4.4]; A25 has its own preview and test send                                                                                                                                    | **Decided**                          |

---

## 21. Documentation and API docs

| Need                      | Candidate                                                  | Licence | Last commit | State                                            | Verdict                                                                                        |
| ------------------------- | ---------------------------------------------------------- | ------- | ----------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| API reference             | Scalar (`@scalar/hono-api-reference`)                      | MIT     | 24 Nov 2026 | Installed; `/docs` outside production            | **In place**                                                                                   |
| OpenAPI and typed clients | `@hono/zod-openapi`, `openapi-typescript`, `openapi-fetch` | n/a     | n/a         | Installed in `apps/api` and `packages/contracts` | **In place**                                                                                   |
| Breaking-change check     | `scripts/check-contract-breaking.mjs`                      | ours    | n/a         | In CI                                            | **In place**                                                                                   |
| Project documents         | Markdown in `docs/`, formatted by Prettier                 | n/a     | n/a         | In use                                           | **In place**                                                                                   |
| Documentation website     | A static docs generator                                    | n/a     | n/a         | Not used                                         | **Do not adopt**: the documents are read in the repository; a site is one more thing to deploy |
| Diagrams                  | Text diagrams in Markdown                                  | n/a     | n/a         | In use in the Technical Reference                | **Recommendation**                                                                             |

---

## 22. Infrastructure as code

**Decided** [TR §4.3]: `infra/` holds a `railway.json` per service and Terraform for Cloudflare,
Neon, Upstash and the small AWS footprint. MOD-00-OPS-01 builds it.

| Candidate | Licence                                               | Last commit | Notes                                                                                                                                                                                | Verdict                                              |
| --------- | ----------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| Terraform | **BUSL-1.1**                                          | 23 Nov 2026 | The decided configuration language and provider ecosystem. The licence limits offering it as a competing service, which does not apply to using it on our own infrastructure.        | **Decided** (the configuration)                      |
| OpenTofu  | MPL-2.0                                               | 23 Nov 2026 | The open-source fork that runs the same configuration and providers. **Recommendation:** use OpenTofu as the command-line tool so the toolchain stays open source. See GAP-RES01-04. | **Adopt now** (Recommendation, pending GAP-RES01-04) |
| Pulumi    | Apache-2.0                                            | 23 Nov 2026 | Infrastructure in TypeScript. Attractive for a TypeScript team, but it changes a decided choice for no saving at this size, and state needs a backend of its own.                    | **Do not adopt**                                     |
| SST       | MIT                                                   | 10 Nov 2026 | Built around AWS and Cloudflare application patterns; the origin is Railway                                                                                                          | **Do not adopt**                                     |
| Providers | Cloudflare, AWS, Neon, Upstash                        | n/a         | Which Neon and Upstash providers are official and current: **not verified**. Pin provider versions and commit the lock file.                                                         | **Evaluate (spike)** in MOD-00-OPS-01                |
| State     | A private R2 bucket through the S3-compatible backend | n/a         | MOD-00-OPS-01 requires state outside the repo. State holds secrets: the bucket is private and never the public repo. State locking on R2: **not verified**.                          | **Evaluate (spike)** in MOD-00-OPS-01                |

---

## 23. Developer experience

| Need                    | Candidate                         | Licence        | Last commit | State                                           | Notes                                                                                                                                    | Verdict                               |
| ----------------------- | --------------------------------- | -------------- | ----------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Dependency updates      | Dependabot                        | GitHub service | n/a         | Configured: weekly, grouped, five-day cool-down | Already matches the supply-chain rules. [TR §13.4] says Renovate; the difference is recorded as GAP-MOD00-13.                            | **In place**; keep (Recommendation)   |
| Dependency updates      | Renovate                          | **AGPL-3.0**   | 24 Nov 2026 | Not used                                        | More configurable. Terms of the hosted app: **not verified**. No gain that justifies a second tool.                                      | **Do not adopt**                      |
| Versioning packages     | changesets                        | MIT            | 23 Nov 2026 | Not used                                        | For publishing packages with changelogs. Every workspace package here is private and deployed from the commit.                           | **Do not adopt**                      |
| Commit message lint     | commitlint                        | MIT            | 23 Nov 2026 | Not used                                        | [1MM-STD-10](../standards/1MM-STD-10-COMMITS-AND-LOCAL-CI.md) uses no Conventional Commits prefix, so there is nothing for it to enforce | **Do not adopt**                      |
| Hooks                   | husky, lint-staged                | n/a            | n/a         | Installed                                       |                                                                                                                                          | **In place**                          |
| Task running            | Turborepo                         | n/a            | n/a         | Installed                                       |                                                                                                                                          | **In place**                          |
| Lint and format         | ESLint, Prettier                  | n/a            | n/a         | Installed                                       |                                                                                                                                          | **In place**                          |
| Mobile dependency check | Expo's own dependency check in CI | n/a            | n/a         | Not used                                        | Catches a module that does not match SDK 58. Exact command and behaviour with pnpm: **not verified**.                                    | **Evaluate (spike)** in MOD-00-MOB-01 |

---

## 24. The high-availability path

**Decided** [TR §10.3], [TR §4.3], [TR §18.1 T1, T4]: grow in four steps (indexes and tuning; a
bigger instance plus a read replica for discovery and analytics; partition retention and
archiving; Citus when writes exceed one primary). The growth path for hosting is AWS af-south-1
only if a market requires local hosting or load outgrows the managed tiers. The code stays on
standard PostgreSQL, the S3 API and the Redis protocol so the move stays possible.

| Step or option                       | What it is                                                                    | Licence      | Notes                                                                                                                                                    | Verdict                     |
| ------------------------------------ | ----------------------------------------------------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| Two API replicas, one worker         | Railway replicas                                                              | hosted       | **Decided** [TR §4.3]                                                                                                                                    | **Decided**                 |
| Paid Neon with point-in-time restore | Managed PostgreSQL                                                            | hosted       | **Decided** before public launch [TR §4.3]; MOD-19-OPS-04                                                                                                | **Decided**                 |
| Read replica                         | A Neon read replica for discovery and analytics reads                         | hosted       | Step 2 of [TR §10.3]. Price and replica lag: **not verified**. The code needs a read-only connection that never serves read-your-own-write paths.        | **Adopt later** (trigger 1) |
| Citus                                | Distributed PostgreSQL                                                        | **AGPL-3.0** | Step 4 of [TR §10.3]. Running it unmodified is allowed. Which managed services offer it in the target region: **not verified**; if none, it is self-run. | **Adopt later** (trigger 2) |
| CloudNativePG                        | A Kubernetes operator that runs PostgreSQL clusters with failover and backups | Apache-2.0   | Last commit 24 Nov 2026. The way to self-run PostgreSQL (and Citus-style topologies) well, but it needs a Kubernetes cluster and someone on call for it. | **Adopt later** (trigger 3) |
| Kubernetes and operators generally   | Operators for PostgreSQL, Redis, identity and so on                           | various      | This is where an operator-managed service such as Keycloak becomes cheap to run (section 2.3)                                                            | **Adopt later** (trigger 3) |

**Triggers (Recommendation).** Each is a measurement, reviewed after every load test and each
quarter's restore drill:

1. **Read replica:** discovery or analytics reads push the primary past its latency budget in
   [TR §15.1] after the indexing work of [1MM-DB-04](../database/1MM-DB-04-INDEXING.md).
2. **Citus:** write load exceeds what the largest single primary available can carry
   [TR §10.3].
3. **Leaving Railway and Neon for Kubernetes** (any one): a market's law requires hosting in a
   region these providers do not offer [TR §4.3]; the restore drill cannot meet the targets of
   one hour and five minutes [TR §10.3] on the managed plan; the combined managed bill is
   consistently higher than a three-node cluster plus the on-call time to run it; or the product
   needs a PostgreSQL extension or network control the managed service does not allow.

Leaving the decided hosting changes [OD-11] and needs an owner decision and an ADR.

---

## 25. Smaller cross-cutting helpers

| Need                     | Candidate                                 | State         | Notes                                                                                                                                                                    | Verdict                               |
| ------------------------ | ----------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------- |
| Validation and contracts | zod, `@hono/zod-openapi`                  | Installed     | **Decided** [TR §8.1]                                                                                                                                                    | **In place**                          |
| Database access          | Drizzle with the `postgres` driver        | Installed     | **Decided** [OD-19]                                                                                                                                                      | **In place**                          |
| Redis                    | The Redis client built into Bun           | In use        | No Redis library is needed. Its behaviour for long-lived subscriptions against Upstash is proven by the two-instance relay test of MOD-00-API-07.                        | **In place**                          |
| UUID v7                  | Database default, or a small generator    | n/a           | [TR §18.1 T15] decides uuid v7 keys; where ids are minted is a database design matter ([1MM-DB-01](../database/1MM-DB-01-SCHEMAS.md))                                    | **Decided**                           |
| Phone number parsing     | A phone-number library for E.164 checks   | Not installed | Needed by sign-up, Black Badge and the waitlist. Library, size and licence **not verified**; client bundle size matters.                                                 | **Evaluate (spike)** in MOD-03-API-01 |
| Geography                | PostGIS                                   | In the schema | **Decided** [TR §4.3]. Distance and nearby queries run in SQL; no geo library is needed in the API.                                                                      | **Decided**                           |
| Places search            | Google Places through a `fetch` adapter   | Not built     | Named in [TR §4.1]; used by MOD-13-API-10. Pay per call; cost **not verified**.                                                                                          | **Decided**; adapter **Adopt now**    |
| Cron expressions         | pg-boss schedules from `worker_jobs.cron` | In place      | A separate cron parser is needed only for the "cron strings parse" test                                                                                                  | **In place**                          |
| CSV export               | A streaming writer written in the worker  | Not built     | **Recommendation:** exports escape cells that start with a formula character, so a spreadsheet does not run member-supplied text; a small own writer makes that explicit | **Recommendation**                    |
| Archives for data export | A zip writer in the worker                | Not built     | Needed by `export.build` (MOD-16-WRK-01). Library and Bun support **not verified**.                                                                                      | **Evaluate (spike)** in MOD-16-WRK-01 |

---

## 26. Module by module: the resources each should use

Decided and in-place items are listed so an engineer starting a module sees the whole set.
"Own" means the decided in-house design; do not replace it.

| Module | Resources it should use                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MOD-00 | Hono helpers (secure headers, body limit, cookies), Bun's WebSocket server and Redis client, pg-boss, Drizzle, zod, Scalar, OpenTelemetry, Sentry in five apps, OpenTofu with the Terraform configuration, Better Stack status page, Trivy (pinned), Lighthouse CI, Playwright, axe, Vitest and Testing Library, Maestro, TanStack Table, react-hook-form, Recharts, Zustand, MMKV, `expo-updates`, the ICU library chosen in section 16 |
| MOD-01 | `Bun.password`, `otpauth`, `@simplewebauthn/server` and `@simplewebauthn/browser`, own permission tables and `PermissionGuard`, own audit chain; Hono cookies                                                                                                                                                                                                                                                                            |
| MOD-02 | Own `feature_flags` and `remote_config`; the ICU library and its parser for validation; Redis pub/sub for reload                                                                                                                                                                                                                                                                                                                         |
| MOD-03 | `jose`, `Bun.password`, the breached-password range API, own OTP service, Termii and Twilio `fetch` adapters, `expo-secure-store`, react-hook-form, Apple and Google sign-in modules (after their spikes), integrity checks (after the spike)                                                                                                                                                                                            |
| MOD-04 | `sharp`, `ffmpeg`, the storage client from MOD-00, Rekognition for face match and moderation if GAP-MOD04-04 resolves that way, `expo-image`, `expo-camera`, `expo-image-picker`, `expo-audio`, `expo-video`                                                                                                                                                                                                                             |
| MOD-05 | Own masking library; PostgreSQL indexes for the directory; TanStack Table; trigram search only after its spike and gap                                                                                                                                                                                                                                                                                                                   |
| MOD-06 | AWS SDK clients for Rekognition and KMS behind `LivenessVendor`; the Amplify liveness component as a local Expo module; the OTP service from MOD-03; a screen-capture protection module                                                                                                                                                                                                                                                  |
| MOD-07 | PostGIS and `record_reaction()` in SQL, Redis for the deck cache and quotas, FlashList, Gesture Handler, Reanimated, `expo-haptics`, `expo-audio`                                                                                                                                                                                                                                                                                        |
| MOD-08 | Own WebSocket gateway and send pipeline, Redis pub/sub, PostgreSQL for search, MMKV outbox rules; a `CallProvider` port with no vendor code until calls ship                                                                                                                                                                                                                                                                             |
| MOD-09 | Own abuse-rule evaluator and case tables; SSE for queues; no external moderation platform                                                                                                                                                                                                                                                                                                                                                |
| MOD-10 | `react-native-purchases`, RevenueCat and Flutterwave `fetch` adapters, own entitlement resolver in `packages/entitlements`, integer cents                                                                                                                                                                                                                                                                                                |
| MOD-11 | Resend `fetch` adapter, MJML, `expo-server-sdk`, `expo-notifications`, own outbox and templates, the ICU library                                                                                                                                                                                                                                                                                                                         |
| MOD-12 | PostgreSQL full-text search on `groups.search_tsv`, the gateway from MOD-00, FlashList                                                                                                                                                                                                                                                                                                                                                   |
| MOD-13 | PostGIS, Google Places `fetch` adapter, the SMS adapters, `expo-calendar`; the static `/s/<token>` page with no analytics script                                                                                                                                                                                                                                                                                                         |
| MOD-14 | PostgreSQL full-text search on `help_articles.search_tsv`, the public form pipeline (own), a Markdown parser and sanitiser (after the spike), the upload scan decided through GAP-RES01-01                                                                                                                                                                                                                                               |
| MOD-15 | Own CMS tables and block schemas in zod, Astro's built-in images and i18n, the sitemap and structured-data helpers (after their spikes), `sharp` for renditions                                                                                                                                                                                                                                                                          |
| MOD-16 | Own consent banner and receipts, pg-boss jobs for export and erasure, a zip writer (after the spike), R2 lifecycle rules                                                                                                                                                                                                                                                                                                                 |
| MOD-17 | Cloudflare API through a `fetch` adapter, own `api_request_rollups`, Recharts, SSE                                                                                                                                                                                                                                                                                                                                                       |
| MOD-18 | PostHog web and React Native SDKs behind consent, own `analytics_events`, materialised views, Recharts, own CSV writer                                                                                                                                                                                                                                                                                                                   |
| MOD-19 | k6, ZAP baseline, Playwright, Maestro, axe, Lighthouse CI, the restore drill on Neon and R2                                                                                                                                                                                                                                                                                                                                              |

---

## 27. Adopt-now shortlist and where each lands

All rows are **Recommendations** unless the verdict column in the earlier section says Decided.
Each lands in the first task that needs it; later modules reuse it.

| #   | Resource                                                        | Lands in                                    | Used again by                               |
| --- | --------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------- |
| 1   | OpenTofu running the Terraform configuration                    | MOD-00-OPS-01                               | MOD-19-OPS-01                               |
| 2   | Hono secure headers, body limit                                 | MOD-00-API-05                               | every surface                               |
| 3   | OpenTelemetry spans and Sentry in the API                       | MOD-00-API-09                               | every module                                |
| 4   | Sentry in the worker                                            | MOD-00-WRK-01                               | every job                                   |
| 5   | TanStack Table, react-hook-form, Recharts in `packages/ui-web`  | MOD-00-ADM-01                               | every admin module                          |
| 6   | Playwright, axe and Vitest with Testing Library for the console | MOD-00-ADM-02                               | MOD-00-WEB-01, MOD-00-WEB-03, all web tasks |
| 7   | Zustand, `expo-updates`, Sentry React Native, Maestro           | MOD-00-MOB-01                               | every mobile task                           |
| 8   | `react-native-mmkv`                                             | MOD-00-MOB-03                               | MOD-07, MOD-08, MOD-18                      |
| 9   | Lighthouse CI, Trivy as a checksum-pinned binary                | MOD-00-OPS-05                               | MOD-19                                      |
| 10  | Better Stack status page and uptime checks                      | MOD-00-OPS-06                               | MOD-19-OPS-02                               |
| 11  | `Bun.password`, `otpauth`, `@simplewebauthn/server`             | MOD-01-API-04                               | MOD-03-API-01 (`Bun.password`)              |
| 12  | `@simplewebauthn/browser`                                       | MOD-01-ADM-01                               | MOD-01-ADM-02                               |
| 13  | Breached-password range API adapter, Termii and Twilio adapters | MOD-03-API-01                               | MOD-06-API-03, MOD-13-API-05                |
| 14  | `jose`                                                          | MOD-03-API-02                               | MOD-03-API-06, MOD-03-API-09                |
| 15  | `expo-secure-store`                                             | MOD-03-MOB-01                               | MOD-00 storage rules                        |
| 16  | react-hook-form on mobile                                       | MOD-03-MOB-03                               | every mobile form                           |
| 17  | Resend adapter, `EmailSender`, `SmsSender`                      | MOD-11-API-01 (slice A, in MOD-00's window) | every module that enqueues                  |
| 18  | MJML renderer                                                   | MOD-11-WRK-01 (slice B, in MOD-03's window) | MOD-11-API-04 preview                       |
| 19  | `expo-server-sdk`                                               | MOD-11-API-02                               | MOD-11-WRK-02                               |
| 20  | `expo-notifications`                                            | MOD-11-MOB-01                               | MOD-03-MOB-05 (C7 primer)                   |
| 21  | `sharp`, `ffmpeg`                                               | MOD-04-WRK-01                               | MOD-15-WRK-01, MOD-14-WRK-01                |
| 22  | `expo-image`                                                    | MOD-04-MOB-01                               | MOD-07, MOD-08, MOD-12                      |
| 23  | `expo-camera`, `expo-image-picker`                              | MOD-04-MOB-02                               | MOD-09-MOB-02                               |
| 24  | `expo-audio`, `expo-video`                                      | MOD-04-MOB-03                               | MOD-07-MOB-07, MOD-08-MOB-02                |
| 25  | AWS SDK clients for Rekognition and KMS                         | MOD-06-API-04                               | MOD-04-WRK-01 if GAP-MOD04-04 agrees        |
| 26  | FlashList                                                       | MOD-07-MOB-01                               | MOD-08, MOD-12, MOD-11-MOB-02               |
| 27  | RevenueCat adapter                                              | MOD-10-API-03                               | MOD-10-WRK-02                               |
| 28  | Flutterwave adapter                                             | MOD-10-API-04                               | MOD-10-API-08                               |
| 29  | `react-native-purchases`                                        | MOD-10-MOB-01                               | MOD-06-MOB-05                               |
| 30  | `expo-calendar`, Google Places adapter                          | MOD-13-MOB-03, MOD-13-API-10                | none                                        |
| 31  | Astro built-in image handling                                   | MOD-15-WEB-01                               | MOD-15-WEB-02 to -05                        |
| 32  | PostHog SDKs behind consent                                     | MOD-18-WEB-01, MOD-18-MOB-01                | every screen's events                       |
| 33  | k6                                                              | MOD-19-QA-03                                | MOD-19-OPS-04                               |
| 34  | ZAP baseline scan                                               | MOD-19-QA-05                                | each release candidate                      |

Spikes named in sections 2 to 25 run at the start of the task they name, are time-boxed to one
working day (**Recommendation**), and record their result in
[the progress log](../1MM-LOG-01-PROGRESS.md).

---

## 28. Not now, and what would change our mind

| Not adopted                                                        | Why not now                                                                                                                         | What would change it                                                                                                                                    |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Keycloak, Ory, SuperTokens, Authentik, Zitadel, Logto, Better Auth | The decided auth is specific to the product and already modelled in the schema; each platform adds a service or a second user store | Becoming an identity provider for others; three or more products sharing accounts; staff SAML single sign-on; Kubernetes already in place (section 2.3) |
| CASL, Casbin, OpenFGA, Cerbos, Oso                                 | Permissions are data in the schema with scopes, approvals and audit                                                                 | Per-object sharing graphs or tenant-managed staff (section 3)                                                                                           |
| Centrifugo                                                         | The decided gateway is enough at launch size                                                                                        | Fan-out CPU, reconnect storms or socket counts in the load test (section 6)                                                                             |
| Socket.IO, Soketi, Matrix, PartyKit                                | Extra protocol, stale project, second system of record, or off-origin message path                                                  | No trigger foreseen; a new requirement would need an ADR                                                                                                |
| LiveKit                                                            | Calls are post-launch on daily.co [OD-20]                                                                                           | Call bill, regional media rule or recording need (section 7)                                                                                            |
| Graphile Worker, BullMQ                                            | pg-boss is decided and installed; Redis queues break the same-transaction outbox                                                    | PostgreSQL cannot carry job throughput after tuning (section 8)                                                                                         |
| Meilisearch, Typesense                                             | PostgreSQL full-text search is in the schema; a copy of member data needs erasure handling                                          | A search budget missed after tuning; typo-tolerant faceted search as a product need (section 9)                                                         |
| tus, Uppy                                                          | Files are small; presigned uploads are decided                                                                                      | Upload failure rate or larger media; then S3 multipart first (section 10)                                                                               |
| Payload, Strapi, Directus, Ghost, Sanity                           | [OD-21]; they duplicate identity, permissions, approvals and audit                                                                  | A dedicated editorial team on content that needs none of those controls (section 12)                                                                    |
| Unleash, Flagsmith, GrowthBook, PostHog flags                      | Flags are schema tables with approvals and audit                                                                                    | Controlled experiments needing statistics (section 17)                                                                                                  |
| Self-hosted GlitchTip, Loki, Tempo, SigNoz, Uptime Kuma            | Each is an always-on service; a self-hosted monitor fails with our stack                                                            | Sentry cost at volume, or a rule that error data stays on our infrastructure (section 18.2)                                                             |
| Cloudflare Turnstile                                               | No CAPTCHAs is decided; the form pipeline has four checks                                                                           | Measured spam getting through (section 18.3)                                                                                                            |
| Semgrep                                                            | Overlaps CodeQL                                                                                                                     | A class of bug that needs custom rules ESLint cannot express                                                                                            |
| Testcontainers                                                     | Real PostgreSQL is already available in CI and locally                                                                              | Tests that need many isolated database versions at once                                                                                                 |
| React Email                                                        | Templates are data; MJML is named by the schema and the admin spec                                                                  | A decision to move e-mail layout out of the admin (a change to [ADM A25])                                                                               |
| Pulumi, SST                                                        | Terraform configuration is decided                                                                                                  | A move to a platform where SST or Pulumi is the native tool                                                                                             |
| Renovate, changesets, commitlint                                   | Dependabot is configured; packages are private; commits have no prefix convention                                                   | Publishing packages to a registry; adopting Conventional Commits in 1MM-STD-10                                                                          |
| Kubernetes, CloudNativePG, Citus                                   | Managed Railway and Neon meet the launch need at near-zero fixed cost                                                               | The triggers in section 24                                                                                                                              |
| Session replay                                                     | Screens carry personal and sensitive data                                                                                           | A privacy review that defines masked, consented replay for named screens only                                                                           |

---

## 29. The rule for introducing a new dependency

No package, binary, action or hosted service is added without this check. It applies to
engineers and coding agents alike and extends
[1MM-STD-08](../standards/1MM-STD-08-CONTRIBUTING.md) and
[1MM-STD-11](../standards/1MM-STD-11-SECURITY-AND-COMPLIANCE.md). All of it is a
**Recommendation** until those standards adopt it.

### 29.1 Before you add anything

1. Look in this document. If the item has a verdict, follow it. If the verdict is "Do not adopt"
   or "Adopt later", you need the trigger to be met and recorded, not a new argument.
2. Look in the platform: Bun (`Bun.password`, the Redis client, the WebSocket server, `fetch`,
   Web Crypto), Hono's helpers, PostgreSQL features, and the browser's `Intl` often already do it.
3. If it is under about fifty lines to write and test, write it.

### 29.2 Evaluation checklist (answer in the pull request)

| #   | Check             | What to record                                                                                                                                 | Refuse when                                                                                                                |
| --- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| 1   | Licence           | The licence from the project's own licence file, and those of its runtime dependencies                                                         | AGPL or GPL code would be linked into an app; a source-available licence whose grant we do not clearly meet                |
| 2   | Maintenance       | Last commit, last release, open security issues, number of maintainers                                                                         | No commit in twelve months without a stated "finished" status; a single unresponsive maintainer for security-critical code |
| 3   | Size              | Install size, number of transitive dependencies, and for client code the effect on `pnpm check:client-bundles` and the budgets of [TR §15.1]   | It breaks a budget; it pulls a second copy of a catalogue dependency                                                       |
| 4   | Security record   | Published advisories and how they were handled; whether releases carry provenance; whether it runs an install script                           | It needs an install script and is not justified for `onlyBuiltDependencies`; a history of unpatched advisories             |
| 5   | Runtime fit       | A passing test on the runtime that will run it: Bun for `apps/api` and `apps/worker`; a development build on iOS and Android for `apps/mobile` | It needs Node-only native bindings in the API or worker; it lacks New Architecture support                                 |
| 6   | Data flows        | What data leaves our stack, to whom, in which region; whether that party is already a processor in [TR §16]                                    | Personal or biometric data would reach a new processor without a recorded need and the DPO's agreement                     |
| 7   | Cost at ten times | The cost today and at ten times today's volume, including an always-on service's monthly cost per environment                                  | A fixed cost with no usage behind it; a free tier that the launch volume exceeds with no budget line                       |
| 8   | Exit path         | How we would remove or replace it: the port it sits behind, and where its data would go                                                        | It cannot sit behind a port and would hold the only copy of any data                                                       |

### 29.3 How it is added

1. Shared dependencies are declared once in the `catalog:` block of `pnpm-workspace.yaml` and
   referenced as `catalog:` in each workspace.
2. `minimumReleaseAge` (three days) and `trustPolicy: no-downgrade` are never bypassed. If an
   urgent security fix is younger than three days, a code owner approves the exception in the
   pull request and it is noted in the progress log.
3. A package that needs a build script is added to `onlyBuiltDependencies` only by a code owner,
   in the same pull request, with the reason.
4. GitHub Actions and downloaded binaries are pinned by commit or checksum, as CI already does.
5. A vendor is called through a port in `domain/` with its adapter in `infrastructure/`, has a
   zod schema on every response, a timeout, and a row in `vendor_settings` where the schema
   expects one.
6. The pull request description carries the eight answers. Dependency changes are reviewed by a
   code owner (the lockfile and workspace file are code-owned).

### 29.4 When an ADR is required

A platform-level choice needs an architecture decision record in `docs/adrs/`, written from
[the ADR template](../adrs/1MM-ADR-0000-TEMPLATE.md) and listed in
[the ADR index](../adrs/1MM-ADR-0000-INDEX.md), **before** the code. Platform-level means any of:

- a new always-on service or a new data store;
- a new hosted vendor, or a new processor of personal data;
- replacing anything marked Decided in this document or in [TR §18];
- a new language, runtime, framework or infrastructure tool;
- anything under an AGPL, GPL or source-available licence;
- meeting a trigger from section 28.

If the choice changes an owner decision, the ADR records the owner's approval; without it the
choice does not proceed. A library that passes the checklist and sits behind an existing port
needs no ADR.

---

## 30. Gaps raised

Dispositions are recorded in [1MM-LOG-03](../1MM-LOG-03-TECHNICAL-REFERENCE-EXTENSIONS.md) (Technical Reference and schema), [1MM-LOG-02](../1MM-LOG-02-UI-UPDATES.md) (UI) and [1MM-LOG-04](../1MM-LOG-04-OPEN-DECISIONS-AND-FOLLOW-UPS.md) (owner decisions and repository follow-ups).

| Gap id       | Type     | Where found                                                  | What is missing or conflicting                                                                                                                                                                                                                                                                                                                                              | Proposed resolution                                                                                                                                                                                                                                                                                                                                                                                                | Blocks                                      |
| ------------ | -------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------- |
| GAP-RES01-01 | DECISION | [TR §6.1], [WEB §3]; GAP-MOD14-15; [OD-06], [OD-11]          | Website uploads must be virus-scanned, and GAP-MOD14-15 recommends ClamAV run by the worker. ClamAV's own documentation recommends 3 GiB or more of memory for its daemon (read on 24 Nov 2026), which is a fixed memory cost per environment if kept loaded. The lean-hosting decisions did not allow for it.                                                              | Owner to choose: (1) accept the cost and run ClamAV as its own Railway service; (2) **Recommendation:** re-encode every image with `sharp` (which already removes embedded payloads [TR §13.1]) and scan only document uploads (CVs) with ClamAV started on demand by the scan job, after a one-day spike in MOD-14-WRK-01 measures time and memory; (3) a hosted scanning API, which adds a processor             | MOD-14-WRK-01, MOD-15-API-09                |
| GAP-RES01-02 | DECISION | [TR §14], [OD-06], [OD-11]                                   | Sentry is decided for five apps, on free or pay-as-you-go tiers. Sentry's free Developer plan is for one user (vendor page, 24 Nov 2026) with about 5,000 errors a month (third-party figure), while more than one engineer needs access. The paid-tier list in [TR §4.3] names Railway, Neon and Upstash but not Sentry.                                                   | Owner to choose: (1) **Recommendation:** start on the Developer plan with alerts routed to the shared channel of GAP-MOD00-12, and add the team plan to the paid tiers of MOD-19-OPS-04 before the private beta; (2) self-host GlitchTip (MIT) as an always-on service; add the chosen line to [TR §4.3]. Create the Sentry organisation in the EU region from the start, since the region cannot be changed later | MOD-00-API-09, MOD-00-OPS-06, MOD-19-OPS-04 |
| GAP-RES01-03 | TR       | [TR §3], [TR §4.3], [OD-06]; Resend's documented limits      | Resend's free plan allows 100 e-mails a day and 3,000 a month, counting received mail (vendor documentation, 24 Nov 2026). Every sign-up sends at least one code by e-mail [TR §13.2], so the daily cap is reached at about 100 sign-ups or sign-ins needing a code in a day. [TR §4.3] lists the tiers that must be paid before public launch and does not include Resend. | Add Resend to the "paid before public launch" list in [TR §4.3] and to MOD-19-OPS-04; add an alert on the daily send count reaching a set share of the plan's cap to MOD-11's alerts (**Recommendation:** 70%)                                                                                                                                                                                                     | MOD-19-OPS-04, MOD-11-OPS-01                |
| GAP-RES01-04 | TR       | [TR §4.3], [TR §4.5] "Terraform"; the Terraform licence file | The Technical Reference names Terraform. Terraform is under the Business Source License 1.1 (its licence file, 24 Nov 2026), which is source-available, not open source. Our use is permitted, but the document does not say which command-line tool runs the configuration.                                                                                                | State in [TR §4.3] that the configuration is Terraform-compatible and is run with OpenTofu (MPL-2.0). **Recommendation:** OpenTofu; if the owner prefers HashiCorp Terraform, record that instead. No change to the configuration files either way                                                                                                                                                                 | MOD-00-OPS-01 (tool choice only)            |

Gaps raised elsewhere that this document gives input to, without raising them again:
GAP-MOD00-12 (trace backend and alert channel, section 18.2), GAP-MOD00-13 (Dependabot recorded
as the tool, section 23), GAP-MOD04-04 (media providers, section 10), GAP-MOD14-15 (upload scan
job, section 10), GAP-MOD01-01 (console host, which fixes the passkey relying-party id, section
2.4), GAP-MOD00-03 (catalogue delivery, section 16) and GAP-STD12-07 (AWS region for liveness,
section 11).

---

## Change log

| Version | Date        | Change                                                                                                                                         |
| ------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| v1.0    | 24 Nov 2026 | First issue: 24 capability areas with verdicts, module-to-resource table, adopt-now shortlist, not-now list, dependency rule, four gaps raised |
