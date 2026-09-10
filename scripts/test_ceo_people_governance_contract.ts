import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  canManageTenantMembers,
  canManageTenantBilling,
  canManageTenantSettings,
  canTransferTenantOwnership,
  resolveEcosystemPrivilegePolicy,
} from '../src/lib/permissionService.js';
import { canChangeSystemRole } from '../src/lib/roleResolver.js';
import { getMemberRoleUiPolicy } from '../src/lib/organizationMemberRoleUiPolicy.js';

const ceoPolicy = resolveEcosystemPrivilegePolicy('ceo');
assert.equal(ceoPolicy.canManageGlobalGovernance, true, 'CEO must manage ecosystem governance');
assert.equal(canManageTenantMembers('ceo'), true, 'CEO must manage members in every tenant');
assert.equal(canManageTenantBilling('ceo'), true, 'CEO must manage tenant billing');
assert.equal(canManageTenantSettings('ceo'), true, 'CEO must manage tenant settings');
assert.equal(canTransferTenantOwnership('ceo'), true, 'CEO must transfer tenant ownership through the audited command');

for (const targetRole of ['admin', 'manager', 'member', 'viewer', 'leader']) {
  const decision = getMemberRoleUiPolicy({
    actorUid: 'ceo-1',
    actorIsGlobalPrivileged: true,
    actorOrganizationRole: 'member',
    actorIsAuthoritativeOwner: false,
    targetUid: `target-${targetRole}`,
    targetOrganizationRole: targetRole,
    authoritativeOwnerUid: 'owner-1',
  });
  assert.equal(decision.canEdit, true, `CEO UI must allow organization-role management for ${targetRole}`);
}

assert.equal(
  getMemberRoleUiPolicy({
    actorUid: 'ceo-1',
    actorIsGlobalPrivileged: true,
    actorOrganizationRole: 'member',
    actorIsAuthoritativeOwner: false,
    targetUid: 'owner-1',
    targetOrganizationRole: 'owner',
    authoritativeOwnerUid: 'owner-1',
  }).canEdit,
  false,
  'authoritative owner role must use the dedicated ownership-transfer flow',
);

assert.equal(canChangeSystemRole('ceo', 'user', 'ceo').allowed, true, 'CEO must be able to promote another user to CEO');
assert.equal(canChangeSystemRole('ceo', 'ceo', 'user').allowed, false, 'peer CEO demotion must remain protected from an ordinary role edit');

const server = readFileSync('server.ts', 'utf8');
const dashboard = readFileSync('src/pages/Dashboard.tsx', 'utf8');
const organizationManager = readFileSync('src/components/OrganizationManager.tsx', 'utf8');
const roleCommand = readFileSync('src/server/services/OrganizationRoleCommandService.ts', 'utf8');
const removalCommand = readFileSync('src/server/services/MemberRemovalCommandService.ts', 'utf8');
const ownershipTransfer = readFileSync('src/server/services/OrganizationOwnershipTransferService.ts', 'utf8');
const capabilityCommand = readFileSync('src/server/services/MusicScaleMemberCapabilityCommandService.ts', 'utf8');

const profileRouteStart = server.indexOf("app.put('/api/organizations/:orgId/members/:memberId/profile'");
const profileRouteEnd = server.indexOf("app.post('/api/organizations/:orgId/members/:memberId/role'", profileRouteStart);
assert.ok(profileRouteStart >= 0 && profileRouteEnd > profileRouteStart, 'member profile route must exist');
const profileRoute = server.slice(profileRouteStart, profileRouteEnd);
assert.ok(profileRoute.includes('canManageTenantMembers(actorSystemRole)'), 'profile edits must honor canonical global member authority');
assert.ok(profileRoute.includes('if (!isGlobalAdmin && actorRank < 70)'), 'global authority must bypass local-rank restriction for profile edits');
assert.ok(profileRoute.includes("action: 'organization.member.profile_updated'"), 'profile edits must be audited');

const globalRoleRouteStart = server.indexOf("app.post('/api/admin/users/:userId/role'");
assert.ok(globalRoleRouteStart >= 0, 'canonical global role route must exist');
const globalRoleRoute = server.slice(globalRoleRouteStart, globalRoleRouteStart + 6500);
assert.ok(globalRoleRoute.includes('canChangeSystemRole('), 'global role writes must use the canonical hierarchy');
assert.ok(globalRoleRoute.includes("scope: 'ecosystem'"), 'global role changes must be audited at ecosystem scope');

assert.ok(roleCommand.includes('const actorGlobal = canManageTenantMembers(actorSystemRole)'), 'organization role command must honor CEO/global governance');
assert.ok(roleCommand.includes('resolveRepairableInconsistentRole'), 'organization role command must repair safe active legacy role conflicts');
assert.ok(removalCommand.includes('const actorGlobal = canManageTenantMembers(actorSystemRole)'), 'member removal must honor CEO/global governance');
assert.ok(removalCommand.includes('repairableCanonicalRole'), 'member removal must handle safe repairable legacy role conflicts');
assert.ok(ownershipTransfer.includes('canTransferTenantOwnership(actorSystemRole)'), 'owner changes must honor CEO through the dedicated transfer command');
assert.ok(capabilityCommand.includes('actorGlobal = canManageTenantMembers'), 'member capability changes must honor CEO/global governance');

assert.ok(dashboard.includes('handleUpdateMemberSystemRole'), 'team UI must expose audited ecosystem-role changes');
assert.ok(dashboard.includes('let persistedOrganizationRole = originalRole'), 'team UI must only display the role persisted by the backend');
assert.ok(organizationManager.includes('canManageGlobalGovernance'), 'team UI must gate ecosystem controls from canonical governance policy');
assert.ok(organizationManager.includes("governance.ecosystem_role_aria"), 'ecosystem role control must remain explicit and localized');

assert.ok(removalCommand.includes("OWNER_REMOVAL_REQUIRES_TRANSFER"), 'owner removal must never bypass ownership transfer');
assert.ok(roleCommand.includes("OWNER_ROLE_REQUIRES_TRANSFER"), 'owner role must never be mutated through the generic role command');

console.log('PASS CEO people governance contract');
