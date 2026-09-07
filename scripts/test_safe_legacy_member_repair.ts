import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveLegacyMembershipCandidates } from '../src/server/services/TenantBootstrapPlanner.js';

const activeMember = resolveLegacyMembershipCandidates([
  {
    organizationId: 'org1',
    sourcePath: 'organization_members/u1_org1',
    status: 'active',
    role: 'member'
  }
]);
assert.equal(activeMember.ok, true);
if (activeMember.ok) {
  assert.equal(activeMember.memberships.length, 1);
  assert.equal(activeMember.memberships[0].sanitizedRole, 'member');
}

const activeAdmin = resolveLegacyMembershipCandidates([
  {
    organizationId: 'org1',
    sourcePath: 'organization_members/u1_org1',
    status: 'active',
    organizationRole: 'admin'
  }
]);
assert.equal(activeAdmin.ok, true);
if (activeAdmin.ok) {
  assert.equal(activeAdmin.memberships[0].sanitizedRole, 'admin');
}

const revoked = resolveLegacyMembershipCandidates([
  {
    organizationId: 'org1',
    sourcePath: 'organization_members/u1_org1',
    status: 'revoked',
    role: 'member'
  }
]);
assert.equal(revoked.ok, true);
if (revoked.ok) assert.equal(revoked.memberships.length, 0, 'revoked legacy membership must never be restored');

const conflicting = resolveLegacyMembershipCandidates([
  {
    organizationId: 'org1',
    sourcePath: 'organization_members/a',
    status: 'active',
    role: 'member'
  },
  {
    organizationId: 'org1',
    sourcePath: 'organization_members/b',
    status: 'active',
    role: 'admin'
  }
]);
assert.equal(conflicting.ok, false, 'conflicting legacy roles must fail closed');

const server = readFileSync('server.ts', 'utf8');
assert.match(server, /resolveLegacyMembershipCandidates/, 'canonical context must use the hardened legacy resolver');
assert.match(server, /where\('uid', '==', uid\)/, 'legacy lookup must support uid');
assert.match(server, /where\('user_id', '==', uid\)/, 'legacy lookup must support old user_id documents');
assert.match(server, /tenant\.context\.legacy_membership_repaired/, 'successful repair must be audited');
assert.match(server, /permissions:\s*getDefaultPermissions\(role\)/, 'repaired membership must receive canonical RBAC permissions');
assert.match(server, /permissionsVersion:\s*CURRENT_PERMISSIONS_VERSION/, 'repaired membership must receive current permission version');
assert.match(server, /if \(!org \|\| membershipsMap\[orgId\]\) continue;/, 'existing canonical memberships must never be overwritten');
assert.match(server, /if \(!orgIsActive\) continue;/, 'inactive organizations must never be migrated');
assert.equal(
  /legacyMembershipCandidates[\s\S]{0,5000}where\('email'/.test(server),
  false,
  'legacy migration must never infer membership from email'
);

console.log('PASS legacy membership repair: only existing, active, consistent legacy access is promoted to canonical membership');
