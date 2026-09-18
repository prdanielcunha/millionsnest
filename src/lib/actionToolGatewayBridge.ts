import type {
  ReadOnlyHubAction
} from './actionCenter.js';

const MANAGED_MUSICSCALE_SIGNALS = new Set([
  'musicscale_pending_responses',
  'musicscale_declined_responses',
  'musicscale_repertoire_content_gaps'
]);

export interface ActionToolRequest {
  toolId: 'musicscale.scale.review';
  idempotencyKey: string;
  input: {
    scaleId: string;
  };
  source: {
    dedupeKey: string;
    fingerprint: string;
    signalType: string;
  };
}

function scaleIdFromPath(
  path: string | undefined
): string | null {
  if (!path) return null;

  const match = path.match(
    /^\/scales\/([^/?#]+)$/
  );

  if (!match) return null;

  const scaleId = decodeURIComponent(
    match[1]
  ).trim();

  if (
    !scaleId ||
    scaleId.length > 256 ||
    scaleId.includes('/') ||
    scaleId.includes('\\')
  ) {
    return null;
  }

  return scaleId;
}

export function buildActionToolRequest(
  action: ReadOnlyHubAction
): ActionToolRequest | null {
  if (
    action.sourceApp !== 'musicscale' ||
    action.destination.kind !== 'app' ||
    action.destination.appId !==
      'musicscale' ||
    !MANAGED_MUSICSCALE_SIGNALS.has(
      action.signalType
    )
  ) {
    return null;
  }

  const scaleId = scaleIdFromPath(
    action.destination.path
  );

  if (!scaleId) return null;

  const idempotencyKey =
    [
      'action',
      action.signalType,
      action.fingerprint
    ]
      .join(':')
      .slice(0, 256);

  return {
    toolId: 'musicscale.scale.review',
    idempotencyKey,
    input: {
      scaleId
    },
    source: {
      dedupeKey: action.dedupeKey,
      fingerprint: action.fingerprint,
      signalType: action.signalType
    }
  };
}

export interface ToolNavigationResult {
  appId: 'musicscale';
  path: string;
}

export function parseToolNavigationResult(
  payload: unknown
): ToolNavigationResult | null {
  if (
    !payload ||
    typeof payload !== 'object'
  ) {
    return null;
  }

  const result =
    (payload as any).result;

  if (
    !result ||
    result.code !== 'NAVIGATION_READY' ||
    !result.destination ||
    result.destination.appId !==
      'musicscale' ||
    typeof result.destination.path !==
      'string' ||
    !/^\/scales\/[^/?#]+$/.test(
      result.destination.path
    )
  ) {
    return null;
  }

  return {
    appId: 'musicscale',
    path: result.destination.path
  };
}
