import type { Request, Response } from 'express';
import { createHash } from 'node:crypto';
import { getAuth } from 'firebase-admin/auth';
import {
  FieldValue,
  Firestore,
  getFirestore
} from 'firebase-admin/firestore';
import {
  resolveEcosystemAppAccess,
  type ResolvedAppAccess
} from './EcosystemAccessResolver.js';
import {
  isValidOutcomeForSignal,
  type ActionOutcomeCode,
  type ActionOutcomeResult
} from '../../lib/outcomeEngine.js';
import {
  hasValidResolutionIdentity,
  isResolutionSourceSignalPair,
  type ActionResolutionRecord
} from '../../lib/actionResolution.js';
import {
  hasNestJourneyOperationalCapability,
  type NestJourneyOperationalCapabilities
} from '../../lib/nestJourneyWorkspaceProjection.js';
import {
  capabilitiesFromMembership,
  resolveNestJourneyWorkspaceProjectionForActor
} from './NestJourneyWorkspaceProjectionService.js';
import {
  attestNestJourneyOutcome,
  type JourneyOutcomeAttestation
} from '../../lib/journeyOutcomeAttestation.js';

type Dependencies = {
  verifyIdToken?: (
    token: string
  ) => Promise<{ uid: string }>;
  getFirestore?: () => Firestore;
  resolveAccess?: typeof resolveEcosystemAppAccess;
  resolveJourneyProjection?: typeof resolveNestJourneyWorkspaceProjectionForActor;
  now?: () => number;
};

const MAX_RESOLUTIONS = 100;
const MAX_SIGNAL_TEXT = 512;

function isSafeDocumentId(
  value: unknown
): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 256 &&
    value !== '.' &&
    value !== '..' &&
    !value.includes('/') &&
    !value.includes('\\') &&
    !/[\u0000-\u001F\u007F]/.test(value)
  );
}

function isSafeSignalText(
  value: unknown,
  max = MAX_SIGNAL_TEXT
): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= max &&
    !/[\u0000-\u001F\u007F]/.test(value)
  );
}

function normalizeOrganizationRole(
  value: unknown
): string {
  const role = String(value || '')
    .trim()
    .toLowerCase();

  if (['owner', 'dono'].includes(role)) return 'owner';
  if (
    ['admin', 'administrator', 'administrador'].includes(role)
  ) {
    return 'admin';
  }
  if (
    [
      'leader',
      'lider',
      'líder',
      'lider / ministro',
      'líder / ministro',
      'minister',
      'ministro',
      'pastor',
      'worship_leader',
      'music_leader'
    ].includes(role)
  ) {
    return 'leader';
  }

  return role;
}

function canResolveManagedMusicScaleAction(
  access: ResolvedAppAccess
): boolean {
  if (
    access.accessible !== true ||
    access.isGlobalAccess === true
  ) {
    return false;
  }

  const permissions = Array.isArray(access.permissions)
    ? access.permissions.map(value => String(value))
    : [];

  if (
    permissions.includes('*') ||
    permissions.includes('scaleResponses.readManaged')
  ) {
    return true;
  }

  return ['owner', 'admin', 'leader'].includes(
    normalizeOrganizationRole(access.organizationRole)
  );
}

async function authenticate(
  req: Request,
  dependencies: Dependencies
): Promise<string | null> {
  const header = req.headers.authorization;
  if (
    !header?.startsWith('Bearer ') ||
    header.length <= 7
  ) {
    return null;
  }

  try {
    const verify =
      dependencies.verifyIdToken ??
      ((token: string) =>
        getAuth().verifyIdToken(token));

    const uid = (await verify(header.slice(7))).uid;
    return isSafeDocumentId(uid) ? uid : null;
  } catch {
    return null;
  }
}

