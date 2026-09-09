export type ActionOsLane =
  | 'action'
  | 'change'
  | 'commitment';

export type ActionOsDismissCode =
  | 'not_relevant'
  | 'already_handled'
  | 'not_my_responsibility'
  | 'too_early'
  | 'no_reason';

export type ActionOsInteractionKind =
  | 'action_opened'
  | 'action_snoozed'
  | 'action_dismissed'
  | 'change_reviewed'
  | 'commitment_opened';

export interface ActionOsInteractionInput {
  organizationId: string;
  userId: string;
  kind: ActionOsInteractionKind;
  lane: ActionOsLane;
  sourceApp: 'hub' | 'musicscale';
  signalType?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  dismissCode?: ActionOsDismissCode;
}

export interface ActionOsAnalyticsPayload {
  organizationId: string;
  userId: string;
  app: 'millionsnest_core';
  metadata: {
    action: ActionOsInteractionKind;
    lane: ActionOsLane;
    sourceApp: 'hub' | 'musicscale';
    signalType?: string;
    priority?: 'low' | 'normal' | 'high' | 'urgent';
    dismissCode?: ActionOsDismissCode;
  };
}

const SAFE_SIGNAL = /^[a-z0-9_:-]{1,80}$/;
const SAFE_DISMISS_CODES = new Set<ActionOsDismissCode>([
  'not_relevant',
  'already_handled',
  'not_my_responsibility',
  'too_early',
  'no_reason',
]);

function safeSignalType(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  return SAFE_SIGNAL.test(normalized) ? normalized : undefined;
}

/**
 * Pilot analytics deliberately excludes entity IDs, titles, names, message
 * bodies, free text, financial values and pastoral content.
 */
export function buildActionOsAnalyticsPayload(
  input: ActionOsInteractionInput
): ActionOsAnalyticsPayload | null {
  const organizationId = input.organizationId?.trim();
  const userId = input.userId?.trim();

  if (!organizationId || !userId) return null;

  const signalType = safeSignalType(input.signalType);
  const dismissCode =
    input.kind === 'action_dismissed' &&
    input.dismissCode &&
    SAFE_DISMISS_CODES.has(input.dismissCode)
      ? input.dismissCode
      : undefined;

  return {
    organizationId,
    userId,
    app: 'millionsnest_core',
    metadata: {
      action: input.kind,
      lane: input.lane,
      sourceApp: input.sourceApp,
      ...(signalType ? { signalType } : {}),
      ...(input.priority ? { priority: input.priority } : {}),
      ...(dismissCode ? { dismissCode } : {}),
    },
  };
}

export function trackActionOsInteraction(
  input: ActionOsInteractionInput
): void {
  const payload = buildActionOsAnalyticsPayload(input);
  if (!payload) return;

  // Keep the pure privacy policy importable in Node/CI without initializing
  // Firebase. In the browser this module is already warm through Dashboard,
  // so the dynamic import resolves from the module cache.
  void import('./analytics.js')
    .then(({ analytics }) => {
      analytics.track('action_os_interaction', {
        organizationId: payload.organizationId,
        userId: payload.userId,
        app: payload.app,
        metadata: payload.metadata,
      });
    })
    .catch(() => {
      // Pilot telemetry must never interrupt the product experience.
    });
}
