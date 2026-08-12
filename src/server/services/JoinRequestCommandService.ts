import { Request, Response } from 'express';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, Firestore, getFirestore } from 'firebase-admin/firestore';
import { isCanonicalGlobalRole } from '../../lib/permissionService.js';
import { isExistingMembershipRole, normalizeInvitationEmail } from './InvitationAcceptancePlanner.js';
import { normalizeInvitationTemporalMs, resolveCanonicalInvitationCapacity } from './InvitationAcceptanceServerPolicy.js';

type AuthenticatedUserRecord = {
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
};

type Dependencies = {
  verifyIdToken?: (token: string) => Promise<{ uid: string }>;
  getUser?: (uid: string) => Promise<AuthenticatedUserRecord>;
  getFirestore?: () => Firestore;
  now?: () => number;
};

type Command = 'approve' | 'reject';
type MembershipState = 'absent' | 'active' | 'inactive' | 'inconsistent';

const INACTIVE_MEMBERSHIP_STATUSES = ['suspended', 'inactive', 'removed', 'revoked', 'deleted'];

function statusFor(reasonCode: string): number {
  if (reasonCode === 'ORGANIZATION_NOT_FOUND' || reasonCode === 'JOIN_REQUEST_NOT_FOUND') return 404;
  if (reasonCode === 'PERMISSION_DENIED' || reasonCode === 'SELF_RESOLUTION_DENIED') return 403;
  if (reasonCode === 'MEMBER_LIMIT_UNAVAILABLE') return 503;
  if (
    reasonCode === 'ORGANIZATION_INACTIVE' ||
    reasonCode === 'MEMBERSHIP_INACTIVE' ||
    reasonCode === 'MEMBER_LIMIT_INVALID' ||
    reasonCode === 'MEMBER_LIMIT_REACHED' ||
    reasonCode.includes('STATE_INCONSISTENT') ||
    reasonCode.includes('CANNOT_')
  ) return 409;
  return 400;
}

function isSafeDocumentId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 256 &&
    value !== '.' && value !== '..' && !value.includes('/') && !/[\u0000-\u001F\u007F]/.test(value);
}

function normalizeProfileText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  if (!normalized) return undefined;
  return normalized.slice(0, maxLength);
}

function classifyMembership(data: FirebaseFirestore.DocumentData | undefined): MembershipState {
  if (!data) return 'absent';
  if (INACTIVE_MEMBERSHIP_STATUSES.includes(data.status)) return 'inactive';
  if (data.status !== undefined && data.status !== 'active') return 'inconsistent';
  const role = data.organizationRole ?? data.role;
  return isExistingMembershipRole(role) ? 'active' : 'inconsistent';
}

function canonicalMemberRoleIsMember(data: FirebaseFirestore.DocumentData | undefined): boolean {
  if (!data) return false;
  const role = data.role;
  const organizationRole = data.organizationRole;
  if (role !== undefined && role !== 'member') return false;
  if (organizationRole !== undefined && organizationRole !== 'member') return false;
  return role === 'member' || organizationRole === 'member';
}

function existingGeneration(data: FirebaseFirestore.DocumentData | undefined): number {
  const value = data?.generation;
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : 1;
}

async function authenticate(req: Request, dependencies: Dependencies): Promise<string | null> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ') || header.length <= 7) return null;
  try {
    const verify = dependencies.verifyIdToken ?? ((token: string) => getAuth().verifyIdToken(token));
    const uid = (await verify(header.slice(7))).uid;
    return isSafeDocumentId(uid) ? uid : null;
  } catch {
    return null;
  }
}

function hasOrganizationAuthority(
  uid: string,
  organization: FirebaseFirestore.DocumentData,
  membership: FirebaseFirestore.DocumentData | undefined
): boolean {
  if (organization.ownerUid === uid || organization.ownerId === uid || organization.owner_user_id === uid || organization.ownerUserId === uid) return true;
  if (classifyMembership(membership) !== 'active') return false;
  const role = membership?.organizationRole ?? membership?.role;
  return role === 'owner' || role === 'admin';
}