async function resolveNestJourneyCapabilities(
  db: Firestore,
  organizationId: string,
  actorUid: string,
  access: ResolvedAppAccess
): Promise<NestJourneyOperationalCapabilities | null> {
  if (
    access.accessible !== true ||
    access.isGlobalAccess === true
  ) {
    return null;
  }

  const member = await db
    .doc(`organizations/${organizationId}/members/${actorUid}`)
    .get();

  if (!member.exists) return null;

  const data = member.data() ?? {};
  const status = String(data.status || '')
    .trim()
    .toLowerCase();

  if (
    [
      'suspended',
      'inactive',
      'removed',
      'revoked',
      'deleted',
      'archived',
      'disabled'
    ].includes(status)
  ) {
    return null;
  }

  return capabilitiesFromMembership(data);
}

function canResolveNestJourneySignal(
  capabilities: NestJourneyOperationalCapabilities,
  signalType: ActionResolutionRecord['signalType']
): boolean {
  if (
    signalType ===
    'nestjourney_assigned_first_contacts'
  ) {
    return capabilities.canManageCare === true;
  }

  if (
    signalType ===
    'nestjourney_unassigned_first_contacts'
  ) {
    return (
      capabilities.canCoordinateJourney === true ||
      capabilities.canManagePastoral === true
    );
  }

  return false;
}

async function authorizeSource(
  db: Firestore,
  organizationId: string,
  actorUid: string,
  sourceApp: ActionResolutionRecord['sourceApp'],
  dependencies: Dependencies,
  signalType?: ActionResolutionRecord['signalType']
): Promise<
  | {
      allowed: true;
      sourceApp: ActionResolutionRecord['sourceApp'];
      journeyCapabilities?: NestJourneyOperationalCapabilities;
    }
  | {
      allowed: false;
      status: number;
      reasonCode: string;
    }
> {
  const resolveAccess =
    dependencies.resolveAccess ??
    resolveEcosystemAppAccess;

  const access = await resolveAccess({
    uid: actorUid,
    organizationId,
    appId: sourceApp,
    db
  });

  if (sourceApp === 'musicscale') {
    if (!access.accessible) {
      return {
        allowed: false,
        status: 403,
        reasonCode: 'MUSICSCALE_ACCESS_DENIED'
      };
    }

    if (!canResolveManagedMusicScaleAction(access)) {
      return {
        allowed: false,
        status: 403,
        reasonCode: 'WORSHIP_RESOLUTION_AUTHORITY_REQUIRED'
      };
    }

    return { allowed: true, sourceApp };
  }

  if (!access.accessible) {
    return {
      allowed: false,
      status: 403,
      reasonCode: 'NESTJOURNEY_ACCESS_DENIED'
    };
  }

  const capabilities =
    await resolveNestJourneyCapabilities(
      db,
      organizationId,
      actorUid,
      access
    );

  if (
    !capabilities ||
    !hasNestJourneyOperationalCapability(
      capabilities
    )
  ) {
    return {
      allowed: false,
      status: 403,
      reasonCode: 'JOURNEY_RESOLUTION_AUTHORITY_REQUIRED'
    };
  }

  if (
    signalType &&
    !canResolveNestJourneySignal(
      capabilities,
      signalType
    )
  ) {
    return {
      allowed: false,
      status: 403,
      reasonCode: 'JOURNEY_SIGNAL_RESOLUTION_AUTHORITY_REQUIRED'
    };
  }

  return {
    allowed: true,
    sourceApp,
    journeyCapabilities: capabilities
  };
}

function resolutionId(
  dedupeKey: string,
  fingerprint: string
): string {
  return createHash('sha256')
    .update(`${dedupeKey}\u0000${fingerprint}`)
    .digest('hex')
    .slice(0, 48);
}

function timestampToMs(
  value: unknown
): number | null {
  if (
    value &&
    typeof (value as any).toMillis === 'function'
  ) {
    return (value as any).toMillis();
  }

  return null;
}


function resolutionIdentityMatches(
  data: FirebaseFirestore.DocumentData,
  input: {
    organizationId: string;
    actorUid: string;
    dedupeKey: string;
    fingerprint: string;
    sourceApp: ActionResolutionRecord['sourceApp'];
    signalType: ActionResolutionRecord['signalType'];
  }
): boolean {
  return (
    data.organizationId ===
      input.organizationId &&
    data.actorUid === input.actorUid &&
    data.dedupeKey === input.dedupeKey &&
    data.fingerprint ===
      input.fingerprint &&
    data.sourceApp === input.sourceApp &&
    data.signalType === input.signalType
  );
}

