import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  countDeclinedConfirmations,
  deriveDeclinedConfirmationGapsByFunction,
  summarizeDeclinedConfirmationFunctions
} from '../src/lib/musicScaleLeaderIntelligence.js';
import { projectCurrentMusicScaleFacts } from '../src/lib/musicScaleFactProjection.js';
import { collectMusicScaleSignalsFromFacts } from '../src/lib/factSignalAdapter.js';
import { projectEvidenceBackedSignalToAction } from '../src/lib/actionCenter.js';

const assignments = [
  {
    eventAssignmentId: 'drums-1',
    functionName: 'Bateria',
    active: true
  },
  {
    eventAssignmentId: 'drums-2',
    functionName: 'Bateria',
    active: true
  },
  {
    eventAssignmentId: 'vocal-1',
    functionName: 'Vocal',
    active: true
  },
  {
    eventAssignmentId: 'keys-conflict',
    functionName: 'Teclado',
    active: true
  },
  {
    eventAssignmentId: 'inactive-declined',
    functionName: 'Baixo',
    active: false
  }
];

const responses = [
  {
    eventAssignmentId: 'drums-1',
    status: 'declined',
    active: true
  },
  {
    eventAssignmentId: 'drums-2',
    status: 'declined',
    active: true
  },
  {
    eventAssignmentId: 'vocal-1',
    status: 'accepted',
    active: true
  },
  {
    eventAssignmentId: 'keys-conflict',
    status: 'declined',
    active: true
  },
  {
    eventAssignmentId: 'keys-conflict',
    status: 'accepted',
    active: true
  },
  {
    eventAssignmentId: 'inactive-declined',
    status: 'declined',
    active: true
  }
];

assert.equal(
  countDeclinedConfirmations(assignments, responses),
  2,
  'only unambiguous declined active assignments should count'
);

const declinedGaps = deriveDeclinedConfirmationGapsByFunction(
  assignments,
  responses
);

assert.deepEqual(declinedGaps, [
  { functionName: 'Bateria', count: 2 }
]);
assert.deepEqual(
  summarizeDeclinedConfirmationFunctions(declinedGaps),
  ['Bateria (2)']
);
assert.equal(
  declinedGaps.some(gap => gap.functionName === 'Teclado'),
  false,
  'conflicting active terminal responses must fail closed instead of claiming a decline'
);
assert.equal(
  declinedGaps.some(gap => gap.functionName === 'Baixo'),
  false,
  'inactive assignments must not become declined leader gaps'
);

const organizationId = 'org-declined-gap';
const observedAtMs = 1_800_000_000_000;

const facts = projectCurrentMusicScaleFacts({
  organizationId,
  ready: true,
  observedAtMs,
  nextScale: {
    id: 'scale-declined-gap',
    startsAtMs: observedAtMs + 600_000,
    responseSummaryAvailable: true,
    pendingResponses: 0,
    pendingByFunction: [],
    declinedResponses: 2,
    declinedByFunction: declinedGaps
  },
  nextPersonalScale: null
});

const responseFact = facts.find(
  fact => fact.eventType === 'musicscale.scale.response_summary_observed'
);
assert.ok(responseFact);
assert.equal(responseFact!.metadata.pendingResponses, 0);
assert.equal(responseFact!.metadata.declinedResponses, 2);
assert.deepEqual(
  responseFact!.metadata.declinedByFunction,
  [{ functionName: 'Bateria', count: 2 }]
);
assert.ok(
  responseFact!.source.fieldPaths?.includes('declinedResponses')
);
assert.ok(
  responseFact!.source.fieldPaths?.includes('declinedByFunction')
);

const signals = collectMusicScaleSignalsFromFacts(facts);
assert.equal(
  signals.some(signal => signal.signalType === 'musicscale_pending_responses'),
  false,
  'zero pending confirmations must not create a pending-response action'
);

const declinedSignal = signals.find(
  signal => signal.signalType === 'musicscale_declined_responses'
);
assert.ok(declinedSignal);
assert.equal(
  declinedSignal!.payload.declinedResponses,
  2
);
assert.deepEqual(
  declinedSignal!.payload.declinedFunctionNames,
  ['Bateria (2)']
);

