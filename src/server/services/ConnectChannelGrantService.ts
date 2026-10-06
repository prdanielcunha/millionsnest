import crypto from 'crypto';
import admin from 'firebase-admin';
import { isCanonicalGlobalRole } from '../../lib/permissionService.js';

const CHANNEL_GRANT_COLLECTION = 'connect_channel_grants';
const GRANT_TTL_MS = 180 * 24 * 60 * 60 * 1000;
const SESSION_TOKEN_TTL_MS = 5 * 60 * 1000;

type RequestLike = {
  headers: { authorization?: string | string[] };
  body?: unknown;
};

type ResponseLike = {
  status(code: number): ResponseLike;
  json(body: unknown): unknown;
  setHeader(name: string, value: string): void;
};

export type ConnectChannelGrantDependencies = {
  verifyIdToken(token: string): Promise<{ uid?: string | null }>;
  getDb(): admin.firestore.Firestore | null;
  createCustomToken(uid: string, claims?: Record<string, unknown>): Promise<string>;
  now(): number;
  randomBytes?(size: number): Buffer;
  logger?: {
    info?: (...args: unknown[]) => void;
    warn?: (...args: unknown[]) => void;
    error?: (...args: unknown[]) => void;
  };
};

type GrantDocument = {
  schemaVersion: 1;
  channel: 'whatsapp';
  channelIdentityRef: string;
  uid: string;
  organizationId: string;
  status: 'active';
  secretHash: string;
  createdAtMs: number;
  updatedAtMs: number;
  expiresAtMs: number;
};

function cleanString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function noStore(res: ResponseLike) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}

function maskUid(uid: string): string {
  if (uid.length <= 8) return '...';
  return `${uid.slice(0, 4)}...${uid.slice(-4)}`;
}

function isExcludedStatus(value: unknown): boolean {
  const status = cleanString(value).toLowerCase();
  return ['inactive', 'suspended', 'disabled', 'removed', 'revoked', 'archived'].includes(status);
}

function validOrganizationId(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const clean = value.trim();
  if (!clean || clean.length > 256 || clean === '.' || clean === '..') return false;
  if (clean.includes('/') || clean.includes('\\')) return false;
  return !/[\x00-\x1F\x7F]/.test(clean);
}

function validIdentityRef(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value.trim());
}

function validGrantSecret(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{32,180}$/.test(value.trim());
}

function secretHash(secret: string): string {
  return crypto.createHash('sha256').update(secret, 'utf8').digest('hex');
}

