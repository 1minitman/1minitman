# 1MM-ADR-0080 · Client input validation: shared schemas, config-driven limits, server authority

|                  |                                                                                                                                                                                                       |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**       | Proposed                                                                                                                                                                                              |
| **Date decided** | 25 Nov 2026 (proposed)                                                                                                                                                                                |
| **Decided by**   | Engineering recommendation in 1MM-STD-21, made at the owner's request for a client validation strategy for every UI that takes input; awaiting the owner                                              |
| **Sources**      | [TR §5.1], [TR §13.1], [TR §13.4], [ADM §1.5], [WEB §5.10], [BG §13]; 1MM-STD-13, 1MM-STD-16 §2; OWASP Input Validation Cheat Sheet; OWASP ASVS 5.0; WCAG 2.2; NIST SP 800-63B; RFC 5321; ITU-T E.164 |
| **Affects**      | packages/contracts, packages/i18n, apps/mobile, apps/admin, apps/web, apps/site; every module with a form (MOD-01 onwards)                                                                            |

## Context

Every client form needs checks before it sends: types, lengths, ranges, formats and the right
input control. The sources fix the pieces but not the whole: forms use react-hook-form with zod
schemas shared with the API [TR §5.1]; field failures are 422 `validation` with field codes
([1MM-ADR-0075](1MM-ADR-0075-ERROR-CODE-SCHEME.md)); limits are admin-managed `remote_config`
(owner rule 3). A static zod schema cannot read a live config value, zod counts length in UTF-16
units while the database counts code points, and no document said when to validate or which
control and `autocomplete` each kind of field uses.

## Decision

1. The API stays the only authority. Client validation is for speed and clarity and is never
   stricter than the server; with no known limit, the client skips that check.
2. Schemas with configurable limits are exported from `packages/contracts` as functions of those
   limits, built by the API from `remote_config` and by clients from `GET /v1/config`.
3. Shared helpers in `packages/contracts` normalise (NFC, trim, line endings, E.164) and count length
   in Unicode code points, the unit of `char_length()`.
4. Client checks raise the field codes of 1MM-STD-13 §4.3 and show `error.field.<code>` from the
   catalogue with the label and limit filled in; no client-only messages or codes.
5. Timing: validate on blur, re-validate on change once in error, validate all on submit and focus
   the first invalid field; a 422 is mapped to fields by `errors[].path`, keeping the values.
6. Controls, `autocomplete`, keyboards and accessibility follow the table and rules of 1MM-STD-21
   §6–§8 (WCAG 2.2 AA, NIST SP 800-63B for passwords).

## Alternatives considered

- **Hand-written client rules per screen.** Rejected: rules drift from the server and break
  owner rule 3 (1MM-STD-16 §2: "a copy of a rule in a client is a bug").
- **Server-only validation.** Analysis: correct but slow and unfriendly on mobile networks; WCAG
  3.3.1 and 3.3.3 favour inline, early feedback.
- **Hard limits baked into the contract.** Rejected: an admin change would need a release.
- **Native HTML constraint validation only.** Analysis: browser messages cannot be translated
  through the catalogue and do not exist on native; kept only as the no-JavaScript fallback on the
  website.

## Consequences

- Easier: one rule, one message and one limit per field across four clients and the API; limits
  change without a release.
- Harder: `packages/contracts` gains schema factories and helpers; every form needs boundary and
  parity tests. Four gaps are raised (GAP-STD21-01 to GAP-STD21-04).

## How it is applied

- The rules, per-kind table and checklist: [1MM-STD-21](../standards/1MM-STD-21-CLIENT-INPUT-VALIDATION.md).
- Required reading for `ADM`, `WEB` and `MOB` tasks ([1MM-STD-02 §4](../standards/1MM-STD-02-AGENTIC-OPERATIONS.md));
  a line in the UI checklist of [1MM-STD-04 §17](../standards/1MM-STD-04-BRAND-GUIDE.md).
- Checks: schema boundary and parity tests, form tests and accessibility checks (1MM-STD-21 §10).

## Revisit when

The owner rules on the proposal, or a client needs a validation rule the API cannot express.
