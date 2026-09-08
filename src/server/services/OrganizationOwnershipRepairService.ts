import type { Request, Response } from 'express';
import admin from 'firebase-admin';
import { CURRENT_PERMISSIONS_VERSION, getDefaultPermissions } from '../../lib/rbac.js';
import { isCanonicalGlobalRole } from '../../lib/permissionService.js';

type Deps = {
  verifyIdToken: (token: string) => Promise<{ uid: string }>;
  getFirestore: () => FirebaseFirestore.Firestore | null;
};

const unsafeSegment = (value: unknown) => {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return !normalized || normalized.length > 256 || normalized.includes('/') || normalized.includes('\\');
};

const canonicalRepairRoles = new Set(['admin', 'manager', 'member', 'viewer']);

const existingRole = (data: FirebaseFirestore.DocumentData | undefined) =>
  String(data?.organizationRole ?? data?.role ?? '').trim().toLowerCase();

const ownerCandidates = (organization: FirebaseFirestore.DocumentData | undefined) =>
  [
    organization?.ownerUid,
    organization?.ownerUserId,
    organization?.ownerId,
    organization?.owner_user_id,
  ]
    .map(value => String(value || '').trim())
    .filter(Boolean);

export async function repairOrganizationOwnership(
  req: Request,
  res: Response,
  deps: Deps,
) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, reasonCode: 'UNAUTHENTICATED' });
  }

  let decoded: { uid: string };
  try {
    decoded = await deps.verifyIdToken(authHeader.slice('Bearer '.length));
  } catch {
    return res.status(401).json({ success: false, reasonCode: 'UNAUTHENTICATED' });
  }

  const organizationId = String(req.params.organizationId || '').trim();
  const targetMemberId = String(req.body?.targetMemberId || '').trim();
  const targetRole = String(req.body?.targetRole || '').trim().toLowerCase();

  if (unsafeSegment(organizationId) || unsafeSegment(targetMemberId)) {
    return res.status(400).json({ success: false, reasonCode: 'INVALID_REQUEST_PATH' });
  }
  if (!canonicalRepairRoles.has(targetRole)) {
    return res.status(400).json({ success: false, reasonCode: 'INVALID_TARGET_ROLE' });
  }
  if (targetMemberId === decoded.uid) {
    return res.status(403).json({ success: false, reasonCode: 'SELF_REPAIR_DENIED' });
  }

  const db = deps.getFirestore();
  if (!db) {
    return res.status(503).json({ success: false, reasonCode: 'SERVICE_UNAVAILABLE' });
  }

  try {
    const result = await db.runTransaction(async transaction => {
      const orgRef = db.collection('organizations').doc(organizationId);
      const actorUserRef = db.collection('users').doc(decoded.uid);
      const actorMemberRef = orgRef.collection('members').doc(decoded.uid);
      const targetMemberRef = orgRef.collection('members').doc(targetMemberId);

      const [orgSnap, actorUserSnap, actorMemberSnap, targetMemberSnap] = await Promise.all([
        transaction.get(orgRef),
        transaction.get(actorUserRef),
        transaction.get(actorMemberRef),
        transaction.get(targetMemberRef),
      ]);

      if (!orgSnap.exists) {
        return { status: 404, payload: { success: false, reasonCode: 'ORGANIZATION_NOT_FOUND' } };
      }
      if (!actorUserSnap.exists || !actorMemberSnap.exists || !targetMemberSnap.exists) {
        return { status: 404, payload: { success: false, reasonCode: 'MEMBERSHIP_NOT_FOUND' } };
      }

      const organization = orgSnap.data() || {};
      const actorUser = actorUserSnap.data() || {};
      const actorMember = actorMemberSnap.data() || {};
      const targetMember = targetMemberSnap.data() || {};

      if (!isCanonicalGlobalRole(actorUser.systemRole)) {
        return { status: 403, payload: { success: false, reasonCode: 'GLOBAL_AUTHORITY_REQUIRED' } };
      }
      if (actorMember.status && actorMember.status !== 'active') {
        return { status: 409, payload: { success: false, reasonCode: 'ACTOR_MEMBERSHIP_INACTIVE' } };
      }
      if (existingRole(actorMember) !== 'owner') {
        return { status: 403, payload: { success: false, reasonCode: 'OWNER_MEMBERSHIP_REQUIRED' } };
      }
      if (targetMember.status && targetMember.status !== 'active') {
        return { status: 409, payload: { success: false, reasonCode: 'TARGET_MEMBERSHIP_INACTIVE' } };
      }

      const previousOwnerUids = ownerCandidates(organization);
      if (!previousOwnerUids.includes(targetMemberId)) {
        return { status: 409, payload: { success: false, reasonCode: 'TARGET_NOT_AUTHORITATIVE_OWNER' } };
      }

      const now = admin.firestore.FieldValue.serverTimestamp();

      transaction.set(orgRef, {
        ownerUid: decoded.uid,
        ownerUserId: decoded.uid,
        ownerId: decoded.uid,
        owner_user_id: decoded.uid,
        ownerEmail: actorUser.email || null,
        ownerName: actorUser.displayName || null,
        ownershipRepairedAt: now,
        ownershipRepairedBy: decoded.uid,
        updatedAt: now,
      }, { merge: true });

      const ownerPatch = {
        uid: decoded.uid,
        organizationId,
        role: 'owner',
        organizationRole: 'owner',
        status: 'active',
        permissions: getDefaultPermissions('owner'),
        permissionsVersion: CURRENT_PERMISSIONS_VERSION,
        updatedAt: now,
      };
      const targetPatch = {
        uid: targetMemberId,
        organizationId,
        role: targetRole,
        organizationRole: targetRole,
        status: 'active',
        permissions: getDefaultPermissions(targetRole),
        permissionsVersion: CURRENT_PERMISSIONS_VERSION,
        updatedAt: now,
      };

      transaction.set(actorMemberRef, ownerPatch, { merge: true });
      transaction.set(targetMemberRef, targetPatch, { merge: true });
      transaction.set(db.collection('organization_members').doc(`${decoded.uid}_${organizationId}`), ownerPatch, { merge: true });
      transaction.set(db.collection('organization_members').doc(`${organizationId}_${decoded.uid}`), ownerPatch, { merge: true });
      transaction.set(db.collection('organization_members').doc(`${targetMemberId}_${organizationId}`), targetPatch, { merge: true });
      transaction.set(db.collection('organization_members').doc(`${organizationId}_${targetMemberId}`), targetPatch, { merge: true });

      transaction.set(orgRef.collection('audit_logs').doc(), {
        action: 'organization.ownership.repaired',
        actorUid: decoded.uid,
        actorSystemRole: actorUser.systemRole,
        previousOwnerUids,
        repairedOwnerUid: decoded.uid,
        demotedMemberUid: targetMemberId,
        demotedMemberRole: targetRole,
        timestamp: now,
      });

      return {
        status: 200,
        payload: {
          success: true,
          reasonCode: 'OWNERSHIP_REPAIRED',
          organizationId,
          ownerUid: decoded.uid,
          targetMemberId,
          targetRole,
        },
      };
    });

    return res.status(result.status).json(result.payload);
  } catch (error) {
    console.error('[OrganizationOwnershipRepair] Failed', error);
    return res.status(500).json({ success: false, reasonCode: 'INTERNAL_ERROR' });
  }
}
