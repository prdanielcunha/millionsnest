export const CANONICAL_FACT_SCHEMA_VERSION = 1 as const;

export type FactSourceKind =
  | 'firestore_document'
  | 'firestore_query'
  | 'backend_api'
  | 'runtime_projection'
  | 'system_event';

export type FactActorType = 'user' | 'system' | 'service';

export interface FactActorReference {
  type: FactActorType;
  id?: string | null;
}

/**
 * Traceable evidence attached to a fact, signal or action.
 *
 * `sourceRef` is intentionally a logical reference instead of a URL so it can
 * point to a Firestore path/query, backend endpoint, or a named read model
 * without exposing credentials or coupling the UI to a transport.
 */
export interface FactEvidenceReference {
  organizationId: string;
  sourceApp: string;
  sourceKind: FactSourceKind;
  sourceRef: string;
  entityType: string;
  entityId: string;
  fieldPaths?: readonly string[];
  observedAtMs?: number | null;
}

export interface CanonicalFactEntityReference {
  type: string;
  id: string;
}

/**
 * Versioned envelope for the future Unified Fact Stream.
 *
 * This contract is deliberately transport-agnostic. Persisting or publishing a
 * fact is a separate concern and must preserve the Hub as the authority for
 * identity, organization, RBAC, billing and entitlements.
 */
export interface CanonicalFact<
  TEventType extends string = string,
  TMetadata extends Record<string, unknown> = Record<string, unknown>
> {
  schemaVersion: typeof CANONICAL_FACT_SCHEMA_VERSION;
  factId: string;
  organizationId: string;
  eventType: TEventType;
  actor: FactActorReference;
  occurredAtMs: number;
  recordedAtMs: number;
  source: FactEvidenceReference;
  entity: CanonicalFactEntityReference;
  metadata: TMetadata;
  idempotencyKey?: string | null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isFiniteTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

export function isFactEvidenceReferenceValid(
  evidence: FactEvidenceReference | null | undefined
): evidence is FactEvidenceReference {
  if (!evidence) return false;
  if (!isNonEmptyString(evidence.organizationId)) return false;
  if (!isNonEmptyString(evidence.sourceApp)) return false;
  if (!isNonEmptyString(evidence.sourceRef)) return false;
  if (!isNonEmptyString(evidence.entityType)) return false;
  if (!isNonEmptyString(evidence.entityId)) return false;

  if (
    evidence.observedAtMs !== undefined &&
    evidence.observedAtMs !== null &&
    !isFiniteTimestamp(evidence.observedAtMs)
  ) {
    return false;
  }

  if (
    evidence.fieldPaths !== undefined &&
    evidence.fieldPaths.some(fieldPath => !isNonEmptyString(fieldPath))
  ) {
    return false;
  }

  return true;
}

export function hasValidFactEvidence(
  evidence: readonly FactEvidenceReference[] | null | undefined,
  organizationId?: string
): evidence is readonly FactEvidenceReference[] {
  if (!evidence || evidence.length === 0) return false;

  return evidence.every(reference =>
    isFactEvidenceReferenceValid(reference) &&
    (!organizationId || reference.organizationId === organizationId)
  );
}

export function isCanonicalFactValid(
  fact: CanonicalFact | null | undefined
): fact is CanonicalFact {
  if (!fact) return false;
  if (fact.schemaVersion !== CANONICAL_FACT_SCHEMA_VERSION) return false;
  if (!isNonEmptyString(fact.factId)) return false;
  if (!isNonEmptyString(fact.organizationId)) return false;
  if (!isNonEmptyString(fact.eventType)) return false;
  if (!isNonEmptyString(fact.entity?.type)) return false;
  if (!isNonEmptyString(fact.entity?.id)) return false;
  if (!isFiniteTimestamp(fact.occurredAtMs)) return false;
  if (!isFiniteTimestamp(fact.recordedAtMs)) return false;
  if (!fact.actor || !['user', 'system', 'service'].includes(fact.actor.type)) return false;
  if (fact.actor.id !== undefined && fact.actor.id !== null && !isNonEmptyString(fact.actor.id)) {
    return false;
  }
  if (!isFactEvidenceReferenceValid(fact.source)) return false;
  if (fact.source.organizationId !== fact.organizationId) return false;

  return true;
}
