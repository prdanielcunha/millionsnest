import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  projectCurrentMusicScaleFacts
} from '../src/lib/musicScaleFactProjection.js';
import {
  deriveEvidenceBackedHubCommitments,
  PREPARATION_WINDOW_MS
} from '../src/lib/commitmentCenter.js';
import {
  projectMusicScaleChangeFacts
} from '../src/lib/musicScaleChangeFactProjection.js';
import {
  deriveEvidenceBackedHubChanges
} from '../src/lib/changeCenter.js';

const organizationId = 'org-evidence-timeline';
const nowMs = 1_800_000_000_000;

const commitmentScale = {
  id: 'scale-commitment-1',
  date: '2027-01-15',
  time: '19:30',
  startsAtMs: nowMs + 2 * 86_400_000,
  songCount: 5,
  functionNames: ['Vocal', 'Vocal', 'Ministro'],
  publishRevision: 4,
  responseSummaryAvailable: true,
  pendingResponses: 0
};

const commitmentFacts = projectCurrentMusicScaleFacts({
  organizationId,
  ready: true,
  observedAtMs: nowMs - 1_000,
  projectionNowMs: nowMs,
  nextScale: null,
  nextPersonalScale: commitmentScale
});

const commitmentFact = commitmentFacts.find(
  fact => fact.eventType === 'musicscale.scale.personal_commitment_observed'
);
assert.ok(commitmentFact);
assert.equal(commitmentFact!.organizationId, organizationId);
assert.equal(commitmentFact!.source.organizationId, organizationId);
assert.equal(commitmentFact!.source.sourceApp, 'musicscale');
assert.equal(
  commitmentFact!.source.sourceRef,
  'musicscale.read_model.personal_schedule_commitment'
);
assert.equal(commitmentFact!.entity.id, commitmentScale.id);
assert.deepEqual(
  commitmentFact!.metadata.functionNames,
  ['Vocal', 'Ministro']
);
assert.equal(commitmentFact!.metadata.songCount, 5);

const commitments = deriveEvidenceBackedHubCommitments({
  organizationId,
  musicScale: {
    ready: true,
    observedAtMs: nowMs - 1_000,
    nextPersonalScale: commitmentScale
  }
}, nowMs);

assert.equal(commitments.length, 1);
assert.equal(commitments[0]?.organizationId, organizationId);
assert.equal(commitments[0]?.sourceEntityId, commitmentScale.id);
assert.equal(commitments[0]?.evidence.length, 1);
assert.equal(
  commitments[0]?.evidence[0]?.sourceRef,
  'musicscale.read_model.personal_schedule_commitment'
);
assert.equal(commitments[0]?.songCount, 5);
assert.deepEqual(commitments[0]?.functionNames, ['Vocal', 'Ministro']);

const farFutureScale = {
  ...commitmentScale,
  id: 'scale-too-far',
  startsAtMs: nowMs + PREPARATION_WINDOW_MS + 1
};

const farFutureFacts = projectCurrentMusicScaleFacts({
  organizationId,
  ready: true,
  projectionNowMs: nowMs,
  nextScale: null,
  nextPersonalScale: farFutureScale
});
assert.ok(
  farFutureFacts.some(
    fact => fact.eventType === 'musicscale.scale.personal_commitment_observed'
  ),
  'a future commitment can remain valid source truth outside the current UI preparation window'
);
assert.deepEqual(
  deriveEvidenceBackedHubCommitments({
    organizationId,
    musicScale: {
      ready: true,
      nextPersonalScale: farFutureScale
    }
  }, nowMs),
  [],
  'a valid fact outside the 7-day preparation window must not become a visible commitment yet'
);

assert.deepEqual(
  deriveEvidenceBackedHubCommitments({
    organizationId: '   ',
    musicScale: {
      ready: true,
      nextPersonalScale: commitmentScale
    }
  }, nowMs),
  []
);

