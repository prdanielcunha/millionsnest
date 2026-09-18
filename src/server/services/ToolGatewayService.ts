import type { Request, Response } from 'express';
import { createHash } from 'node:crypto';
import { getAuth } from 'firebase-admin/auth';
import {
  FieldValue,
  Firestore,
  getFirestore
} from 'firebase-admin/firestore';
import {
  planToolAction,
  resolveToolDefinition,
  hasOnlyAllowedToolInputKeys,
  type EcosystemToolDefinition
} from '../../lib/toolGateway.js';
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

function isSafeId(
  value: unknown,
  max = 256
): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= max &&
    value !== '.' &&
    value !== '..' &&
    !value.includes('/') &&
    !value.includes('\\') &&
    !/[\u0000-\u001F\u007F]/.test(value)
  );
}

function isSafeText(
  value: unknown,
  max = 512
): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
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

  if (['owner', 'dono'].includes(role)) {
    return 'owner';
  }

  if (
    ['admin', 'administrator', 'administrador']
      .includes(role)
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

function canUseManagedMusicScaleTool(
  access: ResolvedAppAccess
): boolean {
  if (
    access.accessible !== true ||
    access.isGlobalAccess === true
  ) {
    return false;
  }

  const permissions = Array.isArray(
    access.permissions
  )
    ? access.permissions.map(String)
    : [];

  if (
    permissions.includes('*') ||
    permissions.includes(
      'scaleResponses.readManaged'
    ) ||
    permissions.includes('scales.read')
  ) {
    return true;
  }

  return ['owner', 'admin', 'leader'].includes(
    normalizeOrganizationRole(
      access.organizationRole
    )
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

    const uid =
      (await verify(header.slice(7))).uid;

    return isSafeId(uid) ? uid : null;
  } catch {
    return null;
  }
}

function stableJson(
  value: unknown
): string {
  if (
    value === null ||
    typeof value !== 'object'
  ) {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return (
      '[' +
      value.map(stableJson).join(',') +
      ']'
    );
  }

  const object =
    value as Record<string, unknown>;

  return (
    '{' +
    Object.keys(object)
      .sort()
      .map(
        key =>
          `${JSON.stringify(key)}:${stableJson(
            object[key]
          )}`
      )
      .join(',') +
    '}'
  );
}

function requestFingerprint(input: {
  toolId: string;
  toolInput: Record<string, unknown>;
  source: Record<string, unknown> | null;
}): string {
  return createHash('sha256')
    .update(stableJson(input))
    .digest('hex');
}

function toolActionId(input: {
  organizationId: string;
  actorUid: string;
  toolId: string;
  idempotencyKey: string;
}): string {
  return createHash('sha256')
    .update(
      [
        input.organizationId,
        input.actorUid,
        input.toolId,
        input.idempotencyKey
      ].join(':')
    )
    .digest('hex')
    .slice(0, 48);
}

function safeSource(
  value: unknown
): Record<string, string> | null {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    return null;
  }

  const raw =
    value as Record<string, unknown>;

  const allowed = new Set([
    'dedupeKey',
    'fingerprint',
    'signalType'
  ]);

  if (
    Object.keys(raw).some(
      key => !allowed.has(key)
    )
  ) {
    return null;
  }

  const source: Record<string, string> = {};

  for (const key of allowed) {
    const candidate = raw[key];
    if (candidate === undefined) continue;
    if (!isSafeText(candidate)) return null;
    source[key] = candidate.trim();
  }

  return Object.keys(source).length > 0
    ? source
    : null;
}

async function authorizeDefinition(
  definition: EcosystemToolDefinition,
  organizationId: string,
  actorUid: string,
  db: Firestore,
  dependencies: Dependencies
): Promise<
  | {
      allowed: true;
      access: ResolvedAppAccess;
    }
  | {
      allowed: false;
      status: number;
      reasonCode: string;
    }
> {
  if (
    definition.domain !== 'musicscale'
  ) {
    return {
      allowed: false,
      status: 409,
      reasonCode:
        'TOOL_DOMAIN_ADAPTER_UNAVAILABLE'
    };
  }

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
      reasonCode:
        'MUSICSCALE_ACCESS_DENIED'
    };
  }

  if (
    !canUseManagedMusicScaleTool(access)
  ) {
    return {
      allowed: false,
      status: 403,
      reasonCode:
        'WORSHIP_TOOL_AUTHORITY_REQUIRED'
    };
  }

  return {
    allowed: true,
    access
  };
}

export async function getToolGatewayCatalog(
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

  if (!isSafeId(organizationId)) {
    return res.status(400).json({
      success: false,
      reasonCode:
        'INVALID_REQUEST_PATH'
    });
  }

  const definition =
    resolveToolDefinition(
      'musicscale.scale.review'
    )!;

  try {
    const db =
      (dependencies.getFirestore ??
        getFirestore)();

    const authorization =
      await authorizeDefinition(
        definition,
        organizationId,
        actorUid,
        db,
        dependencies
      );

    const tools = [];

    if (authorization.allowed) {
      tools.push({
        id: definition.id,
        domain: definition.domain,
        operation: definition.operation,
        risk: definition.risk,
        approvalPolicy:
          definition.approvalPolicy,
        availability:
          definition.availability
      });
    }

    res.setHeader(
      'Cache-Control',
      'private, no-store'
    );

    return res.status(200).json({
      success: true,
      organizationId,
      tools
    });
  } catch (error) {
    console.error(
      '[ToolGateway] Catalog failed',
      error
    );

    return res.status(500).json({
      success: false,
      reasonCode: 'INTERNAL_ERROR'
    });
  }
}

