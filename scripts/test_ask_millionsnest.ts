import assert from 'node:assert/strict';
import {
  answerAskMillionsNest
} from '../src/lib/askMillionsNest.js';
import type {
  EvidenceBackedReadOnlyHubAction
} from '../src/lib/actionCenter.js';
import type {
  ResolvedHubLens
} from '../src/lib/lensResolver.js';
import type {
  EvidenceBackedMusicScaleDistributionSnapshot
} from '../src/lib/musicScaleDistributionFactProjection.js';

const ORG_ID = 'org-ask-test';
const SUNDAY_MS = Date.UTC(2026, 8, 20, 12, 0, 0);
const WEDNESDAY_MS = Date.UTC(2026, 8, 23, 12, 0, 0);

const myTodayLens: ResolvedHubLens = {
  id: 'my_today',
  source: 'personal',
  preferred: true
};

const worshipLens: ResolvedHubLens = {
  id: 'worship',
  source: 'authorized_domain',
  preferred: true
};

const journeyLens: ResolvedHubLens = {
  id: 'journey',
  source: 'authorized_domain',
  preferred: false
};

const administrationLens: ResolvedHubLens = {
  id: 'administration',
  source: 'authorized_domain',
  preferred: false
};

const evidence = {
  organizationId: ORG_ID,
  sourceApp: 'musicscale',
  sourceKind: 'runtime_projection' as const,
  sourceRef: 'musicscale.read_model.next_scale_summary',
  entityType: 'scale',
  entityId: 'scale-sunday',
  fieldPaths: ['responseSummary'],
  observedAtMs: SUNDAY_MS
};

const worshipAction: EvidenceBackedReadOnlyHubAction = {
  id: 'musicscale:scale-sunday:pending',
  dedupeKey: 'musicscale:scale-sunday:pending',
  fingerprint: 'pending-3',
  sourceApp: 'musicscale',
  signalType: 'musicscale_pending_responses',
  priority: 'high',
  titleKey: 'workspace.actions.musicscale_pending_responses.title',
  descriptionKey: 'workspace.actions.musicscale_pending_responses.description',
  translationParams: { count: 3 },
  destination: {
    kind: 'app',
    appId: 'musicscale',
    path: '/scales/scale-sunday'
  },
  organizationId: ORG_ID,
  evidence: [
    evidence,
    {
      ...evidence,
      organizationId: 'other-org',
      sourceRef: 'should-never-leak'
    }
  ]
};

const administrationAction: EvidenceBackedReadOnlyHubAction = {
  id: 'hub:pending-invites',
  dedupeKey: 'hub:pending-invites',
  fingerprint: 'invites-2',
  sourceApp: 'hub',
  signalType: 'pending_invites',
  priority: 'normal',
  titleKey: 'workspace.actions.pending_invites.title',
  descriptionKey: 'workspace.actions.pending_invites.description',
  translationParams: { count: 2 },
  destination: {
    kind: 'hub',
    section: 'members'
  },
  organizationId: ORG_ID,
  evidence: [{
    organizationId: ORG_ID,
    sourceApp: 'hub',
    sourceKind: 'runtime_projection',
    sourceRef: 'hub.read_model.pending_invites',
    entityType: 'organization',
    entityId: ORG_ID,
    observedAtMs: SUNDAY_MS
  }]
};

const distribution: EvidenceBackedMusicScaleDistributionSnapshot = {
  organizationId: ORG_ID,
  windowDays: 30,
  windowStartMs: SUNDAY_MS - (30 * 24 * 60 * 60 * 1000),
  windowEndMs: SUNDAY_MS,
  completedScheduleCount: 4,
  assignmentCount: 12,
  uniquePeople: 6,
  byFunction: [
    {
      functionName: 'Vocal',
      assignmentCount: 7,
      uniquePeople: 3,
      minAssignmentsPerPerson: 1,
      maxAssignmentsPerPerson: 4,
      averageAssignmentsPerPerson: 2.3
    },
    {
      functionName: 'Bateria',
      assignmentCount: 5,
      uniquePeople: 3,
      minAssignmentsPerPerson: 1,
      maxAssignmentsPerPerson: 2,
      averageAssignmentsPerPerson: 1.7
    }
  ],
  evidence: [{
    organizationId: ORG_ID,
    sourceApp: 'musicscale',
    sourceKind: 'runtime_projection',
    sourceRef: 'musicscale.read_model.completed_schedule_assignments_30d',
    entityType: 'worship_team',
    entityId: ORG_ID,
    observedAtMs: SUNDAY_MS
  }]
};

const baseMusicScale = {
  ready: true,
  observedAtMs: SUNDAY_MS,
  nextScale: {
    id: 'scale-sunday',
    startsAtMs: SUNDAY_MS,
    responseSummaryAvailable: true,
    pendingResponses: 3,
    declinedResponses: 1,
    repertoireSummaryAvailable: true,
    repertoireGapCount: 2
  },
  nextPersonalScale: {
    id: 'scale-personal',
    startsAtMs: SUNDAY_MS,
    pendingResponses: 1,
    responseSummaryAvailable: true
  }
};

const attention = answerAskMillionsNest({
  organizationId: ORG_ID,
  question: 'O que precisa da minha atenção hoje?',
  activeLens: 'my_today',
  lenses: [myTodayLens, worshipLens, administrationLens],
  actions: [worshipAction, administrationAction],
  musicScale: baseMusicScale,
  worshipDistribution: distribution,
  nowMs: SUNDAY_MS
});

