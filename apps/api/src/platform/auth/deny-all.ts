import { createAdminGuards, denyAllAdminAuthPorts, type AdminGuards } from './admin';
import { createMemberGuards, denyAllMemberAuthPorts, type MemberGuards } from './member';

/** Guards for both surfaces with every port denying: tests and OpenAPI document emission. */
export const denyAllAuth = (): { member: MemberGuards; admin: AdminGuards } => ({
  member: createMemberGuards(denyAllMemberAuthPorts()),
  admin: createAdminGuards(denyAllAdminAuthPorts()),
});
