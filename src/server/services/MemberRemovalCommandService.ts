import type { Request, Response } from 'express';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, Firestore, getFirestore } from 'firebase-admin/firestore';
import { isCanonicalGlobalRole } from '../../lib/permissionService.js';

type Dependencies = {
  verifyIdToken?: (token: string) => Promise<{ uid: string }>;
  getFirestore?: () => Firestore;
};

type CanonicalRole = 'owner' | 'admin' | 'manager' | 'member' | 'viewer';
type MembershipState =
  | { state: 'absent' }
  | { state: 'inactive' }
  | { state: 'inconsistent' }
  | { state: 'active'; role: CanonicalRole };

const CANONICAL_ORGANIZATION_ROLES = new Set<CanonicalRole>(['owner', 'admin', 'manager', 'member', 'viewer']);
const INACTIVE_STATUSES = new Set(['suspended', 'inactive', 'removed', 'revoked', 'deleted']);

function isSafeDocumentId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 256 &&
    value !== '.' && value !== '..' && !value.includes('/') && !/[\u0000-\u001F\u007F]/.test(value);
}

function canonicalRole(data: FirebaseFirestore.DocumentData | undefined): CanonicalRole | null {
  if (!data) return null;
  const role = typeof data.role === 'string' ? data.role.trim().toLowerCase() : '';
  const organizationRole = typeof data.organizationRole === 'string' ? data.organizationRole.trim().toLowerCase() : '';
  if (role && organizationRole && role !== organizationRole) return null;
  const candidate = (organizationRole || role) as CanonicalRole;
  return CANONICAL_ORGANIZATION_ROLES.has(candidate) ? candidate : null;
}

function classifyMembership(data: FirebaseFirestore.DocumentData | undefined): MembershipState {
  if (!data) return { state: 'absent' };
  const status = typeof data.status === 'string' ? data.status.trim().toLowerCase() : '';
  if (INACTIVE_STATUSES.has(status)) return { state: 'inactive' };
  if (status && status !== 'active') return { state: 'inconsistent' };
  const role = canonicalRole(data);
  return role ? { state: 'active', role } : { state: 'inconsistent' };
}

function organizationOwnerMatches(organization: FirebaseFirestore.DocumentData, uid: string): boolean {
  return organization.ownerUid === uid || organization.ownerId === uid ||
    organization.owner_user_id === uid || organization.ownerUserId === uid;
}

function statusFor(reasonCode: string): number {
  if (reasonCode === 'ORGANIZATION_NOT_FOUND') return 404;
  if (reasonCode === 'PERMISSION_DENIED' || reasonCode === 'SELF_REMOVAL_REQUIRES_LEAVE_COMMAND') return 403;
  if (
    reasonCode === 'ORGANIZATION_INACTIVE' ||
    reasonCode === 'MEMBERSHIP_INACTIVE' ||
    reasonCode === 'MEMBERSHIP_STATE_INCONSISTENT' ||
    reasonCode === 'OWNER_REMOVAL_REQUIRES_TRANSFER' ||
    reasonCode === 'TARGET_ROLE_PROTECTED'
  ) return 409;
  return 400;
}

