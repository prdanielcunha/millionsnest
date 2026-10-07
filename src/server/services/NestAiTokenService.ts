import * as crypto from 'node:crypto';
import * as admin from 'firebase-admin';
import type { Request, Response } from 'express';
import { isGlobalPrivilegedRole } from '../../lib/permissionService.js';
import { resolveEcosystemAppAccess, type EcosystemAppId } from './EcosystemAccessResolver.js';

const ISSUER = 'https://millionsnest.com';
const AUDIENCE = 'nestai';
const TOKEN_TTL_SECONDS = 300;
const RESOLVER_APPS = new Set<EcosystemAppId>(['musicscale', 'nestfinance', 'nestlocal', 'nestjourney']);
const PUBLIC_GUEST_APPS = new Set(['nestlume']);

const KNOWN_APPS = new Set([
  'musicscale',
  'nestfinance',
  'nestlocal',
  'nestjourney',
  'connect',
  'nestaffiliate',
  'nestlume',
  'nestai',
]);

type PrivateJwk = JsonWebKey & { d?: string };
type PublicSigningJwk = JsonWebKey & { kid: string; alg: 'ES256'; use: 'sig' };

function parsePrivateJwk(env: NodeJS.ProcessEnv = process.env): PrivateJwk {
  const raw = String(env.NESTAI_SIGNING_PRIVATE_JWK || '').trim();
  if (!raw) throw new Error('NESTAI_SIGNING_KEY_MISSING');
  const jwk = JSON.parse(raw) as PrivateJwk;
  if (jwk.kty !== 'EC' || jwk.crv !== 'P-256' || !jwk.d || !jwk.x || !jwk.y) {
    throw new Error('NESTAI_SIGNING_KEY_INVALID');
  }
  return jwk;
}

function publicJwkFromPrivate(privateJwk: PrivateJwk): PublicSigningJwk {
  const canonical = JSON.stringify({
    crv: privateJwk.crv,
    kty: privateJwk.kty,
    x: privateJwk.x,
    y: privateJwk.y,
  });
  const kid = crypto.createHash('sha256').update(canonical).digest('hex').slice(0, 24);
  return {
    kty: 'EC',
    crv: 'P-256',
    x: privateJwk.x,
    y: privateJwk.y,
    kid,
    alg: 'ES256',
    use: 'sig',
  };
}

function encodeJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

export function getNestAiJwks(env: NodeJS.ProcessEnv = process.env): { keys: PublicSigningJwk[] } {
  return { keys: [publicJwkFromPrivate(parsePrivateJwk(env))] };
}

export function issueNestAiToken(params: {
  uid: string;
  organizationId: string;
  appId: string;
  appCheckAppId: string;
  capabilities?: string[];
  tokenType?: 'user' | 'guest' | 'service';
  locale?: "pt-BR" | "en" | "es";
  nowSeconds?: number;
  env?: NodeJS.ProcessEnv;
}): { token: string; expiresIn: number } {
  const env = params.env ?? process.env;
  const privateJwk = parsePrivateJwk(env);
  const publicJwk = publicJwkFromPrivate(privateJwk);
  const now = params.nowSeconds ?? Math.floor(Date.now() / 1000);
  const header = encodeJson({ alg: 'ES256', typ: 'JWT', kid: publicJwk.kid });
  const payload = encodeJson({
    iss: ISSUER,
    aud: AUDIENCE,
    sub: params.uid,
    organizationId: params.organizationId,
    appId: params.appId,
    capabilities: params.capabilities ?? ['ai:run', 'ai:stream'],
    scopes: params.capabilities ?? ['ai:run', 'ai:stream'],
    tokenType: params.tokenType ?? 'user',
    appCheckAppId: params.appCheckAppId,
    ...(params.locale ? { locale: params.locale } : {}),
    iat: now,
    nbf: now - 5,
    exp: now + TOKEN_TTL_SECONDS,
    jti: crypto.randomUUID(),
  });
  const input = `${header}.${payload}`;
  const key = crypto.createPrivateKey({ key: privateJwk as crypto.JsonWebKey, format: 'jwk' });
  const signature = crypto.sign('sha256', Buffer.from(input), {
    key,
    dsaEncoding: 'ieee-p1363',
  }).toString('base64url');
  return { token: `${input}.${signature}`, expiresIn: TOKEN_TTL_SECONDS };
}

