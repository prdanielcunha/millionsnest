import {
  collectActionSignals,
  type ActionSignalType,
  type EcosystemSignal
} from './actionSignals.js';

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
  signalType: ActionSignalType;
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
    nextPersonalScale?: null | {
      id: string;
      startsAtMs?: number | null;
      publishRevision?: number | null;
      responseSummaryAvailable: boolean;
      pendingResponses: number;
    };
  };
}

function numberPayload(
  signal: EcosystemSignal,
  key: string
): number {
  const value = signal.payload[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/**
 * Deterministic policy layer: normalized facts become user-visible actions only
 * after permission and payload checks.
 */
export function projectSignalToAction(
  signal: EcosystemSignal,
  permissions: ActionProjectionInput['permissions']
): ReadOnlyHubAction | null {
  if (signal.signalType === 'organization_incomplete') {
    if (!permissions.canManageOrganization) return null;
    return {
      id: signal.dedupeKey,
      dedupeKey: signal.dedupeKey,
      fingerprint: signal.fingerprint,
      sourceApp: signal.sourceApp,
      signalType: signal.signalType,
      priority: 'high',
      titleKey: 'workspace.actions.organization_incomplete.title',
      descriptionKey: 'workspace.actions.organization_incomplete.description',
      destination: { kind: 'hub', section: 'organization' }
    };
  }

  if (signal.signalType === 'pending_invites') {
    if (!permissions.canManageMembers) return null;
    const count = numberPayload(signal, 'count');
    if (count <= 0) return null;

    return {
      id: signal.dedupeKey,
      dedupeKey: signal.dedupeKey,
      fingerprint: signal.fingerprint,
      sourceApp: signal.sourceApp,
      signalType: signal.signalType,
      priority: 'normal',
      titleKey: 'workspace.actions.pending_invites.title',
      descriptionKey: 'workspace.actions.pending_invites.description',
      translationParams: { count },
      destination: { kind: 'hub', section: 'members' }
    };
  }

  if (signal.signalType === 'musicscale_personal_confirmation') {
    const pendingResponses = numberPayload(signal, 'pendingResponses');
    if (pendingResponses <= 0 || signal.sourceEntityType !== 'scale') return null;

    return {
      id: signal.dedupeKey,
      dedupeKey: signal.dedupeKey,
      fingerprint: signal.fingerprint,
      sourceApp: signal.sourceApp,
      signalType: signal.signalType,
      priority: 'high',
      titleKey: 'workspace.actions.musicscale_personal_confirmation.title',
      descriptionKey: 'workspace.actions.musicscale_personal_confirmation.description',
      translationParams: { count: pendingResponses },
      destination: {
        kind: 'app',
        appId: 'musicscale',
        path: `/scales/${signal.sourceEntityId}`
      },
      dueAtMs: signal.occurredAtMs ?? null
    };
  }

  if (signal.signalType === 'musicscale_pending_responses') {
    const pendingResponses = numberPayload(signal, 'pendingResponses');
    if (pendingResponses <= 0 || signal.sourceEntityType !== 'scale') return null;

    return {
      id: signal.dedupeKey,
      dedupeKey: signal.dedupeKey,
      fingerprint: signal.fingerprint,
      sourceApp: signal.sourceApp,
      signalType: signal.signalType,
      priority: 'high',
      titleKey: 'workspace.actions.musicscale_pending_responses.title',
      descriptionKey: 'workspace.actions.musicscale_pending_responses.description',
      translationParams: { count: pendingResponses },
      destination: {
        kind: 'app',
        appId: 'musicscale',
        path: `/scales/${signal.sourceEntityId}`
      },
      dueAtMs: signal.occurredAtMs ?? null
    };
  }

  return null;
}

/**
 * Public Action OS projection for the Hub.
 *
 * Source facts are collected first; policy and permission logic are applied
 * separately. This boundary lets NestJourney, Connect and future apps add
 * adapters without teaching the Hub UI about each product.
 */
export function deriveReadOnlyHubActions(input: ActionProjectionInput): ReadOnlyHubAction[] {
  const actions = collectActionSignals({
    organization: input.organization,
    pendingInvitesCount: input.pendingInvitesCount,
    musicScale: input.musicScale
  })
    .map(signal => projectSignalToAction(signal, input.permissions))
    .filter((action): action is ReadOnlyHubAction => action !== null);

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