function membershipInstanceKey(data: FirebaseFirestore.DocumentData): string {
  const value = data.joinedAt ?? data.createdAt ?? data.updatedAt;
  if (value && typeof value.toMillis === 'function') return String(value.toMillis());
  if (value instanceof Date) return String(value.getTime());
  if (typeof value === 'number' && Number.isFinite(value)) return String(Math.trunc(value));
  return 'unknown';
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

function canRemoveTarget(options: {
  actorUid: string;
  actorGlobal: boolean;
  actorIsOrganizationOwner: boolean;
  actorMembership: MembershipState;
  targetRole: CanonicalRole;
}): { allowed: true } | { allowed: false; reasonCode: string } {
  const { actorGlobal, actorIsOrganizationOwner, actorMembership, targetRole } = options;

  if (targetRole === 'owner') return { allowed: false, reasonCode: 'OWNER_REMOVAL_REQUIRES_TRANSFER' };
  if (actorGlobal || actorIsOrganizationOwner) return { allowed: true };
  if (actorMembership.state !== 'active') return { allowed: false, reasonCode: 'PERMISSION_DENIED' };
  if (actorMembership.role === 'owner') return { allowed: true };
  if (actorMembership.role === 'admin') {
    return targetRole === 'admin'
      ? { allowed: false, reasonCode: 'TARGET_ROLE_PROTECTED' }
      : { allowed: true };
  }
  return { allowed: false, reasonCode: 'PERMISSION_DENIED' };
}

export async function removeOrganizationMember(
  req: Request,
  res: Response,
  dependencies: Dependencies = {}
) {
  const actorUid = await authenticate(req, dependencies);
  if (!actorUid) return res.status(401).json({ success: false, reasonCode: 'UNAUTHENTICATED' });

  const { organizationId, memberId } = req.params;
  if (!isSafeDocumentId(organizationId) || !isSafeDocumentId(memberId)) {
    return res.status(400).json({ success: false, reasonCode: 'INVALID_REQUEST_PATH' });
  }
  if (actorUid === memberId) {
    return res.status(403).json({ success: false, reasonCode: 'SELF_REMOVAL_REQUIRES_LEAVE_COMMAND' });
  }

  try {
    const db = (dependencies.getFirestore ?? getFirestore)();
    const result = await db.runTransaction(async transaction => {
      const orgRef = db.doc(`organizations/${organizationId}`);
      const actorUserRef = db.doc(`users/${actorUid}`);
      const actorMemberRef = db.doc(`organizations/${organizationId}/members/${actorUid}`);
      const targetMemberRef = db.doc(`organizations/${organizationId}/members/${memberId}`);
      const targetUserRef = db.doc(`users/${memberId}`);
      const legacyUidOrgRef = db.doc(`organization_members/${memberId}_${organizationId}`);
      const legacyOrgUidRef = db.doc(`organization_members/${organizationId}_${memberId}`);
      const bootstrapLockRef = db.doc(`tenantBootstrapLocks/${memberId}`);

      const [orgSnap, actorUserSnap, actorMemberSnap, targetMemberSnap, targetUserSnap, legacyUidOrgSnap, legacyOrgUidSnap, bootstrapLockSnap, membershipsQuery] = await Promise.all([
        transaction.get(orgRef),
        transaction.get(actorUserRef),
        transaction.get(actorMemberRef),
        transaction.get(targetMemberRef),
        transaction.get(targetUserRef),
        transaction.get(legacyUidOrgRef),
        transaction.get(legacyOrgUidRef),
        transaction.get(bootstrapLockRef),
        transaction.get(db.collectionGroup('members').where('uid', '==', memberId))
      ]);

      if (!orgSnap.exists) return { success: false as const, reasonCode: 'ORGANIZATION_NOT_FOUND' };
      const organization = orgSnap.data() ?? {};
      if (organization.status !== 'active') return { success: false as const, reasonCode: 'ORGANIZATION_INACTIVE' };

      const actorGlobal = isCanonicalGlobalRole(actorUserSnap.data()?.systemRole);
      const actorIsOrganizationOwner = organizationOwnerMatches(organization, actorUid);
      const actorMembership = classifyMembership(actorMemberSnap.data());
      const actorHasBaseAuthority = actorGlobal || actorIsOrganizationOwner ||
        (actorMembership.state === 'active' && (actorMembership.role === 'owner' || actorMembership.role === 'admin'));
      if (!actorHasBaseAuthority) return { success: false as const, reasonCode: 'PERMISSION_DENIED' };

      const targetMembership = classifyMembership(targetMemberSnap.data());
      if (targetMembership.state === 'inactive') return { success: false as const, reasonCode: 'MEMBERSHIP_INACTIVE' };
      if (targetMembership.state === 'inconsistent') return { success: false as const, reasonCode: 'MEMBERSHIP_STATE_INCONSISTENT' };

      if (targetMembership.state === 'active') {
        if (organizationOwnerMatches(organization, memberId) || targetMembership.role === 'owner') {
          return { success: false as const, reasonCode: 'OWNER_REMOVAL_REQUIRES_TRANSFER' };
        }
        const authorization = canRemoveTarget({
          actorUid,
          actorGlobal,
          actorIsOrganizationOwner,
          actorMembership,
          targetRole: targetMembership.role
        });
        if (authorization.allowed === false) {
          return { success: false as const, reasonCode: authorization.reasonCode };
        }
      }

      const remainingCandidates = membershipsQuery.docs
        .filter(doc =>
          doc.id === memberId &&
          doc.ref.parent.id === 'members' &&
          doc.ref.parent.parent?.parent?.id === 'organizations' &&
          doc.ref.parent.parent?.id !== organizationId
        )
        .map(doc => ({ organizationId: doc.ref.parent.parent!.id, data: doc.data() }))
        .filter(item => {
          const state = classifyMembership(item.data);
          return state.state === 'active';
        });

      const activeRemainingOrganizationIds: string[] = [];
      for (const candidate of remainingCandidates) {
        const candidateOrgSnap = await transaction.get(db.doc(`organizations/${candidate.organizationId}`));
        if (candidateOrgSnap.exists && candidateOrgSnap.data()?.status === 'active') {
          activeRemainingOrganizationIds.push(candidate.organizationId);
        }
      }
      activeRemainingOrganizationIds.sort();

      const userData = targetUserSnap.data() ?? {};
      const oldPrimary = typeof userData.primaryOrganizationId === 'string' ? userData.primaryOrganizationId : null;
      const oldActive = typeof userData.activeOrganizationId === 'string' ? userData.activeOrganizationId : null;
      const oldOrganizationId = typeof userData.organizationId === 'string' ? userData.organizationId : null;
      const primaryOrganizationId = oldPrimary && activeRemainingOrganizationIds.includes(oldPrimary)
        ? oldPrimary
        : activeRemainingOrganizationIds[0] ?? null;
      const activeOrganizationId = oldActive && activeRemainingOrganizationIds.includes(oldActive)
        ? oldActive
        : primaryOrganizationId;
      const repairedOrganizationId = oldOrganizationId && activeRemainingOrganizationIds.includes(oldOrganizationId)
        ? oldOrganizationId
        : activeOrganizationId;

      if (targetMembership.state === 'active') transaction.delete(targetMemberRef);
      if (legacyUidOrgSnap.exists) transaction.delete(legacyUidOrgRef);
      if (legacyOrgUidSnap.exists) transaction.delete(legacyOrgUidRef);

      if (targetUserSnap.exists) {
        const userPatch: Record<string, unknown> = {
          organizations: activeRemainingOrganizationIds,
          updatedAt: FieldValue.serverTimestamp(),
          activeOrganizationId: activeOrganizationId ?? FieldValue.delete(),
          organizationId: repairedOrganizationId ?? FieldValue.delete(),
          primaryOrganizationId: primaryOrganizationId ?? FieldValue.delete()
        };
        transaction.set(targetUserRef, userPatch, { merge: true });
      }

      if (bootstrapLockSnap.exists && bootstrapLockSnap.data()?.organizationId === organizationId) {
        transaction.delete(bootstrapLockRef);
      }

      if (targetMembership.state === 'active') {
        const auditId = `member_${memberId}_${membershipInstanceKey(targetMemberSnap.data()!)}_removed`;
        transaction.set(db.doc(`organizations/${organizationId}/audit_logs/${auditId}`), {
          action: 'organization.member.removed',
          actorUid,
          memberId,
          organizationId,
          previousOrganizationRole: targetMembership.role,
          resultingActiveOrganizationId: activeOrganizationId,
          timestamp: FieldValue.serverTimestamp()
        });
      }

      return {
        success: true as const,
        reasonCode: targetMembership.state === 'active' ? 'MEMBER_REMOVED' : 'ALREADY_REMOVED',
        organizationId,
        memberId,
        activeOrganizationId,
        primaryOrganizationId
      };
    });

    if (!result.success) return res.status(statusFor(result.reasonCode)).json(result);
    return res.status(200).json(result);
  } catch {
    return res.status(500).json({ success: false, reasonCode: 'INTERNAL_ERROR' });
  }
}

export { classifyMembership, canRemoveTarget, isSafeDocumentId };
