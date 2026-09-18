import type { ReadOnlyHubAction } from './actionCenter.js';
import {
  scaleIdFromResolution,
  type ActionResolutionRecord,
  type MusicScaleResolutionProjectionReadiness
} from './actionResolution.js';

export type ActionOutcomeResult =
  | 'resolved'
  | 'superseded'
  | 'no_longer_actionable';

export type ActionOutcomeCode =
  | 'musicscale_pending_responses_cleared'
  | 'musicscale_declined_responses_cleared'
  | 'musicscale_repertoire_content_cleared'
  | 'source_signal_updated'
  | 'target_left_active_window';

export interface ActionOutcomeObservation {
  resolution: ActionResolutionRecord;
  result: ActionOutcomeResult;
  code: ActionOutcomeCode;
  targetId: string;
}

const RESOLVED_CODE_BY_SIGNAL: Record<
  ActionResolutionRecord['signalType'],
  ActionOutcomeCode
> = {
  musicscale_pending_responses:
    'musicscale_pending_responses_cleared',
  musicscale_declined_responses:
    'musicscale_declined_responses_cleared',
  musicscale_repertoire_content_gaps:
    'musicscale_repertoire_content_cleared'
};

function projectionReadyForCurrentTarget(
  resolution: ActionResolutionRecord,
  readiness: MusicScaleResolutionProjectionReadiness
): boolean {
  if (!readiness.scalesReady) return false;

  if (
    resolution.signalType ===
    'musicscale_repertoire_content_gaps'
  ) {
    return readiness.songsReady;
  }

  return readiness.responseSummaryAvailable;
}

/**
 * Outcome Engine v1.
 *
 * Absence alone is never treated as "resolved".
 * - same dedupe key + new fingerprint => the situation changed, so the old
 *   resolution is superseded while the new action stays independently actionable.
 * - target left the current operational window => no longer actionable, not resolved.
 * - only a complete current-target projection that no longer emits the signal
 *   becomes a factual resolved outcome.
 */
export function deriveActionOutcomeObservations(input: {
  resolutions: readonly ActionResolutionRecord[];
  sourceActions: readonly ReadOnlyHubAction[];
  musicScaleReadiness: MusicScaleResolutionProjectionReadiness;
}): ActionOutcomeObservation[] {
  const exactActive = new Set(
    input.sourceActions.map(
      action =>
        `${action.dedupeKey}\u0000${action.fingerprint}`
    )
  );

  const activeByDedupe = new Map(
    input.sourceActions.map(
      action => [action.dedupeKey, action]
    )
  );

  const outcomes: ActionOutcomeObservation[] = [];

  for (const resolution of input.resolutions) {
    if (
      resolution.status !== 'started' ||
      resolution.sourceApp !== 'musicscale'
    ) {
      continue;
    }

    const exactKey =
      `${resolution.dedupeKey}\u0000${resolution.fingerprint}`;

    if (exactActive.has(exactKey)) {
      continue;
    }

    const targetId =
      scaleIdFromResolution(resolution);

    if (!targetId) {
      continue;
    }

    const updatedSignal =
      activeByDedupe.get(resolution.dedupeKey);

    if (updatedSignal) {
      outcomes.push({
        resolution,
        result: 'superseded',
        code: 'source_signal_updated',
        targetId
      });
      continue;
    }

    if (!input.musicScaleReadiness.scalesReady) {
      continue;
    }

    if (
      input.musicScaleReadiness.nextScaleId !==
      targetId
    ) {
      outcomes.push({
        resolution,
        result: 'no_longer_actionable',
        code: 'target_left_active_window',
        targetId
      });
      continue;
    }

    if (
      !projectionReadyForCurrentTarget(
        resolution,
        input.musicScaleReadiness
      )
    ) {
      continue;
    }

    outcomes.push({
      resolution,
      result: 'resolved',
      code:
        RESOLVED_CODE_BY_SIGNAL[
          resolution.signalType
        ],
      targetId
    });
  }

  return outcomes;
}

export function isValidOutcomeForSignal(input: {
  signalType: ActionResolutionRecord['signalType'];
  result: ActionOutcomeResult;
  code: ActionOutcomeCode;
}): boolean {
  if (input.result === 'superseded') {
    return input.code === 'source_signal_updated';
  }

  if (
    input.result === 'no_longer_actionable'
  ) {
    return (
      input.code ===
      'target_left_active_window'
    );
  }

  return (
    input.result === 'resolved' &&
    RESOLVED_CODE_BY_SIGNAL[
      input.signalType
    ] === input.code
  );
}
