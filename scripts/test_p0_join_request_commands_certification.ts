import { approveJoinRequest, createJoinRequest, rejectJoinRequest } from '../src/server/services/JoinRequestCommandService.js';
import { clearInvitationEmulator, createAssertions, invokeHandler, requireInvitationEmulator } from './helpers/p0HandlerTestHarness.js';

const db = requireInvitationEmulator();
const { assert, finish } = createAssertions();
const identities = new Map<string, { uid: string; email: string }>();
const verifyIdToken = async (token: string) => {
  const identity = identities.get(token);
  if (!identity) throw new Error('invalid');
  return { uid: identity.uid };
};
const getUser = async (uid: string) => {
  const identity = [...identities.values()].find(value => value.uid === uid);
  if (!identity) throw new Error('missing');
  return { email: identity.email };
};
const deps = { verifyIdToken, getUser, getFirestore: () => db };
const auth = (token: string, uid: string) => identities.set(token, { uid, email: `${uid}@example.com` });
const params = (organizationId: string, requestId?: string) => ({ organizationId, ...(requestId ? { requestId } : {}) });
const create = (token: string | undefined, organizationId: string, body: Record<string, unknown> = {}) =>
  invokeHandler((req, res) => createJoinRequest(req, res, deps), { bearer: token, params: params(organizationId), body });
const approve = (token: string | undefined, organizationId: string, requestId: string) =>
  invokeHandler((req, res) => approveJoinRequest(req, res, deps), { bearer: token, params: params(organizationId, requestId), body: { uid: 'attacker', organizationRole: 'owner', roleId: 'music' } });
const reject = (token: string | undefined, organizationId: string, requestId: string) =>
  invokeHandler((req, res) => rejectJoinRequest(req, res, deps), { bearer: token, params: params(organizationId, requestId) });

async function seedOrg(id: string, status = 'active') {
  await db.doc(`organizations/${id}`).set({ id, status, ownerUid: `${id}-owner` });
}

