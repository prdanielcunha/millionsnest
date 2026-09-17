import {
  applyActionPreferences,
  deriveEvidenceBackedHubActions,
  type ActionPreference,
  type EvidenceBackedActionProjectionInput,
  type EvidenceBackedReadOnlyHubAction
} from './actionCenter.js';
import {
  resolveAvailableHubLenses,
  resolveDefaultHubLens,
  type HubLensAuthorizationProjection,
  type HubLensId,
  type HubResponsibility,
  type ResolvedHubLens
} from './lensResolver.js';
import { projectActionsForLens } from './lensActionProjection.js';

export interface AdaptiveWorkspaceModelInput extends EvidenceBackedActionProjectionInput {
  systemRole?: string | null;
  responsibilities?: readonly HubResponsibility[];
  authorizedDomains?: HubLensAuthorizationProjection;
  availableAppIds?: readonly string[];
  actionPreferences?: readonly ActionPreference[];
  nowMs?: number;
}

export interface AdaptiveWorkspaceModel {
  organizationId: string;
  lenses: readonly ResolvedHubLens[];
  defaultLens: HubLensId;
  actions: readonly EvidenceBackedReadOnlyHubAction[];
  actionsByLens: Readonly<Record<HubLensId, readonly EvidenceBackedReadOnlyHubAction[]>>;
}

const ALL_LENSES: readonly HubLensId[] = [
  'my_today',
  'pastoral',
  'journey',
  'worship',
  'finance',
  'administration'
];

function emptyActionsByLens(): Record<HubLensId, EvidenceBackedReadOnlyHubAction[]> {
  return {
    my_today: [],
    pastoral: [],
    journey: [],
    worship: [],
    finance: [],
    administration: []
  };
}

/**
 * Builds the permission-safe read model consumed by the future Adaptive Command
 * Center UI. Authorization and evidence checks happen before Lens projection.
 * Lenses can only narrow the resulting action set.
 */
export function buildAdaptiveWorkspaceModel(
  input: AdaptiveWorkspaceModelInput
): AdaptiveWorkspaceModel {
  const organizationId = input.organizationId.trim();
  const lenses = resolveAvailableHubLenses({
    systemRole: input.systemRole,
    responsibilities: input.responsibilities,
    authorizedDomains: input.authorizedDomains,
    availableAppIds: input.availableAppIds
  });
  const defaultLens = resolveDefaultHubLens(lenses);

  const projectedActions = organizationId
    ? deriveEvidenceBackedHubActions({
        organizationId,
        organization: input.organization,
        permissions: input.permissions,
        pendingInvitesCount: input.pendingInvitesCount,
        musicScale: input.musicScale
      })
    : [];

  const actions = applyActionPreferences(
    projectedActions,
    [...(input.actionPreferences ?? [])],
    input.nowMs
  );

  const availableLensIds = new Set(lenses.map(lens => lens.id));
  const actionsByLens = emptyActionsByLens();

  for (const lensId of ALL_LENSES) {
    if (!availableLensIds.has(lensId)) continue;
    actionsByLens[lensId] = projectActionsForLens(actions, lensId);
  }

  return {
    organizationId,
    lenses,
    defaultLens,
    actions,
    actionsByLens
  };
}
