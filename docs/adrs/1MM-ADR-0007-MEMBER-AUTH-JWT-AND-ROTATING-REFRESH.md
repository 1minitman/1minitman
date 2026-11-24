# 1MM-ADR-0007 · Member authentication: 15-minute EdDSA JWT and rotating refresh tokens

|                  |                                                                     |
| ---------------- | ------------------------------------------------------------------- |
| **Status**       | Accepted                                                            |
| **Date decided** | 18 Nov 2026                                                         |
| **Decided by**   | Technical Reference §8.1 and §13                                    |
| **Sources**      | [TR §8.1], [TR §13.1], [TR §13.2], [TR §5.1], [TR §6.2], [TR §10.1] |
| **Affects**      | apps/api, apps/mobile, apps/web, MOD-00, MOD-03                     |

## Context

Members sign in on phones that are lost, shared and re-sold, and the product's promise is real
people. The security section lists session hijacking as a named risk and answers it with
"15-min access tokens; rotating refresh families with reuse detection; device binding + integrity
verdict; new-device codes (L2 / L3) and alerts (PM6, N18); sign out of all others" [TR §13.1].
The API section gives the token design [TR §8.1].

## Decision

1. **Access token:** a JWT signed with EdDSA, valid for 15 minutes [TR §8.1].
2. **Refresh token:** valid for 30 days, rotated on every use, stored only as a SHA-256 hash in
   `refresh_tokens`, one family per device. Re-use of a rotated token revokes the whole family
   [TR §8.1].
3. **Immediate sign-out:** a denylist in Redis, `sess:deny:{session}`, is checked so a revoked
   session stops before its access token expires [TR §8.1].
4. **Storage on clients:** the member app keeps the refresh token in `expo-secure-store`
   [TR §5.1]. The billing web app uses the same auth with a secure HttpOnly cookie session
   [TR §6.2].
5. Sensitive member actions require re-authentication within the last 5 minutes (auth class
   `M+` in the endpoint catalogue) [TR §8.2].
6. Admin authentication is a different mechanism (cookie session with mandatory MFA):
   [1MM-ADR-0028](1MM-ADR-0028-ADMIN-CONSOLE-STATIC-SPA-MANDATORY-MFA.md).

## Alternatives considered

The sources record no alternatives.

**Analysis:** (a) opaque server-side sessions for members would make revocation trivial but add
a store read to every request and every WebSocket frame; the short JWT plus a denylist gives
revocation without that read for the common case. (b) Long-lived access tokens without rotation
would leave a stolen token valid for weeks. (c) A symmetric signature (HS256) would put the
signing secret in every verifier.

## Consequences

- Easier: stateless verification on every API replica; a stolen refresh token is detected on
  re-use; "sign out of all others" is a family revocation.
- Harder: clients must handle refresh races (two requests refreshing at once) without tripping
  re-use detection; signing keys need rotation.
- Cost: one Redis lookup for the denylist; no vendor.

## How it is applied

- Tables `sessions`, `refresh_tokens`, `devices`, `new_device_challenges` [TR §10.1]; rules in
  [TR §13.2].
- Built in [MOD-03 Member identity and auth](../execution/1MM-EXE-MOD-03-MEMBER-IDENTITY-AND-AUTH.md);
  the auth middleware lands in [MOD-00](../execution/1MM-EXE-MOD-00-FOUNDATIONS.md).
- Checks: tests for rotation, family revocation on re-use and denylist sign-out
  ([1MM-STD-01](../standards/1MM-STD-01-TESTING-STRATEGY.md)); threat list in
  [1MM-STD-11](../standards/1MM-STD-11-SECURITY-AND-COMPLIANCE.md).

## Revisit when

The penetration test before public launch [TR §13.4] finds a weakness in the token design, or a
member web app beyond billing is approved (OD-15 keeps the web app billing-only in v1).
