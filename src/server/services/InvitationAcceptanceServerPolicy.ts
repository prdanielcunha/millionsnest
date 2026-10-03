import { InvitationMemberCapacity } from './InvitationAcceptancePlanner.js';
import { MUSIC_SCALE_PLANS } from '../../lib/musicScalePlans.js';

export type CanonicalMusicScalePlan = 'starter' | 'advanced' | 'pro';

export type CanonicalInvitationEntitlementInput = {
  organizationId: string;
  subscription: {
    exists: boolean;
    organizationId?: unknown;
    app?: unknown;
    status?: unknown;
    plan?: unknown;
    limitsUsers?: unknown;
  };
  organizationApp: {
    exists: boolean;
    status?: unknown;
    plan?: unknown;
    limitsUsers?: unknown;
  };
  memberStatuses: unknown[];
};

export type ResolveCanonicalInvitationCapacitySuccess = {
  success: true;
  capacity: InvitationMemberCapacity;
  plan: CanonicalMusicScalePlan;
};

export type ResolveCanonicalInvitationCapacityFailure = {
  success: false;
  reasonCode: 'MEMBER_LIMIT_UNAVAILABLE' | 'MEMBER_LIMIT_INVALID';
};

export type ResolveCanonicalInvitationCapacityResult = ResolveCanonicalInvitationCapacitySuccess | ResolveCanonicalInvitationCapacityFailure;

export function resolveCanonicalInvitationCapacity(input: CanonicalInvitationEntitlementInput): ResolveCanonicalInvitationCapacityResult {
  const { subscription, organizationApp, organizationId, memberStatuses } = input;

  if (!subscription.exists) {
    return { success: false, reasonCode: 'MEMBER_LIMIT_UNAVAILABLE' };
  }

  // The subscription document is already read from subscriptions/{organizationId}.
  // Keep explicit identifiers as integrity checks when present, but do not make
  // legacy records fail simply because older schemas did not duplicate them.
  if (
    subscription.organizationId !== undefined &&
    subscription.organizationId !== null &&
    subscription.organizationId !== '' &&
    subscription.organizationId !== organizationId
  ) {
    return { success: false, reasonCode: 'MEMBER_LIMIT_UNAVAILABLE' };
  }

  if (
    subscription.app !== undefined &&
    subscription.app !== null &&
    subscription.app !== '' &&
    subscription.app !== 'musicscale'
  ) {
    return { success: false, reasonCode: 'MEMBER_LIMIT_UNAVAILABLE' };
  }

  const normalizeStatus = (value: unknown): string =>
    typeof value === 'string' ? value.trim().toLowerCase() : '';

  const validStatuses = ['active', 'trialing'];
  const subscriptionStatus = normalizeStatus(subscription.status);

  if (!validStatuses.includes(subscriptionStatus)) {
    return { success: false, reasonCode: 'MEMBER_LIMIT_UNAVAILABLE' };
  }

  // subscriptions/{orgId} is the canonical paid/trialing product state.
  // organizations/{id}.apps.musicscale is only a materialized cache and can
  // temporarily lag after checkout/reconciliation. A stale cache must never
  // block a customer whose canonical subscription is active or trialing.

  const normalizePlan = (value: unknown): CanonicalMusicScalePlan | null => {
    if (typeof value !== 'string') return null;
    const normalized = value.trim().toLowerCase();
    if (!normalized) return null;

    // Keep compatibility with previous billing labels while preserving a
    // strict finite result. Unknown values are not silently downgraded.
    if (
      normalized === 'pro' ||
      normalized.includes('premium') ||
      normalized.includes('complete') ||
      normalized.includes('completo')
    ) {
      return 'pro';
    }
    if (
      normalized === 'advanced' ||
      normalized.includes('advance') ||
      normalized.includes('intermediate') ||
      normalized.includes('intermediario') ||
      normalized.includes('intermediário')
    ) {
      return 'advanced';
    }
    if (normalized === 'starter' || normalized.includes('starter')) {
      return 'starter';
    }
    return null;
  };

  const subscriptionPlan = normalizePlan(subscription.plan);
  const organizationPlan = normalizePlan(organizationApp.plan);
  const hasExplicitSubscriptionPlan =
    typeof subscription.plan === 'string' && subscription.plan.trim() !== '';
  const hasExplicitOrganizationPlan =
    typeof organizationApp.plan === 'string' && organizationApp.plan.trim() !== '';

  // Prefer the canonical subscription plan. The organization-side plan is a
  // compatibility fallback only when the subscription record predates the
  // current plan field. Do not let a stale organization cache override or
  // conflict with a valid canonical subscription.
  if (hasExplicitSubscriptionPlan && !subscriptionPlan && !organizationPlan) {
    return { success: false, reasonCode: 'MEMBER_LIMIT_INVALID' };
  }
  if (!subscriptionPlan && hasExplicitOrganizationPlan && !organizationPlan) {
    return { success: false, reasonCode: 'MEMBER_LIMIT_INVALID' };
  }
  if (!subscriptionPlan && !organizationPlan) {
    return { success: false, reasonCode: 'MEMBER_LIMIT_UNAVAILABLE' };
  }

  const plan = subscriptionPlan || organizationPlan;
  if (!plan) {
    return { success: false, reasonCode: 'MEMBER_LIMIT_UNAVAILABLE' };
  }

  // Capacity comes from the server-owned plan catalog, not duplicated limits
  // stored in Firestore. This avoids false 503s after schema migrations while
  // preserving the actual commercial limits.
  const expectedLimit = MUSIC_SCALE_PLANS[plan].limits.users;

  let activeCount = 0;
  for (const rawStatus of memberStatuses) {
    const status = typeof rawStatus === 'string'
      ? rawStatus.trim().toLowerCase()
      : rawStatus;

    if (status === 'active' || status === undefined || status === null || status === '') {
      activeCount++;
    } else if (['suspended', 'inactive', 'removed', 'revoked', 'deleted', 'disabled', 'archived'].includes(status as string)) {
      // Inactive memberships do not consume a slot.
    } else {
      return { success: false, reasonCode: 'MEMBER_LIMIT_INVALID' };
    }
  }

  if (expectedLimit === -1) {
    return {
      success: true,
      capacity: {
        resolved: true,
        mode: 'unlimited'
      },
      plan
    };
  }

  if (!Number.isInteger(expectedLimit) || expectedLimit <= 0) {
    return { success: false, reasonCode: 'MEMBER_LIMIT_INVALID' };
  }

  return {
    success: true,
    capacity: {
      resolved: true,
      mode: 'limited',
      currentActiveMembers: activeCount,
      maxMembers: expectedLimit
    },
    plan
  };
}

export function normalizeInvitationTemporalMs(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value.getTime();
  }
  if (value !== null && typeof value === 'object' && 'toMillis' in value) {
    const toMillisFn = (value as { toMillis?: unknown }).toMillis;
    if (typeof toMillisFn === 'function') {
      try {
        const ms = toMillisFn.call(value);
        if (typeof ms === 'number' && Number.isFinite(ms)) {
          return ms;
        }
      } catch (e) {
        return undefined;
      }
    }
  }
  return undefined;
}
