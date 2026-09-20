import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { ReadOnlyHubAction } from '../src/lib/actionCenter.js';
import type { ActionResolutionRecord } from '../src/lib/actionResolution.js';
import {
  deriveActionOutcomeObservations,
  isValidOutcomeForSignal
} from '../src/lib/outcomeEngine.js';

const EMPTY_MUSIC_READINESS = {
  scalesReady: false,
  songsReady: false,
  nextScaleId: null,
  responseSummaryAvailable: false
};

function musicAction(
  signalType:
    | 'musicscale_pending_responses'
    | 'musicscale_declined_responses'
    | 'musicscale_repertoire_content_gaps',
  fingerprint = 'fp-1',
  scaleId = 'scale-1'
): ReadOnlyHubAction {
  const prefix =
    signalType === 'musicscale_pending_responses'
      ? 'pending_responses'
      : signalType === 'musicscale_declined_responses'
        ? 'declined_responses'
        : 'repertoire_content';

  return {
    id: `musicscale:${prefix}:${scaleId}`,
    dedupeKey: `musicscale:${prefix}:${scaleId}`,
    fingerprint,
    sourceApp: 'musicscale',
    signalType,
    priority: 'high',
    titleKey: 'test.title',
    descriptionKey: 'test.description',
    destination: {
      kind: 'app',
      appId: 'musicscale',
      path: `/scales/${scaleId}`
    }
  };
}

function journeyAction(
  signalType:
    | 'nestjourney_assigned_first_contacts'
    | 'nestjourney_unassigned_first_contacts',
  fingerprint = 'journey-fp-1'
): ReadOnlyHubAction {
  const entityId =
    signalType === 'nestjourney_assigned_first_contacts'
      ? 'assigned:first_contact'
      : 'unassigned:first_contact';

  return {
    id: `nestjourney:${signalType}:${entityId}`,
    dedupeKey: `nestjourney:${signalType}:${entityId}`,
    fingerprint,
    sourceApp: 'nestjourney',
    signalType,
    priority: 'urgent',
    titleKey: 'test.title',
    descriptionKey: 'test.description',
    destination: {
      kind: 'app',
      appId: 'nestjourney',
      path:
        signalType === 'nestjourney_assigned_first_contacts'
          ? '/followup-runtime'
          : '/care-integrity'
    }
  };
}

function resolution(
  source: ReadOnlyHubAction
): ActionResolutionRecord {
  if (
    source.sourceApp !== 'musicscale' &&
    source.sourceApp !== 'nestjourney'
  ) {
    throw new Error('Unsupported test resolution source');
  }

  return {
    organizationId: 'org-outcome',
    dedupeKey: source.dedupeKey,
    fingerprint: source.fingerprint,
    sourceApp: source.sourceApp,
    signalType:
      source.signalType as
        ActionResolutionRecord['signalType'],
    status: 'started',
    outcome: null
  };
}

const pending = musicAction(
  'musicscale_pending_responses'
);
const pendingResolution =
  resolution(pending);

assert.deepEqual(
  deriveActionOutcomeObservations({
    resolutions: [pendingResolution],
    sourceActions: [pending],
    musicScaleReadiness: {
      scalesReady: true,
      songsReady: true,
      nextScaleId: 'scale-1',
      responseSummaryAvailable: true
    }
  }),
  [],
  'an exact active source signal must never become an outcome'
);

const changedPending = musicAction(
  'musicscale_pending_responses',
  'fp-2'
);

const superseded =
  deriveActionOutcomeObservations({
    resolutions: [pendingResolution],
    sourceActions: [changedPending],
    musicScaleReadiness: {
      scalesReady: true,
      songsReady: true,
      nextScaleId: 'scale-1',
      responseSummaryAvailable: true
    }
  });

assert.equal(superseded.length, 1);
assert.equal(
  superseded[0].result,
  'superseded'
);
assert.equal(
  superseded[0].code,
  'source_signal_updated'
);
assert.equal(
  superseded[0].resolution.fingerprint,
  'fp-1',
  'old resolution is closed as superseded while the new fingerprint remains independently actionable'
);

const stale =
  deriveActionOutcomeObservations({
    resolutions: [pendingResolution],
    sourceActions: [],
    musicScaleReadiness: {
      scalesReady: true,
      songsReady: false,
      nextScaleId: 'scale-2',
      responseSummaryAvailable: false
    }
  });

