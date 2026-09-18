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

type Dependencies = {
  verifyIdToken?: (
    token: string
  ) => Promise<{ uid: string }>;
  getFirestore?: () => Firestore;
  resolveAccess?: typeof resolveEcosystemAppAccess;
  now?: () => number;
};

const MAX_RESOLUTIONS = 100;
const MAX_SIGNAL_TEXT = 512;

const RESOLVABLE_SIGNAL_TYPES = new Set([
  'musicscale_pending_responses',
  'musicscale_declined_responses',
  'musicscale_repertoire_content_gaps'
]);

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

async function authorize(
  db: Firestore,
  organizationId: string,
  actorUid: string,
  dependencies: Dependencies
): Promise<
  | { allowed: true }
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
    appId: 'musicscale',
    db
  });

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

  return { allowed: true };
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

function parseResolutionInput(
  body: any
):
  | {
      dedupeKey: string;
      fingerprint: string;
      sourceApp: 'musicscale';
      signalType:
        | 'musicscale_pending_responses'
        | 'musicscale_declined_responses'
        | 'musicscale_repertoire_content_gaps';
    }
  | null {
  const dedupeKey = body?.dedupeKey;
  const fingerprint = body?.fingerprint;
  const sourceApp = body?.sourceApp;
  const signalType = body?.signalType;

  if (
    !isSafeSignalText(dedupeKey) ||
    !isSafeSignalText(fingerprint) ||
    sourceApp !== 'musicscale' ||
    !RESOLVABLE_SIGNAL_TYPES.has(signalType)
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

    const authorization = await authorize(
      db,
      organizationId,
      actorUid,
      dependencies
    );

    if (authorization.allowed === false) {
      return res.status(authorization.status).json({
        success: false,
        reasonCode: authorization.reasonCode
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
          startedAtMs:
            timestampToMs(data.startedAt),
          updatedAtMs:
            timestampToMs(data.updatedAt),
          clearedObservedAtMs:
            timestampToMs(data.clearedObservedAt)
        };
      })
      .filter(record =>
        record.organizationId === organizationId &&
        isSafeSignalText(record.dedupeKey) &&
        isSafeSignalText(record.fingerprint) &&
        record.sourceApp === 'musicscale' &&
        RESOLVABLE_SIGNAL_TYPES.has(record.signalType) &&
        (
          record.status === 'started' ||
          record.status === 'cleared_observed'
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

    const authorization = await authorize(
      db,
      organizationId,
      actorUid,
      dependencies
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
      existing.data()?.status === 'cleared_observed'
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
          sourceApp: 'musicscale',
          signalType: input.signalType,
          status: 'cleared_observed',
          outcome: data.outcome ?? 'signal_cleared',
          startedAtMs:
            timestampToMs(data.startedAt),
          updatedAtMs:
            timestampToMs(data.updatedAt),
          clearedObservedAtMs:
            timestampToMs(data.clearedObservedAt)
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
        clearedObservedAtMs: null
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

  const organizationId = req.params.organizationId;
  if (!isSafeDocumentId(organizationId)) {
    return res.status(400).json({
      success: false,
      reasonCode: 'INVALID_REQUEST_PATH'
    });
  }

  const input = parseResolutionInput(req.body);
  if (
    !input ||
    req.body?.outcome !== 'signal_cleared'
  ) {
    return res.status(400).json({
      success: false,
      reasonCode: 'INVALID_ACTION_OUTCOME'
    });
  }

  try {
    const db =
      (dependencies.getFirestore ?? getFirestore)();

    const authorization = await authorize(
      db,
      organizationId,
      actorUid,
      dependencies
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
    const nowMs =
      (dependencies.now ?? Date.now)();

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

        const data = existing.data() ?? {};

        if (
          data.organizationId !== organizationId ||
          data.actorUid !== actorUid ||
          data.dedupeKey !== input.dedupeKey ||
          data.fingerprint !== input.fingerprint ||
          data.sourceApp !== input.sourceApp ||
          data.signalType !== input.signalType
        ) {
          return {
            status: 409,
            reasonCode:
              'ACTION_RESOLUTION_IDENTITY_MISMATCH'
          } as const;
        }

        if (
          data.status === 'cleared_observed' &&
          data.outcome === 'signal_cleared'
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
            status: 'cleared_observed',
            outcome: 'signal_cleared',
            clearedObservedAt:
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
      return res.status(result.status).json({
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
        fingerprint: input.fingerprint,
        sourceApp: input.sourceApp,
        signalType: input.signalType,
        status: 'cleared_observed',
        outcome: 'signal_cleared',
        startedAtMs:
          timestampToMs(result.data.startedAt),
        updatedAtMs: nowMs,
        clearedObservedAtMs:
          result.alreadyObserved
            ? timestampToMs(
                result.data.clearedObservedAt
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
