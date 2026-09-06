import assert from 'node:assert/strict';
import {
  PUBLIC_HOME_MUSICSCALE_INTEREST_SOURCES,
  parsePublicHomeAnalyticsPayload,
  toPublicHomeAnalyticsDocument,
} from '../src/server/services/PublicHomeAnalyticsService.js';

const sessionId = 'session-public-1234567890';

const home = parsePublicHomeAnalyticsPayload({
  event: 'home_view',
  sessionId,
});
assert.deepEqual(home, { event: 'home_view', sessionId });

for (const source of PUBLIC_HOME_MUSICSCALE_INTEREST_SOURCES) {
  const parsed = parsePublicHomeAnalyticsPayload({
    event: 'musicscale_interest',
    sessionId,
    source,
  });
  assert.deepEqual(parsed, {
    event: 'musicscale_interest',
    sessionId,
    source,
  });
}

assert.equal(
  parsePublicHomeAnalyticsPayload({
    event: 'home_view',
    sessionId,
    email: 'not-allowed@example.com',
  }),
  null,
  'PII/extra keys must be rejected',
);

assert.equal(
  parsePublicHomeAnalyticsPayload({
    event: 'musicscale_interest',
    sessionId,
    source: 'untrusted_source',
  }),
  null,
  'unknown sources must be rejected',
);

assert.equal(
  parsePublicHomeAnalyticsPayload({
    event: 'musicscale_interest',
    sessionId,
    source: 'hero_primary',
    product: 'another_product',
  }),
  null,
  'arbitrary products/extra metadata must be rejected',
);

assert.equal(
  parsePublicHomeAnalyticsPayload({
    event: 'home_view',
    sessionId: 'short',
  }),
  null,
  'weak/short session identifiers must be rejected',
);

assert.equal(
  parsePublicHomeAnalyticsPayload({
    event: 'checkout_completed',
    sessionId,
  }),
  null,
  'public endpoint must not accept arbitrary analytics events',
);

assert.deepEqual(
  toPublicHomeAnalyticsDocument({ event: 'home_view', sessionId }),
  {
    eventType: 'page_view',
    organizationId: 'none',
    userId: 'none',
    sessionId,
    app: 'millionsnest_core',
    metadata: { page: 'home' },
  },
);

assert.deepEqual(
  toPublicHomeAnalyticsDocument({
    event: 'musicscale_interest',
    sessionId,
    source: 'hero_primary',
  }),
  {
    eventType: 'app_usage',
    organizationId: 'none',
    userId: 'none',
    sessionId,
    app: 'millionsnest_core',
    metadata: {
      action: 'product_interest',
      product: 'musicscale',
      source: 'hero_primary',
    },
  },
);

console.log('PASS public home analytics server validation and canonical document mapping');
