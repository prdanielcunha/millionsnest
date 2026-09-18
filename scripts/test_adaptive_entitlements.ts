import assert from 'node:assert/strict';
import {
  filterActionsByAppEntitlement,
  resolveEntitledAppIds
} from '../src/lib/adaptiveEntitlements.js';
import type { HubAppExperience } from '../src/lib/hubAppExperience.js';
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

assert.deepEqual(
  resolveEntitledAppIds([
    experience('musicscale'),
    experience('nestfinance'),
    experience('nestjourney')
  ]),
  ['musicscale', 'nestfinance', 'nestjourney'],
  'organizations may own any combination of products, including the full ecosystem'
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
  'Hub-owned actions remain available without buying every ecosystem app'
);

assert.deepEqual(
  filterActionsByAppEntitlement([hubAction, musicAction], ['nestfinance']),
  [hubAction],
  'buying a different app must never unlock MusicScale actions in My Today'
);

assert.deepEqual(
  filterActionsByAppEntitlement([hubAction, musicAction], ['musicscale']),
  [hubAction, musicAction],
  'an entitled app may contribute only its already-authorized evidence-backed actions'
);

console.log('Adaptive per-product entitlement checks passed.');
