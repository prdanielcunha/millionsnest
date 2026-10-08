/** NestLocal 2.0 commercial proposal, staged only.
 * No Stripe price/coupon/subscription writes. Existing MusicScale prices untouched.
 * Never advertise these prices until test-mode billing and actual live prices agree.
 */
export const NESTLOCAL_FOUNDERS_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
export const NESTLOCAL_FOUNDERS_ORG_LIMIT = 50;
export const NESTLOCAL_FOUNDERS_PAID_INVOICES = 12;
export const NESTLOCAL_TRIAL_CREDITS_PROPOSED = 40;
export type NestLocalCommercialPlan = 'essential' | 'growth' | 'pro';
export const NESTLOCAL_COMMERCIAL_V2_PROPOSED = Object.freeze({
  essential: Object.freeze({ regularCents: 5990, foundersCents: 4990, seats: 1, creditsPerMonth: 150 }),
  growth: Object.freeze({ regularCents: 12900, foundersCents: 10990, seats: 3, creditsPerMonth: 500 }),
  pro: Object.freeze({ regularCents: 19900, foundersCents: 16990, seats: 10, creditsPerMonth: 1500 }),
});
export type FoundersAvailability = {
  eligible: boolean;
  reason: 'eligible' | 'not_launched' | 'time_expired' | 'capacity_exhausted' | 'invalid_counter';
  remainingSlots: number;
  endsAt: string | null;
};
export function evaluateNestLocalFoundersAvailability(input: {
  launchedAtMs: number | null;
  acceptedOrganizations: number;
  serverNowMs: number;
}): FoundersAvailability {
  const { launchedAtMs, acceptedOrganizations, serverNowMs } = input;
  if (!Number.isSafeInteger(acceptedOrganizations) || acceptedOrganizations < 0 ||
      !Number.isFinite(serverNowMs)) {
    return { eligible:false, reason:'invalid_counter', remainingSlots:0, endsAt:null };
  }
  if (launchedAtMs === null || !Number.isFinite(launchedAtMs) || launchedAtMs > serverNowMs) {
    return { eligible:false, reason:'not_launched', remainingSlots:0, endsAt:null };
  }
  const endsAtMs = launchedAtMs + NESTLOCAL_FOUNDERS_WINDOW_MS;
  const remainingSlots = Math.max(0, NESTLOCAL_FOUNDERS_ORG_LIMIT - acceptedOrganizations);
  const reason = remainingSlots === 0 ? 'capacity_exhausted' :
    serverNowMs >= endsAtMs ? 'time_expired' : 'eligible';
  return {
    eligible: reason === 'eligible', reason, remainingSlots,
    endsAt: new Date(endsAtMs).toISOString(),
  };
}
/** Idempotent counting key must refer to a verified paid invoice, NOT webhook event ID.
 * Counting actual paid cycles belongs to a transactionally reconciled Stripe billing ledger. */
export function foundersPaidCycleNumber(uniquePaidInvoiceIds: readonly string[]): number {
  if (uniquePaidInvoiceIds.some(id => !/^in_[a-zA-Z0-9]+$/.test(id))) throw new Error('INVALID_PAID_INVOICE_ID');
  return Math.min(NESTLOCAL_FOUNDERS_PAID_INVOICES, new Set(uniquePaidInvoiceIds).size);
}
