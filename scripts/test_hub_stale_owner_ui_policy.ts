import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getMemberRoleUiPolicy } from '../src/lib/organizationMemberRoleUiPolicy.js';

const ceoRepairsStaleOwner = getMemberRoleUiPolicy({
  actorUid: 'ceo-1',
  actorIsGlobalPrivileged: true,
  actorOrganizationRole: 'member',
  targetUid: 'legacy-owner',
  targetOrganizationRole: 'owner',
  authoritativeOwnerUid: 'real-owner',
});
assert.equal(ceoRepairsStaleOwner.canEdit, true, 'CEO/global actor must be able to open stale-owner role controls');

const ownerProjectionRepairsStaleOwner = getMemberRoleUiPolicy({
  actorUid: 'owner-1',
  actorIsGlobalPrivileged: false,
  actorOrganizationRole: 'owner',
  targetUid: 'legacy-owner',
  targetOrganizationRole: 'owner',
  authoritativeOwnerUid: '',
});
assert.equal(
  ownerProjectionRepairsStaleOwner.canEdit,
  true,
  'owner membership must not be client-blocked when organization owner metadata projection is stale/missing'
);

const metadataOwnerRepairsStaleOwner = getMemberRoleUiPolicy({
  actorUid: 'owner-1',
  actorIsGlobalPrivileged: false,
  actorOrganizationRole: 'member',
  actorIsAuthoritativeOwner: true,
  targetUid: 'legacy-owner',
  targetOrganizationRole: 'owner',
  authoritativeOwnerUid: 'owner-1',
});
assert.equal(metadataOwnerRepairsStaleOwner.canEdit, true, 'authoritative metadata owner must be able to repair stale owner');

const globalOwnerCanReachCanonicalRepair = getMemberRoleUiPolicy({
  actorUid: 'ceo-1',
  actorIsGlobalPrivileged: true,
  actorOrganizationRole: 'owner',
  targetUid: 'wrong-authoritative-owner',
  targetOrganizationRole: 'owner',
  authoritativeOwnerUid: 'wrong-authoritative-owner',
});
assert.equal(globalOwnerCanReachCanonicalRepair.canEdit, true, 'CEO who is also an owner member must reach explicit canonical ownership repair');

const globalNonOwnerCannotRepairCanonicalOwner = getMemberRoleUiPolicy({
  actorUid: 'global-1',
  actorIsGlobalPrivileged: true,
  actorOrganizationRole: 'admin',
  targetUid: 'real-owner',
  targetOrganizationRole: 'owner',
  authoritativeOwnerUid: 'real-owner',
});
assert.equal(globalNonOwnerCannotRepairCanonicalOwner.canEdit, false, 'global actor without owner membership cannot repair canonical ownership');

const adminCannotEditOwner = getMemberRoleUiPolicy({
  actorUid: 'admin-1',
  actorOrganizationRole: 'admin',
  targetUid: 'legacy-owner',
  targetOrganizationRole: 'owner',
  authoritativeOwnerUid: 'real-owner',
});
assert.equal(adminCannotEditOwner.canEdit, false, 'organization admin cannot repair owner roles');

const adminCanEditMember = getMemberRoleUiPolicy({
  actorUid: 'admin-1',
  actorOrganizationRole: 'admin',
  targetUid: 'member-1',
  targetOrganizationRole: 'member',
  authoritativeOwnerUid: 'real-owner',
});
assert.equal(adminCanEditMember.canEdit, true, 'organization admin can manage lower roles');

const selfChangeBlocked = getMemberRoleUiPolicy({
  actorUid: 'owner-1',
  actorOrganizationRole: 'owner',
  targetUid: 'owner-1',
  targetOrganizationRole: 'owner',
  authoritativeOwnerUid: 'owner-1',
});
assert.equal(selfChangeBlocked.canEdit, false, 'self role change remains blocked');

const ordinaryMemberBlocked = getMemberRoleUiPolicy({
  actorUid: 'member-1',
  actorOrganizationRole: 'member',
  targetUid: 'member-2',
  targetOrganizationRole: 'member',
  authoritativeOwnerUid: 'owner-1',
});
assert.equal(ordinaryMemberBlocked.canEdit, false, 'ordinary members cannot manage organization roles');

const organizationManager = readFileSync('src/components/OrganizationManager.tsx', 'utf8');
const dashboard = readFileSync('src/pages/Dashboard.tsx', 'utf8');
const service = readFileSync('src/server/services/OrganizationRoleCommandService.ts', 'utf8');

assert.match(organizationManager, /getMemberRoleUiPolicy/, 'inline selector must use centralized UI policy');
assert.match(dashboard, /getMemberRoleUiPolicy/, 'member edit modal must use centralized UI policy');
assert.match(service, /organizationOwnerMatches\(organization, memberId\)/, 'generic role command must still protect authoritative owner target');
assert.match(service, /actorGlobal \|\| actorMetadataOwner/, 'generic role command must remain authoritative for stale-owner repair');
assert.match(dashboard, /\/ownership\/repair/, 'Dashboard must route canonical owner conflicts through explicit ownership repair');

console.log('PASS Hub stale-owner UI policy: CEO/owner can reach repair action while server keeps true owner and tenant authority protected');
