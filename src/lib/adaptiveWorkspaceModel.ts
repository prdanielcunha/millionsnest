import {
  applyActionPreferences,
  deriveEvidenceBackedHubActions,
  type ActionPreference,
  type EvidenceBackedActionProjectionInput,
  type EvidenceBackedReadOnlyHubAction
} from './actionCenter.js';
import {
  resolveActiveHubLens,
  resolveAvailableHubLenses,
  resolveDefaultHubLens,
  type HubLensAuthorizationProjection,
  type HubLensId,
  type HubResponsibility,
  type ResolvedHubLens
} from './lensResolver.js';
import { projectActionsForLens } from './lensActionProjection.js';
import { filterActionsByAppEntitlement } from './adaptiveEntitlements.js';

export interface AdaptiveWorkspaceModelInput extends EvidenceBackedActionProjectionInput {
  systemRole?: string | null;
  responsibilities?: readonly HubResponsibility[];
  authorizedDomains?: HubLensAuthorizationProjection;
  entitledAppIds?: readonly string[];
  requestedLens?: HubLensId | string | null;
  actionPreferences?: readonly ActionPreference[];
  nowMs?: number;
}

export interface AdaptiveWorkspaceModel {
  organizationId: string;
  lenses: readonly ResolvedHubLens[];
  defaultLens: HubLensId;
  activeLens: HubLensId;
  actions: readonly EvidenceBackedReadOnlyHubAction[];
  actionsForActiveLens: readonly EvidenceBackedReadOnlyHubAction[];
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
    entitledAppIds: input.entitledAppIds
  });
  const defaultLens = resolveDefaultHubLens(lenses);
  const activeLens = resolveActiveHubLens(input.requestedLens, lenses);

  const projectedActions = organizationId
    ? filterActionsByAppEntitlement(
        deriveEvidenceBackedHubActions({
          organizationId,
          organization: input.organization,
          permissions: input.permissions,
          pendingInvitesCount: input.pendingInvitesCount,
          musicScale: input.musicScale
        }),
        input.entitledAppIds ?? []
      )
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
    activeLens,
    actions,
    actionsForActiveLens: actionsByLens[activeLens],
    actionsByLens
  };
}
