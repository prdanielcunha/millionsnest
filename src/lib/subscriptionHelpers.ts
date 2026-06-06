export interface SubscriptionDetails {
  status?: string;
  currentPeriodEnd?: any; // Firestore Timestamp or { _seconds }, etc.
  cancelAtPeriodEnd?: boolean;
}

/**
 * Checks if the subscription is still valid either because it is active/trialing,
 * or it was canceled but the period has not ended yet.
 */
export function isSubscriptionValid(subscription?: SubscriptionDetails | null): boolean {
  if (!subscription) return false;
  if (!subscription.status) return false;

  const validStatuses = ['active', 'trialing'];
  if (validStatuses.includes(subscription.status.toLowerCase())) {
    return true;
  }

  // If status is canceled, check if we are still before currentPeriodEnd
  if (subscription.status.toLowerCase() === 'canceled' && subscription.currentPeriodEnd) {
    const endMs = subscription.currentPeriodEnd.seconds
      ? subscription.currentPeriodEnd.seconds * 1000
      : subscription.currentPeriodEnd._seconds
      ? subscription.currentPeriodEnd._seconds * 1000
      : new Date(subscription.currentPeriodEnd).getTime();

    // Valid if current time is before the end period
    if (Date.now() < endMs) {
      return true;
    }
  }

  return false;
}

export type PurchaseAction = 'checkout' | 'manage_existing' | 'upgrade_or_manage' | 'blocked';

export interface PurchaseCheckResult {
  allowed: boolean;
  reason: string;
  userMessage: string;
  action: PurchaseAction;
}

export function canPurchasePlanAgain({
  desiredPlan,
  existingSubscription
}: {
  organization?: any;
  appKey?: string;
  desiredPlan: string;
  existingSubscription?: any;
}): PurchaseCheckResult {
  if (!existingSubscription) {
    return {
      allowed: true,
      reason: 'no_subscription',
      userMessage: 'Pronto para assinar. Nenhuma assinatura existente.',
      action: 'checkout'
    };
  }

  const normalizedDesired = desiredPlan.replace('musicscale_', '').replace('_monthly', '').replace('_yearly', '');
  const existingPlan = existingSubscription.plan || existingSubscription.tier || 'starter';
  const isValid = isSubscriptionValid(existingSubscription);

  if (!isValid) {
    return {
      allowed: true,
      reason: 'subscription_expired_or_invalid',
      userMessage: 'Sua assinatura anterior foi expirada ou cancelada. Você pode assinar novamente.',
      action: 'checkout'
    };
  }

  // If valid, check if it's the exact same plan
  if (normalizedDesired.includes(existingPlan.toLowerCase()) || existingPlan.toLowerCase().includes(normalizedDesired)) {
    return {
      allowed: false,
      reason: 'plan_already_active',
      userMessage: 'Você já possui uma assinatura ativa deste plano. Você pode gerenciar sua assinatura atual ou escolher outro plano disponível.',
      action: 'manage_existing'
    };
  }

  // Valid, but a different plan (upgrade/downgrade)
  return {
    allowed: false, // We block direct duplicate checkout for other plans too, force them to Stripe Portal or Upgrade Flow
    reason: 'different_plan_active',
    userMessage: 'Você já possui um plano ativo. Para alterar sua assinatura (upgrade ou downgrade), acesse a área de Gerenciar Assinatura.',
    action: 'upgrade_or_manage'
  };
}
