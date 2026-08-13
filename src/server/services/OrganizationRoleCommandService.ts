import type { Request, Response } from 'express';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, Firestore, getFirestore } from 'firebase-admin/firestore';
import { isCanonicalGlobalRole } from '../../lib/permissionService.js';
import { CURRENT_PERMISSIONS_VERSION, getDefaultPermissions } from '../../lib/rbac.js';

type Dependencies = {
  verifyIdToken?: (token: string) => Promise<{ uid: string }>;
  getFirestore?: () => Firestore;
};

type CanonicalRole = 'owner' | 'admin' | 'manager' | 'member' | 'viewer';
type AssignableRole = Exclude<CanonicalRole, 'owner'>;
type MembershipState =
  | { state: 'absent' }
  | { state: 'inactive' }
  | { state: 'inconsistent' }
  | { state: 'active'; role: CanonicalRole };

const CANONICAL_ROLES = new Set<CanonicalRole>(['owner', 'admin', 'manager', 'member', 'viewer']);
const ASSIGNABLE_ROLES = new Set<AssignableRole>(['admin', 'manager', 'member', 'viewer']);
const INACTIVE_STATUSES = new Set(['suspended', 'inactive', 'removed', 'revoked', 'deleted']);

function isSafeDocumentId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 256 &&
    value !== '.' && value !== '..' && !value.includes('/') && !/[\u0000-\u001F\u007F]/.test(value);
}

function normalizeRole(value: unknown): CanonicalRole | null {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return CANONICAL_ROLES.has(normalized as CanonicalRole) ? normalized as CanonicalRole : null;
}

function classifyMembership(data: FirebaseFirestore.DocumentData | undefined): MembershipState {
  if (!data) return { state: 'absent' };
  const status = typeof data.status === 'string' ? data.status.trim().toLowerCase() : '';
  if (INACTIVE_STATUSES.has(status)) return { state: 'inactive' };
  if (status && status !== 'active') return { state: 'inconsistent' };
  const role = normalizeRole(data.organizationRole ?? data.role);
  const otherRole = normalizeRole(data.role);
  const organizationRole = normalizeRole(data.organizationRole);
  if (!role || (otherRole && organizationRole && otherRole !== organizationRole)) return { state: 'inconsistent' };
  return { state: 'active', role };
}

function organizationOwnerMatches(organization: FirebaseFirestore.DocumentData, uid: string): boolean {
  return organization.ownerUid === uid || organization.ownerId === uid ||
    organization.owner_user_id === uid || organization.ownerUserId === uid;
}

