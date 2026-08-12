import { createHash } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { createInvitation } from '../src/server/services/InvitationCreationService.js';
import { acceptInvitation } from '../src/server/services/TenantContextMutationService.js';
import { deriveInvitationTokenMaterial } from '../src/server/services/InvitationTokenService.js';
import {
  clearInvitationEmulator, createAssertions, invokeHandler, requireInvitationEmulator
} from './helpers/p0HandlerTestHarness.js';

const db = requireInvitationEmulator();
const { assert, finish } = createAssertions();
const nowMs = 2_000_000_000_000;
let tokenCounter = 1;
const identities = new Map<string, { uid: string; email: string }>();

const verifyIdToken = async (token: string) => {
  const identity = identities.get(token);
  if (!identity) throw new Error('invalid token');
  return { uid: identity.uid };
};
const getUser = async (uid: string) => {
  const identity = [...identities.values()].find(value => value.uid === uid);
  if (!identity) throw new Error('unknown user');
  return { email: identity.email };
};
const generateTokenMaterial = () => deriveInvitationTokenMaterial(new Uint8Array(32).fill(tokenCounter++));
const createHandler = (req: Parameters<typeof createInvitation>[0], res: Parameters<typeof createInvitation>[1]) =>
  createInvitation(req, res, { verifyIdToken, getFirestore: () => db, now: () => nowMs, generateTokenMaterial });
const acceptHandler = (req: Parameters<typeof acceptInvitation>[0], res: Parameters<typeof acceptInvitation>[1]) =>
  acceptInvitation(req, res, { verifyIdToken, getUser, getFirestore: () => db, now: () => nowMs });

function auth(token: string, uid: string, email = `${uid}@example.com`) {
  identities.set(token, { uid, email });
}

async function seedOrg(orgId: string) {
  await Promise.all([
    db.doc(`organizations/${orgId}`).set({
      id: orgId, name: `Organization ${orgId}`, status: 'active',
      apps: { musicscale: { status: 'active', plan: 'pro', limits: { users: -1 } } }
    }),
    db.doc(`subscriptions/${orgId}`).set({
      organizationId: orgId, app: 'musicscale', status: 'active', plan: 'pro', limits: { users: -1 }
    })
  ]);
}

async function create(body: Record<string, unknown>, token = 'owner-token') {
  return invokeHandler(createHandler, { bearer: token, body });
}

