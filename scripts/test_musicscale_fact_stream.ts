import assert from 'node:assert/strict';
import { isCanonicalFactValid } from '../src/packages/events/factContract.js';
import { projectCurrentMusicScaleFacts } from '../src/lib/musicScaleFactProjection.js';
import { collectMusicScaleSignalsFromFacts } from '../src/lib/factSignalAdapter.js';
import { collectEvidenceBackedActionSignals } from '../src/lib/actionSignals.js';

const organizationId = 'org-fact-stream';
const observedAtMs = 1_800_000_000_000;

const facts = projectCurrentMusicScaleFacts({
  organizationId,
  ready: true,
  observedAtMs,
  projectionNowMs: observedAtMs + 500,
  nextScale: {
    id: 'scale-team',
    startsAtMs: observedAtMs + 60_000,
    responseSummaryAvailable: true,
    pendingResponses: 3
  },
  nextPersonalScale: {
    id: 'scale-personal',
    startsAtMs: observedAtMs + 120_000,
    publishRevision: 7,
    responseSummaryAvailable: true,
    pendingResponses: 1
  }
});

assert.equal(facts.length, 2);
assert.ok(facts.every(fact => isCanonicalFactValid(fact)));
assert.ok(facts.every(fact => fact.organizationId === organizationId));
assert.ok(facts.every(fact => fact.source.organizationId === organizationId));
assert.ok(facts.every(fact => fact.source.sourceApp === 'musicscale'));
assert.ok(facts.every(fact => fact.actor.type === 'system'));
assert.ok(facts.every(fact => fact.occurredAtMs === observedAtMs));
assert.ok(facts.every(fact => fact.recordedAtMs === observedAtMs));
assert.ok(facts.every(fact => fact.factId === fact.idempotencyKey));

const teamFact = facts.find(
  fact => fact.eventType === 'musicscale.scale.response_summary_observed'
);
assert.ok(teamFact);
assert.equal(teamFact!.entity.type, 'scale');
assert.equal(teamFact!.entity.id, 'scale-team');
assert.equal(teamFact!.metadata.pendingResponses, 3);
assert.equal(
  teamFact!.source.sourceRef,
  'musicscale.read_model.schedule_response_summary'
);

const personalFact = facts.find(
  fact => fact.eventType === 'musicscale.scale.personal_confirmation_observed'
);
assert.ok(personalFact);
assert.equal(personalFact!.entity.id, 'scale-personal');
assert.equal(personalFact!.metadata.publishRevision, 7);
assert.equal(
  personalFact!.source.sourceRef,
  'musicscale.read_model.personal_schedule_confirmation'
);

const signals = collectMusicScaleSignalsFromFacts(facts);
assert.deepEqual(
  signals.map(signal => signal.signalType).sort(),
  ['musicscale_pending_responses', 'musicscale_personal_confirmation'].sort()
);
assert.ok(signals.every(signal => signal.organizationId === organizationId));
assert.ok(signals.every(signal => signal.evidence.length === 1));
assert.equal(
  signals.find(signal => signal.signalType === 'musicscale_pending_responses')
    ?.fingerprint,
  'musicscale:pending_responses:scale-team:3'
);
assert.equal(
  signals.find(signal => signal.signalType === 'musicscale_personal_confirmation')
    ?.fingerprint,
  'musicscale:personal_confirmation:scale-personal:rev7:pending1'
);

// A fact is source truth, not an action. Zero pending responses must remain a
// valid fact while producing no actionable signal.
const healthyFacts = projectCurrentMusicScaleFacts({
  organizationId,
  ready: true,
  observedAtMs,
  nextScale: {
    id: 'scale-healthy',
    responseSummaryAvailable: true,
    pendingResponses: 0
  },
  nextPersonalScale: null
});
assert.equal(healthyFacts.length, 1);
assert.ok(isCanonicalFactValid(healthyFacts[0]!));
assert.deepEqual(collectMusicScaleSignalsFromFacts(healthyFacts), []);

// Missing/invalid source state fails closed.
assert.deepEqual(
  projectCurrentMusicScaleFacts({
    organizationId: '   ',
    ready: true,
    observedAtMs,
    nextScale: {
      id: 'scale-no-tenant',
      responseSummaryAvailable: true,
      pendingResponses: 1
    }
  }),
  []
);

assert.deepEqual(
  projectCurrentMusicScaleFacts({
    organizationId,
    ready: false,
    observedAtMs,
    nextScale: {
      id: 'scale-not-ready',
      responseSummaryAvailable: true,
      pendingResponses: 1
    }
  }),
  []
);

assert.deepEqual(
  projectCurrentMusicScaleFacts({
    organizationId,
    ready: true,
    observedAtMs,
    nextScale: {
      id: 'scale-summary-unavailable',
      responseSummaryAvailable: false,
      pendingResponses: 9
    }
  }),
  []
);

// Deterministic identity is independent from projection clock.
const deterministicA = projectCurrentMusicScaleFacts({
  organizationId,
  ready: true,
  projectionNowMs: 100,
  nextScale: {
    id: 'scale-deterministic',
    responseSummaryAvailable: true,
    pendingResponses: 2
  }
})[0]!;
const deterministicB = projectCurrentMusicScaleFacts({
  organizationId,
  ready: true,
  projectionNowMs: 200,
  nextScale: {
    id: 'scale-deterministic',
    responseSummaryAvailable: true,
    pendingResponses: 2
  }
})[0]!;
assert.equal(deterministicA.factId, deterministicB.factId);
assert.equal(deterministicA.idempotencyKey, deterministicB.idempotencyKey);

// Tampering with tenant/source/entity coherence must stop before Signal Engine.
const tamperedTenant = {
  ...teamFact!,
  source: {
    ...teamFact!.source,
    organizationId: 'org-other'
  }
};
assert.deepEqual(
  collectMusicScaleSignalsFromFacts([tamperedTenant as typeof teamFact]),
  []
);

const tamperedSource = {
  ...teamFact!,
  source: {
    ...teamFact!.source,
    sourceRef: 'musicscale.read_model.untrusted'
  }
};
assert.deepEqual(
  collectMusicScaleSignalsFromFacts([tamperedSource as typeof teamFact]),
  []
);

const tamperedEntity = {
  ...teamFact!,
  source: {
    ...teamFact!.source,
    entityId: 'scale-other'
  }
};
assert.deepEqual(
  collectMusicScaleSignalsFromFacts([tamperedEntity as typeof teamFact]),
  []
);

// The current public adapter must now preserve the exact visible behavior while
// routing MusicScale through Canonical Facts first.
const bridgedSignals = collectEvidenceBackedActionSignals({
  organizationId,
  organization: { isConfigured: true },
  pendingInvitesCount: 0,
  musicScale: {
    ready: true,
    observedAtMs,
    nextScale: {
      id: 'scale-team',
      startsAtMs: observedAtMs + 60_000,
      responseSummaryAvailable: true,
      pendingResponses: 3
    },
    nextPersonalScale: {
      id: 'scale-personal',
      startsAtMs: observedAtMs + 120_000,
      publishRevision: 7,
      responseSummaryAvailable: true,
      pendingResponses: 1
    }
  }
});

assert.deepEqual(
  bridgedSignals.map(signal => signal.signalType).sort(),
  ['musicscale_pending_responses', 'musicscale_personal_confirmation'].sort()
);
assert.ok(
  bridgedSignals.every(signal =>
    signal.evidence.every(reference =>
      reference.sourceKind === 'runtime_projection' &&
      reference.sourceApp === 'musicscale'
    )
  )
);

console.log('MusicScale canonical Fact Stream checks passed.');
