import type { Request, Response } from 'express';
import { createHash } from 'node:crypto';
import { createNestAiClient } from '@millionsnest/ai';
import { getAuth } from 'firebase-admin/auth';
import {
  FieldValue,
  Firestore,
  getFirestore
} from 'firebase-admin/firestore';
import {
  resolveEcosystemAppAccess
} from './EcosystemAccessResolver.js';
import { issueNestAiToken } from './NestAiTokenService.js';

export type MusicScaleLiveAiTask =
  | 'diagnostic_explanation'
  | 'song_match_assist'
  | 'request_classification'
  | 'natural_search'
  | 'metadata_normalization'
  | 'post_service_summary'
  | 'pre_service_risk_summary';

type AiGatewayOutput = {
  summary: string;
  confidence: number;
  suggestions: Array<{
    kind: string;
    label: string;
    reason: string;
    value?: string;
  }>;
  warnings: string[];
};

type Dependencies = {
  verifyIdToken?: (token: string) => Promise<{ uid: string }>;
  getFirestore?: () => Firestore;
  resolveAccess?: typeof resolveEcosystemAppAccess;
  generate?: (input: {
    model: string;
    prompt: string;
    timeoutMs: number;
    task: MusicScaleLiveAiTask;
    organizationId: string;
    actorUid: string;
    input: unknown;
  }) => Promise<{
    text: string;
    inputTokens?: number;
    outputTokens?: number;
  }>;
  now?: () => number;
};

const TASKS = new Set<MusicScaleLiveAiTask>([
  'diagnostic_explanation',
  'song_match_assist',
  'request_classification',
  'natural_search',
  'metadata_normalization',
  'post_service_summary',
  'pre_service_risk_summary'
]);

const NESTAI_TASK_IDS: Record<MusicScaleLiveAiTask, string> = {
  diagnostic_explanation: 'musicscale.live.diagnostic.explain',
  song_match_assist: 'musicscale.live.song-match.assist',
  request_classification: 'musicscale.live.request.classify',
  natural_search: 'musicscale.live.search.interpret',
  metadata_normalization: 'musicscale.live.metadata.normalize',
  post_service_summary: 'musicscale.live.post-service.summary',
  pre_service_risk_summary: 'musicscale.live.pre-service-risk.explain'
};

const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    summary: {
      type: 'string',
      description: 'Short human explanation. Do not claim an action was executed.'
    },
    confidence: {
      type: 'number',
      minimum: 0,
      maximum: 1
    },
    suggestions: {
      type: 'array',
      maxItems: 12,
      items: {
        type: 'object',
        properties: {
          kind: { type: 'string' },
          label: { type: 'string' },
          reason: { type: 'string' },
          value: { type: 'string' }
        },
        required: ['kind', 'label', 'reason']
      }
    },
    warnings: {
      type: 'array',
      maxItems: 12,
      items: { type: 'string' }
    }
  },
  required: ['summary', 'confidence', 'suggestions', 'warnings']
} as const;

const TASK_INSTRUCTIONS: Record<MusicScaleLiveAiTask, string> = {
  diagnostic_explanation:
    'Explain the supplied diagnostics in plain language. Separate observed facts from hypotheses. Suggest only safe troubleshooting steps.',
  song_match_assist:
    'Compare the supplied song identity candidates. Explain evidence such as title, artist, version and lyrics fingerprint. Never choose a candidate as certain when evidence is ambiguous.',
  request_classification:
    'Classify and deduplicate collaboration requests. Preserve the original intent and never convert a request into an execution command.',
  natural_search:
    'Interpret the natural-language search into search hints only. Never claim that content was shown or execute TAKE.',
  metadata_normalization:
    'Normalize names, tags and metadata while preserving meaning. Do not invent missing factual values.',
  post_service_summary:
    'Summarize only the supplied post-service facts. Do not judge people, infer motives, or invent causes for missing events.',
  pre_service_risk_summary:
    'Explain only risks supported by the supplied preflight/rehearsal facts and point to safe preparation actions. Do not execute provider commands.'
};

const cache = new Map<string, {
  expiresAt: number;
  result: AiGatewayOutput;
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
}>();

let consecutiveProviderFailures = 0;
let circuitOpenUntil = 0;

function isSafeId(value: unknown, max = 256): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= max
    && value !== '.'
    && value !== '..'
    && !value.includes('/')
    && !value.includes('\\')
    && !/[\u0000-\u001F\u007F]/.test(value);
}

