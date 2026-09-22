import type {
  ActionResolutionReadWindow,
  ActionResolutionRecord
} from './actionResolution.js';
import type { HubLensId } from './lensResolver.js';

const WINDOW_DAYS = 7;
const WINDOW_MS =
  WINDOW_DAYS * 24 * 60 * 60 * 1000;

export interface ActionOutcomePulseSnapshot {
  organizationId: string;
  windowDays: number;
  observedAtMs: number;
  complete: boolean;
  readLimit: number;
  totalObservedCount: number;
  resolvedCount: number;
  supersededCount: number;
  noLongerActionableCount: number;
  musicScaleCount: number;
  nestJourneyCount: number;
  latestOutcomeAtMs: number;
}

function clean(value: unknown): string {
  return typeof value === 'string'
    ? value.trim()
    : '';
}

function sourceAllowedForLens(
  lens: HubLensId,
  sourceApp: ActionResolutionRecord['sourceApp']
): boolean {
  if (lens === 'my_today') {
    return true;
  }

  if (lens === 'journey') {
    return sourceApp === 'nestjourney';
  }

  if (lens === 'worship') {
    return sourceApp === 'musicscale';
  }

  return false;
}

function validOutcome(
  value: ActionResolutionRecord['outcome']
): value is
  | 'resolved'
  | 'superseded'
  | 'no_longer_actionable' {
  return (
    value === 'resolved' ||
    value === 'superseded' ||
    value === 'no_longer_actionable'
  );
}

export function deriveActionOutcomePulse(
  input: {
    organizationId: string;
    activeLens: HubLensId;
    resolutions:
      readonly ActionResolutionRecord[];
    readWindow:
      | ActionResolutionReadWindow
      | null
      | undefined;
    nowMs?: number;
  }
): ActionOutcomePulseSnapshot | null {
  const organizationId =
    clean(input.organizationId);

  if (
    !organizationId ||
    !['my_today', 'journey', 'worship'].includes(
      input.activeLens
    ) ||
    !input.readWindow
  ) {
    return null;
  }

  const readObservedAtMs =
    typeof input.readWindow.observedAtMs ===
      'number' &&
    Number.isFinite(
      input.readWindow.observedAtMs
    )
      ? input.readWindow.observedAtMs
      : null;
  const nowMs =
    typeof input.nowMs === 'number' &&
    Number.isFinite(input.nowMs)
      ? input.nowMs
      : readObservedAtMs ?? Date.now();
  const windowStartMs =
    nowMs - WINDOW_MS;

  const outcomes = input.resolutions
    .filter(resolution => {
      if (
        resolution.organizationId !==
          organizationId ||
        resolution.status !==
          'outcome_observed' ||
        !validOutcome(resolution.outcome) ||
        !sourceAllowedForLens(
          input.activeLens,
          resolution.sourceApp
        )
      ) {
        return false;
      }

      const observedAtMs =
        resolution.outcomeObservedAtMs;

      return (
        typeof observedAtMs === 'number' &&
        Number.isFinite(observedAtMs) &&
        observedAtMs >= windowStartMs &&
        observedAtMs <= nowMs
      );
    });

  if (outcomes.length === 0) {
    return null;
  }

  const resolvedCount = outcomes.filter(
    resolution =>
      resolution.outcome === 'resolved'
  ).length;
  const supersededCount = outcomes.filter(
    resolution =>
      resolution.outcome === 'superseded'
  ).length;
  const noLongerActionableCount =
    outcomes.filter(
      resolution =>
        resolution.outcome ===
        'no_longer_actionable'
    ).length;
  const musicScaleCount = outcomes.filter(
    resolution =>
      resolution.sourceApp === 'musicscale'
  ).length;
  const nestJourneyCount = outcomes.filter(
    resolution =>
      resolution.sourceApp === 'nestjourney'
  ).length;
  const latestOutcomeAtMs = Math.max(
    ...outcomes.map(
      resolution =>
        resolution.outcomeObservedAtMs as number
    )
  );

  return {
    organizationId,
    windowDays: WINDOW_DAYS,
    observedAtMs: nowMs,
    complete:
      input.readWindow.complete === true,
    readLimit:
      typeof input.readWindow.limit ===
        'number' &&
      Number.isFinite(input.readWindow.limit) &&
      input.readWindow.limit > 0
        ? input.readWindow.limit
        : outcomes.length,
    totalObservedCount: outcomes.length,
    resolvedCount,
    supersededCount,
    noLongerActionableCount,
    musicScaleCount,
    nestJourneyCount,
    latestOutcomeAtMs
  };
}
