import { approveJoinRequest, createJoinRequest, rejectJoinRequest } from '../src/server/services/JoinRequestCommandService.js';
import { clearInvitationEmulator, createAssertions, invokeHandler, requireInvitationEmulator } from './helpers/p0HandlerTestHarness.js';

const db = requireInvitationEmulator();
const { assert, finish } = createAssertions();
type Identity = { uid: string; email: string; displayName?: string; photoURL?: string };
const identities = new Map<string, Identity>();
const verifyIdToken = async (token: string) => {
  const identity = identities.get(token);
  if (!identity) throw new Error('invalid token');
  return { uid: identity.uid };
};
const getUser = async (uid: string) => {
  const identity = [...identities.values()].find(value => value.uid === uid);
  if (!identity) throw new Error('missing user');
  return identity;
};
const deps = { verifyIdToken, getUser, getFirestore: () => db, now: () => Date.now() };
const auth = (token: string, uid: string, email = `${uid}@example.com`, displayName = `User ${uid}`) =>
  identities.set(token, { uid, email, displayName });
const params = (organizationId: string, requestId?: string) => ({ organizationId, ...(requestId ? { requestId } : {}) });
const create = (token: string | undefined, organizationId: string, body: Record<string, unknown> = {}) =>
  invokeHandler((req, res) => createJoinRequest(req, res, deps), { bearer: token, params: params(organizationId), body });
const approve = (token: string | undefined, organizationId: string, requestId: string) =>
  invokeHandler((req, res) => approveJoinRequest(req, res, deps), { bearer: token, params: params(organizationId, requestId), body: { uid: 'attacker', organizationRole: 'owner' } });
const reject = (token: string | undefined, organizationId: string, requestId: string) =>
  invokeHandler((req, res) => rejectJoinRequest(req, res, deps), { bearer: token, params: params(organizationId, requestId) });

async function seedOrg(id: string, limit = 10) {
  await Promise.all([
    db.doc(`organizations/${id}`).set({
      id,
      status: 'active',
      ownerUid: `${id}-owner`,
      apps: { musicscale: { status: 'active', plan: limit === -1 ? 'pro' : 'starter', limits: { users: limit } } }
    }),
    db.doc(`subscriptions/${id}`).set({
      organizationId: id,
      app: 'musicscale',
      status: 'active',
      plan: limit === -1 ? 'pro' : 'starter',
      limits: { users: limit }
    })
  ]);
}

