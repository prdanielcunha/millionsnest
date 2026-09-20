import type { Request, Response } from 'express';
import type * as admin from 'firebase-admin';
import {
  resolveEcosystemAppAccess,
  type ResolvedAppAccess
} from './EcosystemAccessResolver.js';
import {
  EMPTY_NESTJOURNEY_CAPABILITIES,
  emptyNestJourneyQueue,
  hasNestJourneyOperationalCapability,
  type NestJourneyOperationalCapabilities,
  type NestJourneyQueueSummary,
  type NestJourneyResponsibility,
  type NestJourneyWorkspaceProjection
} from '../../lib/nestJourneyWorkspaceProjection.js';
import type { FactEvidenceReference } from '../../packages/events/factContract.js';

const JOURNEY_RESPONSIBILITIES = new Set<NestJourneyResponsibility>([
  'member',
  'presence_host',
  'mesa_team',
  'caregiver',
  'group_leader',
  'discipler',
  'coordinator',
  'pastor'
]);

const CAPABILITY_KEYS = [
  'canManagePresence',
  'canManageMesa',
  'canManagePeople',
  'canManageCare',
  'canManageGroups',
  'canManageDiscipleship',
  'canManageImplementation',
  'canManagePastoral',
  'canViewGovernance',
  'canCoordinateJourney'
] as const;

const BROAD_ORGANIZATION_ROLES = new Set([
  'owner',
  'admin',
  'pastor',
  'data_admin'
]);

type Dependencies = {
  verifyIdToken: (token: string) => Promise<{ uid: string }>;
  getDb: () => admin.firestore.Firestore | null;
  resolveAccess?: typeof resolveEcosystemAppAccess;
  now?: () => number;
  logger?: Pick<Console, 'warn' | 'error'>;
};

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalize(value: unknown): string {
  return clean(value).toLowerCase();
}

function safeDocumentId(value: unknown): value is string {
  return typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 256 &&
    value !== '.' &&
    value !== '..' &&
    !value.includes('/') &&
    !value.includes('\\') &&
    !/[\u0000-\u001F\u007F]/.test(value);
}

function activeMembership(data: FirebaseFirestore.DocumentData | undefined) {
  if (!data) return false;
  const status = normalize(data.status);
  return !['suspended', 'inactive', 'removed', 'revoked', 'deleted', 'archived', 'disabled'].includes(status);
}

function responsibilityFromMembership(
  membership: FirebaseFirestore.DocumentData | undefined
): NestJourneyResponsibility {
  const value = normalize(membership?.journeyRole) as NestJourneyResponsibility;
  return JOURNEY_RESPONSIBILITIES.has(value) ? value : 'member';
}

export function capabilitiesFromMembership(
  membership: FirebaseFirestore.DocumentData | undefined
): NestJourneyOperationalCapabilities {
  const permissions =
    membership?.permissions && typeof membership.permissions === 'object'
      ? membership.permissions as Record<string, unknown>
      : {};

  return CAPABILITY_KEYS.reduce(
    (result, key) => {
      result[key] = permissions[key] === true;
      return result;
    },
    { ...EMPTY_NESTJOURNEY_CAPABILITIES }
  );
}

function congregationIdsFromMembership(
  membership: FirebaseFirestore.DocumentData | undefined
): string[] {
  if (!Array.isArray(membership?.congregationIds)) return [];

  return Array.from(new Set(
    membership.congregationIds
      .filter((value: unknown): value is string => typeof value === 'string')
      .map((value: string) => value.trim())
      .filter(Boolean)
  ));
}

function timestampToMs(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (value && typeof value === 'object') {
    const candidate = value as {
      toMillis?: () => number;
      seconds?: number;
    };
    if (typeof candidate.toMillis === 'function') {
      const millis = candidate.toMillis();
      return Number.isFinite(millis) ? millis : null;
    }
    if (typeof candidate.seconds === 'number' && Number.isFinite(candidate.seconds)) {
      return candidate.seconds * 1000;
    }
  }
  return null;
}

function queueEvidence(input: {
  organizationId: string;
  sourceRef: string;
  entityId: string;
  observedAtMs: number;
  fieldPaths: readonly string[];
}): FactEvidenceReference {
  return {
    organizationId: input.organizationId,
    sourceApp: 'nestjourney',
    sourceKind: 'backend_api',
    sourceRef: input.sourceRef,
    entityType: 'followup_queue',
    entityId: input.entityId,
    fieldPaths: input.fieldPaths,
    observedAtMs: input.observedAtMs
  };
}

