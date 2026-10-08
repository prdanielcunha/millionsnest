/** Hub-only NestLocal AI commercialization rules. No Stripe writes and no Firebase writes.
 * This file evaluates server-fetched records; NEVER build the input from client-supplied fields.
 */
export type NestLocalAiEntitlement = {
  appId: 'nestlocal';
  accessState: 'trial_active' | 'paid_active' | 'expired_read_only';
  canUseAI: boolean;
  billingSource: 'hub_internal_trial' | 'stripe';
  grantVersion: number;
  plan?: 'essential' | 'growth' | 'pro';
  trialEndsAt?: string;
  activeUntil?: string;
};

type RecordLike = Record<string, unknown> | undefined | null;
type DateLike = Date | { toDate(): Date } | string | number | null | undefined;

function asRecord(input: unknown): RecordLike {
  return input !== null && typeof input === 'object' && !Array.isArray(input)
    ? input as Record<string, unknown> : null;
}
function timestampMillis(input: unknown): number | null {
  if (input instanceof Date) return Number.isFinite(input.getTime()) ? input.getTime() : null;
  if (typeof input === 'number') return Number.isFinite(input) && input > 0 ? input : null;
  if (typeof input === 'string') {
    const date = Date.parse(input);
    return Number.isFinite(date) ? date : null;
  }
  const candidate = input as DateLike;
  if (candidate && typeof candidate === 'object' && 'toDate' in candidate && typeof candidate.toDate === 'function') {
    return timestampMillis(candidate.toDate());
  }
  return null;
}

function validPlan(input: unknown): 'essential'|'growth'|'pro'|null {
  const normalized = String(input ?? '').trim().toLowerCase();
  return normalized === 'essential' || normalized === 'growth' || normalized === 'pro'
    ? normalized : null;
}

export function isNestLocalInternalTrialActive(
  trial: RecordLike,
  now = Date.now(),
): boolean {
  const data = asRecord(trial);
  if (!data || data.status !== 'active' || data.appId !== 'nestlocal' ||
      data.source !== 'hub_internal_trial' || data.revoked === true) return false;
  const begins = timestampMillis(data.beginsAt);
  const ends = timestampMillis(data.expiresAt);
  if (begins === null || ends === null || begins >= ends || now < begins || now >= ends ||
      ends - begins > 7 * 86_400_000) return false;
  // Trial issuance must be a one-time, server-authoritative document.
  if (typeof data.grantVersion !== 'number' || !Number.isSafeInteger(data.grantVersion) ||
      data.grantVersion < 2) return false;
  return true;
}

/** Explicitly recognizes paid-active subscriptions, never auto-equates a Stripe trial with paid status. */
export function resolveNestLocalAiEntitlement(input: {
  subscription?: RecordLike;
  organizationApp?: RecordLike;
  internalTrial?: RecordLike;
  now?: number;
}): NestLocalAiEntitlement | null {
  const now = input.now ?? Date.now();
  const org = asRecord(input.organizationApp);
  const status = String(org?.status ?? '').toLowerCase();
  if (org?.enabled === false || !['active','trialing'].includes(status)) return null;

  const sub = asRecord(input.subscription);
  if (String(sub?.status ?? '').toLowerCase() === 'active') {
    const plan = validPlan(sub?.tier ?? sub?.plan ?? org?.tier ?? org?.plan);
    const ends = timestampMillis(sub?.currentPeriodEnd ?? sub?.current_period_end ?? sub?.periodEnd);
    if (plan && ends !== null && ends > now) return {
      appId:'nestlocal',accessState:'paid_active',canUseAI:true,
      billingSource:'stripe',grantVersion:2,plan,activeUntil:new Date(ends).toISOString(),
    };
  }

  if (isNestLocalInternalTrialActive(input.internalTrial, now)) {
    const ends = timestampMillis(asRecord(input.internalTrial)?.expiresAt)!;
    return {appId:'nestlocal',accessState:'trial_active',canUseAI:true,
      billingSource:'hub_internal_trial',grantVersion:2,trialEndsAt:new Date(ends).toISOString()};
  }

  return null;
}
