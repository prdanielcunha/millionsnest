import admin from 'firebase-admin';
import express from 'express';
import { resolveEcosystemAppAccess, type ResolvedAppAccess } from './EcosystemAccessResolver.js';

export interface NestJourneyFollowupContextDependencies {
  verifyIdToken: (token: string) => Promise<admin.auth.DecodedIdToken>;
  getDb: () => admin.firestore.Firestore | null;
  resolveAccess?: typeof resolveEcosystemAppAccess;
  logger?: {
    info?: (message: string, meta?: Record<string, unknown>) => void;
    warn?: (message: string, meta?: Record<string, unknown>) => void;
    error?: (message: string, meta?: Record<string, unknown>) => void;
  };
}

const CARE_ROLES = new Set(['owner', 'admin', 'pastor', 'care']);
const BROAD_ROLES = new Set(['owner', 'admin', 'pastor']);
const SAFE_ID = /^[A-Za-z0-9._:-]{1,220}$/;

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function validId(value: unknown): string | null {
  const candidate = clean(value);
  return SAFE_ID.test(candidate) ? candidate : null;
}

function booleanPermission(value: unknown, key: string): boolean {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && (value as Record<string, unknown>)[key] === true);
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())).map((item) => item.trim())
    : [];
}

function toIso(value: unknown): string | null {
  if (value instanceof admin.firestore.Timestamp) return value.toDate().toISOString();
  if (typeof value === 'string' && !Number.isNaN(Date.parse(value))) return new Date(value).toISOString();
  return null;
}

function maskUid(uid: string): string {
  return uid.length > 6 ? `${uid.slice(0, 3)}***${uid.slice(-3)}` : '***';
}

function noStore(res: express.Response) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}

export async function handleNestJourneyFollowupContextRequest(
  req: express.Request,
  res: express.Response,
  deps: NestJourneyFollowupContextDependencies,
) {
  noStore(res);
  const authorization = typeof req.headers.authorization === 'string' ? req.headers.authorization.trim() : '';
  if (!/^Bearer\s+\S+$/i.test(authorization)) {
    return res.status(401).json({ success: false, code: 'AUTH_REQUIRED' });
  }

  const organizationId = validId(req.query.organizationId);
  const followupId = validId(req.query.followupId);
  if (!organizationId || !followupId) {
    return res.status(400).json({ success: false, code: 'INVALID_REQUEST' });
  }

  let decoded: admin.auth.DecodedIdToken;
  try {
    decoded = await deps.verifyIdToken(authorization.replace(/^Bearer\s+/i, ''));
  } catch {
    return res.status(401).json({ success: false, code: 'AUTH_REQUIRED' });
  }
  const uid = clean(decoded.uid);
  if (!uid) return res.status(401).json({ success: false, code: 'AUTH_REQUIRED' });

  const db = deps.getDb();
  if (!db) return res.status(503).json({ success: false, code: 'SERVICE_UNAVAILABLE' });

  const resolveAccess = deps.resolveAccess ?? resolveEcosystemAppAccess;
  let appAccess: ResolvedAppAccess;
  try {
    appAccess = await resolveAccess({ uid, organizationId, appId: 'nestjourney', db });
  } catch {
    return res.status(503).json({ success: false, code: 'ACCESS_UNAVAILABLE' });
  }
  if (!appAccess.accessible) {
    return res.status(403).json({ success: false, code: 'NESTJOURNEY_ACCESS_DENIED' });
  }

  const [orgDoc, memberDoc, followupDoc] = await Promise.all([
    db.doc(`organizations/${organizationId}`).get(),
    db.doc(`organizations/${organizationId}/members/${uid}`).get(),
    db.doc(`organizations/${organizationId}/products/raiz_e_mesa/followups/${followupId}`).get(),
  ]);

  if (!orgDoc.exists || !followupDoc.exists) {
    return res.status(404).json({ success: false, code: 'FOLLOWUP_NOT_FOUND' });
  }

  const organization = orgDoc.data() || {};
  const membership = memberDoc.exists ? (memberDoc.data() || {}) : {};
  const followup = followupDoc.data() || {};
  const role = clean(membership.organizationRole || membership.role || appAccess.organizationRole);
  const permissions = membership.permissions;
  const global = appAccess.isGlobalAccess === true;
  const canManageCare = global || CARE_ROLES.has(role) || booleanPermission(permissions, 'canManageCare');
  const broad = global || BROAD_ROLES.has(role);
  const congregationIds = stringList(membership.congregationIds);
  const congregationId = clean(followup.congregationId);

  if (!canManageCare) {
    return res.status(403).json({ success: false, code: 'CARE_CAPABILITY_REQUIRED' });
  }
  if (
    clean(followup.organizationId) !== organizationId ||
    clean(followup.kind) !== 'first_contact' ||
    clean(followup.status) !== 'pending' ||
    !congregationId
  ) {
    return res.status(409).json({ success: false, code: 'FOLLOWUP_NOT_ACTIONABLE' });
  }
  if (!broad && !congregationIds.includes(congregationId)) {
    return res.status(403).json({ success: false, code: 'FOLLOWUP_SCOPE_DENIED' });
  }
  // Oversight roles may read queues inside NestJourney, but communication
  // execution is deliberately owner-only. A broad Lens must not impersonate
  // the assigned caregiver in Connect.
  if (clean(followup.ownerRef) !== uid) {
    return res.status(403).json({ success: false, code: 'FOLLOWUP_OWNER_REQUIRED' });
  }

  const careRequestId = validId(followup.careRequestId);
  const personId = validId(followup.personId);
  if (!careRequestId || !personId) {
    return res.status(409).json({ success: false, code: 'FOLLOWUP_SOURCE_INVALID' });
  }

  const [careDoc, personDoc] = await Promise.all([
    db.doc(`organizations/${organizationId}/products/raiz_e_mesa/careRequests/${careRequestId}`).get(),
    db.doc(`organizations/${organizationId}/products/raiz_e_mesa/people/${personId}`).get(),
  ]);
  if (!careDoc.exists || !personDoc.exists) {
    return res.status(409).json({ success: false, code: 'FOLLOWUP_SOURCE_INVALID' });
  }

  const care = careDoc.data() || {};
  const person = personDoc.data() || {};
  const phone = clean(person.phone);
  const personName = clean(person.name);

  if (
    clean(care.organizationId) !== organizationId ||
    clean(care.congregationId) !== congregationId ||
    clean(care.personId) !== personId ||
    clean(care.careType) !== 'first_contact' ||
    clean(care.status) !== 'open' ||
    clean(care.ownerRef) !== clean(followup.ownerRef) ||
    clean(person.organizationId) !== organizationId ||
    clean(person.congregationId) !== congregationId ||
    person.consent !== true ||
    !phone ||
    !personName
  ) {
    return res.status(409).json({ success: false, code: 'FOLLOWUP_SOURCE_INVALID' });
  }

  deps.logger?.info?.('NESTJOURNEY_CONNECT_FOLLOWUP_CONTEXT', {
    maskedUid: maskUid(uid),
    organizationId,
    congregationId,
    result: 'success',
  });

  return res.status(200).json({
    success: true,
    organization: {
      id: organizationId,
      name: clean(organization.name) || 'Igreja',
    },
    followup: {
      id: followupId,
      careRequestId,
      congregationId,
      dueAt: toIso(followup.dueAt),
    },
    person: {
      name: personName,
      phone,
    },
    returnTo: `https://nestjourney.millionsnest.com/followup-runtime?followup=${encodeURIComponent(followupId)}`,
  });
}
