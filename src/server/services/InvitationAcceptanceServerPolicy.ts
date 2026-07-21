import { InvitationMemberCapacity } from './InvitationAcceptancePlanner.js';

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

  if (!subscription.exists || !organizationApp.exists) {
    return { success: false, reasonCode: 'MEMBER_LIMIT_UNAVAILABLE' };
  }

  if (subscription.organizationId !== organizationId) {
    return { success: false, reasonCode: 'MEMBER_LIMIT_UNAVAILABLE' };
  }

  if (subscription.app !== 'musicscale') {
    return { success: false, reasonCode: 'MEMBER_LIMIT_UNAVAILABLE' };
  }

  const validStatuses = ['active', 'trialing'];
  
  if (typeof subscription.status !== 'string' || !validStatuses.includes(subscription.status)) {
    return { success: false, reasonCode: 'MEMBER_LIMIT_UNAVAILABLE' };
  }

  if (typeof organizationApp.status !== 'string' || !validStatuses.includes(organizationApp.status)) {
    return { success: false, reasonCode: 'MEMBER_LIMIT_UNAVAILABLE' };
  }

  if (subscription.plan !== organizationApp.plan) {
    return { success: false, reasonCode: 'MEMBER_LIMIT_UNAVAILABLE' };
  }

  const plan = subscription.plan;
  if (plan !== 'starter' && plan !== 'advanced' && plan !== 'pro') {
    return { success: false, reasonCode: 'MEMBER_LIMIT_INVALID' };
  }

  const expectedLimit = plan === 'starter' ? 10 : (plan === 'advanced' ? 20 : -1);

  if (subscription.limitsUsers !== expectedLimit || organizationApp.limitsUsers !== expectedLimit) {
    return { success: false, reasonCode: 'MEMBER_LIMIT_INVALID' };
  }

  let activeCount = 0;
  for (const status of memberStatuses) {
    if (status === 'active' || status === undefined) {
      activeCount++;
    } else if (['suspended', 'inactive', 'removed', 'revoked', 'deleted'].includes(status as string)) {
      // Ignored
    } else {
      return { success: false, reasonCode: 'MEMBER_LIMIT_INVALID' };
    }
  }

  if (plan === 'pro') {
    return {
      success: true,
      capacity: {
        resolved: true,
        mode: 'unlimited'
      },
      plan: 'pro'
    };
  } else {
    return {
      success: true,
      capacity: {
        resolved: true,
        mode: 'limited',
        currentActiveMembers: activeCount,
        maxMembers: expectedLimit
      },
      plan: plan as 'starter' | 'advanced'
    };
  }
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