async function run() {
  await clearInvitationEmulator();
  for (const uid of ['requester', 'requester2', 'member', 'admin', 'owner', 'outsider', 'legacy-owner']) auth(`${uid}-token`, uid);
  await Promise.all([seedOrg('a'), seedOrg('b'), seedOrg('inactive', 'inactive')]);
  await Promise.all([
    db.doc('organizations/a/members/member').set({ uid: 'member', status: 'active', role: 'member' }),
    db.doc('organizations/a/members/admin').set({ uid: 'admin', status: 'active', role: 'admin' }),
    db.doc('organizations/a/members/owner').set({ uid: 'owner', status: 'active', organizationRole: 'owner' }),
    db.doc('organization_members/legacy-owner_a').set({ uid: 'legacy-owner', organizationId: 'a', status: 'active', role: 'owner' })
  ]);

  assert('create without bearer is 401', (await create(undefined, 'a')).statusCode === 401);
  assert('create with invalid bearer is 401', (await create('bad', 'a')).statusCode === 401);
  assert('missing organization is denied', (await create('requester-token', 'missing')).statusCode === 404);
  assert('inactive organization is denied', (await create('requester-token', 'inactive')).statusCode === 409);
  const injected = await create('requester-token', 'a', { uid: 'attacker', organizationId: 'b', organizationRole: 'owner', systemRole: 'ceo', musicscaleRole: 'admin' });
  assert('create ignores body authority and uses path/token', injected.statusCode === 201 && injected.body.requestId === 'requester');
  const request = (await db.doc('organizations/a/join_requests/requester').get()).data()!;
  assert('safe canonical request schema excludes injected authority', request.organizationId === 'a' && request.requesterUid === 'requester' && request.status === 'pending' && !request.uid && !request.organizationRole && !request.systemRole && !request.musicscaleRole);
  assert('create does not create membership or active context', !(await db.doc('organizations/a/members/requester').get()).exists && !(await db.doc('users/requester').get()).exists);
  const duplicates = await Promise.all(Array.from({ length: 8 }, () => create('requester-token', 'a')));
  assert('concurrent duplicate create is deterministic', duplicates.every(result => result.statusCode === 200 && result.body.reasonCode === 'ALREADY_PENDING'));
  assert('duplicate pending leaves one request and one creation audit', (await db.collection('organizations/a/join_requests').get()).size === 1 && (await db.collection('organizations/a/audit_logs').where('action', '==', 'join_request.created').get()).size === 1);
  await db.doc('organizations/b/members/requester2').set({ uid: 'requester2', status: 'active', role: 'member' });
  assert('already canonical member is idempotent', (await create('requester2-token', 'b')).body.reasonCode === 'ALREADY_MEMBER');

  assert('approve without auth is 401', (await approve(undefined, 'a', 'requester')).statusCode === 401);
  assert('common member cannot approve', (await approve('member-token', 'a', 'requester')).statusCode === 403);
  assert('legacy-only owner cannot approve', (await approve('legacy-owner-token', 'a', 'requester')).statusCode === 403);
  assert('cross-tenant request id is not resolved', (await approve('admin-token', 'b', 'requester')).statusCode === 403);
  for (const role of ['admin', 'global_support', 'ecosystem_support']) {
    const uid = `global-${role}`; auth(`${uid}-token`, uid); await db.doc(`users/${uid}`).set({ systemRole: role });
    assert(`systemRole ${role} is denied`, (await approve(`${uid}-token`, 'a', 'requester')).statusCode === 403);
  }
  for (const role of ['ceo', 'global_admin', 'ecosystem_owner', 'founder']) {
    const uid = `global-${role}`; auth(`${uid}-token`, uid); await db.doc(`users/${uid}`).set({ systemRole: role });
    await db.doc(`organizations/a/join_requests/global-test-${role}`).set({ id: `global-test-${role}`, requestId: `global-test-${role}`, organizationId: 'a', requesterUid: `global-test-${role}`, status: 'pending' });
    assert(`${role} has exact global resolution authority`, (await reject(`${uid}-token`, 'a', `global-test-${role}`)).statusCode === 200);
  }

  const race = await Promise.all(Array.from({ length: 8 }, () => approve('admin-token', 'a', 'requester')));
  assert('concurrent approve succeeds idempotently', race.every(result => result.statusCode === 200));
  const [membership, legacy, user, resolved] = await Promise.all([
    db.doc('organizations/a/members/requester').get(), db.doc('organization_members/requester_a').get(),
    db.doc('users/requester').get(), db.doc('organizations/a/join_requests/requester').get()
  ]);
  assert('approve creates exactly canonical member role member', membership.exists && membership.data()?.role === 'member' && membership.data()?.organizationRole === 'member' && membership.data()?.status === 'active');
  assert('membership contains no MusicScale role fields', !membership.data()?.roleId && !membership.data()?.musicscaleRole && !membership.data()?.ministryFunction && !membership.data()?.specialtyIds && !membership.data()?.appRole);
  assert('legacy is projection with minimum member role', legacy.exists && legacy.data()?.role === 'member' && !legacy.data()?.roleId && !legacy.data()?.musicscaleRole);
  assert('user context is linked without body authority', user.data()?.organizations.includes('a') && user.data()?.activeOrganizationId === 'a' && user.data()?.primaryOrganizationId === 'a');
  assert('request is approved by server actor', resolved.data()?.status === 'approved' && resolved.data()?.resolvedByUid === 'admin');
  assert('approve emits exactly one resolution audit', (await db.collection('organizations/a/audit_logs').where('action', '==', 'join_request.approved').where('requestId', '==', 'requester').get()).size === 1);
  assert('approved cannot be rejected', (await reject('owner-token', 'a', 'requester')).body.reasonCode === 'APPROVED_CANNOT_BE_REJECTED');

  await create('requester-token', 'b');
  const rejectRace = await Promise.all(Array.from({ length: 8 }, () => reject('b-owner-token', 'b', 'requester')));
  // organization metadata owner is canonical authority; register only its token identity.
  assert('unregistered owner token is unauthenticated', rejectRace.every(result => result.statusCode === 401));
  auth('b-owner-token', 'b-owner');
  const resolvedRejectRace = await Promise.all(Array.from({ length: 8 }, () => reject('b-owner-token', 'b', 'requester')));
  assert('concurrent reject resolves idempotently', resolvedRejectRace.every(result => result.statusCode === 200));
  assert('reject creates no membership', !(await db.doc('organizations/b/members/requester').get()).exists);
  assert('reject emits one audit and replay emits none', (await db.collection('organizations/b/audit_logs').where('action', '==', 'join_request.rejected').get()).size === 1 && (await reject('b-owner-token', 'b', 'requester')).body.reasonCode === 'ALREADY_REJECTED');

  auth('race-user-token', 'race-user'); auth('race-actor-token', 'race-actor');
  await db.doc('organizations/a/members/race-actor').set({ uid: 'race-actor', status: 'active', role: 'admin' });
  await create('race-user-token', 'a');
  const resolutionRace = await Promise.all([approve('race-actor-token', 'a', 'race-user'), reject('race-actor-token', 'a', 'race-user')]);
  const finalRequest = (await db.doc('organizations/a/join_requests/race-user').get()).data()!;
  const finalMember = await db.doc('organizations/a/members/race-user').get();
  const raceAudits = await db.collection('organizations/a/audit_logs').where('requestId', '==', 'race-user').get();
  assert('approve-vs-reject has one winner', resolutionRace.filter(result => result.body.success === true).length === 1);
  assert('race never leaves active membership with rejected request', !(finalRequest.status === 'rejected' && finalMember.exists));
  assert('race emits one compatible resolution audit', raceAudits.docs.filter(doc => String(doc.data().action).startsWith('join_request.') && doc.data().action !== 'join_request.created').length === 1);

  finish();
}

run().catch(error => { console.error(error); process.exitCode = 1; });
