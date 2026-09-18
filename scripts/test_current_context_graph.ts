import assert from 'node:assert/strict';
import {
  buildCurrentContextGraph,
  hasCurrentContextEdge
} from '../src/lib/currentContextGraph.js';
import type { HubAppExperience } from '../src/lib/hubAppExperience.js';

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

const worshipLeader = buildCurrentContextGraph({
  organizationId: 'org-context',
  appExperiences: [experience('musicscale')],
  canManageOrganization: false,
  musicScaleAccess: {
    accessible: true,
    decisionState: 'granted',
    canReadManagedScaleResponses: true,
    isGlobalAccess: false
  }
});

assert.deepEqual(worshipLeader.entitledAppIds, ['musicscale']);
assert.equal(worshipLeader.authorizedDomains.worship, true);
assert.equal(worshipLeader.authorizedDomains.administration, false);
assert.deepEqual(worshipLeader.responsibilities, ['worship_leadership']);
assert.ok(
  hasCurrentContextEdge(
    worshipLeader,
    'entitled_to',
    'app:musicscale'
  )
);
assert.ok(
  hasCurrentContextEdge(
    worshipLeader,
    'authorized_for',
    'domain:worship'
  )
);
assert.ok(
  hasCurrentContextEdge(
    worshipLeader,
    'responsible_for',
    'responsibility:worship_leadership'
  )
);
assert.ok(
  hasCurrentContextEdge(
    worshipLeader,
    'owns_domain',
    'domain:worship'
  )
);

const ordinaryMusician = buildCurrentContextGraph({
  organizationId: 'org-context',
  appExperiences: [experience('musicscale')],
  canManageOrganization: false,
  musicScaleAccess: {
    accessible: true,
    decisionState: 'granted',
    canReadManagedScaleResponses: false,
    isGlobalAccess: false
  }
});

assert.deepEqual(ordinaryMusician.entitledAppIds, ['musicscale']);
assert.equal(ordinaryMusician.authorizedDomains.worship, false);
assert.deepEqual(ordinaryMusician.responsibilities, []);
assert.equal(
  hasCurrentContextEdge(
    ordinaryMusician,
    'authorized_for',
    'domain:worship'
  ),
  false,
  'buying/using MusicScale must not imply ministry-leadership authority'
);

const globalAdministrator = buildCurrentContextGraph({
  organizationId: 'org-context',
  appExperiences: [experience('musicscale', { state: 'administrative' })],
  canManageOrganization: true,
  musicScaleAccess: {
    accessible: true,
    decisionState: 'granted',
    canReadManagedScaleResponses: true,
    isGlobalAccess: true
  }
});

assert.deepEqual(globalAdministrator.entitledAppIds, ['musicscale']);
assert.equal(globalAdministrator.authorizedDomains.worship, false);
assert.equal(globalAdministrator.authorizedDomains.administration, true);
assert.deepEqual(
  globalAdministrator.responsibilities,
  ['organization_administration']
);
assert.equal(
  hasCurrentContextEdge(
    globalAdministrator,
    'authorized_for',
    'domain:worship'
  ),
  false,
  'global ecosystem authority must never become worship-content authority'
);
assert.ok(
  hasCurrentContextEdge(
    globalAdministrator,
    'authorized_for',
    'domain:administration'
  )
);

// Internal CEO previews are deliberately not operational entitlements.
const developmentPreview = buildCurrentContextGraph({
  organizationId: 'org-context',
  appExperiences: [
    experience('nestjourney', {
      state: 'development',
      plan: null,
      isOperational: false
    }),
    experience('nestfinance', {
      state: 'development',
      plan: null,
      isOperational: false
    })
  ],
  canManageOrganization: true,
  musicScaleAccess: null
});

assert.deepEqual(
  developmentPreview.entitledAppIds,
  [],
  'CEO development previews must not become product entitlement edges'
);
assert.equal(
  developmentPreview.edges.some(edge => edge.relation === 'entitled_to'),
  false
);
assert.equal(developmentPreview.authorizedDomains.journey, false);
assert.equal(developmentPreview.authorizedDomains.finance, false);

// A stale catalog bit loses to current backend denial.
const staleMusicScale = buildCurrentContextGraph({
  organizationId: 'org-context',
  appExperiences: [experience('musicscale')],
  canManageOrganization: false,
  musicScaleAccess: {
    accessible: false,
    decisionState: 'denied',
    canReadManagedScaleResponses: true,
    isGlobalAccess: false
  }
});

assert.deepEqual(staleMusicScale.entitledAppIds, []);
assert.equal(staleMusicScale.authorizedDomains.worship, false);
assert.deepEqual(staleMusicScale.responsibilities, []);
assert.equal(
  staleMusicScale.edges.some(edge =>
    edge.relation === 'entitled_to' && edge.to === 'app:musicscale'
  ),
  false
);

const missingTenant = buildCurrentContextGraph({
  organizationId: '   ',
  appExperiences: [experience('musicscale')],
  canManageOrganization: true,
  musicScaleAccess: {
    accessible: true,
    decisionState: 'granted',
    canReadManagedScaleResponses: true,
    isGlobalAccess: false
  }
});

assert.equal(missingTenant.organizationId, '');
assert.deepEqual(missingTenant.nodes, []);
assert.deepEqual(missingTenant.edges, []);
assert.deepEqual(missingTenant.entitledAppIds, []);
assert.deepEqual(missingTenant.responsibilities, []);

// Guard the architectural rule: responsibility must come from canonical
// authority/capability, never presentation labels.
const source = await import('node:fs').then(fs =>
  fs.readFileSync('src/lib/currentContextGraph.ts', 'utf8')
);
for (const forbidden of ['displayName', 'roleName', 'jobTitle', 'ministryTitle']) {
  assert.equal(
    source.includes(forbidden),
    false,
    `Context Graph must not infer responsibility from ${forbidden}`
  );
}

console.log('Current Hub Context Graph checks passed.');
