import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  deriveNestJourneyCareIntegritySnapshot
} from '../src/lib/nestJourneyCareIntegrity.js';
import {
  fingerprintNestJourneyQueue
} from '../src/lib/actionSignals.js';
import {
  answerAskMillionsNest
} from '../src/lib/askMillionsNest.js';
import type {
  NestJourneyQueueSummary,
  NestJourneyWorkspaceProjection
} from '../src/lib/nestJourneyWorkspaceProjection.js';
import type {
  FactEvidenceReference
} from '../src/packages/events/factContract.js';

const ORG_ID = 'org-care-integrity';
const NOW = Date.UTC(2026, 8, 21, 12, 0, 0);

function evidence(
  entityId:
    | 'assigned:first_contact'
    | 'unassigned:first_contact'
): FactEvidenceReference[] {
  return [{
    organizationId: ORG_ID,
    sourceApp: 'nestjourney',
    sourceKind: 'backend_api',
    sourceRef:
      entityId === 'assigned:first_contact'
        ? 'hub.api.nestjourney.workspace.assigned_first_contacts'
        : 'hub.api.nestjourney.workspace.unassigned_first_contacts',
    entityType: 'followup_queue',
    entityId,
    fieldPaths: [
      'count',
      'overdueCount',
      'dueSoonCount',
      'earliestDueAtMs'
    ],
    observedAtMs: NOW
  }];
}

function queue(input: {
  entityId:
    | 'assigned:first_contact'
    | 'unassigned:first_contact';
  count: number;
  overdue?: number;
  dueSoon?: number;
  earliest?: number | null;
  observed?: boolean;
  complete?: boolean;
}): NestJourneyQueueSummary {
  return {
    count: input.count,
    overdueCount: input.overdue ?? 0,
    dueSoonCount: input.dueSoon ?? 0,
    earliestDueAtMs:
      input.earliest ?? null,
    complete: input.complete ?? true,
    evidence:
      input.observed === false
        ? []
        : evidence(input.entityId)
  };
}

function projection(input?: {
  organizationId?: string;
  global?: boolean;
  ready?: boolean;
  canRead?: boolean;
  assigned?: NestJourneyQueueSummary;
  unassigned?: NestJourneyQueueSummary;
}): NestJourneyWorkspaceProjection {
  return {
    appId: 'nestjourney',
    organizationId:
      input?.organizationId ?? ORG_ID,
    accessible: true,
    isGlobalAccess:
      input?.global ?? false,
    decisionState: 'granted',
    denialReason: null,
    responsibility: 'coordinator',
    canReadJourneyOperational:
      input?.canRead ?? true,
    capabilities: {
      canManagePresence: false,
      canManageMesa: false,
      canManagePeople: true,
      canManageCare: true,
      canManageGroups: false,
      canManageDiscipleship: false,
      canManageImplementation: false,
      canManagePastoral: false,
      canViewGovernance: false,
      canCoordinateJourney: true
    },
    congregationIds: ['unit-a'],
    ready: input?.ready ?? true,
    observedAtMs: NOW,
    assignedFirstContacts:
      input?.assigned ??
      queue({
        entityId:
          'assigned:first_contact',
        count: 0
      }),
    unassignedFirstContacts:
      input?.unassigned ??
      queue({
        entityId:
          'unassigned:first_contact',
        count: 0
      })
  };
}

const full = deriveNestJourneyCareIntegritySnapshot({
  organizationId: ORG_ID,
  projection: projection({
    assigned: queue({
      entityId:
        'assigned:first_contact',
      count: 2,
      overdue: 1,
      dueSoon: 1,
      earliest: NOW - 60_000
    }),
    unassigned: queue({
      entityId:
        'unassigned:first_contact',
      count: 1,
      overdue: 1,
      earliest: NOW - 120_000
    })
  })
});

assert.ok(full);
assert.equal(full?.state, 'overdue');
assert.equal(full?.totalOpenCount, 3);
assert.equal(full?.assignedCount, 2);
assert.equal(full?.unassignedCount, 1);
assert.equal(full?.overdueCount, 2);
assert.equal(full?.dueSoonCount, 1);
assert.equal(full?.assignedAvailable, true);
assert.equal(full?.unassignedAvailable, true);
assert.equal(full?.earliestDueAtMs, NOW - 120_000);
assert.equal(full?.evidence.length, 2);

const clear = deriveNestJourneyCareIntegritySnapshot({
  organizationId: ORG_ID,
  projection: projection()
});

