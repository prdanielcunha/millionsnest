export interface SubscriptionDetails {
  status?: string;
  currentPeriodEnd?: any; // Firestore Timestamp or { _seconds }, etc.
  cancelAtPeriodEnd?: boolean;
}

export function normalizeDateToMs(dateObj: any): number {
  if (!dateObj) return 0;
  if (typeof dateObj === 'number') {
    // If it's a small number, likely seconds, otherwise ms
    return dateObj < 10000000000 ? dateObj * 1000 : dateObj;
  }
  if (dateObj.seconds) return dateObj.seconds * 1000;
  if (dateObj._seconds) return dateObj._seconds * 1000;
  return new Date(dateObj).getTime();
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
    const endMs = normalizeDateToMs(subscription.currentPeriodEnd);
    // Valid if current time is before the end period
    if (Date.now() < endMs) {
      return true;
    }
  }

  return false;
}

export type PurchaseAction = 'checkout' | 'manage_existing' | 'upgrade_or_manage' | 'blocked' | 'resolve_payment';

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
  if (!existingSubscription || !existingSubscription.status) {
    return {
      allowed: true,
      reason: 'no_subscription',
      userMessage: 'Pronto para assinar. Nenhuma assinatura existente.',
      action: 'checkout'
    };
  }

  const status = existingSubscription.status.toLowerCase().trim();

  // Explicitly allow missing or inactive statuses
  if (['none', 'inactive', 'incomplete_expired', 'expired', ''].includes(status)) {
    return {
      allowed: true,
      reason: 'inactive_subscription',
      userMessage: 'Pronto para assinar.',
      action: 'checkout'
    };
  }

  if (['past_due', 'unpaid', 'incomplete', 'paused'].includes(status)) {
    return {
      allowed: false,
      reason: 'payment_issue',
      userMessage: 'Regularize o pagamento da sua assinatura atual.',
      action: 'resolve_payment'
    };
  }

  if (status === 'canceled') {
    if (existingSubscription.currentPeriodEnd) {
      const endMs = normalizeDateToMs(existingSubscription.currentPeriodEnd);
      if (Date.now() < endMs) {
        const dateStr = new Date(endMs).toLocaleDateString();
        return {
          allowed: false,
          reason: 'canceled_with_residual_access',
          userMessage: `Sua assinatura continua ativa até ${dateStr}. Não é necessário assinar novamente.`,
          action: 'manage_existing'
        };
      }
    }
    // Expired canceled
    return {
      allowed: true,
      reason: 'subscription_canceled_expired',
      userMessage: 'Sua assinatura expirou. Você pode assinar novamente.',
      action: 'checkout'
    };
  }

  if (['active', 'trialing', 'trial', 'pro'].includes(status)) {
    if (existingSubscription.cancelAtPeriodEnd || existingSubscription.cancel_at_period_end) {
      return {
        allowed: false,
        reason: 'cancel_scheduled',
        userMessage: 'Você já possui uma assinatura com cancelamento agendado. Acesse a área de gerenciamento.',
        action: 'manage_existing'
      };
    }

    const normalizedDesired = desiredPlan.replace('musicscale_', '').replace('_monthly', '').replace('_yearly', '');
    const existingPlan = existingSubscription.plan || existingSubscription.tier || 'starter';

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

  // Unknown status
  return {
    allowed: false,
    reason: 'unknown_subscription_status',
    userMessage: 'Status da assinatura desconhecido. Por favor, atualize o status ou contate o suporte.',
    action: 'blocked'
  };
}
