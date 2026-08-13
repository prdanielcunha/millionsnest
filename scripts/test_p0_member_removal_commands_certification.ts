import { createAssertions, clearInvitationEmulator, invokeHandler, requireInvitationEmulator } from './helpers/p0HandlerTestHarness.js';
import { removeOrganizationMember } from '../src/server/services/MemberRemovalCommandService.js';

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
async function seedOrg(id: string, ownerUid = 'owner-1', status = 'active', extra: Record<string, unknown> = {}) {
  await db.doc(`organizations/${id}`).set({ id, ownerUid, status, ...extra });
}
async function seedUser(uid: string, data: Record<string, unknown> = {}) {
  await db.doc(`users/${uid}`).set({ uid, ...data });
}
async function seedMember(orgId: string, uid: string, role = 'member', status = 'active', extra: Record<string, unknown> = {}) {
  await db.doc(`organizations/${orgId}/members/${uid}`).set({ uid, organizationId: orgId, role, organizationRole: role, status, createdAt: new Date('2026-01-01T00:00:00Z'), ...extra });
}
async function seedLegacy(orgId: string, uid: string, role = 'member') {
  const data = { uid, organizationId: orgId, role, organizationRole: role, status: 'active' };
  await db.doc(`organization_members/${uid}_${orgId}`).set(data);
  await db.doc(`organization_members/${orgId}_${uid}`).set(data);
}
async function call(actor: string | undefined, orgId = 'org-1', memberId = 'target-1') {
  return invokeHandler((req, res) => removeOrganizationMember(req, res, deps), {
    bearer: actor,
    params: { organizationId: orgId, memberId }
  });
}
async function baseOwnerTarget(targetRole = 'member') {
  await seedOrg('org-1', 'owner-1');
  await seedUser('owner-1');
  await seedMember('org-1', 'owner-1', 'owner');
  await seedUser('target-1', { organizations: ['org-1'], activeOrganizationId: 'org-1', organizationId: 'org-1', primaryOrganizationId: 'org-1' });
  await seedMember('org-1', 'target-1', targetRole);
  await seedLegacy('org-1', 'target-1', targetRole);
}
async function auditCount(orgId = 'org-1') {
  const snap = await db.collection(`organizations/${orgId}/audit_logs`).where('action', '==', 'organization.member.removed').get();
  return snap.size;
}

await reset();
let result = await call(undefined);
assert('01 missing bearer denied', result.statusCode === 401 && result.body.reasonCode === 'UNAUTHENTICATED');
result = await call('invalid');
assert('02 invalid bearer denied', result.statusCode === 401 && result.body.reasonCode === 'UNAUTHENTICATED');
result = await call('actor', '../bad', 'target');
assert('03 invalid organization path denied', result.statusCode === 400 && result.body.reasonCode === 'INVALID_REQUEST_PATH');
result = await call('same-user', 'org-1', 'same-user');
assert('04 self removal denied before mutation', result.statusCode === 403 && result.body.reasonCode === 'SELF_REMOVAL_REQUIRES_LEAVE_COMMAND');

await reset();
await seedOrg('org-1'); await seedUser('actor'); await seedMember('org-1', 'actor', 'member'); await seedUser('target-1'); await seedMember('org-1', 'target-1');
result = await call('actor');
assert('05 common canonical member denied', result.statusCode === 403 && result.body.reasonCode === 'PERMISSION_DENIED');

await reset();
await seedOrg('org-1'); await seedUser('actor', { systemRole: 'admin' }); await seedUser('target-1'); await seedMember('org-1', 'target-1');
result = await call('actor');
assert('06 systemRole admin is not global authority', result.statusCode === 403 && result.body.reasonCode === 'PERMISSION_DENIED');

await reset();
await seedOrg('org-1'); await seedUser('actor', { systemRole: 'global_support' }); await seedUser('target-1'); await seedMember('org-1', 'target-1');
result = await call('actor');
assert('07 global_support is not global authority', result.statusCode === 403 && result.body.reasonCode === 'PERMISSION_DENIED');

for (const [index, role] of ['ceo', 'global_admin', 'ecosystem_owner', 'founder'].entries()) {
  await reset();
  await seedOrg('org-1'); await seedUser('actor', { systemRole: role }); await seedUser('target-1'); await seedMember('org-1', 'target-1');
  result = await call('actor');
  assert(`${String(8 + index).padStart(2, '0')} exact global ${role} can remove non-owner`, result.statusCode === 200 && result.body.reasonCode === 'MEMBER_REMOVED');
}

await reset();
await baseOwnerTarget();
result = await call('owner-1');
assert('12 organization metadata owner can remove member', result.statusCode === 200 && result.body.reasonCode === 'MEMBER_REMOVED');

await reset();
await seedOrg('org-1', 'metadata-owner'); await seedUser('actor'); await seedMember('org-1', 'actor', 'owner'); await seedUser('target-1'); await seedMember('org-1', 'target-1', 'admin');
result = await call('actor');
assert('13 canonical owner can remove admin', result.statusCode === 200 && result.body.reasonCode === 'MEMBER_REMOVED');

