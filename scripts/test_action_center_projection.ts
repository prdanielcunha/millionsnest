import assert from 'node:assert/strict';
import { deriveReadOnlyHubActions } from '../src/lib/actionCenter.js';

const baseInput = {
  organization: { isConfigured: true },
  permissions: {
    canManageOrganization: true,
    canManageMembers: true
  },
  pendingInvitesCount: 0,
  musicScale: {
    ready: true,
    nextScale: null
  }
};

assert.deepEqual(
  deriveReadOnlyHubActions(baseInput),
  [],
  'healthy organization with no actionable signals should have no actions'
);

const pendingResponses = deriveReadOnlyHubActions({
  ...baseInput,
  musicScale: {
    ready: true,
    nextScale: {
      id: 'scale-123',
      startsAtMs: 1_800_000_000_000,
      responseSummaryAvailable: true,
      pendingResponses: 3
    }
  }
});

assert.equal(pendingResponses.length, 1);
assert.equal(pendingResponses[0]?.signalType, 'musicscale_pending_responses');
assert.equal(pendingResponses[0]?.translationParams?.count, 3);
assert.deepEqual(pendingResponses[0]?.destination, {
  kind: 'app',
  appId: 'musicscale',
  path: '/scales/scale-123'
});

const multipleActions = deriveReadOnlyHubActions({
  organization: { isConfigured: false },
  permissions: {
    canManageOrganization: true,
    canManageMembers: true
  },
  pendingInvitesCount: 2,
  musicScale: {
    ready: true,
    nextScale: {
      id: 'scale-456',
      responseSummaryAvailable: true,
      pendingResponses: 1
    }
  }
});

assert.equal(multipleActions.length, 3);
assert.equal(multipleActions[0]?.priority, 'high');
assert.ok(
  multipleActions.some(action => action.signalType === 'organization_incomplete'),
  'must include incomplete organization action'
);
assert.ok(
  multipleActions.some(action => action.signalType === 'pending_invites'),
  'must include pending invites action'
);
assert.ok(
  multipleActions.some(action => action.signalType === 'musicscale_pending_responses'),
  'must include MusicScale pending response action'
);

const unauthorized = deriveReadOnlyHubActions({
  organization: { isConfigured: false },
  permissions: {
    canManageOrganization: false,
    canManageMembers: false
  },
  pendingInvitesCount: 4,
  musicScale: {
    ready: false,
    nextScale: null
  }
});

assert.deepEqual(
  unauthorized,
  [],
  'projection must not surface management actions when the user lacks permission'
);

console.log('Action Center projection checks passed.');
