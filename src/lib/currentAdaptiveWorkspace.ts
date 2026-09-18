import type { MusicScaleAccessProjection } from './ecosystemAccessProjection.js';
import {
  buildAdaptiveWorkspaceModel,
  type AdaptiveWorkspaceModel
} from './adaptiveWorkspaceModel.js';
import type {
  ActionPreference,
  ActionProjectionInput
} from './actionCenter.js';
import { deriveCurrentHubLensAuthorization } from './hubLensAuthorization.js';
import type { HubLensId, HubResponsibility } from './lensResolver.js';
import type { HubAppExperience } from './hubAppExperience.js';
import { resolveEntitledAppIds } from './adaptiveEntitlements.js';

export interface CurrentAdaptiveWorkspaceInput {
  organizationId: string;
  systemRole?: string | null;
  responsibilities?: readonly HubResponsibility[];
  appExperiences: readonly HubAppExperience[];
  requestedLens?: HubLensId | string | null;
  canManageOrganization: boolean;
  canManageMembers: boolean;
  musicScaleAccess?: MusicScaleAccessProjection | null;
  organization?: ActionProjectionInput['organization'];
  pendingInvitesCount: number;
  musicScale: ActionProjectionInput['musicScale'];
  actionPreferences?: readonly ActionPreference[];
  nowMs?: number;
}

/**
 * Compatibility bridge from the currently shipped Hub authority projections to
 * the new Adaptive Command Center read model.
 *
 * It intentionally derives both Lens availability and strict source capability
 * from the same backend-authoritative MusicScale access projection so callers
 * cannot accidentally show a Lens while bypassing the corresponding action
 * permission check.
 */
export function buildCurrentAdaptiveWorkspace(
  input: CurrentAdaptiveWorkspaceInput
): AdaptiveWorkspaceModel {
  const resolvedEntitledAppIds = resolveEntitledAppIds(input.appExperiences);
  const entitledAppIds = resolvedEntitledAppIds.filter(appId => {
    if (appId !== 'musicscale') return true;

    return (
      input.musicScaleAccess?.accessible === true &&
      input.musicScaleAccess?.decisionState === 'granted'
    );
  });
  const authorizedDomains = deriveCurrentHubLensAuthorization({
    canManageOrganization: input.canManageOrganization,
    musicScaleAccess: input.musicScaleAccess
  });

  return buildAdaptiveWorkspaceModel({
    organizationId: input.organizationId,
    systemRole: input.systemRole,
    responsibilities: input.responsibilities,
    authorizedDomains,
    entitledAppIds,
    requestedLens: input.requestedLens,
    organization: input.organization,
    permissions: {
      canManageOrganization: input.canManageOrganization,
      canManageMembers: input.canManageMembers,
      canReadManagedMusicScaleResponses: authorizedDomains.worship === true
    },
    pendingInvitesCount: input.pendingInvitesCount,
    musicScale: input.musicScale,
    actionPreferences: input.actionPreferences,
    nowMs: input.nowMs
  });
}