function clampText(value: string, max = 6000): string {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').slice(0, max);
}

function redactString(value: string): string {
  return clampText(value)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email-redacted]')
    .replace(/(?:\+?\d[\d\s().-]{7,}\d)/g, '[phone-redacted]')
    .replace(/\b(?:Bearer\s+)?[A-Za-z0-9_-]{28,}\b/g, '[secret-redacted]');
}

function redact(value: unknown, depth = 0): unknown {
  if (depth > 7) return '[depth-limited]';
  if (typeof value === 'string') return redactString(value);
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) return value;
  if (Array.isArray(value)) return value.slice(0, 200).map(item => redact(item, depth + 1));
  if (!value || typeof value !== 'object') return null;

  const output: Record<string, unknown> = {};
  const blocked = /token|secret|password|api.?key|authorization|cookie|refresh/i;
  for (const [key, child] of Object.entries(value as Record<string, unknown>).slice(0, 250)) {
    output[key] = blocked.test(key) ? '[secret-redacted]' : redact(child, depth + 1);
  }
  return output;
}

function validateOutput(value: unknown): value is AiGatewayOutput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const raw = value as Record<string, unknown>;
  if (typeof raw.summary !== 'string' || raw.summary.length > 5000) return false;
  if (typeof raw.confidence !== 'number' || !Number.isFinite(raw.confidence) || raw.confidence < 0 || raw.confidence > 1) return false;
  if (!Array.isArray(raw.suggestions) || raw.suggestions.length > 12) return false;
  if (!Array.isArray(raw.warnings) || raw.warnings.length > 12 || raw.warnings.some(item => typeof item !== 'string')) return false;

  for (const item of raw.suggestions) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
    const suggestion = item as Record<string, unknown>;
    if (
      typeof suggestion.kind !== 'string'
      || typeof suggestion.label !== 'string'
      || typeof suggestion.reason !== 'string'
      || (suggestion.value !== undefined && typeof suggestion.value !== 'string')
    ) return false;
  }
  return true;
}

function requestFingerprint(
  organizationId: string,
  task: MusicScaleLiveAiTask,
  redactedInput: unknown
): string {
  return createHash('sha256')
    .update(JSON.stringify({ organizationId, task, input: redactedInput }))
    .digest('hex');
}

function monthKey(nowMs: number): string {
  return new Date(nowMs).toISOString().slice(0, 7);
}

