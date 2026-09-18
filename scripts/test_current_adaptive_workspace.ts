import assert from 'node:assert/strict';
import { buildCurrentAdaptiveWorkspace } from '../src/lib/currentAdaptiveWorkspace.js';
import type { MusicScaleAccessProjection } from '../src/lib/ecosystemAccessProjection.js';
import type { HubAppExperience } from '../src/lib/hubAppExperience.js';

function musicScaleAccess(
  overrides: Partial<MusicScaleAccessProjection> = {}
): MusicScaleAccessProjection {
  return {
    appId: 'musicscale',
    organizationId: 'org-current-adaptive',
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
    },
    ...overrides
  };
}

function appExperience(
  appId: string,
  options: { entitled?: boolean; state?: HubAppExperience['state'] } = {}
): HubAppExperience {
  const entitled = options.entitled !== false;
  return {
    app: {
      id: appId,
      name: appId,
      description: appId,
      icon: 'Grid',
      status: 'active',
      category: 'core'
    },
    installed: entitled,
    canOpen: entitled,
    state: options.state ?? (entitled ? 'active' : 'available'),
    plan: entitled ? 'starter' : null,
    needsAttention: false,
    isOperational: true
  };
}

const worshipLeader = buildCurrentAdaptiveWorkspace({
  organizationId: 'org-current-adaptive',
  systemRole: 'user',
  appExperiences: [appExperience('musicscale')],
  canManageOrganization: false,
  canManageMembers: false,
  musicScaleAccess: musicScaleAccess(),
  organization: { isConfigured: true },
  pendingInvitesCount: 0,
  musicScale: {
    ready: true,
    nextScale: {
      id: 'scale-team-current',
      responseSummaryAvailable: true,
      pendingResponses: 2
    },
    nextPersonalScale: {
      id: 'scale-personal-current',
      responseSummaryAvailable: true,
      pendingResponses: 1
    }
  }
});

assert.deepEqual(
  worshipLeader.lenses.map(lens => lens.id),
  ['my_today', 'worship']
);
assert.equal(worshipLeader.defaultLens, 'worship');
assert.deepEqual(
  worshipLeader.actions.map(action => action.signalType).sort(),
  ['musicscale_pending_responses', 'musicscale_personal_confirmation'].sort()
);

const ordinaryMusician = buildCurrentAdaptiveWorkspace({
  organizationId: 'org-current-adaptive',
  systemRole: 'user',
  appExperiences: [appExperience('musicscale')],
  canManageOrganization: false,
  canManageMembers: false,
  musicScaleAccess: musicScaleAccess({
    canReadManagedScaleResponses: false
  }),
  organization: { isConfigured: true },
  pendingInvitesCount: 0,
  musicScale: {
    ready: true,
    nextScale: {
      id: 'scale-team-hidden',
      responseSummaryAvailable: true,
      pendingResponses: 8
    },
    nextPersonalScale: {
      id: 'scale-personal-member',
      responseSummaryAvailable: true,
      pendingResponses: 1
    }
  }
});

assert.deepEqual(
  ordinaryMusician.lenses.map(lens => lens.id),
  ['my_today'],
  'ordinary musicians must not receive the ministry-leadership Lens'
);
assert.deepEqual(
  ordinaryMusician.actions.map(action => action.signalType),
  ['musicscale_personal_confirmation'],
  'personal preparation stays in My Today while managed team responses remain hidden'
);

const globalAdministrator = buildCurrentAdaptiveWorkspace({
  organizationId: 'org-current-adaptive',
  systemRole: 'ceo',
  appExperiences: [
    appExperience('musicscale', { state: 'administrative' }),
    appExperience('nestjourney'),
    appExperience('nestfinance')
  ],
  requestedLens: 'worship',
  canManageOrganization: true,
  canManageMembers: true,
  musicScaleAccess: musicScaleAccess({
    isGlobalAccess: true,
    accessSource: 'global_system_role',
    catalogState: 'administrative'
  }),
  organization: { isConfigured: false },
  pendingInvitesCount: 3,
  musicScale: {
    ready: true,
    nextScale: {
      id: 'scale-global-hidden',
      responseSummaryAvailable: true,
      pendingResponses: 4
    }
  }
});