async function run() {
  await clearInvitationEmulator();
  auth('owner-token', 'owner');
  auth('other-owner-token', 'other-owner');
  auth('member-token', 'member');
  auth('inactive-token', 'inactive');
  await Promise.all([seedOrg('tenant-a'), seedOrg('tenant-b')]);
  await Promise.all([
    db.doc('organizations/tenant-a/members/owner').set({ uid: 'owner', organizationId: 'tenant-a', role: 'owner', status: 'active' }),
    db.doc('organizations/tenant-b/members/other-owner').set({ uid: 'other-owner', organizationId: 'tenant-b', role: 'owner', status: 'active' }),
    db.doc('organizations/tenant-a/members/member').set({ uid: 'member', organizationId: 'tenant-a', role: 'member', status: 'active' }),
    db.doc('organizations/tenant-a/members/inactive').set({ uid: 'inactive', organizationId: 'tenant-a', role: 'admin', status: 'inactive' }),
    db.doc('organization_members/legacy-only_tenant-a').set({ uid: 'legacy-only', organizationId: 'tenant-a', role: 'owner', status: 'active' })
  ]);

  const unauth = await invokeHandler(createHandler, { body: { organizationId: 'tenant-a', email: 'x@example.com', role: 'member' } });
  assert('create requires server-side authentication', unauth.statusCode === 401);
  const member = await create({ organizationId: 'tenant-a', email: 'member-target@example.com', role: 'member' }, 'member-token');
  assert('member without invite permission is denied', member.statusCode === 403);
  const inactive = await create({ organizationId: 'tenant-a', email: 'inactive-target@example.com', role: 'member' }, 'inactive-token');
  assert('inactive canonical membership is denied', inactive.statusCode === 403);
  const crossTenant = await create({ organizationId: 'tenant-a', email: 'cross@example.com', role: 'member' }, 'other-owner-token');
  assert('cross-tenant owner is denied', crossTenant.statusCode === 403);
  auth('legacy-token', 'legacy-only');
  const legacyOnly = await create({ organizationId: 'tenant-a', email: 'legacy@example.com', role: 'member' }, 'legacy-token');
  assert('legacy membership is not create authority', legacyOnly.statusCode === 403);

  for (const role of ['ceo', 'global_admin', 'ecosystem_owner', 'founder']) {
    const token = `${role}-token`;
    const uid = `${role}-uid`;
    auth(token, uid);
    await db.doc(`users/${uid}`).set({ systemRole: role });
    const result = await create({ organizationId: 'tenant-a', email: `${role}@example.com`, role: 'member' }, token);
    assert(`${role} is canonical global create authority`, result.statusCode === 200);
  }
  for (const role of ['admin', 'global_support', 'ecosystem_support']) {
    const token = `${role}-token`;
    const uid = `${role}-uid`;
    auth(token, uid);
    await db.doc(`users/${uid}`).set({ systemRole: role });
    const result = await create({ organizationId: 'tenant-a', email: `${role}@example.com`, role: 'member' }, token);
    assert(`${role} is not global create authority`, result.statusCode === 403);
  }

  const authorized = await create({ organizationId: 'tenant-a', email: 'target@example.com', role: 'member' });
  assert('authorized create succeeds with token-derived creator', authorized.statusCode === 200);
  const inviteId = (authorized.body.invitation as { id: string }).id;
  const rawToken = decodeURIComponent((authorized.body.invitePath as string).split('token=')[1]);
  const inviteSnap = await db.doc(`organizations/tenant-a/invites/${inviteId}`).get();
  const invite = inviteSnap.data()!;
  assert('raw token is returned to authorized caller', rawToken.length === 43);
  assert('raw token is never persisted', !JSON.stringify(invite).includes(rawToken) && !Object.hasOwn(invite, 'token'));
  assert('SHA-256 tokenHash is persisted', invite.tokenHash === createHash('sha256').update(rawToken).digest('hex'));
  assert('invite tenant, creator, and status are canonical', invite.organizationId === 'tenant-a' && invite.createdBy === 'owner' && invite.status === 'pending');
  const createAudits = await db.collection('organizations/tenant-a/audit_logs').where('invitationId', '==', inviteId).get();
  assert('create and its single audit commit atomically', createAudits.size === 1);

  const duplicateEmail = 'concurrent@example.com';
  const duplicateResults = await Promise.all([
    create({ organizationId: 'tenant-a', email: duplicateEmail, role: 'member' }),
    create({ organizationId: 'tenant-a', email: duplicateEmail, role: 'member' })
  ]);
  assert('duplicate create concurrency yields 200 + 409', duplicateResults.map(r => r.statusCode).sort().join(',') === '200,409');
  const duplicateInvites = await db.collection('organizations/tenant-a/invites').where('emailNormalized', '==', duplicateEmail).get();
  assert('duplicate create leaves exactly one pending invite', duplicateInvites.size === 1 && duplicateInvites.docs[0].data().status === 'pending');
  const duplicateAudits = await db.collection('organizations/tenant-a/audit_logs').where('invitationId', '==', duplicateInvites.docs[0].id).get();
  assert('duplicate loser leaves no partial audit', duplicateAudits.size === 1);

  auth('accept-token', 'accept-user', 'target@example.com');
  const accepted = await invokeHandler(acceptHandler, { bearer: 'accept-token', body: { token: rawToken } });
  assert('accept binds authenticated identity and succeeds', accepted.statusCode === 200);
  const [canonical, legacy, user, consumed] = await Promise.all([
    db.doc('organizations/tenant-a/members/accept-user').get(),
    db.doc('organization_members/accept-user_tenant-a').get(),
    db.doc('users/accept-user').get(),
    db.doc(`organizations/tenant-a/invites/${inviteId}`).get()
  ]);
  assert('accept creates canonical membership', canonical.exists && canonical.data()?.organizationId === 'tenant-a');
  assert('normal accept creates compatibility mirror', legacy.exists);
  assert('accept projects active organization', user.data()?.activeOrganizationId === 'tenant-a');
  assert('accept consumes exactly one use for token tenant', consumed.data()?.useCount === 1 && consumed.data()?.acceptedBy === 'accept-user');
  const acceptAudits = await db.collection('organizations/tenant-a/audit_logs').where('invitationId', '==', inviteId).where('action', '==', 'invitation.accepted').get();
  assert('accept writes exactly one audit atomically', acceptAudits.size === 1);

  finish();
}

run().catch(error => { console.error(error); process.exitCode = 1; });
