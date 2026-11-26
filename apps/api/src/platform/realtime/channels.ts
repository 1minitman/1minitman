/*
 * Redis keys and pub/sub channels of the realtime layer ([DD §14], TRX-053). Every name here is
 * sourced; nothing else in the API spells them.
 */

/** Events for one member, on every instance that holds one of their sockets [DD §14]. */
export const userChannel = (userId: string) => `ch:user:${userId}`;

/** Events for one conversation's open sockets [DD §14], [TR §4.2]. */
export const conversationChannel = (conversationId: string) => `ch:conv:${conversationId}`;

/** Admin SSE events for one staff member (TRX-053). */
export const adminChannel = (adminId: string) => `ch:admin:${adminId}`;

/** Admin SSE events for every staff member, filtered per stream (TRX-053). */
export const ADMIN_ALL_CHANNEL = 'ch:admin:all';

/** Set of a member's open connection ids, 120 s TTL refreshed by the heartbeat [DD §14]. */
export const connectionKey = (userId: string) => `ws:conn:${userId}`;
