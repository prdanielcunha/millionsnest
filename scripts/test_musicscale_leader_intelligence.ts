import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  derivePendingConfirmationGapsByFunction,
  summarizePendingConfirmationFunctions
} from '../src/lib/musicScaleLeaderIntelligence.js';
import { projectCurrentMusicScaleFacts } from '../src/lib/musicScaleFactProjection.js';
import { collectMusicScaleSignalsFromFacts } from '../src/lib/factSignalAdapter.js';
import { projectEvidenceBackedSignalToAction } from '../src/lib/actionCenter.js';

const assignments = [
  {
    eventAssignmentId: 'a-guitar',
    functionName: 'Violão',
    active: true,
    userId: 'private-user-1'
  },
  {
    eventAssignmentId: 'a-keys-1',
    functionName: 'Teclado',
    active: true,
    userId: 'private-user-2'
  },
  {
    eventAssignmentId: 'a-vocal',
    functionName: 'Vocal',
    active: true,
    userId: 'private-user-3'
  },
  {
    eventAssignmentId: 'a-keys-2',
    functionName: 'Teclado',
    active: true,
    userId: 'private-user-4'
  },
  {
    eventAssignmentId: 'a-inactive',
    functionName: 'Bateria',
    active: false,
    userId: 'private-user-5'
  }
];

const responses = [
  {
    id: 'r-keys',
    eventAssignmentId: 'a-keys-1',
    status: 'pending',
    active: true
  },
  {
    id: 'r-vocal-stale',
    eventAssignmentId: 'a-vocal',
    status: 'pending',
    active: true
  },
  {
    id: 'r-vocal-final',
    eventAssignmentId: 'a-vocal',
    status: 'accepted',
    active: true
  }
];

const gaps = derivePendingConfirmationGapsByFunction(
  assignments,
  responses
);

assert.deepEqual(gaps, [
  { functionName: 'Teclado', count: 2 },
  { functionName: 'Violão', count: 1 }
]);
assert.deepEqual(
  summarizePendingConfirmationFunctions(gaps),
  ['Teclado (2)', 'Violão']
);
assert.equal(
  JSON.stringify(gaps).includes('private-user'),
  false,
  'leader intelligence output must not expose person identifiers'
);
assert.equal(
  gaps.some(gap => gap.functionName === 'Vocal'),
  false,
  'a terminal response must win over a stale duplicate pending response'
);
assert.equal(
  gaps.some(gap => gap.functionName === 'Bateria'),
  false,
  'inactive assignments must never become leader gaps'
);

const organizationId = 'org-leader-intelligence';
const factA = projectCurrentMusicScaleFacts({
  organizationId,
  ready: true,
  observedAtMs: 1_800_000_000_000,
  nextScale: {
    id: 'scale-leader-1',
    startsAtMs: 1_800_000_500_000,
    responseSummaryAvailable: true,
    pendingResponses: 3,
    pendingByFunction: gaps
  },
  nextPersonalScale: null
}).find(
  fact => fact.eventType === 'musicscale.scale.response_summary_observed'
);

assert.ok(factA);
assert.deepEqual(factA!.metadata.pendingByFunction, gaps);
assert.ok(
  factA!.source.fieldPaths?.includes('pendingByFunction'),
  'function-level gap evidence must declare its source field'
);

const factSameCountDifferentRole = projectCurrentMusicScaleFacts({
  organizationId,
  ready: true,
  observedAtMs: 1_800_000_000_000,
  nextScale: {
    id: 'scale-leader-1',
    startsAtMs: 1_800_000_500_000,
    responseSummaryAvailable: true,
    pendingResponses: 3,
    pendingByFunction: [
      { functionName: 'Baixo', count: 2 },
      { functionName: 'Violão', count: 1 }
    ]
  },
  nextPersonalScale: null
}).find(
  fact => fact.eventType === 'musicscale.scale.response_summary_observed'
);

assert.ok(factSameCountDifferentRole);
assert.notEqual(
  factA!.idempotencyKey,
  factSameCountDifferentRole!.idempotencyKey,
  'same total count with changed functions must be a materially different fact'
);

