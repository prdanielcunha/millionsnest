import type { Request, Response } from 'express';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore, type Firestore } from 'firebase-admin/firestore';

export const DEFAULT_ECOSYSTEM_SESSION_VERSION = 1;

export function normalizeEcosystemSessionVersion(value: unknown): number {
  return typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= DEFAULT_ECOSYSTEM_SESSION_VERSION
    ? value
    : DEFAULT_ECOSYSTEM_SESSION_VERSION;
}

export function nextEcosystemSessionVersion(value: unknown): number {
  const current = normalizeEcosystemSessionVersion(value);
  if (current >= Number.MAX_SAFE_INTEGER) {
    throw new Error('ECOSYSTEM_SESSION_VERSION_EXHAUSTED');
  }
  return current + 1;
}

export async function readCanonicalEcosystemSessionVersion(
  db: Pick<Firestore, 'collection'>,
  uid: string,
): Promise<number> {
  const userSnap = await db.collection('users').doc(uid).get();
  if (!userSnap.exists) {
    throw new Error('ECOSYSTEM_SESSION_USER_NOT_FOUND');
  }
  return normalizeEcosystemSessionVersion(userSnap.data()?.ecosystemSessionVersion);
}

type RevocationDependencies = {
  verifyIdToken?: (token: string) => Promise<{ uid?: string | null }>;
  getFirestore?: () => Firestore;
};

export async function revokeCurrentEcosystemSession(
  req: Request,
  res: Response,
  dependencies: RevocationDependencies = {},
) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, reasonCode: 'METHOD_NOT_ALLOWED' });
  }

  const authorization = req.headers.authorization;
  if (!authorization || !authorization.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, reasonCode: 'UNAUTHENTICATED' });
  }

  let uid = '';
  try {
    const verifyIdToken = dependencies.verifyIdToken ?? ((token: string) => getAuth().verifyIdToken(token));
    const decoded = await verifyIdToken(authorization.slice('Bearer '.length));
    uid = typeof decoded?.uid === 'string' ? decoded.uid.trim() : '';
  } catch {
    return res.status(401).json({ success: false, reasonCode: 'UNAUTHENTICATED' });
  }

  if (!uid) {
    return res.status(401).json({ success: false, reasonCode: 'UNAUTHENTICATED' });
  }

  try {
    const db = (dependencies.getFirestore ?? getFirestore)();
    const result = await db.runTransaction(async transaction => {
      const userRef = db.collection('users').doc(uid);
      const userSnap = await transaction.get(userRef);

      if (!userSnap.exists) {
        return { success: false as const, reasonCode: 'USER_NOT_FOUND' };
      }

      const previousSessionVersion = normalizeEcosystemSessionVersion(
        userSnap.data()?.ecosystemSessionVersion,
      );
      const sessionVersion = nextEcosystemSessionVersion(previousSessionVersion);
      const eventRef = db.collection('ecosystemSessionEvents').doc();

      transaction.set(userRef, {
        ecosystemSessionVersion: sessionVersion,
        ecosystemSessionVersionUpdatedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      transaction.set(eventRef, {
        eventType: 'ecosystem.session.revoked',
        actorUid: uid,
        targetUid: uid,
        previousSessionVersion,
        sessionVersion,
        reason: 'logout',
        timestamp: FieldValue.serverTimestamp(),
      });

      return {
        success: true as const,
        previousSessionVersion,
        sessionVersion,
      };
    });

    if (!result.success) {
      return res.status(404).json(result);
    }

    return res.status(200).json({
      success: true,
      sessionVersion: result.sessionVersion,
    });
  } catch (error: any) {
    console.error('[ECOSYSTEM_SESSION_REVOKE]', {
      uid: uid.length > 8 ? `${uid.slice(0, 4)}...${uid.slice(-4)}` : '...',
      code: error?.code || error?.message || 'UNKNOWN',
    });
    return res.status(500).json({ success: false, reasonCode: 'INTERNAL_ERROR' });
  }
}