async function genericAppAccess(params: {
  db: admin.firestore.Firestore;
  uid: string;
  organizationId: string;
  appId: string;
}): Promise<boolean> {
  const { db, uid, organizationId, appId } = params;
  const [userDoc, orgDoc, memberDoc] = await Promise.all([
    db.collection('users').doc(uid).get(),
    db.collection('organizations').doc(organizationId).get(),
    db.collection('organizations').doc(organizationId).collection('members').doc(uid).get(),
  ]);
  if (!userDoc.exists || !orgDoc.exists) return false;
  const user = userDoc.data() || {};
  if (isGlobalPrivilegedRole(user.systemRole || user.globalRole)) return true;

  const org = orgDoc.data() || {};
  if (['inactive', 'archived', 'suspended', 'disabled'].includes(String(org.status || '').toLowerCase()) || org.disabled === true) {
    return false;
  }

  const owner = [org.ownerUid, org.ownerId, org.ownerUserId, org.owner_user_id].some((value) => value === uid);
  const member = memberDoc.exists ? memberDoc.data() || {} : {};
  const memberActive = memberDoc.exists
    && member.enabled !== false
    && !['inactive', 'suspended', 'disabled', 'removed', 'revoked', 'archived'].includes(String(member.status || 'active').toLowerCase());
  if (!owner && !memberActive) return false;

  const app = org.apps?.[appId];
  const enabledApps = Array.isArray(org.enabledApps) ? org.enabledApps : [];
  return app === true
    || app?.enabled === true
    || ['active', 'trialing'].includes(String(app?.status || '').toLowerCase())
    || enabledApps.includes(appId);
}

export async function authorizeNestAiApp(params: {
  db: admin.firestore.Firestore;
  uid: string;
  organizationId: string;
  appId: string;
}): Promise<boolean> {
  if (!KNOWN_APPS.has(params.appId)) return false;
  if (params.appId === 'nestai') {
    const userDoc = await params.db.collection('users').doc(params.uid).get();
    if (!userDoc.exists) return false;
    const user = userDoc.data() || {};
    return isGlobalPrivilegedRole(user.systemRole || user.globalRole);
  }
  if (RESOLVER_APPS.has(params.appId as EcosystemAppId)) {
    const access = await resolveEcosystemAppAccess({
      uid: params.uid,
      organizationId: params.organizationId,
      appId: params.appId as EcosystemAppId,
      db: params.db,
    });
    return access.accessible;
  }
  return genericAppAccess(params);
}

export async function handleNestAiTokenRequest(req: Request, res: Response, db: admin.firestore.Firestore): Promise<Response> {
  const authHeader = String(req.headers.authorization || '');
  if (!authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'UNAUTHENTICATED' });

  let decoded: admin.auth.DecodedIdToken;
  try {
    decoded = await admin.auth().verifyIdToken(authHeader.slice('Bearer '.length));
  } catch {
    return res.status(401).json({ error: 'INVALID_TOKEN' });
  }

  const organizationId = String(req.body?.organizationId || '').trim();
  const appId = String(req.body?.appId || '').trim().toLowerCase();
  const localeValue = String(req.body?.locale || 'pt-BR');
  const locale = ['pt-BR', 'en', 'es'].includes(localeValue) ? localeValue as 'pt-BR' | 'en' | 'es' : 'pt-BR';

  const appCheckHeader = String(req.headers['x-firebase-appcheck'] || '');
  if (!appCheckHeader) return res.status(401).json({ error: 'APP_CHECK_REQUIRED' });

  let appCheckAppId = '';
  try {
    const appCheckClaims = await admin.appCheck().verifyToken(appCheckHeader) as unknown as Record<string, unknown>;
    appCheckAppId = String(appCheckClaims.app_id || appCheckClaims.sub || '').trim();
    if (!appCheckAppId) return res.status(401).json({ error: 'APP_CHECK_APP_ID_MISSING' });
  } catch {
    return res.status(401).json({ error: 'APP_CHECK_INVALID' });
  }
  if (!organizationId || organizationId.length > 256 || organizationId.includes('/') || !KNOWN_APPS.has(appId)) {
    return res.status(400).json({ error: 'INVALID_REQUEST' });
  }

  if (!await authorizeNestAiApp({ db, uid: decoded.uid, organizationId, appId })) {
    return res.status(403).json({ error: 'NESTAI_ACCESS_DENIED' });
  }

  try {
    let capabilities = ['ai:run', 'ai:stream'];
    if (appId === 'nestai') {
      const userDoc = await db.collection('users').doc(decoded.uid).get();
      const user = userDoc.exists ? userDoc.data() || {} : {};
      if (!isGlobalPrivilegedRole(user.systemRole || user.globalRole)) {
        return res.status(403).json({ error: 'NESTAI_ADMIN_ACCESS_DENIED' });
      }
      capabilities = ['ai:run', 'ai:stream', 'ai:admin'];
    }
    const issued = issueNestAiToken({ uid: decoded.uid, organizationId, appId, appCheckAppId, capabilities, locale });
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ token: issued.token, tokenType: 'Bearer', expiresIn: issued.expiresIn });
  } catch (error) {
    console.error('[NestAI] token issue failed', error instanceof Error ? error.message : 'unknown');
    return res.status(503).json({ error: 'NESTAI_SIGNING_UNAVAILABLE' });
  }
}

