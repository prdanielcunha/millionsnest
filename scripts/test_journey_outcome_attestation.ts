import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  fingerprintNestJourneyQueue
} from '../src/lib/actionSignals.js';
import {
  attestNestJourneyOutcome
} from '../src/lib/journeyOutcomeAttestation.js';
import type {
  ActionResolutionRecord
} from '../src/lib/actionResolution.js';
import type {
  NestJourneyQueueSummary,
  NestJourneyWorkspaceProjection
} from '../src/lib/nestJourneyWorkspaceProjection.js';

const now = 1_800_000_000_000;

function queue(input: {
  count: number;
  overdueCount?: number;
  dueSoonCount?: number;
  earliestDueAtMs?: number | null;
}): NestJourneyQueueSummary {
  return {
    count: input.count,
    overdueCount:
      input.overdueCount ?? 0,
    dueSoonCount:
      input.dueSoonCount ?? 0,
    earliestDueAtMs:
      input.earliestDueAtMs ?? null,
    evidence: []
  };
}

function projection(input?: {
  assigned?: NestJourneyQueueSummary;
  unassigned?: NestJourneyQueueSummary;
  ready?: boolean;
  accessible?: boolean;
  isGlobalAccess?: boolean;
  organizationId?: string;
}): NestJourneyWorkspaceProjection {
  return {
    appId: 'nestjourney',
    organizationId:
      input?.organizationId ??
      'org-attestation',
    accessible:
      input?.accessible ?? true,
    isGlobalAccess:
      input?.isGlobalAccess ?? false,
    decisionState:
      input?.accessible === false
        ? 'denied'
        : 'granted',
    denialReason: null,
    responsibility: 'coordinator',
    canReadJourneyOperational: true,
    capabilities: {
      canManagePresence: true,
      canManageMesa: true,
      canManagePeople: true,
      canManageCare: true,
      canManageGroups: true,
      canManageDiscipleship: true,
      canManageImplementation: true,
      canManagePastoral: false,
      canViewGovernance: false,
      canCoordinateJourney: true
    },
    congregationIds: [],
    ready: input?.ready ?? true,
    observedAtMs: now,
    assignedFirstContacts:
      input?.assigned ?? queue({ count: 0 }),
    unassignedFirstContacts:
      input?.unassigned ?? queue({ count: 0 })
  };
}

function resolution(input: {
  signalType:
    | 'nestjourney_assigned_first_contacts'
    | 'nestjourney_unassigned_first_contacts';
  fingerprint: string;
}): ActionResolutionRecord {
  const queueId =
    input.signalType ===
      'nestjourney_assigned_first_contacts'
      ? 'assigned:first_contact'
      : 'unassigned:first_contact';

  return {
    organizationId: 'org-attestation',
    dedupeKey:
      `nestjourney:${input.signalType}:${queueId}`,
    fingerprint: input.fingerprint,
    sourceApp: 'nestjourney',
    signalType: input.signalType,
    status: 'started',
    outcome: null
  };
}

const clearedAssigned = attestNestJourneyOutcome({
  resolution: resolution({
    signalType:
      'nestjourney_assigned_first_contacts',
    fingerprint: 'old-fingerprint'
  }),
  result: 'resolved',
  code:
    'nestjourney_assigned_first_contacts_cleared',
  projection: projection({
    assigned: queue({ count: 0 })
  })
});

assert.equal(
  clearedAssigned.attested,
  true,
  'server may attest resolved only when the canonical queue is actually empty'
);
if (clearedAssigned.attested) {
  assert.equal(
    clearedAssigned.currentCount,
    0
  );
  assert.equal(
    clearedAssigned.currentFingerprint,
    null
  );
  assert.equal(
    clearedAssigned.queueId,
    'assigned:first_contact'
  );
}

const activeAssignedQueue = queue({
  count: 2,
  overdueCount: 1,
  dueSoonCount: 1,
  earliestDueAtMs: now - 1_000
});

const falseResolved = attestNestJourneyOutcome({
  resolution: resolution({
    signalType:
      'nestjourney_assigned_first_contacts',
    fingerprint: 'old-fingerprint'
  }),
  result: 'resolved',
  code:
    'nestjourney_assigned_first_contacts_cleared',
  projection: projection({
    assigned: activeAssignedQueue
  })
});

assert.deepEqual(
  falseResolved,
  {
    attested: false,
    reasonCode:
      'JOURNEY_OUTCOME_SOURCE_STILL_ACTIVE'
  },
  'client must not be able to claim resolved while the server still sees an active queue'
);

const currentAssignedFingerprint =
  fingerprintNestJourneyQueue({
    signalType:
      'nestjourney_assigned_first_contacts',
    queue: activeAssignedQueue
  });

const falseSuperseded =
  attestNestJourneyOutcome({
    resolution: resolution({
      signalType:
        'nestjourney_assigned_first_contacts',
      fingerprint:
        currentAssignedFingerprint
    }),
    result: 'superseded',
    code: 'source_signal_updated',
    projection: projection({
      assigned: activeAssignedQueue
    })
  });