async function run() {
  await clearInvitationEmulator();
  for (const uid of ['admin', 'removed', 'full-requester', 'reserved-requester', 'reapply', 'legacy-requester']) auth(`${uid}-token`, uid);
  await Promise.all([seedOrg('inactive-case'), seedOrg('full'), seedOrg('reserved'), seedOrg('reapply-org'), seedOrg('legacy-org')]);
  await Promise.all([
    db.doc('organizations/inactive-case/members/admin').set({ uid: 'admin', status: 'active', role: 'admin' }),
    db.doc('organizations/full/members/admin').set({ uid: 'admin', status: 'active', role: 'admin' }),
    db.doc('organizations/reserved/members/admin').set({ uid: 'admin', status: 'active', role: 'admin' }),
    db.doc('organizations/reapply-org/members/admin').set({ uid: 'admin', status: 'active', role: 'admin' }),
    db.doc('organizations/legacy-org/members/admin').set({ uid: 'admin', status: 'active', role: 'admin' })
  ]);

  await db.doc('organizations/inactive-case/members/removed').set({ uid: 'removed', status: 'removed', role: 'member' });
  const blockedCreate = await create('removed-token', 'inactive-case');
  assert('removed canonical member cannot create a reactivation join request', blockedCreate.statusCode === 409 && blockedCreate.body.reasonCode === 'MEMBERSHIP_INACTIVE');
  assert('blocked reactivation create writes no join request', !(await db.doc('organizations/inactive-case/join_requests/removed').get()).exists);

  await db.doc('organizations/inactive-case/join_requests/removed').set({ organizationId: 'inactive-case', requesterUid: 'removed', status: 'pending', generation: 1 });
  const blockedApprove = await approve('admin-token', 'inactive-case', 'removed');
  assert('approval cannot silently reactivate removed canonical membership', blockedApprove.statusCode === 409 && blockedApprove.body.reasonCode === 'MEMBERSHIP_INACTIVE');
  assert('removed membership remains removed after blocked approval', (await db.doc('organizations/inactive-case/members/removed').get()).data()?.status === 'removed');
  assert('blocked approval leaves request pending', (await db.doc('organizations/inactive-case/join_requests/removed').get()).data()?.status === 'pending');

  for (let i = 0; i < 9; i++) await db.doc(`organizations/full/members/m${i}`).set({ uid: `m${i}`, status: 'active', role: 'member' });
  await create('full-requester-token', 'full');
  const fullApproval = await approve('admin-token', 'full', 'full-requester');
  assert('starter plan full capacity blocks join approval server-side', fullApproval.statusCode === 409 && fullApproval.body.reasonCode === 'MEMBER_LIMIT_REACHED');
  assert('capacity rejection creates no canonical membership', !(await db.doc('organizations/full/members/full-requester').get()).exists);
  assert('capacity rejection leaves request pending', (await db.doc('organizations/full/join_requests/full-requester').get()).data()?.status === 'pending');

  for (let i = 0; i < 8; i++) await db.doc(`organizations/reserved/members/r${i}`).set({ uid: `r${i}`, status: 'active', role: 'member' });
  await db.doc('organizations/reserved/invites/pending-slot').set({
    status: 'pending',
    emailNormalized: 'pending@example.com',
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    maxUses: 1,
    useCount: 0
  });
  await create('reserved-requester-token', 'reserved');
  const reservedApproval = await approve('admin-token', 'reserved', 'reserved-requester');
  assert('valid pending invitation reserves the final limited-plan slot', reservedApproval.statusCode === 409 && reservedApproval.body.reasonCode === 'MEMBER_LIMIT_REACHED');
  assert('reserved-slot rejection creates no membership', !(await db.doc('organizations/reserved/members/reserved-requester').get()).exists);

  await create('reapply-token', 'reapply-org');
  await reject('admin-token', 'reapply-org', 'reapply');
  const secondCreate = await create('reapply-token', 'reapply-org');
  assert('new request after rejection increments server generation', secondCreate.statusCode === 201 && secondCreate.body.generation === 2);
  await reject('admin-token', 'reapply-org', 'reapply');
  const rejectedAudits = await db.collection('organizations/reapply-org/audit_logs').where('action', '==', 'join_request.rejected').where('requestId', '==', 'reapply').get();
  const createdAudits = await db.collection('organizations/reapply-org/audit_logs').where('action', '==', 'join_request.created').where('requestId', '==', 'reapply').get();
  assert('reapplication preserves both rejection audit generations', rejectedAudits.size === 2);
  assert('reapplication preserves both creation audit generations', createdAudits.size === 2);
  assert('current request records generation two', (await db.doc('organizations/reapply-org/join_requests/reapply').get()).data()?.generation === 2);

  await db.doc('organizations/legacy-org/join_requests/legacy-requester').set({ status: 'pending' });
  const legacyApproval = await approve('admin-token', 'legacy-org', 'legacy-requester');
  assert('legacy deterministic pending request without duplicated tenant fields remains resolvable from path', legacyApproval.statusCode === 200 && legacyApproval.body.reasonCode === 'JOIN_REQUEST_APPROVED');
  const legacyMembership = (await db.doc('organizations/legacy-org/members/legacy-requester').get()).data();
  assert('legacy request migration still creates canonical member only', legacyMembership?.role === 'member' && legacyMembership?.organizationRole === 'member' && !legacyMembership?.roleId && !legacyMembership?.musicscaleRole);

  auth('display-token', 'display-user', 'DISPLAY@Example.COM', 'Display Person');
  await seedOrg('display-org');
  const displayCreate = await create('display-token', 'display-org');
  const displayRequest = (await db.doc('organizations/display-org/join_requests/display-user').get()).data();
  assert('join request stores normalized current Firebase email for admin display', displayCreate.statusCode === 201 && displayRequest?.email === 'display@example.com' && displayRequest?.requesterEmailNormalized === 'display@example.com');
  assert('join request stores current Firebase display name without making it authority', displayRequest?.displayName === 'Display Person');

  await seedOrg('no-capacity');
  auth('no-capacity-requester-token', 'no-capacity-requester');
  await db.doc('organizations/no-capacity/members/admin').set({ uid: 'admin', status: 'active', role: 'admin' });
  await db.doc('subscriptions/no-capacity').delete();
  await create('no-capacity-requester-token', 'no-capacity');
  const unavailable = await approve('admin-token', 'no-capacity', 'no-capacity-requester');
  assert('unresolvable canonical capacity fails closed', unavailable.statusCode === 503 && unavailable.body.reasonCode === 'MEMBER_LIMIT_UNAVAILABLE');

  finish();
}

run().catch(error => { console.error(error); process.exitCode = 1; });