export async function executeToolAction(
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

  if (!isSafeId(organizationId)) {
    return res.status(400).json({
      success: false,
      reasonCode:
        'INVALID_REQUEST_PATH'
    });
  }

  const toolId = req.body?.toolId;
  const idempotencyKey =
    req.body?.idempotencyKey;
  const toolInput = req.body?.input;
  const rawSource = req.body?.source;

  const definition =
    resolveToolDefinition(toolId);

  if (!definition) {
    return res.status(400).json({
      success: false,
      reasonCode: 'UNKNOWN_TOOL'
    });
  }

  const plan = planToolAction(definition);

  if (plan.decision === 'unavailable') {
    return res.status(409).json({
      success: false,
      reasonCode: 'TOOL_UNAVAILABLE',
      availability: plan.reason,
      approvalPolicy:
        definition.approvalPolicy
    });
  }

  if (
    plan.decision === 'require_approval'
  ) {
    return res.status(409).json({
      success: false,
      reasonCode:
        'TOOL_APPROVAL_REQUIRED',
      risk: definition.risk,
      approvalPolicy:
        definition.approvalPolicy
    });
  }

  if (
    !isSafeText(idempotencyKey, 256) ||
    !hasOnlyAllowedToolInputKeys(
      definition,
      toolInput
    )
  ) {
    return res.status(400).json({
      success: false,
      reasonCode:
        'INVALID_TOOL_REQUEST'
    });
  }

  const source =
    rawSource === undefined
      ? null
      : safeSource(rawSource);

  if (
    rawSource !== undefined &&
    source === null
  ) {
    return res.status(400).json({
      success: false,
      reasonCode:
        'INVALID_TOOL_SOURCE'
    });
  }

  if (
    definition.id !==
      'musicscale.scale.review' ||
    !isSafeId(toolInput.scaleId)
  ) {
    return res.status(400).json({
      success: false,
      reasonCode:
        'INVALID_TOOL_INPUT'
    });
  }

  const normalizedInput = {
    scaleId: toolInput.scaleId.trim()
  };

  const fingerprint = requestFingerprint({
    toolId: definition.id,
    toolInput: normalizedInput,
    source
  });

  const actionId = toolActionId({
    organizationId,
    actorUid,
    toolId: definition.id,
    idempotencyKey:
      idempotencyKey.trim()
  });

  try {
    const db =
      (dependencies.getFirestore ??
        getFirestore)();

    const authorization =
      await authorizeDefinition(
        definition,
        organizationId,
        actorUid,
        db,
        dependencies
      );

    if (
      authorization.allowed === false
    ) {
      return res
        .status(authorization.status)
        .json({
          success: false,
          reasonCode:
            authorization.reasonCode
        });
    }

    const actionRef = db.doc(
      `organizations/${organizationId}/toolActions/${actionId}`
    );

    const existing =
      await actionRef.get();

    if (existing.exists) {
      const data = existing.data() ?? {};

      if (
        data.requestFingerprint !==
        fingerprint
      ) {
        return res.status(409).json({
          success: false,
          reasonCode:
            'TOOL_IDEMPOTENCY_CONFLICT'
        });
      }

      if (
        data.status === 'completed' &&
        data.result
      ) {
        res.setHeader(
          'Cache-Control',
          'private, no-store'
        );

        return res.status(200).json({
          success: true,
          organizationId,
          toolActionId: actionId,
          fromCache: true,
          result: data.result
        });
      }
    }

    const scaleRef = db.doc(
      `scales/${normalizedInput.scaleId}`
    );
    const scaleSnap =
      await scaleRef.get();

    if (!scaleSnap.exists) {
      return res.status(404).json({
        success: false,
        reasonCode:
          'TOOL_TARGET_NOT_FOUND'
      });
    }

    const scale =
      scaleSnap.data() ?? {};

    if (
      scale.organizationId !==
      organizationId
    ) {
      return res.status(403).json({
        success: false,
        reasonCode:
          'TOOL_TARGET_TENANT_MISMATCH'
      });
    }

    const status = String(
      scale.status || ''
    )
      .trim()
      .toLowerCase();

    if (
      status === 'cancelled' ||
      status === 'completed'
    ) {
      return res.status(409).json({
        success: false,
        reasonCode:
          'TOOL_TARGET_STALE'
      });
    }

    const nowMs =
      (dependencies.now ?? Date.now)();

    const result = {
      code: 'NAVIGATION_READY',
      destination: {
        appId: 'musicscale',
        path:
          `/scales/${normalizedInput.scaleId}`
      }
    };

    await actionRef.set({
      schemaVersion: 1,
      organizationId,
      actorUid,
      toolId: definition.id,
      domain: definition.domain,
      operation: definition.operation,
      risk: definition.risk,
      approvalPolicy:
        definition.approvalPolicy,
      status: 'completed',
      idempotencyKey:
        idempotencyKey.trim(),
      requestFingerprint: fingerprint,
      input: normalizedInput,
      source,
      result,
      requestedAt:
        FieldValue.serverTimestamp(),
      completedAt:
        FieldValue.serverTimestamp(),
      observedAtMs: nowMs
    });

    res.setHeader(
      'Cache-Control',
      'private, no-store'
    );

    return res.status(200).json({
      success: true,
      organizationId,
      toolActionId: actionId,
      fromCache: false,
      result
    });
  } catch (error) {
    console.error(
      '[ToolGateway] Execution failed',
      error
    );

    return res.status(500).json({
      success: false,
      reasonCode: 'INTERNAL_ERROR'
    });
  }
}
