/** The signed-in member, put in context by `requireMember()` (MOD-00 plan section 4.1, behaviour 3). */
export interface MemberPrincipal {
  /** `users.id` of the member the access token was issued to. */
  memberId: string;
  /** `sessions.id` the token belongs to; the key of `sess:deny:{session}`. */
  sessionId: string;
}

/** The signed-in staff member, put in context by `requireAdmin()` (behaviour 4). */
export interface AdminPrincipal {
  /** `admin_users.id`. */
  adminId: string;
  /** `admin_sessions.id`. */
  sessionId: string;
}
