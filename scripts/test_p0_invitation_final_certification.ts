import { createHash } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { acceptInvitation } from '../src/server/services/TenantContextMutationService.js';
import {
  clearInvitationEmulator, createAssertions, invokeHandler, requireInvitationEmulator
} from './helpers/p0HandlerTestHarness.js';

const db = requireInvitationEmulator();
const { assert, finish } = createAssertions();
const nowMs = 2_000_000_000_000;
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
const handler = (req: Parameters<typeof acceptInvitation>[0], res: Parameters<typeof acceptInvitation>[1]) =>
  acceptInvitation(req, res, { verifyIdToken, getUser, getFirestore: () => db, now: () => nowMs });

function auth(token: string, uid: string, email: string) { identities.set(token, { uid, email }); }

async function seedOrg(orgId: string, status = 'active') {
  await Promise.all([
    db.doc(`organizations/${orgId}`).set({
      name: orgId, status, apps: { musicscale: { status: 'active', plan: 'pro', limits: { users: -1 } } }
    }),
    db.doc(`subscriptions/${orgId}`).set({
      organizationId: orgId, app: 'musicscale', status: 'active', plan: 'pro', limits: { users: -1 }
    })
  ]);
}

async function seedInvite(orgId: string, id: string, rawToken: string, email: string) {
  await db.doc(`organizations/${orgId}/invites/${id}`).set({
    id, organizationId: orgId, email, emailNormalized: email, role: 'member', status: 'pending',
    tokenHash: createHash('sha256').update(rawToken).digest('hex'),
    expiresAt: Timestamp.fromMillis(nowMs + 60_000), maxUses: 1, useCount: 0
  });
}

async function accept(token: string, rawToken: string) {
  return invokeHandler(handler, { bearer: token, body: { token: rawToken } });
}

async function run() {
  await clearInvitationEmulator();
  await Promise.all([seedOrg('already-org'), seedOrg('race-org'), seedOrg('inactive-org', 'inactive')]);

  auth('already-token', 'already-user', 'already@example.com');
  await Promise.all([
    seedInvite('already-org', 'already-invite', 'already-raw-token', 'already@example.com'),
    db.doc('organizations/already-org/members/already-user').set({
      uid: 'already-user', organizationId: 'already-org', role: 'owner', organizationRole: 'owner', status: 'active'
    }),
    db.doc('users/already-user').set({
      organizations: ['primary-org'], activeOrganizationId: 'primary-org', organizationId: 'primary-org',
      primaryOrganizationId: 'primary-org', marker: 'preserve-me'
    })
  ]);
  const firstReplay = await accept('already-token', 'already-raw-token');
  const firstUser = (await db.doc('users/already-user').get()).data()!;
  assert('first ALREADY_MEMBER replay converges active context', firstReplay.statusCode === 200 && firstUser.activeOrganizationId === 'already-org' && firstUser.organizationId === 'already-org');
  assert('ALREADY_MEMBER preserves primary organization and unrelated identity fields', firstUser.primaryOrganizationId === 'primary-org' && firstUser.marker === 'preserve-me');
  const secondReplay = await accept('already-token', 'already-raw-token');
  const replayInvite = (await db.doc('organizations/already-org/invites/already-invite').get()).data()!;
  const replayMembership = (await db.doc('organizations/already-org/members/already-user').get()).data()!;
  const replayAudits = await db.collection('organizations/already-org/audit_logs').where('action', '==', 'invitation.accepted').get();
  const replayLegacy = await db.doc('organization_members/already-user_already-org').get();
  assert('second ALREADY_MEMBER replay is stable and idempotent', secondReplay.statusCode === 200 && replayInvite.useCount === 0);
  assert('ALREADY_MEMBER does not mutate membership role/status', replayMembership.role === 'owner' && replayMembership.organizationRole === 'owner' && replayMembership.status === 'active');
  assert('ALREADY_MEMBER creates no acceptance audit or legacy mirror', replayAudits.empty && !replayLegacy.exists);
  assert('ALREADY_MEMBER does not consume or accept invite', replayInvite.status === 'pending' && replayInvite.acceptedBy === undefined && replayInvite.acceptedAt === undefined);

  auth('mismatch-token', 'mismatch-user', 'wrong@example.com');
  const mismatch = await accept('mismatch-token', 'already-raw-token');
  assert('recipient identity mismatch is denied server-side', mismatch.statusCode === 403);
  auth('inactive-token', 'inactive-user', 'inactive@example.com');
  await Promise.all([
    seedInvite('inactive-org', 'inactive-invite', 'inactive-raw-token', 'inactive@example.com'),
    db.doc('organizations/inactive-org/members/inactive-user').set({ uid: 'inactive-user', organizationId: 'inactive-org', role: 'member', status: 'active' }),
    db.doc('users/inactive-user').set({ activeOrganizationId: 'safe-org', organizationId: 'safe-org', primaryOrganizationId: 'safe-org' })
  ]);
  const inactive = await accept('inactive-token', 'inactive-raw-token');
  const inactiveUser = (await db.doc('users/inactive-user').get()).data()!;
  assert('inactive organization cannot switch ALREADY_MEMBER context', inactive.statusCode === 409 && inactiveUser.activeOrganizationId === 'safe-org');

  auth('winner-a-token', 'winner-a', 'race@example.com');
  auth('winner-b-token', 'winner-b', 'race@example.com');
  await seedInvite('race-org', 'race-invite', 'race-raw-token', 'race@example.com');
  const raceResults = await Promise.all([
    accept('winner-a-token', 'race-raw-token'),
    accept('winner-b-token', 'race-raw-token')
  ]);
  assert('final-use concurrency yields exactly 200 + 409', raceResults.map(result => result.statusCode).sort().join(',') === '200,409');
  const finalInvite = (await db.doc('organizations/race-org/invites/race-invite').get()).data()!;
  const winner = finalInvite.acceptedBy as string;
  const loser = winner === 'winner-a' ? 'winner-b' : 'winner-a';
  const [winnerMember, loserMember, winnerUser, loserUser, winnerLegacy, loserLegacy, audits] = await Promise.all([
    db.doc(`organizations/race-org/members/${winner}`).get(),
    db.doc(`organizations/race-org/members/${loser}`).get(),
    db.doc(`users/${winner}`).get(), db.doc(`users/${loser}`).get(),
    db.doc(`organization_members/${winner}_race-org`).get(), db.doc(`organization_members/${loser}_race-org`).get(),
    db.collection('organizations/race-org/audit_logs').where('action', '==', 'invitation.accepted').get()
  ]);
  assert('final invite is consumed exactly once by winning identity', finalInvite.useCount === 1 && ['winner-a', 'winner-b'].includes(winner));
  assert('exactly one canonical membership and audit exist', winnerMember.exists && !loserMember.exists && audits.size === 1);
  assert('winner projections commit atomically', winnerUser.data()?.activeOrganizationId === 'race-org' && winnerLegacy.exists);
  assert('loser leaves no partial user or legacy projection', !loserUser.exists && !loserLegacy.exists);

  finish();
}

run().catch(error => { console.error(error); process.exitCode = 1; });
