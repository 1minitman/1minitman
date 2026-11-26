# 1MM-ADR-0081 · OpenAPI operation declarations: auth, rate-limit policy and problem codes

|                  |                                                                                                                                                |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**       | Proposed                                                                                                                                       |
| **Date decided** | 26 Nov 2026 (proposed)                                                                                                                         |
| **Decided by**   | Engineering recommendation made while building `MOD-00-API-01`; awaiting the owner                                                             |
| **Sources**      | [1MM-EXE-MOD-00](../execution/1MM-EXE-MOD-00-FOUNDATIONS.md) §4.3 rule 4, §4.4 and the API gate item 2; 1MM-STD-13 §8; [TR §13.3]; OpenAPI 3.1 |
| **Affects**      | `packages/contracts` (route definitions, the enumeration test), `apps/api`, every module that adds a route                                     |

## Context

MOD-00 §4.4 requires "a test that enumerates every OpenAPI operation and asserts it declares
auth, errors and a rate-limit policy", and 1MM-STD-13 §8 requires that every operation declares
its error responses with `ProblemSchema`. No source says how an operation records these three
facts in the OpenAPI document, so the test had nothing to read.

## Decision

Every route definition in `packages/contracts/src/routes/` declares:

1. **Auth** as the OpenAPI `security` member of the operation. `[]` (`NO_AUTH`) states that the
   route needs no credential. The member and staff security schemes are added with the auth
   middleware (`MOD-00-API-02`).
2. **Rate-limit policy** as the extension `x-rate-limit-policy`: a `rate_limit_policies.key`
   seeded by a migration, or `null` to state that no policy applies. The value names a policy and
   never carries numbers (§4.3 rule 4).
3. **Errors** with `problemResponses(...codes)`: one response per status, content
   `application/problem+json` with the `Problem` component, and the extension
   `x-problem-codes` listing the registry codes that status can carry. `internal` (500) is always
   included. The only error response that is not a problem document is `GET /ready` 503
   (1MM-STD-13 §2.2).

`packages/contracts/src/openapi.test.ts` reads the generated documents and fails when an
operation leaves out any of the three, names a policy that no migration seeds, or lists a code
that is not in the registry or not of that status. `messages.test.ts` requires an `en` message
for every code an operation declares.

## Alternatives considered

- **Hono middleware metadata only.** Rejected: it is not in the OpenAPI document, so the
  generated clients and the enumeration test cannot see it.
- **Free text in the description.** Rejected: a test cannot check it.
- **Leave the member out when a route has no auth or no limit.** Rejected: an omission and a
  deliberate "none" would look the same.

## Consequences

- Easier: the contract states who may call a route, how it is limited and which codes it returns;
  clients see the codes in the generated types' source document.
- Harder: every new route carries three declarations; the enumeration test fails the pull request
  that forgets one.

## How it is applied

- Helpers: `NO_AUTH`, `RATE_LIMIT_POLICY_EXTENSION`, `problemResponses` in
  `packages/contracts/src/routes/operation.ts`.
- Checks: `pnpm test` (`@1minitman/contracts`), after `pnpm contracts:generate`.

## Revisit when

The owner rules on the proposal, or the auth middleware (`MOD-00-API-02`) adds the security
schemes.
