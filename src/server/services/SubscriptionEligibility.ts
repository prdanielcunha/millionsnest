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
  const managementUrl = '/musicscale#musicscale-demo';

  let canonicalSubscriptionStatus: string | null = null;
  let entitlementMaterialized = false;

  try {
    const [subDoc, orgDoc] = await Promise.all([
      db.collection('subscriptions').doc(organizationId).get(),
      db.collection('organizations').doc(organizationId).get()
    ]);
    if (subDoc.exists) {
      canonicalSubscriptionStatus = subDoc.data()?.status || null;
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
    limit: 10
  });

  const activeStatuses = ['active', 'trialing'];
  const pendingStatuses = ['past_due', 'unpaid', 'incomplete', 'paused'];

  let activeSub: Stripe.Subscription | null = null;
  let pendingSub: Stripe.Subscription | null = null;
  let latestCanceledSub: Stripe.Subscription | null = null;

  for (const sub of subscriptions.data) {
    if (activeStatuses.includes(sub.status)) {
      activeSub = sub;
      break; 
    } else if (pendingStatuses.includes(sub.status)) {
      if (!pendingSub) pendingSub = sub;
    } else if (sub.status === 'canceled' || sub.status === 'incomplete_expired') {
      if (!latestCanceledSub || sub.created > latestCanceledSub.created) {
        latestCanceledSub = sub;
      }
    }
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
    }
  }

  return {
    ...baseResponse,
    allowed: true,
    decision: "allow_new_subscription",
    reason: latestCanceledSub ? "previous_subscription_canceled" : "no_subscription",
    hasResidualAccess,
    accessUntil
  };
}
