import assert from 'node:assert/strict';
import { summarizeGrowthEvents } from '../src/server/services/GrowthFunnelService.js';

const events = [
  { eventType: 'page_view', app: 'millionsnest_core', sessionId: 'a', metadata: { page: 'home' } },
  { eventType: 'page_view', app: 'millionsnest_core', sessionId: 'b', metadata: { page: 'home' } },
  { eventType: 'page_view', app: 'millionsnest_core', sessionId: 'c', metadata: { page: 'home' } },

  { eventType: 'app_usage', app: 'millionsnest_core', sessionId: 'a', metadata: { action: 'product_interest', product: 'musicscale', source: 'hero_primary' } },
  { eventType: 'app_usage', app: 'millionsnest_core', sessionId: 'b', metadata: { action: 'product_interest', product: 'musicscale', source: 'nav_trial' } },
  { eventType: 'app_usage', app: 'millionsnest_core', sessionId: 'b', metadata: { action: 'product_interest', product: 'musicscale', source: 'nav_trial' } },

  { eventType: 'page_view', app: 'musicscale', sessionId: 'a', metadata: { page: 'sales_landing' } },
  { eventType: 'page_view', app: 'musicscale', sessionId: 'b', metadata: { page: 'sales_landing' } },

  { eventType: 'trial_cta_clicked', app: 'musicscale', sessionId: 'a', metadata: { action: 'choose_plan' } },
  { eventType: 'signup', app: 'millionsnest_core', sessionId: 'a', userId: 'u1', organizationId: 'o1' },
  { eventType: 'checkout_started', app: 'musicscale', sessionId: 'a', userId: 'u1', organizationId: 'o1' },
  { eventType: 'checkout_completed', app: 'musicscale', sessionId: 'a', userId: 'u1', organizationId: 'o1' },

  // Existing/direct customer activity must not inflate Home cohort conversion.
  { eventType: 'checkout_completed', app: 'musicscale', sessionId: 'direct', userId: 'u2', organizationId: 'o2' },
  { eventType: 'error', app: 'millionsnest_core', sessionId: 'a' },
];

const summary = summarizeGrowthEvents(events, 7);
const byKey = Object.fromEntries(summary.funnel.map(step => [step.key, step]));

assert.equal(byKey.home_view.sessions, 3);
assert.equal(byKey.musicscale_interest.sessions, 2);
assert.equal(byKey.musicscale_interest.reachedFromPrevious, 2);
assert.equal(byKey.musicscale_interest.conversionFromPrevious, 66.7);
assert.equal(byKey.sales_landing.sessions, 2);
assert.equal(byKey.sales_landing.conversionFromPrevious, 100);
assert.equal(byKey.plan_choice.sessions, 1);
assert.equal(byKey.plan_choice.conversionFromPrevious, 50);
assert.equal(byKey.signup.sessions, 1);
assert.equal(byKey.signup.conversionFromPrevious, 100);
assert.equal(byKey.checkout_started.sessions, 1);
assert.equal(byKey.checkout_started.conversionFromPrevious, 100);
assert.equal(byKey.checkout_completed.sessions, 2);
assert.equal(byKey.checkout_completed.reachedFromPrevious, 1);
assert.equal(byKey.checkout_completed.conversionFromPrevious, 100);

assert.deepEqual(summary.sameSessionHomeToCheckout, { sessions: 1, conversion: 33.3 });
assert.equal(summary.sourceBreakdown[0].source, 'nav_trial');
assert.equal(summary.sourceBreakdown[0].sessions, 1);
assert.equal(summary.sourceBreakdown[0].events, 2);
assert.equal(summary.growthEventsMatched, 13);
assert.equal(summary.eventsScanned, events.length);

console.log('PASS growth funnel cohort aggregation and CTA source attribution');
