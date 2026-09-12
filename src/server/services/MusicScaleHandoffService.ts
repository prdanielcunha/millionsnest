import { resolveEcosystemAppAccess, type EcosystemAppId } from './EcosystemAccessResolver.js';
import { handleConnectHandoffRequest } from './ConnectHandoffService.js';

export type HandoffRequestLike = {
  headers: { authorization?: string | string[] };
  body?: unknown;
};

export type HandoffResponseLike = {
  status(code: number): HandoffResponseLike;
  json(body: unknown): unknown;
  setHeader(name: string, value: string): void;
};

export type MusicScaleHandoffDependencies = {
  verifyIdToken(token: string): Promise<{ uid?: string | null }>;
  getDb(): FirebaseFirestore.Firestore | null;
  createCustomToken(uid: string, claims: Record<string, unknown>): Promise<string>;
  now(): number;
  logger?: {
    info?: (...args: unknown[]) => void;
    warn?: (...args: unknown[]) => void;
    error?: (...args: unknown[]) => void;
  };
};

const STANDARD_HANDOFF_APPS = new Set<EcosystemAppId>([
  'musicscale',
  'nestfinance',
  'nestjourney',
]);

function maskUid(uid: string): string {
  if (uid.length <= 8) return '...';
  return `${uid.substring(0, 4)}...${uid.substring(uid.length - 4)}`;
}

function setNoStoreHeaders(res: HandoffResponseLike) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}

function invalidRequest(res: HandoffResponseLike, error: string) {
  return res.status(400).json({ error, code: 'INVALID_REQUEST', retryable: false });
}

/**
 * Canonical short-lived handoff issuer for ecosystem apps.
 *
 * The historical function name is retained because the public API route imports
 * it. Connect keeps its stricter founder-pilot service; the remaining products
 * share this validated protocol and always re-resolve access server-side.
 */
