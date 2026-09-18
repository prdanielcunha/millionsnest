import assert from 'node:assert/strict';
import {
  filterActionsByAppEntitlement,
  resolveEntitledAppIds
} from '../src/lib/adaptiveEntitlements.js';
import {
  resolveHubAppExperience,
  type HubAppExperience
} from '../src/lib/hubAppExperience.js';
import { ECOSYSTEM_APPS } from '../src/lib/apps.js';
import type { EvidenceBackedReadOnlyHubAction } from '../src/lib/actionCenter.js';

function experience(
  appId: string,
  overrides: Partial<HubAppExperience> = {}
): HubAppExperience {
  return {
    app: {
      id: appId,
      name: appId,
      description: appId,
      icon: 'Grid',
      status: 'active',
      category: 'core'
    },
    installed: true,
    canOpen: true,
    state: 'active',
    plan: 'starter',
    needsAttention: false,
    isOperational: true,
    ...overrides
  };
}

assert.deepEqual(
  resolveEntitledAppIds([
    experience('musicscale'),
    experience('nestfinance', { installed: false, canOpen: false, state: 'available' }),
    experience('nestjourney', { installed: false, canOpen: false, state: 'coming_soon', isOperational: false })
  ]),
  ['musicscale'],
  'only installed, openable and operational products are adaptive entitlements'
);

// FUTURE ARCHITECTURE SCENARIO ONLY. NestFinance and NestJourney are not
// currently built/operational. This verifies that the entitlement layer can
// support independent products later without changing the core model.
assert.deepEqual(
  resolveEntitledAppIds([
    experience('musicscale'),
    experience('nestfinance'),
    experience('nestjourney')
  ]),
  ['musicscale', 'nestfinance', 'nestjourney'],
  'future operational products may compose independently once their catalog state becomes active'
);

const currentNestFinance = ECOSYSTEM_APPS.find(app => app.id === 'nestfinance');
const currentNestJourney = ECOSYSTEM_APPS.find(app => app.id === 'nestjourney');
assert.ok(currentNestFinance);
assert.ok(currentNestJourney);

const currentUnbuiltExperiences = [
  resolveHubAppExperience({
    app: currentNestFinance!,
    organization: {
      enabledApps: ['nestfinance'],
      apps: { nestfinance: { enabled: true, status: 'active' } }
    },
    musicScaleAccess: null
  }),
  resolveHubAppExperience({
    app: currentNestJourney!,
    organization: {
      enabledApps: ['nestjourney'],
      apps: { nestjourney: { enabled: true, status: 'active' } }
    },
    musicScaleAccess: null
  })
];

assert.deepEqual(
  resolveEntitledAppIds(currentUnbuiltExperiences),
  [],
  'current coming-soon NestFinance/NestJourney catalog entries must never become adaptive entitlements even if organization flags are stale or manually enabled'
);

assert.deepEqual(
  resolveEntitledAppIds([
    experience('musicscale', { state: 'trialing' }),
    experience('nestfinance', { state: 'cancel_scheduled' })
  ]),
  ['musicscale', 'nestfinance'],
  'trialing and cancellation-scheduled products remain entitled while the canonical Hub still allows opening them'
);

const hubAction = {
  id: 'hub:organization',
  dedupeKey: 'hub:organization',
  fingerprint: 'hub:organization:v1',
  sourceApp: 'hub',
  signalType: 'organization_incomplete',
  priority: 'high',
  titleKey: 'x',
  descriptionKey: 'x',
  destination: { kind: 'hub', section: 'organization' },
  organizationId: 'org-entitlement',
  evidence: [{
    organizationId: 'org-entitlement',
    sourceApp: 'hub',
    sourceKind: 'runtime_projection',
    sourceRef: 'hub.test',
    entityType: 'organization',
    entityId: 'org-entitlement'
  }]
} satisfies EvidenceBackedReadOnlyHubAction;

const musicAction = {
  ...hubAction,
  id: 'musicscale:scale-1',
  dedupeKey: 'musicscale:scale-1',
  fingerprint: 'musicscale:scale-1:v1',
  sourceApp: 'musicscale',
  signalType: 'musicscale_personal_confirmation',
  destination: { kind: 'app', appId: 'musicscale', path: '/scales/scale-1' },
  evidence: [{
    organizationId: 'org-entitlement',
    sourceApp: 'musicscale',
    sourceKind: 'runtime_projection',
    sourceRef: 'musicscale.test',
    entityType: 'scale',
    entityId: 'scale-1'
  }]
} satisfies EvidenceBackedReadOnlyHubAction;

assert.deepEqual(
  filterActionsByAppEntitlement([hubAction, musicAction], []),
  [hubAction],
  'Hub-owned actions remain available independently of future app entitlements'
);

assert.deepEqual(
  filterActionsByAppEntitlement([hubAction, musicAction], ['nestfinance']),
  [hubAction],
  'a different future app entitlement must never unlock MusicScale actions in My Today'
);

assert.deepEqual(
  filterActionsByAppEntitlement([hubAction, musicAction], ['musicscale']),
  [hubAction, musicAction],
  'an entitled app may contribute only its already-authorized evidence-backed actions'
);

console.log('Adaptive per-product entitlement checks passed.');
