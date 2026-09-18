import type {
  Request,
  Response
} from 'express';
import {
  FieldValue,
  Firestore,
  getFirestore
} from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import {
  hasOnlyAllowedToolInputKeys,
  resolveToolDefinition,
  type EcosystemToolDefinition
} from '../../lib/toolGateway.js';
import {
  DEFAULT_TOOL_APPROVAL_TTL_MS,
  isToolApprovalExpired,
  type ToolApprovalRecord
} from '../../lib/toolApproval.js';
import {
  resolveEcosystemPrivilegePolicy
} from '../../lib/permissionService.js';
import {
  createScopedToolRecordId,
  createToolRequestFingerprint
} from './ToolActionIdentity.js';

type Dependencies = {
  verifyIdToken?: (
    token: string
  ) => Promise<{ uid: string }>;
  getFirestore?: () => Firestore;
  now?: () => number;
};

type ConnectAuthority = {
  allowed: boolean;
  canRequest: boolean;
  canApprove: boolean;
  accessSource:
    | 'global_system_role'
    | 'organization_membership'
    | 'denied';
  systemRole?: string | null;
  organizationRole?: string | null;
};

const MAX_TEXT = 512;
const CONNECT_TOOL_ID =
  'connect.message.send' as const;

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
  max = MAX_TEXT
): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    value.length <= max &&
    !/[\u0000-\u001F\u007F]/.test(value)
  );
}

function isInactive(
  value: unknown
): boolean {
  const status = String(value || '')
    .trim()
    .toLowerCase();

  return [
    'inactive',
    'suspended',
    'disabled',
    'removed',
    'revoked',
    'archived'
  ].includes(status);
}

function normalizeRole(
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

  return role;
}

function collectPermissions(
  ...values: unknown[]
): Set<string> {
  const permissions = new Set<string>();

  const add = (value: unknown) => {
    if (
      typeof value === 'string' &&
      value.trim()
    ) {
      permissions.add(value.trim());
    }
  };

  for (const value of values) {
    if (Array.isArray(value)) {
      value.forEach(add);
      continue;
    }

    if (
      value &&
      typeof value === 'object'
    ) {
      for (const [key, granted] of Object.entries(
        value as Record<string, unknown>
      )) {
        if (granted === true) add(key);
        if (typeof granted === 'string') {
          add(granted);
        }
      }
    }
  }

  return permissions;
}

