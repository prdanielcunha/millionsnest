import { createHash, randomUUID } from 'node:crypto';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';

const DEFAULT_RATE_LIMIT = 12;
const DEFAULT_WINDOW_MS = 60_000;

function hashKey(parts: string[]): string {
  return createHash('sha256').update(parts.join('|')).digest('hex');
}

export function resolveAllowedHandoffOrigins(env: NodeJS.ProcessEnv = process.env): Set<string> {
  const configured = String(env.ECOSYSTEM_HANDOFF_ALLOWED_ORIGINS || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);

  if (configured.length > 0) return new Set(configured);

  const defaults = [
    'https://www.millionsnest.com',
    'https://millionsnest.com',
  ];

  if (env.NODE_ENV !== 'production') {
    defaults.push('http://localhost:3000', 'http://localhost:5173');
  }

  return new Set(defaults);
}

export function validateHandoffOrigin(
  origin: unknown,
  env: NodeJS.ProcessEnv = process.env,
): { allowed: true; origin: string | null } | { allowed: false; origin: string } {
  if (origin === undefined || origin === null || origin === '') {
    return { allowed: true, origin: null };
  }
  if (typeof origin !== 'string') return { allowed: false, origin: '' };

  const clean = origin.trim();
  return resolveAllowedHandoffOrigins(env).has(clean)
    ? { allowed: true, origin: clean }
    : { allowed: false, origin: clean };
}

export async function enforceHandoffRateLimit(params: {
  db: Firestore;
  scope: string;
  uid: string;
  appId: string;
  organizationId: string;
  nowMs: number;
  limit?: number;
  windowMs?: number;
}): Promise<{ allowed: true; remaining: number } | { allowed: false; retryAfterSeconds: number }> {
  const {
    db,
    scope,
    uid,
    appId,
    organizationId,
    nowMs,
    limit = DEFAULT_RATE_LIMIT,
    windowMs = DEFAULT_WINDOW_MS,
  } = params;

  const bucket = Math.floor(nowMs / windowMs);
  const docId = hashKey([scope, uid, appId, organizationId, String(bucket)]);
  const ref = db.collection('ecosystemHandoffRateLimits').doc(docId);

  return db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const current = snap.exists ? Number(snap.data()?.count || 0) : 0;

    if (current >= limit) {
      const windowEnd = (bucket + 1) * windowMs;
      return {
        allowed: false as const,
        retryAfterSeconds: Math.max(1, Math.ceil((windowEnd - nowMs) / 1000)),
      };
    }

    tx.set(ref, {
      scope,
      appId,
      organizationId,
      uidHash: hashKey([uid]),
      windowBucket: bucket,
      count: current + 1,
      updatedAt: FieldValue.serverTimestamp(),
      expiresAt: new Date((bucket + 2) * windowMs),
    }, { merge: true });

    return {
      allowed: true as const,
      remaining: Math.max(0, limit - current - 1),
    };
  });
}

export async function writeHandoffAuditEvent(params: {
  db: Firestore;
  eventType:
    | 'handoff.issued'
    | 'handoff.denied'
    | 'handoff.rate_limited'
    | 'handoff.origin_rejected';
  appId: string;
  organizationId?: string | null;
  uid?: string | null;
  accessSource?: string | null;
  protocol: 'ecosystem_ctx' | 'one_time_code';
  reason?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const {
    db,
    eventType,
    appId,
    organizationId = null,
    uid = null,
    accessSource = null,
    protocol,
    reason = null,
    metadata = {},
  } = params;

  const eventId = randomUUID();
  await db.collection('ecosystemHandoffAudit').doc(eventId).set({
    eventId,
    eventType,
    appId,
    organizationId,
    uidHash: uid ? hashKey([uid]) : null,
    accessSource,
    protocol,
    reason,
    metadata,
    timestamp: FieldValue.serverTimestamp(),
  });
}
