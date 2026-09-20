import {
  buildAdaptiveWorkspaceModel,
  type AdaptiveWorkspaceModel
} from './adaptiveWorkspaceModel.js';
import type {
  ActionPreference,
  ActionProjectionInput
} from './actionCenter.js';
import type {
  CurrentMusicScaleLensAuthority,
  CurrentNestJourneyLensAuthority
} from './hubLensAuthorization.js';
import { buildCurrentContextGraph } from './currentContextGraph.js';
import type { HubLensId, HubResponsibility } from './lensResolver.js';
import type { HubAppExperience } from './hubAppExperience.js';

export interface CurrentAdaptiveWorkspaceInput {
  organizationId: string;
  systemRole?: string | null;
  responsibilities?: readonly HubResponsibility[];
  appExperiences: readonly HubAppExperience[];
  requestedLens?: HubLensId | string | null;
  canManageOrganization: boolean;
  canManageMembers: boolean;
  musicScaleAccess?: CurrentMusicScaleLensAuthority | null;
  nestJourneyAccess?: CurrentNestJourneyLensAuthority | null;
  organization?: ActionProjectionInput['organization'];
  pendingInvitesCount: number;
  journey?: ActionProjectionInput['journey'];
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
  const contextGraph = buildCurrentContextGraph({
    organizationId: input.organizationId,
    appExperiences: input.appExperiences,
    canManageOrganization: input.canManageOrganization,
    musicScaleAccess: input.musicScaleAccess,
    nestJourneyAccess: input.nestJourneyAccess
  });

  return buildAdaptiveWorkspaceModel({
    organizationId: input.organizationId,
    systemRole: input.systemRole,
    responsibilities: input.responsibilities ?? contextGraph.responsibilities,
    authorizedDomains: contextGraph.authorizedDomains,
    entitledAppIds: contextGraph.entitledAppIds,
    requestedLens: input.requestedLens,
    organization: input.organization,
    permissions: {
      canManageOrganization: input.canManageOrganization,
      canManageMembers: input.canManageMembers,
      canReadManagedMusicScaleResponses:
        contextGraph.authorizedDomains.worship === true,
      canReadJourneyOperational:
        contextGraph.authorizedDomains.journey === true
    },
    pendingInvitesCount: input.pendingInvitesCount,
    journey: input.journey,
    musicScale: input.musicScale,
    actionPreferences: input.actionPreferences,
    nowMs: input.nowMs
  });
}
