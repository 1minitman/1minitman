# 1MM-ADR-0069 · Ten-step onboarding with a server-side resume point and an under-18 block

|                  |                                                                               |
| ---------------- | ----------------------------------------------------------------------------- |
| **Status**       | Accepted                                                                      |
| **Date decided** | 18 Nov 2026                                                                   |
| **Decided by**   | Product decisions D30 and D31 [UF §12.2]; Technical Reference §2.2            |
| **Sources**      | [CB §3], [UF §12.2 D30, D31], [TR §2.2], [TR §5], [TR §13], [TR §18.3], [SQL] |
| **Affects**      | apps/api, apps/mobile (E1–E5, C1–C8, C1·X, OB4), packages/db; MOD-03, MOD-11  |

## Context

Sign-up had twelve steps, including a nickname step and a notification-permission step. The
change brief shortened it so that a member reaches value sooner [UF §12.2 D30]. The product is
for adults only, so the age gate is a hard rule, not a preference.

## Decision

1. Sign-up has **ten steps**: E1 Email, E2 Confirm email, E3 Name, E5 Password, C1 Birthday, C2 I
   am, C3 Interested in, C4 Intention, C5 Rules, C6 Location. The member then lands on C8 with a
   first-run coach. Progress shows n/10 [TR §2.2].
2. **Under-18 block:** C1 requires the member to be 18 or over on the day; C1·X blocks under-18s
   [TR §2.2]. No account is created, and the device is flagged for 30 days, stored as a hash
   [TR §13].
3. **Resume point:** `users.onboarding_step` (1 to 10) is saved after every screen; OB4 resumes
   there when it is below 10 [SQL].
4. **Nickname** defaults to the first name. E4 is the editor in Profile, limited to one change
   every 21 days [TR §2.2].
5. **Notification permission** is asked in context at the first match (D5 to C7), not during
   sign-up [UF §12.2 D31].
6. Google and Apple sign-up skip E1–E5 and join at C1. Phone sign-in is available only after
   Black Badge verification [TR §2.2].
7. C5 records acceptance of the Terms, Privacy Policy and Guidelines, each versioned [TR §2.2].

## Alternatives considered

- **The twelve-step flow** with nickname and notification steps. Superseded: fewer screens before
  value; the nickname is rarely changed at sign-up; a permission asked when its benefit is
  obvious is more likely to be accepted [UF §12.2 D30, D31].

**Analysis:** enforcing the age gate only in the app would let a modified client skip it, so the
API enforces it and the client only presents it.

## Consequences

- Easier: the step counter is one server value, so sign-up resumes on any device.
- Harder: three entry paths (email, Google, Apple) share the steps from C1, and each must land on
  the same server state.
- Harder: the device flag for a blocked minor is itself data about a child's attempt; it is
  stored only as a hash and expires. A board note still says "onboarding_step < 12"; the correct
  bound is 10 [TR §18.3].

## How it is applied

- Onboarding endpoints (`PATCH /v1/me/onboarding` [TR §5]) and `POST /v1/consents` are built in
  [MOD-03](../execution/1MM-EXE-MOD-03-MEMBER-IDENTITY-AND-AUTH.md) (rulings R3, R12); the
  contextual permission step is shared with MOD-11.
- A later suspicion that a member is a minor is handled by
  [1MM-ADR-0063](1MM-ADR-0063-POSSIBLE-MINOR-ASK-FOR-AN-AGE-CHECK.md).
- Checks: API tests for a birthday one day short of 18 and exactly 18, in the member's time zone;
  a test that no `users` row exists after a block; resume tests for each step and each entry path.

## Revisit when

Research shows a step can be removed or must be added, or a market sets a different minimum age.
