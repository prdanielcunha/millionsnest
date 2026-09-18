import {
  CANONICAL_FACT_SCHEMA_VERSION,
  isCanonicalFactValid,
  type CanonicalFact
} from '../packages/events/factContract.js';

export type MusicScaleCanonicalFactEventType =
  | 'musicscale.scale.response_summary_observed'
  | 'musicscale.scale.personal_confirmation_observed'
  | 'musicscale.scale.personal_commitment_observed';

export interface MusicScaleFactProjectionInput {
  organizationId: string;
  ready: boolean;
  observedAtMs?: number | null;
  projectionNowMs?: number;
  nextScale: null | {
    id: string;
    startsAtMs?: number | null;
    responseSummaryAvailable: boolean;
    pendingResponses: number;
    pendingByFunction?: readonly {
      functionName: string;
      count: number;
    }[];
  };
  nextPersonalScale?: null | {
    id: string;
    date?: string | null;
    time?: string | null;
    startsAtMs?: number | null;
    songCount?: number | null;
    functionNames?: readonly string[] | null;
    publishRevision?: number | null;
    responseSummaryAvailable: boolean;
    pendingResponses: number;
  };
}

export interface MusicScaleResponseSummaryFactMetadata extends Record<string, unknown> {
  responseSummaryAvailable: true;
  pendingResponses: number;
  startsAtMs: number | null;
  pendingByFunction?: Array<{
    functionName: string;
    count: number;
  }>;
}

export interface MusicScalePersonalConfirmationFactMetadata
  extends MusicScaleResponseSummaryFactMetadata {
  publishRevision: number;
}

export interface MusicScalePersonalCommitmentFactMetadata
  extends Record<string, unknown> {
  date: string;
  time: string | null;
  startsAtMs: number;
  songCount: number;
  functionNames: string[];
  publishRevision: number;
}

export type MusicScaleCanonicalFact =
  | CanonicalFact<
      'musicscale.scale.response_summary_observed',
      MusicScaleResponseSummaryFactMetadata
    >
  | CanonicalFact<
      'musicscale.scale.personal_confirmation_observed',
      MusicScalePersonalConfirmationFactMetadata
    >
  | CanonicalFact<
      'musicscale.scale.personal_commitment_observed',
      MusicScalePersonalCommitmentFactMetadata
    >;

function finiteNonNegative(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

function cleanId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const clean = value.trim();
  return clean ? clean : null;
}

function cleanText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const clean = value.trim();
  return clean ? clean : null;
}

function normalizePendingByFunction(
  value: unknown
): Array<{ functionName: string; count: number }> {
  if (!Array.isArray(value)) return [];

  const counts = new Map<string, number>();
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const functionName = cleanText((item as any).functionName);
    const count = finiteNonNegative((item as any).count);
    if (!functionName || count === null || count <= 0) continue;
    counts.set(functionName, (counts.get(functionName) || 0) + Math.floor(count));
  }

  return Array.from(counts.entries())
    .map(([functionName, count]) => ({ functionName, count }))
    .sort((a, b) =>
      a.functionName < b.functionName
        ? -1
        : a.functionName > b.functionName
          ? 1
          : 0
    );
}

function normalizeFunctionNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(
    value
      .map(item => typeof item === 'string' ? item.trim() : '')
      .filter(Boolean)
  ));
}

function projectionTimestamp(input: MusicScaleFactProjectionInput): number {
  return (
    finiteNonNegative(input.observedAtMs) ??
    finiteNonNegative(input.projectionNowMs) ??
    Date.now()
  );
}

function buildResponseSummaryFact(
  input: MusicScaleFactProjectionInput,
  scale: NonNullable<MusicScaleFactProjectionInput['nextScale']>
): MusicScaleCanonicalFact | null {
  const organizationId = cleanId(input.organizationId);
  const scaleId = cleanId(scale.id);
  const pendingResponses = finiteNonNegative(scale.pendingResponses);
  if (
    !organizationId ||
    !scaleId ||
    scale.responseSummaryAvailable !== true ||
    pendingResponses === null
  ) {
    return null;
  }

  const observedAtMs = finiteNonNegative(input.observedAtMs);
  const timestamp = projectionTimestamp(input);
  const startsAtMs = finiteNonNegative(scale.startsAtMs);
  const pendingByFunction = normalizePendingByFunction(
    scale.pendingByFunction
  );
  const functionFingerprint = pendingByFunction
    .map(gap => `${gap.functionName}=${gap.count}`)
    .join('|');
  const idempotencyKey =
    `musicscale:${organizationId}:scale:${scaleId}:response-summary:pending-${pendingResponses}` +
    (functionFingerprint ? `:functions-${functionFingerprint}` : '');

  const fact: MusicScaleCanonicalFact = {
    schemaVersion: CANONICAL_FACT_SCHEMA_VERSION,
    factId: idempotencyKey,
    organizationId,
    eventType: 'musicscale.scale.response_summary_observed',
    actor: { type: 'system' },
    occurredAtMs: observedAtMs ?? timestamp,
    recordedAtMs: timestamp,
    source: {
      organizationId,
      sourceApp: 'musicscale',
      sourceKind: 'runtime_projection',
      sourceRef: 'musicscale.read_model.schedule_response_summary',
      entityType: 'scale',
      entityId: scaleId,
      fieldPaths: [
        'responseSummaryAvailable',
        'pendingResponses',
        'pendingByFunction',
        'startsAtMs'
      ],
      ...(observedAtMs !== null ? { observedAtMs } : {})
    },
    entity: {
      type: 'scale',
      id: scaleId
    },
    metadata: {
      responseSummaryAvailable: true,
      pendingResponses,
      startsAtMs,
      pendingByFunction
    },
    idempotencyKey
  };

  return isCanonicalFactValid(fact) ? fact : null;
}

