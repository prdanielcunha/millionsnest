export const GROWTH_FUNNEL_STEPS = [
  'home_view',
  'musicscale_interest',
  'sales_landing',
  'plan_choice',
  'signup',
  'checkout_started',
  'checkout_completed',
] as const;

export type GrowthFunnelStepKey = typeof GROWTH_FUNNEL_STEPS[number];

export interface GrowthAnalyticsEvent {
  id?: string;
  eventType?: string;
  app?: string;
  sessionId?: string;
  userId?: string;
  organizationId?: string;
  metadata?: Record<string, unknown>;
  timestampMs?: number;
}

export interface GrowthFunnelStep {
  key: GrowthFunnelStepKey;
  label: string;
  sessions: number;
  reachedFromPrevious: number | null;
  conversionFromPrevious: number | null;
}

export interface GrowthSourceBreakdown {
  source: string;
  sessions: number;
  events: number;
}

export interface GrowthSummary {
  windowDays: number;
  eventsScanned: number;
  growthEventsMatched: number;
  funnel: GrowthFunnelStep[];
  sourceBreakdown: GrowthSourceBreakdown[];
  sameSessionHomeToCheckout: {
    sessions: number;
    conversion: number | null;
  };
}

const STEP_LABELS: Record<GrowthFunnelStepKey, string> = {
  home_view: 'Home MillionsNest',
  musicscale_interest: 'Interesse no MusicScale',
  sales_landing: 'Landing do MusicScale',
  plan_choice: 'Escolha de plano',
  signup: 'Cadastro criado',
  checkout_started: 'Checkout iniciado',
  checkout_completed: 'Checkout concluído',
};

function identityFor(event: GrowthAnalyticsEvent): string | null {
  if (typeof event.sessionId === 'string' && event.sessionId.trim()) {
    return `session:${event.sessionId.trim()}`;
  }
  if (typeof event.userId === 'string' && event.userId !== 'none' && event.userId.trim()) {
    return `user:${event.userId.trim()}`;
  }
  if (
    typeof event.organizationId === 'string' &&
    event.organizationId !== 'none' &&
    event.organizationId.trim()
  ) {
    return `org:${event.organizationId.trim()}`;
  }
  return null;
}

function matchesStep(event: GrowthAnalyticsEvent, key: GrowthFunnelStepKey): boolean {
  const metadata = event.metadata || {};

  switch (key) {
    case 'home_view':
      return (
        event.eventType === 'page_view' &&
        event.app === 'millionsnest_core' &&
        metadata.page === 'home'
      );
    case 'musicscale_interest':
      return (
        event.eventType === 'app_usage' &&
        event.app === 'millionsnest_core' &&
        metadata.action === 'product_interest' &&
        metadata.product === 'musicscale'
      );
    case 'sales_landing':
      return (
        event.eventType === 'page_view' &&
        event.app === 'musicscale' &&
        metadata.page === 'sales_landing'
      );
    case 'plan_choice':
      return (
        event.eventType === 'trial_cta_clicked' &&
        event.app === 'musicscale' &&
        metadata.action === 'choose_plan'
      );
    case 'signup':
      return event.eventType === 'signup';
    case 'checkout_started':
      return event.eventType === 'checkout_started' && event.app === 'musicscale';
    case 'checkout_completed':
      return event.eventType === 'checkout_completed' && event.app === 'musicscale';
    default:
      return false;
  }
}

function intersectSize(a: Set<string>, b: Set<string>): number {
  let count = 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  for (const value of small) if (large.has(value)) count++;
  return count;
}

export function summarizeGrowthEvents(
  events: GrowthAnalyticsEvent[],
  windowDays: number,
): GrowthSummary {
  const sets = new Map<GrowthFunnelStepKey, Set<string>>();
  for (const key of GROWTH_FUNNEL_STEPS) sets.set(key, new Set());

  const sourceEvents = new Map<string, number>();
  const sourceSessions = new Map<string, Set<string>>();
  let growthEventsMatched = 0;

  for (const event of events) {
    const identity = identityFor(event);
    let matchedAny = false;

    for (const key of GROWTH_FUNNEL_STEPS) {
      if (!matchesStep(event, key)) continue;
      matchedAny = true;
      if (identity) sets.get(key)!.add(identity);

      if (key === 'musicscale_interest') {
        const source = String(event.metadata?.source || 'unknown');
        sourceEvents.set(source, (sourceEvents.get(source) || 0) + 1);
        if (!sourceSessions.has(source)) sourceSessions.set(source, new Set());
        if (identity) sourceSessions.get(source)!.add(identity);
      }
    }

    if (matchedAny) growthEventsMatched++;
  }

  const funnel: GrowthFunnelStep[] = GROWTH_FUNNEL_STEPS.map((key, index) => {
    const current = sets.get(key)!;
    if (index === 0) {
      return {
        key,
        label: STEP_LABELS[key],
        sessions: current.size,
        reachedFromPrevious: null,
        conversionFromPrevious: null,
      };
    }

    const previous = sets.get(GROWTH_FUNNEL_STEPS[index - 1])!;
    const reached = intersectSize(previous, current);
    return {
      key,
      label: STEP_LABELS[key],
      sessions: current.size,
      reachedFromPrevious: reached,
      conversionFromPrevious:
        previous.size > 0 ? Math.round((reached / previous.size) * 1000) / 10 : null,
    };
  });

  const sourceBreakdown = [...sourceEvents.entries()]
    .map(([source, count]) => ({
      source,
      events: count,
      sessions: sourceSessions.get(source)?.size || 0,
    }))
    .sort((a, b) => b.sessions - a.sessions || b.events - a.events);

  const home = sets.get('home_view')!;
  const checkout = sets.get('checkout_completed')!;
  const sameSessionHomeToCheckoutCount = intersectSize(home, checkout);

  return {
    windowDays,
    eventsScanned: events.length,
    growthEventsMatched,
    funnel,
    sourceBreakdown,
    sameSessionHomeToCheckout: {
      sessions: sameSessionHomeToCheckoutCount,
      conversion:
        home.size > 0
          ? Math.round((sameSessionHomeToCheckoutCount / home.size) * 1000) / 10
          : null,
    },
  };
}
