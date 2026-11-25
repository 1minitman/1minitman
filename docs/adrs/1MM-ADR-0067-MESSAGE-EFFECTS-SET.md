# 1MM-ADR-0067 · The message-effects set is the member tray: confetti, hearts, wink, spotlight

|                  |                                                                                                         |
| ---------------- | ------------------------------------------------------------------------------------------------------- |
| **Status**       | Accepted                                                                                                |
| **Date decided** | 21 Nov 2026                                                                                             |
| **Decided by**   | Owner decision OD-39 (default under the standing instruction; starter catalogue by OD-31 / T-8)         |
| **Sources**      | [OD-39], [OD-31], [ODT T-8], [DDR M18, B19], [UF §12.3 D71], [ADM App. D AD-35], [SQL]                  |
| **Affects**      | packages/db (seed), apps/api, apps/admin (A24), apps/mobile (D9), packages/entitlements; MOD-02, MOD-08 |

## Context

Message effects play once in a chat and are a Premium and Gold feature [SQL `message_effects`].
The member chat board (D9) and the admin tuning board (A24d) listed different effects [DDR M18,
B19]. The final catalogue was an open item [ADM App. D AD-35], settled as "launch with the
starter seed" [ODT T-8].

## Decision

1. The tray is the **member D9 set: confetti, hearts, wink, spotlight** [OD-39].
2. It is for **Premium and Gold** (entitlement `chat.message_effects`) [OD-39].
3. The set is a seeded catalogue table (`message_effects`), each row with a label key and an
   animation asset reference [SQL]. The admin board aligns to it; its extra effects are a board
   fix [OD-39].

## Alternatives considered

- **The admin board's list** (which had two other effects). Not chosen: one catalogue for the app
  and the console, taken from the member board [UF §12.3 D71].

**Analysis:** hard-coding the tray in the app would make every change a release; the catalogue
table makes the set admin-managed, as owner rule 4 requires.

## Consequences

- Easier: the tray is data. Adding or retiring an effect is a catalogue change plus an asset.
- Harder: an effect needs its animation asset in the app. A catalogue row whose asset is not in
  the installed build must be skipped, not shown broken; new assets reach members by update
  ([1MM-STD-19 §4](../standards/1MM-STD-19-OTA-UPDATES.md)).
- Harder: every effect needs a reduced-motion alternative
  ([1MM-ADR-0070](1MM-ADR-0070-ACCESSIBILITY-BASELINE-AND-SENSORY-SYSTEM.md)).

## How it is applied

- The catalogue is served through the generic catalogue API owned by MOD-02 (ruling R11, [master plan](../execution/1MM-EXE-00-MASTER-PLAN.md) section 7); the
  chat use is in [MOD-08](../execution/1MM-EXE-MOD-08-INTRO-CHAT-AND-DIRECT-SPECS.md).
- A Free member who sends an effect is refused with `403` `entitlement`
  ([1MM-STD-13 §5.1](../standards/1MM-STD-13-ERROR-CODES.md)).
- Checks: an API test that the catalogue returns the four seeded effects; a test that an unknown
  effect code is rejected; a mobile test with reduced motion on.

## Revisit when

Usability research returns: the starter catalogues are to be revised after it [ODT T-8].
