import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  deriveCurrentMusicScaleChangeSources,
  deriveEvidenceBackedHubChanges,
  deriveReadOnlyHubChanges,
  CHANGE_HORIZON_DAYS,
} from '../src/lib/changeCenter.js';

const now = Date.parse('2026-09-09T12:00:00Z');

const change = {
  id: 'notif-1',
  type: 'music_scale_changed',
  createdAtMs: now - 60_000,
  isRead: false,
  metadata: {
    musicScaleId: 'scale-1',
    publishRevision: 3,
    functionsChanged: true,
    preparationChangeSummary: {
      changed: true,
      codes: [
        'song_key_changed',
        'song_reordered',
        'time_changed',
        'unknown_code',
      ],
    },
  },
};

const projected = deriveReadOnlyHubChanges([change], now);

assert.equal(projected.length, 1);
assert.equal(projected[0]?.sourceApp, 'musicscale');
assert.equal(projected[0]?.sourceEntityId, 'scale-1');
assert.equal(projected[0]?.publishRevision, 3);
assert.equal(projected[0]?.isRead, false);
assert.deepEqual(projected[0]?.codes, [
  'song_key_changed',
  'song_reordered',
  'time_changed',
  'function_changed',
]);
assert.deepEqual(projected[0]?.destination, {
  kind: 'app',
  appId: 'musicscale',
  path: '/scales/scale-1',
});

assert.deepEqual(
  deriveReadOnlyHubChanges([
    {
      ...change,
      id: 'notif-other',
      type: 'music_scale_published',
    },
  ], now),
  [],
  'non-change notifications must never enter the Changes lane'
);

assert.deepEqual(
  deriveReadOnlyHubChanges([
    {
      ...change,
      id: 'notif-no-source',
      metadata: {
        publishRevision: 2,
        preparationChangeSummary: {
          changed: true,
          codes: ['time_changed'],
        },
      },
    },
  ], now),
  [],
  'a change without a stable source entity must fail quiet'
);

assert.deepEqual(
  deriveReadOnlyHubChanges([
    {
      ...change,
      id: 'notif-old',
      createdAtMs:
        now - (CHANGE_HORIZON_DAYS + 1) * 86_400_000,
    },
  ], now),
  [],
  'old notifications must not live forever in the Hub'
);

const duplicateRevision = deriveReadOnlyHubChanges([
  change,
  {
    ...change,
    id: 'notif-2',
    createdAtMs: now - 30_000,
  },
], now);

assert.equal(
  duplicateRevision.length,
  1,
  'the same scale revision must not create duplicate change cards'
);
assert.equal(
  duplicateRevision[0]?.sourceNotificationId,
  'notif-2',
  'the newest notification should win deduplication'
);

const generic = deriveReadOnlyHubChanges([
  {
    ...change,
    id: 'notif-generic',
    metadata: {
      musicScaleId: 'scale-2',
      publishRevision: 1,
      preparationChangeSummary: {
        changed: true,
        codes: [],
      },
    },
  },
], now);

assert.deepEqual(
  generic[0]?.codes,
  ['scale_changed'],
  'a factual change notification with no supported detail must stay honest and generic'
);

const currentSources = deriveCurrentMusicScaleChangeSources(
  [
    {
      id: 'scale-1',
      status: 'published',
      startsAtMs: now + 60_000,
    },
    {
      id: 'scale-passed',
      status: 'published',
      startsAtMs: now,
    },
    {
      id: 'scale-completed',
      status: 'completed',
      startsAtMs: now + 120_000,
    },
    {
      id: 'scale-cancelled',
      status: 'cancelled',
      startsAtMs: now + 120_000,
    },
    {
      id: 'scale-deleted',
      status: 'published',
      startsAtMs: now + 120_000,
      deletedAt: now - 1_000,
    },
    {
      id: 'scale-archived',
      status: 'published',
      startsAtMs: now + 120_000,
      isArchived: true,
    },
    {
      id: 'scale-inactive',
      status: 'published',
      startsAtMs: now + 120_000,
      active: false,
    },
    {
      id: 'scale-draft',
      status: 'draft',
      startsAtMs: now + 120_000,
    },
  ],
  now
);