export async function handleMusicScaleHandoffRequest(
  req: HandoffRequestLike,
  res: HandoffResponseLike,
  dependencies: MusicScaleHandoffDependencies
): Promise<unknown> {
  if (req.body && typeof req.body === 'object' && (req.body as any).appId === 'connect') {
    return handleConnectHandoffRequest(req, res, {
      verifyIdToken: dependencies.verifyIdToken,
      getDb: () => dependencies.getDb() as any,
      createCustomToken: dependencies.createCustomToken,
      now: dependencies.now,
      logger: dependencies.logger,
    });
  }

  setNoStoreHeaders(res);

  const authHeader = req.headers.authorization;
  if (!authHeader || Array.isArray(authHeader) || typeof authHeader !== 'string') {
    return res.status(401).json({
      error: 'Unauthorized: Missing or invalid authorization header.',
      code: 'UNAUTHORIZED',
      retryable: false,
    });
  }

  const parts = authHeader.trim().split(/\s+/);
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer' || !parts[1]) {
    return res.status(401).json({
      error: 'Unauthorized: Invalid bearer format.',
      code: 'UNAUTHORIZED',
      retryable: false,
    });
  }

  let decoded: { uid?: string | null } | null = null;
  try {
    decoded = await dependencies.verifyIdToken(parts[1]);
  } catch {
    return res.status(401).json({
      error: 'Unauthorized: Invalid ID token.',
      code: 'UNAUTHORIZED',
      retryable: false,
    });
  }

  const uid = decoded?.uid;
  if (!uid || typeof uid !== 'string' || uid.trim() === '') {
    return res.status(401).json({
      error: 'Unauthorized: Invalid ID token payload.',
      code: 'UNAUTHORIZED',
      retryable: false,
    });
  }

  if (!req.body || typeof req.body !== 'object') {
    return invalidRequest(res, 'Invalid request: body must be an object.');
  }

  const { appId: rawAppId, orgId, supportMode } = req.body as any;
  if (typeof rawAppId !== 'string' || !STANDARD_HANDOFF_APPS.has(rawAppId as EcosystemAppId)) {
    return invalidRequest(res, 'Invalid request: unsupported appId.');
  }
  const appId = rawAppId as EcosystemAppId;

  if (typeof orgId !== 'string') {
    return invalidRequest(res, 'Invalid request: orgId must be a string.');
  }

  const cleanOrgId = orgId.trim();
  if (
    cleanOrgId === '' ||
    cleanOrgId.length > 256 ||
    cleanOrgId === '.' ||
    cleanOrgId === '..' ||
    cleanOrgId.includes('/') ||
    cleanOrgId.includes('\\') ||
    /[\x00-\x1F\x7F]/.test(cleanOrgId)
  ) {
    return invalidRequest(res, 'Invalid request: invalid orgId.');
  }

  if (supportMode !== undefined && supportMode !== null && typeof supportMode !== 'boolean') {
    return invalidRequest(res, 'Invalid request: supportMode must be a boolean.');
  }
  const supportModeRequested = supportMode === true;

  const db = dependencies.getDb();
  if (!db) {
    return res.status(503).json({
      error: 'Service Unavailable: Database not initialized.',
      code: 'SERVICE_UNAVAILABLE',
      retryable: true,
    });
  }

  let access;
  try {
    access = await resolveEcosystemAppAccess({
      uid,
      organizationId: cleanOrgId,
      appId,
      db: db as any,
    });
  } catch {
    dependencies.logger?.error?.('[HANDOFF_RESOLVER_ERROR]', {
      appId,
      organizationId: cleanOrgId,
      maskedUid: maskUid(uid),
      code: 'HANDOFF_RESOLVER_FAILED',
      timestamp: dependencies.now(),
    });
    return res.status(500).json({
      error: 'Internal server error.',
      code: 'HANDOFF_ISSUE_FAILED',
      retryable: true,
    });
  }

  if (!access || access.accessible !== true) {
    const reason = access?.denialReason || 'UNKNOWN_REASON';
    const retryable = reason === 'SUBSCRIPTION_NOT_FOUND' || reason === 'ENTITLEMENT_NOT_CONFIGURED';
    let error = 'Forbidden: Access denied to this organization.';

    if ([
      'SUBSCRIPTION_NOT_FOUND',
      'SUBSCRIPTION_INACTIVE',
      'ENTITLEMENT_NOT_CONFIGURED',
      'ENTITLEMENT_INACTIVE',
    ].includes(reason)) {
      error = 'Access denied: App entitlement missing or inactive.';
    } else if (reason === 'SUBSCRIPTION_PAYMENT_REQUIRED') {
      error = 'Access denied: Subscription payment required.';
    }

    console.log('[HANDOFF]', {
      appId,
      organizationId: cleanOrgId,
      maskedUid: maskUid(uid),
      accessGranted: false,
      accessSource: access?.accessSource || 'denied',
      denialReason: reason,
      isGlobalAccess: access?.isGlobalAccess || false,
      supportModeRequested,
      supportModeVerified: false,
      stripeLookupPerformed: false,
      selfHealingExecuted: false,
    });

    return res.status(403).json({
      error,
      code: 'ECOSYSTEM_ACCESS_DENIED',
      reason,
      retryable,
    });
  }

  if (supportModeRequested && !access.isGlobalAccess) {
    return res.status(403).json({
      error: 'Forbidden: Access denied to this organization.',
      code: 'SUPPORT_MODE_FORBIDDEN',
      reason: 'SUPPORT_MODE_FORBIDDEN',
      retryable: false,
    });
  }
  const verifiedSupportMode = supportModeRequested && access.isGlobalAccess;

  let customToken: string;
  try {
    customToken = await dependencies.createCustomToken(uid, {
      orgId: cleanOrgId,
      appId,
      supportMode: verifiedSupportMode,
    });
  } catch {
    dependencies.logger?.error?.('[HANDOFF_TOKEN_ERROR]', {
      appId,
      organizationId: cleanOrgId,
      maskedUid: maskUid(uid),
      code: 'HANDOFF_TOKEN_FAILED',
      timestamp: dependencies.now(),
    });
    return res.status(500).json({
      error: 'Internal server error.',
      code: 'HANDOFF_ISSUE_FAILED',
      retryable: true,
    });
  }

  console.log('[HANDOFF]', {
    appId,
    organizationId: cleanOrgId,
    maskedUid: maskUid(uid),
    accessGranted: true,
    accessSource: access.accessSource,
    denialReason: null,
    isGlobalAccess: access.isGlobalAccess,
    supportModeRequested,
    supportModeVerified: verifiedSupportMode,
    stripeLookupPerformed: false,
    selfHealingExecuted: false,
  });

  return res.status(200).json({
    appId,
    protocolVersion: '1.0.0',
    customToken,
    orgId: cleanOrgId,
    uid,
    expiresAt: dependencies.now() + 300000,
    supportMode: verifiedSupportMode,
  });
}
