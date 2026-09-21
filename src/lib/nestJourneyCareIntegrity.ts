import {
  hasValidFactEvidence,
  type FactEvidenceReference
} from '../packages/events/factContract.js';
import type {
  NestJourneyQueueSummary,
  NestJourneyWorkspaceProjection
} from './nestJourneyWorkspaceProjection.js';

export type NestJourneyCareIntegrityState =
  | 'clear'
  | 'overdue'
  | 'needs_assignment'
  | 'due_soon'
  | 'open';

export interface NestJourneyCareIntegritySnapshot {
  organizationId: string;
  observedAtMs: number;
  state: NestJourneyCareIntegrityState;
  totalOpenCount: number;
  assignedCount: number;
  unassignedCount: number;
  overdueCount: number;
  dueSoonCount: number;
  earliestDueAtMs: number | null;
  assignedAvailable: boolean;
  unassignedAvailable: boolean;
  assignedComplete: boolean;
  unassignedComplete: boolean;
  countsComplete: boolean;
  evidence: readonly FactEvidenceReference[];
}

function hasQueueEvidence(
  queue: NestJourneyQueueSummary,
  organizationId: string,
  entityId: string
): boolean {
  return (
    hasValidFactEvidence(
      queue.evidence,
      organizationId
    ) &&
    queue.evidence.every(reference =>
      reference.sourceApp === 'nestjourney' &&
      reference.entityType === 'followup_queue' &&
      reference.entityId === entityId
    )
  );
}

function dedupeEvidence(
  evidence: readonly FactEvidenceReference[]
): FactEvidenceReference[] {
  const seen = new Set<string>();
  const result: FactEvidenceReference[] = [];

  for (const reference of evidence) {
    const key = [
      reference.organizationId,
      reference.sourceApp,
      reference.sourceKind,
      reference.sourceRef,
      reference.entityType,
      reference.entityId
    ].join('|');

    if (seen.has(key)) continue;
    seen.add(key);
    result.push(reference);
  }

  return result;
}

function validEarliest(
  queue: NestJourneyQueueSummary,
  available: boolean
): number | null {
  if (!available) return null;
  const value = queue.earliestDueAtMs;
  return typeof value === 'number' &&
    Number.isFinite(value)
    ? value
    : null;
}

export function deriveNestJourneyCareIntegritySnapshot(
  input: {
    organizationId: string;
    projection:
      | NestJourneyWorkspaceProjection
      | null
      | undefined;
  }
): NestJourneyCareIntegritySnapshot | null {
  const organizationId =
    input.organizationId.trim();
  const projection = input.projection;

  if (
    !organizationId ||
    !projection ||
    projection.organizationId !==
      organizationId ||
    projection.accessible !== true ||
    projection.isGlobalAccess === true ||
    projection.decisionState !== 'granted' ||
    projection.canReadJourneyOperational !==
      true ||
    projection.ready !== true
  ) {
    return null;
  }

  const assignedAvailable =
    hasQueueEvidence(
      projection.assignedFirstContacts,
      organizationId,
      'assigned:first_contact'
    );
  const unassignedAvailable =
    hasQueueEvidence(
      projection.unassignedFirstContacts,
      organizationId,
      'unassigned:first_contact'
    );

  if (
    !assignedAvailable &&
    !unassignedAvailable
  ) {
    return null;
  }

  const assignedComplete =
    assignedAvailable &&
    projection.assignedFirstContacts.complete === true;
  const unassignedComplete =
    unassignedAvailable &&
    projection.unassignedFirstContacts.complete === true;
  const countsComplete =
    (!assignedAvailable || assignedComplete) &&
    (!unassignedAvailable || unassignedComplete);

  const assignedCount =
    assignedAvailable
      ? projection.assignedFirstContacts.count
      : 0;
  const unassignedCount =
    unassignedAvailable
      ? projection.unassignedFirstContacts.count
      : 0;
  const overdueCount =
    (
      assignedAvailable
        ? projection.assignedFirstContacts
            .overdueCount
        : 0
    ) +
    (
      unassignedAvailable
        ? projection.unassignedFirstContacts
            .overdueCount
        : 0
    );
  const dueSoonCount =
    (
      assignedAvailable
        ? projection.assignedFirstContacts
            .dueSoonCount
        : 0
    ) +
    (
      unassignedAvailable
        ? projection.unassignedFirstContacts
            .dueSoonCount
        : 0
    );
  const totalOpenCount =
    assignedCount + unassignedCount;

  const earliestCandidates = [
    validEarliest(
      projection.assignedFirstContacts,
      assignedAvailable
    ),
    validEarliest(
      projection.unassignedFirstContacts,
      unassignedAvailable
    )
  ].filter(
    (value): value is number =>
      value !== null
  );

  const state: NestJourneyCareIntegrityState =
    overdueCount > 0
      ? 'overdue'
      : unassignedAvailable &&
          unassignedCount > 0
        ? 'needs_assignment'
        : dueSoonCount > 0
          ? 'due_soon'
          : totalOpenCount > 0
            ? 'open'
            : 'clear';

  const evidence = dedupeEvidence([
    ...(assignedAvailable
      ? projection.assignedFirstContacts
          .evidence
      : []),
    ...(unassignedAvailable
      ? projection.unassignedFirstContacts
          .evidence
      : [])
  ]);

  return {
    organizationId,
    observedAtMs:
      projection.observedAtMs,
    state,
    totalOpenCount,
    assignedCount,
    unassignedCount,
    overdueCount,
    dueSoonCount,
    earliestDueAtMs:
      earliestCandidates.length > 0
        ? Math.min(...earliestCandidates)
        : null,
    assignedAvailable,
    unassignedAvailable,
    assignedComplete,
    unassignedComplete,
    countsComplete,
    evidence
  };
}
