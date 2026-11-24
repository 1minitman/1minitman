# 1MM-ADR-0051 · No outbound partner webhooks in v1; events designed so a feed can be added

|                  |                                                     |
| ---------------- | --------------------------------------------------- |
| **Status**       | Deferred                                            |
| **Date decided** | 19 Nov 2026                                         |
| **Decided by**   | Owner decision OD-16 (tracker item T-4)             |
| **Sources**      | [OD-16], [ODT T-4], [TR §12], [TR §17], [TR §18.2a] |
| **Affects**      | apps/api, apps/worker (event design); MOD-00        |

## Context

The Technical Reference left open whether partners receive outbound webhooks [ODT T-4]. The
platform already receives inbound webhooks from its providers on `/webhooks`
([1MM-ADR-0004](1MM-ADR-0004-API-SURFACES-AND-WEBHOOKS.md)); an outbound feed is a different
thing: signing, retries, subscriptions and a consumer contract.

## Decision

1. There are **no outbound partner webhooks in v1** [OD-16].
2. Events are designed so that a signed webhook feed can be added later **without schema
   changes**. Only a design note named `partner_webhooks` is reserved; nothing is built now
   [OD-16], [TR §12].

## Alternatives considered

- **Build a partner feed in v1.** Not chosen: the recommendation was "none in v1" [ODT T-4]. The
  owner added the condition that the door stays open.

The sources record no other alternatives. **Analysis:** polling endpoints for partners would
carry the same contract cost with worse latency, and no partner consumer exists.

## Consequences

- Easier: no outbound delivery infrastructure, secrets or partner support in v1; errors need only
  be readable by our own clients ([1MM-ADR-0006](1MM-ADR-0006-PROBLEM-JSON-ERRORS.md)).
- Harder: internal events must be named and shaped as stable facts (what happened, to which
  entity, when), not as private implementation signals, so they can be exposed later.
- Cost: none now; the feed is listed as later work [TR §17].

## How it is applied

- Domain events and job payloads follow the naming and payload rules in
  [1MM-STD-14](../standards/1MM-STD-14-CODING-CONVENTIONS.md) and
  [1MM-STD-15](../standards/1MM-STD-15-DATA-STRUCTURES-AND-MODELS.md).
- No route, table or job for outbound delivery exists; a pull request that adds one is rejected
  until this ADR is superseded.
- Check: review. There is no automated check, because the decision is an absence.

## Revisit when

A partner needs event delivery [TR §17]. The new ADR then covers signing, retry policy, the
subscription model and which events are public.
