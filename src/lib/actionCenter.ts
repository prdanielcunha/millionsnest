import {
  collectActionSignals,
  collectEvidenceBackedActionSignals,
  type ActionSignalType,
  type EcosystemSignal,
  type EvidenceBackedEcosystemSignal
} from './actionSignals.js';
import {
  hasValidFactEvidence,
  type FactEvidenceReference
} from '../packages/events/factContract.js';

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

export interface EvidenceBackedReadOnlyHubAction extends ReadOnlyHubAction {
  organizationId: string;
  evidence: readonly FactEvidenceReference[];
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
    canReadManagedMusicScaleResponses?: boolean;
  };
  pendingInvitesCount: number;
  musicScale: {
    ready: boolean;
    observedAtMs?: number | null;
    nextScale: null | {
      id: string;
      startsAtMs?: number | null;
      responseSummaryAvailable: boolean;
      pendingResponses: number;
      pendingByFunction?: readonly {
        functionName: string;
        count: number;
      }[];
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

export interface EvidenceBackedActionProjectionInput extends ActionProjectionInput {
  organizationId: string;
}

function numberPayload(
  signal: EcosystemSignal,
  key: string
): number {
  const value = signal.payload[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function stringArrayPayload(
  signal: EcosystemSignal,
  key: string
): string[] {
  const value = signal.payload[key];
  if (!Array.isArray(value)) return [];

  return Array.from(new Set(
    value
      .filter((item): item is string => typeof item === 'string')
      .map(item => item.trim())
      .filter(Boolean)
  ));
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

    const pendingFunctions = stringArrayPayload(
      signal,
      'pendingFunctionNames'
    );
    const hasFunctionContext = pendingFunctions.length > 0;

    return {
      id: signal.dedupeKey,
      dedupeKey: signal.dedupeKey,
      fingerprint: signal.fingerprint,
      sourceApp: signal.sourceApp,
      signalType: signal.signalType,
      priority: 'high',
      titleKey: 'workspace.actions.musicscale_pending_responses.title',
      descriptionKey: hasFunctionContext
        ? 'workspace.actions.musicscale_pending_responses.description_with_functions'
        : 'workspace.actions.musicscale_pending_responses.description',
      translationParams: {
        count: pendingResponses,
        ...(hasFunctionContext
          ? { functions: pendingFunctions.join(' · ') }
          : {})
      },
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

function hasCoherentSignalEvidence(
  signal: EvidenceBackedEcosystemSignal
): boolean {
  if (!signal.organizationId.trim()) return false;
  if (!hasValidFactEvidence(signal.evidence, signal.organizationId)) return false;

  return signal.evidence.every(reference =>
    reference.sourceApp === signal.sourceApp &&
    reference.entityType === signal.sourceEntityType &&
    reference.entityId === signal.sourceEntityId
  );
}

/**
 * Strict evidence-first projection used by Church Intelligence OS adapters.
 * Invalid, missing or cross-tenant evidence fails closed before an action can
 * become a user-visible claim.
 */
export function projectEvidenceBackedSignalToAction(
  signal: EvidenceBackedEcosystemSignal,
  permissions: ActionProjectionInput['permissions']
): EvidenceBackedReadOnlyHubAction | null {
  if (!hasCoherentSignalEvidence(signal)) return null;

  // Managed MusicScale response summaries are ministry-level operational data.
  // The strict projector requires the explicit backend-projected capability;
  // ecosystem administration alone is not a substitute for domain authority.
  if (
    signal.signalType === 'musicscale_pending_responses' &&
    permissions.canReadManagedMusicScaleResponses !== true
  ) {
    return null;
  }

  const action = projectSignalToAction(signal, permissions);
  if (!action) return null;

  return {
    ...action,
    organizationId: signal.organizationId,
    evidence: signal.evidence
  };
}

function sortActions<TAction extends ReadOnlyHubAction>(actions: TAction[]): TAction[] {
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
 * Public Action OS projection for the Hub.
 *
 * This compatibility boundary preserves the currently shipped Hub while
 * evidence-backed adapters are migrated incrementally.
 */
export function deriveReadOnlyHubActions(input: ActionProjectionInput): ReadOnlyHubAction[] {
  const actions = collectActionSignals({
    organization: input.organization,
    pendingInvitesCount: input.pendingInvitesCount,
    musicScale: input.musicScale
  })
    .map(signal => projectSignalToAction(signal, input.permissions))
    .filter((action): action is ReadOnlyHubAction => action !== null);

  return sortActions(actions);
}

/**
 * Evidence-first Action OS projection.
 *
 * It reads the same already-loaded inputs as the legacy projection. The only
 * additional requirement is an explicit organizationId so tenant integrity can
 * be verified before a factual signal is shown to the user.
 */
export function deriveEvidenceBackedHubActions(
  input: EvidenceBackedActionProjectionInput
): EvidenceBackedReadOnlyHubAction[] {
  const actions = collectEvidenceBackedActionSignals({
    organizationId: input.organizationId,
    organization: input.organization,
    pendingInvitesCount: input.pendingInvitesCount,
    musicScale: input.musicScale
  })
    .map(signal => projectEvidenceBackedSignalToAction(signal, input.permissions))
    .filter((action): action is EvidenceBackedReadOnlyHubAction => action !== null);

  return sortActions(actions);
}

/**
 * Applies user-scoped interaction preferences without changing the source truth.
 *
 * A dismissed/snoozed action reappears when its fingerprint changes, so a
 * materially changed signal cannot remain hidden forever.
 */
export function applyActionPreferences<TAction extends ReadOnlyHubAction>(
  actions: TAction[],
  preferences: ActionPreference[],
  nowMs = Date.now()
): TAction[] {
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
