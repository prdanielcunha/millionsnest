import { analytics } from "./analytics.js";

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

export type HomeMusicScaleInterestSource = typeof HOME_MUSICSCALE_INTEREST_SOURCES[number];

const HOME_VIEW_SESSION_KEY = 'mn_public_home_view_tracked';

export function trackPublicHomeView() {
  if (typeof window === 'undefined') return;

  if (sessionStorage.getItem(HOME_VIEW_SESSION_KEY) === '1') return;
  sessionStorage.setItem(HOME_VIEW_SESSION_KEY, '1');

  analytics.track('page_view', {
    app: 'millionsnest_core',
    metadata: { page: 'home' }
  });
}

export function trackHomeMusicScaleInterest(source: HomeMusicScaleInterestSource) {
  analytics.track('app_usage', {
    app: 'millionsnest_core',
    metadata: {
      action: 'product_interest',
      product: 'musicscale',
      source
    }
  });
}