assert.deepEqual(
  currentSources,
  [
    {
      sourceApp: 'musicscale',
      sourceEntityType: 'scale',
      sourceEntityId: 'scale-1',
      validUntilMs: now + 60_000,
    },
  ],
  'only source scales that still exist and have not started may remain reviewable'
);

const evidenceBackedCurrent = deriveEvidenceBackedHubChanges(
  'org-1',
  [change],
  {
    nowMs: now,
    currentSourceEntities: currentSources,
  }
);

assert.equal(
  evidenceBackedCurrent.length,
  1,
  'a factual change may be shown while its live source entity is still current'
);

assert.deepEqual(
  deriveEvidenceBackedHubChanges(
    'org-1',
    [change],
    {
      nowMs: now,
      currentSourceEntities: [],
    }
  ),
  [],
  'a deleted or otherwise absent source entity must disappear immediately from Changes'
);

assert.deepEqual(
  deriveEvidenceBackedHubChanges(
    'org-1',
    [change],
    {
      nowMs: now,
      currentSourceEntities: [
        {
          sourceApp: 'musicscale',
          sourceEntityType: 'scale',
          sourceEntityId: 'scale-1',
          validUntilMs: now,
        },
      ],
    }
  ),
  [],
  'a source entity must disappear from Changes as soon as its review window expires'
);

const dashboardSource = readFileSync(
  resolve('src/pages/Dashboard.tsx'),
  'utf8'
);

assert.match(
  dashboardSource,
  /organizations\/\$\{orgId\}\/notifications/,
  'Dashboard must read the canonical organization notification collection'
);

assert.match(
  dashboardSource,
  /where\('recipientId', '==', user\.uid\)/,
  'Dashboard change listener must be explicitly recipient-scoped'
);

assert.match(
  dashboardSource,
  /where\('isArchived', '==', false\)/,
  'Dashboard must ignore archived notifications'
);

assert.match(
  dashboardSource,
  /notification\.type === 'music_scale_changed'/,
  'Dashboard must only pass factual MusicScale change notifications to the Changes projection'
);

assert.match(
  dashboardSource,
  /isRead:\s*true/,
  'reviewing a change in the Hub must acknowledge the source notification'
);

assert.match(
  dashboardSource,
  /readAt:\s*new Date\(\)\.toISOString\(\)/,
  'change acknowledgement must preserve the canonical notification read timestamp'
);

assert.match(
  dashboardSource,
  /deriveCurrentMusicScaleChangeSources/,
  'Dashboard must reconcile source notifications against the live MusicScale scale snapshot'
);

assert.match(
  dashboardSource,
  /changeFreshnessTimer\s*=\s*setTimeout/,
  'Dashboard must expire source-bound changes when time passes even without a Firestore write'
);

assert.match(
  dashboardSource,
  /changeSourceEntities/,
  'Dashboard must publish the current source-entity set alongside its live MusicScale summary'
);

const workspaceSource = readFileSync(
  resolve('src/components/dashboard/EcosystemWorkspaceHome.tsx'),
  'utf8'
);

assert.match(
  workspaceSource,
  /deriveEvidenceBackedHubChanges/,
  'Hub workspace must use the evidence-backed dedicated Changes domain'
);

assert.match(
  workspaceSource,
  /<EcosystemChanges/,
  'Hub workspace must render Changes as a separate semantic lane'
);

assert.match(
  workspaceSource,
  /onAcknowledgeMusicScaleChange\(\s*change\.sourceNotificationId/,
  'opening a change must acknowledge the exact source notification'
);

assert.match(
  workspaceSource,
  /currentSourceEntities:\s*musicScaleSummary\.changeSourceEntities/,
  'visible Changes must be gated by the current source entities from the app'
);

assert.match(
  workspaceSource,
  /musicScaleSummary\.readiness\.scalesReady/,
  'Changes must fail closed until the source scale snapshot is ready'
);

for (const language of ['pt', 'en', 'es']) {
  const localeSource = readFileSync(
    resolve(`src/packages/i18n/locales/${language}.ts`),
    'utf8'
  );

  assert.match(
    localeSource,
    /changes:\s*\{/,
    `${language} locale must include the Changes experience`
  );
}

console.log('Change Center projection and private listener checks passed.');
