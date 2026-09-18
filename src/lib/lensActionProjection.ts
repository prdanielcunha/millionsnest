import type { EvidenceBackedReadOnlyHubAction } from './actionCenter.js';
import type { HubLensId } from './lensResolver.js';

/**
 * Lenses are presentation filters over actions that have already passed source,
 * tenant and permission checks. This projection can only remove actions; it
 * never synthesizes or grants a new one.
 */
export function projectActionsForLens<TAction extends EvidenceBackedReadOnlyHubAction>(
  actions: readonly TAction[],
  lensId: HubLensId
): TAction[] {
  if (lensId === 'my_today') return [...actions];

  if (lensId === 'administration') {
    return actions.filter(action => action.sourceApp === 'hub');
  }

  if (lensId === 'worship') {
    return actions.filter(action => action.sourceApp === 'musicscale');
  }

  // Pastoral, Journey and Finance intentionally expose no actions until their
  // owning domains provide canonical evidence-backed action sources.
  return [];
}