assert.ok(
  clear,
  'authorized zero-count queues must remain factual through explicit zero evidence'
);
assert.equal(clear?.state, 'clear');
assert.equal(clear?.totalOpenCount, 0);
assert.equal(clear?.overdueCount, 0);
assert.equal(clear?.dueSoonCount, 0);
assert.equal(clear?.evidence.length, 2);

const partial = deriveNestJourneyCareIntegritySnapshot({
  organizationId: ORG_ID,
  projection: projection({
    assigned: queue({
      entityId:
        'assigned:first_contact',
      count: 1
    }),
    unassigned: queue({
      entityId:
        'unassigned:first_contact',
      count: 0,
      observed: false
    })
  })
});

assert.ok(partial);
assert.equal(partial?.assignedAvailable, true);
assert.equal(partial?.unassignedAvailable, false);
assert.equal(partial?.totalOpenCount, 1);
assert.equal(
  partial?.unassignedCount,
  0,
  'unavailable queue must not be counted as an observed zero'
);
assert.equal(partial?.evidence.length, 1);
assert.equal(partial?.countsComplete, true);

const bounded = deriveNestJourneyCareIntegritySnapshot({
  organizationId: ORG_ID,
  projection: projection({
    assigned: queue({
      entityId:
        'assigned:first_contact',
      count: 100,
      overdue: 3,
      dueSoon: 4,
      complete: false
    }),
    unassigned: queue({
      entityId:
        'unassigned:first_contact',
      count: 0,
      complete: true
    })
  })
});

assert.ok(bounded);
assert.equal(bounded?.countsComplete, false);
assert.equal(bounded?.assignedComplete, false);
assert.equal(bounded?.totalOpenCount, 100);

const boundedFingerprint =
  fingerprintNestJourneyQueue({
    signalType:
      'nestjourney_assigned_first_contacts',
    queue: queue({
      entityId:
        'assigned:first_contact',
      count: 100,
      overdue: 3,
      dueSoon: 4,
      complete: false
    })
  });
const completeFingerprint =
  fingerprintNestJourneyQueue({
    signalType:
      'nestjourney_assigned_first_contacts',
    queue: queue({
      entityId:
        'assigned:first_contact',
      count: 100,
      overdue: 3,
      dueSoon: 4,
      complete: true
    })
  });
assert.notEqual(
  boundedFingerprint,
  completeFingerprint,
  'projection completeness must change the Journey signal fingerprint'
);

for (const unsafe of [
  projection({ global: true }),
  projection({ ready: false }),
  projection({ canRead: false }),
  projection({
    organizationId: 'another-org'
  }),
  projection({
    assigned: queue({
      entityId:
        'assigned:first_contact',
      count: 0,
      observed: false
    }),
    unassigned: queue({
      entityId:
        'unassigned:first_contact',
      count: 0,
      observed: false
    })
  })
]) {
  assert.equal(
    deriveNestJourneyCareIntegritySnapshot({
      organizationId: ORG_ID,
      projection: unsafe
    }),
    null,
    'Care Integrity must fail closed without tenant-bound authorized queue evidence'
  );
}

const clearAsk = answerAskMillionsNest({
  organizationId: ORG_ID,
  question:
    'O que está pendente no acompanhamento?',
  activeLens: 'journey',
  lenses: [{ id: 'journey' } as any],
  actions: [],
  journey: clear,
  musicScale: {
    ready: false,
    nextScale: null,
    nextPersonalScale: null
  },
  nowMs: NOW
});

assert.equal(clearAsk.status, 'answered');
assert.equal(
  clearAsk.summaryKey,
  'ask.answers.journey_follow_up.summary_clear'
);
assert.equal(
  clearAsk.translationParams?.total,
  0
);
assert.ok(
  clearAsk.facts.some(
    fact =>
      fact.key ===
      'ask.facts.journey_total_open'
  )
);
assert.equal(
  clearAsk.destination?.kind,
  'app'
);
if (
  clearAsk.destination?.kind === 'app'
) {
  assert.equal(
    clearAsk.destination.appId,
    'nestjourney'
  );
  assert.equal(
    clearAsk.destination.path,
    '/care-integrity'
  );
}
assert.ok(clearAsk.evidence.length > 0);

