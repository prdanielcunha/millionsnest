/**
 * Narrow, read-only diagnostic for an invitation acceptance incident.
 * Targets only SHA256 fingerprints (never raw join token, org ID, emails or UIDs in source/logs).
 * No writes, no token redemption, no invited-user login.
 */
import crypto from 'node:crypto';
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { resolveCanonicalInvitationCapacity, normalizeInvitationTemporalMs } from '../src/server/services/InvitationAcceptanceServerPolicy.js';
import { planInvitationAcceptance } from '../src/server/services/InvitationAcceptancePlanner.js';

const ORG_ID_FINGERPRINT = 'c9836fff04b509d97dcc1739a39e071475f3a3adf83f527bc70374ed4f557486';
const INVITE_TOKEN_FINGERPRINT = '8a7adda77c8723aec62a311bbbec8526b07a4011acf4279565c3189eb742cbbc';
const hash = (value: string) => crypto.createHash('sha256').update(value).digest('hex');

async function main() {
  if (process.env.MN_INVITATION_AUDIT_READ_ONLY !== 'true' ||
      process.env.GOOGLE_CLOUD_PROJECT !== 'millionsnest' ||
      process.env.GITHUB_REF !== 'refs/heads/production') {
    throw new Error('READ_ONLY_AUDIT_SCOPE_NOT_CERTIFIED');
  }
  if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId: 'millionsnest' });
  const db = getFirestore();
  const list = await db.collection('organizations').limit(251).get();
  if (list.size > 250) throw new Error('TOO_MANY_ORGANIZATIONS__NARROW_AUDIT_ABORTED');
  const matches = list.docs.filter(doc => hash(doc.id) === ORG_ID_FINGERPRINT);
  if (matches.length !== 1) {
    console.log('INVITATION_P0_AUDIT=' + JSON.stringify({ readOnly: true, organizationMatch: matches.length, result: 'ORG_NOT_FOUND_IN_BOUNDED_SCAN' }));
    return;
  }
  const org = matches[0];
  const data = org.data() || {};
  const ownerAliases = ['ownerUid','ownerUserId','ownerId','owner_user_id'].map(field => data[field]).filter((v): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(v));
  const ownerStates = await Promise.all([...new Set(ownerAliases)].map(async uid => {
    const snap = await db.collection('users').doc(uid).get();
    return { isCEO: snap.exists && snap.data()?.systemRole === 'ceo', exists: snap.exists };
  }));
  const invites = await org.ref.collection('invites').where('tokenHash','==',INVITE_TOKEN_FINGERPRINT).limit(2).get();
  const sub = await db.collection('subscriptions').doc(org.id).get();
  const subData = sub.data() || {};
  const invitation = invites.size === 1 ? invites.docs[0].data() : null;
  const memberSnap = await org.ref.collection('members').limit(251).get();
  if (memberSnap.size > 250) throw new Error('TOO_MANY_MEMBERS__NARROW_AUDIT_ABORTED');
  const cap = resolveCanonicalInvitationCapacity({
    organizationId: org.id,
    subscription: {
      exists: sub.exists,
      organizationId: subData.organizationId,
      app: subData.apps?.musicscale?.app ?? subData.app,
      status: subData.apps?.musicscale?.status ?? subData.status,
      plan: subData.apps?.musicscale?.plan ?? subData.plan,
      limitsUsers: subData.apps?.musicscale?.limits?.users ?? subData.limits?.users,
    },
    organizationApp: {
      exists: !!data.apps?.musicscale,
      status: data.apps?.musicscale?.status,
      plan: data.apps?.musicscale?.plan,
      limitsUsers: data.apps?.musicscale?.limits?.users,
    },
    memberStatuses: memberSnap.docs.map(s=>s.data()?.status),
  });
  const tokenIntentSnap = await org.ref.collection('musicscale_invite_role_intents')
    .doc('token_' + INVITE_TOKEN_FINGERPRINT).get();
  const tokenIntent = tokenIntentSnap.data() || {};
  const tokenIntentRole = typeof tokenIntent.roleId === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(tokenIntent.roleId)
    ? await db.collection('roles').doc(tokenIntent.roleId).get() : null;
  const ownerCandidatesAreDifferent = new Set(ownerAliases).size > 1;
  const firstOwnerIsCEO = ownerStates.length ? ownerStates[0].isCEO : false;
  const acceptedUid = typeof invitation?.acceptedBy === 'string' ? invitation.acceptedBy : '';
  const [acceptedMember, acceptedUser, acceptedMusicProfile] = acceptedUid
    ? await Promise.all([
        org.ref.collection('members').doc(acceptedUid).get(),
        db.collection('users').doc(acceptedUid).get(),
        org.ref.collection('musicscale_members').doc(acceptedUid).get(),
      ])
    : [null, null, null];
  const linkedOrgs = acceptedUser?.data()?.organizations;
  const result: Record<string,unknown> = {
    readOnly: true,
    organizationMatch: 1,
    organizationStatus: typeof data.status === 'string' ? data.status.trim().toLowerCase().slice(0,32) : 'missing',
    organizationLifecycleActive: (await import('../src/lib/organizationLifecycle.js')).isOrganizationLifecycleActive(data),
    ownerAliasCount: ownerAliases.length,
    conflictingOwnerAliases: ownerCandidatesAreDifferent,
    selectedOwnerExists: ownerStates[0]?.exists === true,
    selectedOwnerIsCEO: firstOwnerIsCEO,
    someRecordedOwnerIsCEO: ownerStates.some(x=>x.isCEO),
    subscriptionExists: sub.exists,
    canonicalSubscriptionStatus: String(subData.apps?.musicscale?.status ?? subData.status ?? 'missing').slice(0,32),
    capacityResult: cap.success === false ? cap.reasonCode : (cap.capacity.mode === 'unlimited' ? 'UNLIMITED' : 'LIMITED'),
    matchingInviteCount: invites.size,
    inviteStatus: invitation ? String(invitation.status ?? 'missing').slice(0,32) : null,
    inviteMode: invitation ? String(invitation.inviteMode ?? 'missing').slice(0,32) : null,
    identityBound: invitation?.identityBound === true,
    inviteTarget: invitation ? String(invitation.targetAppId ?? 'missing').slice(0,32) : null,
    inviteOrgConsistent: invitation ? (!invitation.organizationId || invitation.organizationId === org.id) : null,
    inviteExpired: invitation ? (normalizeInvitationTemporalMs(invitation.expiresAt) ?? 0) <= Date.now() : null,
    inviteRevoked: invitation ? invitation.status === 'revoked' || !!invitation.revokedAt : null,
    inviteUseCount: invitation && Number.isInteger(invitation.useCount) ? invitation.useCount : null,
    inviteMaxUses: invitation && Number.isInteger(invitation.maxUses) ? invitation.maxUses : null,
    musicScaleInviteRoleIntentExists: tokenIntentSnap.exists,
    musicScaleInviteRoleIntentStatus: tokenIntentSnap.exists ? String(tokenIntent.status ?? 'missing').slice(0,32) : null,
    musicScaleInviteRoleIntentSchemaVersion: tokenIntentSnap.exists ? (tokenIntent.schemaVersion ?? null) : null,
    musicScaleInviteRoleIntentHasRoleId: typeof tokenIntent.roleId === 'string' && tokenIntent.roleId.trim() !== '',
    musicScaleInviteRoleIntentMatchesOrg: tokenIntentSnap.exists ? tokenIntent.organizationId === org.id : null,
    musicScaleInviteRoleDocExists: tokenIntentRole?.exists === true,
    musicScaleInviteRoleBelongsToOrg: tokenIntentRole?.exists === true && tokenIntentRole.data()?.organizationId === org.id,
    musicScaleInviteRoleIntentAppliedToRecipient: tokenIntentSnap.exists && !!acceptedUid && tokenIntent.appliedToUid === acceptedUid,
    acceptedByRecorded: Boolean(acceptedUid),
    acceptedMemberExists: acceptedMember?.exists === true,
    acceptedMemberStatus: typeof acceptedMember?.data()?.status === 'string' ? acceptedMember.data()?.status : null,
    acceptedMemberRole: typeof acceptedMember?.data()?.role === 'string' ? acceptedMember.data()?.role : null,
    acceptedUserExists: acceptedUser?.exists === true,
    acceptedUserLinkedToOrg: Array.isArray(linkedOrgs) && linkedOrgs.includes(org.id),
    acceptedUserActiveContext: acceptedUser?.data()?.activeOrganizationId === org.id,
    acceptedMusicScaleProjectionPresent: acceptedMusicProfile?.exists === true,
    acceptedMusicScaleRoleIdPresent: Boolean(acceptedMusicProfile?.data()?.roleId),
    acceptedLegacyProjectionExists: acceptedUid
      ? (await db.collection('organization_members').doc(`${acceptedUid}_${org.id}`).get()).exists
      : false,
  };
  if (invitation?.inviteMode === 'link' || invitation?.identityBound === false) {
    // Pure, no-write assessment, using dummy user identity to avoid reading private invitee data.
    const projected = planInvitationAcceptance({
      identity: { uid: 'read-only-nonmember', email: 'read-only@example.org' },
      organization: { exists: true, status: data.status },
      invitation: {
        exists: true, organizationId: invitation.organizationId,
        status: invitation.status, inviteMode: invitation.inviteMode,
        identityBound: invitation.identityBound, email: invitation.email,
        emailNormalized: invitation.emailNormalized, role: invitation.role,
        expiresAtMs: normalizeInvitationTemporalMs(invitation.expiresAt),
        revokedAtMs: normalizeInvitationTemporalMs(invitation.revokedAt),
        maxUses: invitation.maxUses, useCount: invitation.useCount,
        acceptedBy: invitation.acceptedBy,
      },
      existingMembership: { exists: false },
      capacity: firstOwnerIsCEO ? { resolved: true, mode: 'unlimited' } :
        cap.success ? cap.capacity : { resolved: false },
    }, Date.now());
    result.simulatedNewMemberOutcome = projected.success ? projected.reasonCode : projected.reasonCode;
  }
  console.log('INVITATION_P0_AUDIT=' + JSON.stringify(result));
}
main().catch(err => {
  console.error('INVITATION_P0_AUDIT_FAILED=' + (err instanceof Error ? err.message.split('\n')[0].slice(0,160) : 'UNKNOWN'));
  process.exitCode = 1;
});
