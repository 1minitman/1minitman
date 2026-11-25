# 1MM-ADR-0008 · Idempotency keys on money and one-off actions; client ids on reactions and messages

|                  |                                                                              |
| ---------------- | ---------------------------------------------------------------------------- |
| **Status**       | Accepted                                                                     |
| **Date decided** | 18 Nov 2026                                                                  |
| **Decided by**   | Technical Reference §8.1                                                     |
| **Sources**      | [TR §8.1], [TR §4.2], [TR §5.3], [TR §8.4], [TR §10.2], [TR §13.1]           |
| **Affects**      | apps/api, apps/worker, apps/mobile, apps/web, MOD-00, MOD-07, MOD-08, MOD-10 |

## Context

The app must work on a 2 GB Android phone on 3G [TR §5.3], so requests time out and are retried.
A retried payment, badge submission or like must not happen twice. The security section lists
"Duplication" as a named risk: "idempotency keys on payments, badge submit and exports; client
ids on reactions and messages; webhook dedupe" [TR §13.1]. The offline outbox replays reactions,
reads and status changes "with client-generated ids, so replays are idempotent" [TR §4.2].

## Decision

1. An `Idempotency-Key` header is required on payments, badge submit and exports [TR §8.1].
2. Reactions and messages carry a client-generated id [TR §8.1], [TR §5.3]. A replayed reaction
   returns the original outcome (`record_reaction()` step 1, replay check on
   `(actor, client_reaction_id)`) [TR §8.4].
3. Message idempotency uses the table `message_client_ids`, because unique keys on a partitioned
   table must include the partition key [TR §10.2].
4. Inbound webhooks are de-duplicated before they are processed [TR §13.1].
5. Messages are never queued silently by the client: a failed send shows as failed (ES6)
   [TR §4.2].

## Alternatives considered

The sources record no alternatives.

**Analysis:** (a) relying on natural unique constraints alone prevents a duplicate row but
returns an error on retry instead of the original result, which the client would show as a
failure; (b) an idempotency key on every write would be uniform but costs a stored response per
request for actions that are already safe to repeat.

## Consequences

- Easier: clients retry freely; the offline outbox is safe; a double tap never double charges.
- Harder: the API must store and replay the first outcome; the key's scope (member, route,
  payload) and lifetime must be defined once and tested.
- Cost: storage for keys and outcomes.

## How it is applied

- The idempotency middleware is a cross-cutting deliverable of
  [MOD-00](../execution/1MM-EXE-MOD-00-FOUNDATIONS.md); each module's endpoint table has an
  "idempotency" column (module plan §4.1).
- Reactions: [MOD-07](../execution/1MM-EXE-MOD-07-DISCOVERY-AND-MATCHING.md). Messages:
  [MOD-08](../execution/1MM-EXE-MOD-08-INTRO-CHAT-AND-DIRECT-SPECS.md). Payments and webhooks:
  [MOD-10](../execution/1MM-EXE-MOD-10-BILLING-PLANS-AND-ENTITLEMENTS.md).
- Checks: a replay test per idempotent endpoint (same key, same result, one row); the schema
  behaviour tests already cover idempotent replay and the webhook and payment keys [TR §10.4].

## Revisit when

A new write appears that moves money or cannot be undone and is not in the list above: it joins
the list by a superseding ADR, not by a local exception.