function countReservedPendingInvites(
  docs: FirebaseFirestore.QueryDocumentSnapshot[],
  nowMs: number
): number {
  let pending = 0;
  for (const doc of docs) {
    const data = doc.data();
    if (data.status !== 'pending') continue;
    const expiresAtMs = normalizeInvitationTemporalMs(data.expiresAt);
    const revokedAtMs = normalizeInvitationTemporalMs(data.revokedAt);
    const validUseState = Number.isInteger(data.maxUses) && data.maxUses > 0 &&
      Number.isInteger(data.useCount) && data.useCount >= 0 && data.useCount < data.maxUses;
    if (
      revokedAtMs === undefined &&
      expiresAtMs !== undefined &&
      expiresAtMs > nowMs &&
      validUseState &&
      typeof data.emailNormalized === 'string'
    ) pending += 1;
  }
  return pending;
}

export async function createJoinRequest(req: Request, res: Response, dependencies: Dependencies = {}) {
  const uid = await authenticate(req, dependencies);
  if (!uid) return res.status(401).json({ success: false, reasonCode: 'UNAUTHENTICATED' });
  const organizationId = req.params.organizationId;
  if (!isSafeDocumentId(organizationId)) return res.status(400).json({ success: false, reasonCode: 'INVALID_ORGANIZATION_ID' });

  let userRecord: AuthenticatedUserRecord;
  try {
    const resolveUser = dependencies.getUser ?? ((userId: string) => getAuth().getUser(userId));
    userRecord = await resolveUser(uid);
  } catch {
    return res.status(500).json({ success: false, reasonCode: 'IDENTITY_LOOKUP_FAILED' });
  }
  const email = normalizeInvitationEmail(userRecord.email);
  if (!email) return res.status(409).json({ success: false, reasonCode: 'IDENTITY_EMAIL_UNAVAILABLE' });
  const displayName = normalizeProfileText(userRecord.displayName, 160) ?? email.split('@')[0];
  const photoURL = normalizeProfileText(userRecord.photoURL, 2048);

  try {
    const db = (dependencies.getFirestore ?? getFirestore)();
    const result = await db.runTransaction(async transaction => {
      const orgRef = db.doc(`organizations/${organizationId}`);
      const memberRef = db.doc(`organizations/${organizationId}/members/${uid}`);
      const requestRef = db.doc(`organizations/${organizationId}/join_requests/${uid}`);
      const [orgSnap, memberSnap, requestSnap] = await Promise.all([
        transaction.get(orgRef), transaction.get(memberRef), transaction.get(requestRef)
      ]);
      if (!orgSnap.exists) return { statusCode: 404, payload: { success: false, reasonCode: 'ORGANIZATION_NOT_FOUND' } };
      if (orgSnap.data()?.status !== 'active') return { statusCode: 409, payload: { success: false, reasonCode: 'ORGANIZATION_INACTIVE' } };

      const membershipState = classifyMembership(memberSnap.data());
      if (membershipState === 'active') return { statusCode: 200, payload: { success: true, reasonCode: 'ALREADY_MEMBER' } };
      if (membershipState === 'inactive') return { statusCode: 409, payload: { success: false, reasonCode: 'MEMBERSHIP_INACTIVE' } };
      if (membershipState === 'inconsistent') return { statusCode: 409, payload: { success: false, reasonCode: 'MEMBERSHIP_STATE_INCONSISTENT' } };

      const previousRequest = requestSnap.data();
      if (requestSnap.exists && previousRequest?.status === 'pending') {
        return { statusCode: 200, payload: { success: true, reasonCode: 'ALREADY_PENDING', requestId: uid, generation: existingGeneration(previousRequest) } };
      }
      if (requestSnap.exists && previousRequest?.status !== 'approved' && previousRequest?.status !== 'rejected') {
        return { statusCode: 409, payload: { success: false, reasonCode: 'JOIN_REQUEST_STATE_INCONSISTENT' } };
      }

      const generation = requestSnap.exists ? existingGeneration(previousRequest) + 1 : 1;
      transaction.set(requestRef, {
        id: uid,
        requestId: uid,
        generation,
        organizationId,
        requesterUid: uid,
        requesterEmailNormalized: email,
        email,
        displayName,
        ...(photoURL ? { photoURL } : {}),
        status: 'pending',
        requestedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });
      transaction.set(db.doc(`organizations/${organizationId}/audit_logs/join_request_${uid}_g${generation}_created`), {
        action: 'join_request.created',
        actorUid: uid,
        requestId: uid,
        requestGeneration: generation,
        timestamp: FieldValue.serverTimestamp()
      });
      return { statusCode: 201, payload: { success: true, reasonCode: 'JOIN_REQUEST_CREATED', requestId: uid, generation } };
    });
    return res.status(result.statusCode).json(result.payload);
  } catch {
    return res.status(500).json({ success: false, reasonCode: 'INTERNAL_ERROR' });
  }
}