assert.deepEqual(
  globalAdministrator.lenses.map(lens => lens.id),
  ['my_today', 'administration']
);
assert.equal(
  globalAdministrator.activeLens,
  'administration',
  'a stale unavailable Lens falls back to the canonically preferred administration context'
);
assert.deepEqual(
  globalAdministrator.actions.map(action => action.signalType).sort(),
  ['organization_incomplete', 'pending_invites'].sort(),
  'global administration alone must not project ministry-level MusicScale response claims'
);

const deniedAccess = buildCurrentAdaptiveWorkspace({
  organizationId: 'org-current-adaptive',
  systemRole: 'user',
  responsibilities: ['worship_leadership'],
  appExperiences: [appExperience('musicscale', { entitled: false })],
  canManageOrganization: false,
  canManageMembers: false,
  musicScaleAccess: musicScaleAccess({
    accessible: false,
    decisionState: 'denied',
    catalogState: 'unavailable',
    canReadManagedScaleResponses: true
  }),
  organization: { isConfigured: true },
  pendingInvitesCount: 0,
  musicScale: {
    ready: true,
    nextScale: {
      id: 'scale-denied-stale-bit',
      responseSummaryAvailable: true,
      pendingResponses: 1
    }
  }
});

assert.deepEqual(deniedAccess.lenses.map(lens => lens.id), ['my_today']);
assert.deepEqual(deniedAccess.actions, []);

// FUTURE ARCHITECTURE FIXTURE: simulates a later NestFinance entitlement.
// NestFinance is not built/operational in the current product catalog.
const futureFinanceOnlyOrganization = buildCurrentAdaptiveWorkspace({
  organizationId: 'org-current-adaptive',
  systemRole: 'user',
  appExperiences: [appExperience('nestfinance')],
  canManageOrganization: false,
  canManageMembers: false,
  musicScaleAccess: musicScaleAccess(),
  organization: { isConfigured: true },
  pendingInvitesCount: 0,
  musicScale: {
    ready: true,
    nextPersonalScale: {
      id: 'stale-music-action',
      responseSummaryAvailable: true,
      pendingResponses: 1
    },
    nextScale: null
  }
});

assert.deepEqual(
  futureFinanceOnlyOrganization.lenses.map(lens => lens.id),
  ['my_today'],
  'a future NestFinance entitlement must not expose the Worship Lens'
);
assert.deepEqual(
  futureFinanceOnlyOrganization.actions,
  [],
  'future non-MusicScale product sessions must not inherit stale MusicScale actions'
);

const conflictingMusicScaleState = buildCurrentAdaptiveWorkspace({
  organizationId: 'org-current-adaptive',
  systemRole: 'user',
  appExperiences: [appExperience('musicscale')],
  canManageOrganization: false,
  canManageMembers: false,
  musicScaleAccess: musicScaleAccess({
    accessible: false,
    decisionState: 'denied',
    catalogState: 'unavailable',
    canReadManagedScaleResponses: false
  }),
  organization: { isConfigured: true },
  pendingInvitesCount: 0,
  musicScale: {
    ready: true,
    nextPersonalScale: {
      id: 'stale-denied-personal-scale',
      responseSummaryAvailable: true,
      pendingResponses: 1
    },
    nextScale: null
  }
});

assert.deepEqual(conflictingMusicScaleState.lenses.map(lens => lens.id), ['my_today']);
assert.deepEqual(
  conflictingMusicScaleState.actions,
  [],
  'server denial must win over a stale installed-app catalog entry'
);

console.log('Current Hub adaptive workspace bridge checks passed.');
