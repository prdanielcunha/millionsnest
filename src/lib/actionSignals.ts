import {
  hasValidFactEvidence,
  type FactEvidenceReference
} from '../packages/events/factContract.js';
import type { NestJourneyQueueSummary } from './nestJourneyWorkspaceProjection.js';
import { projectCurrentMusicScaleFacts } from './musicScaleFactProjection.js';
import { collectMusicScaleSignalsFromFacts } from './factSignalAdapter.js';

export type ActionSignalType =
  | 'organization_incomplete'
  | 'pending_invites'
  | 'musicscale_pending_responses'
  | 'musicscale_declined_responses'
  | 'musicscale_repertoire_content_gaps'
  | 'musicscale_personal_confirmation'
  | 'nestjourney_assigned_first_contacts'
  | 'nestjourney_unassigned_first_contacts';

export interface EcosystemSignal {
  sourceApp: 'hub' | 'musicscale' | 'nestjourney';
  signalType: ActionSignalType;
  sourceEntityType: 'organization' | 'invitation_set' | 'scale' | 'followup_queue';
  sourceEntityId: string;
  dedupeKey: string;
  fingerprint: string;
  occurredAtMs?: number | null;
  payload: Record<string, unknown>;
}

export interface EvidenceBackedEcosystemSignal extends EcosystemSignal {
  organizationId: string;
  evidence: readonly FactEvidenceReference[];
}

export interface ActionSignalCollectionInput {
  organization?: {
    isConfigured: boolean;
  } | null;
  pendingInvitesCount: number;
  journey?: {
    ready: boolean;
    observedAtMs?: number | null;
    assignedFirstContacts: NestJourneyQueueSummary;
    unassignedFirstContacts: NestJourneyQueueSummary;
  };
  musicScale: {
    ready: boolean;
    observedAtMs?: number | null;
    nextScale: null | {
      id: string;
      startsAtMs?: number | null;
      responseSummaryAvailable: boolean;
      pendingResponses: number;
      pendingByFunction?: readonly {
        functionName: string;
        count: number;
      }[];
      declinedResponses?: number;
      declinedByFunction?: readonly {
        functionName: string;
        count: number;
      }[];
      repertoireContent?: {
        totalSongRefs: number;
        resolvedSongCount: number;
        missingLibrarySongIds: string[];
        emptyContentSongIds: string[];
        emptyContentTitles: string[];
        gapCount: number;
      } | null;
    };
    nextPersonalScale?: null | {
      id: string;
      startsAtMs?: number | null;
      publishRevision?: number | null;
      responseSummaryAvailable: boolean;
      pendingResponses: number;
    };
  };
}

export interface EvidenceBackedActionSignalCollectionInput extends ActionSignalCollectionInput {
  organizationId: string;
}


export function fingerprintNestJourneyQueue(input: {
  signalType:
    | 'nestjourney_assigned_first_contacts'
    | 'nestjourney_unassigned_first_contacts';
  queue: NestJourneyQueueSummary;
}): string {
  const earliestDueAtMs =
    typeof input.queue.earliestDueAtMs === 'number' &&
    Number.isFinite(input.queue.earliestDueAtMs)
      ? input.queue.earliestDueAtMs
      : null;

  return [
    'nestjourney',
    input.signalType,
    input.queue.count,
    input.queue.overdueCount,
    input.queue.dueSoonCount,
    earliestDueAtMs ?? 'none',
    input.queue.complete === true
      ? 'complete'
      : 'bounded'
  ].join(':');
}

/**
 * Source adapters collect facts only. They do not decide whether the current
 * user may see an action and they do not write UI cards.
 */
