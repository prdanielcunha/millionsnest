import assert from 'node:assert/strict';
import {
  CANONICAL_FACT_SCHEMA_VERSION,
  hasValidFactEvidence,
  isCanonicalFactValid,
  isFactEvidenceReferenceValid,
  type CanonicalFact,
  type FactEvidenceReference
} from '../src/packages/events/factContract.js';

const evidence: FactEvidenceReference = {
  organizationId: 'org-alpha',
  sourceApp: 'musicscale',
  sourceKind: 'firestore_document',
  sourceRef: 'scales/scale-123',
  entityType: 'scale',
  entityId: 'scale-123',
  fieldPaths: ['organizationId', 'date', 'time'],
  observedAtMs: 1_800_000_000_000
};

assert.equal(
  isFactEvidenceReferenceValid(evidence),
  true,
  'a scoped, traceable evidence reference must be accepted'
);

assert.equal(
  hasValidFactEvidence([evidence], 'org-alpha'),
  true,
  'evidence must be valid for the same tenant'
);

assert.equal(
  hasValidFactEvidence([evidence], 'org-beta'),
  false,
  'cross-tenant evidence must never validate for another organization'
);

assert.equal(
  hasValidFactEvidence([], 'org-alpha'),
  false,
  'NO SOURCE -> NO CLAIM: empty evidence must fail closed'
);

assert.equal(
  isFactEvidenceReferenceValid({
    ...evidence,
    sourceRef: ''
  }),
  false,
  'evidence without an identifiable source must fail closed'
);

const canonicalFact: CanonicalFact<'musicscale.schedule.created'> = {
  schemaVersion: CANONICAL_FACT_SCHEMA_VERSION,
  factId: 'fact-001',
  organizationId: 'org-alpha',
  eventType: 'musicscale.schedule.created',
  actor: {
    type: 'user',
    id: 'user-001'
  },
  occurredAtMs: 1_800_000_000_000,
  recordedAtMs: 1_800_000_000_010,
  source: evidence,
  entity: {
    type: 'scale',
    id: 'scale-123'
  },
  metadata: {
    publishRevision: 1
  },
  idempotencyKey: 'musicscale.schedule.created:scale-123:rev1'
};

assert.equal(
  isCanonicalFactValid(canonicalFact),
  true,
  'canonical facts with tenant, actor, source, entity and timestamps must validate'
);

assert.equal(
  isCanonicalFactValid({
    ...canonicalFact,
    organizationId: 'org-beta'
  }),
  false,
  'a fact cannot borrow evidence from another tenant'
);

assert.equal(
  isCanonicalFactValid({
    ...canonicalFact,
    source: {
      ...canonicalFact.source,
      sourceRef: ''
    }
  }),
  false,
  'a fact without traceable source evidence must not validate'
);

assert.equal(
  isCanonicalFactValid({
    ...canonicalFact,
    actor: {
      type: 'user',
      id: ''
    }
  }),
  false,
  'an identified human actor must have a non-empty actor id'
);

console.log('Canonical fact and evidence contract checks passed.');