const notifications = [
  {
    id: 'notification-old-rev',
    type: 'music_scale_changed',
    createdAtMs: nowMs - 10_000,
    isRead: false,
    metadata: {
      musicScaleId: 'scale-change-1',
      publishRevision: 8,
      preparationChangeSummary: {
        codes: ['song_added', 'song_key_changed', 'not_allowed']
      }
    }
  },
  {
    id: 'notification-new-rev',
    type: 'music_scale_changed',
    createdAtMs: nowMs - 5_000,
    isRead: true,
    metadata: {
      musicScaleId: 'scale-change-1',
      publishRevision: 8,
      preparationChangeSummary: {
        codes: ['song_key_changed']
      },
      functionsChanged: true
    }
  }
];

const changeFacts = projectMusicScaleChangeFacts({
  organizationId,
  notifications
});
assert.equal(changeFacts.length, 2);
assert.ok(changeFacts.every(fact => fact.organizationId === organizationId));
assert.ok(changeFacts.every(fact => fact.source.sourceKind === 'firestore_document'));
assert.equal(
  changeFacts[0]?.source.sourceRef,
  `organizations/${organizationId}/notifications/notification-old-rev`
);
assert.equal(changeFacts[0]?.entity.id, 'scale-change-1');
assert.deepEqual(
  changeFacts[0]?.metadata.codes,
  ['song_added', 'song_key_changed']
);
assert.deepEqual(
  changeFacts[1]?.metadata.codes,
  ['song_key_changed', 'function_changed']
);

const changes = deriveEvidenceBackedHubChanges(
  organizationId,
  notifications,
  nowMs
);

assert.equal(
  changes.length,
  1,
  'same scale/revision must dedupe to the newest source notification'
);
assert.equal(changes[0]?.sourceNotificationId, 'notification-new-rev');
assert.equal(changes[0]?.organizationId, organizationId);
assert.equal(changes[0]?.isRead, true);
assert.deepEqual(
  changes[0]?.codes,
  ['song_key_changed', 'function_changed']
);
assert.equal(
  changes[0]?.evidence[0]?.sourceRef,
  `organizations/${organizationId}/notifications/notification-new-rev`
);

const oldNotification = {
  id: 'notification-too-old',
  type: 'music_scale_changed',
  createdAtMs: nowMs - 15 * 86_400_000,
  isRead: false,
  metadata: {
    musicScaleId: 'scale-old',
    publishRevision: 1
  }
};
assert.equal(
  projectMusicScaleChangeFacts({
    organizationId,
    notifications: [oldNotification]
  }).length,
  1,
  'an old source notification remains a valid fact'
);
assert.deepEqual(
  deriveEvidenceBackedHubChanges(
    organizationId,
    [oldNotification],
    nowMs
  ),
  [],
  'an old valid fact outside the Changes horizon must not remain visible'
);

assert.deepEqual(
  projectMusicScaleChangeFacts({
    organizationId,
    notifications: [
      {
        id: 'wrong-type',
        type: 'something_else',
        createdAtMs: nowMs,
        isRead: false,
        metadata: { musicScaleId: 'scale-x' }
      },
      {
        id: 'missing-scale',
        type: 'music_scale_changed',
        createdAtMs: nowMs,
        isRead: false,
        metadata: {}
      }
    ]
  }),
  []
);

assert.deepEqual(
  deriveEvidenceBackedHubChanges(
    '   ',
    notifications,
    nowMs
  ),
  []
);

const home = readFileSync(
  'src/components/dashboard/EcosystemWorkspaceHome.tsx',
  'utf8'
);

assert.match(
  home,
  /deriveEvidenceBackedHubCommitments/,
  'visible Home must use evidence-backed Commitment Center projection'
);
assert.match(
  home,
  /deriveEvidenceBackedHubChanges/,
  'visible Home must use evidence-backed Change Center projection'
);
assert.equal(
  /deriveReadOnlyHubCommitments\s*\(/.test(home),
  false,
  'visible Home must not bypass canonical commitment evidence'
);
assert.equal(
  /deriveReadOnlyHubChanges\s*\(/.test(home),
  false,
  'visible Home must not bypass canonical change evidence'
);

console.log('Evidence-backed commitments and changes checks passed.');
