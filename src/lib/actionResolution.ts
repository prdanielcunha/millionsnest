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

export type ResolvableMusicScaleSignal =
  | 'musicscale_pending_responses'
  | 'musicscale_declined_responses'
  | 'musicscale_repertoire_content_gaps';

export type ResolvableNestJourneySignal =
  | 'nestjourney_assigned_first_contacts'
  | 'nestjourney_unassigned_first_contacts';

export type ResolvableActionSignal =
  | ResolvableMusicScaleSignal
  | ResolvableNestJourneySignal;

export interface ActionResolutionRecord {
  organizationId: string;
  dedupeKey: string;
  fingerprint: string;
  sourceApp: 'musicscale' | 'nestjourney';
  signalType: ResolvableActionSignal;
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

export interface NestJourneyResolutionProjectionReadiness {
  ready: boolean;
}

const RESOLVABLE_MUSICSCALE_SIGNALS = new Set<ResolvableMusicScaleSignal>([
  'musicscale_pending_responses',
  'musicscale_declined_responses',
  'musicscale_repertoire_content_gaps'
]);

const RESOLVABLE_NESTJOURNEY_SIGNALS = new Set<ResolvableNestJourneySignal>([
  'nestjourney_assigned_first_contacts',
  'nestjourney_unassigned_first_contacts'
]);

const SCALE_DEDUPE_PREFIX_BY_SIGNAL: Record<
  ResolvableMusicScaleSignal,
  string
> = {
  musicscale_pending_responses:
    'musicscale:pending_responses:',
  musicscale_declined_responses:
    'musicscale:declined_responses:',
  musicscale_repertoire_content_gaps:
    'musicscale:repertoire_content:'
};

const JOURNEY_DEDUPE_PREFIX_BY_SIGNAL: Record<
  ResolvableNestJourneySignal,
  string
> = {
  nestjourney_assigned_first_contacts:
    'nestjourney:nestjourney_assigned_first_contacts:',
  nestjourney_unassigned_first_contacts:
    'nestjourney:nestjourney_unassigned_first_contacts:'
};

function clean(value: unknown): string {
  return typeof value === 'string'
    ? value.trim()
    : '';
}

export function isResolutionSourceSignalPair(input: {
  sourceApp: unknown;
  signalType: unknown;
}): input is {
  sourceApp: ActionResolutionRecord['sourceApp'];
  signalType: ResolvableActionSignal;
} {
  if (
    input.sourceApp === 'musicscale' &&
    RESOLVABLE_MUSICSCALE_SIGNALS.has(
      input.signalType as ResolvableMusicScaleSignal
    )
  ) {
    return true;
  }

  return (
    input.sourceApp === 'nestjourney' &&
    RESOLVABLE_NESTJOURNEY_SIGNALS.has(
      input.signalType as ResolvableNestJourneySignal
    )
  );
}

export function isActionResolutionEligible(
  action: ReadOnlyHubAction
): action is ReadOnlyHubAction & {
  sourceApp: ActionResolutionRecord['sourceApp'];
  signalType: ResolvableActionSignal;
} {
  return isResolutionSourceSignalPair(action);
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
  if (
    resolution.sourceApp !== 'musicscale' ||
    !RESOLVABLE_MUSICSCALE_SIGNALS.has(
      resolution.signalType as ResolvableMusicScaleSignal
    )
  ) {
    return null;
  }

  const prefix =
    SCALE_DEDUPE_PREFIX_BY_SIGNAL[
      resolution.signalType as ResolvableMusicScaleSignal
    ];

  if (!resolution.dedupeKey.startsWith(prefix)) {
    return null;
  }

  const value = clean(
    resolution.dedupeKey.slice(prefix.length)
  );

  return value || null;
}

export function journeyQueueIdFromResolution(
  resolution: ActionResolutionRecord
): string | null {
  if (
    resolution.sourceApp !== 'nestjourney' ||
    !RESOLVABLE_NESTJOURNEY_SIGNALS.has(
      resolution.signalType as ResolvableNestJourneySignal
    )
  ) {
    return null;
  }

  const prefix =
    JOURNEY_DEDUPE_PREFIX_BY_SIGNAL[
      resolution.signalType as ResolvableNestJourneySignal
    ];

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
  readiness: MusicScaleResolutionProjectionReadiness,
  journeyReadiness: NestJourneyResolutionProjectionReadiness = {
    ready: false
  }
): boolean {
  if (resolution.sourceApp === 'nestjourney') {
    return (
      journeyReadiness.ready === true &&
      journeyQueueIdFromResolution(resolution) !== null
    );
  }

  if (resolution.sourceApp !== 'musicscale') {
    return false;
  }

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
  journeyReadiness?: NestJourneyResolutionProjectionReadiness;
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
      !isResolutionSourceSignalPair(resolution)
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
      input.musicScaleReadiness,
      input.journeyReadiness
    );
  });
}
