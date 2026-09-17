import assert from 'node:assert/strict';
import {
  resolveAvailableHubLenses,
  resolveDefaultHubLens
} from '../src/lib/lensResolver.js';

const memberLenses = resolveAvailableHubLenses({
  systemRole: 'user',
  availableAppIds: ['musicscale', 'nestjourney', 'nestfinance']
});
assert.deepEqual(
  memberLenses.map(lens => lens.id),
  ['my_today'],
  'an ordinary user must not receive domain lenses without prior authorization'
);

const ceoLenses = resolveAvailableHubLenses({
  systemRole: 'ceo',
  availableAppIds: ['musicscale', 'nestjourney', 'nestfinance']
});
assert.deepEqual(
  ceoLenses.map(lens => lens.id),
  ['my_today', 'administration'],
  'global governance must not automatically expose pastoral, Journey, worship or finance lenses'
);
assert.equal(ceoLenses[1]?.source, 'global_governance');

const responsibilityWithoutAuthorization = resolveAvailableHubLenses({
  systemRole: 'user',
  responsibilities: ['pastoral_care', 'worship_leadership'],
  availableAppIds: ['musicscale']
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
  availableAppIds: ['musicscale']
});
assert.deepEqual(
  worshipLeaderLenses.map(lens => lens.id),
  ['my_today', 'worship']
);
assert.equal(worshipLeaderLenses[1]?.preferred, true);
assert.equal(resolveDefaultHubLens(worshipLeaderLenses), 'worship');

const missingAppLenses = resolveAvailableHubLenses({
  systemRole: 'user',
  responsibilities: ['worship_leadership', 'journey_leadership'],
  authorizedDomains: {
    worship: true,
    journey: true
  },
  availableAppIds: []
});
assert.deepEqual(
  missingAppLenses.map(lens => lens.id),
  ['my_today'],
  'an app-backed lens must not appear when its product is unavailable in the current organization'
);

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
  availableAppIds: ['nestjourney', 'musicscale', 'nestfinance']
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
