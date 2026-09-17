import assert from 'node:assert/strict';
import { buildAdaptiveWorkspaceModel } from '../src/lib/adaptiveWorkspaceModel.js';

const worshipWorkspace = buildAdaptiveWorkspaceModel({
  organizationId: 'org-adaptive-1',
  systemRole: 'user',
  responsibilities: ['worship_leadership'],
  authorizedDomains: {
    worship: true
  },
  availableAppIds: ['musicscale'],
  organization: { isConfigured: true },
  permissions: {
    canManageOrganization: false,
    canManageMembers: false,
    canReadManagedMusicScaleResponses: true
  },
  pendingInvitesCount: 5,
  musicScale: {
    ready: true,
    nextScale: {
      id: 'scale-team',
      startsAtMs: 1_800_000_000_000,
      responseSummaryAvailable: true,
      pendingResponses: 2
    },
    nextPersonalScale: {
      id: 'scale-personal',
      startsAtMs: 1_800_000_100_000,
      publishRevision: 4,
      responseSummaryAvailable: true,
      pendingResponses: 1
    }
  }
});

assert.deepEqual(
  worshipWorkspace.lenses.map(lens => lens.id),
  ['my_today', 'worship']
);
assert.equal(worshipWorkspace.defaultLens, 'worship');
assert.equal(worshipWorkspace.actions.length, 2);
assert.ok(
  worshipWorkspace.actions.every(action => action.organizationId === 'org-adaptive-1')
);
assert.deepEqual(
  worshipWorkspace.actionsByLens.my_today.map(action => action.signalType).sort(),
  ['musicscale_pending_responses', 'musicscale_personal_confirmation'].sort(),
  'My Today should compose all already-authorized actions across the current responsibilities'
);
assert.equal(worshipWorkspace.actionsByLens.worship.length, 2);
assert.deepEqual(
  worshipWorkspace.actionsByLens.administration,
  [],
  'unavailable lenses must never receive projected actions'
);

const teamAction = worshipWorkspace.actions.find(
  action => action.signalType === 'musicscale_pending_responses'
)!;
const dismissedWorkspace = buildAdaptiveWorkspaceModel({
  organizationId: 'org-adaptive-1',
  systemRole: 'user',
  responsibilities: ['worship_leadership'],
  authorizedDomains: { worship: true },
  availableAppIds: ['musicscale'],
  organization: { isConfigured: true },
  permissions: {
    canManageOrganization: false,
    canManageMembers: false,
    canReadManagedMusicScaleResponses: true
  },
  pendingInvitesCount: 0,
  musicScale: {
    ready: true,
    nextScale: {
      id: 'scale-team',
      startsAtMs: 1_800_000_000_000,
      responseSummaryAvailable: true,
      pendingResponses: 2
    },
    nextPersonalScale: {
      id: 'scale-personal',
      startsAtMs: 1_800_000_100_000,
      publishRevision: 4,
      responseSummaryAvailable: true,
      pendingResponses: 1
    }
  },
  actionPreferences: [{
    dedupeKey: teamAction.dedupeKey,
    fingerprint: teamAction.fingerprint,
    mode: 'dismissed'
  }]
});

assert.equal(dismissedWorkspace.actions.length, 1);
assert.equal(dismissedWorkspace.actions[0]?.signalType, 'musicscale_personal_confirmation');
assert.equal(dismissedWorkspace.actionsByLens.worship.length, 1);

const administrativeWorkspace = buildAdaptiveWorkspaceModel({
  organizationId: 'org-adaptive-2',
  systemRole: 'ceo',
  availableAppIds: ['musicscale', 'nestjourney', 'nestfinance'],
  organization: { isConfigured: false },
  permissions: {
    canManageOrganization: true,
    canManageMembers: true,
    canReadManagedMusicScaleResponses: false
  },
  pendingInvitesCount: 3,
  musicScale: {
    ready: true,
    nextScale: {
      id: 'scale-hidden-from-global-admin',
      responseSummaryAvailable: true,
      pendingResponses: 7
    }
  }
});

assert.deepEqual(
  administrativeWorkspace.lenses.map(lens => lens.id),
  ['my_today', 'administration'],
  'CEO should not gain sensitive domain lenses merely from global governance'
);
assert.deepEqual(
  administrativeWorkspace.actions.map(action => action.signalType).sort(),
  ['organization_incomplete', 'pending_invites'].sort(),
  'managed MusicScale content must remain hidden without explicit MusicScale domain authority'
);
assert.ok(
  administrativeWorkspace.actionsByLens.administration.every(
    action => action.sourceApp === 'hub'
  )
);

const noTenantWorkspace = buildAdaptiveWorkspaceModel({
  organizationId: '   ',
  systemRole: 'user',
  authorizedDomains: { worship: true },
  availableAppIds: ['musicscale'],
  organization: { isConfigured: true },
  permissions: {
    canManageOrganization: false,
    canManageMembers: false,
    canReadManagedMusicScaleResponses: true
  },
  pendingInvitesCount: 0,
  musicScale: {
    ready: true,
    nextScale: {
      id: 'scale-no-tenant',
      responseSummaryAvailable: true,
      pendingResponses: 1
    }
  }
});
assert.equal(noTenantWorkspace.organizationId, '');
assert.deepEqual(noTenantWorkspace.actions, []);
assert.deepEqual(noTenantWorkspace.actionsByLens.my_today, []);

console.log('Adaptive workspace read model checks passed.');
