import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  deriveClearedActionResolutions,
  hasValidResolutionIdentity,
  isActionResolutionEligible,
  isResolutionProjectionReady,
  resolutionMatchesAction,
  type ActionResolutionRecord
} from '../src/lib/actionResolution.js';
import type { ReadOnlyHubAction } from '../src/lib/actionCenter.js';
import { buildAdaptiveWorkspaceModel } from '../src/lib/adaptiveWorkspaceModel.js';

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
  scaleId = 'scale-1',
  fingerprint = 'fp-1'
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

function resolutionFor(
  action: ReadOnlyHubAction
): ActionResolutionRecord {
  if (!isActionResolutionEligible(action)) {
    throw new Error('Test action must be resolution eligible');
  }

  return {
    organizationId: 'org-action-loop',
    dedupeKey: action.dedupeKey,
    fingerprint: action.fingerprint,
    sourceApp: action.sourceApp,
    signalType: action.signalType,
    status: 'started',
    outcome: null,
    startedAtMs: 1_800_000_000_000
  };
}

const pendingAction = musicAction(
  'musicscale_pending_responses'
);
const declinedAction = musicAction(
  'musicscale_declined_responses'
);
const repertoireAction = musicAction(
  'musicscale_repertoire_content_gaps'
);
const assignedJourneyAction = journeyAction(
  'nestjourney_assigned_first_contacts'
);
const unassignedJourneyAction = journeyAction(
  'nestjourney_unassigned_first_contacts'
);

assert.equal(isActionResolutionEligible(pendingAction), true);
assert.equal(isActionResolutionEligible(declinedAction), true);
assert.equal(isActionResolutionEligible(repertoireAction), true);
assert.equal(
  isActionResolutionEligible(assignedJourneyAction),
  true,
  'assigned first-contact queue must participate in the Action Loop'
);
assert.equal(
  isActionResolutionEligible(unassignedJourneyAction),
  true,
  'unassigned first-contact queue must participate in the Action Loop'
);

assert.equal(
  hasValidResolutionIdentity({
    sourceApp: assignedJourneyAction.sourceApp,
    signalType: assignedJourneyAction.signalType,
    dedupeKey: assignedJourneyAction.dedupeKey
  }),
  true,
  'canonical Journey queue identity must be accepted'
);
assert.equal(
  hasValidResolutionIdentity({
    sourceApp: 'nestjourney',
    signalType: 'nestjourney_assigned_first_contacts',
    dedupeKey:
      'nestjourney:nestjourney_assigned_first_contacts:person-123'
  }),
  false,
  'Journey resolution identity must stay at aggregate queue level'
);
assert.equal(
  hasValidResolutionIdentity({
    sourceApp: 'musicscale',
    signalType: 'nestjourney_assigned_first_contacts',
    dedupeKey: assignedJourneyAction.dedupeKey
  }),
  false,
  'source app and signal type must remain a canonical pair'
);

const personalAction: ReadOnlyHubAction = {
  ...pendingAction,
  id: 'personal',
  dedupeKey: 'musicscale:personal_confirmation:scale-1',
  signalType: 'musicscale_personal_confirmation'
};
assert.equal(
  isActionResolutionEligible(personalAction),
  false,
  'personal confirmation must not create a managed resolution lifecycle'
);

const startedPending = resolutionFor(pendingAction);
assert.equal(
  resolutionMatchesAction(startedPending, pendingAction),
  true
);

assert.equal(
  isResolutionProjectionReady(
    startedPending,
    EMPTY_MUSIC_READINESS
  ),
  false,
  'bootstrap without a scale snapshot must never imply resolution'
);

assert.deepEqual(
  deriveClearedActionResolutions({
    resolutions: [startedPending],
    sourceActions: [],
    musicScaleReadiness: {
      scalesReady: true,
      songsReady: true,
      nextScaleId: 'scale-1',
      responseSummaryAvailable: false
    }
  }),
  [],
  'same-scale managed response resolution must wait for its response summary'
);

assert.deepEqual(
  deriveClearedActionResolutions({
    resolutions: [startedPending],
    sourceActions: [pendingAction],
    musicScaleReadiness: {
      scalesReady: true,
      songsReady: true,
      nextScaleId: 'scale-1',
      responseSummaryAvailable: true
    }
  }),
  [],
  'an action that still exists in canonical source projection is not resolved'
);

assert.deepEqual(
  deriveClearedActionResolutions({
    resolutions: [startedPending],
    sourceActions: [],
    musicScaleReadiness: {
      scalesReady: true,
      songsReady: false,
      nextScaleId: 'scale-1',
      responseSummaryAvailable: true
    }
  }).map(item => item.dedupeKey),
  [pendingAction.dedupeKey],
  'pending response action closes only after a complete response projection no longer emits it'
);

