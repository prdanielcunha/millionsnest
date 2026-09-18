import {
  sortActionsForActionCenter,
  type ReadOnlyHubAction
} from './actionCenter.js';
import {
  resolutionMatchesAction,
  type ActionResolutionRecord
} from './actionResolution.js';

export type NextBestMinistryActionReason =
  | 'continue_resolution'
  | 'urgent_priority'
  | 'high_priority'
  | 'due_soon'
  | 'next_in_queue';

export interface NextBestMinistryAction {
  action: ReadOnlyHubAction;
  reason: NextBestMinistryActionReason;
}

/**
 * Deterministic and explainable NBMA v1.
 *
 * Inputs are actions that already passed:
 * evidence -> authorization -> entitlement -> Lens -> personal preferences.
 *
 * It never invents a score. Canonical Action Center order remains authoritative:
 * priority -> due time -> stable dedupe key.
 *
 * Continuity rule:
 * if there is a started resolution among actions with the SAME canonical
 * priority as the top action, continue that work first. A lower-priority
 * in-progress item never outranks a higher-priority action.
 */
export function selectNextBestMinistryAction(input: {
  actions: readonly ReadOnlyHubAction[];
  resolutions?: readonly ActionResolutionRecord[];
  nowMs?: number;
}): NextBestMinistryAction | null {
  if (input.actions.length === 0) return null;

  const ordered = sortActionsForActionCenter([
    ...input.actions
  ]);

  const canonicalFirst = ordered[0];
  if (!canonicalFirst) return null;

  const samePriority = ordered.filter(
    action => action.priority === canonicalFirst.priority
  );

  const startedAtSamePriority = samePriority.find(
    action =>
      input.resolutions?.some(
        resolution =>
          resolutionMatchesAction(resolution, action)
      ) === true
  );

  const action =
    startedAtSamePriority ?? canonicalFirst;

  if (startedAtSamePriority) {
    return {
      action,
      reason: 'continue_resolution'
    };
  }

  if (action.priority === 'urgent') {
    return {
      action,
      reason: 'urgent_priority'
    };
  }

  if (action.priority === 'high') {
    return {
      action,
      reason: 'high_priority'
    };
  }

  const nowMs =
    typeof input.nowMs === 'number' &&
    Number.isFinite(input.nowMs)
      ? input.nowMs
      : Date.now();

  if (
    typeof action.dueAtMs === 'number' &&
    Number.isFinite(action.dueAtMs) &&
    action.dueAtMs <=
      nowMs + 24 * 60 * 60 * 1000
  ) {
    return {
      action,
      reason: 'due_soon'
    };
  }

  return {
    action,
    reason: 'next_in_queue'
  };
}
