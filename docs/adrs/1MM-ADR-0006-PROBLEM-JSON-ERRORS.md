# 1MM-ADR-0006 · Errors are RFC 9457 problem+json with a request id

|                  |                                                                                                      |
| ---------------- | ---------------------------------------------------------------------------------------------------- |
| **Status**       | Accepted                                                                                             |
| **Date decided** | 18 Nov 2026                                                                                          |
| **Decided by**   | Technical Reference §8.1                                                                             |
| **Sources**      | [TR §8.1], [TR §14], `apps/api/src/platform/http/problem.ts`, `apps/api/src/platform/http/router.ts` |
| **Affects**      | apps/api, packages/contracts, every client                                                           |

## Context

Four clients read the API's errors, and several of them must act on an error without parsing
text: the member app shows an upsell when an entitlement is missing, a restriction notice when an
account is restricted, and a cap screen when a quota is spent. The Technical Reference sets one
format: errors "follow RFC 9457 problem+json and include a request id. Gating errors carry a
machine reason and the upsell target", with the examples
`403 {reason:"entitlement", entitlement:"chat.full", upsell:"D15?plan=premium"}`, `403 restricted`
and `402 quota_exhausted` [TR §8.1]. Tracing needs the same request id on every response and log
line [TR §14].

## Decision

1. Every error response on every surface has `Content-Type: application/problem+json` and the
   RFC 9457 members, plus the request id.
2. Gating errors add machine-readable members: the reason, the entitlement key and the upsell
   target, as in the Technical Reference examples.
3. Domain and application code throws `ProblemError`; only the HTTP layer turns it into a
   response. Validation failures from zod-openapi, unknown routes and unhandled errors are
   converted to the same shape.
4. **Recommendation:** text a person reads is not taken from the problem `title`; clients map
   the machine members to translated copy from the i18n catalogue, in line with the rule that no
   user-facing text is hard-coded.

## Alternatives considered

The sources record no alternatives.

**Analysis:** an ad-hoc `{ error: { code, message } }` envelope would work but is not a
standard, so every client and tool would need to learn it; plain HTTP status codes alone cannot
carry the upsell target or the entitlement key.

## Consequences

- Easier: one error parser in the generated clients; support can find any failure by request id;
  gating behaves the same on every screen.
- Harder: every new failure needs a registered problem type and a status, not a free-text
  message.
- Cost: none.

## How it is applied

- `apps/api/src/platform/http/problem.ts` (`ProblemError`, `problemResponse`, not-found and error
  handlers) and `router.ts` (validation failures as `422`).
- The `Problem` schema is exported from `packages/contracts`, so it is in every OpenAPI document.
- The catalogue of problem types and statuses is
  [1MM-STD-13 Error codes and error handling](../standards/1MM-STD-13-ERROR-CODES.md); module
  plans list the problems of each endpoint (§4.1).
- Check: API tests assert the content type and the request id on error paths
  ([1MM-STD-01](../standards/1MM-STD-01-TESTING-STRATEGY.md)).
- Clients map `validation` failures to form fields as set out in [1MM-STD-21](../standards/1MM-STD-21-CLIENT-INPUT-VALIDATION.md) and [1MM-ADR-0080](1MM-ADR-0080-CLIENT-INPUT-VALIDATION-STRATEGY.md).

## Revisit when

RFC 9457 is replaced by a successor the clients' tooling supports, or a consumer appears that
cannot read problem+json (none in v1: partner feeds are out of scope, OD-16).
