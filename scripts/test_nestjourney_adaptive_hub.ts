import assert from 'node:assert/strict';
import { resolveHubAppExperience } from '../src/lib/hubAppExperience.js';
import { buildCurrentContextGraph, hasCurrentContextEdge } from '../src/lib/currentContextGraph.js';
import { buildCurrentAdaptiveWorkspace } from '../src/lib/currentAdaptiveWorkspace.js';
import { answerAskMillionsNest } from '../src/lib/askMillionsNest.js';
import { isAllowedAppDestinationPath } from '../src/lib/appExperienceRegistry.js';
import type { EcosystemApp } from '../src/lib/apps.js';
import type { FactEvidenceReference } from '../src/packages/events/factContract.js';

const ORG_ID = 'org-journey-adaptive';
const NOW = Date.UTC(2026, 8, 20, 12, 0, 0);

const nestJourneyApp: EcosystemApp = {
  id: 'nestjourney',
  name: 'NestJourney',
  description: 'Journey & Care',
  icon: 'Route',
  status: 'coming_soon',
  category: 'beta',
  url: 'https://nestjourney.millionsnest.com'
};

const authority = {
  accessible: true,
  decisionState: 'granted' as const,
  canReadJourneyOperational: true,
  isGlobalAccess: false
};

const experience = resolveHubAppExperience({
  app: nestJourneyApp,
  organization: {
    apps: {
      nestjourney: {
        status: 'active',
        plan: 'pilot'
      }
    }
  },
  nestJourneyAccess: authority,
  isGlobalAdmin: false,
  canAccessDevelopmentPreviews: false
});

assert.equal(experience.installed, true);
assert.equal(experience.canOpen, true);
assert.equal(experience.state, 'active');
assert.equal(experience.isOperational, true);

const globalPreview = resolveHubAppExperience({
  app: nestJourneyApp,
  organization: {
    apps: { nestjourney: { status: 'active' } }
  },
  nestJourneyAccess: {
    ...authority,
    isGlobalAccess: true
  },
  isGlobalAdmin: true,
  canAccessDevelopmentPreviews: true
});

assert.equal(globalPreview.state, 'development');
assert.equal(globalPreview.isOperational, false);

const graph = buildCurrentContextGraph({
  organizationId: ORG_ID,
  appExperiences: [experience],
  canManageOrganization: false,
  nestJourneyAccess: authority
});

assert.deepEqual(graph.entitledAppIds, ['nestjourney']);
assert.equal(graph.authorizedDomains.journey, true);
assert.deepEqual(graph.responsibilities, ['journey_leadership']);
assert.equal(
  hasCurrentContextEdge(graph, 'owns_domain', 'domain:journey'),
  true
);
assert.equal(
  hasCurrentContextEdge(graph, 'authorized_for', 'domain:journey'),
  true
);

function queueEvidence(entityId: string): FactEvidenceReference[] {
  return [{
    organizationId: ORG_ID,
    sourceApp: 'nestjourney',
    sourceKind: 'backend_api',
    sourceRef: 'hub.api.nestjourney.workspace.test',
    entityType: 'followup_queue',
    entityId,
    fieldPaths: ['count', 'overdueCount'],
    observedAtMs: NOW
  }];
}

const workspace = buildCurrentAdaptiveWorkspace({
  organizationId: ORG_ID,
  systemRole: 'user',
  appExperiences: [experience],
  requestedLens: 'my_today',
  canManageOrganization: false,
  canManageMembers: false,
  nestJourneyAccess: authority,
  organization: { isConfigured: true },
  pendingInvitesCount: 0,
  journey: {
    ready: true,
    observedAtMs: NOW,
    assignedFirstContacts: {
      count: 2,
      overdueCount: 1,
      dueSoonCount: 1,
      earliestDueAtMs: NOW - 60_000,
      evidence: queueEvidence('assigned:first_contact')
    },
    unassignedFirstContacts: {
      count: 1,
      overdueCount: 1,
      dueSoonCount: 0,
      earliestDueAtMs: NOW - 120_000,
      evidence: queueEvidence('unassigned:first_contact')
    }
  },
  musicScale: {
    ready: false,
    nextScale: null,
    nextPersonalScale: null
  }
});

assert.deepEqual(
  workspace.lenses.map(lens => lens.id),
  ['my_today', 'journey']
);
assert.equal(workspace.defaultLens, 'journey');
assert.equal(workspace.actions.length, 2);
assert.equal(workspace.actionsByLens.journey.length, 2);
assert.ok(
  workspace.actionsByLens.journey.every(action =>
    action.sourceApp === 'nestjourney' &&
    action.evidence.length > 0 &&
    action.evidence.every(reference =>
      reference.organizationId === ORG_ID &&
      reference.sourceApp === 'nestjourney'
    )
  )
);

const noSourceWorkspace = buildCurrentAdaptiveWorkspace({
  organizationId: ORG_ID,
  systemRole: 'user',
  appExperiences: [experience],
  requestedLens: 'journey',
  canManageOrganization: false,
  canManageMembers: false,
  nestJourneyAccess: authority,
  organization: { isConfigured: true },
  pendingInvitesCount: 0,
  journey: {
    ready: true,
    observedAtMs: NOW,
    assignedFirstContacts: {
      count: 1,
      overdueCount: 1,
      dueSoonCount: 0,
      earliestDueAtMs: NOW - 60_000,
      evidence: []
    },
    unassignedFirstContacts: {
      count: 0,
      overdueCount: 0,
      dueSoonCount: 0,
      earliestDueAtMs: null,
      evidence: []
    }
  },
  musicScale: {
    ready: false,
    nextScale: null,
    nextPersonalScale: null
  }
});

assert.deepEqual(
  noSourceWorkspace.actions,
  [],
  'NO SOURCE -> NO CLAIM must suppress Journey queue claims without evidence'
);

const ask = answerAskMillionsNest({
  organizationId: ORG_ID,
  question: 'O que está pendente no acompanhamento?',
  activeLens: 'journey',
  lenses: workspace.lenses,
  actions: workspace.actions,
  musicScale: {
    ready: false,
    nextScale: null,
    nextPersonalScale: null
  },
  nowMs: NOW
});

assert.equal(ask.status, 'answered');
assert.equal(ask.intent, 'journey_follow_up');
assert.equal(ask.translationParams?.assigned, 2);
assert.equal(ask.translationParams?.unassigned, 1);
assert.equal(ask.translationParams?.overdue, 2);
assert.ok(ask.evidence.length > 0);
assert.ok(
  ask.evidence.every(reference =>
    reference.organizationId === ORG_ID &&
    reference.sourceApp === 'nestjourney'
  )
);

const globalGraph = buildCurrentContextGraph({
  organizationId: ORG_ID,
  appExperiences: [globalPreview],
  canManageOrganization: true,
  nestJourneyAccess: {
    ...authority,
    isGlobalAccess: true
  }
});
assert.equal(globalGraph.authorizedDomains.journey, false);
assert.equal(
  globalGraph.entitledAppIds.includes('nestjourney'),
  false,
  'global governance preview is not a Journey ministry entitlement'
);

assert.equal(isAllowedAppDestinationPath('nestjourney', '/my-today'), true);
assert.equal(isAllowedAppDestinationPath('nestjourney', '/care-integrity'), true);
assert.equal(isAllowedAppDestinationPath('nestjourney', '/followup-runtime'), true);
assert.equal(isAllowedAppDestinationPath('nestjourney', '/private-not-registered'), false);

console.log('NestJourney Adaptive Hub evidence and authorization checks passed.');
