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

export interface ActionSignalCollectionInput {
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