function normalizeLocale(value: unknown): 'pt-BR' | 'en' | 'es' {
  const raw = String(value || 'pt-BR');
  return ['pt-BR', 'en', 'es'].includes(raw) ? raw as 'pt-BR' | 'en' | 'es' : 'pt-BR';
}

async function verifiedAppCheckAppId(req: Request): Promise<string> {
  const appCheckHeader = String(req.headers['x-firebase-appcheck'] || '');
  if (!appCheckHeader) throw new Error('APP_CHECK_REQUIRED');
  const claims = await admin.appCheck().verifyToken(appCheckHeader) as unknown as Record<string, unknown>;
  const appId = String(claims.app_id || claims.sub || '').trim();
  if (!appId) throw new Error('APP_CHECK_APP_ID_MISSING');
  return appId;
}

export async function handleNestAiGuestTokenRequest(req: Request, res: Response): Promise<Response> {
  const appId = String(req.body?.appId || '').trim().toLowerCase();
  const locale = normalizeLocale(req.body?.locale);
  const sessionId = String(req.body?.sessionId || '').trim();

  if (!PUBLIC_GUEST_APPS.has(appId)) return res.status(403).json({ error: 'NESTAI_GUEST_APP_DENIED' });
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(sessionId)) return res.status(400).json({ error: 'NESTAI_GUEST_SESSION_INVALID' });

  let appCheckAppId = '';
  try {
    appCheckAppId = await verifiedAppCheckAppId(req);
  } catch (error) {
    const code = error instanceof Error ? error.message : 'APP_CHECK_INVALID';
    return res.status(401).json({ error: code === 'APP_CHECK_REQUIRED' ? code : 'APP_CHECK_INVALID' });
  }

  const pseudonym = crypto.createHash('sha256')
    .update(appId + ':' + appCheckAppId + ':' + sessionId)
    .digest('hex')
    .slice(0, 32);

  try {
    const issued = issueNestAiToken({
      uid: 'guest:' + pseudonym,
      organizationId: 'public:' + appId,
      appId,
      appCheckAppId,
      capabilities: ['ai:run', 'ai:stream'],
      tokenType: 'guest',
      locale,
    });
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ token: issued.token, tokenType: 'Bearer', expiresIn: issued.expiresIn, organizationId: 'public:' + appId });
  } catch (error) {
    console.error('[NestAI] guest token issue failed', error instanceof Error ? error.message : 'unknown');
    return res.status(503).json({ error: 'NESTAI_SIGNING_UNAVAILABLE' });
  }
}

export function handleNestAiJwksRequest(_req: Request, res: Response): Response {
  try {
    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');
    return res.status(200).json(getNestAiJwks());
  } catch {
    return res.status(503).json({ error: 'NESTAI_JWKS_UNAVAILABLE' });
  }
}
