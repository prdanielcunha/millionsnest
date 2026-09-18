import type {
  ReadOnlyHubAction
} from './actionCenter.js';

export type ActionResolutionStatus =
  | 'started'
  | 'cleared_observed'
  | 'outcome_observed';

export type ActionResolutionOutcome =
  | 'signal_cleared'
  | 'resolved'
  | 'superseded'
  | 'no_longer_actionable';

export interface ActionResolutionRecord {
  organizationId: string;
  dedupeKey: string;
  fingerprint: string;
  sourceApp: 'musicscale';
  signalType:
    | 'musicscale_pending_responses'
    | 'musicscale_declined_responses'
    | 'musicscale_repertoire_content_gaps';
  status: ActionResolutionStatus;
  outcome?: ActionResolutionOutcome | null;
  outcomeCode?: string | null;
  startedAtMs?: number | null;
  updatedAtMs?: number | null;
  clearedObservedAtMs?: number | null;
  outcomeObservedAtMs?: number | null;
}

export interface MusicScaleResolutionProjectionReadiness {
  scalesReady: boolean;
  songsReady: boolean;
  nextScaleId: string | null;
  responseSummaryAvailable: boolean;
}

const RESOLVABLE_MUSICSCALE_SIGNALS = new Set<
  ActionResolutionRecord['signalType']
>([
  'musicscale_pending_responses',
  'musicscale_declined_responses',
  'musicscale_repertoire_content_gaps'
]);

const SCALE_DEDUPE_PREFIX_BY_SIGNAL: Record<
  ActionResolutionRecord['signalType'],
  string
> = {
  musicscale_pending_responses:
    'musicscale:pending_responses:',
  musicscale_declined_responses:
    'musicscale:declined_responses:',
  musicscale_repertoire_content_gaps:
    'musicscale:repertoire_content:'
};

function clean(value: unknown): string {
  return typeof value === 'string'
    ? value.trim()
    : '';
}

export function isActionResolutionEligible(
  action: ReadOnlyHubAction
): action is ReadOnlyHubAction & {
  sourceApp: 'musicscale';
  signalType: ActionResolutionRecord['signalType'];
} {
  return (
    action.sourceApp === 'musicscale' &&
    RESOLVABLE_MUSICSCALE_SIGNALS.has(
      action.signalType as ActionResolutionRecord['signalType']
    )
  );
}

export function resolutionMatchesAction(
  resolution: ActionResolutionRecord,
  action: ReadOnlyHubAction
): boolean {
  return (
    resolution.organizationId.trim().length > 0 &&
    resolution.status === 'started' &&
    resolution.sourceApp === action.sourceApp &&
    resolution.signalType === action.signalType &&
    resolution.dedupeKey === action.dedupeKey &&
    resolution.fingerprint === action.fingerprint
  );
}

export function scaleIdFromResolution(
  resolution: ActionResolutionRecord
): string | null {
  const prefix =
    SCALE_DEDUPE_PREFIX_BY_SIGNAL[resolution.signalType];

  if (!resolution.dedupeKey.startsWith(prefix)) {
    return null;
  }

  const value = clean(
    resolution.dedupeKey.slice(prefix.length)
  );

  return value || null;
}

/**
 * Determines whether the relevant source projection is complete enough for an
 * absent action to be interpreted as a factual outcome rather than bootstrap.
 */
export function isResolutionProjectionReady(
  resolution: ActionResolutionRecord,
  readiness: MusicScaleResolutionProjectionReadiness
): boolean {
  if (!readiness.scalesReady) return false;

  const resolutionScaleId =
    scaleIdFromResolution(resolution);

  if (!resolutionScaleId) return false;

  // Once schedules are loaded, a resolution tied to a scale that is no longer
  // the current actionable scale can safely be evaluated as absent.
  if (readiness.nextScaleId !== resolutionScaleId) {
    return true;
  }

  if (
    resolution.signalType ===
    'musicscale_repertoire_content_gaps'
  ) {
    return readiness.songsReady;
  }

  return readiness.responseSummaryAvailable;
}

export function deriveClearedActionResolutions(input: {
  resolutions: readonly ActionResolutionRecord[];
  sourceActions: readonly ReadOnlyHubAction[];
  musicScaleReadiness: MusicScaleResolutionProjectionReadiness;
}): ActionResolutionRecord[] {
  const activeActions = new Set(
    input.sourceActions.map(
      action =>
        `${action.dedupeKey}\u0000${action.fingerprint}`
    )
  );

  return input.resolutions.filter(resolution => {
    if (
      resolution.status !== 'started' ||
      resolution.sourceApp !== 'musicscale' ||
      !RESOLVABLE_MUSICSCALE_SIGNALS.has(
        resolution.signalType
      )
    ) {
      return false;
    }

    if (
      activeActions.has(
        `${resolution.dedupeKey}\u0000${resolution.fingerprint}`
      )
    ) {
      return false;
    }

    return isResolutionProjectionReady(
      resolution,
      input.musicScaleReadiness
    );
  });
}
