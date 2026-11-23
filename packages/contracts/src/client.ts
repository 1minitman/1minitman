import createClient, { type ClientOptions } from 'openapi-fetch';
import type { paths as AdminPaths } from './generated/admin';
import type { paths as MemberPaths } from './generated/member';
import type { paths as PublicPaths } from './generated/public';

/**
 * Typed clients, one per API surface. `baseUrl` is the API origin
 * (for example http://localhost:4000); paths already carry their /v1 prefix.
 * Types come from the OpenAPI documents: run `pnpm contracts:generate` after changing a route.
 */
export const createMemberClient = (options: ClientOptions) => createClient<MemberPaths>(options);
export const createPublicClient = (options: ClientOptions) => createClient<PublicPaths>(options);
/** The admin console signs in with an HttpOnly cookie, so requests always send credentials. */
export const createAdminClient = (options: ClientOptions) =>
  createClient<AdminPaths>({ credentials: 'include', ...options });

export type { AdminPaths, MemberPaths, PublicPaths };
