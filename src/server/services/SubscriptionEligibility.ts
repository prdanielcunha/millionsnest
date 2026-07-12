import Stripe from 'stripe';

export type SubscriptionPurchaseEligibility = {
  allowed: boolean;
  reason: string;
  orgId: string;
  canonicalSubscriptionStatus: string | null;
  stripeSubscriptionId?: string;
  entitlementMaterialized: boolean;
  repairRequired: boolean;
  managementUrl: string;
  decision: "allow_new_subscription" | "resume_existing" | "block_duplicate" | "regularize_existing";
  hasResidualAccess?: boolean;
  accessUntil?: string | null;
  stripeCustomerId?: string;
  subscriptionId?: string;
};

export async function resolveSubscriptionPurchaseEligibility(
  stripe: Stripe,
  db: any,
  organizationId: string,
  stripeCustomerId?: string
): Promise<SubscriptionPurchaseEligibility> {
  const managementUrl = '/dashboard/billing';
  let canonicalSubscriptionStatus: string | null = null;
  let canonicalSubscriptionId: string | null = null;
  let entitlementMaterialized = false;

  try {
    const [subDoc, orgDoc] = await Promise.all([
      db.collection('subscriptions').doc(organizationId).get(),
      db.collection('organizations').doc(organizationId).get()
    ]);

    if (subDoc.exists) {
      const data = subDoc.data();
      canonicalSubscriptionStatus = data?.status || null;
      canonicalSubscriptionId = data?.stripeSubscriptionId || data?.id || null;
    }

    if (orgDoc.exists) {
      const musicscaleStatus = orgDoc.data()?.apps?.musicscale?.status;
      if (canonicalSubscriptionStatus === 'active' || canonicalSubscriptionStatus === 'trialing') {
        if (musicscaleStatus === 'active' || musicscaleStatus === 'trialing') {
          entitlementMaterialized = true;
        }
      }
    }
  } catch (err) {
    console.error('Error fetching entitlement status for eligibility:', err);
  }

  const baseResponse = {
    orgId: organizationId,
    canonicalSubscriptionStatus,
    entitlementMaterialized,
    repairRequired: false,
    managementUrl,
    stripeCustomerId
  };

  if (!stripeCustomerId) {
    return {
      ...baseResponse,
      allowed: true,
      decision: "allow_new_subscription",
      reason: "no_subscription",
      hasResidualAccess: false,
      accessUntil: null
    };
  }

  // Fetch subscriptions from Stripe for this customer
  const subscriptions = await stripe.subscriptions.list({
    customer: stripeCustomerId,
    status: 'all',
    limit: 100
  });

  const activeStatuses = ['active', 'trialing'];
  const pendingStatuses = ['past_due', 'unpaid', 'incomplete', 'paused'];

  let activeSub: Stripe.Subscription | null = null;
  let pendingSub: Stripe.Subscription | null = null;
  let latestCanceledSub: Stripe.Subscription | null = null;
  
  let multipleActiveConflict = false;
  let activeCount = 0;

  for (const sub of subscriptions.data) {
    // Multi-tenant check
    const isCanonical = canonicalSubscriptionId && sub.id === canonicalSubscriptionId;
    const isAppMatch = sub.metadata?.app === 'musicscale';
    const isOrgMatch = (sub.metadata?.organizationId === organizationId || sub.metadata?.orgId === organizationId || sub.metadata?.uid === organizationId);
    
    // We consider it relevant if it's explicitly matched or if it's the canonical one.
    if (!isCanonical && !(isOrgMatch && isAppMatch)) {
      continue;
    }

    if (activeStatuses.includes(sub.status)) {
      activeCount++;
      activeSub = sub;
    } else if (pendingStatuses.includes(sub.status)) {
      if (!pendingSub) pendingSub = sub;
    } else if (sub.status === 'canceled' || sub.status === 'incomplete_expired') {
      if (!latestCanceledSub || sub.created > latestCanceledSub.created) {
        latestCanceledSub = sub;
      }
    }
  }

  if (activeCount > 1) {
    return {
      ...baseResponse,
      allowed: false,
      repairRequired: true,
      decision: "block_duplicate",
      reason: "multiple_subscriptions_conflict"
    };
  }

  if (activeSub) {
    const repairRequired = !entitlementMaterialized;
    if (activeSub.cancel_at_period_end) {
      return {
        ...baseResponse,
        allowed: false,
        repairRequired,
        decision: "resume_existing",
        reason: "cancel_scheduled",
        subscriptionId: activeSub.id,
        stripeSubscriptionId: activeSub.id
      };
    } else {
      return {
        ...baseResponse,
        allowed: false,
        repairRequired,
        decision: "block_duplicate",
        reason: "active_subscription_exists",
        subscriptionId: activeSub.id,
        stripeSubscriptionId: activeSub.id
      };
    }
  }

  if (pendingSub) {
    return {
      ...baseResponse,
      allowed: false,
      decision: "regularize_existing",
      reason: pendingSub.status as any,
      subscriptionId: pendingSub.id,
      stripeSubscriptionId: pendingSub.id
    };
  }

  let hasResidualAccess = false;
  let accessUntil: string | null = null;

  if (latestCanceledSub) {
    hasResidualAccess = (latestCanceledSub as any).current_period_end * 1000 > Date.now();
    if (hasResidualAccess) {
      accessUntil = new Date((latestCanceledSub as any).current_period_end * 1000).toISOString();
      return {
        ...baseResponse,
        allowed: false,
        decision: "block_duplicate",
        reason: "canceled_with_residual_access",
        hasResidualAccess,
        accessUntil,
        subscriptionId: latestCanceledSub.id,
        stripeSubscriptionId: latestCanceledSub.id
      };
    }
  }

  return {
    ...baseResponse,
    allowed: true,
    decision: "allow_new_subscription",
    reason: latestCanceledSub ? "previous_subscription_expired" : "no_subscription",
    hasResidualAccess: false,
    accessUntil: null
  };
}
