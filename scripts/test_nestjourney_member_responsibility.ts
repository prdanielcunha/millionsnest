import {
  clearInvitationEmulator,
  createAssertions,
  invokeHandler,
  requireInvitationEmulator,
} from './helpers/p0HandlerTestHarness.js';
import {
  updateNestJourneyMemberResponsibility,
} from '../src/server/services/NestJourneyMemberResponsibilityCommandService.js';
import { CURRENT_PERMISSIONS_VERSION } from '../src/lib/rbac.js';

const db = requireInvitationEmulator();
const { assert, finish } = createAssertions();

const deps = {
  verifyIdToken: async (token: string) => {
    if (token === 'invalid') throw new Error('invalid');
    return { uid: token };
  },
  getFirestore: () => db,
};

async function reset() {
  await clearInvitationEmulator();
}

async function seedOrg(
  id = 'org-1',
  ownerUid = 'owner-1',
  status = 'active',
) {
  await db.doc(`organizations/${id}`).set({ id, ownerUid, status });
}

async function seedUser(uid: string, data: Record<string, unknown> = {}) {
  await db.doc(`users/${uid}`).set({ uid, ...data });
}

async function seedMember(
  orgId: string,
  uid: string,
  role = 'member',
  status = 'active',
  permissions: Record<string, boolean> = {},
  congregationIds = ['unit-a'],
  extra: Record<string, unknown> = {},
) {
  await db.doc(`organizations/${orgId}/members/${uid}`).set({
    uid,
    organizationId: orgId,
    role,
    organizationRole: role,
    status,
    permissions,
    permissionsVersion: CURRENT_PERMISSIONS_VERSION,
    congregationIds,
    ...extra,
  });
}

async function call(
  actor: string | undefined,
  responsibility: unknown,
  orgId = 'org-1',
  memberId = 'target-1',
) {
  return invokeHandler(
    (req, res) => updateNestJourneyMemberResponsibility(req, res, deps),
    {
      bearer: actor,
      params: { organizationId: orgId, memberId },
      body: { responsibility },
    },
  );
}

async function auditCount() {
  const snapshot = await db
    .collection('organizations/org-1/audit_logs')
    .where('action', '==', 'nestjourney.member.responsibility_updated')
    .get();
  return snapshot.size;
}

await reset();
let r = await call(undefined, 'caregiver');
assert(
  '01 missing bearer is denied',
  r.statusCode === 401 && r.body.reasonCode === 'UNAUTHENTICATED',
);
r = await call('invalid', 'caregiver');
assert(
  '02 invalid bearer is denied',
  r.statusCode === 401 && r.body.reasonCode === 'UNAUTHENTICATED',
);
r = await call('actor', 'made-up-role');
assert(
  '03 unknown responsibility is rejected',
  r.statusCode === 400 && r.body.reasonCode === 'INVALID_RESPONSIBILITY',
);

await reset();
await seedOrg();
await seedUser('ordinary');
await seedMember('org-1', 'ordinary', 'member');
await seedUser('target-1');
await seedMember('org-1', 'target-1', 'member');
r = await call('ordinary', 'caregiver');
assert(
  '04 ordinary member cannot assign Journey responsibilities',
  r.statusCode === 403 && r.body.reasonCode === 'PERMISSION_DENIED',
);

await reset();
await seedOrg();
await seedUser('owner-1');
await seedMember('org-1', 'owner-1', 'owner');
await seedUser('target-1');
await seedMember(
  'org-1',
  'target-1',
  'member',
  'active',
  {
    'custom.preexisting.permission': true,
    'musicscale.live.conduct': true,
  },
  ['unit-a', 'unit-b'],
);
r = await call('owner-1', 'caregiver');
assert(
  '05 owner can assign caregiver',
  r.statusCode === 200 &&
    r.body.reasonCode === 'RESPONSIBILITY_UPDATED' &&
    r.body.responsibility === 'caregiver',
);
let canonical = (
  await db.doc('organizations/org-1/members/target-1').get()
).data()!;
assert(
  '06 caregiver gets only care capability inside Journey projection',
  canonical.journeyRole === 'caregiver' &&
    canonical.permissions.canManageCare === true &&
    canonical.permissions.canManagePresence === false &&
    canonical.permissions.canManageMesa === false &&
    canonical.permissions.canManageGroups === false &&
    canonical.permissions.canManageDiscipleship === false &&
    canonical.permissions.canManagePastoral === false &&
    canonical.permissions.canCoordinateJourney === false,
);
assert(
  '07 assignment preserves non-Journey permissions and organization authority',
  canonical.permissions['custom.preexisting.permission'] === true &&
    canonical.permissions['musicscale.live.conduct'] === true &&
    canonical.organizationRole === 'member' &&
    canonical.role === 'member',
);
assert(
  '08 assignment never mutates Hub congregation scope',
  JSON.stringify(canonical.congregationIds) === JSON.stringify(['unit-a', 'unit-b']) &&
    !('journeyCongregationIds' in canonical) &&
    !('journeyAllCongregations' in canonical),
);
assert(
  '09 assignment materializes current permission schema version',
  canonical.permissionsVersion === CURRENT_PERMISSIONS_VERSION,
);