async function resolveJoinRequest(req: Request, res: Response, command: Command, dependencies: Dependencies) {
  const actorUid = await authenticate(req, dependencies);
  if (!actorUid) return res.status(401).json({ success: false, reasonCode: 'UNAUTHENTICATED' });
  const { organizationId, requestId } = req.params;
  if (!isSafeDocumentId(organizationId) || !isSafeDocumentId(requestId)) {
    return res.status(400).json({ success: false, reasonCode: 'INVALID_REQUEST_PATH' });
  }

  try {
    const db = (dependencies.getFirestore ?? getFirestore)();
    const now = dependencies.now ?? Date.now;
    const result = await db.runTransaction(async transaction => {
      const orgRef = db.doc(`organizations/${organizationId}`);
      const actorRef = db.doc(`users/${actorUid}`);
      const actorMemberRef = db.doc(`organizations/${organizationId}/members/${actorUid}`);
      const requestRef = db.doc(`organizations/${organizationId}/join_requests/${requestId}`);
      const [orgSnap, actorSnap, actorMemberSnap, requestSnap] = await Promise.all([
        transaction.get(orgRef), transaction.get(actorRef), transaction.get(actorMemberRef), transaction.get(requestRef)
      ]);
      if (!orgSnap.exists) return { reasonCode: 'ORGANIZATION_NOT_FOUND' };
      if (orgSnap.data()?.status !== 'active') return { reasonCode: 'ORGANIZATION_INACTIVE' };
      const globalAuthority = isCanonicalGlobalRole(actorSnap.data()?.systemRole);
      if (!globalAuthority && !hasOrganizationAuthority(actorUid, orgSnap.data()!, actorMemberSnap.data())) return { reasonCode: 'PERMISSION_DENIED' };
      if (!requestSnap.exists) return { reasonCode: 'JOIN_REQUEST_NOT_FOUND' };

      const request = requestSnap.data()!;
      if (request.organizationId !== undefined && request.organizationId !== organizationId) return { reasonCode: 'JOIN_REQUEST_STATE_INCONSISTENT' };
      const requesterUid = request.requesterUid === undefined ? requestId : request.requesterUid;
      if (!isSafeDocumentId(requesterUid) || requesterUid !== requestId) return { reasonCode: 'JOIN_REQUEST_STATE_INCONSISTENT' };
      if (requesterUid === actorUid) return { reasonCode: 'SELF_RESOLUTION_DENIED' };
      const generation = existingGeneration(request);

      const memberRef = db.doc(`organizations/${organizationId}/members/${requesterUid}`);
      const requesterUserRef = db.doc(`users/${requesterUid}`);
      const [memberSnap, requesterUserSnap] = await Promise.all([
        transaction.get(memberRef), transaction.get(requesterUserRef)
      ]);

      if (request.status === 'approved') {
        if (command === 'reject') return { reasonCode: 'APPROVED_CANNOT_BE_REJECTED' };
        const member = memberSnap.data();
        if (classifyMembership(member) !== 'active' || !canonicalMemberRoleIsMember(member)) {
          return { reasonCode: 'APPROVED_STATE_INCONSISTENT' };
        }
        return { success: true, reasonCode: 'ALREADY_APPROVED', generation };
      }
      if (request.status === 'rejected') {
        if (command === 'approve') return { reasonCode: 'REJECTED_CANNOT_BE_APPROVED' };
        return { success: true, reasonCode: 'ALREADY_REJECTED', generation };
      }
      if (request.status !== 'pending') return { reasonCode: 'JOIN_REQUEST_STATE_INCONSISTENT' };

      if (command === 'approve') {
        const membershipState = classifyMembership(memberSnap.data());
        if (membershipState === 'active' || membershipState === 'inconsistent') return { reasonCode: 'MEMBERSHIP_STATE_INCONSISTENT' };
        if (membershipState === 'inactive') return { reasonCode: 'MEMBERSHIP_INACTIVE' };

        const subRef = db.doc(`subscriptions/${organizationId}`);
        const [subSnap, membersQuery, invitesQuery] = await Promise.all([
          transaction.get(subRef),
          transaction.get(db.collection(`organizations/${organizationId}/members`)),
          transaction.get(db.collection(`organizations/${organizationId}/invites`))
        ]);
        const subData = subSnap.data() ?? {};
        const orgData = orgSnap.data() ?? {};
        const capacityResult = resolveCanonicalInvitationCapacity({
          organizationId,
          subscription: {
            exists: subSnap.exists,
            organizationId: subData.organizationId,
            app: subData.app,
            status: subData.status,
            plan: subData.plan,
            limitsUsers: subData.limits?.users
          },
          organizationApp: {
            exists: !!orgData.apps?.musicscale,
            status: orgData.apps?.musicscale?.status,
            plan: orgData.apps?.musicscale?.plan,
            limitsUsers: orgData.apps?.musicscale?.limits?.users
          },
          memberStatuses: membersQuery.docs.map(doc => doc.data().status)
        });
        if (!capacityResult.success) return { reasonCode: capacityResult.reasonCode };
        if (capacityResult.capacity.mode === 'limited') {
          const currentActiveMembers = capacityResult.capacity.currentActiveMembers;
          const maxMembers = capacityResult.capacity.maxMembers;
          if (!Number.isInteger(currentActiveMembers) || !Number.isInteger(maxMembers) || currentActiveMembers! < 0 || maxMembers! < 0) {
            return { reasonCode: 'MEMBER_LIMIT_INVALID' };
          }
          const occupiedSlots = currentActiveMembers! + countReservedPendingInvites(invitesQuery.docs, now());
          if (occupiedSlots > maxMembers!) return { reasonCode: 'MEMBER_LIMIT_INVALID' };
          if (occupiedSlots === maxMembers!) return { reasonCode: 'MEMBER_LIMIT_REACHED' };
        } else if (capacityResult.capacity.mode !== 'unlimited') {
          return { reasonCode: 'MEMBER_LIMIT_INVALID' };
        }

        const requesterEmail = normalizeInvitationEmail(request.requesterEmailNormalized ?? request.email);
        transaction.set(memberRef, {
          uid: requesterUid,
          organizationId,
          ...(requesterEmail ? { emailNormalized: requesterEmail } : {}),
          role: 'member',
          organizationRole: 'member',
          status: 'active',
          joinedAt: FieldValue.serverTimestamp(),
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        });
        transaction.set(db.doc(`organization_members/${requesterUid}_${organizationId}`), {
          uid: requesterUid,
          organizationId,
          ...(requesterEmail ? { emailNormalized: requesterEmail } : {}),
          role: 'member',
          organizationRole: 'member',
          status: 'active',
          updatedAt: FieldValue.serverTimestamp()
        }, { merge: true });
        const user = requesterUserSnap.data() ?? {};
        transaction.set(requesterUserRef, {
          uid: requesterUid,
          organizations: FieldValue.arrayUnion(organizationId),
          ...(!user.activeOrganizationId ? { activeOrganizationId: organizationId } : {}),
          ...(!user.organizationId ? { organizationId } : {}),
          ...(!user.primaryOrganizationId ? { primaryOrganizationId: organizationId } : {}),
          updatedAt: FieldValue.serverTimestamp()
        }, { merge: true });
      }

      const finalStatus = command === 'approve' ? 'approved' : 'rejected';
      transaction.update(requestRef, {
        id: requestId,
        requestId,
        generation,
        organizationId,
        requesterUid,
        status: finalStatus,
        resolvedAt: FieldValue.serverTimestamp(),
        resolvedByUid: actorUid,
        updatedAt: FieldValue.serverTimestamp()
      });
      transaction.set(db.doc(`organizations/${organizationId}/audit_logs/join_request_${requestId}_g${generation}_${finalStatus}`), {
        action: `join_request.${finalStatus}`,
        actorUid,
        requestId,
        requestGeneration: generation,
        requesterUid,
        timestamp: FieldValue.serverTimestamp()
      });
      return { success: true, reasonCode: command === 'approve' ? 'JOIN_REQUEST_APPROVED' : 'JOIN_REQUEST_REJECTED', generation };
    });
    if (!result.success) return res.status(statusFor(result.reasonCode)).json({ success: false, reasonCode: result.reasonCode });
    return res.status(200).json(result);
  } catch {
    return res.status(500).json({ success: false, reasonCode: 'INTERNAL_ERROR' });
  }
}

export const approveJoinRequest = (req: Request, res: Response, dependencies: Dependencies = {}) =>
  resolveJoinRequest(req, res, 'approve', dependencies);

export const rejectJoinRequest = (req: Request, res: Response, dependencies: Dependencies = {}) =>
  resolveJoinRequest(req, res, 'reject', dependencies);
