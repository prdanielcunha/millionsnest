import { createAssertions, clearInvitationEmulator, invokeHandler, requireInvitationEmulator } from './helpers/p0HandlerTestHarness.js';
import { repairOrganizationOwnership } from '../src/server/services/OrganizationOwnershipRepairService.js';
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

async function reset() {
  await clearInvitationEmulator();
}

async function seedOrg(ownerUid = 'wrong-owner') {
  await db.doc('organizations/org-1').set({
    id: 'org-1',
    name: 'Org 1',
    ownerUid,
    ownerUserId: ownerUid,
    ownerId: ownerUid,
    owner_user_id: ownerUid,
    status: 'active'
  });
}

async function seedUser(uid: string, data: Record<string, unknown> = {}) {
  await db.doc(`users/${uid}`).set({ uid, ...data });
}

async function seedMember(uid: string, role: string) {
  await db.doc(`organizations/org-1/members/${uid}`).set({
    uid,
    organizationId: 'org-1',
    role,
    organizationRole: role,
    status: 'active'
  });
}

async function call(actor: string | undefined, targetMemberId = 'wrong-owner', targetRole = 'member') {
  return invokeHandler((req, res) => repairOrganizationOwnership(req, res, deps), {
    bearer: actor,
    params: { organizationId: 'org-1' },
    body: { targetMemberId, targetRole }
  });
}

await reset();
let r = await call(undefined);
assert('01 unauthenticated denied', r.statusCode === 401 && r.body.reasonCode === 'UNAUTHENTICATED');

await reset();
await seedOrg();
await seedUser('ceo-owner', { systemRole: 'user' });
await seedMember('ceo-owner', 'owner');
await seedUser('wrong-owner');
await seedMember('wrong-owner', 'owner');
r = await call('ceo-owner');
assert('02 ordinary owner membership alone cannot repair authoritative ownership', r.statusCode === 403 && r.body.reasonCode === 'GLOBAL_AUTHORITY_REQUIRED');

await reset();
await seedOrg();
await seedUser('ceo-owner', { systemRole: 'ceo', email: 'ceo@example.com', displayName: 'CEO' });
await seedMember('ceo-owner', 'admin');
await seedUser('wrong-owner');
await seedMember('wrong-owner', 'owner');
r = await call('ceo-owner');
assert('03 canonical global actor must also be owner member', r.statusCode === 403 && r.body.reasonCode === 'OWNER_MEMBERSHIP_REQUIRED');

await reset();
await seedOrg();
await seedUser('ceo-owner', { systemRole: 'ceo', email: 'ceo@example.com', displayName: 'CEO' });
await seedMember('ceo-owner', 'owner');
await seedUser('wrong-owner', { email: 'wrong@example.com' });
await seedMember('wrong-owner', 'owner');
r = await call('ceo-owner', 'wrong-owner', 'member');
assert('04 CEO owner repairs canonical owner conflict', r.statusCode === 200 && r.body.reasonCode === 'OWNERSHIP_REPAIRED' && r.body.ownerUid === 'ceo-owner' && r.body.targetRole === 'member');

let org = (await db.doc('organizations/org-1').get()).data()!;
let actorMember = (await db.doc('organizations/org-1/members/ceo-owner').get()).data()!;
let targetMember = (await db.doc('organizations/org-1/members/wrong-owner').get()).data()!;
let actorLegacyA = (await db.doc('organization_members/ceo-owner_org-1').get()).data()!;
let actorLegacyB = (await db.doc('organization_members/org-1_ceo-owner').get()).data()!;
let targetLegacyA = (await db.doc('organization_members/wrong-owner_org-1').get()).data()!;
let targetLegacyB = (await db.doc('organization_members/org-1_wrong-owner').get()).data()!;

assert('05 all authoritative owner metadata normalized to CEO', ['ownerUid', 'ownerUserId', 'ownerId', 'owner_user_id'].every(key => org[key] === 'ceo-owner'));
assert('06 CEO membership remains canonical owner', actorMember.role === 'owner' && actorMember.organizationRole === 'owner' && actorMember.permissionsVersion === CURRENT_PERMISSIONS_VERSION);
assert('07 stale owner demoted atomically', targetMember.role === 'member' && targetMember.organizationRole === 'member' && targetMember.permissionsVersion === CURRENT_PERMISSIONS_VERSION);
assert('08 stale owner permissions match target role', JSON.stringify(Object.entries(targetMember.permissions ?? {}).sort()) === JSON.stringify(Object.entries(getDefaultPermissions('member')).sort()));
assert('09 legacy projections synchronized', actorLegacyA.role === 'owner' && actorLegacyB.role === 'owner' && targetLegacyA.role === 'member' && targetLegacyB.role === 'member');

const audits = await db.collection('organizations/org-1/audit_logs').where('action', '==', 'organization.ownership.repaired').get();
assert('10 ownership repair writes one audit event', audits.size === 1);

await reset();
await seedOrg('real-owner');
await seedUser('ceo-owner', { systemRole: 'ceo' });
await seedMember('ceo-owner', 'owner');
await seedUser('other-owner');
await seedMember('other-owner', 'owner');
r = await call('ceo-owner', 'other-owner', 'member');
assert('11 target must actually be authoritative owner', r.statusCode === 409 && r.body.reasonCode === 'TARGET_NOT_AUTHORITATIVE_OWNER');

await reset();
await seedOrg();
await seedUser('ceo-owner', { systemRole: 'ceo' });
await seedMember('ceo-owner', 'owner');
await seedUser('wrong-owner');
await seedMember('wrong-owner', 'owner');
r = await call('ceo-owner', 'wrong-owner', 'owner');
assert('12 repair cannot assign owner as target role', r.statusCode === 400 && r.body.reasonCode === 'INVALID_TARGET_ROLE');

finish();
