import {
  createAssertions,
  clearInvitationEmulator,
  invokeHandler,
  requireInvitationEmulator,
} from './helpers/p0HandlerTestHarness.js';
import { updateMusicScaleMemberCapability } from '../src/server/services/MusicScaleMemberCapabilityCommandService.js';
import {
  CURRENT_PERMISSIONS_VERSION,
  getDefaultPermissions,
  normalizePermissions,
} from '../src/lib/rbac.js';

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
) {
  await db.doc(`organizations/${orgId}/members/${uid}`).set({
    uid,
    organizationId: orgId,
    role,
    organizationRole: role,
    status,
    permissions,
    permissionsVersion: 2,
  });
}

async function call(
  actor: string | undefined,
  enabled: unknown,
  capability: unknown = 'musicscale.live.conduct',
  orgId = 'org-1',
  memberId = 'target-1',
) {
  return invokeHandler(
    (req, res) => updateMusicScaleMemberCapability(req, res, deps),
    {
      bearer: actor,
      params: { organizationId: orgId, memberId },
      body: { capability, enabled },
    },
  );
}

async function auditCount() {
  const snap = await db
    .collection('organizations/org-1/audit_logs')
    .where('action', '==', 'musicscale.member.capability_updated')
    .get();
  return snap.size;
}

// v2 -> v3 must be lossless for pre-existing booleans.
const previousPermissions = {
  'organization.members.manage': false,
  'musicscale.songs.manage': true,
  'musicscale.songs.edit': true,
  'musicscale.scales.manage': false,
  'musicscale.teams.manage': true,
  'custom.preexisting.permission': true,
};
const migrated = normalizePermissions(previousPermissions, 'member', 2);
assert(
  '01 v3 migration preserves song permission',
  migrated['musicscale.songs.manage'] === true,
);
assert(
  '02 v3 migration preserves explicit false scale permission',
  migrated['musicscale.scales.manage'] === false,
);
assert(
  '03 v3 migration preserves team permission',
  migrated['musicscale.teams.manage'] === true,
);
assert(
  '04 v3 migration preserves unknown existing boolean permission',
  migrated['custom.preexisting.permission'] === true,
);
assert(
  '05 ordinary member gets live conduct disabled by default',
  migrated['musicscale.live.conduct'] === false,
);
assert(
  '06 legacy leader gains live conduct through role default without losing scale management',
  normalizePermissions(
    {
      'musicscale.scales.manage': true,
      'musicscale.songs.edit': true,
    },
    'leader',
    2,
  )['musicscale.live.conduct'] === true,
);

await reset();
let r = await call(undefined, true);
assert(
  '07 missing bearer denied',
  r.statusCode === 401 && r.body.reasonCode === 'UNAUTHENTICATED',
);

r = await call('actor', true, 'musicscale.scales.manage');
assert(
  '08 arbitrary capability mutation denied',
  r.statusCode === 400 && r.body.reasonCode === 'INVALID_CAPABILITY',
);

r = await call('actor', 'true');
assert(
  '09 non-boolean enabled denied',
  r.statusCode === 400 && r.body.reasonCode === 'INVALID_ENABLED_VALUE',
);

await reset();
await seedOrg();
await seedUser('ordinary');
await seedMember('org-1', 'ordinary', 'member');
await seedUser('target-1');
await seedMember('org-1', 'target-1', 'member');
r = await call('ordinary', true);
assert(
  '10 ordinary member cannot grant conductor capability',
  r.statusCode === 403 && r.body.reasonCode === 'PERMISSION_DENIED',
);

await reset();
await seedOrg();
await seedUser('local-admin', { systemRole: 'admin' });
await seedUser('target-1');
await seedMember('org-1', 'target-1', 'member');
r = await call('local-admin', true);
assert(
  '11 noncanonical systemRole admin is not treated as global',
  r.statusCode === 403 && r.body.reasonCode === 'PERMISSION_DENIED',
);

await reset();
await seedOrg('org-1', 'owner-1');
await seedUser('owner-1');
await seedMember('org-1', 'owner-1', 'owner');
await seedUser('target-1');
await seedMember('org-1', 'target-1', 'member', 'active', {
  'musicscale.songs.edit': true,
  'musicscale.scales.manage': false,
  'custom.preexisting.permission': true,
});
r = await call('owner-1', true);
assert(
  '12 owner can enable conductor capability',
  r.statusCode === 200 &&
    r.body.reasonCode === 'CAPABILITY_UPDATED' &&
    r.body.enabled === true,
);

let canonical = (
  await db.doc('organizations/org-1/members/target-1').get()
).data()!;
let legacyA = (
  await db.doc('organization_members/target-1_org-1').get()
).data()!;
let legacyB = (
  await db.doc('organization_members/org-1_target-1').get()
).data()!;