const signalA = collectMusicScaleSignalsFromFacts([factA!]).find(
  signal => signal.signalType === 'musicscale_pending_responses'
);
const signalB = collectMusicScaleSignalsFromFacts([
  factSameCountDifferentRole!
]).find(
  signal => signal.signalType === 'musicscale_pending_responses'
);

assert.ok(signalA);
assert.ok(signalB);
assert.deepEqual(
  signalA!.payload.pendingFunctionNames,
  ['Teclado (2)', 'Violão']
);
assert.notEqual(
  signalA!.fingerprint,
  signalB!.fingerprint,
  'dismissed leader action must reappear when the affected functions change'
);

const leaderAction = projectEvidenceBackedSignalToAction(
  signalA!,
  {
    canManageOrganization: false,
    canManageMembers: false,
    canReadManagedMusicScaleResponses: true
  }
);

assert.ok(leaderAction);
assert.equal(
  leaderAction!.descriptionKey,
  'workspace.actions.musicscale_pending_responses.description_with_functions'
);
assert.equal(
  leaderAction!.translationParams?.functions,
  'Teclado (2) · Violão'
);
assert.equal(leaderAction!.translationParams?.count, 3);

assert.equal(
  projectEvidenceBackedSignalToAction(
    signalA!,
    {
      canManageOrganization: true,
      canManageMembers: true,
      canReadManagedMusicScaleResponses: false
    }
  ),
  null,
  'organization/global administration must not substitute for worship managed-response authority'
);

const genericFact = projectCurrentMusicScaleFacts({
  organizationId,
  ready: true,
  observedAtMs: 1_800_000_000_000,
  nextScale: {
    id: 'scale-generic',
    responseSummaryAvailable: true,
    pendingResponses: 1
  },
  nextPersonalScale: null
}).find(
  fact => fact.eventType === 'musicscale.scale.response_summary_observed'
);
assert.ok(genericFact);

const genericSignal = collectMusicScaleSignalsFromFacts([genericFact!]).find(
  signal => signal.signalType === 'musicscale_pending_responses'
);
assert.ok(genericSignal);
assert.equal(
  genericSignal!.fingerprint,
  'musicscale:pending_responses:scale-generic:1',
  'legacy fingerprint remains stable when no function context exists'
);

const genericAction = projectEvidenceBackedSignalToAction(
  genericSignal!,
  {
    canManageOrganization: false,
    canManageMembers: false,
    canReadManagedMusicScaleResponses: true
  }
);
assert.equal(
  genericAction?.descriptionKey,
  'workspace.actions.musicscale_pending_responses.description'
);

const dashboard = readFileSync('src/pages/Dashboard.tsx', 'utf8');
assert.match(
  dashboard,
  /derivePendingConfirmationGapsByFunction/,
  'Dashboard must use the deterministic privacy-safe leader intelligence projector'
);
assert.match(
  dashboard,
  /pendingByFunction/,
  'Dashboard read model must expose function-level pending gaps'
);

const home = readFileSync(
  'src/components/dashboard/EcosystemWorkspaceHome.tsx',
  'utf8'
);
assert.match(
  home,
  /pendingByFunction:\s*musicScaleSummary\.nextScale\.pendingByFunction/,
  'adaptive Home must pass function gaps into canonical Fact/Signal projection'
);

const helperSource = readFileSync(
  'src/lib/musicScaleLeaderIntelligence.ts',
  'utf8'
);
for (const forbidden of ['userId', 'displayName', 'email', 'burnout', 'spiritual']) {
  assert.equal(
    helperSource.includes(forbidden),
    false,
    `leader function-gap projector must not depend on or emit ${forbidden}`
  );
}

for (const language of ['pt', 'en', 'es']) {
  const locale = readFileSync(
    `src/packages/i18n/locales/${language}.ts`,
    'utf8'
  );
  assert.match(
    locale,
    /description_with_functions/,
    `${language} must explain function-aware leader gaps`
  );
}

console.log('MusicScale leader confirmation-gap intelligence checks passed.');