await reset();
await seedOrg('org-1', 'metadata-owner'); await seedUser('actor'); await seedMember('org-1', 'actor', 'admin'); await seedUser('target-1'); await seedMember('org-1', 'target-1', 'manager');
result = await call('actor');
assert('14 canonical admin can remove manager/member tier', result.statusCode === 200 && result.body.reasonCode === 'MEMBER_REMOVED');

await reset();
await seedOrg('org-1', 'metadata-owner'); await seedUser('actor'); await seedMember('org-1', 'actor', 'admin'); await seedUser('target-1'); await seedMember('org-1', 'target-1', 'admin');
result = await call('actor');
assert('15 admin cannot remove peer admin', result.statusCode === 409 && result.body.reasonCode === 'TARGET_ROLE_PROTECTED');

await reset();
await seedOrg('org-1', 'metadata-owner'); await seedUser('actor', { systemRole: 'ceo' }); await seedUser('target-1'); await seedMember('org-1', 'target-1', 'owner');
result = await call('actor');
assert('16 owner role cannot be removed even by global', result.statusCode === 409 && result.body.reasonCode === 'OWNER_REMOVAL_REQUIRES_TRANSFER');

await reset();
await seedOrg('org-1', 'target-1'); await seedUser('actor', { systemRole: 'ceo' }); await seedUser('target-1'); await seedMember('org-1', 'target-1', 'member');
result = await call('actor');
assert('17 organization metadata owner cannot be removed without transfer', result.statusCode === 409 && result.body.reasonCode === 'OWNER_REMOVAL_REQUIRES_TRANSFER');

await reset();
await seedOrg('org-1', 'owner-1'); await seedUser('owner-1'); await seedMember('org-1', 'owner-1', 'owner'); await seedUser('target-1'); await seedMember('org-1', 'target-1', 'member', 'inactive');
result = await call('owner-1');
assert('18 inactive canonical membership fails closed', result.statusCode === 409 && result.body.reasonCode === 'MEMBERSHIP_INACTIVE');

await reset();
await seedOrg('org-1', 'owner-1'); await seedUser('owner-1'); await seedMember('org-1', 'owner-1', 'owner'); await seedUser('target-1');
await db.doc('organizations/org-1/members/target-1').set({ uid: 'target-1', organizationId: 'org-1', role: 'member', organizationRole: 'admin', status: 'active' });
result = await call('owner-1');
assert('19 inconsistent canonical role fails closed', result.statusCode === 409 && result.body.reasonCode === 'MEMBERSHIP_STATE_INCONSISTENT');

await reset();
await seedOrg('org-1', 'metadata-owner'); await seedUser('legacy-actor'); await seedLegacy('org-1', 'legacy-actor', 'owner'); await seedUser('target-1'); await seedMember('org-1', 'target-1');
result = await call('legacy-actor');
assert('20 legacy-only actor grants no removal authority', result.statusCode === 403 && result.body.reasonCode === 'PERMISSION_DENIED');

await reset();
await seedOrg('org-1', 'metadata-owner'); await seedOrg('org-2', 'metadata-owner-2'); await seedUser('actor'); await seedMember('org-2', 'actor', 'owner'); await seedUser('target-1'); await seedMember('org-1', 'target-1');
result = await call('actor', 'org-1', 'target-1');
assert('21 cross-tenant owner membership grants no authority', result.statusCode === 403 && result.body.reasonCode === 'PERMISSION_DENIED');

await reset();
await baseOwnerTarget();
await db.doc('organizations/org-1/musicscale_members/target-1').set({ uid: 'target-1', organizationId: 'org-1', roleId: 'music-role' });
result = await call('owner-1');
const canonicalAfter = await db.doc('organizations/org-1/members/target-1').get();
const legacyAAfter = await db.doc('organization_members/target-1_org-1').get();
const legacyBAfter = await db.doc('organization_members/org-1_target-1').get();
const musicProjectionAfter = await db.doc('organizations/org-1/musicscale_members/target-1').get();
assert('22 successful remove deletes canonical membership', result.body.reasonCode === 'MEMBER_REMOVED' && !canonicalAfter.exists);
assert('23 successful remove deletes uid_org legacy projection', !legacyAAfter.exists);
assert('24 successful remove deletes org_uid legacy projection', !legacyBAfter.exists);
assert('25 Hub removal does not mutate MusicScale domain projection', musicProjectionAfter.exists && musicProjectionAfter.data()?.roleId === 'music-role');

await reset();
await baseOwnerTarget();
await seedOrg('org-2', 'owner-2'); await seedMember('org-2', 'target-1', 'member');
await seedUser('target-1', { organizations: ['org-1', 'org-2'], activeOrganizationId: 'org-1', organizationId: 'org-1', primaryOrganizationId: 'org-2' });
result = await call('owner-1');
let targetUser = (await db.doc('users/target-1').get()).data()!;
assert('26 removal repairs organizations array from remaining canonical memberships', JSON.stringify(targetUser.organizations) === JSON.stringify(['org-2']));
assert('27 removal moves active context to valid remaining primary', targetUser.activeOrganizationId === 'org-2' && targetUser.organizationId === 'org-2' && targetUser.primaryOrganizationId === 'org-2');

