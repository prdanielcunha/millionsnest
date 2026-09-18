import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  deriveMusicScaleAssignmentDistribution,
  hasMusicScaleDistributionData,
  WORSHIP_DISTRIBUTION_WINDOW_DAYS,
  WORSHIP_DISTRIBUTION_WINDOW_MS
} from '../src/lib/musicScaleDistributionIntelligence.js';
import {
  deriveEvidenceBackedMusicScaleDistribution,
  projectMusicScaleDistributionFact
} from '../src/lib/musicScaleDistributionFactProjection.js';
import { isCanonicalFactValid } from '../src/packages/events/factContract.js';

const nowMs = Date.parse('2026-09-18T12:00:00Z');
const day = 86_400_000;

const scales = [
  {
    id: 'completed-1',
    status: 'completed',
    startsAtMs: nowMs - 2 * day,
    eventAssignments: [
      {
        eventAssignmentId: 'a-1',
        userId: 'private-user-a',
        functionName: 'Vocal',
        active: true
      },
      {
        eventAssignmentId: 'a-2',
        userId: 'private-user-b',
        functionName: 'Vocal',
        active: true
      },
      {
        eventAssignmentId: 'a-3',
        userId: 'private-user-a',
        functionName: 'Violão',
        active: true
      },
      // Duplicate assignment record must not inflate the distribution.
      {
        eventAssignmentId: 'a-3',
        userId: 'private-user-a',
        functionName: 'Violão',
        active: true
      }
    ]
  },
  {
    id: 'completed-2',
    status: 'completed',
    startsAtMs: nowMs - 8 * day,
    eventAssignments: [
      {
        eventAssignmentId: 'b-1',
        userId: 'private-user-a',
        functionName: 'Vocal',
        active: true
      },
      {
        eventAssignmentId: 'b-2',
        userId: 'private-user-c',
        functionName: 'Vocal',
        active: true
      },
      {
        eventAssignmentId: 'b-3',
        userId: 'private-user-c',
        functionName: 'Teclado',
        active: false
      },
      // Legacy assignment without eventAssignmentId uses person+function
      // fallback and should still count once per completed schedule.
      {
        userId: 'private-user-d',
        functionName: 'Bateria',
        active: true
      },
      {
        userId: 'private-user-d',
        functionName: 'Bateria',
        active: true
      }
    ]
  },
  // Duplicate schedule document in the read model must not double count.
  {
    id: 'completed-2',
    status: 'completed',
    startsAtMs: nowMs - 8 * day,
    eventAssignments: [
      {
        eventAssignmentId: 'b-1',
        userId: 'private-user-a',
        functionName: 'Vocal',
        active: true
      }
    ]
  },
  {
    id: 'draft-recent',
    status: 'draft',
    startsAtMs: nowMs - day,
    eventAssignments: [
      {
        eventAssignmentId: 'draft-a',
        userId: 'private-user-x',
        functionName: 'Baixo',
        active: true
      }
    ]
  },
  {
    id: 'cancelled-recent',
    status: 'cancelled',
    startsAtMs: nowMs - day,
    eventAssignments: [
      {
        eventAssignmentId: 'cancel-a',
        userId: 'private-user-x',
        functionName: 'Baixo',
        active: true
      }
    ]
  },
  {
    id: 'old-completed',
    status: 'completed',
    startsAtMs: nowMs - WORSHIP_DISTRIBUTION_WINDOW_MS - 1,
    eventAssignments: [
      {
        eventAssignmentId: 'old-a',
        userId: 'private-user-z',
        functionName: 'Sax',
        active: true
      }
    ]
  },
  {
    id: 'future-completed',
    status: 'completed',
    startsAtMs: nowMs + 1,
    eventAssignments: [
      {
        eventAssignmentId: 'future-a',
        userId: 'private-user-z',
        functionName: 'Sax',
        active: true
      }
    ]
  }
];

const snapshot = deriveMusicScaleAssignmentDistribution(
  scales,
  nowMs
);

assert.equal(snapshot.windowDays, WORSHIP_DISTRIBUTION_WINDOW_DAYS);
assert.equal(snapshot.windowEndMs, nowMs);
assert.equal(
  snapshot.windowStartMs,
  nowMs - WORSHIP_DISTRIBUTION_WINDOW_MS
);
assert.equal(
  snapshot.completedScheduleCount,
  2,
  'only unique completed schedules inside the 30-day window may count'
);
assert.equal(snapshot.assignmentCount, 6);
assert.equal(snapshot.uniquePeople, 4);
assert.equal(hasMusicScaleDistributionData(snapshot), true);

