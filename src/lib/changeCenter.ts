import type { FactEvidenceReference } from '../packages/events/factContract.js';
import {
  projectMusicScaleChangeFacts,
  type MusicScaleChangeFactMetadata
} from './musicScaleChangeFactProjection.js';

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

export interface HubChangeSourceEntity {
  sourceApp: string;
  sourceEntityType: string;
  sourceEntityId: string;
  validUntilMs?: number | null;
}

export interface MusicScaleChangeSourceInput {
  id: string;
  status?: unknown;
  startsAtMs: number;
  active?: unknown;
  isArchived?: unknown;
  isDeleted?: unknown;
  deleted?: unknown;
  deletedAt?: unknown;
}

export interface HubChangeProjectionOptions {
  nowMs?: number;
  horizonDays?: number;
  limit?: number;
  currentSourceEntities?: readonly HubChangeSourceEntity[];
}

const NON_CURRENT_MUSICSCALE_STATUSES = new Set([
  'cancelled',
  'canceled',
  'completed',
  'deleted',
  'archived',
  'inactive',
  'draft',
]);

function changeSourceEntityKey(
  sourceApp: string,
  sourceEntityType: string,
  sourceEntityId: string
): string {
  return `${sourceApp.trim()}:${sourceEntityType.trim()}:${sourceEntityId.trim()}`;
}

function hasDeletionMarker(value: unknown): boolean {
  return value !== undefined && value !== null && value !== false && value !== '';
}

/**
 * Builds the current MusicScale entities that are still meaningful to review.
 *
 * Historical notifications remain valid facts, but the Hub must not present a
 * "review change" CTA after the source scale was deleted, archived, cancelled,
 * completed, soft-deleted, deactivated or has already started.
 */
export function deriveCurrentMusicScaleChangeSources(
  scales: readonly MusicScaleChangeSourceInput[],
  nowMs: number = Date.now()
): HubChangeSourceEntity[] {
  if (!Number.isFinite(nowMs)) return [];

  const byId = new Map<string, HubChangeSourceEntity>();

  for (const scale of scales) {
    const sourceEntityId =
      typeof scale?.id === 'string'
        ? scale.id.trim()
        : '';

    const status = String(scale?.status ?? '')
      .trim()
      .toLowerCase();

    const startsAtMs = scale?.startsAtMs;

    if (
      !sourceEntityId ||
      typeof startsAtMs !== 'number' ||
      !Number.isFinite(startsAtMs) ||
      startsAtMs <= nowMs ||
      scale?.active === false ||
      scale?.isArchived === true ||
      scale?.isDeleted === true ||
      scale?.deleted === true ||
      hasDeletionMarker(scale?.deletedAt) ||
      NON_CURRENT_MUSICSCALE_STATUSES.has(status)
    ) {
      continue;
    }

    byId.set(sourceEntityId, {
      sourceApp: 'musicscale',
      sourceEntityType: 'scale',
      sourceEntityId,
      validUntilMs: startsAtMs,
    });
  }

  return Array.from(byId.values());
}

