import type { FactEvidenceReference } from '../packages/events/factContract.js';

export type ActionSignalType =
  | 'organization_incomplete'
  | 'pending_invites'
  | 'musicscale_pending_responses'
  | 'musicscale_personal_confirmation';

export interface EcosystemSignal {
  organizationId: string;
  sourceApp: 'hub' | 'musicscale';
  signalType: ActionSignalType;
  sourceEntityType: 'organization' | 'invitation_set' | 'scale';
  sourceEntityId: string;
  dedupeKey: string;
  fingerprint: string;
  occurredAtMs?: number | null;
  evidence: readonly FactEvidenceReference[];
  payload: Record<string, unknown>;
}

export interface ActionSignalCollectionInput {
  organizationId: string;
  observedAtMs?: number;
  organization?: {
    isConfigured: boolean;
  } | null;
  pendingInvitesCount: number;
  musicScale: {
    ready: boolean;
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

function evidenceReference(
  organizationId: string,
  sourceApp: FactEvidenceReference['sourceApp'],
  sourceKind: FactEvidenceReference['sourceKind'],
  sourceRef: string,
  entityType: string,
  entityId: string,
  observedAtMs: number,
  fieldPaths?: readonly string[]
): FactEvidenceReference {
  return {
    organizationId,
    sourceApp,
    sourceKind,
    sourceRef,
    entityType,
    entityId,
    observedAtMs,
    ...(fieldPaths ? { fieldPaths } : {})
  };
}

/**
 * Source adapters collect facts only. They do not decide whether the current
 * user may see an action and they do not write UI cards.
 *
 * NO SOURCE -> NO CLAIM: if tenant scope is unknown, the adapter emits no
 * signal. Every emitted signal carries evidence that can be traced back to the
 * scoped read model or source records that produced it.
 */
export function collectActionSignals(
  input: ActionSignalCollectionInput
): EcosystemSignal[] {
  const organizationId = String(input.organizationId || '').trim();
  if (!organizationId) return [];

  const observedAtMs =
    typeof input.observedAtMs === 'number' && Number.isFinite(input.observedAtMs)
      ? input.observedAtMs
      : Date.now();
  const signals: EcosystemSignal[] = [];

  if (!input.organization?.isConfigured) {
    signals.push({
      organizationId,
      sourceApp: 'hub',
      signalType: 'organization_incomplete',
      sourceEntityType: 'organization',
      sourceEntityId: organizationId,
      dedupeKey: 'hub:organization_incomplete',
      fingerprint: 'hub:organization_incomplete:v1',
      evidence: [
        evidenceReference(
          organizationId,
          'hub',
          'runtime_projection',
          'dashboard.organization',
          'organization',
          organizationId,
          observedAtMs,
          ['name', 'slug']
        )
      ],
      payload: {}
    });
  }

  if (input.pendingInvitesCount > 0) {
    signals.push({
      organizationId,
      sourceApp: 'hub',
      signalType: 'pending_invites',
      sourceEntityType: 'invitation_set',
      sourceEntityId: 'pending',
      dedupeKey: 'hub:pending_invites',
      fingerprint: `hub:pending_invites:${input.pendingInvitesCount}`,
      evidence: [
        evidenceReference(
          organizationId,
          'hub',
          'runtime_projection',
          'dashboard.pendingInvites',
          'invitation_set',
          'pending',
          observedAtMs,
          ['status']
        )
      ],
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
      organizationId,
      sourceApp: 'musicscale',
      signalType: 'musicscale_pending_responses',
      sourceEntityType: 'scale',
      sourceEntityId: nextScale.id,
      dedupeKey: `musicscale:pending_responses:${nextScale.id}`,
      fingerprint: `musicscale:pending_responses:${nextScale.id}:${nextScale.pendingResponses}`,
      occurredAtMs: nextScale.startsAtMs ?? null,
      evidence: [
        evidenceReference(
          organizationId,
          'musicscale',
          'firestore_document',
          `scales/${nextScale.id}`,
          'scale',
          nextScale.id,
          observedAtMs,
          ['organizationId', 'date', 'time', 'publishRevision']
        ),
        evidenceReference(
          organizationId,
          'musicscale',
          'firestore_query',
          `scales/${nextScale.id}/responses`,
          'scale_response_set',
          nextScale.id,
          observedAtMs,
          ['status', 'active', 'eventAssignmentId']
        )
      ],
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
      organizationId,
      sourceApp: 'musicscale',
      signalType: 'musicscale_personal_confirmation',
      sourceEntityType: 'scale',
      sourceEntityId: nextPersonalScale.id,
      dedupeKey: `musicscale:personal_confirmation:${nextPersonalScale.id}`,
      fingerprint:
        `musicscale:personal_confirmation:${nextPersonalScale.id}:rev${revision}:pending${nextPersonalScale.pendingResponses}`,
      occurredAtMs: nextPersonalScale.startsAtMs ?? null,
      evidence: [
        evidenceReference(
          organizationId,
          'musicscale',
          'firestore_document',
          `scales/${nextPersonalScale.id}`,
          'scale',
          nextPersonalScale.id,
          observedAtMs,
          ['organizationId', 'date', 'time', 'publishRevision']
        ),
        evidenceReference(
          organizationId,
          'musicscale',
          'firestore_query',
          `scales/${nextPersonalScale.id}/responses`,
          'scale_response_set',
          nextPersonalScale.id,
          observedAtMs,
          ['status', 'active', 'eventAssignmentId']
        )
      ],
      payload: {
        pendingResponses: nextPersonalScale.pendingResponses,
        publishRevision: revision
      }
    });
  }

  return signals;
}
