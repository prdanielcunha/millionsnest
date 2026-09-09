import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CANONICAL_GLOBAL_ROLES,
  isCanonicalGlobalRole,
  isGlobalPrivilegedRole,
  isLegacyGlobalRole,
  resolveEcosystemPrivilegePolicy
} from '../src/lib/permissionService.js';
import {
  ASSIGNABLE_SYSTEM_ROLES,
  canChangeSystemRole,
  isAssignableSystemRole,
  normalizeLegacySystemRole
} from '../src/lib/roleResolver.js';

assert.deepEqual(
  [...CANONICAL_GLOBAL_ROLES],
  ['ceo', 'global_admin', 'ecosystem_owner', 'founder'],
  'Canonical global role set changed unexpectedly'
);

for (const role of CANONICAL_GLOBAL_ROLES) {
  assert.equal(isCanonicalGlobalRole(role), true, `${role} must be canonical`);
  assert.equal(isGlobalPrivilegedRole(role), true, `${role} must have global privilege`);
  const policy = resolveEcosystemPrivilegePolicy(role);
  assert.equal(policy.hasFullProductEntitlements, true, `${role} must retain full product entitlements`);
  assert.equal(policy.canManageGlobalGovernance, true, `${role} must retain global governance`);
}

assert.equal(isCanonicalGlobalRole('admin'), false, 'legacy admin must never become canonical');
assert.equal(isLegacyGlobalRole('admin'), true, 'legacy admin compatibility must stay explicit');
assert.equal(isGlobalPrivilegedRole('admin'), true, 'legacy admin must remain compatible until live migration');
assert.equal(normalizeLegacySystemRole('admin'), 'global_admin', 'legacy admin assignments must normalize to global_admin');
assert.equal(isAssignableSystemRole('admin'), true, 'legacy admin input must be accepted only through normalization');
assert.equal(ASSIGNABLE_SYSTEM_ROLES.includes('admin' as any), false, 'legacy admin must not be offered as a new role');

assert.equal(isGlobalPrivilegedRole('ecosystem_support'), false, 'support role must not receive global governance');
const supportPolicy = resolveEcosystemPrivilegePolicy('ecosystem_support');
assert.equal(supportPolicy.isEcosystemSupportStaff, true);
assert.equal(supportPolicy.canEnterAnyOrganization, true, 'support must be able to enter any tenant for support');
assert.equal(supportPolicy.canOperateAnyOrganization, true, 'support must have scoped operational tenant access');
assert.equal(supportPolicy.canManageGlobalGovernance, false, 'support must never inherit global governance');
assert.equal(ASSIGNABLE_SYSTEM_ROLES.includes('ecosystem_support'), true, 'support must be assignable as a canonical system role');
assert.equal(canChangeSystemRole('ecosystem_support', 'user', 'global_admin').allowed, false, 'support cannot manage global roles');

assert.equal(canChangeSystemRole('ceo', 'user', 'founder').allowed, true);
assert.equal(canChangeSystemRole('founder', 'user', 'global_admin').allowed, true);
assert.equal(canChangeSystemRole('founder', 'user', 'ceo').allowed, false);
assert.equal(canChangeSystemRole('ecosystem_owner', 'user', 'global_admin').allowed, true);
assert.equal(canChangeSystemRole('ecosystem_owner', 'user', 'founder').allowed, false);
assert.equal(canChangeSystemRole('global_admin', 'user', 'ecosystem_owner').allowed, false);
assert.equal(canChangeSystemRole('admin', 'user', 'global_admin').allowed, true, 'legacy admin must retain its previous admin authority');
assert.equal(canChangeSystemRole('ceo', 'ceo', 'user', true, 1).allowed, false, 'last CEO must remain protected');

const server = readFileSync('server.ts', 'utf8');
assert.equal(server.includes("['ceo', 'admin', 'global_admin']"), false, 'server must not contain the legacy 3-role allowlist');
assert.equal(server.includes("systemRole !== 'ceo' && systemRole !== 'admin' && systemRole !== 'global_admin'"), false);
assert.equal(server.includes("systemRole === 'ceo' || systemRole === 'admin' || systemRole === 'global_admin'"), false);

const dashboard = readFileSync('src/pages/Dashboard.tsx', 'utf8');
assert.equal(
  dashboard.includes('if (!activeContextOrgId && !canCrossTenantAccess)'),
  true,
  'support-only accounts must reach the cross-tenant organization selector without a local membership'
);
assert.equal(
  dashboard.includes('/api/admin/organizations/${encodeURIComponent(adminSelectedOrgId)}/access-session'),
  true,
  'cross-tenant entry must be audited through the authenticated server endpoint'
);
assert.equal(
  dashboard.includes("source: isEcosystemSupport ? 'ecosystem_support' : 'global_admin'"),
  false,
  'cross-tenant session audit must not rely on client-authored Firestore logs'
);

assert.equal(
  server.includes("app.post('/api/admin/organizations/:orgId/access-session'"),
  true,
  'server must expose the audited cross-tenant access-session endpoint'
);
assert.equal(
  server.includes('if (!canEnterAnyOrganization(actorData.systemRole))'),
  true,
  'access-session endpoint must authorize from canonical ecosystem policy'
);
assert.equal(
  server.includes("const accessMode = privilegePolicy.isEcosystemSupportStaff ? 'support' : 'administrative'"),
  true,
  'access-session audit must preserve support vs governance mode'
);

const organizationManager = readFileSync('src/components/OrganizationManager.tsx', 'utf8');
assert.equal(
  organizationManager.includes("isCrossTenantSupportSession = isEcosystemSupport && Boolean(adminSelectedOrgId)"),
  true,
  'organization manager must distinguish scoped support sessions'
);
assert.equal(
  organizationManager.includes("TABS.filter(t => ['members', 'apps', 'audit'].includes(t.id))"),
  true,
  'support tenant view must exclude settings, roles and billing tabs'
);
assert.equal(
  organizationManager.includes("{!isEcosystemSupport && ("),
  true,
  'support app view must hide plan and billing controls'
);

const ecosystemLauncher = readFileSync('src/lib/ecosystemLauncher.ts', 'utf8');
assert.equal(
  ecosystemLauncher.includes("String(profile?.systemRole || '').trim().toLowerCase() === 'ecosystem_support'"),
  true,
  'MusicScale launcher must mark canonical ecosystem_support handoffs explicitly'
);
assert.equal(
  ecosystemLauncher.includes("body: JSON.stringify({ appId: moduleKey, orgId: expectedOrganizationId, supportMode: isSupportMode })"),
  true,
  'support-mode hint must travel through the handoff request for server verification'
);

const ecosystemAdmin = readFileSync('src/pages/EcosystemAdmin.tsx', 'utf8');
assert.equal(ecosystemAdmin.includes('<option value="admin">Tornar Admin Global</option>'), false, 'UI must not create new legacy admin assignments');
assert.equal(ecosystemAdmin.includes('ASSIGNABLE_SYSTEM_ROLES'), true, 'UI must use canonical assignable roles');

const dataConsole = readFileSync('src/pages/EcosystemDataConsole.tsx', 'utf8');
assert.equal(dataConsole.includes("['ceo', 'admin', 'global_admin']"), false);

const shell = readFileSync('src/components/EcosystemShell.tsx', 'utf8');
assert.equal(shell.includes("['ceo', 'admin', 'global_admin']"), false);

console.log('PASS global role canonicalization contract');