assert.equal(stale.length, 1);
assert.equal(
  stale[0].result,
  'no_longer_actionable'
);
assert.equal(
  stale[0].code,
  'target_left_active_window',
  'leaving the current scale window must not be falsely reported as resolved'
);

assert.deepEqual(
  deriveActionOutcomeObservations({
    resolutions: [pendingResolution],
    sourceActions: [],
    musicScaleReadiness: {
      scalesReady: true,
      songsReady: false,
      nextScaleId: 'scale-1',
      responseSummaryAvailable: false
    }
  }),
  [],
  'current response outcome must wait for a complete response projection'
);

const resolvedPending =
  deriveActionOutcomeObservations({
    resolutions: [pendingResolution],
    sourceActions: [],
    musicScaleReadiness: {
      scalesReady: true,
      songsReady: false,
      nextScaleId: 'scale-1',
      responseSummaryAvailable: true
    }
  });

assert.equal(
  resolvedPending[0]?.result,
  'resolved'
);
assert.equal(
  resolvedPending[0]?.code,
  'musicscale_pending_responses_cleared'
);

const repertoire = musicAction(
  'musicscale_repertoire_content_gaps'
);
const repertoireResolution =
  resolution(repertoire);

assert.deepEqual(
  deriveActionOutcomeObservations({
    resolutions: [repertoireResolution],
    sourceActions: [],
    musicScaleReadiness: {
      scalesReady: true,
      songsReady: false,
      nextScaleId: 'scale-1',
      responseSummaryAvailable: true
    }
  }),
  [],
  'repertoire resolution must wait for the song projection, not the response projection'
);

const resolvedRepertoire =
  deriveActionOutcomeObservations({
    resolutions: [repertoireResolution],
    sourceActions: [],
    musicScaleReadiness: {
      scalesReady: true,
      songsReady: true,
      nextScaleId: 'scale-1',
      responseSummaryAvailable: false
    }
  });

assert.equal(
  resolvedRepertoire[0]?.result,
  'resolved'
);
assert.equal(
  resolvedRepertoire[0]?.code,
  'musicscale_repertoire_content_cleared'
);

const assignedJourney = journeyAction(
  'nestjourney_assigned_first_contacts'
);
const assignedJourneyResolution =
  resolution(assignedJourney);

assert.deepEqual(
  deriveActionOutcomeObservations({
    resolutions: [assignedJourneyResolution],
    sourceActions: [assignedJourney],
    musicScaleReadiness: EMPTY_MUSIC_READINESS,
    journeyReadiness: { ready: true }
  }),
  [],
  'an exact active Journey care queue must never become an outcome'
);

assert.deepEqual(
  deriveActionOutcomeObservations({
    resolutions: [assignedJourneyResolution],
    sourceActions: [],
    musicScaleReadiness: EMPTY_MUSIC_READINESS,
    journeyReadiness: { ready: false }
  }),
  [],
  'Journey absence before projection readiness must fail closed'
);

const resolvedAssignedJourney =
  deriveActionOutcomeObservations({
    resolutions: [assignedJourneyResolution],
    sourceActions: [],
    musicScaleReadiness: EMPTY_MUSIC_READINESS,
    journeyReadiness: { ready: true }
  });

assert.equal(
  resolvedAssignedJourney.length,
  1
);
assert.equal(
  resolvedAssignedJourney[0].result,
  'resolved'
);
assert.equal(
  resolvedAssignedJourney[0].code,
  'nestjourney_assigned_first_contacts_cleared'
);
assert.equal(
  resolvedAssignedJourney[0].targetId,
  'assigned:first_contact',
  'Journey Outcome Engine must keep the target at privacy-safe queue level'
);

const changedAssignedJourney = journeyAction(
  'nestjourney_assigned_first_contacts',
  'journey-fp-2'
);
const supersededJourney =
  deriveActionOutcomeObservations({
    resolutions: [assignedJourneyResolution],
    sourceActions: [changedAssignedJourney],
    musicScaleReadiness: EMPTY_MUSIC_READINESS,
    journeyReadiness: { ready: true }
  });

assert.equal(
  supersededJourney[0]?.result,
  'superseded'
);
assert.equal(
  supersededJourney[0]?.code,
  'source_signal_updated'
);

const unassignedJourney = journeyAction(
  'nestjourney_unassigned_first_contacts'
);
const unassignedJourneyResolution =
  resolution(unassignedJourney);
