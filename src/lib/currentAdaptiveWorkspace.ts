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

export interface CurrentAdaptiveWorkspaceInput {
  organizationId: string;
  systemRole?: string | null;
  responsibilities?: readonly HubResponsibility[];
  availableAppIds?: readonly string[];
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
  const authorizedDomains = deriveCurrentHubLensAuthorization({
    canManageOrganization: input.canManageOrganization,
    musicScaleAccess: input.musicScaleAccess
  });

  return buildAdaptiveWorkspaceModel({
    organizationId: input.organizationId,
    systemRole: input.systemRole,
    responsibilities: input.responsibilities,
    authorizedDomains,
    availableAppIds: input.availableAppIds,
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