export function collectActionSignals(
  input: ActionSignalCollectionInput
): EcosystemSignal[] {
  const signals: EcosystemSignal[] = [];

  if (!input.organization?.isConfigured) {
    signals.push({
      sourceApp: 'hub',
      signalType: 'organization_incomplete',
      sourceEntityType: 'organization',
      sourceEntityId: 'current',
      dedupeKey: 'hub:organization_incomplete',
      fingerprint: 'hub:organization_incomplete:v1',
      payload: {}
    });
  }

  if (input.pendingInvitesCount > 0) {
    signals.push({
      sourceApp: 'hub',
      signalType: 'pending_invites',
      sourceEntityType: 'invitation_set',
      sourceEntityId: 'pending',
      dedupeKey: 'hub:pending_invites',
      fingerprint: `hub:pending_invites:${input.pendingInvitesCount}`,
      payload: {
        count: input.pendingInvitesCount
      }
    });
  }

  const nextScale = input.musicScale.nextScale;
  if (
    input.musicScale.ready &&
    nextScale?.responseSummaryAvailable === true &&
    nextScale.pendingResponses > 0
  ) {
    signals.push({
      sourceApp: 'musicscale',
      signalType: 'musicscale_pending_responses',
      sourceEntityType: 'scale',
      sourceEntityId: nextScale.id,
      dedupeKey: `musicscale:pending_responses:${nextScale.id}`,
      fingerprint: `musicscale:pending_responses:${nextScale.id}:${nextScale.pendingResponses}`,
      occurredAtMs: nextScale.startsAtMs ?? null,
      payload: {
        pendingResponses: nextScale.pendingResponses
      }
    });
  }

  const nextPersonalScale = input.musicScale.nextPersonalScale;
  if (
    input.musicScale.ready &&
    nextPersonalScale?.responseSummaryAvailable === true &&
    nextPersonalScale.pendingResponses > 0
  ) {
    const revision =
      typeof nextPersonalScale.publishRevision === 'number' &&
      Number.isFinite(nextPersonalScale.publishRevision)
        ? nextPersonalScale.publishRevision
        : 0;

    signals.push({
      sourceApp: 'musicscale',
      signalType: 'musicscale_personal_confirmation',
      sourceEntityType: 'scale',
      sourceEntityId: nextPersonalScale.id,
      dedupeKey: `musicscale:personal_confirmation:${nextPersonalScale.id}`,
      fingerprint:
        `musicscale:personal_confirmation:${nextPersonalScale.id}:rev${revision}:pending${nextPersonalScale.pendingResponses}`,
      occurredAtMs: nextPersonalScale.startsAtMs ?? null,
      payload: {
        pendingResponses: nextPersonalScale.pendingResponses,
        publishRevision: revision
      }
    });
  }

  const journey = input.journey;
  if (journey?.ready === true) {
    const queueSignals: Array<{
      type: Extract<ActionSignalType, 'nestjourney_assigned_first_contacts' | 'nestjourney_unassigned_first_contacts'>;
      entityId: string;
      queue: NestJourneyQueueSummary;
    }> = [
      {
        type: 'nestjourney_assigned_first_contacts',
        entityId: 'assigned:first_contact',
        queue: journey.assignedFirstContacts
      },
      {
        type: 'nestjourney_unassigned_first_contacts',
        entityId: 'unassigned:first_contact',
        queue: journey.unassignedFirstContacts
      }
    ];

    for (const item of queueSignals) {
      if (item.queue.count <= 0) continue;
      const earliestDueAtMs =
        typeof item.queue.earliestDueAtMs === 'number' &&
        Number.isFinite(item.queue.earliestDueAtMs)
          ? item.queue.earliestDueAtMs
          : null;

      signals.push({
        sourceApp: 'nestjourney',
        signalType: item.type,
        sourceEntityType: 'followup_queue',
        sourceEntityId: item.entityId,
        dedupeKey: `nestjourney:${item.type}:${item.entityId}`,
        fingerprint: fingerprintNestJourneyQueue({
          signalType: item.type,
          queue: item.queue
        }),
        occurredAtMs: earliestDueAtMs,
        payload: {
          count: item.queue.count,
          overdueCount: item.queue.overdueCount,
          dueSoonCount: item.queue.dueSoonCount
        }
      });
    }
  }

  return signals;
}