const resolvedUnassignedJourney =
  deriveActionOutcomeObservations({
    resolutions: [unassignedJourneyResolution],
    sourceActions: [],
    musicScaleReadiness: EMPTY_MUSIC_READINESS,
    journeyReadiness: { ready: true }
  });

assert.equal(
  resolvedUnassignedJourney[0]?.code,
  'nestjourney_unassigned_first_contacts_cleared'
);

assert.equal(
  isValidOutcomeForSignal({
    signalType:
      'musicscale_pending_responses',
    result: 'resolved',
    code:
      'musicscale_pending_responses_cleared'
  }),
  true
);
assert.equal(
  isValidOutcomeForSignal({
    signalType:
      'musicscale_declined_responses',
    result: 'resolved',
    code:
      'musicscale_pending_responses_cleared'
  }),
  false,
  'server contract must reject a resolved code that does not match the signal type'
);
assert.equal(
  isValidOutcomeForSignal({
    signalType:
      'musicscale_declined_responses',
    result: 'superseded',
    code: 'source_signal_updated'
  }),
  true
);
assert.equal(
  isValidOutcomeForSignal({
    signalType:
      'nestjourney_assigned_first_contacts',
    result: 'resolved',
    code:
      'nestjourney_assigned_first_contacts_cleared'
  }),
  true,
  'Journey queue resolution must use its exact factual outcome code'
);
assert.equal(
  isValidOutcomeForSignal({
    signalType:
      'nestjourney_assigned_first_contacts',
    result: 'no_longer_actionable',
    code: 'target_left_active_window'
  }),
  false,
  'Journey queues must never inherit MusicScale active-window semantics'
);

const observer = readFileSync(
  'src/components/dashboard/ActionResolutionObserver.tsx',
  'utf8'
);
assert.match(
  observer,
  /deriveActionOutcomeObservations/,
  'runtime observer must use the classified Outcome Engine'
);
assert.match(
  observer,
  /journeyReadiness/,
  'runtime observer must require explicit Journey projection readiness'
);
assert.equal(
  observer.includes(
    'deriveClearedActionResolutions'
  ),
  false,
  'runtime must not use the legacy absence-equals-resolved projection'
);

const client = readFileSync(
  'src/services/actionCenterClient.ts',
  'utf8'
);
assert.match(
  client,
  /outcomeResult: ActionOutcomeResult/
);
assert.match(
  client,
  /outcomeCode: ActionOutcomeCode/
);
assert.equal(
  /outcome:\s*['"]signal_cleared['"]/.test(
    client
  ),
  false,
  'client must submit explicit classified outcomes rather than a generic signal_cleared flag'
);

const server = readFileSync(
  'src/server/services/ActionResolutionCommandService.ts',
  'utf8'
);
assert.match(
  server,
  /isValidOutcomeForSignal/
);
assert.match(
  server,
  /status: 'outcome_observed'/
);
assert.match(
  server,
  /authorized_canonical_projection/,
  'MusicScale outcomes must keep the authorized canonical projection basis'
);
assert.match(
  server,
  /server_revalidated_canonical_projection/,
  'Journey outcomes must record server-side canonical source revalidation'
);
assert.match(
  server,
  /ACTION_RESOLUTION_IDENTITY_MISMATCH/
);
assert.match(
  server,
  /ACTION_RESOLUTION_NOT_STARTED/
);
assert.match(
  server,
  /JOURNEY_SIGNAL_RESOLUTION_AUTHORITY_REQUIRED/,
  'server must authorize Journey outcomes with queue-specific canonical capability'
);

const dashboard = readFileSync(
  'src/pages/Dashboard.tsx',
  'utf8'
);
for (const key of [
  'outcome_resolved_feedback',
  'outcome_superseded_feedback',
  'outcome_no_longer_actionable_feedback'
]) {
  assert.equal(
    dashboard.includes(key),
    true,
    `Dashboard must distinguish ${key}`
  );
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
    'outcome_resolved_feedback',
    'outcome_superseded_feedback',
    'outcome_no_longer_actionable_feedback'
  ]) {
    assert.equal(
      locale.includes(key),
      true,
      `${language} must include ${key}`
    );
  }
}

console.log(
  'Outcome Engine classification, anti-false-resolution and Journey queue outcome checks passed.'
);
