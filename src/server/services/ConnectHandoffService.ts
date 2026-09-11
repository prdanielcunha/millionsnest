import admin from 'firebase-admin';
import { isCanonicalGlobalRole } from '../../lib/permissionService.js';

export type ConnectHandoffRequestLike = {
  headers: {
    authorization?: string | string[];
  };
  body?: unknown;
};

export type ConnectHandoffResponseLike = {
  status(code: number): ConnectHandoffResponseLike;
  json(body: unknown): unknown;
  setHeader(name: string, value: string): void;
};

export type ConnectHandoffDependencies = {
  verifyIdToken(token: string): Promise<{ uid?: string | null }>;
  getDb(): admin.firestore.Firestore | null;
  createCustomToken(uid: string, claims?: Record<string, unknown>): Promise<string>;
  now(): number;
  logger?: {
    info?: (...args: unknown[]) => void;
    warn?: (...args: unknown[]) => void;
    error?: (...args: unknown[]) => void;
  };
};

function cleanString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function maskUid(uid: string): string {
  if (uid.length <= 8) return '...';
  return `${uid.slice(0, 4)}...${uid.slice(-4)}`;
}

function isExcludedStatus(value: unknown): boolean {
  const status = cleanString(value).toLowerCase();
  return ['inactive', 'suspended', 'disabled', 'removed', 'revoked', 'archived'].includes(status);
}

function isValidOrganizationId(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const clean = value.trim();
  if (!clean || clean.length > 256 || clean === '.' || clean === '..') return false;
  if (clean.includes('/') || clean.includes('\\')) return false;
  return !/[\x00-\x1F\x7F]/.test(clean);
}

/**
 * Issues a short-lived Firebase custom-token handoff for MillionsNest Connect.
 *
 * Important: the handoff token establishes identity only. It intentionally does
 * not contain organization or permission claims. Connect must exchange it for a
 * normal Firebase ID token and then resolve the canonical organization/RBAC
 * context through Hub's /api/ecosystem/connect/session-context endpoint.
 */
