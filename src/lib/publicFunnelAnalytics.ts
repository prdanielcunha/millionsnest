export const HOME_MUSICSCALE_INTEREST_SOURCES = [
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

export type HomeMusicScaleInterestSource =
  typeof HOME_MUSICSCALE_INTEREST_SOURCES[number];

const HOME_VIEW_SESSION_KEY = 'mn_public_home_view_tracked';
const SESSION_ID_KEY = 'mn_session_id';

function getOrCreateSessionId(): string {
  let sessionId = sessionStorage.getItem(SESSION_ID_KEY);
  if (!sessionId) {
    sessionId =
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15);
    sessionStorage.setItem(SESSION_ID_KEY, sessionId);
  }
  return sessionId;
}

async function postPublicHomeAnalytics(
  payload:
    | { event: 'home_view'; sessionId: string }
    | {
        event: 'musicscale_interest';
        sessionId: string;
        source: HomeMusicScaleInterestSource;
      },
): Promise<void> {
  const response = await fetch('/api/v1/public/analytics/home', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    keepalive: true,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Public analytics rejected with status ${response.status}`);
  }
}

export function trackPublicHomeView() {
  if (typeof window === 'undefined') return;
  if (sessionStorage.getItem(HOME_VIEW_SESSION_KEY) === '1') return;

  sessionStorage.setItem(HOME_VIEW_SESSION_KEY, '1');
  const sessionId = getOrCreateSessionId();

  void postPublicHomeAnalytics({ event: 'home_view', sessionId }).catch(() => {
    sessionStorage.removeItem(HOME_VIEW_SESSION_KEY);
  });
}

export function trackHomeMusicScaleInterest(
  source: HomeMusicScaleInterestSource,
) {
  if (typeof window === 'undefined') return;
  const sessionId = getOrCreateSessionId();

  void postPublicHomeAnalytics({
    event: 'musicscale_interest',
    sessionId,
    source,
  }).catch(() => {
    // Analytics must never interrupt navigation or sales UX.
  });
}
