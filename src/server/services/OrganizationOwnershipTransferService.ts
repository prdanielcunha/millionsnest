import type { Request, Response } from 'express';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, Firestore, getFirestore } from 'firebase-admin/firestore';
import { canTransferTenantOwnership } from '../../lib/permissionService.js';
import { CURRENT_PERMISSIONS_VERSION, getDefaultPermissions } from '../../lib/rbac.js';

type Dependencies = {
  verifyIdToken?: (token: string) => Promise<{ uid: string }>;
  getFirestore?: () => Firestore;
};

type PreviousOwnerRole = 'admin' | 'manager' | 'member' | 'viewer';

const PREVIOUS_OWNER_ROLES = new Set<PreviousOwnerRole>(['admin', 'manager', 'member', 'viewer']);

function safeId(value: unknown): value is string {
  return typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 256 &&
    value !== '.' &&
    value !== '..' &&
    !value.includes('/') &&
    !value.includes('\\') &&
    !/[\u0000-\u001F\u007F]/.test(value);
}

function ownerCandidates(data: FirebaseFirestore.DocumentData | undefined): string[] {
  return Array.from(new Set([
    data?.ownerUid,
    data?.ownerUserId,
    data?.ownerId,
    data?.owner_user_id,
  ].map(value => String(value || '').trim()).filter(Boolean)));
}

function membershipRole(data: FirebaseFirestore.DocumentData | undefined): string {
  return String(data?.organizationRole ?? data?.role ?? '').trim().toLowerCase();
}

function membershipActive(data: FirebaseFirestore.DocumentData | undefined): boolean {
  const status = String(data?.status ?? 'active').trim().toLowerCase();
  return !!data && (!status || status === 'active' || status === 'ativo');
}

async function authenticate(req: Request, dependencies: Dependencies): Promise<string | null> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ') || header.length <= 7) return null;
  try {
    const verify = dependencies.verifyIdToken ?? ((token: string) => getAuth().verifyIdToken(token));
    const decoded = await verify(header.slice(7));
    return safeId(decoded.uid) ? decoded.uid : null;
  } catch {
    return null;
  }
}

