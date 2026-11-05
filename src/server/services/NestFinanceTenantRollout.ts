import { canAccessNestFinanceDevelopment } from '../../lib/permissionService.js';

/**
 * Only lifts the temporary developer-only entry barrier. All ordinary
 * organization, active entitlement and explicit member appAccess checks must
 * still be evaluated by EcosystemAccessResolver. Never use as an auth grant.
 */
export function mayAttemptNestFinanceTenantAccess(
  systemRole: string | null | undefined,
  publicAccessFlag: unknown,
): boolean {
  return publicAccessFlag === 'true' || canAccessNestFinanceDevelopment(systemRole);
}
