import type { Request, Response } from 'express';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, Firestore, getFirestore } from 'firebase-admin/firestore';
import { isCanonicalGlobalRole } from '../../lib/permissionService.js';
import { CURRENT_PERMISSIONS_VERSION, PERMISSION_KEYS } from '../../lib/rbac.js';

type Dependencies = {
  verifyIdToken?: (token: string) => Promise<{ uid: string }>;
  getFirestore?: () => Firestore;
};

const ALLOWED_CAPABILITIES = new Set<string>([
  PERMISSION_KEYS.MUSIC_LIVE_CONDUCT,
]);

const INACTIVE_ORGANIZATION_STATUSES = new Set([
  'archived',
  'inactive',
  'suspended',
  'disabled',
]);

const INACTIVE_MEMBERSHIP_STATUSES = new Set([
  'suspended',
  'inactive',
  'removed',
  'revoked',
  'deleted',
  'archived',
]);

function isSafeDocumentId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 256 &&
    value !== '.' &&
    value !== '..' &&
    !value.includes('/') &&
    !/[\u0000-\u001F\u007F]/.test(value)
  );
}

function normalizeRole(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function isActiveMembership(data: FirebaseFirestore.DocumentData | undefined): boolean {
  if (!data) return false;
  const status = normalizeRole(data.status);
  return !INACTIVE_MEMBERSHIP_STATUSES.has(status) && (!status || status === 'active' || status === 'ativo');
}

function organizationOwnerMatches(
  organization: FirebaseFirestore.DocumentData,
  uid: string,
): boolean {
  return (
    organization.ownerUid === uid ||
    organization.ownerId === uid ||
    organization.owner_user_id === uid ||
    organization.ownerUserId === uid
  );
}

function actorCanManageMemberCapabilities(options: {
  actorGlobal: boolean;
  actorMetadataOwner: boolean;
  actorMembership: FirebaseFirestore.DocumentData | undefined;
}): boolean {
  if (options.actorGlobal || options.actorMetadataOwner) return true;
  if (!isActiveMembership(options.actorMembership)) return false;

  const role = normalizeRole(
    options.actorMembership?.organizationRole ?? options.actorMembership?.role,
  );
  if (role === 'owner' || role === 'admin') return true;

  return options.actorMembership?.permissions?.['organization.roles.manage'] === true;
}

async function authenticate(
  req: Request,
  dependencies: Dependencies,
): Promise<string | null> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ') || header.length <= 7) return null;
  try {
    const verify =
      dependencies.verifyIdToken ??
      ((token: string) => getAuth().verifyIdToken(token));
    const uid = (await verify(header.slice(7))).uid;
    return isSafeDocumentId(uid) ? uid : null;
  } catch {
    return null;
  }
}

