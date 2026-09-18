import {
  CANONICAL_FACT_SCHEMA_VERSION,
  isCanonicalFactValid,
  type CanonicalFact
} from '../packages/events/factContract.js';

export type MusicScaleChangeCode =
  | 'song_added'
  | 'song_removed'
  | 'song_reordered'
  | 'song_key_changed'
  | 'song_bpm_changed'
  | 'date_changed'
  | 'time_changed'
  | 'location_changed'
  | 'event_changed'
  | 'notes_changed'
  | 'duration_changed'
  | 'function_changed'
  | 'scale_changed';

const ALLOWED_CHANGE_CODES = new Set<MusicScaleChangeCode>([
  'song_added',
  'song_removed',
  'song_reordered',
  'song_key_changed',
  'song_bpm_changed',
  'date_changed',
  'time_changed',
  'location_changed',
  'event_changed',
  'notes_changed',
  'duration_changed',
  'function_changed',
  'scale_changed'
]);

export interface MusicScaleChangeNotificationFactInput {
  id: string;
  type: string;
  createdAtMs: number | null;
  isRead: boolean;
  metadata?: unknown;
}

export interface MusicScaleChangeFactMetadata extends Record<string, unknown> {
  sourceNotificationId: string;
  publishRevision: number;
  isRead: boolean;
  codes: MusicScaleChangeCode[];
}

export type MusicScaleChangeCanonicalFact = CanonicalFact<
  'musicscale.scale.change_notified',
  MusicScaleChangeFactMetadata
>;

type MetadataRecord = Record<string, unknown>;

function asRecord(value: unknown): MetadataRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as MetadataRecord
    : {};
}

function finiteNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : fallback;
}

export function normalizeMusicScaleChangeCodes(
  metadata: MetadataRecord
): MusicScaleChangeCode[] {
  const summary = asRecord(metadata.preparationChangeSummary);
  const rawCodes = Array.isArray(summary.codes) ? summary.codes : [];
  const normalized: MusicScaleChangeCode[] = [];

  rawCodes.forEach(value => {
    if (
      typeof value === 'string' &&
      ALLOWED_CHANGE_CODES.has(value as MusicScaleChangeCode) &&
      !normalized.includes(value as MusicScaleChangeCode)
    ) {
      normalized.push(value as MusicScaleChangeCode);
    }
  });

  if (
    metadata.functionsChanged === true &&
    !normalized.includes('function_changed')
  ) {
    normalized.push('function_changed');
  }

  if (normalized.length === 0) {
    normalized.push('scale_changed');
  }

  return normalized;
}

function cleanId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const clean = value.trim();
  return clean ? clean : null;
}

/**
 * Projects recipient-scoped MusicScale change notifications already loaded by
 * the Hub into canonical, tenant-bound facts. No datastore read occurs here.
 */
export function projectMusicScaleChangeFacts(input: {
  organizationId: string;
  notifications: readonly MusicScaleChangeNotificationFactInput[];
}): MusicScaleChangeCanonicalFact[] {
  const organizationId = cleanId(input.organizationId);
  if (!organizationId) return [];

  const facts: MusicScaleChangeCanonicalFact[] = [];

  for (const notification of input.notifications) {
    const notificationId = cleanId(notification?.id);
    if (
      !notificationId ||
      notification.type !== 'music_scale_changed' ||
      typeof notification.createdAtMs !== 'number' ||
      !Number.isFinite(notification.createdAtMs) ||
      notification.createdAtMs < 0
    ) {
      continue;
    }

    const metadata = asRecord(notification.metadata);
    const scaleId = cleanId(metadata.musicScaleId);
    if (!scaleId) continue;

    const publishRevision = Math.max(
      0,
      Math.floor(finiteNumber(metadata.publishRevision, 0))
    );
    const codes = normalizeMusicScaleChangeCodes(metadata);
    const idempotencyKey =
      `musicscale:${organizationId}:notification:${notificationId}:scale-change:rev-${publishRevision}`;

    const fact: MusicScaleChangeCanonicalFact = {
      schemaVersion: CANONICAL_FACT_SCHEMA_VERSION,
      factId: idempotencyKey,
      organizationId,
      eventType: 'musicscale.scale.change_notified',
      actor: { type: 'system' },
      occurredAtMs: notification.createdAtMs,
      recordedAtMs: notification.createdAtMs,
      source: {
        organizationId,
        sourceApp: 'musicscale',
        sourceKind: 'firestore_document',
        sourceRef:
          `organizations/${organizationId}/notifications/${notificationId}`,
        entityType: 'scale',
        entityId: scaleId,
        fieldPaths: [
          'type',
          'createdAt',
          'isRead',
          'metadata.musicScaleId',
          'metadata.publishRevision',
          'metadata.preparationChangeSummary',
          'metadata.functionsChanged'
        ],
        observedAtMs: notification.createdAtMs
      },
      entity: {
        type: 'scale',
        id: scaleId
      },
      metadata: {
        sourceNotificationId: notificationId,
        publishRevision,
        isRead: notification.isRead === true,
        codes
      },
      idempotencyKey
    };

    if (isCanonicalFactValid(fact)) {
      facts.push(fact);
    }
  }

  return facts;
}
