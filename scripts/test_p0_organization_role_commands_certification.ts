import { createAssertions, clearInvitationEmulator, invokeHandler, requireInvitationEmulator } from './helpers/p0HandlerTestHarness.js';
import { updateOrganizationMemberRole } from '../src/server/services/OrganizationRoleCommandService.js';
import { CURRENT_PERMISSIONS_VERSION, getDefaultPermissions } from '../src/lib/rbac.js';

const db = requireInvitationEmulator();
const { assert, finish } = createAssertions();
const deps = {
  verifyIdToken: async (token: string) => {
    if (token === 'invalid') throw new Error('invalid');
    return { uid: token };
  },
  getFirestore: () => db
};

async function reset() { await clearInvitationEmulator(); }
async function seedOrg(id = 'org-1', ownerUid = 'owner-1', status = 'active') {
  await db.doc(`organizations/${id}`).set({ id, ownerUid, status });
}
async function seedUser(uid: string, data: Record<string, unknown> = {}) {
  await db.doc(`users/${uid}`).set({ uid, ...data });
}
async function seedMember(orgId: string, uid: string, role = 'member', status = 'active') {
  await db.doc(`organizations/${orgId}/members/${uid}`).set({ uid, organizationId: orgId, role, organizationRole: role, status });
}
async function call(actor: string | undefined, newRole: unknown, orgId = 'org-1', memberId = 'target-1', legacyBody = false) {
  return invokeHandler((req, res) => updateOrganizationMemberRole(req, res, deps), {
    bearer: actor,
    params: legacyBody ? { orgId, memberId } : { organizationId: orgId, memberId },
    body: legacyBody ? { newRole } : { organizationRole: newRole }
  });
}
async function auditCount() {
  const snap = await db.collection('organizations/org-1/audit_logs').where('action', '==', 'organization.member.role_updated').get();
  return snap.size;
}

await reset();
let r = await call(undefined, 'member');
assert('01 missing bearer denied', r.statusCode === 401 && r.body.reasonCode === 'UNAUTHENTICATED');
r = await call('invalid', 'member');
assert('02 invalid bearer denied', r.statusCode === 401 && r.body.reasonCode === 'UNAUTHENTICATED');
r = await call('actor', 'member', '../bad');
assert('03 unsafe path denied', r.statusCode === 400 && r.body.reasonCode === 'INVALID_REQUEST_PATH');
r = await call('same', 'member', 'org-1', 'same');
assert('04 self role change denied', r.statusCode === 403 && r.body.reasonCode === 'SELF_ROLE_CHANGE_DENIED');
r = await call('actor', 'leader');
assert('05 legacy/noncanonical role rejected', r.statusCode === 400 && r.body.reasonCode === 'INVALID_ORGANIZATION_ROLE');
r = await call('actor', 'owner');
assert('06 owner assignment requires transfer command', r.statusCode === 409 && r.body.reasonCode === 'OWNER_ROLE_REQUIRES_TRANSFER');

await reset();
await seedOrg(); await seedUser('member-actor'); await seedMember('org-1', 'member-actor', 'member'); await seedUser('target-1'); await seedMember('org-1', 'target-1', 'member');
r = await call('member-actor', 'member');
assert('07 unauthorized same-role replay is still denied', r.statusCode === 403 && r.body.reasonCode === 'PERMISSION_DENIED');

await reset();
await seedOrg(); await seedUser('actor', { systemRole: 'admin' }); await seedUser('target-1'); await seedMember('org-1', 'target-1', 'member');
r = await call('actor', 'viewer');
assert('08 systemRole admin is not global', r.statusCode === 403 && r.body.reasonCode === 'PERMISSION_DENIED');

for (const [i, role] of ['ceo', 'global_admin', 'ecosystem_owner', 'founder'].entries()) {
  await reset();
  await seedOrg(); await seedUser('actor', { systemRole: role }); await seedUser('target-1'); await seedMember('org-1', 'target-1', 'member');
  r = await call('actor', 'admin');
  assert(`${String(9 + i).padStart(2, '0')} exact global ${role} can assign admin`, r.statusCode === 200 && r.body.reasonCode === 'ROLE_UPDATED' && r.body.organizationRole === 'admin');
}

