import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  deriveActionOutcomePulse
} from '../src/lib/actionOutcomePulse.js';
import type {
  ActionResolutionReadWindow,
  ActionResolutionRecord
} from '../src/lib/actionResolution.js';

const ORG_ID = 'org-outcome-pulse';
const OTHER_ORG = 'org-other';
const NOW = Date.UTC(2026, 8, 22, 12, 0, 0);
const DAY = 24 * 60 * 60 * 1000;

function resolution(input: {
  organizationId?: string;
  sourceApp:
    | 'musicscale'
    | 'nestjourney';
  signalType:
    ActionResolutionRecord['signalType'];
  outcome:
    ActionResolutionRecord['outcome'];
  observedAtMs: number;
  status?: ActionResolutionRecord['status'];
}): ActionResolutionRecord {
  return {
    organizationId:
      input.organizationId ?? ORG_ID,
    dedupeKey:
      input.sourceApp === 'musicscale'
        ? 'musicscale:pending_responses:scale-1'
        : input.signalType ===
            'nestjourney_assigned_first_contacts'
          ? 'nestjourney:nestjourney_assigned_first_contacts:assigned:first_contact'
          : 'nestjourney:nestjourney_unassigned_first_contacts:unassigned:first_contact',
    fingerprint:
      input.sourceApp +
      ':' +
      input.signalType +
      ':' +
      input.observedAtMs,
    sourceApp: input.sourceApp,
    signalType: input.signalType,
    status:
      input.status ??
      'outcome_observed',
    outcome: input.outcome,
    outcomeCode: null,
    startedAtMs:
      input.observedAtMs - 60_000,
    updatedAtMs:
      input.observedAtMs,
    outcomeObservedAtMs:
      input.observedAtMs
  };
}

const completeWindow: ActionResolutionReadWindow = {
  complete: true,
  limit: 100,
  observedAtMs: NOW
};

const records: ActionResolutionRecord[] = [
  resolution({
    sourceApp: 'nestjourney',
    signalType:
      'nestjourney_assigned_first_contacts',
    outcome: 'resolved',
    observedAtMs: NOW - DAY
  }),
  resolution({
    sourceApp: 'nestjourney',
    signalType:
      'nestjourney_unassigned_first_contacts',
    outcome: 'superseded',
    observedAtMs: NOW - 2 * DAY
  }),
  resolution({
    sourceApp: 'musicscale',
    signalType:
      'musicscale_pending_responses',
    outcome: 'resolved',
    observedAtMs: NOW - 3 * DAY
  }),
  resolution({
    sourceApp: 'musicscale',
    signalType:
      'musicscale_pending_responses',
    outcome: 'no_longer_actionable',
    observedAtMs: NOW - 4 * DAY
  }),
  resolution({
    sourceApp: 'musicscale',
    signalType:
      'musicscale_pending_responses',
    outcome: 'resolved',
    observedAtMs: NOW - 8 * DAY
  }),
  resolution({
    sourceApp: 'musicscale',
    signalType:
      'musicscale_pending_responses',
    outcome: 'resolved',
    observedAtMs: NOW + 1
  }),
  resolution({
    organizationId: OTHER_ORG,
    sourceApp: 'nestjourney',
    signalType:
      'nestjourney_assigned_first_contacts',
    outcome: 'resolved',
    observedAtMs: NOW - DAY
  }),
  resolution({
    sourceApp: 'nestjourney',
    signalType:
      'nestjourney_assigned_first_contacts',
    outcome: null,
    observedAtMs: NOW - DAY,
    status: 'started'
  })
];

const myToday = deriveActionOutcomePulse({
  organizationId: ORG_ID,
  activeLens: 'my_today',
  resolutions: records,
  readWindow: completeWindow,
  nowMs: NOW
});

assert.ok(myToday);
assert.equal(myToday?.complete, true);
assert.equal(myToday?.windowDays, 7);
assert.equal(
  myToday?.totalObservedCount,
  4
);
assert.equal(myToday?.resolvedCount, 2);
assert.equal(
  myToday?.supersededCount,
  1
);
assert.equal(
  myToday?.noLongerActionableCount,
  1
);
assert.equal(
  myToday?.nestJourneyCount,
  2
);
assert.equal(
  myToday?.musicScaleCount,
  2
);
assert.equal(
  myToday?.latestOutcomeAtMs,
  NOW - DAY
);

const journey = deriveActionOutcomePulse({
  organizationId: ORG_ID,
  activeLens: 'journey',
  resolutions: records,
  readWindow: completeWindow,
  nowMs: NOW
});

assert.ok(journey);
assert.equal(
  journey?.totalObservedCount,
  2
);
assert.equal(journey?.resolvedCount, 1);
assert.equal(
  journey?.supersededCount,
  1
);
assert.equal(
  journey?.noLongerActionableCount,
  0
);
assert.equal(
  journey?.musicScaleCount,
  0
);

