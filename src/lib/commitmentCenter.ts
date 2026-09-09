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