function buildCurrentSourceEntityKeys(
  currentSourceEntities: readonly HubChangeSourceEntity[] | undefined,
  nowMs: number
): Set<string> | null {
  if (currentSourceEntities === undefined) return null;

  const keys = new Set<string>();

  for (const entity of currentSourceEntities) {
    const sourceApp =
      typeof entity?.sourceApp === 'string'
        ? entity.sourceApp.trim()
        : '';
    const sourceEntityType =
      typeof entity?.sourceEntityType === 'string'
        ? entity.sourceEntityType.trim()
        : '';
    const sourceEntityId =
      typeof entity?.sourceEntityId === 'string'
        ? entity.sourceEntityId.trim()
        : '';

    if (!sourceApp || !sourceEntityType || !sourceEntityId) continue;

    if (
      typeof entity.validUntilMs === 'number' &&
      Number.isFinite(entity.validUntilMs) &&
      entity.validUntilMs <= nowMs
    ) {
      continue;
    }

    keys.add(
      changeSourceEntityKey(
        sourceApp,
        sourceEntityType,
        sourceEntityId
      )
    );
  }

  return keys;
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

export interface EvidenceBackedReadOnlyHubChange extends ReadOnlyHubChange {
  organizationId: string;
  evidence: readonly FactEvidenceReference[];
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


/**
 * Evidence-first Change Center projection.
 *
 * The source notification becomes a Canonical Fact first; only then is it
 * projected into the user-visible Changes lane.
 */
export function deriveEvidenceBackedHubChanges(
  organizationIdInput: string,
  notifications: MusicScaleChangeNotificationInput[],
  nowMsOrOptions: number | HubChangeProjectionOptions = Date.now(),
  horizonDaysInput: number = CHANGE_HORIZON_DAYS,
  limitInput: number = CHANGE_LIMIT
): EvidenceBackedReadOnlyHubChange[] {
  const organizationId = organizationIdInput.trim();
  if (!organizationId) return [];

  const options: HubChangeProjectionOptions =
    typeof nowMsOrOptions === 'number'
      ? {
          nowMs: nowMsOrOptions,
          horizonDays: horizonDaysInput,
          limit: limitInput,
        }
      : nowMsOrOptions;

  const nowMs =
    typeof options.nowMs === 'number' && Number.isFinite(options.nowMs)
      ? options.nowMs
      : Date.now();
  const horizonDays =
    typeof options.horizonDays === 'number' && Number.isFinite(options.horizonDays)
      ? options.horizonDays
      : CHANGE_HORIZON_DAYS;
  const limit =
    typeof options.limit === 'number' && Number.isFinite(options.limit)
      ? options.limit
      : CHANGE_LIMIT;

  const horizonStart = nowMs - Math.max(1, horizonDays) * 86_400_000;
  const futureTolerance = nowMs + 5 * 60_000;
  const currentSourceEntityKeys = buildCurrentSourceEntityKeys(
    options.currentSourceEntities,
    nowMs
  );
  const bySourceRevision = new Map<string, EvidenceBackedReadOnlyHubChange>();

  const facts = projectMusicScaleChangeFacts({
    organizationId,
    notifications
  });

  for (const fact of facts) {
    if (
      fact.occurredAtMs < horizonStart ||
      fact.occurredAtMs > futureTolerance
    ) {
      continue;
    }

    const metadata = fact.metadata as MusicScaleChangeFactMetadata;
    const sourceEntityKey = changeSourceEntityKey(
      'musicscale',
      'scale',
      fact.entity.id
    );

    if (
      currentSourceEntityKeys !== null &&
      !currentSourceEntityKeys.has(sourceEntityKey)
    ) {
      continue;
    }

    const change: EvidenceBackedReadOnlyHubChange = {
      id: `musicscale:change:${metadata.sourceNotificationId}`,
      sourceApp: 'musicscale',
      sourceEntityType: 'scale',
      sourceEntityId: fact.entity.id,
      sourceNotificationId: metadata.sourceNotificationId,
      publishRevision: metadata.publishRevision,
      occurredAtMs: fact.occurredAtMs,
      isRead: metadata.isRead,
      codes: [...metadata.codes] as HubChangeCode[],
      destination: {
        kind: 'app',
        appId: 'musicscale',
        path: `/scales/${fact.entity.id}`
      },
      organizationId,
      evidence: [fact.source]
    };

    const key = `${fact.entity.id}:rev${metadata.publishRevision}`;
    const existing = bySourceRevision.get(key);
    if (!existing || change.occurredAtMs > existing.occurredAtMs) {
      bySourceRevision.set(key, change);
    }
  }

  return Array.from(bySourceRevision.values())
    .sort((a, b) => b.occurredAtMs - a.occurredAtMs)
    .slice(0, Math.max(0, limit));
}
