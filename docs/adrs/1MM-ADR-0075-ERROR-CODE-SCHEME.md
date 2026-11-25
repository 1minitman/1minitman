# 1MM-ADR-0075 · Error code scheme: `reason` is the unique code, 422 for field validation, `tag:` type URIs

|                  |                                                                                                                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**       | Proposed                                                                                                                                                                        |
| **Date decided** | 24 Nov 2026 (proposed)                                                                                                                                                          |
| **Decided by**   | Engineering recommendation in 1MM-STD-13, awaiting the owner (GAP-STD13-01 asks for it in the Technical Reference)                                                              |
| **Sources**      | `docs/standards/1MM-STD-13-ERROR-CODES.md`, [TR §8.1], [ADM §1.1], [ADM §1.4], [WEB §5.10], `packages/contracts/src/schemas/problem.ts`, `apps/api/src/platform/http/router.ts` |
| **Affects**      | apps/api, packages/contracts, packages/i18n, every client; MOD-00 (`MOD-00-API-01`)                                                                                             |

## Context

Errors are RFC 9457 problem documents with a request id
([1MM-ADR-0006](1MM-ADR-0006-PROBLEM-JSON-ERRORS.md)). The sources fix only that shape and a few
examples: three gating errors [TR §8.1], the admin permission error [ADM §1.1] and `412` for a
stale `If-Match` [ADM §1.4]. Statuses and machine codes for every other condition are in no
source. The module plans, written in parallel, proposed their own slugs and statuses, some in
conflict (for example `400` and `422` for the same validation failure).

## Decision

1. **`reason` is the error code.** One lower snake_case value per condition, matching
   `^[a-z][a-z0-9_]{2,48}$`, unique and stable. There is no second top-level `code` member.
   Clients branch on `reason` only, never on `title`, `detail` or the status alone.
2. **Field validation is `422`** with `reason: "validation"` and `errors: [{path, code, message}]`.
   `400` means the request cannot be read at all. Plans that wrote "400 validation" use 422.
3. **`type` is `tag:1minitman.com,2026:problem:<reason>`**: an identifier built from the code,
   never fetched. `about:blank` is no longer emitted once `MOD-00-API-01` lands.
4. The message a person reads comes from the i18n key `error.<reason>`, never from `title`.
5. A code is never renamed, reused or removed while a released app version may receive it; a
   retired code stays in the registry.
6. The registry in [1MM-STD-13 §4](../standards/1MM-STD-13-ERROR-CODES.md) is the single list,
   mirrored by one registry object in `packages/contracts`; the reconciliation table in section 9
   of the standard replaces the slugs the module plans proposed.

## Alternatives considered

**Analysis** (the sources give none):

- **Kebab-case slugs or a separate `code` member**, as some module plans wrote. Rejected: the
  sources' own examples (`entitlement`, `quota_exhausted`, `rate_limited`) and the website's code
  list are snake_case in `reason`; two members for one fact drift.
- **`400` for validation.** Rejected: the scaffold's validation hook already returns `422`, and
  keeping `400` for unreadable requests lets clients tell "fix a field" from "fix the request".
- **`https://` type URIs that resolve to documentation.** Rejected for now: the page would have
  to exist, stay stable and be hosted; a `tag:` URI promises nothing that can break.
- **Numeric codes.** Rejected: unreadable in logs and tests.

## Consequences

- Easier: one parser in the generated clients; `type`, the i18n key and the tests all derive from
  one string.
- Harder: every new failure needs a registry row and an `error.<code>` message before it ships.
- Cost: `ProblemSchema` and `ProblemError` must change in the scaffold (GAP-STD13-02), and the
  website spec's own error names are replaced (GAP-STD13-06).

## How it is applied

- `MOD-00-API-01` adds the registry, makes `reason` required and builds `type` from it.
- API gate item G3: every error a route returns is declared and uses a registry code
  ([1MM-STD-06 §3](../standards/1MM-STD-06-API-FIRST.md)).
- Checks: the registry tests in [1MM-STD-13 §8](../standards/1MM-STD-13-ERROR-CODES.md) (codes
  unique and well-formed; every code has a message; every operation declares its errors; a sweep
  finds no unregistered code; document and code lists are equal).
- Clients raise the same field codes before sending and show `error.field.<code>`: [1MM-STD-21](../standards/1MM-STD-21-CLIENT-INPUT-VALIDATION.md) and [1MM-ADR-0080](1MM-ADR-0080-CLIENT-INPUT-VALIDATION-STRATEGY.md).

## Revisit when

The owner or the Technical Reference rules differently on GAP-STD13-01, or an external consumer
needs resolvable type URIs.