await reset();
await baseOwnerTarget();
result = await call('owner-1');
targetUser = (await db.doc('users/target-1').get()).data()!;
assert('28 removal clears active context when no membership remains', !('activeOrganizationId' in targetUser) && !('organizationId' in targetUser) && !('primaryOrganizationId' in targetUser));
assert('29 removal leaves exact empty canonical organizations list', Array.isArray(targetUser.organizations) && targetUser.organizations.length === 0);

await reset();
await baseOwnerTarget();
await db.doc('tenantBootstrapLocks/target-1').set({ uid: 'target-1', organizationId: 'org-1', status: 'completed' });
result = await call('owner-1');
assert('30 stale bootstrap lock for removed org is deleted', !(await db.doc('tenantBootstrapLocks/target-1').get()).exists);

await reset();
await baseOwnerTarget();
await db.doc('tenantBootstrapLocks/target-1').set({ uid: 'target-1', organizationId: 'org-other', status: 'completed' });
result = await call('owner-1');
assert('31 unrelated bootstrap lock is preserved', (await db.doc('tenantBootstrapLocks/target-1').get()).exists);

await reset();
await baseOwnerTarget();
result = await call('owner-1');
const firstAuditCount = await auditCount();
const replay = await call('owner-1');
const replayAuditCount = await auditCount();
assert('32 first removal writes one audit', result.body.reasonCode === 'MEMBER_REMOVED' && firstAuditCount === 1);
assert('33 replay is deterministic ALREADY_REMOVED', replay.statusCode === 200 && replay.body.reasonCode === 'ALREADY_REMOVED');
assert('34 replay does not duplicate first-removal audit', replayAuditCount === 1);

await reset();
await baseOwnerTarget();
const concurrent = await Promise.all([call('owner-1'), call('owner-1')]);
const concurrentReasons = concurrent.map(item => item.body.reasonCode).sort();
assert('35 concurrent removals produce one remove and one replay', JSON.stringify(concurrentReasons) === JSON.stringify(['ALREADY_REMOVED', 'MEMBER_REMOVED']));
assert('36 concurrent removals create exactly one removal audit', await auditCount() === 1);

await reset();
await seedOrg('org-1', 'owner-1'); await seedUser('owner-1'); await seedMember('org-1', 'owner-1', 'owner');
await seedUser('target-1', { organizations: ['org-1'], activeOrganizationId: 'org-1', organizationId: 'org-1', primaryOrganizationId: 'org-1' });
await seedLegacy('org-1', 'target-1');
result = await call('owner-1');
targetUser = (await db.doc('users/target-1').get()).data()!;
assert('37 canonical-absent stale legacy cleanup returns ALREADY_REMOVED', result.statusCode === 200 && result.body.reasonCode === 'ALREADY_REMOVED');
assert('38 canonical-absent replay cleans stale legacy mirrors', !(await db.doc('organization_members/target-1_org-1').get()).exists && !(await db.doc('organization_members/org-1_target-1').get()).exists);
assert('39 canonical-absent replay repairs stale user organization context', targetUser.organizations.length === 0 && !targetUser.activeOrganizationId);
assert('40 canonical-absent replay does not invent removal audit', await auditCount() === 0);

await reset();
await seedOrg('org-1', 'owner-1', 'inactive'); await seedUser('owner-1'); await seedMember('org-1', 'owner-1', 'owner'); await seedUser('target-1'); await seedMember('org-1', 'target-1');
result = await call('owner-1');
assert('41 inactive organization blocks removal mutation', result.statusCode === 409 && result.body.reasonCode === 'ORGANIZATION_INACTIVE');

await reset();
await seedUser('actor', { systemRole: 'ceo' });
result = await call('actor');
assert('42 missing organization returns 404', result.statusCode === 404 && result.body.reasonCode === 'ORGANIZATION_NOT_FOUND');

await reset();
await seedOrg('org-1', 'owner-1'); await seedUser('owner-1'); await seedMember('org-1', 'owner-1', 'owner'); await seedMember('org-1', 'target-1'); await seedLegacy('org-1', 'target-1');
result = await call('owner-1');
assert('43 missing target user document does not block canonical membership removal', result.statusCode === 200 && result.body.reasonCode === 'MEMBER_REMOVED' && !(await db.doc('organizations/org-1/members/target-1').get()).exists);

await reset();
await seedOrg('org-1', 'owner-1'); await seedUser('owner-1'); await seedMember('org-1', 'owner-1', 'owner'); await seedUser('target-1'); await seedMember('org-1', 'target-1', 'viewer');
result = await call('owner-1');
assert('44 owner can remove viewer tier', result.statusCode === 200 && result.body.reasonCode === 'MEMBER_REMOVED');

finish();
