const EXPLICITLY_INACTIVE_ORGANIZATION_STATUSES = new Set([
  'archived',
  'inactive',
  'suspended',
  'disabled',
  'deleted',
]);

const LEGACY_BILLING_STATUSES_WRITTEN_INTO_ORGANIZATION_STATUS = new Set([
  'trialing',
  'trial',
  'pro',
  'past_due',
  'unpaid',
  'incomplete',
  'incomplete_expired',
  'canceled',
  'cancelled',
  'paused',
  'none',
]);

function normalizeStatus(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

/**
 * Organization lifecycle and billing lifecycle are separate concerns.
 *
 * Historical billing code could write Stripe subscription statuses such as
 * "trialing" into organizations/{id}.status. Those values must not make an
 * otherwise-live tenant unusable. Product access is still decided separately
 * by canonical app/subscription entitlement checks.
 */
export function isOrganizationLifecycleActive(
  organizationOrStatus: unknown
): boolean {
  if (
    organizationOrStatus &&
    typeof organizationOrStatus === 'object' &&
    !Array.isArray(organizationOrStatus)
  ) {
    const organization = organizationOrStatus as Record<string, unknown>;
    if (
      organization.archived === true ||
      organization.disabled === true ||
      organization.deleted === true
    ) {
      return false;
    }

    const status = normalizeStatus(organization.status);
    if (!status) return true;
    if (EXPLICITLY_INACTIVE_ORGANIZATION_STATUSES.has(status)) return false;
    return status === 'active' ||
      LEGACY_BILLING_STATUSES_WRITTEN_INTO_ORGANIZATION_STATUS.has(status);
  }

  const status = normalizeStatus(organizationOrStatus);
  if (!status) return true;
  if (EXPLICITLY_INACTIVE_ORGANIZATION_STATUSES.has(status)) return false;
  return status === 'active' ||
    LEGACY_BILLING_STATUSES_WRITTEN_INTO_ORGANIZATION_STATUS.has(status);
}

/**
 * Safe repair predicate for records affected by the old billing/lifecycle
 * field collision. Explicit administrative inactive states are never healed.
 */
export function shouldRepairOrganizationLifecycleStatus(
  value: unknown
): boolean {
  const status = normalizeStatus(value);
  return !status ||
    LEGACY_BILLING_STATUSES_WRITTEN_INTO_ORGANIZATION_STATUS.has(status);
}
