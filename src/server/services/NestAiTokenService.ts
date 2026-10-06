import * as crypto from 'node:crypto';
import * as admin from 'firebase-admin';
import type { Request, Response } from 'express';
import { isGlobalPrivilegedRole } from '../../lib/permissionService.js';
import { resolveEcosystemAppAccess, type EcosystemAppId } from './EcosystemAccessResolver.js';

const ISSUER = 'https://millionsnest.com';
const AUDIENCE = 'nestai';
const TOKEN_TTL_SECONDS = 300;
const RESOLVER_APPS = new Set<EcosystemAppId>(['musicscale', 'nestfinance', 'nestlocal', 'nestjourney']);
const KNOWN_APPS = new Set([
  'musicscale',
  'nestfinance',
  'nestlocal',
  'nestjourney',
  'connect',
  'nestaffiliate',
  'nestlume',
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
    capabilities: ['ai:run'],
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
  if (!organizationId || organizationId.length > 256 || organizationId.includes('/') || !KNOWN_APPS.has(appId)) {
    return res.status(400).json({ error: 'INVALID_REQUEST' });
  }

  if (!await authorizeNestAiApp({ db, uid: decoded.uid, organizationId, appId })) {
    return res.status(403).json({ error: 'NESTAI_ACCESS_DENIED' });
  }

  try {
    const issued = issueNestAiToken({ uid: decoded.uid, organizationId, appId });
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ token: issued.token, tokenType: 'Bearer', expiresIn: issued.expiresIn });
  } catch (error) {
    console.error('[NestAI] token issue failed', error instanceof Error ? error.message : 'unknown');
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
