import type { MusicScaleAccessProjection } from './ecosystemAccessProjection.js';
import type { HubLensAuthorizationProjection } from './lensResolver.js';

export interface CurrentHubLensAuthorityInput {
  canManageOrganization: boolean;
  musicScaleAccess?: MusicScaleAccessProjection | null;
}

/**
 * Transitional authority adapter for Adaptive Hub Lenses.
 *
 * This adapter does not infer new permissions. It only translates authorities
 * that already exist in the current Hub into presentation-domain booleans.
 * Missing domains remain false until their owning product exposes a canonical,
 * backend-authoritative capability projection.
 */
export function deriveCurrentHubLensAuthorization(
  input: CurrentHubLensAuthorityInput
): HubLensAuthorizationProjection {
  const musicScaleAccess = input.musicScaleAccess;

  // Global ecosystem access is intentionally not treated as worship-domain
  // content authority. Administrative authority and ministry-content access are
  // separate concerns in Church Intelligence OS.
  const worship = Boolean(
    musicScaleAccess?.accessible === true &&
    musicScaleAccess?.decisionState === 'granted' &&
    musicScaleAccess?.canReadManagedScaleResponses === true &&
    musicScaleAccess?.isGlobalAccess !== true
  );

  return {
    pastoral: false,
    journey: false,
    worship,
    finance: false,
    administration: input.canManageOrganization === true
  };
}
