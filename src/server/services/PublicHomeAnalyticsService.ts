export const PUBLIC_HOME_MUSICSCALE_INTEREST_SOURCES = [
  'hero_primary',
  'nav_product',
  'nav_pricing',
  'nav_trial',
  'flagship_primary',
  'flagship_pricing',
  'ecosystem_live',
  'guarantee_primary',
  'guarantee_pricing',
] as const;

export type PublicHomeMusicScaleInterestSource =
  typeof PUBLIC_HOME_MUSICSCALE_INTEREST_SOURCES[number];

export type PublicHomeAnalyticsPayload =
  | {
      event: 'home_view';
      sessionId: string;
    }
  | {
      event: 'musicscale_interest';
      sessionId: string;
      source: PublicHomeMusicScaleInterestSource;
    };

const SESSION_ID_PATTERN = /^[a-zA-Z0-9_-]{12,128}$/;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): boolean {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length &&
    actual.every((key, index) => key === wanted[index]);
}

export function parsePublicHomeAnalyticsPayload(
  input: unknown,
): PublicHomeAnalyticsPayload | null {
  if (!isPlainObject(input)) return null;

  const event = input.event;
  const sessionId = input.sessionId;

  if (
    typeof sessionId !== 'string' ||
    !SESSION_ID_PATTERN.test(sessionId)
  ) {
    return null;
  }

  if (event === 'home_view') {
    if (!hasExactKeys(input, ['event', 'sessionId'])) return null;
    return { event, sessionId };
  }

  if (event === 'musicscale_interest') {
    if (!hasExactKeys(input, ['event', 'sessionId', 'source'])) return null;
    const source = input.source;
    if (
      typeof source !== 'string' ||
      !PUBLIC_HOME_MUSICSCALE_INTEREST_SOURCES.includes(
        source as PublicHomeMusicScaleInterestSource,
      )
    ) {
      return null;
    }

    return {
      event,
      sessionId,
      source: source as PublicHomeMusicScaleInterestSource,
    };
  }

  return null;
}

export function toPublicHomeAnalyticsDocument(
  payload: PublicHomeAnalyticsPayload,
) {
  if (payload.event === 'home_view') {
    return {
      eventType: 'page_view',
      organizationId: 'none',
      userId: 'none',
      sessionId: payload.sessionId,
      app: 'millionsnest_core',
      metadata: { page: 'home' },
    };
  }

  return {
    eventType: 'app_usage',
    organizationId: 'none',
    userId: 'none',
    sessionId: payload.sessionId,
    app: 'millionsnest_core',
    metadata: {
      action: 'product_interest',
      product: 'musicscale',
      source: payload.source,
    },
  };
}
