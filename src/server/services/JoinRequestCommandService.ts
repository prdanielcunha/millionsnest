import { Request, Response } from 'express';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, Firestore, getFirestore } from 'firebase-admin/firestore';
import { isCanonicalGlobalRole } from '../../lib/permissionService.js';

type Dependencies = {
  verifyIdToken?: (token: string) => Promise<{ uid: string }>;
  getUser?: (uid: string) => Promise<{ email?: string }>;
  getFirestore?: () => Firestore;
};

type Command = 'approve' | 'reject';

function statusFor(reasonCode: string): number {
  if (reasonCode === 'ORGANIZATION_NOT_FOUND' || reasonCode === 'JOIN_REQUEST_NOT_FOUND') return 404;
  if (reasonCode === 'PERMISSION_DENIED' || reasonCode === 'SELF_RESOLUTION_DENIED') return 403;
  if (reasonCode === 'ORGANIZATION_INACTIVE' || reasonCode.includes('STATE_INCONSISTENT') || reasonCode.includes('CANNOT_')) return 409;
  return 400;
}

async function authenticate(req: Request, dependencies: Dependencies): Promise<string | null> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ') || header.length <= 7) return null;
  try {
    const verify = dependencies.verifyIdToken ?? ((token: string) => getAuth().verifyIdToken(token));
    return (await verify(header.slice(7))).uid;
  } catch {
    return null;
  }
}

function isActiveMembership(data: FirebaseFirestore.DocumentData | undefined): boolean {
  return !!data && data.status === 'active';
}

function hasOrganizationAuthority(
  uid: string,
  organization: FirebaseFirestore.DocumentData,
  membership: FirebaseFirestore.DocumentData | undefined
): boolean {
  if (organization.ownerUid === uid || organization.ownerId === uid || organization.owner_user_id === uid || organization.ownerUserId === uid) return true;
  if (!isActiveMembership(membership)) return false;
  const role = membership.organizationRole ?? membership.role;
  return role === 'owner' || role === 'admin';
}

export async function createJoinRequest(req: Request, res: Response, dependencies: Dependencies = {}) {
  const uid = await authenticate(req, dependencies);
  if (!uid) return res.status(401).json({ success: false, reasonCode: 'UNAUTHENTICATED' });
  const organizationId = req.params.organizationId;
  if (!organizationId) return res.status(400).json({ success: false, reasonCode: 'INVALID_ORGANIZATION_ID' });

  let email: string | undefined;
  try {
    const resolveUser = dependencies.getUser ?? ((userId: string) => getAuth().getUser(userId));
    email = (await resolveUser(uid)).email?.trim().toLowerCase();
  } catch {
    return res.status(500).json({ success: false, reasonCode: 'IDENTITY_LOOKUP_FAILED' });
  }
  if (!email) return res.status(409).json({ success: false, reasonCode: 'IDENTITY_EMAIL_UNAVAILABLE' });

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
      if (memberSnap.exists && isActiveMembership(memberSnap.data())) {
        return { statusCode: 200, payload: { success: true, reasonCode: 'ALREADY_MEMBER' } };
      }
      if (requestSnap.exists && requestSnap.data()?.status === 'pending') {
        return { statusCode: 200, payload: { success: true, reasonCode: 'ALREADY_PENDING', requestId: uid } };
      }

      transaction.set(requestRef, {
        id: uid, requestId: uid, organizationId, requesterUid: uid,
        requesterEmailNormalized: email, status: 'pending',
        requestedAt: FieldValue.serverTimestamp(), createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });
      transaction.set(db.doc(`organizations/${organizationId}/audit_logs/join_request_${uid}_created_${Date.now()}`), {
        action: 'join_request.created', actorUid: uid, requestId: uid,
        timestamp: FieldValue.serverTimestamp()
      });
      return { statusCode: 201, payload: { success: true, reasonCode: 'JOIN_REQUEST_CREATED', requestId: uid } };
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
  if (!organizationId || !requestId) return res.status(400).json({ success: false, reasonCode: 'INVALID_REQUEST_PATH' });

  try {
    const db = (dependencies.getFirestore ?? getFirestore)();
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
      if (request.organizationId !== organizationId || request.requesterUid !== requestId) return { reasonCode: 'JOIN_REQUEST_STATE_INCONSISTENT' };
      if (request.requesterUid === actorUid) return { reasonCode: 'SELF_RESOLUTION_DENIED' };

      const memberRef = db.doc(`organizations/${organizationId}/members/${request.requesterUid}`);
      const requesterUserRef = db.doc(`users/${request.requesterUid}`);
      const [memberSnap, requesterUserSnap] = await Promise.all([
        transaction.get(memberRef), transaction.get(requesterUserRef)
      ]);
      if (request.status === 'approved') {
        if (command === 'reject') return { reasonCode: 'APPROVED_CANNOT_BE_REJECTED' };
        const member = memberSnap.data();
        if (!memberSnap.exists || !isActiveMembership(member) || (member?.organizationRole ?? member?.role) !== 'member') {
          return { reasonCode: 'APPROVED_STATE_INCONSISTENT' };
        }
        return { success: true, reasonCode: 'ALREADY_APPROVED' };
      }
      if (request.status === 'rejected') {
        if (command === 'approve') return { reasonCode: 'REJECTED_CANNOT_BE_APPROVED' };
        return { success: true, reasonCode: 'ALREADY_REJECTED' };
      }
      if (request.status !== 'pending') return { reasonCode: 'JOIN_REQUEST_STATE_INCONSISTENT' };

      const finalStatus = command === 'approve' ? 'approved' : 'rejected';
      if (command === 'approve') {
        if (memberSnap.exists && isActiveMembership(memberSnap.data())) return { reasonCode: 'MEMBERSHIP_STATE_INCONSISTENT' };
        transaction.set(memberRef, {
          uid: request.requesterUid, organizationId, role: 'member', organizationRole: 'member',
          status: 'active', joinedAt: FieldValue.serverTimestamp(), createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        });
        transaction.set(db.doc(`organization_members/${request.requesterUid}_${organizationId}`), {
          uid: request.requesterUid, organizationId, role: 'member', organizationRole: 'member',
          status: 'active', updatedAt: FieldValue.serverTimestamp()
        }, { merge: true });
        const user = requesterUserSnap.data() ?? {};
        transaction.set(requesterUserRef, {
          uid: request.requesterUid,
          organizations: FieldValue.arrayUnion(organizationId),
          ...(!user.activeOrganizationId ? { activeOrganizationId: organizationId } : {}),
          ...(!user.organizationId ? { organizationId } : {}),
          ...(!user.primaryOrganizationId ? { primaryOrganizationId: organizationId } : {}),
          updatedAt: FieldValue.serverTimestamp()
        }, { merge: true });
      }
      transaction.update(requestRef, {
        status: finalStatus, resolvedAt: FieldValue.serverTimestamp(), resolvedByUid: actorUid,
        updatedAt: FieldValue.serverTimestamp()
      });
      transaction.set(db.doc(`organizations/${organizationId}/audit_logs/join_request_${requestId}_${finalStatus}`), {
        action: `join_request.${finalStatus}`, actorUid, requestId,
        requesterUid: request.requesterUid, timestamp: FieldValue.serverTimestamp()
      });
      return { success: true, reasonCode: command === 'approve' ? 'JOIN_REQUEST_APPROVED' : 'JOIN_REQUEST_REJECTED' };
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