function connectEnabledForOrganization(
  organization: Record<string, any>
): boolean {
  const enabledApps = Array.isArray(
    organization.enabledApps
  )
    ? organization.enabledApps.map(String)
    : [];

  const appStatus = String(
    organization.apps?.connect?.status || ''
  )
    .trim()
    .toLowerCase();

  return (
    enabledApps.includes('connect') ||
    ['active', 'trialing'].includes(appStatus)
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

async function resolveConnectAuthority(
  db: Firestore,
  organizationId: string,
  actorUid: string
): Promise<ConnectAuthority> {
  const [
    userSnap,
    organizationSnap,
    memberSnap
  ] = await Promise.all([
    db.doc(`users/${actorUid}`).get(),
    db.doc(
      `organizations/${organizationId}`
    ).get(),
    db.doc(
      `organizations/${organizationId}/members/${actorUid}`
    ).get()
  ]);

  if (
    !userSnap.exists ||
    !organizationSnap.exists
  ) {
    return {
      allowed: false,
      canRequest: false,
      canApprove: false,
      accessSource: 'denied'
    };
  }

  const user =
    (userSnap.data() ?? {}) as Record<
      string,
      any
    >;
  const organization =
    (organizationSnap.data() ?? {}) as Record<
      string,
      any
    >;

  if (
    user.disabled === true ||
    organization.disabled === true ||
    isInactive(user.status) ||
    isInactive(organization.status)
  ) {
    return {
      allowed: false,
      canRequest: false,
      canApprove: false,
      accessSource: 'denied'
    };
  }

  const systemRole = String(
    user.systemRole || ''
  ).trim();
  const privilege =
    resolveEcosystemPrivilegePolicy(
      systemRole
    );

  if (privilege.canOperateAnyOrganization) {
    return {
      allowed: true,
      canRequest: true,
      canApprove: true,
      accessSource: 'global_system_role',
      systemRole,
      organizationRole: null
    };
  }

  if (!memberSnap.exists) {
    return {
      allowed: false,
      canRequest: false,
      canApprove: false,
      accessSource: 'denied',
      systemRole
    };
  }

  const member =
    (memberSnap.data() ?? {}) as Record<
      string,
      any
    >;

  if (
    member.enabled === false ||
    isInactive(member.status) ||
    !connectEnabledForOrganization(
      organization
    ) ||
    member.appAccess?.connect?.enabled ===
      false
  ) {
    return {
      allowed: false,
      canRequest: false,
      canApprove: false,
      accessSource: 'denied',
      systemRole
    };
  }

  const organizationRole = normalizeRole(
    member.role ??
      member.organizationRole ??
      'member'
  );

  const permissions = collectPermissions(
    member.permissions,
    member.capabilities,
    member.appAccess?.connect?.permissions,
    member.appAccess?.connect?.capabilities
  );

  const isManager = [
    'owner',
    'admin'
  ].includes(organizationRole);

  const canRequest =
    isManager ||
    permissions.has('*') ||
    permissions.has(
      'connect.message.request'
    ) ||
    permissions.has(
      'connect.message.send'
    );

  const canApprove =
    isManager ||
    permissions.has('*') ||
    permissions.has(
      'connect.message.approve'
    );

  return {
    allowed: canRequest || canApprove,
    canRequest,
    canApprove,
    accessSource:
      'organization_membership',
    systemRole,
    organizationRole
  };
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

  const source: Record<string, string> =
    {};

  for (const key of allowed) {
    const candidate = raw[key];
    if (candidate === undefined) {
      continue;
    }

    if (!isSafeText(candidate)) {
      return null;
    }

    source[key] = candidate.trim();
  }

  return Object.keys(source).length > 0
    ? source
    : null;
}

function normalizeConnectInput(
  definition: EcosystemToolDefinition,
  input: unknown
): Record<string, string> | null {
  if (
    definition.id !== CONNECT_TOOL_ID ||
    !hasOnlyAllowedToolInputKeys(
      definition,
      input
    )
  ) {
    return null;
  }

  const raw =
    input as Record<string, unknown>;
  const channel = String(
    raw.channel || ''
  )
    .trim()
    .toLowerCase();
  const recipientRef =
    typeof raw.recipientRef === 'string'
      ? raw.recipientRef.trim()
      : '';
  const templateId =
    typeof raw.templateId === 'string'
      ? raw.templateId.trim()
      : '';
  const locale =
    typeof raw.locale === 'string'
      ? raw.locale.trim()
      : '';

  if (
    ![
      'whatsapp',
      'telegram',
      'email'
    ].includes(channel) ||
    !isSafeId(recipientRef) ||
    !isSafeId(templateId) ||
    !/^[a-z]{2}(?:-[A-Z]{2})?$/.test(
      locale
    )
  ) {
    return null;
  }

  return {
    channel,
    recipientRef,
    templateId,
    locale
  };
}

function approvalFromData(
  approvalId: string,
  data: Record<string, any>
): ToolApprovalRecord | null {
  if (
    !isSafeId(data.organizationId) ||
    !isSafeId(data.requesterUid) ||
    !isSafeText(
      data.idempotencyKey,
      256
    ) ||
    !isSafeText(
      data.requestFingerprint,
      128
    ) ||
    ![
      'pending',
      'approved',
      'rejected',
      'expired'
    ].includes(data.status)
  ) {
    return null;
  }

  return {
    organizationId:
      data.organizationId,
    approvalId,
    toolId: data.toolId,
    risk: data.risk,
    availabilityAtRequest:
      data.availabilityAtRequest,
    status: data.status,
    requesterUid: data.requesterUid,
    approverUid:
      typeof data.approverUid === 'string'
        ? data.approverUid
        : null,
    idempotencyKey:
      data.idempotencyKey,
    requestFingerprint:
      data.requestFingerprint,
    input:
      data.input &&
      typeof data.input === 'object'
        ? data.input
        : {},
    source:
      data.source &&
      typeof data.source === 'object'
        ? data.source
        : null,
    requestedAtMs:
      Number(data.requestedAtMs) || 0,
    expiresAtMs:
      Number(data.expiresAtMs) || 0,
    decidedAtMs:
      Number(data.decidedAtMs) || null,
    decisionNote:
      typeof data.decisionNote ===
      'string'
        ? data.decisionNote
        : null
  };
}

function responseApproval(
  approval: ToolApprovalRecord
) {
  return {
    ...approval,
    executionReady: false,
    executionState:
      approval.availabilityAtRequest ===
      'enabled'
        ? 'approval_recorded'
        : 'adapter_pending'
  };
}

export async function requestToolApproval(
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
      reasonCode: 'INVALID_REQUEST_PATH'
    });
  }

  const definition =
    resolveToolDefinition(
      req.body?.toolId
    );

  if (!definition) {
    return res.status(400).json({
      success: false,
      reasonCode: 'UNKNOWN_TOOL'
    });
  }

  if (
    definition.approvalPolicy !==
    'human_required'
  ) {
    return res.status(409).json({
      success: false,
      reasonCode:
        'TOOL_APPROVAL_NOT_REQUIRED'
    });
  }

  if (
    definition.availability ===
    'product_not_operational'
  ) {
    return res.status(409).json({
      success: false,
      reasonCode: 'TOOL_UNAVAILABLE',
      availability:
        definition.availability
    });
  }

  const idempotencyKey =
    req.body?.idempotencyKey;
  const normalizedInput =
    normalizeConnectInput(
      definition,
      req.body?.input
    );

  if (
    !isSafeText(
      idempotencyKey,
      256
    ) ||
    !normalizedInput
  ) {
    return res.status(400).json({
      success: false,
      reasonCode:
        'INVALID_TOOL_APPROVAL_REQUEST'
    });
  }

  const rawSource = req.body?.source;
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

  try {
    const db =
      (dependencies.getFirestore ??
        getFirestore)();

    const authority =
      await resolveConnectAuthority(
        db,
        organizationId,
        actorUid
      );

    if (
      !authority.allowed ||
      !authority.canRequest
    ) {
      return res.status(403).json({
        success: false,
        reasonCode:
          'CONNECT_APPROVAL_REQUEST_AUTHORITY_REQUIRED'
      });
    }

    const nowMs =
      (dependencies.now ?? Date.now)();

    const fingerprint =
      createToolRequestFingerprint({
        toolId: definition.id,
        toolInput: normalizedInput,
        source
      });

    const approvalId =
      createScopedToolRecordId([
        organizationId,
        actorUid,
        definition.id,
        idempotencyKey.trim()
      ]);

    const approvalRef = db.doc(
      `organizations/${organizationId}/toolApprovals/${approvalId}`
    );

    const existing =
      await approvalRef.get();

    if (existing.exists) {
      const data =
        (existing.data() ?? {}) as Record<
          string,
          any
        >;

      if (
        data.requestFingerprint !==
        fingerprint
      ) {
        return res.status(409).json({
          success: false,
          reasonCode:
            'TOOL_APPROVAL_IDEMPOTENCY_CONFLICT'
        });
      }

      const approval =
        approvalFromData(
          approvalId,
          data
        );

      if (!approval) {
        return res.status(409).json({
          success: false,
          reasonCode:
            'TOOL_APPROVAL_RECORD_INVALID'
        });
      }

      res.setHeader(
        'Cache-Control',
        'private, no-store'
      );

      return res.status(200).json({
        success: true,
        organizationId,
        fromCache: true,
        approval:
          responseApproval(approval)
      });
    }

    const approval:
      ToolApprovalRecord = {
        organizationId,
        approvalId,
        toolId: definition.id,
        risk: definition.risk,
        availabilityAtRequest:
          definition.availability,
        status: 'pending',
        requesterUid: actorUid,
        approverUid: null,
        idempotencyKey:
          idempotencyKey.trim(),
        requestFingerprint:
          fingerprint,
        input: normalizedInput,
        source,
        requestedAtMs: nowMs,
        expiresAtMs:
          nowMs +
          DEFAULT_TOOL_APPROVAL_TTL_MS,
        decidedAtMs: null,
        decisionNote: null
      };

    await approvalRef.set({
      schemaVersion: 1,
      ...approval,
      requesterAccessSource:
        authority.accessSource,
      requesterSystemRole:
        authority.systemRole ?? null,
      requesterOrganizationRole:
        authority.organizationRole ?? null,
      requestedAt:
        FieldValue.serverTimestamp(),
      updatedAt:
        FieldValue.serverTimestamp()
    });

    res.setHeader(
      'Cache-Control',
      'private, no-store'
    );

    return res.status(201).json({
      success: true,
      organizationId,
      fromCache: false,
      approval:
        responseApproval(approval)
    });
  } catch (error) {
    console.error(
      '[ToolApproval] Request failed',
      error
    );

    return res.status(500).json({
      success: false,
      reasonCode: 'INTERNAL_ERROR'
    });
  }
}

