import assert from 'node:assert/strict';
import { deriveCurrentHubLensAuthorization } from '../src/lib/hubLensAuthorization.js';
import type { MusicScaleAccessProjection } from '../src/lib/ecosystemAccessProjection.js';

const baseProjection: MusicScaleAccessProjection = {
  appId: 'musicscale',
  organizationId: 'org-1',
  accessible: true,
  isGlobalAccess: false,
  accessSource: 'organization_membership',
  decisionState: 'granted',
  denialReason: null,
  catalogState: 'active',
  canReadManagedScaleResponses: true,
  entitlement: {
    canonicalStatus: 'active',
    cancellationScheduled: false,
    currentPeriodEndMs: null,
    individualAccessSource: 'explicit_enabled'
  }
};

assert.deepEqual(
  deriveCurrentHubLensAuthorization({
    canManageOrganization: false,
    musicScaleAccess: baseProjection
  }),
  {
    pastoral: false,
    journey: false,
    worship: true,
    finance: false,
    administration: false
  },
  'existing tenant-scoped MusicScale managed-response authority may enable the worship lens'
);

assert.equal(
  deriveCurrentHubLensAuthorization({
    canManageOrganization: true,
    musicScaleAccess: null
  }).administration,
  true,
  'existing organization-management authority may enable the administration lens'
);

assert.deepEqual(
  deriveCurrentHubLensAuthorization({
    canManageOrganization: false,
    musicScaleAccess: {
      ...baseProjection,
      isGlobalAccess: true,
      accessSource: 'global_system_role',
      catalogState: 'administrative'
    }
  }),
  {
    pastoral: false,
    journey: false,
    worship: false,
    finance: false,
    administration: false
  },
  'global ecosystem access alone must not be translated into ministry-content lens authority'
);

assert.equal(
  deriveCurrentHubLensAuthorization({
    canManageOrganization: false,
    musicScaleAccess: {
      ...baseProjection,
      canReadManagedScaleResponses: false
    }
  }).worship,
  false,
  'ordinary MusicScale access without managed-response authority must not enable the worship leadership lens'
);

assert.equal(
  deriveCurrentHubLensAuthorization({
    canManageOrganization: false,
    musicScaleAccess: {
      ...baseProjection,
      accessible: false,
      decisionState: 'denied',
      catalogState: 'unavailable'
    }
  }).worship,
  false,
  'denied application access must fail closed even if a stale capability bit is present'
);

const futureSensitiveDomains = deriveCurrentHubLensAuthorization({
  canManageOrganization: true,
  musicScaleAccess: baseProjection
});
assert.equal(futureSensitiveDomains.pastoral, false);
assert.equal(futureSensitiveDomains.journey, false);
assert.equal(futureSensitiveDomains.finance, false);

console.log('Current Hub lens authority adapter checks passed.');