const worship = deriveActionOutcomePulse({
  organizationId: ORG_ID,
  activeLens: 'worship',
  resolutions: records,
  readWindow: completeWindow,
  nowMs: NOW
});

assert.ok(worship);
assert.equal(
  worship?.totalObservedCount,
  2
);
assert.equal(worship?.resolvedCount, 1);
assert.equal(
  worship?.noLongerActionableCount,
  1
);
assert.equal(
  worship?.nestJourneyCount,
  0
);

for (const lens of [
  'pastoral',
  'finance',
  'administration'
] as const) {
  assert.equal(
    deriveActionOutcomePulse({
      organizationId: ORG_ID,
      activeLens: lens,
      resolutions: records,
      readWindow: completeWindow,
      nowMs: NOW
    }),
    null,
    `${lens} must not inherit Action Loop outcome history from another domain`
  );
}

const partial = deriveActionOutcomePulse({
  organizationId: ORG_ID,
  activeLens: 'my_today',
  resolutions: records,
  readWindow: {
    complete: false,
    limit: 100,
    observedAtMs: NOW
  },
  nowMs: NOW
});

assert.ok(partial);
assert.equal(partial?.complete, false);
assert.equal(partial?.readLimit, 100);
assert.equal(
  partial?.totalObservedCount,
  4,
  'partial reads keep factual observed counts but must be rendered as lower bounds'
);

assert.equal(
  deriveActionOutcomePulse({
    organizationId: ORG_ID,
    activeLens: 'my_today',
    resolutions: [],
    readWindow: completeWindow,
    nowMs: NOW
  }),
  null,
  'an empty history must not become a synthetic zero-outcomes claim'
);

assert.equal(
  deriveActionOutcomePulse({
    organizationId: ORG_ID,
    activeLens: 'my_today',
    resolutions: records,
    readWindow: null,
    nowMs: NOW
  }),
  null,
  'missing read metadata must fail closed'
);

const server = readFileSync(
  'src/server/services/ActionResolutionCommandService.ts',
  'utf8'
);
assert.match(
  server,
  /readWindow:\s*\{/
);
assert.match(
  server,
  /snapshot\.size < MAX_RESOLUTIONS/
);
assert.match(
  server,
  /limit:\s*MAX_RESOLUTIONS/
);
assert.match(
  server,
  /observedAtMs/
);

const client = readFileSync(
  'src/services/actionCenterClient.ts',
  'utf8'
);
assert.match(
  client,
  /fetchActionResolutionSnapshot/
);
assert.match(
  client,
  /complete:\s*window\?\.complete === true/
);
assert.match(
  client,
  /fetchActionResolutions/
);

const dashboard = readFileSync(
  'src/pages/Dashboard.tsx',
  'utf8'
);
assert.match(
  dashboard,
  /actionResolutionReadWindow/
);
assert.match(
  dashboard,
  /fetchActionResolutionSnapshot/
);
assert.match(
  dashboard,
  /actionResolutionReadWindow=\{actionResolutionReadWindow\}/
);

const home = readFileSync(
  'src/components/dashboard/EcosystemWorkspaceHome.tsx',
  'utf8'
);
assert.match(
  home,
  /deriveActionOutcomePulse/
);
assert.match(
  home,
  /<ActionOutcomePulse/
);

const component = readFileSync(
  'src/components/dashboard/ActionOutcomePulse.tsx',
  'utf8'
);
assert.match(
  component,
  /String\(value\) \+ '\+'/
);
assert.match(
  component,
  /value > 0/
);
assert.match(
  component,
  /snapshot\.complete/
);
assert.match(
  component,
  /outcome_pulse\.partial_note/
);

for (const source of [
  readFileSync(
    'src/lib/actionOutcomePulse.ts',
    'utf8'
  ),
  component
]) {
  for (const forbidden of [
    'personName',
    'personId',
    'phone',
    'email',
    'pastoralNote',
    'privateNote'
  ]) {
    assert.equal(
      source.includes(forbidden),
      false,
      `Outcome Pulse must not depend on ${forbidden}`
    );
  }
}

for (const language of [
  'pt',
  'en',
  'es'
]) {
  const locale = readFileSync(
    `src/packages/i18n/locales/${language}.ts`,
    'utf8'
  );

  for (const key of [
    'outcome_pulse',
    'evidence_note',
    'partial_note',
    'left_window',
    'source_journey',
    'source_musicscale'
  ]) {
    assert.equal(
      locale.includes(key),
      true,
      `${language} dashboard must include ${key}`
    );
  }
}

console.log(
  'Action Loop Outcome Pulse lens scoping, bounded reads and privacy checks passed.'
);