function buildHubSignalEvidence(
  signal: EcosystemSignal,
  input: EvidenceBackedActionSignalCollectionInput
): FactEvidenceReference | null {
  const organizationId = input.organizationId.trim();
  if (!organizationId || signal.sourceApp !== 'hub') return null;

  if (signal.signalType === 'organization_incomplete') {
    return {
      organizationId,
      sourceApp: 'hub',
      sourceKind: 'runtime_projection',
      sourceRef: 'hub.read_model.organization_configuration',
      entityType: 'organization',
      entityId: organizationId,
      fieldPaths: ['name', 'slug']
    };
  }

  if (signal.signalType === 'pending_invites') {
    return {
      organizationId,
      sourceApp: 'hub',
      sourceKind: 'runtime_projection',
      sourceRef: 'hub.read_model.pending_invitations',
      entityType: 'invitation_set',
      entityId: 'pending',
      fieldPaths: ['pendingInvitesCount']
    };
  }

  // MusicScale evidence must come from Canonical Facts. Any other source fails
  // closed here instead of silently recreating a legacy direct adapter.
  return null;
}

/**
 * Transitional adapter for Church Intelligence OS.
 *
 * It reuses the already-loaded read models and attaches traceable evidence to
 * each deterministic signal. It performs no additional Firestore/API reads.
 */
export function collectEvidenceBackedActionSignals(
  input: EvidenceBackedActionSignalCollectionInput
): EvidenceBackedEcosystemSignal[] {
  const organizationId = input.organizationId.trim();
  if (!organizationId) return [];

  // Hub-owned facts remain on the transitional adapter for now. MusicScale is
  // the first real product migrated through Canonical Facts -> Signals.
  const hubSignals = collectActionSignals({
    organization: input.organization,
    pendingInvitesCount: input.pendingInvitesCount,
    musicScale: {
      ready: false,
      nextScale: null,
      nextPersonalScale: null
    }
  }).flatMap(signal => {
    const normalizedSignal: EcosystemSignal =
      signal.signalType === 'organization_incomplete'
        ? { ...signal, sourceEntityId: organizationId }
        : signal;
    const evidence = buildHubSignalEvidence(normalizedSignal, input);
    if (!evidence) return [];

    return [{
      ...normalizedSignal,
      organizationId,
      evidence: [evidence]
    } satisfies EvidenceBackedEcosystemSignal];
  });

  const musicScaleFacts = projectCurrentMusicScaleFacts({
    organizationId,
    ready: input.musicScale.ready,
    observedAtMs: input.musicScale.observedAtMs,
    nextScale: input.musicScale.nextScale,
    nextPersonalScale: input.musicScale.nextPersonalScale
  });

  const musicScaleSignals = collectMusicScaleSignalsFromFacts(musicScaleFacts);

  const journeySignals = input.journey?.ready === true
    ? collectActionSignals({
        organization: null,
        pendingInvitesCount: 0,
        journey: input.journey,
        musicScale: {
          ready: false,
          nextScale: null,
          nextPersonalScale: null
        }
      }).flatMap(signal => {
        if (signal.sourceApp !== 'nestjourney') return [];

        const queue =
          signal.signalType === 'nestjourney_assigned_first_contacts'
            ? input.journey?.assignedFirstContacts
            : signal.signalType === 'nestjourney_unassigned_first_contacts'
              ? input.journey?.unassignedFirstContacts
              : null;

        if (
          !queue ||
          !hasValidFactEvidence(queue.evidence, organizationId) ||
          queue.evidence.some(reference =>
            reference.sourceApp !== 'nestjourney' ||
            reference.entityType !== signal.sourceEntityType ||
            reference.entityId !== signal.sourceEntityId
          )
        ) {
          return [];
        }

        return [{
          ...signal,
          organizationId,
          evidence: queue.evidence
        } satisfies EvidenceBackedEcosystemSignal];
      })
    : [];

  return [...hubSignals, ...musicScaleSignals, ...journeySignals];
}