function statusFor(reasonCode: string): number {
  if (reasonCode === 'ORGANIZATION_NOT_FOUND' || reasonCode === 'MEMBERSHIP_NOT_FOUND') return 404;
  if (reasonCode === 'PERMISSION_DENIED' || reasonCode === 'SELF_ROLE_CHANGE_DENIED') return 403;
  if (
    reasonCode === 'ORGANIZATION_INACTIVE' ||
    reasonCode === 'MEMBERSHIP_INACTIVE' ||
    reasonCode === 'MEMBERSHIP_STATE_INCONSISTENT' ||
    reasonCode === 'OWNER_ROLE_REQUIRES_TRANSFER' ||
    reasonCode === 'TARGET_ROLE_PROTECTED' ||
    reasonCode === 'ROLE_ASSIGNMENT_NOT_ALLOWED'
  ) return 409;
  return 400;
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

function roleDecision(options: {
  actorGlobal: boolean;
  actorMetadataOwner: boolean;
  actorMembership: MembershipState;
  targetRole: CanonicalRole;
  newRole: AssignableRole;
}): { allowed: true } | { allowed: false; reasonCode: string } {
  const { actorGlobal, actorMetadataOwner, actorMembership, targetRole, newRole } = options;
  if (targetRole === 'owner') return { allowed: false, reasonCode: 'OWNER_ROLE_REQUIRES_TRANSFER' };
  if (actorGlobal || actorMetadataOwner || (actorMembership.state === 'active' && actorMembership.role === 'owner')) {
    return { allowed: true };
  }
  if (actorMembership.state !== 'active' || actorMembership.role !== 'admin') {
    return { allowed: false, reasonCode: 'PERMISSION_DENIED' };
  }
  if (targetRole === 'admin') return { allowed: false, reasonCode: 'TARGET_ROLE_PROTECTED' };
  if (newRole === 'admin') return { allowed: false, reasonCode: 'ROLE_ASSIGNMENT_NOT_ALLOWED' };
  return { allowed: true };
}

export async function updateOrganizationMemberRole(
  req: Request,
  res: Response,
  dependencies: Dependencies = {}
) {
  const actorUid = await authenticate(req, dependencies);
  if (!actorUid) return res.status(401).json({ success: false, reasonCode: 'UNAUTHENTICATED' });

  const organizationId = req.params.organizationId ?? req.params.orgId;
  const memberId = req.params.memberId;
  if (!isSafeDocumentId(organizationId) || !isSafeDocumentId(memberId)) {
    return res.status(400).json({ success: false, reasonCode: 'INVALID_REQUEST_PATH' });
  }
  if (actorUid === memberId) {
    return res.status(403).json({ success: false, reasonCode: 'SELF_ROLE_CHANGE_DENIED' });
  }

  const requested = req.body?.organizationRole ?? req.body?.newRole;
  const newRole = normalizeRole(requested);
  if (!newRole) return res.status(400).json({ success: false, reasonCode: 'INVALID_ORGANIZATION_ROLE' });
  if (!ASSIGNABLE_ROLES.has(newRole as AssignableRole)) {
    return res.status(409).json({ success: false, reasonCode: 'OWNER_ROLE_REQUIRES_TRANSFER' });
  }

  try {
    const db = (dependencies.getFirestore ?? getFirestore)();
    const auditRef = db.collection(`organizations/${organizationId}/audit_logs`).doc();
    const result = await db.runTransaction(async transaction => {
      const orgRef = db.doc(`organizations/${organizationId}`);
      const actorUserRef = db.doc(`users/${actorUid}`);
      const actorMemberRef = db.doc(`organizations/${organizationId}/members/${actorUid}`);
      const targetMemberRef = db.doc(`organizations/${organizationId}/members/${memberId}`);
      const legacyUidOrgRef = db.doc(`organization_members/${memberId}_${organizationId}`);
      const legacyOrgUidRef = db.doc(`organization_members/${organizationId}_${memberId}`);

      const [orgSnap, actorUserSnap, actorMemberSnap, targetMemberSnap] = await Promise.all([
        transaction.get(orgRef), transaction.get(actorUserRef), transaction.get(actorMemberRef), transaction.get(targetMemberRef)
      ]);

      if (!orgSnap.exists) return { success: false as const, reasonCode: 'ORGANIZATION_NOT_FOUND' };
      const organization = orgSnap.data() ?? {};
      if (organization.status !== 'active') return { success: false as const, reasonCode: 'ORGANIZATION_INACTIVE' };

      const targetMembership = classifyMembership(targetMemberSnap.data());
      if (targetMembership.state === 'absent') return { success: false as const, reasonCode: 'MEMBERSHIP_NOT_FOUND' };
      if (targetMembership.state === 'inactive') return { success: false as const, reasonCode: 'MEMBERSHIP_INACTIVE' };
      if (targetMembership.state === 'inconsistent') return { success: false as const, reasonCode: 'MEMBERSHIP_STATE_INCONSISTENT' };
      if (organizationOwnerMatches(organization, memberId) || targetMembership.role === 'owner') {
        return { success: false as const, reasonCode: 'OWNER_ROLE_REQUIRES_TRANSFER' };
      }
      if (targetMembership.role === newRole) {
        return { success: true as const, reasonCode: 'ALREADY_ROLE', previousOrganizationRole: targetMembership.role, organizationRole: newRole };
      }

      const actorGlobal = isCanonicalGlobalRole(actorUserSnap.data()?.systemRole);
      const actorMetadataOwner = organizationOwnerMatches(organization, actorUid);
      const actorMembership = classifyMembership(actorMemberSnap.data());
      const decision = roleDecision({
        actorGlobal,
        actorMetadataOwner,
        actorMembership,
        targetRole: targetMembership.role,
        newRole: newRole as AssignableRole
      });
      if (decision.allowed === false) return { success: false as const, reasonCode: decision.reasonCode };

      const permissions = getDefaultPermissions(newRole);
      const patch = {
        role: newRole,
        organizationRole: newRole,
        permissions,
        permissionsVersion: CURRENT_PERMISSIONS_VERSION,
        updatedAt: FieldValue.serverTimestamp()
      };
      transaction.set(targetMemberRef, patch, { merge: true });
      transaction.set(legacyUidOrgRef, {
        uid: memberId, organizationId, status: 'active', ...patch
      }, { merge: true });
      transaction.set(legacyOrgUidRef, {
        uid: memberId, organizationId, status: 'active', ...patch
      }, { merge: true });
      transaction.set(auditRef, {
        action: 'organization.member.role_updated',
        actorUid,
        memberId,
        organizationId,
        previousOrganizationRole: targetMembership.role,
        organizationRole: newRole,
        timestamp: FieldValue.serverTimestamp()
      });

      return {
        success: true as const,
        reasonCode: 'ROLE_UPDATED',
        previousOrganizationRole: targetMembership.role,
        organizationRole: newRole
      };
    });

    if (!result.success) return res.status(statusFor(result.reasonCode)).json(result);
    return res.status(200).json({ success: true, ...result, organizationId, memberId });
  } catch {
    return res.status(500).json({ success: false, reasonCode: 'INTERNAL_ERROR' });
  }
}

export { classifyMembership, roleDecision, normalizeRole };
