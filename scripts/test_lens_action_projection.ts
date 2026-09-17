import assert from 'node:assert/strict';
import { deriveEvidenceBackedHubActions } from '../src/lib/actionCenter.js';
import { projectActionsForLens } from '../src/lib/lensActionProjection.js';

const actions = deriveEvidenceBackedHubActions({
  organizationId: 'org-lens-actions',
  organization: { isConfigured: false },
  permissions: {
    canManageOrganization: true,
    canManageMembers: true
  },
  pendingInvitesCount: 2,
  musicScale: {
    ready: true,
    nextScale: {
      id: 'scale-1',
      startsAtMs: 1_800_000_000_000,
      responseSummaryAvailable: true,
      pendingResponses: 3
    }
  }
});

assert.equal(actions.length, 3);

const myToday = projectActionsForLens(actions, 'my_today');
assert.deepEqual(
  myToday.map(action => action.dedupeKey),
  actions.map(action => action.dedupeKey),
  'My Today may compose all actions that already passed authorization and evidence checks'
);

const administration = projectActionsForLens(actions, 'administration');
assert.ok(administration.length > 0);
assert.ok(
  administration.every(action => action.sourceApp === 'hub'),
  'administration lens must only narrow to Hub-owned actions'
);

const worship = projectActionsForLens(actions, 'worship');
assert.equal(worship.length, 1);
assert.ok(
  worship.every(action => action.sourceApp === 'musicscale'),
  'worship lens must only narrow to MusicScale-owned actions'
);

for (const sensitiveLens of ['pastoral', 'journey', 'finance'] as const) {
  assert.deepEqual(
    projectActionsForLens(actions, sensitiveLens),
    [],
    `${sensitiveLens} must remain empty until its owning domain provides canonical evidence-backed action sources`
  );
}

const unauthorizedActions = deriveEvidenceBackedHubActions({
  organizationId: 'org-lens-actions',
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
assert.deepEqual(unauthorizedActions, []);
assert.deepEqual(
  projectActionsForLens(unauthorizedActions, 'administration'),
  [],
  'a lens must never recreate an action that the authoritative projector removed'
);

console.log('Lens action narrowing checks passed.');
