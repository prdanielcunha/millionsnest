import type { FactEvidenceReference } from '../packages/events/factContract.js';
import { projectCurrentMusicScaleFacts } from './musicScaleFactProjection.js';
import { collectMusicScaleSignalsFromFacts } from './factSignalAdapter.js';

export type ActionSignalType =
  | 'organization_incomplete'
  | 'pending_invites'
  | 'musicscale_pending_responses'
  | 'musicscale_personal_confirmation';

export interface EcosystemSignal {
  sourceApp: 'hub' | 'musicscale';
  signalType: ActionSignalType;
  sourceEntityType: 'organization' | 'invitation_set' | 'scale';
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
  musicScale: {
    ready: boolean;
    observedAtMs?: number | null;
    nextScale: null | {
      id: string;
      startsAtMs?: number | null;
      responseSummaryAvailable: boolean;
      pendingResponses: number;
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

  return signals;
}

function buildSignalEvidence(
  signal: EcosystemSignal,
  input: EvidenceBackedActionSignalCollectionInput
): FactEvidenceReference {
  const organizationId = input.organizationId.trim();
  const observedAtMs =
    typeof input.musicScale.observedAtMs === 'number' &&
    Number.isFinite(input.musicScale.observedAtMs) &&
    input.musicScale.observedAtMs >= 0
      ? input.musicScale.observedAtMs
      : undefined;

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

  if (signal.signalType === 'musicscale_personal_confirmation') {
    return {
      organizationId,
      sourceApp: 'musicscale',
      sourceKind: 'runtime_projection',
      sourceRef: 'musicscale.read_model.personal_schedule_confirmation',
      entityType: 'scale',
      entityId: signal.sourceEntityId,
      fieldPaths: [
        'responseSummaryAvailable',
        'pendingResponses',
        'publishRevision',
        'startsAtMs'
      ],
      observedAtMs
    };
  }

  return {
    organizationId,
    sourceApp: 'musicscale',
    sourceKind: 'runtime_projection',
    sourceRef: 'musicscale.read_model.schedule_response_summary',
    entityType: 'scale',
    entityId: signal.sourceEntityId,
    fieldPaths: ['responseSummaryAvailable', 'pendingResponses', 'startsAtMs'],
    observedAtMs
  };
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
  }).map(signal => {
    const normalizedSignal: EcosystemSignal =
      signal.signalType === 'organization_incomplete'
        ? { ...signal, sourceEntityId: organizationId }
        : signal;

    return {
      ...normalizedSignal,
      organizationId,
      evidence: [buildSignalEvidence(normalizedSignal, input)]
    } satisfies EvidenceBackedEcosystemSignal;
  });

  const musicScaleFacts = projectCurrentMusicScaleFacts({
    organizationId,
    ready: input.musicScale.ready,
    observedAtMs: input.musicScale.observedAtMs,
    nextScale: input.musicScale.nextScale,
    nextPersonalScale: input.musicScale.nextPersonalScale
  });

  const musicScaleSignals = collectMusicScaleSignalsFromFacts(musicScaleFacts);

  return [...hubSignals, ...musicScaleSignals];
}