export async function transferOrganizationOwnership(
  req: Request,
  res: Response,
  dependencies: Dependencies = {}
) {
  const actorUid = await authenticate(req, dependencies);
  if (!actorUid) {
    return res.status(401).json({ success: false, reasonCode: 'UNAUTHENTICATED' });
  }

  const organizationId = req.params.organizationId ?? req.params.orgId;
  const newOwnerMemberId = String(req.body?.newOwnerMemberId || '').trim();
  const previousOwnerRoleRaw = String(req.body?.previousOwnerRole || 'admin').trim().toLowerCase();
  const reason = String(req.body?.reason || '').trim();

  if (!safeId(organizationId) || !safeId(newOwnerMemberId)) {
    return res.status(400).json({ success: false, reasonCode: 'INVALID_REQUEST_PATH' });
  }
  if (!PREVIOUS_OWNER_ROLES.has(previousOwnerRoleRaw as PreviousOwnerRole)) {
    return res.status(400).json({ success: false, reasonCode: 'INVALID_PREVIOUS_OWNER_ROLE' });
  }

  try {
    const db = (dependencies.getFirestore ?? getFirestore)();
    const result = await db.runTransaction(async transaction => {
      const orgRef = db.doc(`organizations/${organizationId}`);
      const actorUserRef = db.doc(`users/${actorUid}`);
      const actorMemberRef = db.doc(`organizations/${organizationId}/members/${actorUid}`);
      const newOwnerMemberRef = db.doc(`organizations/${organizationId}/members/${newOwnerMemberId}`);
      const newOwnerUserRef = db.doc(`users/${newOwnerMemberId}`);

      const [orgSnap, actorUserSnap, actorMemberSnap, newOwnerMemberSnap, newOwnerUserSnap] = await Promise.all([
        transaction.get(orgRef),
        transaction.get(actorUserRef),
        transaction.get(actorMemberRef),
        transaction.get(newOwnerMemberRef),
        transaction.get(newOwnerUserRef),
      ]);

      if (!orgSnap.exists) {
        return { status: 404, payload: { success: false, reasonCode: 'ORGANIZATION_NOT_FOUND' } };
      }

      const organization = orgSnap.data() || {};
      if (organization.status === 'archived' || organization.archived === true) {
        return { status: 409, payload: { success: false, reasonCode: 'ORGANIZATION_INACTIVE' } };
      }

      const actorSystemRole = actorUserSnap.data()?.systemRole;
      const globalAuthority = canTransferTenantOwnership(actorSystemRole);
      const existingOwners = ownerCandidates(organization);
      const actorIsMetadataOwner = existingOwners.includes(actorUid);
      const actorMembership = actorMemberSnap.data();
      const actorIsActiveOwner = membershipActive(actorMembership) && membershipRole(actorMembership) === 'owner';

      if (!globalAuthority && !(actorIsMetadataOwner && actorIsActiveOwner)) {
        return { status: 403, payload: { success: false, reasonCode: 'PERMISSION_DENIED' } };
      }

      if (globalAuthority && reason.length < 8) {
        return { status: 400, payload: { success: false, reasonCode: 'GLOBAL_REASON_REQUIRED' } };
      }
      if (reason.length > 500) {
        return { status: 400, payload: { success: false, reasonCode: 'REASON_TOO_LONG' } };
      }

      if (!newOwnerMemberSnap.exists || !membershipActive(newOwnerMemberSnap.data())) {
        return { status: 409, payload: { success: false, reasonCode: 'NEW_OWNER_MEMBERSHIP_INACTIVE' } };
      }

      if (existingOwners.length === 1 && existingOwners[0] === newOwnerMemberId && membershipRole(newOwnerMemberSnap.data()) === 'owner') {
        return {
          status: 200,
          payload: {
            success: true,
            reasonCode: 'ALREADY_OWNER',
            organizationId,
            ownerUid: newOwnerMemberId,
          }
        };
      }

      const oldOwnerMemberRefs = existingOwners
        .filter(uid => uid !== newOwnerMemberId && safeId(uid))
        .map(uid => db.doc(`organizations/${organizationId}/members/${uid}`));
      const oldOwnerMemberSnaps = await Promise.all(oldOwnerMemberRefs.map(ref => transaction.get(ref)));

      const now = FieldValue.serverTimestamp();
      const previousOwnerRole = previousOwnerRoleRaw as PreviousOwnerRole;
      const newOwnerPermissions = getDefaultPermissions('owner');
      const previousOwnerPermissions = getDefaultPermissions(previousOwnerRole);

      transaction.set(orgRef, {
        ownerUid: newOwnerMemberId,
        ownerUserId: newOwnerMemberId,
        ownerId: newOwnerMemberId,
        owner_user_id: newOwnerMemberId,
        ownerEmail: newOwnerUserSnap.exists ? newOwnerUserSnap.data()?.email || null : null,
        ownerName: newOwnerUserSnap.exists ? newOwnerUserSnap.data()?.displayName || null : null,
        ownershipTransferredAt: now,
        ownershipTransferredBy: actorUid,
        updatedAt: now,
      }, { merge: true });

      const newOwnerPatch = {
        uid: newOwnerMemberId,
        organizationId,
        role: 'owner',
        organizationRole: 'owner',
        status: 'active',
        permissions: newOwnerPermissions,
        permissionsVersion: CURRENT_PERMISSIONS_VERSION,
        updatedAt: now,
      };
      transaction.set(newOwnerMemberRef, newOwnerPatch, { merge: true });
      transaction.set(db.doc(`organization_members/${newOwnerMemberId}_${organizationId}`), newOwnerPatch, { merge: true });
      transaction.set(db.doc(`organization_members/${organizationId}_${newOwnerMemberId}`), newOwnerPatch, { merge: true });

      oldOwnerMemberSnaps.forEach((snap, index) => {
        if (!snap.exists) return;
        const previousOwnerId = oldOwnerMemberRefs[index].id;
        const patch = {
          uid: previousOwnerId,
          organizationId,
          role: previousOwnerRole,
          organizationRole: previousOwnerRole,
          status: 'active',
          permissions: previousOwnerPermissions,
          permissionsVersion: CURRENT_PERMISSIONS_VERSION,
          updatedAt: now,
        };
        transaction.set(oldOwnerMemberRefs[index], patch, { merge: true });
        transaction.set(db.doc(`organization_members/${previousOwnerId}_${organizationId}`), patch, { merge: true });
        transaction.set(db.doc(`organization_members/${organizationId}_${previousOwnerId}`), patch, { merge: true });
      });

      transaction.set(orgRef.collection('audit_logs').doc(), {
        action: 'organization.ownership.transferred',
        actorUid,
        actorSystemRole: actorSystemRole || null,
        governanceScope: globalAuthority ? 'ecosystem_global' : 'organization',
        organizationId,
        previousOwnerUids: existingOwners,
        newOwnerUid: newOwnerMemberId,
        previousOwnerRole,
        reason: reason || null,
        timestamp: now,
      });

      return {
        status: 200,
        payload: {
          success: true,
          reasonCode: 'OWNERSHIP_TRANSFERRED',
          organizationId,
          previousOwnerUids: existingOwners,
          ownerUid: newOwnerMemberId,
          previousOwnerRole,
        }
      };
    });

    return res.status(result.status).json(result.payload);
  } catch (error) {
    console.error('[OrganizationOwnershipTransfer] Failed', error);
    return res.status(500).json({ success: false, reasonCode: 'INTERNAL_ERROR' });
  }
}
