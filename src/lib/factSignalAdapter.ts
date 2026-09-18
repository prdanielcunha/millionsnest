import { isCanonicalFactValid } from '../packages/events/factContract.js';
import type { EvidenceBackedEcosystemSignal } from './actionSignals.js';
import type {
  MusicScaleCanonicalFact,
  MusicScalePersonalConfirmationFactMetadata,
  MusicScaleResponseSummaryFactMetadata
} from './musicScaleFactProjection.js';

function nonNegativeNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

function startsAtMsFrom(metadata: Record<string, unknown>): number | null {
  return nonNegativeNumber(metadata.startsAtMs);
}

function baseFactIsCoherent(fact: MusicScaleCanonicalFact): boolean {
  return (
    isCanonicalFactValid(fact) &&
    fact.source.sourceApp === 'musicscale' &&
    fact.source.entityType === 'scale' &&
    fact.entity.type === 'scale' &&
    fact.source.entityId === fact.entity.id &&
    fact.source.organizationId === fact.organizationId
  );
}

function responseSummarySignal(
  fact: Extract<
    MusicScaleCanonicalFact,
    { eventType: 'musicscale.scale.response_summary_observed' }
  >
): EvidenceBackedEcosystemSignal | null {
  const metadata = fact.metadata as MusicScaleResponseSummaryFactMetadata;
  const pendingResponses = nonNegativeNumber(metadata.pendingResponses);

  if (
    fact.source.sourceRef !== 'musicscale.read_model.schedule_response_summary' ||
    metadata.responseSummaryAvailable !== true ||
    pendingResponses === null ||
    pendingResponses <= 0
  ) {
    return null;
  }

  return {
    organizationId: fact.organizationId,
    sourceApp: 'musicscale',
    signalType: 'musicscale_pending_responses',
    sourceEntityType: 'scale',
    sourceEntityId: fact.entity.id,
    dedupeKey: `musicscale:pending_responses:${fact.entity.id}`,
    fingerprint:
      `musicscale:pending_responses:${fact.entity.id}:${pendingResponses}`,
    occurredAtMs: startsAtMsFrom(metadata),
    payload: {
      pendingResponses
    },
    evidence: [fact.source]
  };
}

function personalConfirmationSignal(
  fact: Extract<
    MusicScaleCanonicalFact,
    { eventType: 'musicscale.scale.personal_confirmation_observed' }
  >
): EvidenceBackedEcosystemSignal | null {
  const metadata = fact.metadata as MusicScalePersonalConfirmationFactMetadata;
  const pendingResponses = nonNegativeNumber(metadata.pendingResponses);
  const publishRevision = nonNegativeNumber(metadata.publishRevision) ?? 0;

  if (
    fact.source.sourceRef !== 'musicscale.read_model.personal_schedule_confirmation' ||
    metadata.responseSummaryAvailable !== true ||
    pendingResponses === null ||
    pendingResponses <= 0
  ) {
    return null;
  }

  return {
    organizationId: fact.organizationId,
    sourceApp: 'musicscale',
    signalType: 'musicscale_personal_confirmation',
    sourceEntityType: 'scale',
    sourceEntityId: fact.entity.id,
    dedupeKey: `musicscale:personal_confirmation:${fact.entity.id}`,
    fingerprint:
      `musicscale:personal_confirmation:${fact.entity.id}:rev${publishRevision}:pending${pendingResponses}`,
    occurredAtMs: startsAtMsFrom(metadata),
    payload: {
      pendingResponses,
      publishRevision
    },
    evidence: [fact.source]
  };
}

/**
 * Signal Engine ingress for current MusicScale facts.
 *
 * Facts remain neutral source truth. Only actionable facts become signals, and
 * permissions are still evaluated later by Action Center.
 */
export function collectMusicScaleSignalsFromFacts(
  facts: readonly MusicScaleCanonicalFact[]
): EvidenceBackedEcosystemSignal[] {
  const signals: EvidenceBackedEcosystemSignal[] = [];

  for (const fact of facts) {
    if (!baseFactIsCoherent(fact)) continue;

    if (fact.eventType === 'musicscale.scale.response_summary_observed') {
      const signal = responseSummarySignal(fact);
      if (signal) signals.push(signal);
      continue;
    }

    if (fact.eventType === 'musicscale.scale.personal_confirmation_observed') {
      const signal = personalConfirmationSignal(fact);
      if (signal) signals.push(signal);
    }
  }

  return signals;
}
