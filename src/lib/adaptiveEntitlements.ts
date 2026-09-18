import type { HubAppExperience } from './hubAppExperience.js';
import type { EvidenceBackedReadOnlyHubAction } from './actionCenter.js';

export function resolveEntitledAppIds(
  experiences: readonly HubAppExperience[]
): string[] {
  return Array.from(
    new Set(
      experiences
        .filter(experience =>
          experience.installed === true &&
          experience.canOpen === true &&
          experience.isOperational === true
        )
        .map(experience => experience.app.id)
        .filter(appId => typeof appId === 'string' && appId.trim().length > 0)
    )
  );
}

/**
 * Hub-owned actions are always part of the central product. App-owned actions
 * require the corresponding product entitlement for the current organization
 * and user session before they can enter My Today or any domain Lens.
 */
export function filterActionsByAppEntitlement<
  TAction extends EvidenceBackedReadOnlyHubAction
>(
  actions: readonly TAction[],
  entitledAppIds: readonly string[]
): TAction[] {
  const entitled = new Set(entitledAppIds);

  return actions.filter(action =>
    action.sourceApp === 'hub' || entitled.has(action.sourceApp)
  );
}