const changedPendingAction = musicAction(
  'musicscale_pending_responses',
  'scale-1',
  'fp-2'
);
assert.deepEqual(
  deriveClearedActionResolutions({
    resolutions: [startedPending],
    sourceActions: [changedPendingAction],
    musicScaleReadiness: {
      scalesReady: true,
      songsReady: false,
      nextScaleId: 'scale-1',
      responseSummaryAvailable: true
    }
  }).map(item => item.fingerprint),
  ['fp-1'],
  'a materially changed fingerprint closes the old resolution while the new situation remains independently actionable'
);

assert.deepEqual(
  deriveClearedActionResolutions({
    resolutions: [startedPending],
    sourceActions: [],
    musicScaleReadiness: {
      scalesReady: true,
      songsReady: false,
      nextScaleId: 'scale-2',
      responseSummaryAvailable: false
    }
  }).map(item => item.dedupeKey),
  [pendingAction.dedupeKey],
  'once scales are loaded, moving away from the original scale may close the old signal without waiting for the new scale response summary'
);

const startedRepertoire = resolutionFor(repertoireAction);
assert.deepEqual(
  deriveClearedActionResolutions({
    resolutions: [startedRepertoire],
    sourceActions: [],
    musicScaleReadiness: {
      scalesReady: true,
      songsReady: false,
      nextScaleId: 'scale-1',
      responseSummaryAvailable: true
    }
  }),
  [],
  'same-scale repertoire outcome must wait for the song library'
);
assert.deepEqual(
  deriveClearedActionResolutions({
    resolutions: [startedRepertoire],
    sourceActions: [],
    musicScaleReadiness: {
      scalesReady: true,
      songsReady: true,
      nextScaleId: 'scale-1',
      responseSummaryAvailable: false
    }
  }).map(item => item.dedupeKey),
  [repertoireAction.dedupeKey]
);

const startedAssignedJourney =
  resolutionFor(assignedJourneyAction);

assert.equal(
  isResolutionProjectionReady(
    startedAssignedJourney,
    EMPTY_MUSIC_READINESS,
    { ready: false }
  ),
  false,
  'Journey bootstrap must never imply a cleared care queue'
);
assert.equal(
  isResolutionProjectionReady(
    startedAssignedJourney,
    EMPTY_MUSIC_READINESS,
    { ready: true }
  ),
  true,
  'a valid Journey queue can be evaluated only after its tenant-bound projection is ready'
);

assert.deepEqual(
  deriveClearedActionResolutions({
    resolutions: [startedAssignedJourney],
    sourceActions: [assignedJourneyAction],
    musicScaleReadiness: EMPTY_MUSIC_READINESS,
    journeyReadiness: { ready: true }
  }),
  [],
  'an active Journey care queue must remain unresolved'
);

assert.deepEqual(
  deriveClearedActionResolutions({
    resolutions: [startedAssignedJourney],
    sourceActions: [],
    musicScaleReadiness: EMPTY_MUSIC_READINESS,
    journeyReadiness: { ready: false }
  }),
  [],
  'an absent Journey signal before projection readiness must fail closed'
);

assert.deepEqual(
  deriveClearedActionResolutions({
    resolutions: [startedAssignedJourney],
    sourceActions: [],
    musicScaleReadiness: EMPTY_MUSIC_READINESS,
    journeyReadiness: { ready: true }
  }).map(item => item.dedupeKey),
  [assignedJourneyAction.dedupeKey],
  'an absent Journey queue may close only after a ready canonical projection'
);

const changedAssignedJourney = journeyAction(
  'nestjourney_assigned_first_contacts',
  'journey-fp-2'
);
assert.deepEqual(
  deriveClearedActionResolutions({
    resolutions: [startedAssignedJourney],
    sourceActions: [changedAssignedJourney],
    musicScaleReadiness: EMPTY_MUSIC_READINESS,
    journeyReadiness: { ready: true }
  }).map(item => item.fingerprint),
  ['journey-fp-1'],
  'a changed Journey queue fingerprint closes only the old snapshot'
);

// Preference filtering must not be mistaken for an outcome.
const adaptive = buildAdaptiveWorkspaceModel({
  organizationId: 'org-action-loop',
  authorizedDomains: {
    pastoral: false,
    journey: false,
    worship: true,
    finance: false,
    administration: false
  },
  entitledAppIds: ['musicscale'],
  requestedLens: 'worship',
  organization: { isConfigured: true },
  permissions: {
    canManageOrganization: false,
    canManageMembers: false,
    canReadManagedMusicScaleResponses: true
  },
  pendingInvitesCount: 0,
  musicScale: {
    ready: true,
    nextScale: {
      id: 'scale-1',
      responseSummaryAvailable: true,
      pendingResponses: 1
    }
  },
  actionPreferences: [
    {
      dedupeKey: 'musicscale:pending_responses:scale-1',
      fingerprint: 'musicscale:pending_responses:scale-1:1',
      mode: 'dismissed'
    }
  ]
});

