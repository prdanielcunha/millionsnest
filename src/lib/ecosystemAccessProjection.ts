export type MusicScaleCatalogState =
  | 'available'
  | 'trialing'
  | 'active'
  | 'cancel_scheduled'
  | 'payment_issue'
  | 'administrative'
  | 'unavailable'
  | 'loading'
  | 'error';

export interface MusicScaleAccessProjection {
  appId: 'musicscale';
  organizationId: string;
  accessible: boolean;
  isGlobalAccess: boolean;
  accessSource: 'global_system_role' | 'organization_membership' | 'denied';
  decisionState: 'granted' | 'denied';
  denialReason: string | null;
  catalogState: MusicScaleCatalogState;
  entitlement: {
    canonicalStatus: 'active' | 'trialing' | 'inactive' | 'missing' | 'unknown';
    cancellationScheduled: boolean;
    currentPeriodEndMs: number | null;
    individualAccessSource: 'explicit_enabled' | 'membership_compatibility' | 'explicit_disabled' | 'global_system_role';
  } | null;
}

export interface EcosystemAccessProjectionResponse {
  success: true;
  organizationId: string;
  generatedAtMs: number;
  apps: {
    musicscale: MusicScaleAccessProjection;
  };
}

export function mapCanonicalDecisionToCatalogState(
  accessible: boolean,
  isGlobalAccess: boolean,
  denialReason: string | null | undefined,
  canonicalStatus: string | undefined,
  cancellationScheduled: boolean | undefined
): MusicScaleCatalogState {
  if (accessible) {
    if (isGlobalAccess) return 'administrative';
    if (cancellationScheduled) return 'cancel_scheduled';
    if (canonicalStatus === 'trialing') return 'trialing';
    return 'active';
  } else {
    if (denialReason === 'SUBSCRIPTION_PAYMENT_REQUIRED') return 'payment_issue';
    if (
      denialReason === 'SUBSCRIPTION_NOT_FOUND' ||
      denialReason === 'SUBSCRIPTION_INACTIVE' ||
      denialReason === 'ENTITLEMENT_NOT_CONFIGURED' ||
      denialReason === 'ENTITLEMENT_INACTIVE'
    ) {
      return 'available';
    }
    return 'unavailable';
  }
}