const action = projectEvidenceBackedSignalToAction(
  declinedSignal!,
  {
    canManageOrganization: false,
    canManageMembers: false,
    canReadManagedMusicScaleResponses: true
  }
);
assert.ok(action);
assert.equal(
  action!.titleKey,
  'workspace.actions.musicscale_declined_responses.title'
);
assert.equal(
  action!.descriptionKey,
  'workspace.actions.musicscale_declined_responses.description_with_functions'
);
assert.equal(action!.translationParams?.count, 2);
assert.equal(action!.translationParams?.functions, 'Bateria (2)');

assert.equal(
  projectEvidenceBackedSignalToAction(
    declinedSignal!,
    {
      canManageOrganization: true,
      canManageMembers: true,
      canReadManagedMusicScaleResponses: false
    }
  ),
  null,
  'administrative authority must not expose managed worship decline data'
);

const sameCountDifferentFunctionFacts = projectCurrentMusicScaleFacts({
  organizationId,
  ready: true,
  observedAtMs,
  nextScale: {
    id: 'scale-declined-gap',
    startsAtMs: observedAtMs + 600_000,
    responseSummaryAvailable: true,
    pendingResponses: 0,
    pendingByFunction: [],
    declinedResponses: 2,
    declinedByFunction: [
      { functionName: 'Violão', count: 2 }
    ]
  },
  nextPersonalScale: null
});
const changedFact = sameCountDifferentFunctionFacts.find(
  fact => fact.eventType === 'musicscale.scale.response_summary_observed'
)!;
const changedSignal = collectMusicScaleSignalsFromFacts([changedFact]).find(
  signal => signal.signalType === 'musicscale_declined_responses'
)!;

assert.notEqual(
  responseFact!.idempotencyKey,
  changedFact.idempotencyKey,
  'changed declined functions must materially change the source fact'
);
assert.notEqual(
  declinedSignal!.fingerprint,
  changedSignal.fingerprint,
  'a dismissed action must reappear when the declined function changes'
);

// Backward compatibility: callers that do not supply decline context retain the
// P5 fact identity and evidence shape.
const legacyFact = projectCurrentMusicScaleFacts({
  organizationId,
  ready: true,
  observedAtMs,
  nextScale: {
    id: 'scale-legacy',
    responseSummaryAvailable: true,
    pendingResponses: 1
  },
  nextPersonalScale: null
}).find(
  fact => fact.eventType === 'musicscale.scale.response_summary_observed'
)!;

assert.equal(
  legacyFact.idempotencyKey,
  `musicscale:${organizationId}:scale:scale-legacy:response-summary:pending-1`
);
assert.equal(
  legacyFact.source.fieldPaths?.includes('declinedResponses'),
  false
);
assert.equal(
  collectMusicScaleSignalsFromFacts([legacyFact]).some(
    signal => signal.signalType === 'musicscale_declined_responses'
  ),
  false
);

const dashboard = readFileSync('src/pages/Dashboard.tsx', 'utf8');
assert.match(
  dashboard,
  /deriveDeclinedConfirmationGapsByFunction/,
  'Dashboard must derive declined function gaps from assignments and responses'
);
assert.match(
  dashboard,
  /countDeclinedConfirmations/,
  'Dashboard decline total must share the canonical assignment-level rule'
);
assert.match(
  dashboard,
  /declinedByFunction/,
  'Dashboard summary must expose declined function gaps'
);

const home = readFileSync(
  'src/components/dashboard/EcosystemWorkspaceHome.tsx',
  'utf8'
);
assert.match(
  home,
  /declinedResponses:\s*musicScaleSummary\.nextScale\.responseCounts\.declined/,
  'adaptive Home must pass factual declined count into the Fact Stream'
);
assert.match(
  home,
  /declinedByFunction:\s*musicScaleSummary\.nextScale\.declinedByFunction/,
  'adaptive Home must pass factual declined function gaps into the Fact Stream'
);

for (const language of ['pt', 'en', 'es']) {
  const locale = readFileSync(
    `src/packages/i18n/locales/${language}.ts`,
    'utf8'
  );
  assert.match(
    locale,
    /musicscale_declined_responses/,
    `${language} must include declined-response leader guidance`
  );
}

console.log('MusicScale declined leader-gap intelligence checks passed.');
