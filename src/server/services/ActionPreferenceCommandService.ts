import type { Request, Response } from 'express';
import { createHash } from 'node:crypto';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, Firestore, getFirestore } from 'firebase-admin/firestore';
import { isCanonicalGlobalRole } from '../../lib/permissionService.js';

type Dependencies = {
  verifyIdToken?: (token: string) => Promise<{ uid: string }>;
  getFirestore?: () => Firestore;
  now?: () => number;
};

const MAX_SNOOZE_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_PREFERENCES = 100;
const ALLOWED_MEMBER_ROLES = new Set([
  'owner',
  'admin',
  'manager',
  'member',
  'viewer',
  'leader',
  'secretary',
  'guest'
]);
const INACTIVE_MEMBER_STATUSES = new Set([
  'suspended',
  'inactive',
  'removed',
  'revoked',
  'deleted'
]);

function isSafeDocumentId(value: unknown): value is string {
  return typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 256 &&
    value !== '.' &&
    value !== '..' &&
    !value.includes('/') &&
    !/[\u0000-\u001F\u007F]/.test(value);
}

function isSafeSignalText(value: unknown, max = 512): value is string {
  return typeof value === 'string' &&
    value.length > 0 &&
    value.length <= max &&
    !/[\u0000-\u001F\u007F]/.test(value);
}

function metadataOwnerMatches(
  organization: FirebaseFirestore.DocumentData,
  uid: string
): boolean {
  return organization.ownerUid === uid ||
    organization.ownerId === uid ||
    organization.owner_user_id === uid ||
    organization.ownerUserId === uid;
}

function isActiveMembership(data: FirebaseFirestore.DocumentData | undefined): boolean {
  if (!data) return false;
  const status = typeof data.status === 'string' ? data.status.trim().toLowerCase() : '';
  if (INACTIVE_MEMBER_STATUSES.has(status)) return false;
  if (status && status !== 'active') return false;

  const rawRole = data.organizationRole ?? data.role;
  const role = typeof rawRole === 'string' ? rawRole.trim().toLowerCase() : '';
  return ALLOWED_MEMBER_ROLES.has(role);
}

async function authenticate(req: Request, dependencies: Dependencies): Promise<string | null> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ') || header.length <= 7) return null;

  try {
    const verify = dependencies.verifyIdToken ?? ((token: string) => getAuth().verifyIdToken(token));
    const uid = (await verify(header.slice(7))).uid;
    return isSafeDocumentId(uid) ? uid : null;
  } catch {
    return null;
  }
}

async function authorizeOrganization(
  db: Firestore,
  organizationId: string,
  actorUid: string
): Promise<
  | { allowed: true }
  | { allowed: false; status: number; reasonCode: string }
> {
  const [orgSnap, userSnap, memberSnap] = await Promise.all([
    db.doc(`organizations/${organizationId}`).get(),
    db.doc(`users/${actorUid}`).get(),
    db.doc(`organizations/${organizationId}/members/${actorUid}`).get()
  ]);

  if (!orgSnap.exists) {
    return { allowed: false, status: 404, reasonCode: 'ORGANIZATION_NOT_FOUND' };
  }

  const orgData = orgSnap.data() ?? {};
  if (orgData.status && orgData.status !== 'active') {
    return { allowed: false, status: 409, reasonCode: 'ORGANIZATION_INACTIVE' };
  }

  const actorGlobal = isCanonicalGlobalRole(userSnap.data()?.systemRole);
  const actorOwner = metadataOwnerMatches(orgData, actorUid);
  const actorMember = isActiveMembership(memberSnap.data());

  if (!actorGlobal && !actorOwner && !actorMember) {
    return { allowed: false, status: 403, reasonCode: 'PERMISSION_DENIED' };
  }

  return { allowed: true };
}

function preferenceId(dedupeKey: string): string {
  return createHash('sha256').update(dedupeKey).digest('hex').slice(0, 48);
}