function parseResolutionInput(
  body: any
):
  | {
      dedupeKey: string;
      fingerprint: string;
      sourceApp: ActionResolutionRecord['sourceApp'];
      signalType: ActionResolutionRecord['signalType'];
    }
  | null {
  const dedupeKey = body?.dedupeKey;
  const fingerprint = body?.fingerprint;
  const sourceApp = body?.sourceApp;
  const signalType = body?.signalType;

  if (
    !isSafeSignalText(dedupeKey) ||
    !isSafeSignalText(fingerprint) ||
    !hasValidResolutionIdentity({
      sourceApp,
      signalType,
      dedupeKey
    })
  ) {
    return null;
  }

  return {
    dedupeKey,
    fingerprint,
    sourceApp,
    signalType
  };
}

export async function getActionResolutions(
  req: Request,
  res: Response,
  dependencies: Dependencies = {}
) {
  const actorUid = await authenticate(
    req,
    dependencies
  );
  if (!actorUid) {
    return res.status(401).json({
      success: false,
      reasonCode: 'UNAUTHENTICATED'
    });
  }

  const organizationId = req.params.organizationId;
  if (!isSafeDocumentId(organizationId)) {
    return res.status(400).json({
      success: false,
      reasonCode: 'INVALID_REQUEST_PATH'
    });
  }

  try {
    const db =
      (dependencies.getFirestore ?? getFirestore)();

    const [
      musicScaleAuthorization,
      nestJourneyAuthorization
    ] = await Promise.all([
      authorizeSource(
        db,
        organizationId,
        actorUid,
        'musicscale',
        dependencies
      ),
      authorizeSource(
        db,
        organizationId,
        actorUid,
        'nestjourney',
        dependencies
      )
    ]);

    const allowedSourceApps = new Set<
      ActionResolutionRecord['sourceApp']
    >();

    if (musicScaleAuthorization.allowed) {
      allowedSourceApps.add('musicscale');
    }
    if (nestJourneyAuthorization.allowed) {
      allowedSourceApps.add('nestjourney');
    }

    if (allowedSourceApps.size === 0) {
      return res.status(403).json({
        success: false,
        reasonCode:
          'ACTION_RESOLUTION_AUTHORITY_REQUIRED'
      });
    }

    const snapshot = await db
      .collection(
        `organizations/${organizationId}/actionCenterUsers/${actorUid}/resolutions`
      )
      .orderBy('updatedAt', 'desc')
      .limit(MAX_RESOLUTIONS)
      .get();

    const resolutions = snapshot.docs
      .map(document => {
        const data = document.data() ?? {};

        return {
          id: document.id,
          organizationId:
            data.organizationId,
          dedupeKey: data.dedupeKey,
          fingerprint: data.fingerprint,
          sourceApp: data.sourceApp,
          signalType: data.signalType,
          status: data.status,
          outcome: data.outcome ?? null,
          outcomeCode: data.outcomeCode ?? null,
          startedAtMs:
            timestampToMs(data.startedAt),
          updatedAtMs:
            timestampToMs(data.updatedAt),
          clearedObservedAtMs:
            timestampToMs(data.clearedObservedAt),
          outcomeObservedAtMs:
            timestampToMs(data.outcomeObservedAt)
        };
      })
      .filter(record =>
        record.organizationId === organizationId &&
        isSafeSignalText(record.dedupeKey) &&
        isSafeSignalText(record.fingerprint) &&
        isResolutionSourceSignalPair(record) &&
        allowedSourceApps.has(record.sourceApp) &&
        (
          record.sourceApp !== 'nestjourney' ||
          (
            nestJourneyAuthorization.allowed === true &&
            nestJourneyAuthorization.journeyCapabilities != null &&
            canResolveNestJourneySignal(
              nestJourneyAuthorization.journeyCapabilities,
              record.signalType
            )
          )
        ) &&
        (
          record.status === 'started' ||
          record.status === 'cleared_observed' ||
          record.status === 'outcome_observed'
        )
      );

    res.setHeader(
      'Cache-Control',
      'private, no-store'
    );

    return res.status(200).json({
      success: true,
      organizationId,
      resolutions
    });
  } catch (error) {
    console.error(
      '[ActionLoop] Resolution read failed',
      error
    );

    return res.status(500).json({
      success: false,
      reasonCode: 'INTERNAL_ERROR'
    });
  }
}

