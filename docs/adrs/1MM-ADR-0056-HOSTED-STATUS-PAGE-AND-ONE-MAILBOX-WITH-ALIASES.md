# 1MM-ADR-0056 · A free hosted status page, and one mailbox with role aliases

|                  |                                                                                                                                   |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Status**       | Accepted                                                                                                                          |
| **Date decided** | 20 Nov 2026                                                                                                                       |
| **Decided by**   | Owner decisions OD-22 and OD-23 (tracker items C-5 and C-6)                                                                       |
| **Sources**      | [OD-22], [OD-23], [ODT C-5, C-6], [WEB §9 DN-12, DN-22], [WEB §3.12], [TR §4], [TR §13]                                           |
| **Affects**      | Operations; apps/site (links, `security.txt`), apps/mobile (maintenance state), apps/api (config); MOD-02, MOD-15, MOD-16, MOD-17 |

## Context

Two operational services were open in the website register: where the status page runs
[WEB §9 DN-12] and which role mailboxes exist [WEB §9 DN-22]. Both carry a possible fixed cost,
so they went to the owner [ODT]. They are recorded together because they are the same kind of
decision: an operational service outside the product's own stack.

## Decision

1. **Status page:** `status.1minitman.com` on a free hosted plan (Instatus or Better Stack),
   **hosted apart from our stack** [OD-22].
2. **Mailboxes:** one real mailbox, `privacy@` (the interim DPO). The other role addresses
   (`help@`, `press@`, `careers@`, `security@` and the rest listed in OD-23) are aliases that
   forward to it; an alias becomes a mailbox of its own only when someone is hired for the role
   [OD-23].
3. `/.well-known/security.txt` on the website carries the `security@` contact [WEB §3.12].

## Alternatives considered

- **Status page: an in-house static page on a separate host** [WEB §9 DN-12]. Not chosen.
  **Analysis:** a hosted service stays reachable and editable when our own deployment pipeline is
  the thing that is down.
- **Mailboxes: one mailbox per role** [WEB §9 DN-22]. Not chosen; aliases cost nothing and can be
  promoted later [OD-23].

## Consequences

- Easier: the status page survives an outage of the API, the website host or the admin console,
  which is the moment it is needed.
- Harder: incident updates are entered by hand in a second tool; nothing in the admin console
  publishes to it.
- Harder: one inbox receives privacy requests, support mail, security reports and press mail, so
  triage depends on the alias the message was sent to. Time-bound mail (privacy requests,
  security reports) must be moved into the product's own queues (A36, A32) to get a deadline.

## How it is applied

- The status-page link is data, not a literal: `site_settings.maintenance.status_url` on the
  website [SQL] and the maintenance state in the app
  ([1MM-STD-19 §6](../standards/1MM-STD-19-OTA-UPDATES.md)).
- Role addresses shown in any client come from configuration or the CMS; the repository contains
  role addresses only, never a person's address ([1MM-STD-11](../standards/1MM-STD-11-SECURITY-AND-COMPLIANCE.md)).
- Incident handling: [MOD-17](../execution/1MM-EXE-MOD-17-NETWORK-AND-SECURITY-OPERATIONS.md).
- Check: launch-gate items in [MOD-19](../execution/1MM-EXE-MOD-19-HARDENING-AND-LAUNCH.md) that
  the status page resolves and every alias delivers.

## Revisit when

The free plan's limits are reached, a role is staffed (its alias becomes a mailbox), or incident
volume justifies publishing status from the console.