export async function handleConnectHandoffRequest(
  req: ConnectHandoffRequestLike,
  res: ConnectHandoffResponseLike,
  dependencies: ConnectHandoffDependencies,
): Promise<unknown> {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  const authHeader = req.headers.authorization;
  if (
    typeof authHeader !== 'string' ||
    !/^Bearer\s+\S+$/i.test(authHeader.trim())
  ) {
    return res.status(401).json({
      error: 'Unauthorized.',
      code: 'UNAUTHORIZED',
      retryable: false,
    });
  }

  let decoded: { uid?: string | null };
  try {
    decoded = await dependencies.verifyIdToken(authHeader.trim().replace(/^Bearer\s+/i, ''));
  } catch {
    return res.status(401).json({
      error: 'Unauthorized.',
      code: 'UNAUTHORIZED',
      retryable: false,
    });
  }

  const uid = cleanString(decoded?.uid);
  if (!uid) {
    return res.status(401).json({
      error: 'Unauthorized.',
      code: 'UNAUTHORIZED',
      retryable: false,
    });
  }

  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({
      error: 'Invalid request.',
      code: 'INVALID_REQUEST',
      retryable: false,
    });
  }

  const { appId, orgId, supportMode } = req.body as Record<string, unknown>;
  if (appId !== 'connect' || !isValidOrganizationId(orgId)) {
    return res.status(400).json({
      error: 'Invalid request.',
      code: 'INVALID_REQUEST',
      retryable: false,
    });
  }
  if (supportMode !== undefined && typeof supportMode !== 'boolean') {
    return res.status(400).json({
      error: 'Invalid request.',
      code: 'INVALID_REQUEST',
      retryable: false,
    });
  }

  const organizationId = orgId.trim();
  const db = dependencies.getDb();
  if (!db) {
    return res.status(503).json({
      error: 'Service unavailable.',
      code: 'SERVICE_UNAVAILABLE',
      retryable: true,
    });
  }

  try {
    const [userDoc, organizationDoc, membershipDoc] = await Promise.all([
      db.collection('users').doc(uid).get(),
      db.collection('organizations').doc(organizationId).get(),
      db.collection('organizations').doc(organizationId).collection('members').doc(uid).get(),
    ]);

    if (!userDoc.exists || isExcludedStatus(userDoc.data()?.status) || userDoc.data()?.disabled === true) {
      return res.status(403).json({
        error: 'Access denied.',
        code: 'ECOSYSTEM_ACCESS_DENIED',
        reason: 'USER_INACTIVE_OR_MISSING',
        retryable: false,
      });
    }

    if (
      !organizationDoc.exists ||
      isExcludedStatus(organizationDoc.data()?.status) ||
      organizationDoc.data()?.disabled === true ||
      organizationDoc.data()?.archived === true
    ) {
      return res.status(403).json({
        error: 'Access denied.',
        code: 'ECOSYSTEM_ACCESS_DENIED',
        reason: 'ORGANIZATION_INACTIVE_OR_MISSING',
        retryable: false,
      });
    }

    const systemRole = cleanString(userDoc.data()?.systemRole) || 'user';
    const globalAccess = isCanonicalGlobalRole(systemRole);
    const membership = membershipDoc.exists ? membershipDoc.data() || {} : null;
    const membershipActive = Boolean(
      membership &&
      !isExcludedStatus(membership.status) &&
      membership.enabled !== false,
    );

    if (!globalAccess && !membershipActive) {
      dependencies.logger?.warn?.('[CONNECT_HANDOFF] access denied', {
        appId: 'connect',
        organizationId,
        maskedUid: maskUid(uid),
        reason: 'MEMBERSHIP_REQUIRED',
      });
      return res.status(403).json({
        error: 'Access denied.',
        code: 'ECOSYSTEM_ACCESS_DENIED',
        reason: 'MEMBERSHIP_REQUIRED',
        retryable: false,
      });
    }

    const supportModeRequested = supportMode === true;
    if (supportModeRequested && !globalAccess) {
      return res.status(403).json({
        error: 'Access denied.',
        code: 'SUPPORT_MODE_FORBIDDEN',
        reason: 'SUPPORT_MODE_FORBIDDEN',
        retryable: false,
      });
    }

    let customToken: string;
    try {
      // Identity-only claim: tenant and RBAC authority are deliberately excluded.
      customToken = await dependencies.createCustomToken(uid, { appId: 'connect' });
    } catch {
      dependencies.logger?.error?.('[CONNECT_HANDOFF] token issue failed', {
        appId: 'connect',
        organizationId,
        maskedUid: maskUid(uid),
        code: 'HANDOFF_TOKEN_FAILED',
      });
      return res.status(500).json({
        error: 'Internal server error.',
        code: 'HANDOFF_ISSUE_FAILED',
        retryable: true,
      });
    }

    dependencies.logger?.info?.('[CONNECT_HANDOFF] issued', {
      appId: 'connect',
      organizationId,
      maskedUid: maskUid(uid),
      accessSource: globalAccess ? 'global_system_role' : 'organization_membership',
      supportMode: supportModeRequested && globalAccess,
    });

    return res.status(200).json({
      appId: 'connect',
      protocolVersion: '1.0.0',
      customToken,
      orgId: organizationId,
      uid,
      expiresAt: dependencies.now() + 300_000,
      supportMode: supportModeRequested && globalAccess,
    });
  } catch (error) {
    dependencies.logger?.error?.('[CONNECT_HANDOFF] resolver failed', {
      appId: 'connect',
      organizationId,
      maskedUid: maskUid(uid),
      code: 'HANDOFF_RESOLVER_FAILED',
      error: error instanceof Error ? error.message : 'unknown_error',
    });
    return res.status(500).json({
      error: 'Internal server error.',
      code: 'HANDOFF_ISSUE_FAILED',
      retryable: true,
    });
  }
}
