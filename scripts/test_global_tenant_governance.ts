import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CANONICAL_GLOBAL_ROLES,
  canManageTenantBilling,
  canManageTenantMembers,
  canManageTenantSettings,
  canTransferTenantOwnership,
} from '../src/lib/permissionService.js';

for (const role of CANONICAL_GLOBAL_ROLES) {
  assert.equal(canManageTenantMembers(role), true, `${role} must manage tenant memberships cross-tenant`);
  assert.equal(canManageTenantBilling(role), true, `${role} must manage tenant billing cross-tenant`);
  assert.equal(canManageTenantSettings(role), true, `${role} must manage tenant settings cross-tenant`);
  assert.equal(canTransferTenantOwnership(role), true, `${role} must transfer tenant ownership through the audited command`);
}

for (const role of ['ecosystem_support', 'owner', 'admin_local', 'member', 'user']) {
  assert.equal(canManageTenantMembers(role), false, `${role} must not inherit global membership governance`);
  assert.equal(canManageTenantBilling(role), false, `${role} must not inherit global billing governance`);
  assert.equal(canManageTenantSettings(role), false, `${role} must not inherit global settings governance`);
  assert.equal(canTransferTenantOwnership(role), false, `${role} must not inherit global ownership-transfer authority`);
}

const roleService = readFileSync('src/server/services/OrganizationRoleCommandService.ts', 'utf8');
const removalService = readFileSync('src/server/services/MemberRemovalCommandService.ts', 'utf8');
const invitationService = readFileSync('src/server/services/InvitationCreationService.ts', 'utf8');
const joinRequestService = readFileSync('src/server/services/JoinRequestCommandService.ts', 'utf8');
const capabilityService = readFileSync('src/server/services/MusicScaleMemberCapabilityCommandService.ts', 'utf8');

for (const [name, source] of [
  ['role command', roleService],
  ['member removal', removalService],
  ['invitation creation', invitationService],
  ['join request', joinRequestService],
  ['MusicScale member capability', capabilityService],
] as const) {
  assert.equal(
    source.includes('canManageTenantMembers'),
    true,
    `${name} must authorize cross-tenant governance through the canonical tenant-members policy`,
  );
}

assert.equal(roleService.includes("governanceScope: actorGlobal ? 'ecosystem_global' : 'organization'"), true);
assert.equal(removalService.includes("governanceScope: actorGlobal ? 'ecosystem_global' : 'organization'"), true);

const transferService = readFileSync('src/server/services/OrganizationOwnershipTransferService.ts', 'utf8');
assert.equal(transferService.includes('canTransferTenantOwnership'), true);
assert.equal(transferService.includes("reasonCode: 'GLOBAL_REASON_REQUIRED'"), true, 'global ownership transfer must require an audit reason');
assert.equal(transferService.includes('ownerUid: newOwnerMemberId'), true, 'ownership must move to the selected tenant member');
assert.equal(transferService.includes('ownerUid: actorUid'), false, 'global operator must never become owner implicitly');
assert.equal(transferService.includes("governanceScope: globalAuthority ? 'ecosystem_global' : 'organization'"), true);
assert.equal(transferService.includes("action: 'organization.ownership.transferred'"), true);

const server = readFileSync('server.ts', 'utf8');
assert.equal(server.includes("app.post('/api/v1/organizations/:organizationId/ownership/transfer'"), true);
assert.equal(server.includes('canManageTenantBilling(systemRole)'), true, 'billing reactivation must honor global tenant billing governance');
assert.equal(server.includes("action: 'organization.billing.reactivated'"), true, 'global billing mutation must be audited');
assert.equal(server.includes("action: 'organization.billing.portal_opened'"), true, 'global billing portal access must be audited');
assert.equal(server.includes('canManageTenantSettings(actorData.systemRole)'), true, 'organization settings must honor global tenant settings governance');

const portalStart = server.indexOf("app.post('/api/v1/billing/portal'");
const portalEnd = server.indexOf("// API Fallback mechanism", portalStart);
assert.ok(portalStart >= 0 && portalEnd > portalStart, 'billing portal route must exist');
const portalRoute = server.slice(portalStart, portalEnd);
assert.equal(
  portalRoute.includes('customerId = userDoc.data()?.stripeCustomerId'),
  false,
  'cross-tenant billing portal must never fall back to the global operator Stripe customer',
);
assert.equal(
  portalRoute.includes("const ownerUid = orgData.ownerUid || orgData.ownerUserId || orgData.ownerId || orgData.owner_user_id || null"),
  true,
  'billing fallback must resolve from the target organization owner',
);

const dashboard = readFileSync('src/pages/Dashboard.tsx', 'utf8');
assert.equal(dashboard.includes('/ownership/transfer'), true, 'dashboard must expose the dedicated ownership-transfer command');
assert.equal(dashboard.includes('ownershipTransferReason.trim().length < 8'), true, 'global transfer UX must require an explicit reason');
assert.equal(dashboard.includes('Sua conta global continuará fora do membership do tenant.'), true, 'UI must make global-vs-tenant identity boundary explicit');

const organizationManager = readFileSync('src/components/OrganizationManager.tsx', 'utf8');
assert.equal(organizationManager.includes('Tornar dono'), true, 'global governance UI must expose deliberate ownership transfer');
assert.equal(
  organizationManager.includes("TABS.filter(t => ['members', 'apps', 'audit'].includes(t.id))"),
  true,
  'ecosystem support must remain outside settings, roles and billing',
);

console.log('PASS global tenant governance contract');