assert(
  '13 command preserves existing true permissions',
  canonical.permissions['musicscale.songs.edit'] === true &&
    canonical.permissions['custom.preexisting.permission'] === true,
);
assert(
  '14 command preserves existing explicit false permissions',
  canonical.permissions['musicscale.scales.manage'] === false,
);
assert(
  '15 command writes only new capability in addition to existing map',
  canonical.permissions['musicscale.live.conduct'] === true,
);
assert(
  '16 command bumps permissions version without replacing role',
  canonical.permissionsVersion === CURRENT_PERMISSIONS_VERSION &&
    canonical.role === 'member' &&
    canonical.organizationRole === 'member',
);
assert(
  '17 uid_org mirror receives the same permission map',
  legacyA.permissions['musicscale.live.conduct'] === true &&
    legacyA.permissions['musicscale.songs.edit'] === true,
);
assert(
  '18 org_uid mirror receives the same permission map',
  legacyB.permissions['musicscale.live.conduct'] === true &&
    legacyB.permissions['custom.preexisting.permission'] === true,
);
assert('19 exactly one audited transition is written', (await auditCount()) === 1);

r = await call('owner-1', true);
assert(
  '20 same-value replay is idempotent',
  r.statusCode === 200 && r.body.reasonCode === 'ALREADY_SET',
);
assert(
  '21 idempotent replay does not duplicate audit',
  (await auditCount()) === 1,
);

r = await call('owner-1', false);
canonical = (
  await db.doc('organizations/org-1/members/target-1').get()
).data()!;
assert(
  '22 disabling conductor does not alter other permissions',
  r.statusCode === 200 &&
    canonical.permissions['musicscale.live.conduct'] === false &&
    canonical.permissions['musicscale.songs.edit'] === true &&
    canonical.permissions['custom.preexisting.permission'] === true,
);

await reset();
await seedOrg('org-1', 'metadata-owner');
await seedUser('admin-1');
await seedMember('org-1', 'admin-1', 'admin');
await seedUser('target-1');
await seedMember('org-1', 'target-1', 'member');
r = await call('admin-1', true);
assert(
  '23 canonical organization admin can grant conductor',
  r.statusCode === 200 && r.body.reasonCode === 'CAPABILITY_UPDATED',
);

await reset();
await seedOrg('org-1', 'metadata-owner');
await seedUser('permission-manager');
await seedMember('org-1', 'permission-manager', 'member', 'active', {
  'organization.roles.manage': true,
});
await seedUser('target-1');
await seedMember('org-1', 'target-1', 'member');
r = await call('permission-manager', true);
assert(
  '24 explicit role manager capability can grant conductor',
  r.statusCode === 200 && r.body.reasonCode === 'CAPABILITY_UPDATED',
);

for (const [index, systemRole] of [
  'ceo',
  'global_admin',
  'ecosystem_owner',
  'founder',
].entries()) {
  await reset();
  await seedOrg();
  await seedUser('global', { systemRole });
  await seedUser('target-1');
  await seedMember('org-1', 'target-1', 'member');
  r = await call('global', true);
  assert(
    `${25 + index} exact global ${systemRole} can grant conductor`,
    r.statusCode === 200 && r.body.reasonCode === 'CAPABILITY_UPDATED',
  );
}

await reset();
await seedOrg('org-1', 'owner-1');
await seedUser('owner-1');
await seedMember('org-1', 'owner-1', 'owner');
await seedUser('target-1');
await seedMember('org-1', 'target-1', 'member', 'inactive');
r = await call('owner-1', true);
assert(
  '29 inactive target fails closed',
  r.statusCode === 409 && r.body.reasonCode === 'MEMBERSHIP_NOT_ACTIVE',
);

await reset();
await seedOrg('org-1', 'owner-1');
await seedOrg('org-2', 'other-owner');
await seedUser('actor');
await seedMember('org-2', 'actor', 'owner');
await seedUser('target-1');
await seedMember('org-1', 'target-1', 'member');
r = await call('actor', true);
assert(
  '30 cross-tenant owner has no authority',
  r.statusCode === 403 && r.body.reasonCode === 'PERMISSION_DENIED',
);

await reset();
await seedOrg('org-1', 'owner-1', 'inactive');
await seedUser('owner-1');
await seedMember('org-1', 'owner-1', 'owner');
await seedUser('target-1');
await seedMember('org-1', 'target-1', 'member');
r = await call('owner-1', true);
assert(
  '31 inactive organization blocks mutation',
  r.statusCode === 409 && r.body.reasonCode === 'ORGANIZATION_INACTIVE',
);

assert(
  '32 role defaults still contain every preexisting permission key',
  Object.keys(getDefaultPermissions('member')).includes(
    'musicscale.teams.manage',
  ) &&
    Object.keys(getDefaultPermissions('member')).includes(
      'musicscale.live.conduct',
    ),
);

finish();
