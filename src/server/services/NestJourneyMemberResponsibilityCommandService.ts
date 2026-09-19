import type { Request, Response } from 'express';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, Firestore, getFirestore } from 'firebase-admin/firestore';
import { canManageTenantMembers } from '../../lib/permissionService.js';

type Dependencies = {
  verifyIdToken?: (token: string) => Promise<{ uid: string }>;
  getFirestore?: () => Firestore;
};

export const NESTJOURNEY_RESPONSIBILITIES = new Set([
  'member',
  'presence_host',
  'mesa_team',
  'caregiver',
  'group_leader',
  'discipler',
  'coordinator',
  'pastor',
] as const);

export type NestJourneyResponsibility =
  | 'member'
  | 'presence_host'
  | 'mesa_team'
  | 'caregiver'
  | 'group_leader'
  | 'discipler'
  | 'coordinator'
  | 'pastor';

const INACTIVE_ORGANIZATION_STATUSES = new Set([
  'archived', 'inactive', 'suspended', 'disabled',
]);

const INACTIVE_MEMBERSHIP_STATUSES = new Set([
  'suspended', 'inactive', 'removed', 'revoked', 'deleted', 'archived',
]);

function normalize(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function isSafeDocumentId(value: unknown): value is string {
  return typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 256 &&
    value !== '.' &&
    value !== '..' &&
    !value.includes('/') &&
    !/[\u0000-\u001F\u007F]/.test(value);
}

function isActiveMembership(data: FirebaseFirestore.DocumentData | undefined) {
  if (!data) return false;
  const status = normalize(data.status);
  return !INACTIVE_MEMBERSHIP_STATUSES.has(status) &&
    (!status || status === 'active' || status === 'ativo');
}

function organizationOwnerMatches(
  organization: FirebaseFirestore.DocumentData,
  uid: string,
) {
  return organization.ownerUid === uid ||
    organization.ownerId === uid ||
    organization.owner_user_id === uid ||
    organization.ownerUserId === uid;
}

function actorCanManageJourneyResponsibilities(options: {
  actorGlobal: boolean;
  actorMetadataOwner: boolean;
  actorMembership: FirebaseFirestore.DocumentData | undefined;
}) {
  if (options.actorGlobal || options.actorMetadataOwner) return true;
  if (!isActiveMembership(options.actorMembership)) return false;
  const role = normalize(
    options.actorMembership?.organizationRole ?? options.actorMembership?.role,
  );
  return role === 'owner' ||
    role === 'admin' ||
    options.actorMembership?.permissions?.['organization.roles.manage'] === true;
}

async function authenticate(req: Request, dependencies: Dependencies) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ') || header.length <= 7) return null;
  try {
    const verify = dependencies.verifyIdToken ??
      ((token: string) => getAuth().verifyIdToken(token));
    const uid = (await verify(header.slice(7))).uid;
    return isSafeDocumentId(uid) ? uid : null;
  } catch {
    return null;
  }
}

export async function updateNestJourneyMemberResponsibility(
  req: Request,
  res: Response,
  dependencies: Dependencies = {},
) {
  const actorUid = await authenticate(req, dependencies);
  if (!actorUid) {
    return res.status(401).json({ success: false, reasonCode: 'UNAUTHENTICATED' });
  }

  const organizationId = req.params.organizationId ?? req.params.orgId;
  const memberId = req.params.memberId;
  if (!isSafeDocumentId(organizationId) || !isSafeDocumentId(memberId)) {
    return res.status(400).json({ success: false, reasonCode: 'INVALID_REQUEST_PATH' });
  }

  const responsibility = normalize(req.body?.responsibility) as NestJourneyResponsibility;
  if (!NESTJOURNEY_RESPONSIBILITIES.has(responsibility)) {
    return res.status(400).json({ success: false, reasonCode: 'INVALID_RESPONSIBILITY' });
  }
  const requestedCongregationIds = Array.isArray(req.body?.congregationIds)
    ? Array.from(new Set(
        req.body.congregationIds
          .filter((value: unknown): value is string => isSafeDocumentId(value))
          .map((value: string) => value.trim()),
      )).slice(0, 50)
    : null;
  if (Array.isArray(req.body?.congregationIds) && requestedCongregationIds?.length !== req.body.congregationIds.length) {
    return res.status(400).json({ success: false, reasonCode: 'INVALID_CONGREGATION_SCOPE' });
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
      const organizationStatus = normalize(organization.status);
      if (
        organization.archived === true ||
        INACTIVE_ORGANIZATION_STATUSES.has(organizationStatus)
      ) {
        return { success: false as const, reasonCode: 'ORGANIZATION_INACTIVE' };
      }

      if (!targetMemberSnap.exists || !isActiveMembership(targetMemberSnap.data())) {
        return { success: false as const, reasonCode: 'MEMBERSHIP_NOT_ACTIVE' };
      }

      const actorGlobal = canManageTenantMembers(actorUserSnap.data()?.systemRole);
      const actorMetadataOwner = organizationOwnerMatches(organization, actorUid);
      if (!actorCanManageJourneyResponsibilities({
        actorGlobal,
        actorMetadataOwner,
        actorMembership: actorMemberSnap.data(),
      })) {
        return { success: false as const, reasonCode: 'PERMISSION_DENIED' };
      }

      const targetData = targetMemberSnap.data() ?? {};
      const previousResponsibility = normalize(targetData.journeyRole) || 'member';
      const previousScopeSource = Array.isArray(targetData.journeyCongregationIds)
        ? targetData.journeyCongregationIds
        : Array.isArray(targetData.congregationIds)
          ? targetData.congregationIds
          : [];
      const previousCongregationIds = previousScopeSource
        .filter((value: unknown): value is string => typeof value === 'string');
      const congregationIds = requestedCongregationIds ?? previousCongregationIds;
      const sameScope =
        congregationIds.length === previousCongregationIds.length &&
        congregationIds.every((value, index) => value === previousCongregationIds[index]);
      if (previousResponsibility === responsibility && sameScope) {
        return {
          success: true as const,
          reasonCode: 'ALREADY_SET',
          responsibility,
          previousResponsibility,
          congregationIds,
        };
      }

      const patch = {
        journeyRole: responsibility,
        journeyCongregationIds: congregationIds,
        updatedAt: FieldValue.serverTimestamp(),
      };

      transaction.set(targetMemberRef, patch, { merge: true });
      transaction.set(legacyUidOrgRef, {
        uid: memberId,
        organizationId,
        status: targetData.status || 'active',
        ...patch,
      }, { merge: true });
      transaction.set(legacyOrgUidRef, {
        uid: memberId,
        organizationId,
        status: targetData.status || 'active',
        ...patch,
      }, { merge: true });

      transaction.set(auditRef, {
        action: 'nestjourney.member.responsibility_updated',
        actorUid,
        memberId,
        organizationId,
        previousResponsibility,
        responsibility,
        previousCongregationIds,
        congregationIds,
        timestamp: FieldValue.serverTimestamp(),
      });

      return {
        success: true as const,
        reasonCode: 'RESPONSIBILITY_UPDATED',
        responsibility,
        previousResponsibility,
        congregationIds,
      };
    });

    if (!result.success) {
      const status = result.reasonCode === 'PERMISSION_DENIED'
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
    });
  } catch {
    return res.status(500).json({ success: false, reasonCode: 'INTERNAL_ERROR' });
  }
}

export {
  actorCanManageJourneyResponsibilities,
  isActiveMembership,
};