export async function startActionResolution(
  req: Request,
  res: Response,
  dependencies: Dependencies = {}
) {
  const actorUid = await authenticate(
    req,
    dependencies
  );
  if (!actorUid) {
    return res.status(401).json({
      success: false,
      reasonCode: 'UNAUTHENTICATED'
    });
  }

  const organizationId = req.params.organizationId;
  if (!isSafeDocumentId(organizationId)) {
    return res.status(400).json({
      success: false,
      reasonCode: 'INVALID_REQUEST_PATH'
    });
  }

  const input = parseResolutionInput(req.body);
  if (!input) {
    return res.status(400).json({
      success: false,
      reasonCode: 'INVALID_ACTION_RESOLUTION'
    });
  }

  try {
    const db =
      (dependencies.getFirestore ?? getFirestore)();

    const authorization = await authorizeSource(
      db,
      organizationId,
      actorUid,
      input.sourceApp,
      dependencies,
      input.signalType
    );

    if (authorization.allowed === false) {
      return res.status(authorization.status).json({
        success: false,
        reasonCode: authorization.reasonCode
      });
    }

    const id = resolutionId(
      input.dedupeKey,
      input.fingerprint
    );
    const ref = db.doc(
      `organizations/${organizationId}/actionCenterUsers/${actorUid}/resolutions/${id}`
    );
    const existing = await ref.get();
    const nowMs =
      (dependencies.now ?? Date.now)();

    if (
      existing.exists &&
      (
        existing.data()?.status ===
          'cleared_observed' ||
        existing.data()?.status ===
          'outcome_observed'
      )
    ) {
      const data = existing.data() ?? {};
      return res.status(200).json({
        success: true,
        organizationId,
        resolution: {
          id,
          organizationId,
          dedupeKey: input.dedupeKey,
          fingerprint: input.fingerprint,
          sourceApp: input.sourceApp,
          signalType: input.signalType,
          status: data.status,
          outcome:
            data.outcome ??
            'signal_cleared',
          outcomeCode:
            data.outcomeCode ?? null,
          startedAtMs:
            timestampToMs(data.startedAt),
          updatedAtMs:
            timestampToMs(data.updatedAt),
          clearedObservedAtMs:
            timestampToMs(
              data.clearedObservedAt
            ),
          outcomeObservedAtMs:
            timestampToMs(
              data.outcomeObservedAt
            )
        }
      });
    }

    const payload: Record<string, unknown> = {
      actorUid,
      organizationId,
      dedupeKey: input.dedupeKey,
      fingerprint: input.fingerprint,
      sourceApp: input.sourceApp,
      signalType: input.signalType,
      status: 'started',
      outcome: null,
      outcomeCode: null,
      updatedAt: FieldValue.serverTimestamp()
    };

    if (!existing.exists) {
      payload.startedAt =
        FieldValue.serverTimestamp();
      payload.createdAt =
        FieldValue.serverTimestamp();
    }

    await ref.set(payload, { merge: true });

    res.setHeader(
      'Cache-Control',
      'private, no-store'
    );

    return res.status(200).json({
      success: true,
      organizationId,
      resolution: {
        id,
        organizationId,
        dedupeKey: input.dedupeKey,
        fingerprint: input.fingerprint,
        sourceApp: input.sourceApp,
        signalType: input.signalType,
        status: 'started',
        outcome: null,
        startedAtMs:
          existing.exists
            ? timestampToMs(
                existing.data()?.startedAt
              )
            : nowMs,
        updatedAtMs: nowMs,
        clearedObservedAtMs: null,
        outcomeObservedAtMs: null
      }
    });
  } catch (error) {
    console.error(
      '[ActionLoop] Resolution start failed',
      error
    );

    return res.status(500).json({
      success: false,
      reasonCode: 'INTERNAL_ERROR'
    });
  }
}

