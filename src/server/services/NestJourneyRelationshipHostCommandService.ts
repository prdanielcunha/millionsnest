import type { Request, Response } from 'express';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, Firestore, getFirestore } from 'firebase-admin/firestore';
import { canManageTenantMembers } from '../../lib/permissionService.js';

type Dependencies = {
  verifyIdToken?: (token: string) => Promise<{ uid: string }>;
  getFirestore?: () => Firestore;
};

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

function journeyProductEnabled(organization: FirebaseFirestore.DocumentData) {
  const apps = organization.apps && typeof organization.apps === 'object'
    ? organization.apps as Record<string, unknown>
    : {};
  const raw = (apps.nestjourney ?? apps.raiz_e_mesa) as
    | Record<string, unknown>
    | string
    | undefined;
  if (!raw) return true;
  const status = normalize(typeof raw === 'string' ? raw : raw.status);
  return !status || !['inactive', 'disabled', 'suspended', 'cancelled', 'canceled'].includes(status);
}

function canManageRelationshipHost(options: {
  actorGlobal: boolean;
  actorMetadataOwner: boolean;
  actorMembership: FirebaseFirestore.DocumentData | undefined;
  congregationId: string;
}) {
  if (options.actorGlobal || options.actorMetadataOwner) return true;
  if (!isActiveMembership(options.actorMembership)) return false;

  const role = normalize(
    options.actorMembership?.organizationRole ?? options.actorMembership?.role,
  );
  const permissions =
    options.actorMembership?.permissions &&
    typeof options.actorMembership.permissions === 'object'
      ? options.actorMembership.permissions as Record<string, unknown>
      : {};
  const congregationIds = Array.isArray(options.actorMembership?.congregationIds)
    ? options.actorMembership?.congregationIds.filter(
        (value: unknown): value is string => typeof value === 'string',
      )
    : [];

  const capable =
    ['owner', 'admin', 'pastor', 'coordinator'].includes(role) ||
    permissions.canManagePresence === true ||
    permissions.canManagePeople === true;
  const broad = ['owner', 'admin', 'pastor'].includes(role);
  const inScope = broad || congregationIds.includes(options.congregationId);
  return capable && inScope;
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

export async function claimNestJourneyRelationshipHost(
  req: Request,
  res: Response,
  dependencies: Dependencies = {},
) {
  const actorUid = await authenticate(req, dependencies);
  if (!actorUid) {
    return res.status(401).json({ success: false, reasonCode: 'UNAUTHENTICATED' });
  }

  const organizationId = req.params.organizationId ?? req.params.orgId;
  const personId = req.params.personId;
  if (!isSafeDocumentId(organizationId) || !isSafeDocumentId(personId)) {
    return res.status(400).json({ success: false, reasonCode: 'INVALID_REQUEST_PATH' });
  }

  try {
    const db = (dependencies.getFirestore ?? getFirestore)();
    const result = await db.runTransaction(async transaction => {
      const orgRef = db.doc(`organizations/${organizationId}`);
      const actorUserRef = db.doc(`users/${actorUid}`);
      const actorMemberRef = db.doc(`organizations/${organizationId}/members/${actorUid}`);
      const personRef = db.doc(
        `organizations/${organizationId}/products/raiz_e_mesa/people/${personId}`,
      );

      const [orgSnap, actorUserSnap, actorMemberSnap, personSnap] = await Promise.all([
        transaction.get(orgRef),
        transaction.get(actorUserRef),
        transaction.get(actorMemberRef),
        transaction.get(personRef),
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
      if (!journeyProductEnabled(organization)) {
        return { success: false as const, reasonCode: 'NESTJOURNEY_INACTIVE' };
      }
      if (!personSnap.exists) {
        return { success: false as const, reasonCode: 'PERSON_NOT_FOUND' };
      }

      const person = personSnap.data() ?? {};
      if (normalize(person.organizationId) !== normalize(organizationId)) {
        return { success: false as const, reasonCode: 'PERSON_TENANT_MISMATCH' };
      }
      const congregationId = typeof person.congregationId === 'string'
        ? person.congregationId
        : '';
      if (!isSafeDocumentId(congregationId)) {
        return { success: false as const, reasonCode: 'PERSON_SCOPE_INVALID' };
      }

      const actorGlobal = canManageTenantMembers(actorUserSnap.data()?.systemRole);
      const actorMetadataOwner = organizationOwnerMatches(organization, actorUid);
      if (!canManageRelationshipHost({
        actorGlobal,
        actorMetadataOwner,
        actorMembership: actorMemberSnap.data(),
        congregationId,
      })) {
        return { success: false as const, reasonCode: 'PERMISSION_DENIED' };
      }

      const currentHost = typeof person.bondHostRef === 'string'
        ? person.bondHostRef.trim()
        : '';
      if (currentHost) {
        if (currentHost === actorUid) {
          return {
            success: true as const,
            reasonCode: 'ALREADY_ASSIGNED',
            bondHostRef: currentHost,
            congregationId,
          };
        }
        return {
          success: false as const,
          reasonCode: 'BOND_ALREADY_ASSIGNED',
          bondHostRef: currentHost,
        };
      }

      const factId = `bond-host-${personId}-${actorUid}`;
      const factRef = db.doc(
        `organizations/${organizationId}/products/raiz_e_mesa/facts/${factId}`,
      );
      const auditRef = db.collection(
        `organizations/${organizationId}/audit_logs`,
      ).doc();

      transaction.update(personRef, {
        bondHostRef: actorUid,
        bondAssignedAt: FieldValue.serverTimestamp(),
        bondAssignedBy: actorUid,
      });
      transaction.set(factRef, {
        eventId: factId,
        eventType: 'BOND_HOST_ASSIGNED',
        occurredAt: FieldValue.serverTimestamp(),
        recordedAt: FieldValue.serverTimestamp(),
        organizationId,
        actorId: actorUid,
        subjectRef: `person:${personId}`,
        sourceApp: 'nestjourney',
        scope: `congregation:${congregationId}`,
        evidenceRef: `person:${personId}`,
        sensitivity: 'confidential',
        version: 1,
        payload: {
          personId,
          bondHostRef: actorUid,
        },
      });
      transaction.set(auditRef, {
        action: 'nestjourney.person.relationship_host_assigned',
        actorUid,
        organizationId,
        congregationId,
        personId,
        bondHostRef: actorUid,
        timestamp: FieldValue.serverTimestamp(),
      });

      return {
        success: true as const,
        reasonCode: 'BOND_HOST_ASSIGNED',
        bondHostRef: actorUid,
        congregationId,
      };
    });

    if (!result.success) {
      const status =
        result.reasonCode === 'PERMISSION_DENIED' ? 403 :
        result.reasonCode === 'ORGANIZATION_NOT_FOUND' ||
        result.reasonCode === 'PERSON_NOT_FOUND' ? 404 :
        result.reasonCode === 'BOND_ALREADY_ASSIGNED' ||
        result.reasonCode === 'ORGANIZATION_INACTIVE' ||
        result.reasonCode === 'NESTJOURNEY_INACTIVE' ? 409 :
        400;
      return res.status(status).json(result);
    }

    return res.status(200).json({
      ...result,
      organizationId,
      personId,
    });
  } catch {
    return res.status(500).json({ success: false, reasonCode: 'INTERNAL_ERROR' });
  }
}

export {
  canManageRelationshipHost,
  isActiveMembership,
};
