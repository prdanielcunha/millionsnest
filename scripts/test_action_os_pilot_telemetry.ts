import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  buildActionOsAnalyticsPayload,
} from '../src/lib/actionOsAnalytics.js';

const actionPayload = buildActionOsAnalyticsPayload({
  organizationId: 'org-1',
  userId: 'user-1',
  kind: 'action_opened',
  lane: 'action',
  sourceApp: 'musicscale',
  signalType: 'musicscale_personal_confirmation',
  priority: 'high',
});

assert.deepEqual(actionPayload, {
  organizationId: 'org-1',
  userId: 'user-1',
  app: 'millionsnest_core',
  metadata: {
    action: 'action_opened',
    lane: 'action',
    sourceApp: 'musicscale',
    signalType: 'musicscale_personal_confirmation',
    priority: 'high',
  },
});

const changePayload = buildActionOsAnalyticsPayload({
  organizationId: 'org-1',
  userId: 'user-1',
  kind: 'change_reviewed',
  lane: 'change',
  sourceApp: 'musicscale',
});

assert.deepEqual(changePayload?.metadata, {
  action: 'change_reviewed',
  lane: 'change',
  sourceApp: 'musicscale',
});

const commitmentPayload = buildActionOsAnalyticsPayload({
  organizationId: 'org-1',
  userId: 'user-1',
  kind: 'commitment_opened',
  lane: 'commitment',
  sourceApp: 'musicscale',
});

assert.equal(
  commitmentPayload?.metadata.action,
  'commitment_opened'
);

assert.equal(
  buildActionOsAnalyticsPayload({
    organizationId: '',
    userId: 'user-1',
    kind: 'action_opened',
    lane: 'action',
    sourceApp: 'hub',
  }),
  null,
  'telemetry must fail quiet without an organization'
);

assert.equal(
  buildActionOsAnalyticsPayload({
    organizationId: 'org-1',
    userId: '',
    kind: 'action_opened',
    lane: 'action',
    sourceApp: 'hub',
  }),
  null,
  'telemetry must fail quiet without an authenticated user'
);

const unsafeSignal = buildActionOsAnalyticsPayload({
  organizationId: 'org-1',
  userId: 'user-1',
  kind: 'action_opened',
  lane: 'action',
  sourceApp: 'hub',
  signalType: 'Visitor Maria needs pastoral care: call 43 99999-9999',
  priority: 'normal',
});

assert.deepEqual(unsafeSignal?.metadata, {
  action: 'action_opened',
  lane: 'action',
  sourceApp: 'hub',
  priority: 'normal',
});

const forbiddenMetadataKeys = new Set([
  'entityId',
  'sourceEntityId',
  'notificationId',
  'dedupeKey',
  'fingerprint',
  'title',
  'name',
  'message',
  'description',
  'reason',
  'email',
  'phone',
  'whatsapp',
  'amount',
  'value',
  'notes',
]);

for (const payload of [
  actionPayload,
  changePayload,
  commitmentPayload,
  unsafeSignal,
]) {
  assert.ok(payload);
  const keys = Object.keys(payload!.metadata);
  for (const key of keys) {
    assert.ok(
      !forbiddenMetadataKeys.has(key),
      `Action OS telemetry must not contain sensitive/free-text key: ${key}`
    );
  }

  assert.ok(
    keys.every(key =>
      ['action', 'lane', 'sourceApp', 'signalType', 'priority']
        .includes(key)
    ),
    'Action OS telemetry metadata must stay inside the explicit allowlist'
  );
}

const actionOsAnalyticsSource = readFileSync(
  resolve('src/lib/actionOsAnalytics.ts'),
  'utf8'
);

for (const forbidden of [
  'sourceEntityId',
  'notificationId',
  'dedupeKey',
  'fingerprint',
  'title:',
  'message:',
  'description:',
  'reason:',
  'email:',
  'phone:',
  'whatsapp:',
]) {
  assert.ok(
    !actionOsAnalyticsSource.includes(forbidden),
    `pilot telemetry source must not introduce ${forbidden}`
  );
}

const analyticsSource = readFileSync(
  resolve('src/lib/analytics.ts'),
  'utf8'
);

assert.match(
  analyticsSource,
  /\| 'action_os_interaction'/,
  'existing analytics infrastructure must recognize Action OS pilot interactions'
);

const growthSetStart = analyticsSource.indexOf(
  'const growthMirrorEventTypes'
);
const growthSetEnd = analyticsSource.indexOf(
  ']);',
  growthSetStart
);
assert.ok(
  growthSetStart >= 0 && growthSetEnd > growthSetStart,
  'growth mirror event allowlist must remain explicit'
);

const growthSet = analyticsSource.slice(
  growthSetStart,
  growthSetEnd + 3
);

assert.ok(
  !growthSet.includes('action_os_interaction'),
  'Action OS pilot telemetry must stay tenant-scoped and out of the global growth mirror'
);

const dashboardSource = readFileSync(
  resolve('src/pages/Dashboard.tsx'),
  'utf8'
);

assert.match(
  dashboardSource,
  /kind:\s*mode === 'snoozed'[\s\S]*?'action_snoozed'[\s\S]*?'action_dismissed'/,
  'successful snooze/dismiss interactions must be distinguished'
);

const preferencePersistIndex = dashboardSource.indexOf(
  'const preference = await saveActionPreference'
);
const preferenceGuardIndex = dashboardSource.indexOf(
  'if (!preference || activeContextOrgId !== orgId) return;',
  preferencePersistIndex
);
const preferenceTrackIndex = dashboardSource.indexOf(
  'trackActionOsInteraction({',
  preferenceGuardIndex
);

assert.ok(
  preferencePersistIndex >= 0 &&
  preferenceGuardIndex > preferencePersistIndex &&
  preferenceTrackIndex > preferenceGuardIndex,
  'snooze/dismiss telemetry must only fire after preference persistence succeeds'
);

assert.match(
  dashboardSource,
  /organizationId:\s*activeContextOrgId,[\s\S]*?userId:\s*user\.uid,[\s\S]*?\.\.\.interaction/,
  'workspace interactions must receive authenticated tenant and user attribution'
);

const workspaceSource = readFileSync(
  resolve('src/components/dashboard/EcosystemWorkspaceHome.tsx'),
  'utf8'
);

for (const kind of [
  'action_opened',
  'change_reviewed',
  'commitment_opened',
]) {
  assert.match(
    workspaceSource,
    new RegExp(`kind:\\s*['"]${kind}['"]`),
    `workspace must track ${kind}`
  );
}

assert.ok(
  !workspaceSource.includes('onActionOsInteraction({\n        sourceEntityId:'),
  'workspace telemetry must not pass source entity IDs'
);

console.log('Action OS privacy-safe pilot telemetry checks passed.');