await reset();
await seedOrg('org-1', 'owner-1'); await seedUser('owner-1'); await seedMember('org-1', 'owner-1', 'owner'); await seedUser('target-1'); await seedMember('org-1', 'target-1', 'member');
r = await call('owner-1', 'admin');
assert('13 canonical/metadata owner can assign admin', r.statusCode === 200 && r.body.organizationRole === 'admin');

await reset();
await seedOrg('org-1', 'metadata-owner'); await seedUser('actor'); await seedMember('org-1', 'actor', 'admin'); await seedUser('target-1'); await seedMember('org-1', 'target-1', 'member');
r = await call('actor', 'manager');
assert('14 admin can assign manager', r.statusCode === 200 && r.body.organizationRole === 'manager');

await reset();
await seedOrg('org-1', 'metadata-owner'); await seedUser('actor'); await seedMember('org-1', 'actor', 'admin'); await seedUser('target-1'); await seedMember('org-1', 'target-1', 'member');
r = await call('actor', 'admin');
assert('15 admin cannot grant admin', r.statusCode === 409 && r.body.reasonCode === 'ROLE_ASSIGNMENT_NOT_ALLOWED');

await reset();
await seedOrg('org-1', 'metadata-owner'); await seedUser('actor'); await seedMember('org-1', 'actor', 'admin'); await seedUser('target-1'); await seedMember('org-1', 'target-1', 'admin');
r = await call('actor', 'member');
assert('16 admin cannot alter peer admin', r.statusCode === 409 && r.body.reasonCode === 'TARGET_ROLE_PROTECTED');

await reset();
await seedOrg('org-1', 'target-1'); await seedUser('actor', { systemRole: 'ceo' }); await seedUser('target-1'); await seedMember('org-1', 'target-1', 'member');
r = await call('actor', 'viewer');
assert('17 metadata owner target requires ownership transfer', r.statusCode === 409 && r.body.reasonCode === 'OWNER_ROLE_REQUIRES_TRANSFER');

await reset();
await seedOrg('org-1', 'owner-1'); await seedUser('owner-1'); await seedMember('org-1', 'owner-1', 'owner'); await seedUser('target-1'); await seedMember('org-1', 'target-1', 'owner');
r = await call('owner-1', 'member');
assert('18 canonical owner target cannot be demoted by generic role command', r.statusCode === 409 && r.body.reasonCode === 'OWNER_ROLE_REQUIRES_TRANSFER');

await reset();
await seedOrg('org-1', 'owner-1'); await seedUser('owner-1'); await seedMember('org-1', 'owner-1', 'owner'); await seedUser('target-1'); await seedMember('org-1', 'target-1', 'member', 'inactive');
r = await call('owner-1', 'viewer');
assert('19 inactive membership fails closed', r.statusCode === 409 && r.body.reasonCode === 'MEMBERSHIP_INACTIVE');

await reset();
await seedOrg('org-1', 'owner-1'); await seedUser('owner-1'); await seedMember('org-1', 'owner-1', 'owner'); await seedUser('target-1');
await db.doc('organizations/org-1/members/target-1').set({ uid: 'target-1', organizationId: 'org-1', role: 'member', organizationRole: 'admin', status: 'active' });
r = await call('owner-1', 'viewer');
assert('20 inconsistent canonical membership fails closed', r.statusCode === 409 && r.body.reasonCode === 'MEMBERSHIP_STATE_INCONSISTENT');

await reset();
await seedOrg('org-1', 'owner-1'); await seedUser('owner-1'); await seedMember('org-1', 'owner-1', 'owner'); await seedUser('target-1');
r = await call('owner-1', 'viewer');
assert('21 target must have canonical membership', r.statusCode === 404 && r.body.reasonCode === 'MEMBERSHIP_NOT_FOUND');