export async function observeActionResolutionOutcome(
  req: Request,
  res: Response,
  dependencies: Dependencies = {}
) {
  const actorUid = await authenticate(
    req,
    dependencies
  );
  if (!actorUid) {
    return res.status(401).json({
      success: false,
      reasonCode: 'UNAUTHENTICATED'
    });
  }

  const organizationId =
    req.params.organizationId;
  if (!isSafeDocumentId(organizationId)) {
    return res.status(400).json({
      success: false,
      reasonCode: 'INVALID_REQUEST_PATH'
    });
  }

  const input = parseResolutionInput(
    req.body
  );
  const outcomeResult =
    req.body?.outcomeResult as
      | ActionOutcomeResult
      | undefined;
  const outcomeCode =
    req.body?.outcomeCode as
      | ActionOutcomeCode
      | undefined;

  if (
    !input ||
    !outcomeResult ||
    !outcomeCode ||
    !isValidOutcomeForSignal({
      signalType: input.signalType,
      result: outcomeResult,
      code: outcomeCode
    })
  ) {
    return res.status(400).json({
      success: false,
      reasonCode: 'INVALID_ACTION_OUTCOME'
    });
  }

  try {
    const db =
      (dependencies.getFirestore ??
        getFirestore)();

    const authorization = await authorizeSource(
      db,
      organizationId,
      actorUid,
      input.sourceApp,
      dependencies,
      input.signalType
    );

    if (authorization.allowed === false) {
      return res
        .status(authorization.status)
        .json({
          success: false,
          reasonCode:
            authorization.reasonCode
        });
    }

    const id = resolutionId(
      input.dedupeKey,
      input.fingerprint
    );
    const ref = db.doc(
      `organizations/${organizationId}/actionCenterUsers/${actorUid}/resolutions/${id}`
    );
    const nowMs =
      (dependencies.now ?? Date.now)();

    const preflightSnapshot =
      await ref.get();

    if (!preflightSnapshot.exists) {
      return res.status(404).json({
        success: false,
        reasonCode:
          'ACTION_RESOLUTION_NOT_STARTED'
      });
    }

    const preflightData =
      preflightSnapshot.data() ?? {};

    if (
      !resolutionIdentityMatches(
        preflightData,
        {
          organizationId,
          actorUid,
          dedupeKey: input.dedupeKey,
          fingerprint: input.fingerprint,
          sourceApp: input.sourceApp,
          signalType: input.signalType
        }
      )
    ) {
      return res.status(409).json({
        success: false,
        reasonCode:
          'ACTION_RESOLUTION_IDENTITY_MISMATCH'
      });
    }

    const alreadyObserved =
      preflightData.status ===
        'outcome_observed' &&
      preflightData.outcome ===
        outcomeResult &&
      preflightData.outcomeCode ===
        outcomeCode;

    const legacyAlreadyResolved =
      preflightData.status ===
        'cleared_observed' &&
      preflightData.outcome ===
        'signal_cleared' &&
      outcomeResult === 'resolved';

    if (
      !alreadyObserved &&
      !legacyAlreadyResolved &&
      preflightData.status !== 'started'
    ) {
      return res.status(409).json({
        success: false,
        reasonCode:
          'ACTION_RESOLUTION_INVALID_STATE'
      });
    }

    let journeyAttestation:
      | Extract<
          JourneyOutcomeAttestation,
          { attested: true }
        >
      | null = null;

    if (
      input.sourceApp === 'nestjourney' &&
      !alreadyObserved &&
      !legacyAlreadyResolved
    ) {
      try {
        const resolveProjection =
          dependencies.resolveJourneyProjection ??
          resolveNestJourneyWorkspaceProjectionForActor;

        const projection =
          await resolveProjection(
            {
              uid: actorUid,
              organizationId
            },
            {
              db,
              resolveAccess:
                dependencies.resolveAccess,
              now: dependencies.now,
              completeQueues: true
            }
          );

        const attestation =
          attestNestJourneyOutcome({
            resolution: {
              organizationId,
              sourceApp: input.sourceApp,
              signalType: input.signalType,
              fingerprint: input.fingerprint
            },
            result: outcomeResult,
            code: outcomeCode,
            projection
          });

        if ('reasonCode' in attestation) {
          return res.status(409).json({
            success: false,
            reasonCode:
              attestation.reasonCode
          });
        }

        journeyAttestation =
          attestation;
      } catch (error) {
        console.warn(
          '[ActionLoop] Journey outcome attestation failed closed',
          error
        );

        return res.status(503).json({
          success: false,
          reasonCode:
            'JOURNEY_OUTCOME_ATTESTATION_UNAVAILABLE'
        });
      }
    }

    const result = await db.runTransaction(
      async transaction => {
        const existing =
          await transaction.get(ref);

        if (!existing.exists) {
          return {
            status: 404,
            reasonCode:
              'ACTION_RESOLUTION_NOT_STARTED'
          } as const;
        }

        const data =
          existing.data() ?? {};

        if (
          !resolutionIdentityMatches(
            data,
            {
              organizationId,
              actorUid,
              dedupeKey: input.dedupeKey,
              fingerprint: input.fingerprint,
              sourceApp: input.sourceApp,
              signalType: input.signalType
            }
          )
        ) {
          return {
            status: 409,
            reasonCode:
              'ACTION_RESOLUTION_IDENTITY_MISMATCH'
          } as const;
        }

        if (
          data.status ===
            'outcome_observed' &&
          data.outcome === outcomeResult &&
          data.outcomeCode === outcomeCode
        ) {
          return {
            status: 200,
            alreadyObserved: true,
            data
          } as const;
        }

        if (
          data.status ===
            'cleared_observed' &&
          data.outcome ===
            'signal_cleared' &&
          outcomeResult === 'resolved'
        ) {
          return {
            status: 200,
            alreadyObserved: true,
            data
          } as const;
        }

        if (data.status !== 'started') {
          return {
            status: 409,
            reasonCode:
              'ACTION_RESOLUTION_INVALID_STATE'
          } as const;
        }

        transaction.set(
          ref,
          {
            status: 'outcome_observed',
            outcome: outcomeResult,
            outcomeCode,
            outcomeBasis:
              journeyAttestation
                ? 'server_revalidated_canonical_projection'
                : 'authorized_canonical_projection',
            ...(journeyAttestation
              ? {
                  outcomeAttestation: {
                    sourceApp: 'nestjourney',
                    queueId:
                      journeyAttestation.queueId,
                    sourceObservedAtMs:
                      journeyAttestation.observedAtMs,
                    sourceQueueCount:
                      journeyAttestation.currentCount,
                    sourceFingerprint:
                      journeyAttestation.currentFingerprint
                  }
                }
              : {}),
            outcomeObservedAt:
              FieldValue.serverTimestamp(),
            updatedAt:
              FieldValue.serverTimestamp()
          },
          { merge: true }
        );

        return {
          status: 200,
          alreadyObserved: false,
          data
        } as const;
      }
    );

    if ('reasonCode' in result) {
      return res
        .status(result.status)
        .json({
          success: false,
          reasonCode: result.reasonCode
        });
    }

    res.setHeader(
      'Cache-Control',
      'private, no-store'
    );

    return res.status(200).json({
      success: true,
      organizationId,
      resolution: {
        id,
        organizationId,
        dedupeKey: input.dedupeKey,
        fingerprint:
          input.fingerprint,
        sourceApp: input.sourceApp,
        signalType: input.signalType,
        status: 'outcome_observed',
        outcome: outcomeResult,
        outcomeCode,
        startedAtMs:
          timestampToMs(
            result.data.startedAt
          ),
        updatedAtMs: nowMs,
        clearedObservedAtMs:
          timestampToMs(
            result.data.clearedObservedAt
          ),
        outcomeObservedAtMs:
          result.alreadyObserved
            ? timestampToMs(
                result.data
                  .outcomeObservedAt
              )
            : nowMs
      }
    });
  } catch (error) {
    console.error(
      '[ActionLoop] Outcome observation failed',
      error
    );

    return res.status(500).json({
      success: false,
      reasonCode: 'INTERNAL_ERROR'
    });
  }
}
