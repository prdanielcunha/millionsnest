import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
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

const workspaceSource = readFileSync(
  resolve('src/components/dashboard/EcosystemWorkspaceHome.tsx'),
  'utf8'
);

assert.match(
  workspaceSource,
  /deriveReadOnlyHubChanges/,
  'Hub workspace must use the dedicated Changes domain'
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