assert.deepEqual(snapshot.byFunction, [
  {
    functionName: 'Bateria',
    assignmentCount: 1,
    uniquePeople: 1,
    minAssignmentsPerPerson: 1,
    maxAssignmentsPerPerson: 1,
    averageAssignmentsPerPerson: 1
  },
  {
    functionName: 'Violão',
    assignmentCount: 1,
    uniquePeople: 1,
    minAssignmentsPerPerson: 1,
    maxAssignmentsPerPerson: 1,
    averageAssignmentsPerPerson: 1
  },
  {
    functionName: 'Vocal',
    assignmentCount: 4,
    uniquePeople: 3,
    minAssignmentsPerPerson: 1,
    maxAssignmentsPerPerson: 2,
    averageAssignmentsPerPerson: 1.3
  }
]);

const serialized = JSON.stringify(snapshot);
for (const privateId of [
  'private-user-a',
  'private-user-b',
  'private-user-c',
  'private-user-d'
]) {
  assert.equal(
    serialized.includes(privateId),
    false,
    'aggregate snapshot must not expose person identifiers'
  );
}

assert.equal(
  Object.prototype.hasOwnProperty.call(snapshot, 'score'),
  false,
  'distribution must remain descriptive instead of inventing an evaluation score'
);
assert.equal(
  Object.prototype.hasOwnProperty.call(snapshot, 'balanced'),
  false,
  'distribution must not classify the team as balanced/unbalanced'
);

const organizationId = 'org-worship-distribution';
const fact = projectMusicScaleDistributionFact({
  organizationId,
  snapshot,
  observedAtMs: nowMs
});

assert.ok(fact);
assert.equal(isCanonicalFactValid(fact!), true);
assert.equal(
  fact!.eventType,
  'musicscale.team.assignment_distribution_observed'
);
assert.equal(fact!.organizationId, organizationId);
assert.equal(fact!.entity.type, 'worship_team');
assert.equal(fact!.entity.id, organizationId);
assert.equal(
  fact!.source.sourceRef,
  'musicscale.read_model.completed_schedule_assignments_30d'
);
assert.equal(fact!.source.sourceApp, 'musicscale');
assert.equal(fact!.source.organizationId, organizationId);
assert.equal(
  JSON.stringify(fact!.metadata).includes('private-user'),
  false,
  'canonical distribution fact metadata must remain aggregate-only'
);

const evidenceBacked = deriveEvidenceBackedMusicScaleDistribution({
  organizationId,
  snapshot,
  observedAtMs: nowMs
});

assert.ok(evidenceBacked);
assert.equal(evidenceBacked!.organizationId, organizationId);
assert.equal(evidenceBacked!.evidence.length, 1);
assert.equal(
  evidenceBacked!.evidence[0].sourceRef,
  'musicscale.read_model.completed_schedule_assignments_30d'
);

assert.equal(
  deriveEvidenceBackedMusicScaleDistribution({
    organizationId: '   ',
    snapshot,
    observedAtMs: nowMs
  }),
  null,
  'missing tenant identity must fail closed'
);

const emptySnapshot = deriveMusicScaleAssignmentDistribution(
  [],
  nowMs
);
assert.equal(hasMusicScaleDistributionData(emptySnapshot), false);

const dashboard = readFileSync('src/pages/Dashboard.tsx', 'utf8');
assert.match(
  dashboard,
  /deriveMusicScaleAssignmentDistribution/,
  'Dashboard must derive distribution from its already-loaded MusicScale scale read model'
);
assert.match(
  dashboard,
  /live\.scales\.map\(scale => \(\{/,
  'distribution must reuse loaded scales instead of introducing a separate data source'
);
assert.match(
  dashboard,
  /canReadWorshipDistribution/,
  'Dashboard must not amplify distribution data outside worship-domain authority'
);
assert.match(
  dashboard,
  /musicScaleProjection\?\.isGlobalAccess !== true/,
  'global ecosystem access alone must not unlock worship distribution'
);

const home = readFileSync(
  'src/components/dashboard/EcosystemWorkspaceHome.tsx',
  'utf8'
);
assert.match(
  home,
  /adaptiveWorkspace\.activeLens === 'worship'/,
  'distribution snapshot must be visible only inside the Worship Lens'
);
assert.match(
  home,
  /deriveEvidenceBackedMusicScaleDistribution/,
  'visible distribution must pass through canonical evidence'
);
assert.match(
  home,
  /<MusicScaleDistributionSnapshot/,
  'Worship Lens must render the dedicated distribution snapshot'
);

const component = readFileSync(
  'src/components/dashboard/MusicScaleDistributionSnapshot.tsx',
  'utf8'
);
assert.equal(
  component.includes('userId'),
  false,
  'presentation component must not receive person identifiers'
);

for (const language of ['pt', 'en', 'es']) {
  const locale = readFileSync(
    `src/packages/i18n/locales/${language}.ts`,
    'utf8'
  );
  assert.match(
    locale,
    /worship_distribution:\s*\{/,
    `${language} must include the Worship distribution experience`
  );
}

console.log('MusicScale Worship distribution intelligence checks passed.');