assert.deepEqual(
  falseSuperseded,
  {
    attested: false,
    reasonCode:
      'JOURNEY_OUTCOME_SOURCE_UNCHANGED'
  },
  'client must not be able to claim a changed signal when the canonical fingerprint is unchanged'
);

const trueSuperseded =
  attestNestJourneyOutcome({
    resolution: resolution({
      signalType:
        'nestjourney_assigned_first_contacts',
      fingerprint: 'older-fingerprint'
    }),
    result: 'superseded',
    code: 'source_signal_updated',
    projection: projection({
      assigned: activeAssignedQueue
    })
  });

assert.equal(
  trueSuperseded.attested,
  true,
  'server may attest superseded only when a live queue has a different canonical fingerprint'
);
if (trueSuperseded.attested) {
  assert.equal(
    trueSuperseded.currentCount,
    2
  );
  assert.equal(
    trueSuperseded.currentFingerprint,
    currentAssignedFingerprint
  );
}

const clearedInsteadOfUpdated =
  attestNestJourneyOutcome({
    resolution: resolution({
      signalType:
        'nestjourney_assigned_first_contacts',
      fingerprint: 'older-fingerprint'
    }),
    result: 'superseded',
    code: 'source_signal_updated',
    projection: projection({
      assigned: queue({ count: 0 })
    })
  });

assert.deepEqual(
  clearedInsteadOfUpdated,
  {
    attested: false,
    reasonCode:
      'JOURNEY_OUTCOME_SOURCE_CLEARED_NOT_UPDATED'
  }
);

for (const unsafeProjection of [
  projection({ ready: false }),
  projection({ accessible: false }),
  projection({ isGlobalAccess: true }),
  projection({
    organizationId: 'another-org'
  })
]) {
  const result =
    attestNestJourneyOutcome({
      resolution: resolution({
        signalType:
          'nestjourney_assigned_first_contacts',
        fingerprint: 'old'
      }),
      result: 'resolved',
      code:
        'nestjourney_assigned_first_contacts_cleared',
      projection: unsafeProjection
    });

  assert.deepEqual(
    result,
    {
      attested: false,
      reasonCode:
        'JOURNEY_OUTCOME_PROJECTION_NOT_READY'
    },
    'attestation must fail closed for untrusted, global-only, stale or cross-tenant projections'
  );
}

const unassignedCleared =
  attestNestJourneyOutcome({
    resolution: resolution({
      signalType:
        'nestjourney_unassigned_first_contacts',
      fingerprint: 'unassigned-old'
    }),
    result: 'resolved',
    code:
      'nestjourney_unassigned_first_contacts_cleared',
    projection: projection({
      unassigned: queue({ count: 0 })
    })
  });

assert.equal(
  unassignedCleared.attested,
  true
);

const unsupportedWindowOutcome =
  attestNestJourneyOutcome({
    resolution: resolution({
      signalType:
        'nestjourney_assigned_first_contacts',
      fingerprint: 'old'
    }),
    result: 'no_longer_actionable',
    code: 'target_left_active_window',
    projection: projection()
  });

assert.deepEqual(
  unsupportedWindowOutcome,
  {
    attested: false,
    reasonCode:
      'JOURNEY_OUTCOME_NOT_SUPPORTED'
  },
  'Journey must not inherit MusicScale active-window semantics'
);

const server = readFileSync(
  'src/server/services/ActionResolutionCommandService.ts',
  'utf8'
);

for (const expected of [
  'resolveNestJourneyWorkspaceProjectionForActor',
  'attestNestJourneyOutcome',
  'server_revalidated_canonical_projection',
  'JOURNEY_OUTCOME_ATTESTATION_UNAVAILABLE',
  'outcomeAttestation',
  'sourceQueueCount',
  'sourceFingerprint',
  'completeQueues: true'
]) {
  assert.equal(
    server.includes(expected),
    true,
    `server must contain ${expected}`
  );
}

const projectionService = readFileSync(
  'src/server/services/NestJourneyWorkspaceProjectionService.ts',
  'utf8'
);
assert.match(
  projectionService,
  /export async function resolveNestJourneyWorkspaceProjectionForActor/,
  'HTTP workspace projection and server attestation must reuse one canonical Journey resolver'
);
assert.match(
  projectionService,
  /dependencies\.completeQueues[\s\S]*assignedQuery[\s\S]*assignedQuery\.limit\(100\)/,
  'dashboard projection may stay bounded while attestation can request the full assigned queue'
);
assert.match(
  projectionService,
  /dependencies\.completeQueues[\s\S]*unassignedQuery[\s\S]*unassignedQuery\.limit\(200\)/,
  'dashboard projection may stay bounded while attestation can request the full unassigned queue'
);

const attestationSource = readFileSync(
  'src/lib/journeyOutcomeAttestation.ts',
  'utf8'
);
for (const forbidden of [
  'phone',
  'email',
  'notes',
  'pastoralNote',
  'personId',
  'personName'
]) {
  assert.equal(
    attestationSource.includes(forbidden),
    false,
    `privacy-safe attestation must not depend on ${forbidden}`
  );
}

console.log(
  'Journey server-side outcome attestation and anti-forgery checks passed.'
);
