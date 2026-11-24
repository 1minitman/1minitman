# 1MM-ADR-0045 · Password minimums of 8 for members and 12 for admins, with mandatory admin MFA

|                  |                                                                                                |
| ---------------- | ---------------------------------------------------------------------------------------------- |
| **Status**       | Accepted                                                                                       |
| **Date decided** | 18 Nov 2026                                                                                    |
| **Decided by**   | Owner decision OD-07; Technical Reference §18.1 baseline T9 (admin MFA)                        |
| **Sources**      | [OD-07], [UF §12.3 D51], [ADM §0.4 #8], [ADM App. D AD-01, AD-02], [TR §13], [TR §18.1], [SQL] |
| **Affects**      | apps/api, apps/admin (A02, A03), apps/mobile (E5, PM7, R3), apps/web; MOD-01, MOD-03           |

## Context

The member screens disagreed on the minimum length: 8 on E5 and in the auth rules, 10 on PM7
[ADM §0.4 #8]. The admin spec also had an open item on the admin password and invite policy
[ADM App. D AD-01].

## Decision

1. **Members: 8 characters minimum**, checked by the member API before hashing. The strength
   meter may still recommend longer [OD-07], [SQL].
2. **Admins: 12 characters minimum**, and admins also need MFA [OD-07]. Admin MFA and the IP
   allow list are the Technical Reference baseline [TR §18.1 T9].
3. Both minimums are remote config: `auth.password_min_length` = 8 (public) and
   `admin.password_min_length` = 12 [SQL].
4. Admin recovery: 10 single-use recovery codes; otherwise an MFA reset by a super admin only
   [ADM App. D AD-02].

## Alternatives considered

- **10 characters for members**, as PM7 showed [ADM §0.4 #8]. Not chosen: one simple rule for
  members, with stronger protection for staff accounts [UF §12.3 D51].

The sources record no other alternatives. **Analysis:** a single minimum for both populations
would either weaken admin accounts or add sign-up friction for members.

## Consequences

- Easier: one length rule per population, enforced on the server; the client reads the member
  minimum from public config for its hint text.
- Harder: PM7's board value is a board fix, and every password form (E5, R3, PM7, the web app)
  must use the config value.
- Cost: none.

## How it is applied

- A too-short password is a `422` `validation` problem with field code `too_short`
  ([1MM-STD-13 §9](../standards/1MM-STD-13-ERROR-CODES.md)).
- Member auth is built in [MOD-03](../execution/1MM-EXE-MOD-03-MEMBER-IDENTITY-AND-AUTH.md); admin
  sign-in, MFA and recovery codes in
  [MOD-01](../execution/1MM-EXE-MOD-01-ADMIN-ACCESS-AND-GOVERNANCE.md).
- Security context: [1MM-STD-11](../standards/1MM-STD-11-SECURITY-AND-COMPLIANCE.md);
  member tokens: [1MM-ADR-0007](1MM-ADR-0007-MEMBER-AUTH-JWT-AND-ROTATING-REFRESH.md).
- Checks: API tests at 7, 8, 11 and 12 characters; a test that an admin without MFA cannot reach
  any `/admin/v1` route beyond enrolment.

## Revisit when

A security review or penetration test recommends different minimums, or passkeys replace
passwords for either population.
