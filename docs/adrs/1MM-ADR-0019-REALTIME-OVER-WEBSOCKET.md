# 1MM-ADR-0019 · Member realtime over one WebSocket per device, with polling as fallback

|                  |                                                               |
| ---------------- | ------------------------------------------------------------- |
| **Status**       | Accepted                                                      |
| **Date decided** | 18 Nov 2026                                                   |
| **Decided by**   | Technical Reference §4.2 and §8.3                             |
| **Sources**      | [TR §4.2], [TR §4.3], [TR §8.3], [ODT] AD-14, [OD-31]         |
| **Affects**      | apps/api, apps/mobile, MOD-00, MOD-07, MOD-08, MOD-12, MOD-14 |

## Context

The 1-Minute Intro is a live, timed exchange; chat, typing, presence and "it's a match" must
arrive without the member refreshing. The Technical Reference sets the channel: "one per
signed-in device at `/v1/ws`. It carries chat, typing, presence, match and intro events, and
support chat" [TR §4.2]. The API runs on two or more replicas [TR §4.3], so an event raised on
one replica must reach a socket held by another.

## Decision

1. One WebSocket per signed-in device at `/v1/ws`, on the member surface, authenticated like the
   REST API.
2. **Write path for messages:** the message is written to PostgreSQL first, then published to
   Redis `ch:conv:{id}`, and every API instance relays it to its connected sockets [TR §4.2].
   Fan-out uses Upstash pub/sub [TR §4.3].
3. **Polling is the fallback** when the socket is down [TR §4.2].
4. The event names are fixed by the Technical Reference [TR §8.3]: client to server
   `presence.heartbeat` (every 30 s), `typing.start` / `typing.stop`, `message.send` (same
   validation as REST), `intro.open`, `read.mark`; server to client `match.created`,
   `maybe.created`, `intro.*`, `message.*`, `read.updated`, `typing`, `presence.changed`,
   `request.new`, `group.message.new`, `call.incoming` (later release), `entitlements.changed`,
   `account.restricted`, `support.message.new`.
5. The admin console does not use this socket: its live views use a server-sent event stream
   with a 30 s polling fallback (AD-14, decided under OD-31) [ODT]. That decision belongs to the
   admin-console ADRs.

## Alternatives considered

- **Server-sent events:** chosen for the admin console only (AD-14) [ODT]. **Analysis:** the
  member channel is two-way (typing, heartbeats, `message.send`), which SSE does not carry.
- **Polling only:** kept as the fallback, not the main path. **Analysis:** it cannot serve a
  60-second live intro without heavy request volume on 3G.
- **A hosted realtime vendor:** the sources record no such option. **Analysis:** it adds fixed
  cost against OD-06 and a second place where message content flows.

## Consequences

- Easier: one connection carries every live feature; messages are durable before they are
  announced, so a lost socket never loses a message.
- Harder: sockets are long-lived on Railway replicas (deploys must drain them); the gateway must
  authenticate, re-check restrictions and rate-limit frames; clients need reconnect and resync
  logic.
- Cost: pub/sub traffic on Upstash [TR §4.3].

## How it is applied

- The WebSocket gateway is a cross-cutting deliverable of
  [MOD-00](../execution/1MM-EXE-MOD-00-FOUNDATIONS.md); events are added by MOD-07 (match
  events), [MOD-08](../execution/1MM-EXE-MOD-08-INTRO-CHAT-AND-DIRECT-SPECS.md) (intro and chat),
  MOD-12 (groups) and MOD-14 (support chat).
- **Recommendation:** event payloads are zod schemas in `packages/contracts`, and every event
  has a REST read that returns the same state, so the polling fallback needs no second model.
- Checks: a two-replica test (publish on one, receive on the other); a fallback test with the
  socket disabled; `message.send` over the socket and over REST produce the same validation
  result.

## Revisit when

Connection counts or pub/sub limits outgrow the API replicas and Upstash, at which point a
dedicated gateway service is split out; or calls (MF4, after public launch, OD-20) need signalling
beyond `call.incoming`.