assert.equal(
  adaptive.actions.length,
  0,
  'dismissed action may disappear from the personal visible list'
);
assert.equal(
  adaptive.sourceActions.length,
  1,
  'canonical source action must remain available to Outcome Engine before preference filtering'
);

const server = readFileSync(
  'src/server/services/ActionResolutionCommandService.ts',
  'utf8'
);
assert.match(
  server,
  /access\.isGlobalAccess === true/,
  'global ecosystem access must not substitute for ministry resolution authority'
);
assert.match(
  server,
  /scaleResponses\.readManaged/,
  'server must require managed MusicScale response authority'
);
assert.match(
  server,
  /JOURNEY_SIGNAL_RESOLUTION_AUTHORITY_REQUIRED/,
  'Journey resolution must fail closed when queue-specific authority is absent'
);
assert.match(
  server,
  /hasValidResolutionIdentity/,
  'server must reject forged or non-canonical resolution targets before persistence'
);
assert.match(
  server,
  /capabilities\.canManageCare === true/,
  'assigned Journey queue resolution must require care authority'
);
assert.match(
  server,
  /capabilities\.canCoordinateJourney === true/,
  'unassigned Journey queue resolution must support canonical coordinator authority'
);
assert.match(
  server,
  /capabilities\.canManagePastoral === true/,
  'unassigned Journey queue resolution must support canonical pastoral authority'
);
assert.match(
  server,
  /status: 'started'/,
  'server must persist the start of a resolution'
);
assert.match(
  server,
  /status: 'outcome_observed'/,
  'server must persist classified factual outcomes through the Outcome Engine'
);
assert.match(
  server,
  /cleared_observed/,
  'server must keep backward-compatible reads for legacy cleared_observed records'
);
assert.match(
  server,
  /ACTION_RESOLUTION_NOT_STARTED/,
  'Outcome Engine must not manufacture outcomes without a started resolution'
);
assert.equal(
  server.includes('titleKey'),
  false,
  'resolution audit records must not store user-facing action copy'
);

const serverRoutes = readFileSync('server.ts', 'utf8');
for (const route of [
  '/action-resolutions',
  '/action-resolution/start',
  '/action-resolution/outcome'
]) {
  assert.equal(
    serverRoutes.includes(route),
    true,
    `server must expose ${route}`
  );
}

const dashboard = readFileSync('src/pages/Dashboard.tsx', 'utf8');
assert.match(
  dashboard,
  /scalesReady: false/,
  'scale projection readiness must start false'
);
assert.match(
  dashboard,
  /live\.scalesReady = true/,
  'successful scale snapshot must mark the source ready'
);
assert.match(
  dashboard,
  /musicScaleProjection\?\.isGlobalAccess !== true/,
  'Dashboard must not fetch worship resolution state for global-only access'
);
assert.match(
  dashboard,
  /currentNestJourneyProjection\?\.canReadJourneyOperational === true/,
  'Dashboard must load Journey resolution state only from canonical operational authority'
);
assert.match(
  dashboard,
  /currentNestJourneyProjection\?\.isGlobalAccess !== true/,
  'Dashboard must not fetch Journey ministry resolution state for global-only access'
);

const home = readFileSync(
  'src/components/dashboard/EcosystemWorkspaceHome.tsx',
  'utf8'
);
assert.match(
  home,
  /adaptiveWorkspace\.sourceActions/,
  'Outcome observer must use source actions before snooze/dismiss preferences'
);
assert.match(
  home,
  /<ActionResolutionObserver/,
  'Adaptive Home must observe factual resolution outcomes'
);
assert.match(
  home,
  /journeyReadiness=\{journeyResolutionReadiness\}/,
  'Adaptive Home must pass tenant-bound Journey readiness to the Outcome Engine'
);
assert.match(
  home,
  /continue_resolution_action/,
  'started resolutions must become Continue resolution instead of creating duplicates'
);
assert.match(
  home,
  /resolve_action/,
  'eligible evidence-backed actions must expose Resolver'
);

for (const language of ['pt', 'en', 'es']) {
  const locale = readFileSync(
    `src/packages/i18n/locales/${language}.ts`,
    'utf8'
  );
  for (const key of [
    'resolve_action',
    'continue_resolution_action',
    'resolution_in_progress',
    'resolution_start_error',
    'resolution_cleared_feedback'
  ]) {
    assert.equal(
      locale.includes(key),
      true,
      `${language} must include ${key}`
    );
  }
}

console.log('Action Loop Resolver and factual outcome checks passed.');
