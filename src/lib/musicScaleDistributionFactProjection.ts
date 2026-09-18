import {
  CANONICAL_FACT_SCHEMA_VERSION,
  isCanonicalFactValid,
  type CanonicalFact
} from '../packages/events/factContract.js';
import type {
  MusicScaleAssignmentDistributionSnapshot,
  MusicScaleFunctionDistribution
} from './musicScaleDistributionIntelligence.js';

export interface MusicScaleDistributionFactMetadata
  extends Record<string, unknown> {
  windowDays: number;
  windowStartMs: number;
  windowEndMs: number;
  completedScheduleCount: number;
  assignmentCount: number;
  uniquePeople: number;
  byFunction: MusicScaleFunctionDistribution[];
}

export type MusicScaleDistributionCanonicalFact = CanonicalFact<
  'musicscale.team.assignment_distribution_observed',
  MusicScaleDistributionFactMetadata
>;

export interface EvidenceBackedMusicScaleDistributionSnapshot
  extends MusicScaleAssignmentDistributionSnapshot {
  organizationId: string;
  evidence: readonly [MusicScaleDistributionCanonicalFact['source']];
}

function cleanId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function finiteNonNegative(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

function distributionFingerprint(
  snapshot: MusicScaleAssignmentDistributionSnapshot
): string {
  const functions = snapshot.byFunction
    .map(item =>
      [
        item.functionName,
        item.assignmentCount,
        item.uniquePeople,
        item.minAssignmentsPerPerson,
        item.maxAssignmentsPerPerson,
        item.averageAssignmentsPerPerson
      ].join(':')
    )
    .join('|');

  return [
    `completed-${snapshot.completedScheduleCount}`,
    `assignments-${snapshot.assignmentCount}`,
    `people-${snapshot.uniquePeople}`,
    functions || 'no-functions'
  ].join(':');
}

/**
 * Canonical evidence envelope for the read-only Worship distribution snapshot.
 *
 * The underlying scale documents are already loaded by the Hub. This adapter
 * creates no query/write and exposes only aggregate metadata in the fact.
 */
export function projectMusicScaleDistributionFact(input: {
  organizationId: string;
  snapshot: MusicScaleAssignmentDistributionSnapshot;
  observedAtMs?: number | null;
}): MusicScaleDistributionCanonicalFact | null {
  const organizationId = cleanId(input.organizationId);
  if (!organizationId) return null;

  const observedAtMs =
    finiteNonNegative(input.observedAtMs) ??
    finiteNonNegative(input.snapshot.windowEndMs);

  if (
    observedAtMs === null ||
    finiteNonNegative(input.snapshot.windowStartMs) === null ||
    finiteNonNegative(input.snapshot.windowEndMs) === null ||
    finiteNonNegative(input.snapshot.windowDays) === null ||
    finiteNonNegative(input.snapshot.completedScheduleCount) === null ||
    finiteNonNegative(input.snapshot.assignmentCount) === null ||
    finiteNonNegative(input.snapshot.uniquePeople) === null
  ) {
    return null;
  }

  const idempotencyKey =
    `musicscale:${organizationId}:worship-team:assignment-distribution:` +
    distributionFingerprint(input.snapshot);

  const fact: MusicScaleDistributionCanonicalFact = {
    schemaVersion: CANONICAL_FACT_SCHEMA_VERSION,
    factId: idempotencyKey,
    organizationId,
    eventType: 'musicscale.team.assignment_distribution_observed',
    actor: { type: 'system' },
    occurredAtMs: observedAtMs,
    recordedAtMs: observedAtMs,
    source: {
      organizationId,
      sourceApp: 'musicscale',
      sourceKind: 'runtime_projection',
      sourceRef:
        'musicscale.read_model.completed_schedule_assignments_30d',
      entityType: 'worship_team',
      entityId: organizationId,
      fieldPaths: [
        'scales.status',
        'scales.date',
        'scales.time',
        'scales.eventAssignments.eventAssignmentId',
        'scales.eventAssignments.userId',
        'scales.eventAssignments.functionName',
        'scales.eventAssignments.active'
      ],
      observedAtMs
    },
    entity: {
      type: 'worship_team',
      id: organizationId
    },
    metadata: {
      windowDays: input.snapshot.windowDays,
      windowStartMs: input.snapshot.windowStartMs,
      windowEndMs: input.snapshot.windowEndMs,
      completedScheduleCount:
        input.snapshot.completedScheduleCount,
      assignmentCount: input.snapshot.assignmentCount,
      uniquePeople: input.snapshot.uniquePeople,
      byFunction: input.snapshot.byFunction.map(item => ({ ...item }))
    },
    idempotencyKey
  };

  return isCanonicalFactValid(fact) ? fact : null;
}

export function deriveEvidenceBackedMusicScaleDistribution(input: {
  organizationId: string;
  snapshot: MusicScaleAssignmentDistributionSnapshot;
  observedAtMs?: number | null;
}): EvidenceBackedMusicScaleDistributionSnapshot | null {
  const fact = projectMusicScaleDistributionFact(input);
  if (!fact) return null;

  return {
    ...input.snapshot,
    byFunction: input.snapshot.byFunction.map(item => ({ ...item })),
    organizationId: fact.organizationId,
    evidence: [fact.source]
  };
}
