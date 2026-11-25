# 1MM-ADR-0060 · Venues are always public places, never homes or hotels

|                  |                                                                    |
| ---------------- | ------------------------------------------------------------------ |
| **Status**       | Accepted                                                           |
| **Date decided** | 19 Nov 2026                                                        |
| **Decided by**   | Owner decision OD-30                                               |
| **Sources**      | [OD-30], [TR §18.2a], [CB §5], [ADM A18], [SQL]                    |
| **Affects**      | apps/api, apps/admin (A18), apps/mobile (EV2), packages/db; MOD-13 |

## Context

A meet-up is a date plan with a safety check-in. The member picks a place on EV2 ("pick a public
place") from venues that staff manage in A18 [CB §5]. The schema had a flag for whether a venue
is a public place, which implied that a non-public venue could exist.

## Decision

1. Venues are **always public places; never homes or hotels** [OD-30].
2. `venues.is_public_place` is always true, enforced by a CHECK constraint [SQL].
3. Home or hotel addresses are refused [OD-30].

## Alternatives considered

The sources record no alternatives.

**Analysis:** (a) allowing private venues with a warning would put the safety decision on the
member at the moment they are least able to weigh it; (b) letting members type any address would
remove the staff-curated list that makes the rule enforceable.

## Consequences

- Easier: the meet-up flow has no private-venue branch, and the trusted-contact message always
  names a public place.
- Harder: the constraint proves only that the flag is true. Refusing a home or hotel address is a
  judgement made when staff create or approve the venue, so A18 needs a clear rule and the audit
  trail of who added each venue.
- Harder: the flag carries no information. It stays in the schema because the baseline migration
  is not edited ([1MM-ADR-0012](1MM-ADR-0012-FORWARD-ONLY-SQL-MIGRATIONS.md)).

## How it is applied

- Venue management (A18, meet-ups and venues part) and EV2 are in
  [MOD-13](../execution/1MM-EXE-MOD-13-MEETUPS-AND-PERSONAL-SAFETY.md).
- The API never accepts `is_public_place = false`; the admin form has no such control.
- Checks: a database test that the constraint refuses a false value; an API test that the venue
  create and update contracts do not expose the field as writable.

## Revisit when

A market's norms or a safety review call for a different venue policy. A change would be a new
owner decision and a migration, not a config value.
