import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { ReadOnlyHubAction } from '../src/lib/actionCenter.js';
import {
  selectNextBestMinistryAction
} from '../src/lib/nextBestMinistryAction.js';
import type {
  ActionResolutionRecord
} from '../src/lib/actionResolution.js';

function action(input: {
  key: string;
  priority: ReadOnlyHubAction['priority'];
  dueAtMs?: number | null;
  signalType?:
    | 'musicscale_pending_responses'
    | 'musicscale_declined_responses'
    | 'musicscale_repertoire_content_gaps';
}): ReadOnlyHubAction {
  return {
    id: input.key,
    dedupeKey: input.key,
    fingerprint: `fp:${input.key}`,
    sourceApp: 'musicscale',
    signalType:
      input.signalType ??
      'musicscale_pending_responses',
    priority: input.priority,
    titleKey: 'test.title',
    descriptionKey: 'test.description',
    destination: {
      kind: 'app',
      appId: 'musicscale',
      path: '/scales/scale-1'
    },
    dueAtMs: input.dueAtMs ?? null
  };
}

function startedResolution(
  target: ReadOnlyHubAction
): ActionResolutionRecord {
  return {
    organizationId: 'org-nbma',
    dedupeKey: target.dedupeKey,
    fingerprint: target.fingerprint,
    sourceApp: 'musicscale',
    signalType:
      target.signalType as ActionResolutionRecord['signalType'],
    status: 'started',
    outcome: null
  };
}

const highA = action({
  key: 'musicscale:pending_responses:scale-a',
  priority: 'high'
});
const highB = action({
  key: 'musicscale:declined_responses:scale-b',
  priority: 'high',
  signalType: 'musicscale_declined_responses'
});
const normalInProgress = action({
  key: 'musicscale:repertoire_content:scale-c',
  priority: 'normal',
  signalType: 'musicscale_repertoire_content_gaps'
});

const canonical = selectNextBestMinistryAction({
  actions: [normalInProgress, highB, highA],
  resolutions: []
});
assert.equal(canonical?.action.dedupeKey, highA.dedupeKey);
assert.equal(canonical?.reason, 'high_priority');

const samePriorityContinuity = selectNextBestMinistryAction({
  actions: [highA, highB, normalInProgress],
  resolutions: [startedResolution(highB)]
});
assert.equal(
  samePriorityContinuity?.action.dedupeKey,
  highB.dedupeKey,
  'started work may win only inside the top canonical priority tier'
);
assert.equal(
  samePriorityContinuity?.reason,
  'continue_resolution'
);

const lowerPriorityContinuity = selectNextBestMinistryAction({
  actions: [normalInProgress, highA],
  resolutions: [startedResolution(normalInProgress)]
});
assert.equal(
  lowerPriorityContinuity?.action.dedupeKey,
  highA.dedupeKey,
  'a lower-priority started resolution must never outrank a higher-priority action'
);
assert.equal(lowerPriorityContinuity?.reason, 'high_priority');

const nowMs = 1_800_000_000_000;
const dueSoon = action({
  key: 'musicscale:repertoire_content:scale-d',
  priority: 'normal',
  dueAtMs: nowMs + 2 * 60 * 60 * 1000,
  signalType: 'musicscale_repertoire_content_gaps'
});
const noDue = action({
  key: 'musicscale:repertoire_content:scale-e',
  priority: 'normal',
  signalType: 'musicscale_repertoire_content_gaps'
});

const dueSelection = selectNextBestMinistryAction({
  actions: [noDue, dueSoon],
  nowMs
});
assert.equal(dueSelection?.action.dedupeKey, dueSoon.dedupeKey);
assert.equal(dueSelection?.reason, 'due_soon');

const urgent = action({
  key: 'musicscale:pending_responses:urgent',
  priority: 'urgent',
  dueAtMs: nowMs + 100 * 24 * 60 * 60 * 1000
});
assert.equal(
  selectNextBestMinistryAction({
    actions: [highA, urgent],
    nowMs
  })?.reason,
  'urgent_priority'
);

assert.equal(
  selectNextBestMinistryAction({
    actions: [],
    resolutions: []
  }),
  null
);

const selectorSource = readFileSync(
  'src/lib/nextBestMinistryAction.ts',
  'utf8'
);
assert.equal(
  /score|weight|llm|gemini|openai/i.test(selectorSource),
  false,
  'NBMA v1 must not depend on hidden scores, weights or model calls'
);
assert.match(
  selectorSource,
  /sortActionsForActionCenter/,
  'NBMA must reuse the canonical Action Center order'
);
assert.match(
  selectorSource,
  /action\.priority === canonicalFirst\.priority/,
  'resolution continuity must stay inside the top priority tier'
);

const actionCenter = readFileSync(
  'src/lib/actionCenter.ts',
  'utf8'
);
assert.match(
  actionCenter,
  /export function sortActionsForActionCenter/,
  'canonical action ordering must be a shared explicit contract'
);

const home = readFileSync(
  'src/components/dashboard/EcosystemWorkspaceHome.tsx',
  'utf8'
);
assert.match(
  home,
  /selectNextBestMinistryAction/,
  'Adaptive Home must consume the deterministic NBMA selector'
);
assert.match(
  home,
  /nextBestAction\?\.action\.dedupeKey/,
  'recommendation badge must match the exact selected action'
);
assert.match(
  home,
  /workspace\.actions\.nbma/,
  'Home must explain the recommendation rationale'
);

for (const language of ['pt', 'en', 'es']) {
  const locale = readFileSync(
    `src/packages/i18n/locales/${language}.ts`,
    'utf8'
  );
  for (const key of [
    'recommended',
    'continue_resolution',
    'urgent_priority',
    'high_priority',
    'due_soon',
    'next_in_queue'
  ]) {
    assert.equal(
      locale.includes(key),
      true,
      `${language} must include NBMA rationale ${key}`
    );
  }
}

console.log('Explainable Next Best Ministry Action checks passed.');
