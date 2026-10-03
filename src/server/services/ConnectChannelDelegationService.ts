import type { ResolvedAppAccess } from './EcosystemAccessResolver.js';

export type ConnectChannelDelegationRequestLike = {
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
};

export type ConnectChannelDelegationResponseLike = {
  status(code: number): ConnectChannelDelegationResponseLike;
  json(body: unknown): unknown;
  setHeader(name: string, value: string): void;
};

export type ConnectChannelDelegationDependencies = {
  verifyServiceIdentity(token: string): Promise<{ email: string; subject: string }>;
  getDb(): any | null;
  resolveAccess(input: {
    uid: string;
    organizationId: string;
    appId: 'musicscale';
    db: any;
  }): Promise<ResolvedAppAccess>;
  createCustomToken(uid: string, claims: Record<string, unknown>): Promise<string>;
  now(): number;
  logger?: {
    info?: (...args: unknown[]) => void;
    warn?: (...args: unknown[]) => void;
    error?: (...args: unknown[]) => void;
  };
};

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function singleHeader(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return clean(value[0]);
  return clean(value);
}

function readHeader(headers: Record<string, string | string[] | undefined>, name: string): string {
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === target) return singleHeader(value);
  }
  return '';
}

function safeId(value: unknown, maxLength = 256): string | null {
  const text = clean(value);
  if (
    !text ||
    text.length > maxLength ||
    text.includes('/') ||
    text.includes('\\') ||
    /[\x00-\x1F\x7F]/.test(text)
  ) {
    return null;
  }
  return text;
}

function mask(value: string): string {
  if (value.length <= 8) return '***';
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

/**
 * Issues a short-lived Firebase custom token for a WhatsApp-linked actor.
 *
 * The caller is not a browser. It must be the dedicated Google Cloud identity
 * of the Connect runtime. Tenant/role/capability claims are deliberately NOT
 * embedded in the custom token: Connect exchanges it for a normal Firebase ID
 * token and the existing Hub + MusicScale authorization path revalidates the
 * actor and organization independently.
 */
export async function handleConnectChannelDelegationRequest(
  req: ConnectChannelDelegationRequestLike,
  res: ConnectChannelDelegationResponseLike,
  deps: ConnectChannelDelegationDependencies,
): Promise<unknown> {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');

  const auth = readHeader(req.headers, 'x-connect-service-authorization');
  if (!/^Bearer\s+\S+$/i.test(auth)) {
    return res.status(401).json({
      success: false,
      code: 'CONNECT_SERVICE_AUTH_REQUIRED',
      retryable: false,
    });
  }

  let serviceIdentity: { email: string; subject: string };
  try {
    serviceIdentity = await deps.verifyServiceIdentity(auth.replace(/^Bearer\s+/i, ''));
  } catch {
    return res.status(401).json({
      success: false,
      code: 'CONNECT_SERVICE_AUTH_INVALID',
      retryable: false,
    });
  }

  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return res.status(400).json({
      success: false,
      code: 'INVALID_REQUEST',
      retryable: false,
    });
  }

  const body = req.body as Record<string, unknown>;
  const uid = safeId(body.uid, 256);
  const organizationId = safeId(body.organizationId, 256);
  const channelIdentityRef = safeId(body.channelIdentityRef, 180);
  const channel = clean(body.channel);

  if (!uid || !organizationId || !channelIdentityRef || channel !== 'whatsapp') {
    return res.status(400).json({
      success: false,
      code: 'INVALID_REQUEST',
      retryable: false,
    });
  }

  const db = deps.getDb();
  if (!db) {
    return res.status(503).json({
      success: false,
      code: 'SERVICE_UNAVAILABLE',
      retryable: true,
    });
  }

  try {
    const access = await deps.resolveAccess({
      uid,
      organizationId,
      appId: 'musicscale',
      db,
    });

    if (!access.accessible) {
      deps.logger?.warn?.('[CONNECT_CHANNEL_DELEGATION] actor access denied', {
        organizationId,
        maskedUid: mask(uid),
        denialReason: access.denialReason || 'ACCESS_DENIED',
        service: serviceIdentity.email,
      });
      return res.status(403).json({
        success: false,
        code: 'CHANNEL_DELEGATION_ACCESS_DENIED',
        reason: access.denialReason || 'ACCESS_DENIED',
        retryable: false,
      });
    }

    const customToken = await deps.createCustomToken(uid, {
      appId: 'connect',
      delegatedChannel: 'whatsapp',
      delegationVersion: 1,
    });
    const now = deps.now();

    deps.logger?.info?.('[CONNECT_CHANNEL_DELEGATION] issued', {
      organizationId,
      maskedUid: mask(uid),
      channelIdentityRef,
      service: serviceIdentity.email,
      accessSource: access.accessSource,
    });

    return res.status(200).json({
      success: true,
      protocolVersion: '1.0.0',
      uid,
      organizationId,
      customToken,
      exchangeByMs: now + 5 * 60_000,
    });
  } catch (error) {
    deps.logger?.error?.('[CONNECT_CHANNEL_DELEGATION] failed', {
      organizationId,
      maskedUid: mask(uid),
      service: serviceIdentity.email,
      error: error instanceof Error ? error.message : 'unknown_error',
    });
    return res.status(503).json({
      success: false,
      code: 'CHANNEL_DELEGATION_UNAVAILABLE',
      retryable: true,
    });
  }
}
