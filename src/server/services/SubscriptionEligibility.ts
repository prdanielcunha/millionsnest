import Stripe from 'stripe';

export type SubscriptionPurchaseEligibility =
  | {
      decision: "allow_new_subscription";
      reason:
        | "no_subscription"
        | "previous_subscription_canceled"
        | "previous_subscription_terminal";
      hasResidualAccess: boolean;
      accessUntil: string | null;
      stripeCustomerId?: string;
    }
  | {
      decision: "resume_existing";
      reason: "cancel_scheduled";
      subscriptionId: string;
      stripeCustomerId?: string;
    }
  | {
      decision: "block_duplicate";
      reason: "active_subscription_exists";
      subscriptionId: string;
      stripeCustomerId?: string;
    }
  | {
      decision: "regularize_existing";
      reason:
        | "past_due"
        | "unpaid"
        | "incomplete"
        | "paused";
      subscriptionId: string;
      stripeCustomerId?: string;
    };

export async function resolveSubscriptionPurchaseEligibility(
  stripe: Stripe,
  db: any,
  organizationId: string,
  stripeCustomerId?: string
): Promise<SubscriptionPurchaseEligibility> {
  if (!stripeCustomerId) {
    return {
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
    if (activeSub.cancel_at_period_end) {
      return {
        decision: "resume_existing",
        reason: "cancel_scheduled",
        subscriptionId: activeSub.id,
        stripeCustomerId
      };
    } else {
      return {
        decision: "block_duplicate",
        reason: "active_subscription_exists",
        subscriptionId: activeSub.id,
        stripeCustomerId
      };
    }
  }

  if (pendingSub) {
    return {
      decision: "regularize_existing",
      reason: pendingSub.status as any,
      subscriptionId: pendingSub.id,
      stripeCustomerId
    };
  }

  let hasResidualAccess = false;
  let accessUntil: string | null = null;

  try {
    const orgDoc = await db.collection('organizations').doc(organizationId).get();
    if (orgDoc.exists) {
      const orgData = orgDoc.data();
      const accessEnd = orgData?.accessUntil;
      
      if (accessEnd) {
        let endMs = 0;
        if (accessEnd.toDate) {
          endMs = accessEnd.toDate().getTime();
        } else if (accessEnd._seconds) {
          endMs = accessEnd._seconds * 1000;
        } else {
          endMs = new Date(accessEnd).getTime();
        }

        if (endMs > Date.now()) {
          hasResidualAccess = true;
          accessUntil = new Date(endMs).toISOString();
        }
      }
    }
  } catch (err) {
    console.error('Error resolving organization access', err);
  }

  return {
    decision: "allow_new_subscription",
    reason: latestCanceledSub ? "previous_subscription_canceled" : "no_subscription",
    hasResidualAccess,
    accessUntil,
    stripeCustomerId
  };
}
