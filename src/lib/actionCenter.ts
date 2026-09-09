export type ActionPriority = 'low' | 'normal' | 'high' | 'urgent';

export type ActionDestination =
  | { kind: 'app'; appId: string; path?: string }
  | { kind: 'hub'; section: 'organization' | 'members' | 'billing' };

export type ActionPreferenceMode = 'snoozed' | 'dismissed';

export interface ReadOnlyHubAction {
  id: string;
  dedupeKey: string;
  fingerprint: string;
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

export interface ActionPreference {
  dedupeKey: string;
  fingerprint: string;
  mode: ActionPreferenceMode;
  snoozedUntilMs?: number | null;
  updatedAtMs?: number | null;
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
 * Action OS projection.
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
      fingerprint: 'hub:organization_incomplete:v1',
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
      fingerprint: `hub:pending_invites:${input.pendingInvitesCount}`,
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
      fingerprint: `musicscale:pending_responses:${nextScale.id}:${nextScale.pendingResponses}`,
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

/**
 * Applies user-scoped interaction preferences without changing the source truth.
 *
 * A dismissed/snoozed action reappears when its fingerprint changes, so a
 * materially changed signal cannot remain hidden forever.
 */
export function applyActionPreferences(
  actions: ReadOnlyHubAction[],
  preferences: ActionPreference[],
  nowMs = Date.now()
): ReadOnlyHubAction[] {
  const byKey = new Map(preferences.map(preference => [preference.dedupeKey, preference]));

  return actions.filter(action => {
    const preference = byKey.get(action.dedupeKey);
    if (!preference) return true;
    if (preference.fingerprint !== action.fingerprint) return true;

    if (preference.mode === 'dismissed') return false;

    if (preference.mode === 'snoozed') {
      const until = preference.snoozedUntilMs ?? 0;
      return until <= nowMs;
    }

    return true;
  });
}