export async function decideToolApproval(
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
  const approvalId =
    req.params.approvalId;
  const decision =
    req.body?.decision;
  const rawNote =
    req.body?.note;

  if (
    !isSafeId(organizationId) ||
    !isSafeId(approvalId) ||
    !['approved', 'rejected'].includes(
      decision
    ) ||
    (
      rawNote !== undefined &&
      rawNote !== null &&
      (
        typeof rawNote !== 'string' ||
        rawNote.length > MAX_TEXT ||
        /[\u0000-\u001F\u007F]/.test(
          rawNote
        )
      )
    )
  ) {
    return res.status(400).json({
      success: false,
      reasonCode:
        'INVALID_TOOL_APPROVAL_DECISION'
    });
  }

  try {
    const db =
      (dependencies.getFirestore ??
        getFirestore)();

    const authority =
      await resolveConnectAuthority(
        db,
        organizationId,
        actorUid
      );

    if (
      !authority.allowed ||
      !authority.canApprove
    ) {
      return res.status(403).json({
        success: false,
        reasonCode:
          'CONNECT_APPROVAL_DECISION_AUTHORITY_REQUIRED'
      });
    }

    const approvalRef = db.doc(
      `organizations/${organizationId}/toolApprovals/${approvalId}`
    );
    const snapshot =
      await approvalRef.get();

    if (!snapshot.exists) {
      return res.status(404).json({
        success: false,
        reasonCode:
          'TOOL_APPROVAL_NOT_FOUND'
      });
    }

    const data =
      (snapshot.data() ?? {}) as Record<
        string,
        any
      >;
    const approval =
      approvalFromData(
        approvalId,
        data
      );

    if (!approval) {
      return res.status(409).json({
        success: false,
        reasonCode:
          'TOOL_APPROVAL_RECORD_INVALID'
      });
    }

    if (
      approval.organizationId !==
      organizationId
    ) {
      return res.status(403).json({
        success: false,
        reasonCode:
          'TOOL_APPROVAL_TENANT_MISMATCH'
      });
    }

    if (
      approval.toolId !==
      CONNECT_TOOL_ID
    ) {
      return res.status(409).json({
        success: false,
        reasonCode:
          'TOOL_APPROVAL_TOOL_UNSUPPORTED'
      });
    }

    if (
      approval.status === decision
    ) {
      return res.status(200).json({
        success: true,
        organizationId,
        fromCache: true,
        approval:
          responseApproval(approval)
      });
    }

    if (approval.status !== 'pending') {
      return res.status(409).json({
        success: false,
        reasonCode:
          'TOOL_APPROVAL_ALREADY_DECIDED'
      });
    }

    const nowMs =
      (dependencies.now ?? Date.now)();

    if (
      isToolApprovalExpired(
        approval,
        nowMs
      )
    ) {
      const expired:
        ToolApprovalRecord = {
        ...approval,
        status: 'expired',
        approverUid: actorUid,
        decidedAtMs: nowMs
      };

      await approvalRef.set({
        status: 'expired',
        approverUid: actorUid,
        decidedAtMs: nowMs,
        expiredAt:
          FieldValue.serverTimestamp(),
        updatedAt:
          FieldValue.serverTimestamp()
      }, { merge: true });

      return res.status(409).json({
        success: false,
        reasonCode:
          'TOOL_APPROVAL_EXPIRED',
        approval:
          responseApproval(expired)
      });
    }

    const decisionNote =
      typeof rawNote === 'string' &&
      rawNote.trim()
        ? rawNote.trim()
        : null;

    const decided:
      ToolApprovalRecord = {
        ...approval,
        status: decision,
        approverUid: actorUid,
        decidedAtMs: nowMs,
        decisionNote
      };

    await approvalRef.set({
      status: decision,
      approverUid: actorUid,
      approverAccessSource:
        authority.accessSource,
      approverSystemRole:
        authority.systemRole ?? null,
      approverOrganizationRole:
        authority.organizationRole ?? null,
      decidedAtMs: nowMs,
      decisionNote,
      decidedAt:
        FieldValue.serverTimestamp(),
      updatedAt:
        FieldValue.serverTimestamp()
    }, { merge: true });

    res.setHeader(
      'Cache-Control',
      'private, no-store'
    );

    return res.status(200).json({
      success: true,
      organizationId,
      fromCache: false,
      approval:
        responseApproval(decided)
    });
  } catch (error) {
    console.error(
      '[ToolApproval] Decision failed',
      error
    );

    return res.status(500).json({
      success: false,
      reasonCode: 'INTERNAL_ERROR'
    });
  }
}

