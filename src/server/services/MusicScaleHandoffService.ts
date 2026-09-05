import { resolveEcosystemAppAccess } from './EcosystemAccessResolver.js';

export type HandoffRequestLike = {
  headers: {
    authorization?: string | string[];
  };
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
  createCustomToken(
    uid: string,
    claims: Record<string, unknown>
  ): Promise<string>;
  now(): number;
  logger?: {
    info?: (...args: unknown[]) => void;
    warn?: (...args: unknown[]) => void;
    error?: (...args: unknown[]) => void;
  };
};

function maskUid(u: string): string {
  if (u.length <= 8) return '...';
  return u.substring(0, 4) + '...' + u.substring(u.length - 4);
}

export async function handleMusicScaleHandoffRequest(
  req: HandoffRequestLike,
  res: HandoffResponseLike,
  dependencies: MusicScaleHandoffDependencies
): Promise<unknown> {
  // Always set no-cache headers for all responses
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  // 1. Verify Authorization Header
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({
      error: 'Unauthorized: Missing authorization header.',
      code: 'UNAUTHORIZED',
      retryable: false
    });
  }
  if (Array.isArray(authHeader)) {
    return res.status(401).json({
      error: 'Unauthorized: Duplicate authorization headers.',
      code: 'UNAUTHORIZED',
      retryable: false
    });
  }
  if (typeof authHeader !== 'string') {
    return res.status(401).json({
      error: 'Unauthorized: Invalid authorization header.',
      code: 'UNAUTHORIZED',
      retryable: false
    });
  }

  const parts = authHeader.trim().split(/\s+/);
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer' || !parts[1]) {
    return res.status(401).json({
      error: 'Unauthorized: Invalid bearer format.',
      code: 'UNAUTHORIZED',
      retryable: false
    });
  }

  const token = parts[1];
  let decoded: { uid?: string | null } | null = null;
  try {
    decoded = await dependencies.verifyIdToken(token);
  } catch (err) {
    return res.status(401).json({
      error: 'Unauthorized: Invalid ID token.',
      code: 'UNAUTHORIZED',
      retryable: false
    });
  }

  const uid = decoded?.uid;
  if (!uid || typeof uid !== 'string' || uid.trim() === '') {
    return res.status(401).json({
      error: 'Unauthorized: Invalid ID token payload.',
      code: 'UNAUTHORIZED',
      retryable: false
    });
  }

  // 2. Body Validation
  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({
      error: 'Invalid request: body must be an object.',
      code: 'INVALID_REQUEST',
      retryable: false
    });
  }

  const { appId, orgId, supportMode } = req.body as any;

  if (!['musicscale', 'nestjourney', 'raiz_e_mesa', 'raiz-e-mesa'].includes(appId)) {
    return res.status(400).json({
      error: 'Invalid request: unsupported appId.',
      code: 'INVALID_REQUEST',
      retryable: false
    });
  }
  if (orgId === undefined || orgId === null) {
    return res.status(400).json({
      error: 'Invalid request: orgId is required.',
      code: 'INVALID_REQUEST',
      retryable: false
    });
  }
  if (typeof orgId !== 'string') {
    return res.status(400).json({
      error: 'Invalid request: orgId must be a string.',
      code: 'INVALID_REQUEST',
      retryable: false
    });
  }

  const cleanOrgId = orgId.trim();
  if (cleanOrgId === '') {
    return res.status(400).json({
      error: 'Invalid request: orgId cannot be empty.',
      code: 'INVALID_REQUEST',
      retryable: false
    });
  }
  if (cleanOrgId.length > 256) {
    return res.status(400).json({
      error: 'Invalid request: orgId exceeds 256 characters.',
      code: 'INVALID_REQUEST',
      retryable: false
    });
  }
  if (cleanOrgId === '.' || cleanOrgId === '..') {
    return res.status(400).json({
      error: 'Invalid request: orgId cannot be "." or "..".',
      code: 'INVALID_REQUEST',
      retryable: false
    });
  }
  if (cleanOrgId.includes('/') || cleanOrgId.includes('\\')) {
    return res.status(400).json({
      error: 'Invalid request: orgId cannot contain slashes or backslashes.',
      code: 'INVALID_REQUEST',
      retryable: false
    });
  }

  const hasControlChars = /[\x00-\x1F\x7F]/.test(cleanOrgId);
  if (hasControlChars) {
    return res.status(400).json({
      error: 'Invalid request: orgId cannot contain control characters.',
      code: 'INVALID_REQUEST',
      retryable: false
    });
  }

  if (supportMode !== undefined && supportMode !== null && typeof supportMode !== 'boolean') {
    return res.status(400).json({
      error: 'Invalid request: supportMode must be a boolean.',
      code: 'INVALID_REQUEST',
      retryable: false
    });
  }
  const supportModeRequested = !!supportMode;

  // 3. Database Check
  const db = dependencies.getDb();
  if (!db) {
    return res.status(503).json({
      error: 'Service Unavailable: Database not initialized.',
      code: 'SERVICE_UNAVAILABLE',
      retryable: true
    });
  }

  // 4. Resolve Access
  let access;
  try {
    access = await resolveEcosystemAppAccess({
      uid,
      organizationId: cleanOrgId,
      appId,
      db: db as any
    });
  } catch (err: any) {
    if (dependencies.logger && typeof dependencies.logger.error === 'function') {
      dependencies.logger.error('[HANDOFF_RESOLVER_ERROR]', {
        appId,
        organizationId: cleanOrgId,
        maskedUid: maskUid(uid),
        code: 'HANDOFF_RESOLVER_FAILED',
        timestamp: dependencies.now()
      });
    }
    return res.status(500).json({
      error: 'Internal server error.',
      code: 'HANDOFF_ISSUE_FAILED',
      retryable: true
    });
  }

  // 5. Handle Access Denial
  if (!access || access.accessible !== true) {
    let errorMsg = 'Forbidden: Access denied to this organization.';
    const reason = access?.denialReason;
    
    let isRetryable = false;
    if (reason === 'SUBSCRIPTION_NOT_FOUND' || reason === 'ENTITLEMENT_NOT_CONFIGURED') {
      isRetryable = true;
    }

    if (reason) {
      if ([
        'SUBSCRIPTION_NOT_FOUND',
        'SUBSCRIPTION_INACTIVE',
        'ENTITLEMENT_NOT_CONFIGURED',
        'ENTITLEMENT_INACTIVE'
      ].includes(reason)) {
        errorMsg = 'Access denied: Subscription missing or inactive.';
      } else if (reason === 'SUBSCRIPTION_PAYMENT_REQUIRED') {
        errorMsg = 'Access denied: Subscription payment required.';
      } else {
        errorMsg = 'Forbidden: Access denied to this organization.';
      }
    }

    console.log('[HANDOFF]', {
      appId,
      organizationId: cleanOrgId,
      maskedUid: maskUid(uid),
      accessGranted: false,
      accessSource: access ? access.accessSource : 'denied',
      denialReason: reason || null,
      isGlobalAccess: access ? access.isGlobalAccess : false,
      supportModeRequested,
      supportModeVerified: false,
      stripeLookupPerformed: false,
      selfHealingExecuted: false
    });

    return res.status(403).json({
      error: errorMsg,
      code: 'ECOSYSTEM_ACCESS_DENIED',
      reason: reason || 'UNKNOWN_REASON',
      retryable: isRetryable
    });
  }

  // 6. Support Mode Authorization
  if (supportModeRequested && !access.isGlobalAccess) {
    console.log('[HANDOFF]', {
      appId,
      organizationId: cleanOrgId,
      maskedUid: maskUid(uid),
      accessGranted: false,
      accessSource: access.accessSource,
      denialReason: 'SUPPORT_MODE_FORBIDDEN',
      isGlobalAccess: access.isGlobalAccess,
      supportModeRequested,
      supportModeVerified: false,
      stripeLookupPerformed: false,
      selfHealingExecuted: false
    });

    return res.status(403).json({
      error: 'Forbidden: Access denied to this organization.',
      code: 'SUPPORT_MODE_FORBIDDEN',
      reason: 'SUPPORT_MODE_FORBIDDEN',
      retryable: false
    });
  }
  const verifiedSupportMode = supportModeRequested && access.isGlobalAccess;

  // 7. Create Custom Token
  let customToken;
  try {
    customToken = await dependencies.createCustomToken(uid, {
      orgId: cleanOrgId,
      appId,
      supportMode: verifiedSupportMode
    });
  } catch (err: any) {
    if (dependencies.logger && typeof dependencies.logger.error === 'function') {
      dependencies.logger.error('[HANDOFF_TOKEN_ERROR]', {
        appId,
        organizationId: cleanOrgId,
        maskedUid: maskUid(uid),
        code: 'HANDOFF_TOKEN_FAILED',
        timestamp: dependencies.now()
      });
    }
    return res.status(500).json({
      error: 'Internal server error.',
      code: 'HANDOFF_ISSUE_FAILED',
      retryable: true
    });
  }

  // 8. Log Structured Entry
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
    selfHealingExecuted: false
  });

  // 9. Send Success Response
  return res.status(200).json({
    appId,
    protocolVersion: '1.0.0',
    customToken,
    orgId: cleanOrgId,
    uid,
    expiresAt: dependencies.now() + 300000,
    supportMode: verifiedSupportMode
  });
}
