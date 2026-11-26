import type { Context } from 'hono';
import { createMiddleware } from 'hono/factory';
import { ProblemError } from '../errors';
import type { AppEnv } from '../http/context';
import { problemResponse } from '../http/problem';
import type { MemberPrincipal } from './principals';

/*
 * Member auth skeleton (MOD-00 plan section 4.1, behaviour 3; [TR §8.1], [TR §8.2],
 * 1MM-ADR-0007). MOD-03 (MOD-03-API-02) supplies the real implementations of the ports below:
 * EdDSA access-token verification, the re-auth window and the code that writes the denylist.
 * Until then the composition root wires `denyAllMemberAuthPorts()` and every guarded route
 * answers 401.
 */

/** Verifies a member access token (a 15-minute EdDSA JWT). MOD-03 implements it. */
export interface AccessTokenVerifier {
  /**
   * The principal for a valid, unexpired token signed by a current key; `null` for any token
   * that is malformed, expired, wrongly signed or otherwise not acceptable. Throw only for an
   * internal failure, which becomes a 500.
   */
  verify(token: string): Promise<MemberPrincipal | null>;
}

/** Immediate revocation: Redis `sess:deny:{session}` ([TR §8.1], [DD §14]). */
export interface SessionDenyList {
  /** True when the session was revoked. Rejects when the store cannot answer. */
  isDenied(sessionId: string): Promise<boolean>;
}

/** The `M+` auth class: re-authenticated within the window of [TR §8.2]. MOD-03 implements it. */
export interface RecentAuthCheck {
  /** True when the member re-authenticated on this session within the re-auth window. */
  isRecent(principal: MemberPrincipal): Promise<boolean>;
}

export interface MemberAuthPorts {
  tokens: AccessTokenVerifier;
  denyList: SessionDenyList;
  recentAuth: RecentAuthCheck;
}

/** Deny by default: no token verifies and no session counts as recently re-authenticated. */
export const denyAllMemberAuthPorts = (): MemberAuthPorts => ({
  tokens: { verify: () => Promise.resolve(null) },
  denyList: { isDenied: () => Promise.resolve(true) },
  recentAuth: { isRecent: () => Promise.resolve(false) },
});

const BEARER = /^Bearer ([A-Za-z0-9\-._~+/]+=*)$/i;

/** The token of an `Authorization: Bearer <token>` header (RFC 6750 syntax), or undefined. */
export const bearerToken = (header: string | undefined): string | undefined =>
  header ? BEARER.exec(header.trim())?.[1] : undefined;

export interface MemberGuards {
  /**
   * Accepts only a valid member access token whose session is not on the denylist, and puts the
   * principal in context (`currentMember(c)`). 401 `unauthenticated` with no or a bad token,
   * 401 `session_expired` for a revoked session, 503 `dependency_unavailable` when the denylist
   * cannot be read (fail closed, GAP-MOD00-17).
   */
  requireMember: () => ReturnType<typeof createMiddleware<AppEnv>>;
  /**
   * For `M+` routes, after `requireMember()`: 403 `reauth_required` outside the window, 503
   * `dependency_unavailable` when the window cannot be read (fail closed, as for the denylist).
   */
  requireRecentAuth: () => ReturnType<typeof createMiddleware<AppEnv>>;
}

export const createMemberGuards = (ports: MemberAuthPorts): MemberGuards => ({
  requireMember: () =>
    createMiddleware<AppEnv>(async (c, next) => {
      const token = bearerToken(c.req.header('authorization'));
      if (!token) return problemResponse(c, 'unauthenticated');
      const principal = await ports.tokens.verify(token);
      if (!principal) return problemResponse(c, 'unauthenticated');

      let denied: boolean;
      try {
        denied = await ports.denyList.isDenied(principal.sessionId);
      } catch (error) {
        c.get('logger').error('session denylist unavailable, refusing request', {
          error: error instanceof Error ? error.message : String(error),
        });
        return problemResponse(c, 'dependency_unavailable');
      }
      if (denied) return problemResponse(c, 'session_expired');

      c.set('member', principal);
      return next();
    }),

  requireRecentAuth: () =>
    createMiddleware<AppEnv>(async (c, next) => {
      const principal = c.get('member');
      if (!principal) return problemResponse(c, 'unauthenticated');
      let recent: boolean;
      try {
        recent = await ports.recentAuth.isRecent(principal);
      } catch (error) {
        c.get('logger').error('re-auth window unavailable, refusing request', {
          error: error instanceof Error ? error.message : String(error),
        });
        return problemResponse(c, 'dependency_unavailable');
      }
      if (!recent) return problemResponse(c, 'reauth_required');
      return next();
    }),
});

/** The member `requireMember()` put in context. Throws 401 on a route without the guard. */
export const currentMember = (c: Context<AppEnv>): MemberPrincipal => {
  const principal = c.get('member');
  if (!principal) throw new ProblemError('unauthenticated');
  return principal;
};
