/** The signed-in member, put in context by `requireMember()` (MOD-00 plan section 4.1, behaviour 3). */
export interface MemberPrincipal {
  /** `users.id` of the member the access token was issued to. */
  memberId: string;
  /** `sessions.id` the token belongs to; the key of `sess:deny:{session}`. */
  sessionId: string;
  /**
   * When the access token stops being valid (its `exp`). REST checks expiry inside the verifier;
   * the WebSocket gateway also needs the instant, to close a long-lived socket when it passes
   * (TRX-034). The verifier MOD-03 supplies sets it; a socket whose principal has none is
   * refused, because the gateway could not tell when to close it.
   */
  expiresAt?: Date;
}

/** The signed-in staff member, put in context by `requireAdmin()` (behaviour 4). */
export interface AdminPrincipal {
  /** `admin_users.id`. */
  adminId: string;
  /** `admin_sessions.id`. */
  sessionId: string;
}
