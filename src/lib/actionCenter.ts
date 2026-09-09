export type ActionPriority = 'low' | 'normal' | 'high' | 'urgent';

export type ActionDestination =
  | { kind: 'app'; appId: string; path?: string }
  | { kind: 'hub'; section: 'organization' | 'members' | 'billing' };

export interface ReadOnlyHubAction {
  id: string;
  dedupeKey: string;
  sourceApp: 'hub' | 'musicscale';
  signalType:
    | 'organization_incomplete'
    | 'pending_invites'
    | 'musicscale_pending_responses';
  priority: ActionPriority;
  titleKey: string;
  descriptionKey: string;
  translationParams?: Record<string, string | number>;
  destination: ActionDestination;
  dueAtMs?: number | null;
  createdAtMs?: number | null;
}

export interface ActionProjectionInput {
  organization?: {
    isConfigured: boolean;
  } | null;
  permissions: {
    canManageOrganization: boolean;
    canManageMembers: boolean;
  };
  pendingInvitesCount: number;
  musicScale: {
    ready: boolean;
    nextScale: null | {
      id: string;
      startsAtMs?: number | null;
      responseSummaryAvailable: boolean;
      pendingResponses: number;
    };
  };
}

/**
 * Slice 1 Action OS projection.
 *
 * Pure and read-only by design:
 * - no Firestore writes
 * - no billing/auth/RBAC mutations
 * - no AI dependency
 * - deterministic output for the same input
 */
export function deriveReadOnlyHubActions(input: ActionProjectionInput): ReadOnlyHubAction[] {
  const actions: ReadOnlyHubAction[] = [];

  const organizationIncomplete = !input.organization?.isConfigured;

  if (organizationIncomplete && input.permissions.canManageOrganization) {
    actions.push({
      id: 'hub:organization_incomplete',
      dedupeKey: 'hub:organization_incomplete',
      sourceApp: 'hub',
      signalType: 'organization_incomplete',
      priority: 'high',
      titleKey: 'workspace.actions.organization_incomplete.title',
      descriptionKey: 'workspace.actions.organization_incomplete.description',
      destination: { kind: 'hub', section: 'organization' }
    });
  }

  if (input.pendingInvitesCount > 0 && input.permissions.canManageMembers) {
    actions.push({
      id: 'hub:pending_invites',
      dedupeKey: 'hub:pending_invites',
      sourceApp: 'hub',
      signalType: 'pending_invites',
      priority: 'normal',
      titleKey: 'workspace.actions.pending_invites.title',
      descriptionKey: 'workspace.actions.pending_invites.description',
      translationParams: { count: input.pendingInvitesCount },
      destination: { kind: 'hub', section: 'members' }
    });
  }

  const nextScale = input.musicScale.nextScale;
  if (
    input.musicScale.ready &&
    nextScale?.responseSummaryAvailable === true &&
    nextScale.pendingResponses > 0
  ) {
    actions.push({
      id: `musicscale:pending_responses:${nextScale.id}`,
      dedupeKey: `musicscale:pending_responses:${nextScale.id}`,
      sourceApp: 'musicscale',
      signalType: 'musicscale_pending_responses',
      priority: 'high',
      titleKey: 'workspace.actions.musicscale_pending_responses.title',
      descriptionKey: 'workspace.actions.musicscale_pending_responses.description',
      translationParams: { count: nextScale.pendingResponses },
      destination: { kind: 'app', appId: 'musicscale', path: `/scales/${nextScale.id}` },
      dueAtMs: nextScale.startsAtMs ?? null
    });
  }

  const rank: Record<ActionPriority, number> = {
    urgent: 4,
    high: 3,
    normal: 2,
    low: 1
  };

  return actions.sort((a, b) => {
    const priorityDelta = rank[b.priority] - rank[a.priority];
    if (priorityDelta !== 0) return priorityDelta;

    const aDue = a.dueAtMs ?? Number.POSITIVE_INFINITY;
    const bDue = b.dueAtMs ?? Number.POSITIVE_INFINITY;
    if (aDue !== bDue) return aDue - bDue;

    return a.dedupeKey.localeCompare(b.dedupeKey);
  });
}
