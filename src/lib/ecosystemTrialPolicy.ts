/** Commercial default for every subscription app, including future Hub products.
 * This policy never enables an app or changes an existing billing contract.
 * Trials are issued by the Hub; entering Stripe means an explicit paid purchase.
 */
export const ECOSYSTEM_TRIAL_DAYS = 7;
export const ECOSYSTEM_TRIAL_MS = ECOSYSTEM_TRIAL_DAYS * 86_400_000;
export const ECOSYSTEM_TRIAL_POLICY_VERSION = 3;

/** Read compatibility only: never use a legacy duration to issue a new trial. */
export function isSupportedHubTrialDuration(appId: string, durationMs: number, grantVersion: number): boolean {
  return durationMs === ECOSYSTEM_TRIAL_MS ||
    (appId === 'musicscale' && grantVersion === 2 && durationMs === 14 * 86_400_000);
}