await reset();
await seedOrg('org-1', 'metadata-owner'); await seedUser('legacy-actor'); await db.doc('organization_members/legacy-actor_org-1').set({ uid: 'legacy-actor', organizationId: 'org-1', role: 'owner', organizationRole: 'owner', status: 'active' }); await seedUser('target-1'); await seedMember('org-1', 'target-1', 'member');
r = await call('legacy-actor', 'viewer');
assert('22 legacy-only authority denied', r.statusCode === 403 && r.body.reasonCode === 'PERMISSION_DENIED');

await reset();
await seedOrg('org-1', 'owner-1'); await seedOrg('org-2', 'actor'); await seedUser('actor'); await seedMember('org-2', 'actor', 'owner'); await seedUser('target-1'); await seedMember('org-1', 'target-1', 'member');
r = await call('actor', 'viewer');
assert('23 cross-tenant owner membership grants no authority', r.statusCode === 403 && r.body.reasonCode === 'PERMISSION_DENIED');

await reset();
await seedOrg('org-1', 'owner-1'); await seedUser('owner-1'); await seedMember('org-1', 'owner-1', 'owner'); await seedUser('target-1'); await seedMember('org-1', 'target-1', 'member');
r = await call('owner-1', 'manager');
const canonical = (await db.doc('organizations/org-1/members/target-1').get()).data()!;
const legacyA = (await db.doc('organization_members/target-1_org-1').get()).data()!;
const legacyB = (await db.doc('organization_members/org-1_target-1').get()).data()!;
assert('24 canonical role updated atomically', canonical.role === 'manager' && canonical.organizationRole === 'manager');
assert('25 canonical permissions use current defaults', canonical.permissionsVersion === CURRENT_PERMISSIONS_VERSION && JSON.stringify(canonical.permissions) === JSON.stringify(getDefaultPermissions('manager')));
assert('26 uid_org compatibility projection matches canonical role', legacyA.role === 'manager' && legacyA.organizationRole === 'manager' && legacyA.status === 'active');
assert('27 org_uid compatibility projection matches canonical role', legacyB.role === 'manager' && legacyB.organizationRole === 'manager' && legacyB.status === 'active');
assert('28 role update does not add satellite role fields', !('roleId' in canonical) && !('musicscaleRole' in canonical) && !('ministryFunction' in canonical));
assert('29 role update writes exactly one audit transition', await auditCount() === 1);

r = await call('owner-1', 'manager');
assert('30 same-role replay returns ALREADY_ROLE', r.statusCode === 200 && r.body.reasonCode === 'ALREADY_ROLE');
assert('31 same-role replay writes no duplicate audit', await auditCount() === 1);

await reset();
await seedOrg('org-1', 'owner-1'); await seedUser('owner-1'); await seedMember('org-1', 'owner-1', 'owner'); await seedUser('target-1'); await seedMember('org-1', 'target-1', 'member');
const concurrent = await Promise.all([call('owner-1', 'viewer'), call('owner-1', 'viewer')]);
assert('32 same-role concurrency produces one update and one replay', JSON.stringify(concurrent.map(x => x.body.reasonCode).sort()) === JSON.stringify(['ALREADY_ROLE', 'ROLE_UPDATED']));
assert('33 same-role concurrency emits one audit', await auditCount() === 1);

await reset();
await seedOrg('org-1', 'owner-1'); await seedUser('owner-1'); await seedMember('org-1', 'owner-1', 'owner'); await seedUser('target-1'); await seedMember('org-1', 'target-1', 'member');
r = await call('owner-1', 'viewer', 'org-1', 'target-1', true);
assert('34 legacy route body newRole delegates to same canonical policy', r.statusCode === 200 && r.body.reasonCode === 'ROLE_UPDATED' && r.body.organizationRole === 'viewer');

await reset();
await seedOrg('org-1', 'owner-1', 'inactive'); await seedUser('owner-1'); await seedMember('org-1', 'owner-1', 'owner'); await seedUser('target-1'); await seedMember('org-1', 'target-1', 'member');
r = await call('owner-1', 'viewer');
assert('35 inactive organization blocks role change', r.statusCode === 409 && r.body.reasonCode === 'ORGANIZATION_INACTIVE');

finish();