assert.equal(attention.status, 'answered');
assert.equal(attention.intent, 'attention');
assert.equal(attention.translationParams?.count, 2);
assert.ok(attention.evidence.length >= 2);
assert.ok(
  attention.evidence.every(item => item.organizationId === ORG_ID),
  'Ask MillionsNest must strip cross-tenant evidence even if an upstream caller passes it'
);

const worshipDenied = answerAskMillionsNest({
  organizationId: ORG_ID,
  question: 'Como está domingo?',
  activeLens: 'my_today',
  lenses: [myTodayLens],
  actions: [worshipAction],
  musicScale: baseMusicScale,
  worshipDistribution: distribution
});

assert.equal(worshipDenied.status, 'not_available');
assert.equal(worshipDenied.intent, 'worship_service');
assert.equal(worshipDenied.evidence.length, 0);

const sunday = answerAskMillionsNest({
  organizationId: ORG_ID,
  question: 'Como está domingo?',
  activeLens: 'worship',
  lenses: [myTodayLens, worshipLens],
  actions: [worshipAction],
  musicScale: baseMusicScale,
  worshipDistribution: distribution
});

assert.equal(sunday.status, 'answered');
assert.equal(sunday.intent, 'worship_service');
assert.equal(sunday.facts.length, 3);
assert.ok(sunday.evidence.length > 0);
assert.equal(sunday.destination?.kind, 'app');
assert.equal(sunday.eventStartsAtMs, SUNDAY_MS);

const notSunday = answerAskMillionsNest({
  organizationId: ORG_ID,
  question: 'Como está domingo?',
  activeLens: 'worship',
  lenses: [myTodayLens, worshipLens],
  actions: [],
  musicScale: {
    ...baseMusicScale,
    nextScale: {
      ...baseMusicScale.nextScale,
      id: 'scale-wednesday',
      startsAtMs: WEDNESDAY_MS
    }
  },
  worshipDistribution: distribution
});

assert.equal(notSunday.status, 'insufficient_data');
assert.equal(notSunday.intent, 'worship_service');
assert.equal(notSunday.facts[0]?.key, 'ask.facts.next_scale_is_not_sunday');

const noResponseSummary = answerAskMillionsNest({
  organizationId: ORG_ID,
  question: 'Quem ainda não respondeu à escala?',
  activeLens: 'worship',
  lenses: [myTodayLens, worshipLens],
  actions: [],
  musicScale: {
    ...baseMusicScale,
    nextScale: {
      ...baseMusicScale.nextScale,
      responseSummaryAvailable: false
    }
  },
  worshipDistribution: distribution
});

assert.equal(noResponseSummary.status, 'insufficient_data');
assert.equal(noResponseSummary.intent, 'worship_confirmations');

const noRepertoireSummary = answerAskMillionsNest({
  organizationId: ORG_ID,
  question: 'Como está o repertório?',
  activeLens: 'worship',
  lenses: [myTodayLens, worshipLens],
  actions: [],
  musicScale: {
    ...baseMusicScale,
    nextScale: {
      ...baseMusicScale.nextScale,
      repertoireSummaryAvailable: false,
      repertoireGapCount: 0
    }
  },
  worshipDistribution: distribution
});

assert.equal(noRepertoireSummary.status, 'insufficient_data');
assert.equal(noRepertoireSummary.intent, 'worship_repertoire');

const workload = answerAskMillionsNest({
  organizationId: ORG_ID,
  question: 'Quem está acima da carga de serviço?',
  activeLens: 'worship',
  lenses: [myTodayLens, worshipLens],
  actions: [],
  musicScale: baseMusicScale,
  worshipDistribution: distribution
});

assert.equal(workload.status, 'insufficient_data');
assert.equal(workload.intent, 'worship_distribution');
assert.equal(workload.whyKey, 'ask.why.aggregate_only');
assert.ok(workload.evidence.length > 0);
assert.ok(
  !JSON.stringify(workload).includes('userId'),
  'Aggregate workload answers must not fabricate or expose person-level conclusions'
);

const personal = answerAskMillionsNest({
  organizationId: ORG_ID,
  question: 'Qual é minha próxima escala?',
  activeLens: 'my_today',
  lenses: [myTodayLens],
  actions: [],
  musicScale: baseMusicScale
});

assert.equal(personal.status, 'answered');
assert.equal(personal.intent, 'personal_schedule');
assert.ok(personal.evidence.length > 0);
assert.equal(personal.destination?.kind, 'app');

const journeyDenied = answerAskMillionsNest({
  organizationId: ORG_ID,
  question: 'Quem ainda aguarda acompanhamento?',
  activeLens: 'my_today',
  lenses: [myTodayLens],
  actions: [],
  musicScale: baseMusicScale
});

assert.equal(journeyDenied.status, 'not_available');

const journeyWithoutSource = answerAskMillionsNest({
  organizationId: ORG_ID,
  question: 'Quem ainda aguarda acompanhamento?',
  activeLens: 'journey',
  lenses: [myTodayLens, journeyLens],
  actions: [],
  musicScale: baseMusicScale
});

assert.equal(journeyWithoutSource.status, 'insufficient_data');
assert.equal(journeyWithoutSource.evidence.length, 0);

const unsupported = answerAskMillionsNest({
  organizationId: ORG_ID,
  question: 'Qual é a melhor decisão espiritual para esta pessoa?',
  activeLens: 'my_today',
  lenses: [myTodayLens],
  actions: [],
  musicScale: baseMusicScale
});

assert.equal(unsupported.status, 'unsupported');
assert.equal(unsupported.evidence.length, 0);

console.log('Ask MillionsNest evidence-first query checks passed.');
