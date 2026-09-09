export const CHANGE_HORIZON_DAYS = 14;
export const CHANGE_LIMIT = 3;

export type HubChangeCode =
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

const ALLOWED_CHANGE_CODES = new Set<HubChangeCode>([
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
  'scale_changed',
]);

export interface MusicScaleChangeNotificationInput {
  id: string;
  type: string;
  createdAtMs: number | null;
  isRead: boolean;
  metadata?: unknown;
}

export interface ReadOnlyHubChange {
  id: string;
  sourceApp: 'musicscale';
  sourceEntityType: 'scale';
  sourceEntityId: string;
  sourceNotificationId: string;
  publishRevision: number;
  occurredAtMs: number;
  isRead: boolean;
  codes: HubChangeCode[];
  destination: {
    kind: 'app';
    appId: 'musicscale';
    path: string;
  };
}

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

function normalizeCodes(metadata: MetadataRecord): HubChangeCode[] {
  const summary = asRecord(metadata.preparationChangeSummary);
  const rawCodes = Array.isArray(summary.codes) ? summary.codes : [];
  const normalized: HubChangeCode[] = [];

  rawCodes.forEach(value => {
    if (
      typeof value === 'string' &&
      ALLOWED_CHANGE_CODES.has(value as HubChangeCode) &&
      !normalized.includes(value as HubChangeCode)
    ) {
      normalized.push(value as HubChangeCode);
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

/**
 * Changes are factual notifications produced by a source app, not inferred
 * from timestamps or revision counters in the Hub.
 *
 * The Hub only projects recipient-scoped MusicScale change notifications that
 * already contain a stable source entity and source-owned change metadata.
 */
export function deriveReadOnlyHubChanges(
  notifications: MusicScaleChangeNotificationInput[],
  nowMs: number = Date.now(),
  horizonDays: number = CHANGE_HORIZON_DAYS,
  limit: number = CHANGE_LIMIT
): ReadOnlyHubChange[] {
  const horizonStart = nowMs - Math.max(1, horizonDays) * 86_400_000;
  const futureTolerance = nowMs + 5 * 60_000;
  const bySourceRevision = new Map<string, ReadOnlyHubChange>();

  notifications.forEach(notification => {
    if (!notification?.id || notification.type !== 'music_scale_changed') {
      return;
    }

    const occurredAtMs = notification.createdAtMs;
    if (
      typeof occurredAtMs !== 'number' ||
      !Number.isFinite(occurredAtMs) ||
      occurredAtMs < horizonStart ||
      occurredAtMs > futureTolerance
    ) {
      return;
    }

    const metadata = asRecord(notification.metadata);
    const sourceEntityId =
      typeof metadata.musicScaleId === 'string'
        ? metadata.musicScaleId.trim()
        : '';

    if (!sourceEntityId) return;

    const publishRevision = Math.max(
      0,
      Math.floor(finiteNumber(metadata.publishRevision, 0))
    );

    const change: ReadOnlyHubChange = {
      id: `musicscale:change:${notification.id}`,
      sourceApp: 'musicscale',
      sourceEntityType: 'scale',
      sourceEntityId,
      sourceNotificationId: notification.id,
      publishRevision,
      occurredAtMs,
      isRead: notification.isRead === true,
      codes: normalizeCodes(metadata),
      destination: {
        kind: 'app',
        appId: 'musicscale',
        path: `/scales/${sourceEntityId}`,
      },
    };

    const key = `${sourceEntityId}:rev${publishRevision}`;
    const existing = bySourceRevision.get(key);
    if (!existing || change.occurredAtMs > existing.occurredAtMs) {
      bySourceRevision.set(key, change);
    }
  });

  return Array.from(bySourceRevision.values())
    .sort((a, b) => b.occurredAtMs - a.occurredAtMs)
    .slice(0, Math.max(0, limit));
}
