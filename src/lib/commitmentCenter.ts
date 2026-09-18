import type { FactEvidenceReference } from '../packages/events/factContract.js';
import {
  projectCurrentMusicScaleFacts,
  type MusicScalePersonalCommitmentFactMetadata
} from './musicScaleFactProjection.js';

export const PREPARATION_WINDOW_DAYS = 7;
export const PREPARATION_WINDOW_MS = PREPARATION_WINDOW_DAYS * 24 * 60 * 60 * 1000;

export type CommitmentDestination =
  | { kind: 'app'; appId: string; path?: string };

export interface ReadOnlyHubCommitment {
  id: string;
  sourceApp: 'musicscale';
  sourceEntityType: 'scale';
  sourceEntityId: string;
  startsAtMs: number;
  date: string;
  time?: string | null;
  songCount: number;
  functionNames: string[];
  destination: CommitmentDestination;
}

export interface EvidenceBackedReadOnlyHubCommitment
  extends ReadOnlyHubCommitment {
  organizationId: string;
  evidence: readonly FactEvidenceReference[];
}

export interface CommitmentProjectionInput {
  musicScale: {
    ready: boolean;
    nextPersonalScale: null | {
      id: string;
      date: string;
      time?: string | null;
      startsAtMs: number;
      songCount: number;
      functionNames: string[];
    };
  };
}

/**
 * Commitments are not actions.
 *
 * They represent something the current user is expected to participate in,
 * even when there is nothing wrong and no leader intervention is required.
 * Keeping this projection separate from Action OS prevents normal service from
 * being misclassified as a problem.
 */
export function deriveReadOnlyHubCommitments(
  input: CommitmentProjectionInput,
  nowMs: number = Date.now()
): ReadOnlyHubCommitment[] {
  if (!input.musicScale.ready) return [];

  const scale = input.musicScale.nextPersonalScale;
  if (!scale?.id) return [];
  if (!Number.isFinite(scale.startsAtMs)) return [];
  if (scale.startsAtMs < nowMs - 6 * 60 * 60 * 1000) return [];
  if (scale.startsAtMs > nowMs + PREPARATION_WINDOW_MS) return [];

  const functionNames = Array.from(
    new Set(
      (scale.functionNames || [])
        .map(value => String(value).trim())
        .filter(Boolean)
    )
  );

  return [{
    id: `musicscale:commitment:${scale.id}`,
    sourceApp: 'musicscale',
    sourceEntityType: 'scale',
    sourceEntityId: scale.id,
    startsAtMs: scale.startsAtMs,
    date: scale.date,
    time: scale.time || null,
    songCount:
      typeof scale.songCount === 'number' && Number.isFinite(scale.songCount)
        ? Math.max(0, Math.floor(scale.songCount))
        : 0,
    functionNames,
    destination: {
      kind: 'app',
      appId: 'musicscale',
      path: `/scales/${scale.id}`
    }
  }];
}


export interface EvidenceBackedCommitmentProjectionInput {
  organizationId: string;
  musicScale: CommitmentProjectionInput['musicScale'] & {
    observedAtMs?: number | null;
    nextPersonalScale: null | (
      NonNullable<CommitmentProjectionInput['musicScale']['nextPersonalScale']> & {
        publishRevision?: number | null;
        responseSummaryAvailable?: boolean;
        pendingResponses?: number;
      }
    );
  };
}

/**
 * Evidence-first Commitment Center projection.
 *
 * Commitments remain separate from actions, but a visible commitment now has a
 * canonical source fact and tenant-bound evidence.
 */
export function deriveEvidenceBackedHubCommitments(
  input: EvidenceBackedCommitmentProjectionInput,
  nowMs: number = Date.now()
): EvidenceBackedReadOnlyHubCommitment[] {
  const organizationId = input.organizationId.trim();
  if (!organizationId || !input.musicScale.ready) return [];

  const scale = input.musicScale.nextPersonalScale;
  if (!scale) return [];

  const facts = projectCurrentMusicScaleFacts({
    organizationId,
    ready: true,
    observedAtMs: input.musicScale.observedAtMs,
    projectionNowMs: nowMs,
    nextScale: null,
    nextPersonalScale: {
      id: scale.id,
      date: scale.date,
      time: scale.time ?? null,
      startsAtMs: scale.startsAtMs,
      songCount: scale.songCount,
      functionNames: scale.functionNames,
      publishRevision: scale.publishRevision ?? 0,
      responseSummaryAvailable: scale.responseSummaryAvailable === true,
      pendingResponses:
        typeof scale.pendingResponses === 'number' &&
        Number.isFinite(scale.pendingResponses)
          ? Math.max(0, scale.pendingResponses)
          : 0
    }
  });

  const fact = facts.find(
    candidate =>
      candidate.eventType === 'musicscale.scale.personal_commitment_observed'
  );
  if (!fact) return [];

  const metadata = fact.metadata as MusicScalePersonalCommitmentFactMetadata;
  if (metadata.startsAtMs < nowMs - 6 * 60 * 60 * 1000) return [];
  if (metadata.startsAtMs > nowMs + PREPARATION_WINDOW_MS) return [];

  return [{
    id: `musicscale:commitment:${fact.entity.id}`,
    sourceApp: 'musicscale',
    sourceEntityType: 'scale',
    sourceEntityId: fact.entity.id,
    startsAtMs: metadata.startsAtMs,
    date: metadata.date,
    time: metadata.time,
    songCount: metadata.songCount,
    functionNames: [...metadata.functionNames],
    destination: {
      kind: 'app',
      appId: 'musicscale',
      path: `/scales/${fact.entity.id}`
    },
    organizationId,
    evidence: [fact.source]
  }];
}
