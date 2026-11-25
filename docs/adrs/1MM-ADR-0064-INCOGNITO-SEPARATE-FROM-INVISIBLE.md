# 1MM-ADR-0064 · Incognito and Invisible are two separate settings

|                  |                                                                                                                   |
| ---------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Status**       | Accepted                                                                                                          |
| **Date decided** | 21 Nov 2026                                                                                                       |
| **Decided by**   | Owner decision OD-34 (default under the standing instruction)                                                     |
| **Sources**      | [OD-34], [DDR M11], [UF §12.3 D67], [TR §9], [TR §18.2b], [CB §2, §4], [SQL], `packages/entitlements/src/keys.ts` |
| **Affects**      | apps/api, packages/db, packages/entitlements, apps/mobile (D2, D17); MOD-03, MOD-07                               |

## Context

The change brief listed "incognito/invisible presence" as one Gold perk [CB §2], while the boards
showed two controls: an Incognito switch in settings (D17) and an Invisible status on D2. The
design data review found one stored value for two visible controls [DDR M11].

## Decision

1. They are **two separate settings** [OD-34].
2. **Incognito** (Gold, D17, `profiles.incognito`): browse privately; only people the member
   liked can see the member in their specs [OD-34], [SQL].
3. **Invisible** (D2 status, `profiles.presence_pref = invisible`): hidden from presence ("Active
   now") [OD-34]. The Invisible status is Gold only, enforced by the API [SQL], with the
   entitlement `presence.invisible`.

## Alternatives considered

- **One merged setting.** Not chosen: the two answer different needs, and merging them would
  remove a Gold perk [UF §12.3 D67].

## Consequences

- Easier: each setting has one meaning and one column; discovery reads `incognito`, presence
  reads `presence_pref`.
- Harder: discovery needs a visibility rule that depends on the viewer ("did this member like
  me?"), which touches the deck query, likes lists and Spotlight.
- Open point: the schema's column comment describes `presence_pref = invisible` as "hidden from
  discovery and presence", while OD-34 says hidden from presence only [SQL], [OD-34]. The owner
  decision wins (source precedence); the comment is a correction for the Technical Reference
  extensions log, to be raised as a `TR` gap by MOD-07 when the rule is implemented.
- Open point: `packages/entitlements/src/keys.ts` has `presence.invisible` but no key for
  Incognito; [TR §9] lists Incognito as a Gold row. The owning module verifies how the gate is
  expressed and raises a gap if a key is missing. Nothing is invented here.

## How it is applied

- Settings writes are MOD-03 and status is MOD-07 (ruling R3, [master plan](../execution/1MM-EXE-00-MASTER-PLAN.md) section 7):
  [MOD-03](../execution/1MM-EXE-MOD-03-MEMBER-IDENTITY-AND-AUTH.md),
  [MOD-07](../execution/1MM-EXE-MOD-07-DISCOVERY-AND-MATCHING.md).
- A non-Gold member who sets either is refused with `403` `entitlement` and an upsell target
  ([1MM-STD-13 §5.1](../standards/1MM-STD-13-ERROR-CODES.md)).
- Checks: API tests for the four combinations of the two settings, seen by a member the subject
  liked and by one they did not; a test for what happens to both settings when Gold lapses.

## Revisit when

Research shows members cannot tell the two apart, or a lapse rule for either is decided
differently from the default.