export function summarizeJourneyQueue(input: {
  organizationId: string;
  sourceRef: string;
  entityId: string;
  observedAtMs: number;
  dueAtValues: readonly unknown[];
}): NestJourneyQueueSummary {
  const dueAtMs = input.dueAtValues
    .map(timestampToMs)
    .filter((value): value is number => value !== null)
    .sort((a, b) => a - b);

  if (input.dueAtValues.length === 0) return emptyNestJourneyQueue();

  const dueSoonBoundary = input.observedAtMs + 24 * 60 * 60 * 1000;

  return {
    count: input.dueAtValues.length,
    overdueCount: dueAtMs.filter(value => value < input.observedAtMs).length,
    dueSoonCount: dueAtMs.filter(
      value => value >= input.observedAtMs && value <= dueSoonBoundary
    ).length,
    earliestDueAtMs: dueAtMs[0] ?? null,
    evidence: [queueEvidence({
      organizationId: input.organizationId,
      sourceRef: input.sourceRef,
      entityId: input.entityId,
      observedAtMs: input.observedAtMs,
      fieldPaths: [
        'count',
        'overdueCount',
        'dueSoonCount',
        'earliestDueAtMs'
      ]
    })]
  };
}

function canAccessCongregation(
  congregationId: string,
  broad: boolean,
  congregationIds: ReadonlySet<string>
): boolean {
  return broad || (Boolean(congregationId) && congregationIds.has(congregationId));
}

function emptyProjection(input: {
  organizationId: string;
  observedAtMs: number;
  access?: Partial<ResolvedAppAccess> | null;
  ready?: boolean;
}): NestJourneyWorkspaceProjection {
  return {
    appId: 'nestjourney',
    organizationId: input.organizationId,
    accessible: input.access?.accessible === true,
    isGlobalAccess: input.access?.isGlobalAccess === true,
    decisionState: input.access?.accessible === true ? 'granted' : 'denied',
    denialReason: clean(input.access?.denialReason) || null,
    responsibility: 'member',
    canReadJourneyOperational: false,
    capabilities: { ...EMPTY_NESTJOURNEY_CAPABILITIES },
    congregationIds: [],
    ready: input.ready ?? true,
    observedAtMs: input.observedAtMs,
    assignedFirstContacts: emptyNestJourneyQueue(),
    unassignedFirstContacts: emptyNestJourneyQueue()
  };
}

function noStore(res: Response) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
}

