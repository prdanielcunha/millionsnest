import assert from 'node:assert/strict';
import {
  resolveActiveHubLens,
  resolveAvailableHubLenses,
  resolveDefaultHubLens
} from '../src/lib/lensResolver.js';

const memberLenses = resolveAvailableHubLenses({
  systemRole: 'user',
  entitledAppIds: ['musicscale', 'nestjourney', 'nestfinance']
});
assert.deepEqual(
  memberLenses.map(lens => lens.id),
  ['my_today'],
  'an ordinary user must not receive domain lenses without prior authorization'
);
assert.equal(
  resolveActiveHubLens('worship', memberLenses),
  'my_today',
  'a stale Lens selection must not survive after its authorization disappears'
);

const ceoLenses = resolveAvailableHubLenses({
  systemRole: 'ceo',
  entitledAppIds: ['musicscale', 'nestjourney', 'nestfinance']
});
assert.deepEqual(
  ceoLenses.map(lens => lens.id),
  ['my_today', 'administration'],
  'global governance must not automatically expose pastoral, Journey, worship or finance lenses'
);
assert.equal(ceoLenses[1]?.source, 'global_governance');
assert.equal(resolveActiveHubLens('administration', ceoLenses), 'administration');
assert.equal(
  resolveActiveHubLens('finance', ceoLenses),
  'my_today',
  'global governance must not preserve an unavailable finance selection'
);

const responsibilityWithoutAuthorization = resolveAvailableHubLenses({
  systemRole: 'user',
  responsibilities: ['pastoral_care', 'worship_leadership'],
  entitledAppIds: ['musicscale']
});
assert.deepEqual(
  responsibilityWithoutAuthorization.map(lens => lens.id),
  ['my_today'],
  'responsibility labels alone must never grant access to sensitive domain lenses'
);

const worshipLeaderLenses = resolveAvailableHubLenses({
  systemRole: 'user',
  responsibilities: ['worship_leadership'],
  authorizedDomains: {
    worship: true
  },
  entitledAppIds: ['musicscale']
});
assert.deepEqual(
  worshipLeaderLenses.map(lens => lens.id),
  ['my_today', 'worship']
);
assert.equal(worshipLeaderLenses[1]?.preferred, true);
assert.equal(resolveDefaultHubLens(worshipLeaderLenses), 'worship');
assert.equal(resolveActiveHubLens(undefined, worshipLeaderLenses), 'worship');
assert.equal(resolveActiveHubLens('my_today', worshipLeaderLenses), 'my_today');

const missingAppLenses = resolveAvailableHubLenses({
  systemRole: 'user',
  responsibilities: ['worship_leadership', 'journey_leadership'],
  authorizedDomains: {
    worship: true,
    journey: true
  },
  entitledAppIds: []
});
assert.deepEqual(
  missingAppLenses.map(lens => lens.id),
  ['my_today'],
  'an app-backed lens must not appear when its product is not entitled for the current organization'
);

// FUTURE ARCHITECTURE SCENARIO: NestFinance is not built/operational yet.
const futureFinanceOnlyLenses = resolveAvailableHubLenses({
  systemRole: 'user',
  responsibilities: ['finance_operations'],
  authorizedDomains: { finance: true },
  entitledAppIds: ['nestfinance']
});
assert.deepEqual(
  futureFinanceOnlyLenses.map(lens => lens.id),
  ['my_today', 'finance'],
  'future architecture must support NestFinance independently once that product is built and entitled'
);

// FUTURE ARCHITECTURE SCENARIO: NestJourney is not built/operational yet.
const futureJourneyOnlyLenses = resolveAvailableHubLenses({
  systemRole: 'user',
  responsibilities: ['journey_leadership'],
  authorizedDomains: { journey: true },
  entitledAppIds: ['nestjourney']
});
assert.deepEqual(
  futureJourneyOnlyLenses.map(lens => lens.id),
  ['my_today', 'journey'],
  'future architecture must support NestJourney independently once that product is built and entitled'
);

// FUTURE ARCHITECTURE SCENARIO: exercises eventual multi-product composition only.
const multiResponsibilityLenses = resolveAvailableHubLenses({
  systemRole: 'user',
  responsibilities: [
    'pastoral_care',
    'journey_leadership',
    'worship_leadership',
    'finance_operations'
  ],
  authorizedDomains: {
    pastoral: true,
    journey: true,
    worship: true,
    finance: true
  },
  entitledAppIds: ['nestjourney', 'musicscale', 'nestfinance']
});
assert.deepEqual(
  multiResponsibilityLenses.map(lens => lens.id),
  ['my_today', 'pastoral', 'journey', 'worship', 'finance'],
  'multiple authorized responsibilities should compose instead of forcing mutually exclusive dashboards'
);
assert.equal(
  resolveDefaultHubLens(multiResponsibilityLenses),
  'pastoral',
  'the default may prefer an explicit responsibility while My Today remains available'
);
assert.equal(
  resolveActiveHubLens('not-a-real-lens', multiResponsibilityLenses),
  'pastoral',
  'invalid persisted values must fall back to the current authorized default'
);

const authorizedAdminLenses = resolveAvailableHubLenses({
  systemRole: 'user',
  responsibilities: ['organization_administration'],
  authorizedDomains: {
    administration: true
  }
});
assert.deepEqual(
  authorizedAdminLenses.map(lens => lens.id),
  ['my_today', 'administration']
);
assert.equal(authorizedAdminLenses[1]?.preferred, true);

console.log('Adaptive Hub lens authorization checks passed.');