function buildPersonalConfirmationFact(
  input: MusicScaleFactProjectionInput,
  scale: NonNullable<MusicScaleFactProjectionInput['nextPersonalScale']>
): MusicScaleCanonicalFact | null {
  const organizationId = cleanId(input.organizationId);
  const scaleId = cleanId(scale.id);
  const pendingResponses = finiteNonNegative(scale.pendingResponses);
  if (
    !organizationId ||
    !scaleId ||
    scale.responseSummaryAvailable !== true ||
    pendingResponses === null
  ) {
    return null;
  }

  const observedAtMs = finiteNonNegative(input.observedAtMs);
  const timestamp = projectionTimestamp(input);
  const startsAtMs = finiteNonNegative(scale.startsAtMs);
  const publishRevision = finiteNonNegative(scale.publishRevision) ?? 0;
  const idempotencyKey =
    `musicscale:${organizationId}:scale:${scaleId}:personal-confirmation:rev-${publishRevision}:pending-${pendingResponses}`;

  const fact: MusicScaleCanonicalFact = {
    schemaVersion: CANONICAL_FACT_SCHEMA_VERSION,
    factId: idempotencyKey,
    organizationId,
    eventType: 'musicscale.scale.personal_confirmation_observed',
    actor: { type: 'system' },
    occurredAtMs: observedAtMs ?? timestamp,
    recordedAtMs: timestamp,
    source: {
      organizationId,
      sourceApp: 'musicscale',
      sourceKind: 'runtime_projection',
      sourceRef: 'musicscale.read_model.personal_schedule_confirmation',
      entityType: 'scale',
      entityId: scaleId,
      fieldPaths: [
        'responseSummaryAvailable',
        'pendingResponses',
        'publishRevision',
        'startsAtMs'
      ],
      ...(observedAtMs !== null ? { observedAtMs } : {})
    },
    entity: {
      type: 'scale',
      id: scaleId
    },
    metadata: {
      responseSummaryAvailable: true,
      pendingResponses,
      publishRevision,
      startsAtMs
    },
    idempotencyKey
  };

  return isCanonicalFactValid(fact) ? fact : null;
}

function buildPersonalCommitmentFact(
  input: MusicScaleFactProjectionInput,
  scale: NonNullable<MusicScaleFactProjectionInput['nextPersonalScale']>
): MusicScaleCanonicalFact | null {
  const organizationId = cleanId(input.organizationId);
  const scaleId = cleanId(scale.id);
  const date = cleanText(scale.date);
  const startsAtMs = finiteNonNegative(scale.startsAtMs);
  if (!organizationId || !scaleId || !date || startsAtMs === null) {
    return null;
  }

  const observedAtMs = finiteNonNegative(input.observedAtMs);
  const timestamp = projectionTimestamp(input);
  const time = cleanText(scale.time);
  const songCount = Math.floor(finiteNonNegative(scale.songCount) ?? 0);
  const functionNames = normalizeFunctionNames(scale.functionNames);
  const publishRevision = Math.floor(
    finiteNonNegative(scale.publishRevision) ?? 0
  );
  const roleFingerprint = functionNames.join('|') || 'none';
  const idempotencyKey =
    `musicscale:${organizationId}:scale:${scaleId}:personal-commitment:rev-${publishRevision}:start-${startsAtMs}:songs-${songCount}:roles-${roleFingerprint}`;

  const fact: MusicScaleCanonicalFact = {
    schemaVersion: CANONICAL_FACT_SCHEMA_VERSION,
    factId: idempotencyKey,
    organizationId,
    eventType: 'musicscale.scale.personal_commitment_observed',
    actor: { type: 'system' },
    occurredAtMs: observedAtMs ?? timestamp,
    recordedAtMs: timestamp,
    source: {
      organizationId,
      sourceApp: 'musicscale',
      sourceKind: 'runtime_projection',
      sourceRef: 'musicscale.read_model.personal_schedule_commitment',
      entityType: 'scale',
      entityId: scaleId,
      fieldPaths: [
        'date',
        'time',
        'startsAtMs',
        'songCount',
        'functionNames',
        'publishRevision'
      ],
      ...(observedAtMs !== null ? { observedAtMs } : {})
    },
    entity: {
      type: 'scale',
      id: scaleId
    },
    metadata: {
      date,
      time,
      startsAtMs,
      songCount,
      functionNames,
      publishRevision
    },
    idempotencyKey
  };

  return isCanonicalFactValid(fact) ? fact : null;
}

/**
 * Current MusicScale -> Unified Fact Stream adapter.
 *
 * This is intentionally a pure in-memory projection over the read model the Hub
 * already loaded. It performs no Firestore/API read, no write, no LLM call and
 * makes no user-facing claim by itself.
 */
export function projectCurrentMusicScaleFacts(
  input: MusicScaleFactProjectionInput
): MusicScaleCanonicalFact[] {
  if (input.ready !== true || !cleanId(input.organizationId)) return [];

  const facts: MusicScaleCanonicalFact[] = [];

  if (input.nextScale) {
    const fact = buildResponseSummaryFact(input, input.nextScale);
    if (fact) facts.push(fact);
  }

  if (input.nextPersonalScale) {
    const confirmationFact = buildPersonalConfirmationFact(
      input,
      input.nextPersonalScale
    );
    if (confirmationFact) facts.push(confirmationFact);

    const commitmentFact = buildPersonalCommitmentFact(
      input,
      input.nextPersonalScale
    );
    if (commitmentFact) facts.push(commitmentFact);
  }

  return facts;
}