export async function handleNestJourneyWorkspaceProjectionRequest(
  req: Request,
  res: Response,
  dependencies: Dependencies
) {
  noStore(res);

  const authHeader = req.headers.authorization;
  if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, code: 'UNAUTHORIZED' });
  }

  const token = authHeader.slice(7).trim();
  if (!token) return res.status(401).json({ success: false, code: 'UNAUTHORIZED' });

  let uid: string;
  try {
    uid = (await dependencies.verifyIdToken(token)).uid;
  } catch {
    return res.status(401).json({ success: false, code: 'UNAUTHORIZED' });
  }

  const organizationId = clean(req.query.organizationId);
  if (!safeDocumentId(uid) || !safeDocumentId(organizationId)) {
    return res.status(400).json({ success: false, code: 'INVALID_REQUEST' });
  }

  const observedAtMs = (dependencies.now ?? Date.now)();
  const db = dependencies.getDb();
  if (!db) {
    return res.status(503).json({ success: false, code: 'SERVICE_UNAVAILABLE' });
  }

  try {
    const access = await (dependencies.resolveAccess ?? resolveEcosystemAppAccess)({
      uid,
      organizationId,
      appId: 'nestjourney',
      db
    });

    if (!access.accessible) {
      return res.status(200).json({
        success: true,
        projection: emptyProjection({
          organizationId,
          observedAtMs,
          access
        })
      });
    }

    // Global governance can validate/preview the product, but it does not become
    // Journey ministry-content authority merely because the actor is CEO/admin.
    if (access.isGlobalAccess) {
      return res.status(200).json({
        success: true,
        projection: emptyProjection({
          organizationId,
          observedAtMs,
          access
        })
      });
    }

    const memberSnapshot = await db
      .doc(`organizations/${organizationId}/members/${uid}`)
      .get();
    const membership = memberSnapshot.exists ? memberSnapshot.data() : undefined;

    if (!activeMembership(membership)) {
      return res.status(200).json({
        success: true,
        projection: emptyProjection({
          organizationId,
          observedAtMs,
          access: {
            ...access,
            accessible: false,
            denialReason: 'MEMBERSHIP_INACTIVE'
          }
        })
      });
    }

    const capabilities = capabilitiesFromMembership(membership);
    const canReadJourneyOperational = hasNestJourneyOperationalCapability(capabilities);
    const responsibility = responsibilityFromMembership(membership);
    const congregationIds = congregationIdsFromMembership(membership);
    const congregationScope = new Set(congregationIds);
    const organizationRole = normalize(
      membership?.organizationRole ?? membership?.role ?? access.organizationRole
    );
    const broadScope = BROAD_ORGANIZATION_ROLES.has(organizationRole);

    if (!canReadJourneyOperational) {
      const projection: NestJourneyWorkspaceProjection = {
        ...emptyProjection({
          organizationId,
          observedAtMs,
          access
        }),
        responsibility,
        capabilities,
        congregationIds,
        canReadJourneyOperational: false
      };
      return res.status(200).json({ success: true, projection });
    }

    const assignedPromise = capabilities.canManageCare
      ? db.collection(
          `organizations/${organizationId}/products/raiz_e_mesa/followups`
        )
          .where('ownerRef', '==', uid)
          .limit(100)
          .get()
      : Promise.resolve(null);

    const canSuperviseCare =
      capabilities.canCoordinateJourney ||
      capabilities.canManagePastoral;

    const unassignedPromise = canSuperviseCare
      ? db.collection(
          `organizations/${organizationId}/products/raiz_e_mesa/careRequests`
        )
          .where('careType', '==', 'first_contact')
          .limit(200)
          .get()
      : Promise.resolve(null);

    const [assignedSnapshot, unassignedSnapshot] = await Promise.all([
      assignedPromise,
      unassignedPromise
    ]);

    const assignedDueAt = assignedSnapshot
      ? assignedSnapshot.docs
          .map(document => document.data())
          .filter(data =>
            data.organizationId === organizationId &&
            data.ownerRef === uid &&
            data.status === 'pending' &&
            data.kind === 'first_contact' &&
            canAccessCongregation(
              clean(data.congregationId),
              broadScope,
              congregationScope
            )
          )
          .map(data => data.dueAt)
      : [];

    const unassignedDueAt = unassignedSnapshot
      ? unassignedSnapshot.docs
          .map(document => document.data())
          .filter(data =>
            data.organizationId === organizationId &&
            data.status === 'open' &&
            data.careType === 'first_contact' &&
            !clean(data.ownerRef) &&
            canAccessCongregation(
              clean(data.congregationId),
              broadScope,
              congregationScope
            )
          )
          .map(data => data.dueAt)
      : [];

    const projection: NestJourneyWorkspaceProjection = {
      appId: 'nestjourney',
      organizationId,
      accessible: true,
      isGlobalAccess: false,
      decisionState: 'granted',
      denialReason: null,
      responsibility,
      canReadJourneyOperational,
      capabilities,
      congregationIds,
      ready: true,
      observedAtMs,
      assignedFirstContacts: summarizeJourneyQueue({
        organizationId,
        sourceRef: 'hub.api.nestjourney.workspace.assigned_first_contacts',
        entityId: 'assigned:first_contact',
        observedAtMs,
        dueAtValues: assignedDueAt
      }),
      unassignedFirstContacts: summarizeJourneyQueue({
        organizationId,
        sourceRef: 'hub.api.nestjourney.workspace.unassigned_first_contacts',
        entityId: 'unassigned:first_contact',
        observedAtMs,
        dueAtValues: unassignedDueAt
      })
    };

    return res.status(200).json({ success: true, projection });
  } catch (error) {
    dependencies.logger?.error?.(
      '[NestJourneyWorkspaceProjection] Failed closed',
      error
    );
    return res.status(503).json({
      success: false,
      code: 'NESTJOURNEY_WORKSPACE_PROJECTION_FAILED'
    });
  }
}