let legacyA = (
  await db.doc('organization_members/target-1_org-1').get()
).data()!;
let legacyB = (
  await db.doc('organization_members/org-1_target-1').get()
).data()!;
assert(
  '10 compatibility projections receive the same Journey responsibility',
  legacyA.journeyRole === 'caregiver' &&
    legacyB.journeyRole === 'caregiver' &&
    legacyA.permissions.canManageCare === true &&
    legacyB.permissions.canManageCare === true,
);
assert('11 exactly one audited transition is written', (await auditCount()) === 1);

r = await call('owner-1', 'caregiver');
assert(
  '12 exact replay is idempotent',
  r.statusCode === 200 && r.body.reasonCode === 'ALREADY_SET',
);
assert('13 idempotent replay writes no duplicate audit', (await auditCount()) === 1);

await db.doc('organizations/org-1/members/target-1').set({
  permissions: {
    ...canonical.permissions,
    canManageCare: false,
  },
}, { merge: true });
r = await call('owner-1', 'caregiver');
canonical = (
  await db.doc('organizations/org-1/members/target-1').get()
).data()!;
assert(
  '14 same Journey role repairs a stale permission projection',
  r.statusCode === 200 &&
    r.body.reasonCode === 'RESPONSIBILITY_UPDATED' &&
    canonical.permissions.canManageCare === true,
);

r = await call('owner-1', 'presence_host');
canonical = (
  await db.doc('organizations/org-1/members/target-1').get()
).data()!;
assert(
  '15 changing responsibility revokes stale Journey capabilities',
  r.statusCode === 200 &&
    canonical.journeyRole === 'presence_host' &&
    canonical.permissions.canManagePresence === true &&
    canonical.permissions.canManagePeople === true &&
    canonical.permissions.canManageCare === false &&
    canonical.permissions.canManageMesa === false,
);

r = await call('owner-1', 'coordinator');
canonical = (
  await db.doc('organizations/org-1/members/target-1').get()
).data()!;
assert(
  '16 coordinator receives operational supervision without pastoral privilege',
  canonical.permissions.canManagePresence === true &&
    canonical.permissions.canManageMesa === true &&
    canonical.permissions.canManagePeople === true &&
    canonical.permissions.canManageCare === true &&
    canonical.permissions.canManageGroups === true &&
    canonical.permissions.canManageDiscipleship === true &&
    canonical.permissions.canManageImplementation === true &&
    canonical.permissions.canCoordinateJourney === true &&
    canonical.permissions.canManagePastoral === false &&
    canonical.permissions.canViewGovernance === false,
);

r = await call('owner-1', 'pastor');
canonical = (
  await db.doc('organizations/org-1/members/target-1').get()
).data()!;
assert(
  '17 pastor receives pastoral and governance view capabilities',
  canonical.permissions.canManagePastoral === true &&
    canonical.permissions.canViewGovernance === true &&
    canonical.permissions.canCoordinateJourney === true &&
    canonical.permissions.canManageDiscipleship === true,
);

await reset();
await seedOrg('org-1', 'metadata-owner');
await seedUser('admin-1');
await seedMember('org-1', 'admin-1', 'admin');
await seedUser('target-1');
await seedMember('org-1', 'target-1', 'member');
r = await call('admin-1', 'mesa_team');
assert(
  '18 canonical organization admin can assign a Journey responsibility',
  r.statusCode === 200 && r.body.responsibility === 'mesa_team',
);

await reset();
await seedOrg('org-1', 'metadata-owner');
await seedUser('manager-1');
await seedMember('org-1', 'manager-1', 'manager');
await seedUser('target-1');
await seedMember('org-1', 'target-1', 'member');
r = await call('manager-1', 'mesa_team');
assert(
  '19 organization manager without role-management permission cannot assign Journey responsibility',
  r.statusCode === 403 && r.body.reasonCode === 'PERMISSION_DENIED',
);

await reset();
await seedOrg();
await seedUser('global-1', { systemRole: 'ceo' });
await seedUser('target-1');
await seedMember('org-1', 'target-1', 'member');
r = await call('global-1', 'discipler');
assert(
  '20 global CEO can assign a Journey responsibility',
  r.statusCode === 200 && r.body.responsibility === 'discipler',
);

await reset();
await seedOrg();
await seedUser('owner-1');
await seedMember('org-1', 'owner-1', 'owner');
await seedUser('target-1');
await seedMember('org-1', 'target-1', 'member', 'inactive');
r = await call('owner-1', 'caregiver');
assert(
  '21 inactive membership fails closed',
  r.statusCode === 409 && r.body.reasonCode === 'MEMBERSHIP_NOT_ACTIVE',
);

await reset();
await seedOrg('org-1', 'owner-1', 'inactive');
await seedUser('owner-1');
await seedMember('org-1', 'owner-1', 'owner');
await seedUser('target-1');
await seedMember('org-1', 'target-1', 'member');
r = await call('owner-1', 'caregiver');
assert(
  '22 inactive organization blocks responsibility changes',
  r.statusCode === 409 && r.body.reasonCode === 'ORGANIZATION_INACTIVE',
);

finish();