export async function updateMusicScaleMemberCapability(
  req: Request,
  res: Response,
  dependencies: Dependencies = {},
) {
  const actorUid = await authenticate(req, dependencies);
  if (!actorUid) {
    return res
      .status(401)
      .json({ success: false, reasonCode: 'UNAUTHENTICATED' });
  }

  const organizationId = req.params.organizationId ?? req.params.orgId;
  const memberId = req.params.memberId;
  if (!isSafeDocumentId(organizationId) || !isSafeDocumentId(memberId)) {
    return res
      .status(400)
      .json({ success: false, reasonCode: 'INVALID_REQUEST_PATH' });
  }

  const capability = req.body?.capability;
  const enabled = req.body?.enabled;
  if (!ALLOWED_CAPABILITIES.has(capability)) {
    return res
      .status(400)
      .json({ success: false, reasonCode: 'INVALID_CAPABILITY' });
  }
  if (typeof enabled !== 'boolean') {
    return res
      .status(400)
      .json({ success: false, reasonCode: 'INVALID_ENABLED_VALUE' });
  }

  try {
    const db = (dependencies.getFirestore ?? getFirestore)();
    const auditRef = db
      .collection(`organizations/${organizationId}/audit_logs`)
      .doc();

    const result = await db.runTransaction(async (transaction) => {
      const orgRef = db.doc(`organizations/${organizationId}`);
      const actorUserRef = db.doc(`users/${actorUid}`);
      const actorMemberRef = db.doc(
        `organizations/${organizationId}/members/${actorUid}`,
      );
      const targetMemberRef = db.doc(
        `organizations/${organizationId}/members/${memberId}`,
      );
      const legacyUidOrgRef = db.doc(
        `organization_members/${memberId}_${organizationId}`,
      );
      const legacyOrgUidRef = db.doc(
        `organization_members/${organizationId}_${memberId}`,
      );

      const [orgSnap, actorUserSnap, actorMemberSnap, targetMemberSnap] =
        await Promise.all([
          transaction.get(orgRef),
          transaction.get(actorUserRef),
          transaction.get(actorMemberRef),
          transaction.get(targetMemberRef),
        ]);

      if (!orgSnap.exists) {
        return { success: false as const, reasonCode: 'ORGANIZATION_NOT_FOUND' };
      }

      const organization = orgSnap.data() ?? {};
      const organizationStatus = normalizeRole(organization.status);
      if (
        organization.archived === true ||
        INACTIVE_ORGANIZATION_STATUSES.has(organizationStatus)
      ) {
        return { success: false as const, reasonCode: 'ORGANIZATION_INACTIVE' };
      }

      if (!targetMemberSnap.exists || !isActiveMembership(targetMemberSnap.data())) {
        return { success: false as const, reasonCode: 'MEMBERSHIP_NOT_ACTIVE' };
      }

      const actorGlobal = isCanonicalGlobalRole(
        actorUserSnap.data()?.systemRole,
      );
      const actorMetadataOwner = organizationOwnerMatches(
        organization,
        actorUid,
      );
      if (
        !actorCanManageMemberCapabilities({
          actorGlobal,
          actorMetadataOwner,
          actorMembership: actorMemberSnap.data(),
        })
      ) {
        return { success: false as const, reasonCode: 'PERMISSION_DENIED' };
      }

      const targetData = targetMemberSnap.data() ?? {};
      const previousPermissions =
        targetData.permissions &&
        typeof targetData.permissions === 'object' &&
        !Array.isArray(targetData.permissions)
          ? targetData.permissions
          : {};

      const previousEnabled = previousPermissions[capability] === true;
      if (previousEnabled === enabled) {
        return {
          success: true as const,
          reasonCode: 'ALREADY_SET',
          capability,
          enabled,
        };
      }

      const permissions = {
        ...previousPermissions,
        [capability]: enabled,
      };

      const patch = {
        permissions,
        permissionsVersion: CURRENT_PERMISSIONS_VERSION,
        updatedAt: FieldValue.serverTimestamp(),
      };

      transaction.set(targetMemberRef, patch, { merge: true });
      transaction.set(
        legacyUidOrgRef,
        {
          uid: memberId,
          organizationId,
          status: targetData.status || 'active',
          ...patch,
        },
        { merge: true },
      );
      transaction.set(
        legacyOrgUidRef,
        {
          uid: memberId,
          organizationId,
          status: targetData.status || 'active',
          ...patch,
        },
        { merge: true },
      );

      transaction.set(auditRef, {
        action: 'musicscale.member.capability_updated',
        actorUid,
        memberId,
        organizationId,
        capability,
        previousEnabled,
        enabled,
        timestamp: FieldValue.serverTimestamp(),
      });

      return {
        success: true as const,
        reasonCode: 'CAPABILITY_UPDATED',
        capability,
        enabled,
      };
    });

    if (!result.success) {
      const status =
        result.reasonCode === 'PERMISSION_DENIED'
          ? 403
          : result.reasonCode === 'ORGANIZATION_NOT_FOUND'
            ? 404
            : result.reasonCode === 'MEMBERSHIP_NOT_ACTIVE' ||
                result.reasonCode === 'ORGANIZATION_INACTIVE'
              ? 409
              : 400;
      return res.status(status).json(result);
    }

    return res.status(200).json({
      ...result,
      organizationId,
      memberId,
      permissionsVersion: CURRENT_PERMISSIONS_VERSION,
    });
  } catch {
    return res
      .status(500)
      .json({ success: false, reasonCode: 'INTERNAL_ERROR' });
  }
}

export {
  actorCanManageMemberCapabilities,
  isActiveMembership,
  ALLOWED_CAPABILITIES,
};