const boundedAsk = answerAskMillionsNest({
  organizationId: ORG_ID,
  question:
    'O que está pendente no acompanhamento?',
  activeLens: 'journey',
  lenses: [{ id: 'journey' } as any],
  actions: [],
  journey: bounded,
  musicScale: {
    ready: false,
    nextScale: null,
    nextPersonalScale: null
  },
  nowMs: NOW
});

assert.equal(boundedAsk.status, 'answered');
assert.equal(
  boundedAsk.summaryKey,
  'ask.answers.journey_follow_up.summary_lower_bound'
);
assert.ok(
  boundedAsk.facts.some(
    fact =>
      fact.key ===
      'ask.facts.journey_total_open_lower_bound'
  )
);

const ambiguousZero = deriveNestJourneyCareIntegritySnapshot({
  organizationId: ORG_ID,
  projection: projection({
    assigned: queue({
      entityId:
        'assigned:first_contact',
      count: 0,
      complete: false
    }),
    unassigned: queue({
      entityId:
        'unassigned:first_contact',
      count: 0,
      complete: true
    })
  })
});

assert.ok(ambiguousZero);
assert.equal(
  ambiguousZero?.state,
  'limited',
  'an incomplete zero must be visibly represented as a partial read'
);
const ambiguousZeroAsk = answerAskMillionsNest({
  organizationId: ORG_ID,
  question:
    'O que está pendente no acompanhamento?',
  activeLens: 'journey',
  lenses: [{ id: 'journey' } as any],
  actions: [],
  journey: ambiguousZero,
  musicScale: {
    ready: false,
    nextScale: null,
    nextPersonalScale: null
  },
  nowMs: NOW
});
assert.equal(
  ambiguousZeroAsk.status,
  'insufficient_data',
  'incomplete zero must never be presented as an all-clear claim'
);

const component = readFileSync(
  'src/components/dashboard/NestJourneyCareIntegritySnapshot.tsx',
  'utf8'
);
const home = readFileSync(
  'src/components/dashboard/EcosystemWorkspaceHome.tsx',
  'utf8'
);
const server = readFileSync(
  'src/server/services/NestJourneyWorkspaceProjectionService.ts',
  'utf8'
);

assert.match(
  home,
  /adaptiveWorkspace\.activeLens === 'journey'/
);
assert.match(
  home,
  /deriveNestJourneyCareIntegritySnapshot/
);
assert.match(
  home,
  /journey=\{journeyCareIntegrity\}/
);
assert.match(
  component,
  /snapshot\.unassignedAvailable/
);
assert.match(
  component,
  /snapshot\.countsComplete/
);
assert.match(
  component,
  /bounded_scope/
);
assert.match(
  component,
  /String\(value\) \+ '\+'/
);
assert.match(
  server,
  /capabilities\.canManageCare\s*\?\s*summarizeJourneyQueue/
);
assert.match(
  server,
  /canSuperviseCare\s*\?\s*summarizeJourneyQueue/
);
assert.match(
  server,
  /\.\.\.emptyNestJourneyQueue\(\),[\s\S]*complete:\s*input\.complete === true,[\s\S]*evidence/,
  'an authorized empty queue must preserve both completeness metadata and zero-count evidence'
);

for (const source of [
  component,
  readFileSync(
    'src/lib/nestJourneyCareIntegrity.ts',
    'utf8'
  )
]) {
  for (const forbidden of [
    'personId',
    'personName',
    'phone',
    'email',
    'privateNote',
    'pastoralNote'
  ]) {
    assert.equal(
      source.includes(forbidden),
      false,
      `Care Integrity aggregate must not depend on ${forbidden}`
    );
  }
}

for (const language of [
  'pt',
  'en',
  'es'
]) {
  const dashboard = readFileSync(
    `src/packages/i18n/locales/${language}.ts`,
    'utf8'
  );
  const intelligence = readFileSync(
    `src/packages/i18n/intelligence/${language}.ts`,
    'utf8'
  );

  for (const key of [
    'care_integrity',
    'partial_scope',
    'due_soon'
  ]) {
    assert.equal(
      dashboard.includes(key),
      true,
      `${language} dashboard must include ${key}`
    );
  }

  for (const key of [
    'journey_total_open',
    'journey_due_soon',
    'journey_total_open_lower_bound',
    'summary_clear',
    'summary_lower_bound',
    'follow_up'
  ]) {
    assert.equal(
      intelligence.includes(key),
      true,
      `${language} intelligence must include ${key}`
    );
  }
}

console.log(
  'NestJourney Care Integrity aggregate, zero-evidence and Ask MillionsNest checks passed.'
);
