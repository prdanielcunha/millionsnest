import type { ActionPreference, ActionPreferenceMode } from '../lib/actionCenter.js';
import type {
  ActionResolutionRecord
} from '../lib/actionResolution.js';
import type {
  ActionOutcomeCode,
  ActionOutcomeResult
} from '../lib/outcomeEngine.js';

type PreferenceResponse = {
  success: boolean;
  preferences?: ActionPreference[];
  preference?: ActionPreference;
  resolutions?: ActionResolutionRecord[];
  resolution?: ActionResolutionRecord;
  reasonCode?: string;
};

async function parseResponse(response: Response): Promise<PreferenceResponse> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.success !== true) {
    throw new Error(payload?.reasonCode || 'ACTION_PREFERENCE_REQUEST_FAILED');
  }
  return payload;
}

export async function fetchActionPreferences(
  idToken: string,
  organizationId: string,
  signal?: AbortSignal
): Promise<ActionPreference[]> {
  const response = await fetch(
    `/api/v1/organizations/${encodeURIComponent(organizationId)}/action-preferences`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${idToken}`,
        Accept: 'application/json',
        'Cache-Control': 'no-store'
      },
      signal
    }
  );

  const payload = await parseResponse(response);
  return Array.isArray(payload.preferences) ? payload.preferences : [];
}

export async function saveActionPreference(
  idToken: string,
  organizationId: string,
  input: {
    dedupeKey: string;
    fingerprint: string;
    mode: ActionPreferenceMode | 'clear';
    snoozedUntilMs?: number | null;
  }
): Promise<ActionPreference | null> {
  const response = await fetch(
    `/api/v1/organizations/${encodeURIComponent(organizationId)}/action-preference`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Cache-Control': 'no-store'
      },
      body: JSON.stringify(input)
    }
  );

  const payload = await parseResponse(response);
  return payload.preference ?? null;
}


export async function fetchActionResolutions(
  idToken: string,
  organizationId: string,
  signal?: AbortSignal
): Promise<ActionResolutionRecord[]> {
  const response = await fetch(
    `/api/v1/organizations/${encodeURIComponent(organizationId)}/action-resolutions`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${idToken}`,
        Accept: 'application/json',
        'Cache-Control': 'no-store'
      },
      signal
    }
  );

  const payload = await parseResponse(response);
  return Array.isArray(payload.resolutions)
    ? payload.resolutions
    : [];
}

export async function startActionResolution(
  idToken: string,
  organizationId: string,
  input: Pick<
    ActionResolutionRecord,
    'dedupeKey' | 'fingerprint' | 'sourceApp' | 'signalType'
  > & {
    outcomeResult: ActionOutcomeResult;
    outcomeCode: ActionOutcomeCode;
  }
): Promise<ActionResolutionRecord> {
  const response = await fetch(
    `/api/v1/organizations/${encodeURIComponent(organizationId)}/action-resolution/start`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Cache-Control': 'no-store'
      },
      body: JSON.stringify(input)
    }
  );

  const payload = await parseResponse(response);
  if (!payload.resolution) {
    throw new Error('ACTION_RESOLUTION_MISSING');
  }
  return payload.resolution;
}

export async function observeActionResolutionOutcome(
  idToken: string,
  organizationId: string,
  input: Pick<
    ActionResolutionRecord,
    'dedupeKey' | 'fingerprint' | 'sourceApp' | 'signalType'
  >
): Promise<ActionResolutionRecord> {
  const response = await fetch(
    `/api/v1/organizations/${encodeURIComponent(organizationId)}/action-resolution/outcome`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Cache-Control': 'no-store'
      },
      body: JSON.stringify(input)
    }
  );

  const payload = await parseResponse(response);
  if (!payload.resolution) {
    throw new Error('ACTION_RESOLUTION_OUTCOME_MISSING');
  }
  return payload.resolution;
}
