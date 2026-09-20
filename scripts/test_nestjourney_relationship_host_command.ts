import {
  clearInvitationEmulator,
  createAssertions,
  invokeHandler,
  requireInvitationEmulator,
} from './helpers/p0HandlerTestHarness.js';
import {
  claimNestJourneyRelationshipHost,
} from '../src/server/services/NestJourneyRelationshipHostCommandService.js';

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
  journeyStatus = 'active',
) {
  await db.doc(`organizations/${id}`).set({
    id,
    ownerUid,
    status,
    apps: { nestjourney: { status: journeyStatus } },
  });
}

async function seedUser(uid: string, data: Record<string, unknown> = {}) {
  await db.doc(`users/${uid}`).set({ uid, ...data });
}

async function seedMember(
  orgId: string,
  uid: string,
  role = 'member',
  congregationIds = ['unit-a'],
  permissions: Record<string, boolean> = {},
  status = 'active',
) {
  await db.doc(`organizations/${orgId}/members/${uid}`).set({
    uid,
    organizationId: orgId,
    role,
    organizationRole: role,
    status,
    congregationIds,
    permissions,
  });
}

async function seedPerson(
  id = 'person-1',
  congregationId = 'unit-a',
  extra: Record<string, unknown> = {},
) {
  await db.doc(`organizations/org-1/products/raiz_e_mesa/people/${id}`).set({
    organizationId: 'org-1',
    congregationId,
    name: 'Visitor',
    ...extra,
  });
}

async function call(
  actor: string | undefined,
  orgId = 'org-1',
  personId = 'person-1',
) {
  return invokeHandler(
    (req, res) => claimNestJourneyRelationshipHost(req, res, deps),
    {
      bearer: actor,
      params: { organizationId: orgId, personId },
      body: {},
    },
  );
}

async function auditCount() {
  const snapshot = await db
    .collection('organizations/org-1/audit_logs')
    .where('action', '==', 'nestjourney.person.relationship_host_assigned')
    .get();
  return snapshot.size;
}

await reset();
let r = await call(undefined);
assert(
  '01 missing bearer is denied',
  r.statusCode === 401 && r.body.reasonCode === 'UNAUTHENTICATED',
);
r = await call('invalid');
assert(
  '02 invalid bearer is denied',
  r.statusCode === 401 && r.body.reasonCode === 'UNAUTHENTICATED',
);

await reset();
await seedOrg();
await seedUser('ordinary');
await seedMember('org-1', 'ordinary');
await seedPerson();
r = await call('ordinary');
assert(
  '03 ordinary member cannot claim relationship ownership',
  r.statusCode === 403 && r.body.reasonCode === 'PERMISSION_DENIED',
);

await reset();
await seedOrg();
await seedUser('presence-host');
await seedMember(
  'org-1',
  'presence-host',
  'member',
  ['unit-a'],
  { canManagePresence: true, canManagePeople: true },
);
await seedPerson();
r = await call('presence-host');
assert(
  '04 Presence host can claim an unowned relationship',
  r.statusCode === 200 &&
    r.body.reasonCode === 'BOND_HOST_ASSIGNED' &&
    r.body.bondHostRef === 'presence-host',
);
let person = (
  await db.doc('organizations/org-1/products/raiz_e_mesa/people/person-1').get()
).data()!;
assert(
  '05 person receives factual relationship ownership',
  person.bondHostRef === 'presence-host' &&
    person.bondAssignedBy === 'presence-host' &&
    person.bondAssignedAt != null,
);
let fact = (
  await db.doc(
    'organizations/org-1/products/raiz_e_mesa/facts/bond-host-person-1-presence-host',
  ).get()
).data()!;
assert(
  '06 canonical relationship fact is written',
  fact.eventType === 'BOND_HOST_ASSIGNED' &&
    fact.actorId === 'presence-host' &&
    fact.subjectRef === 'person:person-1' &&
    fact.evidenceRef === 'person:person-1' &&
    fact.payload?.bondHostRef === 'presence-host',
);
assert(
  '07 assignment is audited exactly once',
  (await auditCount()) === 1,
);

r = await call('presence-host');
assert(
  '08 replay by the same relationship host is idempotent',
  r.statusCode === 200 &&
    r.body.reasonCode === 'ALREADY_ASSIGNED' &&
    r.body.bondHostRef === 'presence-host',
);
assert(
  '09 idempotent replay does not duplicate audit',
  (await auditCount()) === 1,
);

await seedUser('other-host');
await seedMember(
  'org-1',
  'other-host',
  'member',
  ['unit-a'],
  { canManagePresence: true, canManagePeople: true },
);
r = await call('other-host');
assert(
  '10 another authorized Presence host cannot take over an existing relationship',
  r.statusCode === 409 && r.body.reasonCode === 'BOND_ALREADY_ASSIGNED',
);
person = (
  await db.doc('organizations/org-1/products/raiz_e_mesa/people/person-1').get()
).data()!;
assert(
  '11 failed takeover preserves the original relationship host',
  person.bondHostRef === 'presence-host',
);

await reset();
await seedOrg();
await seedUser('scoped-host');
await seedMember(
  'org-1',
  'scoped-host',
  'member',
  ['unit-a'],
  { canManagePresence: true, canManagePeople: true },
);
await seedPerson('person-1', 'unit-b');
r = await call('scoped-host');
assert(
  '12 Presence host cannot claim a person outside assigned campus',
  r.statusCode === 403 && r.body.reasonCode === 'PERMISSION_DENIED',
);

await reset();
await seedOrg();
await seedUser('admin-1');
await seedMember('org-1', 'admin-1', 'admin', ['unit-a']);
await seedPerson('person-1', 'unit-b');
r = await call('admin-1');
assert(
  '13 organization admin may operate across campuses',
  r.statusCode === 200 && r.body.bondHostRef === 'admin-1',
);

await reset();
await seedOrg();
await seedUser('global-1', { systemRole: 'ceo' });
await seedPerson();
r = await call('global-1');
assert(
  '14 global CEO can claim relationship ownership for operational validation',
  r.statusCode === 200 && r.body.bondHostRef === 'global-1',
);

await reset();
await seedOrg('org-1', 'owner-1', 'active', 'inactive');
await seedUser('owner-1');
await seedMember('org-1', 'owner-1', 'owner');
await seedPerson();
r = await call('owner-1');
assert(
  '15 inactive NestJourney entitlement blocks relationship assignment',
  r.statusCode === 409 && r.body.reasonCode === 'NESTJOURNEY_INACTIVE',
);

await reset();
await seedOrg('org-1', 'owner-1', 'inactive');
await seedUser('owner-1');
await seedMember('org-1', 'owner-1', 'owner');
await seedPerson();
r = await call('owner-1');
assert(
  '16 inactive organization blocks relationship assignment',
  r.statusCode === 409 && r.body.reasonCode === 'ORGANIZATION_INACTIVE',
);

finish();
