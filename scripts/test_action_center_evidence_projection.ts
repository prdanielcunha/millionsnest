import assert from 'node:assert/strict';
import {
  deriveEvidenceBackedHubActions,
  projectEvidenceBackedSignalToAction
} from '../src/lib/actionCenter.js';
import { collectEvidenceBackedActionSignals } from '../src/lib/actionSignals.js';

const organizationId = 'org-evidence-123';
const baseInput = {
  organizationId,
  organization: { isConfigured: true },
  permissions: {
    canManageOrganization: true,
    canManageMembers: true,
    canReadManagedMusicScaleResponses: true
  },
  pendingInvitesCount: 0,
  musicScale: {
    ready: true,
    observedAtMs: 1_799_999_900_000,
    nextScale: null
  }
};

assert.deepEqual(
  deriveEvidenceBackedHubActions(baseInput),
  [],
  'healthy tenant with no actionable facts should have no evidence-backed actions'
);

const musicScaleActions = deriveEvidenceBackedHubActions({
  ...baseInput,
  musicScale: {
    ready: true,
    observedAtMs: 1_799_999_900_000,
    nextScale: {
      id: 'scale-evidence-1',
      startsAtMs: 1_800_000_000_000,
      responseSummaryAvailable: true,
      pendingResponses: 3
    }
  }
});

assert.equal(musicScaleActions.length, 1);
assert.equal(musicScaleActions[0]?.organizationId, organizationId);
assert.equal(musicScaleActions[0]?.signalType, 'musicscale_pending_responses');
assert.equal(musicScaleActions[0]?.translationParams?.count, 3);
assert.equal(musicScaleActions[0]?.evidence.length, 1);
assert.deepEqual(musicScaleActions[0]?.evidence[0], {
  organizationId,
  sourceApp: 'musicscale',
  sourceKind: 'runtime_projection',
  sourceRef: 'musicscale.read_model.schedule_response_summary',
  entityType: 'scale',
  entityId: 'scale-evidence-1',
  fieldPaths: [
      'responseSummaryAvailable',
      'pendingResponses',
      'pendingByFunction',
      'startsAtMs'
    ],
  observedAtMs: 1_799_999_900_000
});

const hubActions = deriveEvidenceBackedHubActions({
  ...baseInput,
  organization: { isConfigured: false },
  pendingInvitesCount: 2
});

assert.equal(hubActions.length, 2);
const organizationAction = hubActions.find(
  action => action.signalType === 'organization_incomplete'
)!;
const inviteAction = hubActions.find(
  action => action.signalType === 'pending_invites'
)!;

assert.equal(organizationAction.evidence[0]?.entityId, organizationId);
assert.deepEqual(organizationAction.evidence[0]?.fieldPaths, ['name', 'slug']);
assert.equal(inviteAction.evidence[0]?.sourceRef, 'hub.read_model.pending_invitations');
assert.equal(inviteAction.translationParams?.count, 2);

const strictSignals = collectEvidenceBackedActionSignals({
  organizationId,
  organization: { isConfigured: true },
  pendingInvitesCount: 0,
  musicScale: {
    ready: true,
    nextScale: {
      id: 'scale-tamper',
      responseSummaryAvailable: true,
      pendingResponses: 1
    }
  }
});

assert.equal(strictSignals.length, 1);
const validSignal = strictSignals[0]!;
assert.ok(
  projectEvidenceBackedSignalToAction(validSignal, {
    canManageOrganization: false,
    canManageMembers: false,
    canReadManagedMusicScaleResponses: true
  }),
  'a valid evidence-backed managed MusicScale signal should project with explicit domain capability'
);
assert.equal(
  projectEvidenceBackedSignalToAction(validSignal, {
    canManageOrganization: true,
    canManageMembers: true,
    canReadManagedMusicScaleResponses: false
  }),
  null,
  'ecosystem or organization administration must not substitute for managed MusicScale response authority'
);

const crossTenantSignal = {
  ...validSignal,
  evidence: validSignal.evidence.map(reference => ({
    ...reference,
    organizationId: 'org-other-tenant'
  }))
};
assert.equal(
  projectEvidenceBackedSignalToAction(crossTenantSignal, {
    canManageOrganization: true,
    canManageMembers: true,
    canReadManagedMusicScaleResponses: true
  }),
  null,
  'cross-tenant evidence must fail closed before becoming a visible action'
);

const mismatchedSourceSignal = {
  ...validSignal,
  evidence: validSignal.evidence.map(reference => ({
    ...reference,
    sourceApp: 'hub'
  }))
};
assert.equal(
  projectEvidenceBackedSignalToAction(mismatchedSourceSignal, {
    canManageOrganization: true,
    canManageMembers: true,
    canReadManagedMusicScaleResponses: true
  }),
  null,
  'evidence from a different source app must not substantiate a signal'
);

const mismatchedEntitySignal = {
  ...validSignal,
  evidence: validSignal.evidence.map(reference => ({
    ...reference,
    entityId: 'scale-other'
  }))
};
assert.equal(
  projectEvidenceBackedSignalToAction(mismatchedEntitySignal, {
    canManageOrganization: true,
    canManageMembers: true,
    canReadManagedMusicScaleResponses: true
  }),
  null,
  'evidence for a different entity must not substantiate a signal'
);

const personalSignal = collectEvidenceBackedActionSignals({
  organizationId,
  organization: { isConfigured: true },
  pendingInvitesCount: 0,
  musicScale: {
    ready: true,
    nextScale: null,
    nextPersonalScale: {
      id: 'scale-personal',
      responseSummaryAvailable: true,
      pendingResponses: 1
    }
  }
}).find(signal => signal.signalType === 'musicscale_personal_confirmation');

assert.ok(personalSignal);
assert.ok(
  projectEvidenceBackedSignalToAction(personalSignal!, {
    canManageOrganization: false,
    canManageMembers: false,
    canReadManagedMusicScaleResponses: false
  }),
  'personal confirmation must remain available without ministry-level managed-response authority'
);

assert.deepEqual(
  collectEvidenceBackedActionSignals({
    ...baseInput,
    organizationId: '   '
  }),
  [],
  'missing tenant identity must fail quiet instead of creating unscoped signals'
);

console.log('Evidence-first Action Center projection checks passed.');
