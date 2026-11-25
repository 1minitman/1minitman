# 1MM-ADR-0018 · Redis for cache, quotas, rate limits, presence and realtime fan-out

|                  |                                                                                                                                                |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**       | Accepted                                                                                                                                       |
| **Date decided** | 18 Nov 2026                                                                                                                                    |
| **Decided by**   | Technical Reference §3; provider by owner decision OD-11                                                                                       |
| **Sources**      | [TR §3], [TR §4.2], [TR §4.3], [TR §4.6], [TR §8.1], [TR §8.5], [TR §13.1], [TR §13.3], [OD-11], [DD §14], `apps/api/src/platform/rate-limit/` |
| **Affects**      | apps/api, apps/worker, MOD-00, MOD-03, MOD-07, MOD-08, MOD-10                                                                                  |

## Context

The product plan asked for "Redis: cache, presence, broker". The Technical Reference lists its
uses: "Feed cache, quotas, rate limits, presence, typing, WebSocket pub/sub, entitlement cache"
[TR §3]. The owner chose Upstash Redis in eu-central-1, free tier for demo and beta [OD-11].
PostgreSQL remains the only system of record
([1MM-ADR-0010](1MM-ADR-0010-POSTGRESQL-16-POSTGIS-SYSTEM-OF-RECORD.md)).

## Decision

1. Redis holds only data that can be rebuilt or that may expire:

   | Use                    | Example key           | Durable copy                                 |
   | ---------------------- | --------------------- | -------------------------------------------- |
   | Discovery feed cache   | `feed:{user}:{tab}`   | Rebuilt by the discovery query [TR §8.5]     |
   | Daily spec quota       | `quota:specs:*`       | `usage_counters` [TR §8.5]                   |
   | Entitlement cache      | `ent:{user_id}`       | `entitlement_grants` [TR §4.6]               |
   | Session denylist       | `sess:deny:{session}` | Session rows [TR §8.1]                       |
   | Chat fan-out (pub/sub) | `ch:conv:{id}`        | `messages`, written first [TR §4.2]          |
   | Rate limits            | sliding windows       | Policies in `rate_limit_policies` [TR §13.3] |

2. Rate limiting uses Redis sliding windows per IP, device, account, phone and email, with the
   limits seeded in `rate_limit_policies` [TR §13.1], [TR §13.3].
3. The API talks the standard Redis protocol over TLS, so the provider can change [OD-11].
4. The full keyspace with TTLs is the data dictionary's Redis keyspace section [DD §14]; a new key is added
   there before it is used.

## Alternatives considered

- **AWS ElastiCache:** excluded when OD-11 removed AWS compute, database and cache at launch.
- **PostgreSQL for everything** (no Redis): the sources record no such option. **Analysis:**
  presence heartbeats every 30 s and typing events [TR §8.3] would become write load on the
  primary, and pub/sub across API replicas would need `LISTEN/NOTIFY` through a pooler.

## Consequences

- Easier: hot reads and counters stay off the database; every API replica relays the same
  events.
- Harder: every use needs a defined behaviour when Redis is empty or unreachable; the free tier
  has a command quota, so presence, feed and rate-limit traffic force pay-as-you-go before public
  launch [TR §4.3].
- Cost: free tier, then pay-as-you-go.

## How it is applied

- `apps/api/src/platform/rate-limit/` (`rateLimit()`, Redis sliding-window limiter, with tests),
  attached per route. Local and CI use `redis:7-alpine`.
- Cross-cutting pieces land in [MOD-00](../execution/1MM-EXE-MOD-00-FOUNDATIONS.md); data rules
  in [1MM-STD-12 Data handling](../standards/1MM-STD-12-DATA-HANDLING.md).
- Check: a test per cached value that flushes Redis and asserts the durable copy still answers.

## Revisit when

Upstash limits (commands, pub/sub connections) are reached at paid tiers, or a market requires
local hosting (the origin then moves as a whole, OD-11).
