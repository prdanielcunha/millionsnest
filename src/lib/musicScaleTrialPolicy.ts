/**
 * Product-specific MusicScale trial durations.
 *
 * New Hub-issued no-card grants use 14x24h and can be extended once by a
 * separate auditable +1..7-day policy. The previously sold Stripe contracts
 * retain their historical 7-day metadata and must never be modified here.
 *
 * UI and server code should select the source explicitly, not infer a trial
 * duration from Starter/Advanced/Pro price or a browser-supplied value.
 */
export const MUSIC_SCALE_HUB_NO_CARD_TRIAL_DAYS = 14 as const;
export const MUSIC_SCALE_LEGACY_STRIPE_TRIAL_DAYS = 7 as const;

export function musicScaleTrialDaysForSource(source: 'hub_internal_trial' | 'legacy_stripe'): number {
  return source === 'hub_internal_trial'
    ? MUSIC_SCALE_HUB_NO_CARD_TRIAL_DAYS
    : MUSIC_SCALE_LEGACY_STRIPE_TRIAL_DAYS;
}