export async function getActionPreferences(
  req: Request,
  res: Response,
  dependencies: Dependencies = {}
) {
  const actorUid = await authenticate(req, dependencies);
  if (!actorUid) {
    return res.status(401).json({ success: false, reasonCode: 'UNAUTHENTICATED' });
  }

  const organizationId = req.params.organizationId;
  if (!isSafeDocumentId(organizationId)) {
    return res.status(400).json({ success: false, reasonCode: 'INVALID_REQUEST_PATH' });
  }

  try {
    const db = (dependencies.getFirestore ?? getFirestore)();
    const authorization = await authorizeOrganization(db, organizationId, actorUid);
    if (authorization.allowed === false) {
      return res.status(authorization.status).json({
        success: false,
        reasonCode: authorization.reasonCode
      });
    }

    const snapshot = await db
      .collection(`organizations/${organizationId}/actionCenterUsers/${actorUid}/preferences`)
      .orderBy('updatedAt', 'desc')
      .limit(MAX_PREFERENCES)
      .get();

    const preferences = snapshot.docs.map(document => {
      const data = document.data() ?? {};
      const updatedAtMs = typeof data.updatedAt?.toMillis === 'function'
        ? data.updatedAt.toMillis()
        : null;
      const snoozedUntilMs = typeof data.snoozedUntil?.toMillis === 'function'
        ? data.snoozedUntil.toMillis()
        : null;

      return {
        id: document.id,
        dedupeKey: data.dedupeKey,
        fingerprint: data.fingerprint,
        mode: data.mode,
        snoozedUntilMs,
        updatedAtMs
      };
    }).filter(preference =>
      isSafeSignalText(preference.dedupeKey) &&
      isSafeSignalText(preference.fingerprint) &&
      (preference.mode === 'snoozed' || preference.mode === 'dismissed')
    );

    res.setHeader('Cache-Control', 'private, no-store');
    return res.status(200).json({
      success: true,
      organizationId,
      preferences
    });
  } catch (error) {
    console.error('[ActionCenter] Preference read failed', error);
    return res.status(500).json({ success: false, reasonCode: 'INTERNAL_ERROR' });
  }
}

export async function updateActionPreference(
  req: Request,
  res: Response,
  dependencies: Dependencies = {}
) {
  const actorUid = await authenticate(req, dependencies);
  if (!actorUid) {
    return res.status(401).json({ success: false, reasonCode: 'UNAUTHENTICATED' });
  }

  const organizationId = req.params.organizationId;
  if (!isSafeDocumentId(organizationId)) {
    return res.status(400).json({ success: false, reasonCode: 'INVALID_REQUEST_PATH' });
  }

  const dedupeKey = req.body?.dedupeKey;
  const fingerprint = req.body?.fingerprint;
  const mode = req.body?.mode;
  const snoozedUntilMs = req.body?.snoozedUntilMs;

  if (
    !isSafeSignalText(dedupeKey) ||
    !isSafeSignalText(fingerprint) ||
    !['snoozed', 'dismissed', 'clear'].includes(mode)
  ) {
    return res.status(400).json({ success: false, reasonCode: 'INVALID_ACTION_PREFERENCE' });
  }

  const nowMs = (dependencies.now ?? Date.now)();
  if (mode === 'snoozed') {
    if (
      typeof snoozedUntilMs !== 'number' ||
      !Number.isFinite(snoozedUntilMs) ||
      snoozedUntilMs <= nowMs ||
      snoozedUntilMs > nowMs + MAX_SNOOZE_MS
    ) {
      return res.status(400).json({ success: false, reasonCode: 'INVALID_SNOOZE_WINDOW' });
    }
  }

  try {
    const db = (dependencies.getFirestore ?? getFirestore)();
    const authorization = await authorizeOrganization(db, organizationId, actorUid);
    if (authorization.allowed === false) {
      return res.status(authorization.status).json({
        success: false,
        reasonCode: authorization.reasonCode
      });
    }

    const ref = db.doc(
      `organizations/${organizationId}/actionCenterUsers/${actorUid}/preferences/${preferenceId(dedupeKey)}`
    );

    if (mode === 'clear') {
      await ref.delete();
      res.setHeader('Cache-Control', 'private, no-store');
      return res.status(200).json({
        success: true,
        organizationId,
        dedupeKey,
        cleared: true
      });
    }

    const preference = {
      actorUid,
      organizationId,
      dedupeKey,
      fingerprint,
      mode,
      snoozedUntil: mode === 'snoozed'
        ? new Date(snoozedUntilMs)
        : null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    };

    // Keep createdAt stable after the first write.
    const existing = await ref.get();
    if (existing.exists) {
      delete (preference as { createdAt?: unknown }).createdAt;
    }

    await ref.set(preference, { merge: true });

    res.setHeader('Cache-Control', 'private, no-store');
    return res.status(200).json({
      success: true,
      organizationId,
      preference: {
        dedupeKey,
        fingerprint,
        mode,
        snoozedUntilMs: mode === 'snoozed' ? snoozedUntilMs : null,
        updatedAtMs: nowMs
      }
    });
  } catch (error) {
    console.error('[ActionCenter] Preference update failed', error);
    return res.status(500).json({ success: false, reasonCode: 'INTERNAL_ERROR' });
  }
}