export async function getToolApproval(
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
  const approvalId =
    req.params.approvalId;

  if (
    !isSafeId(organizationId) ||
    !isSafeId(approvalId)
  ) {
    return res.status(400).json({
      success: false,
      reasonCode: 'INVALID_REQUEST_PATH'
    });
  }

  try {
    const db =
      (dependencies.getFirestore ??
        getFirestore)();

    const authority =
      await resolveConnectAuthority(
        db,
        organizationId,
        actorUid
      );

    if (!authority.allowed) {
      return res.status(403).json({
        success: false,
        reasonCode:
          'CONNECT_APPROVAL_ACCESS_DENIED'
      });
    }

    const snapshot = await db.doc(
      `organizations/${organizationId}/toolApprovals/${approvalId}`
    ).get();

    if (!snapshot.exists) {
      return res.status(404).json({
        success: false,
        reasonCode:
          'TOOL_APPROVAL_NOT_FOUND'
      });
    }

    const approval =
      approvalFromData(
        approvalId,
        (snapshot.data() ?? {}) as Record<
          string,
          any
        >
      );

    if (
      !approval ||
      approval.organizationId !==
        organizationId
    ) {
      return res.status(403).json({
        success: false,
        reasonCode:
          'TOOL_APPROVAL_TENANT_MISMATCH'
      });
    }

    res.setHeader(
      'Cache-Control',
      'private, no-store'
    );

    return res.status(200).json({
      success: true,
      organizationId,
      approval:
        responseApproval(approval)
    });
  } catch (error) {
    console.error(
      '[ToolApproval] Read failed',
      error
    );

    return res.status(500).json({
      success: false,
      reasonCode: 'INTERNAL_ERROR'
    });
  }
}
