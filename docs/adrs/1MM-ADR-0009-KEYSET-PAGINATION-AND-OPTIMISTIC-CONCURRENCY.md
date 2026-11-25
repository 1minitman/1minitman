# 1MM-ADR-0009 · Keyset pagination, never OFFSET; `If-Match` on profile edits

|                  |                                                    |
| ---------------- | -------------------------------------------------- |
| **Status**       | Accepted                                           |
| **Date decided** | 18 Nov 2026                                        |
| **Decided by**   | Technical Reference §8.1                           |
| **Sources**      | [TR §8.1], [TR §10.2], [TR §13.1], [TR §15]        |
| **Affects**      | apps/api, packages/contracts, every client, MOD-00 |

## Context

Lists in this product grow without bound and change while they are read: chats, messages, likes,
admin queues, the audit log. The Technical Reference sets one rule for all of them: "Pagination:
keyset (cursor), never OFFSET. Optimistic concurrency (`If-Match`) on profile edits" [TR §8.1].
Primary keys are time-ordered uuid v7 [TR §10.2], which gives every table a stable sort key, and
the performance budgets are set per endpoint [TR §15]. The security section lists optimistic
`If-Match` on profile edits among its race-condition controls [TR §13.1].

## Decision

1. Every list endpoint on every surface pages by an opaque cursor built from the sort key of the
   last row. No endpoint accepts an offset or a page number.
2. Profile edits carry `If-Match`; a stale version is refused, not overwritten.
3. **Recommendation:** sort orders are made stable by ending the sort key with the row id, and
   a total count is returned only where a source asks for one and it can be served cheaply.

## Alternatives considered

The sources record no alternatives; "never OFFSET" rules out the common one.

**Analysis:** OFFSET pagination reads and discards every skipped row, so deep pages get slower as
tables grow, and rows shift between pages when items are inserted during reading, which shows as
duplicates or gaps in a chat or a moderation queue. Last-write-wins on profile edits would let an
edit from a second device silently undo the first.

## Consequences

- Easier: constant cost per page on indexed keys; infinite lists in the app do not duplicate rows.
- Harder: no "jump to page 40" in admin tables; every list needs an index that matches its sort;
  clients must treat cursors as opaque and handle a refused edit by reloading.
- Cost: none.

## How it is applied

- The cursor helper and its response shape are cross-cutting deliverables of
  [MOD-00](../execution/1MM-EXE-MOD-00-FOUNDATIONS.md) and are defined once in
  `packages/contracts`.
- Indexes per list: [1MM-DB-04 Indexing](../database/1MM-DB-04-INDEXING.md).
- Checks: review rejects `OFFSET` in queries and page-number parameters in route schemas; list
  tests insert a row between two page reads and assert no duplicate and no gap; a stale
  `If-Match` test on profile edits.

## Revisit when

An admin view needs random page access that keyset paging cannot give. The answer is a bounded,
filtered export or a materialised view for that view only, recorded in a new ADR.