function readPositiveNumber(name: string, fallback: number): number {
  const value = Number(process.env[name] || '');
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

async function defaultGenerate(input: {
  model: string;
  prompt: string;
  timeoutMs: number;
  task: MusicScaleLiveAiTask;
  organizationId: string;
  actorUid: string;
  input: unknown;
}): Promise<{ text: string; inputTokens?: number; outputTokens?: number }> {
  const canonicalTask = NESTAI_TASK_IDS[input.task];
  const issued = issueNestAiToken({
    uid: input.actorUid,
    organizationId: input.organizationId,
    appId: 'musicscale',
    appCheckAppId: 'server:millionsnest',
    capabilities: ['ai:run'],
    tokenType: 'service',
    locale: 'pt-BR'
  });

  const client = createNestAiClient({
    appId: 'musicscale',
    organizationId: input.organizationId,
    locale: 'pt-BR',
    getToken: async () => issued.token,
    baseUrl: process.env.NESTAI_BASE_URL || 'https://ai.millionsnest.com/v1/'
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs);
  try {
    const response = await Promise.race([
      client.run<AiGatewayOutput>({ task: canonicalTask, input: input.input }),
      new Promise<never>((_, reject) => {
        controller.signal.addEventListener('abort', () => reject(new Error('AI_TIMEOUT')), { once: true });
      })
    ]);
    return {
      text: JSON.stringify(response.result),
      inputTokens: 0,
      outputTokens: 0
    };
  } finally {
    clearTimeout(timer);
  }
}

async function authenticate(req: Request, dependencies: Dependencies): Promise<string | null> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ') || header.length <= 7) return null;
  try {
    const verify = dependencies.verifyIdToken ?? ((token: string) => getAuth().verifyIdToken(token));
    const uid = (await verify(header.slice(7))).uid;
    return isSafeId(uid) ? uid : null;
  } catch {
    return null;
  }
}

async function consumeBudget(
  db: Firestore,
  organizationId: string,
  task: MusicScaleLiveAiTask,
  nowMs: number
): Promise<{ allowed: true; used: number; limit: number } | { allowed: false; used: number; limit: number }> {
  const limit = Math.floor(readPositiveNumber('MUSICSCALE_LIVE_AI_MONTHLY_REQUEST_LIMIT', 200));
  const ref = db.doc(`organizations/${organizationId}/musicscaleLiveAiUsage/${monthKey(nowMs)}`);
  return db.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    const current = Number(snapshot.data()?.requests || 0);
    if (current >= limit) return { allowed: false as const, used: current, limit };

    transaction.set(ref, {
      organizationId,
      month: monthKey(nowMs),
      requests: current + 1,
      byTask: {
        ...(snapshot.data()?.byTask || {}),
        [task]: Number(snapshot.data()?.byTask?.[task] || 0) + 1
      },
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    return { allowed: true as const, used: current + 1, limit };
  });
}

async function writeAudit(input: {
  db: Firestore;
  organizationId: string;
  actorUid: string;
  task: MusicScaleLiveAiTask;
  fingerprint: string;
  model: string;
  fromCache: boolean;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  accepted: boolean;
  reasonCode?: string;
  redactedInput: unknown;
  result?: AiGatewayOutput;
}): Promise<void> {
  const id = createHash('sha256')
    .update(`${input.fingerprint}|${input.actorUid}|${Date.now()}|${Math.random()}`)
    .digest('hex')
    .slice(0, 40);

  await input.db.doc(
    `organizations/${input.organizationId}/musicscaleLiveAiAudits/${id}`
  ).set({
    schemaVersion: 1,
    organizationId: input.organizationId,
    actorUid: input.actorUid,
    task: input.task,
    fingerprint: input.fingerprint,
    model: input.model,
    fromCache: input.fromCache,
    latencyMs: input.latencyMs,
    inputTokens: input.inputTokens,
    outputTokens: input.outputTokens,
    estimatedCostUsd: input.estimatedCostUsd,
    accepted: input.accepted,
    reasonCode: input.reasonCode || null,
    redactedInput: input.redactedInput,
    result: input.result || null,
    createdAt: FieldValue.serverTimestamp()
  });
}

export async function handleMusicScaleLiveAiRequest(
  req: Request,
  res: Response,
  dependencies: Dependencies = {}
) {
  const actorUid = await authenticate(req, dependencies);
  if (!actorUid) {
    return res.status(401).json({ success: false, reasonCode: 'UNAUTHENTICATED' });
  }

  const organizationId = String(req.params.organizationId || '').trim();
  if (!isSafeId(organizationId)) {
    return res.status(400).json({ success: false, reasonCode: 'INVALID_ORGANIZATION' });
  }

  const task = String(req.body?.task || '') as MusicScaleLiveAiTask;
  if (!TASKS.has(task)) {
    return res.status(400).json({ success: false, reasonCode: 'INVALID_AI_TASK' });
  }

  const redactedInput = redact(req.body?.input ?? {});
  const serializedInput = JSON.stringify(redactedInput);
  if (serializedInput.length > 48_000) {
    return res.status(413).json({ success: false, reasonCode: 'AI_INPUT_TOO_LARGE' });
  }

  const nowMs = (dependencies.now ?? Date.now)();
  if (circuitOpenUntil > nowMs) {
    return res.status(503).json({
      success: false,
      reasonCode: 'AI_CIRCUIT_OPEN',
      fallback: 'deterministic'
    });
  }

  let db: Firestore;
  try {
    db = (dependencies.getFirestore ?? getFirestore)();
    const resolveAccess = dependencies.resolveAccess ?? resolveEcosystemAppAccess;
    const access = await resolveAccess({
      uid: actorUid,
      organizationId,
      appId: 'musicscale',
      db
    });
    if (!access.accessible) {
      return res.status(403).json({ success: false, reasonCode: 'MUSICSCALE_ACCESS_DENIED' });
    }
  } catch (error) {
    console.error('[MusicScaleLiveAI] Authorization failed', error);
    return res.status(503).json({ success: false, reasonCode: 'AI_AUTHORIZATION_UNAVAILABLE' });
  }

  const fingerprint = requestFingerprint(organizationId, task, redactedInput);
  const cached = cache.get(fingerprint);
  if (cached && cached.expiresAt > nowMs) {
    res.setHeader('Cache-Control', 'private, no-store');
    await writeAudit({
      db,
      organizationId,
      actorUid,
      task,
      fingerprint,
      model: cached.model,
      fromCache: true,
      latencyMs: 0,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostUsd: 0,
      accepted: true,
      redactedInput,
      result: cached.result
    }).catch(() => undefined);
    return res.status(200).json({
      success: true,
      task,
      fromCache: true,
      model: cached.model,
      result: cached.result,
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        estimatedCostUsd: 0
      }
    });
  }

  const budget = await consumeBudget(db, organizationId, task, nowMs).catch(() => null);
  if (!budget) {
    return res.status(503).json({ success: false, reasonCode: 'AI_BUDGET_STATE_UNAVAILABLE' });
  }
  if (!budget.allowed) {
    return res.status(429).json({
      success: false,
      reasonCode: 'AI_MONTHLY_BUDGET_EXCEEDED',
      used: budget.used,
      limit: budget.limit
    });
  }

  const model = 'nestai-managed';
  const timeoutMs = Math.floor(readPositiveNumber('MUSICSCALE_LIVE_AI_TIMEOUT_MS', 12_000));
  const prompt = [
    'NestAI canonical task: ' + NESTAI_TASK_IDS[task],
    TASK_INSTRUCTIONS[task],
    `Input: ${serializedInput}`
  ].join('\n');

  const startedAt = Date.now();
  try {
    const generated = await (dependencies.generate ?? defaultGenerate)({
      model,
      prompt,
      timeoutMs,
      task,
      organizationId,
      actorUid,
      input: redactedInput
    });
    const parsed = JSON.parse(generated.text || '{}') as unknown;
    if (!validateOutput(parsed)) {
      throw new Error('AI_OUTPUT_SCHEMA_INVALID');
    }

    consecutiveProviderFailures = 0;
    const inputTokens = Number.isFinite(generated.inputTokens) ? Number(generated.inputTokens) : 0;
    const outputTokens = Number.isFinite(generated.outputTokens) ? Number(generated.outputTokens) : 0;
    const cost = 0;
    const latencyMs = Date.now() - startedAt;
    const ttlMs = Math.floor(readPositiveNumber('MUSICSCALE_LIVE_AI_CACHE_TTL_MS', 15 * 60 * 1000));

    cache.set(fingerprint, {
      expiresAt: nowMs + ttlMs,
      result: parsed,
      model,
      inputTokens,
      outputTokens,
      estimatedCostUsd: cost
    });
    if (cache.size > 500) {
      const first = cache.keys().next().value;
      if (typeof first === 'string') cache.delete(first);
    }

    await writeAudit({
      db,
      organizationId,
      actorUid,
      task,
      fingerprint,
      model,
      fromCache: false,
      latencyMs,
      inputTokens,
      outputTokens,
      estimatedCostUsd: cost,
      accepted: true,
      redactedInput,
      result: parsed
    }).catch(() => undefined);

    res.setHeader('Cache-Control', 'private, no-store');
    return res.status(200).json({
      success: true,
      task,
      fromCache: false,
      model,
      result: parsed,
      usage: {
        inputTokens,
        outputTokens,
        estimatedCostUsd: cost,
        latencyMs,
        monthlyRequests: budget.used,
        monthlyLimit: budget.limit
      }
    });
  } catch (error) {
    consecutiveProviderFailures += 1;
    if (consecutiveProviderFailures >= 3) {
      circuitOpenUntil = Date.now() + 60_000;
    }

    const code = error instanceof Error ? error.message : 'AI_PROVIDER_ERROR';
    await writeAudit({
      db,
      organizationId,
      actorUid,
      task,
      fingerprint,
      model,
      fromCache: false,
      latencyMs: Date.now() - startedAt,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostUsd: 0,
      accepted: false,
      reasonCode: code,
      redactedInput
    }).catch(() => undefined);

    console.error('[MusicScaleLiveAI] Provider request failed', {
      task,
      model,
      code
    });
    return res.status(code === 'AI_PROVIDER_NOT_CONFIGURED' ? 503 : 502).json({
      success: false,
      reasonCode: code === 'AI_PROVIDER_NOT_CONFIGURED'
        ? code
        : 'AI_UNAVAILABLE',
      fallback: 'deterministic'
    });
  }
}
