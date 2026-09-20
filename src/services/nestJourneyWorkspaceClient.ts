import type { NestJourneyWorkspaceProjection } from '../lib/nestJourneyWorkspaceProjection.js';

export async function fetchNestJourneyWorkspaceProjection(
  idToken: string,
  organizationId: string,
  signal?: AbortSignal
): Promise<NestJourneyWorkspaceProjection> {
  const cleanOrganizationId = organizationId.trim();
  if (!idToken.trim() || !cleanOrganizationId) {
    throw new Error('INVALID_NESTJOURNEY_WORKSPACE_REQUEST');
  }

  const params = new URLSearchParams({ organizationId: cleanOrganizationId });
  const response = await fetch(
    `/api/ecosystem/nestjourney/workspace-projection?${params.toString()}`,
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

  if (!response.ok) {
    throw new Error(
      response.status === 401
        ? 'NESTJOURNEY_WORKSPACE_UNAUTHENTICATED'
        : 'NESTJOURNEY_WORKSPACE_UNAVAILABLE'
    );
  }

  const payload = await response.json();
  const projection = payload?.projection as NestJourneyWorkspaceProjection | undefined;

  if (
    payload?.success !== true ||
    !projection ||
    projection.appId !== 'nestjourney' ||
    projection.organizationId !== cleanOrganizationId ||
    !Number.isFinite(projection.observedAtMs)
  ) {
    throw new Error('INVALID_NESTJOURNEY_WORKSPACE_PROJECTION');
  }

  return projection;
}