function secretMatches(secret: string, expectedHash: string): boolean {
  if (!/^[a-f0-9]{64}$/.test(expectedHash)) return false;
  const actual = Buffer.from(secretHash(secret), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

async function resolveAuthority(
  db: admin.firestore.Firestore,
  uid: string,
  organizationId: string,
): Promise<{ allowed: boolean; reason: string; globalAccess: boolean }> {
  const [userDoc, organizationDoc, membershipDoc] = await Promise.all([
    db.collection('users').doc(uid).get(),
    db.collection('organizations').doc(organizationId).get(),
    db.collection('organizations').doc(organizationId).collection('members').doc(uid).get(),
  ]);

  if (!userDoc.exists || isExcludedStatus(userDoc.data()?.status) || userDoc.data()?.disabled === true) {
    return { allowed: false, reason: 'USER_INACTIVE_OR_MISSING', globalAccess: false };
  }

  if (
    !organizationDoc.exists ||
    isExcludedStatus(organizationDoc.data()?.status) ||
    organizationDoc.data()?.disabled === true ||
    organizationDoc.data()?.archived === true
  ) {
    return { allowed: false, reason: 'ORGANIZATION_INACTIVE_OR_MISSING', globalAccess: false };
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
    return { allowed: false, reason: 'MEMBERSHIP_REQUIRED', globalAccess };
  }

  return {
    allowed: true,
    reason: globalAccess ? 'GLOBAL_SYSTEM_ROLE' : 'ORGANIZATION_MEMBERSHIP',
    globalAccess,
  };
}

function bearerToken(req: RequestLike): string {
  const header = req.headers.authorization;
  if (typeof header !== 'string' || !/^Bearer\s+\S+$/i.test(header.trim())) return '';
  return header.trim().replace(/^Bearer\s+/i, '');
}

/**
 * Links an opaque Connect channel identity to the authenticated MillionsNest user.
 *
 * The opaque identity ref is created inside Connect from the provider identifier
 * using a server-side HMAC. Hub never receives or stores the raw WhatsApp phone.
 * The returned grant secret is shown only to the calling Connect server and is
 * stored by Hub only as SHA-256. Organization/RBAC is revalidated again every
 * time the grant is exchanged for a short-lived Firebase custom token.
 */
export async function handleConnectChannelGrantCreateRequest(
  req: RequestLike,
  res: ResponseLike,
  dependencies: ConnectChannelGrantDependencies,
): Promise<unknown> {
  noStore(res);

  const token = bearerToken(req);
  if (!token) {
    return res.status(401).json({ success: false, code: 'UNAUTHORIZED' });
  }

  let uid = '';
  try {
    uid = cleanString((await dependencies.verifyIdToken(token))?.uid);
  } catch {
    return res.status(401).json({ success: false, code: 'UNAUTHORIZED' });
  }
  if (!uid) {
    return res.status(401).json({ success: false, code: 'UNAUTHORIZED' });
  }

  const body = req.body && typeof req.body === 'object'
    ? req.body as Record<string, unknown>
    : {};
  if (
    body.channel !== 'whatsapp' ||
    !validIdentityRef(body.channelIdentityRef) ||
    !validOrganizationId(body.organizationId)
  ) {
    return res.status(400).json({ success: false, code: 'INVALID_CHANNEL_GRANT_REQUEST' });
  }

  const channelIdentityRef = body.channelIdentityRef.trim();
  const organizationId = body.organizationId.trim();
  const db = dependencies.getDb();
  if (!db) {
    return res.status(503).json({ success: false, code: 'SERVICE_UNAVAILABLE' });
  }

  try {
    const authority = await resolveAuthority(db, uid, organizationId);
    if (!authority.allowed) {
      dependencies.logger?.warn?.('[CONNECT_CHANNEL_GRANT] link denied', {
        channel: 'whatsapp',
        organizationId,
        maskedUid: maskUid(uid),
        reason: authority.reason,
      });
      return res.status(403).json({
        success: false,
        code: 'CHANNEL_GRANT_ACCESS_DENIED',
        reason: authority.reason,
      });
    }

    const rawSecret = (dependencies.randomBytes ?? crypto.randomBytes)(32).toString('base64url');
    const now = dependencies.now();
    const record: GrantDocument = {
      schemaVersion: 1,
      channel: 'whatsapp',
      channelIdentityRef,
      uid,
      organizationId,
      status: 'active',
      secretHash: secretHash(rawSecret),
      createdAtMs: now,
      updatedAtMs: now,
      expiresAtMs: now + GRANT_TTL_MS,
    };

    await db.collection(CHANNEL_GRANT_COLLECTION).doc(channelIdentityRef).set(record);

    dependencies.logger?.info?.('[CONNECT_CHANNEL_GRANT] linked', {
      channel: 'whatsapp',
      organizationId,
      maskedUid: maskUid(uid),
      accessSource: authority.reason,
    });

    return res.status(200).json({
      success: true,
      protocolVersion: '1.0.0',
      channel: 'whatsapp',
      grantRef: channelIdentityRef,
      grantSecret: rawSecret,
      organizationId,
      expiresAt: record.expiresAtMs,
    });
  } catch (error) {
    dependencies.logger?.error?.('[CONNECT_CHANNEL_GRANT] link failed', {
      channel: 'whatsapp',
      organizationId,
      maskedUid: maskUid(uid),
      error: error instanceof Error ? error.message : 'unknown_error',
    });
    return res.status(500).json({ success: false, code: 'CHANNEL_GRANT_CREATE_FAILED' });
  }
}

/**
 * Exchanges a Connect-held channel grant for a fresh identity-only Firebase custom token.
 *
 * This endpoint intentionally does not accept organization/role/capability from
 * the caller. Tenant and membership are read from the stored grant and
 * revalidated against Hub on every exchange.
 */
export async function handleConnectChannelSessionRequest(
  req: RequestLike,
  res: ResponseLike,
  dependencies: ConnectChannelGrantDependencies,
): Promise<unknown> {
  noStore(res);

  const body = req.body && typeof req.body === 'object'
    ? req.body as Record<string, unknown>
    : {};
  if (
    body.channel !== 'whatsapp' ||
    !validIdentityRef(body.grantRef) ||
    !validGrantSecret(body.grantSecret)
  ) {
    return res.status(400).json({ success: false, code: 'INVALID_CHANNEL_SESSION_REQUEST' });
  }

  const grantRef = body.grantRef.trim();
  const grantSecret = body.grantSecret.trim();
  const db = dependencies.getDb();
  if (!db) {
    return res.status(503).json({ success: false, code: 'SERVICE_UNAVAILABLE' });
  }

  try {
    const grantDoc = await db.collection(CHANNEL_GRANT_COLLECTION).doc(grantRef).get();
    const grant = grantDoc.exists ? grantDoc.data() as Partial<GrantDocument> | undefined : undefined;
    const now = dependencies.now();

    if (
      !grant ||
      grant.schemaVersion !== 1 ||
      grant.channel !== 'whatsapp' ||
      grant.channelIdentityRef !== grantRef ||
      grant.status !== 'active' ||
      typeof grant.secretHash !== 'string' ||
      typeof grant.uid !== 'string' ||
      !validOrganizationId(grant.organizationId) ||
      typeof grant.expiresAtMs !== 'number' ||
      grant.expiresAtMs <= now ||
      !secretMatches(grantSecret, grant.secretHash)
    ) {
      return res.status(401).json({ success: false, code: 'CHANNEL_GRANT_INVALID' });
    }

    const uid = grant.uid.trim();
    const organizationId = grant.organizationId.trim();
    const authority = await resolveAuthority(db, uid, organizationId);
    if (!authority.allowed) {
      dependencies.logger?.warn?.('[CONNECT_CHANNEL_SESSION] revalidation denied', {
        channel: 'whatsapp',
        organizationId,
        maskedUid: maskUid(uid),
        reason: authority.reason,
      });
      return res.status(403).json({
        success: false,
        code: 'CHANNEL_GRANT_ACCESS_DENIED',
        reason: authority.reason,
      });
    }

    let customToken: string;
    try {
      // Identity only. Tenant/RBAC remain canonical Hub/MusicScale checks.
      customToken = await dependencies.createCustomToken(uid, { appId: 'connect-channel' });
    } catch {
      return res.status(500).json({ success: false, code: 'CHANNEL_SESSION_TOKEN_FAILED' });
    }

    dependencies.logger?.info?.('[CONNECT_CHANNEL_SESSION] issued', {
      channel: 'whatsapp',
      organizationId,
      maskedUid: maskUid(uid),
      accessSource: authority.reason,
    });

    return res.status(200).json({
      success: true,
      protocolVersion: '1.0.0',
      channel: 'whatsapp',
      customToken,
      userId: uid,
      organizationId,
      expiresAt: now + SESSION_TOKEN_TTL_MS,
    });
  } catch (error) {
    dependencies.logger?.error?.('[CONNECT_CHANNEL_SESSION] failed', {
      channel: 'whatsapp',
      error: error instanceof Error ? error.message : 'unknown_error',
    });
    return res.status(500).json({ success: false, code: 'CHANNEL_SESSION_FAILED' });
  }
}
