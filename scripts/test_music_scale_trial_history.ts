import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.join(process.cwd(), 'server.ts'), 'utf8');

const required = [
  "Commercial rule: one 7-day evaluation per organization lifetime.",
  "Boolean(appSubscription.stripeSubscriptionId)",
  "materializedStatuses.has(priorStatus)",
  "eligibility.reason === 'previous_subscription_expired'",
  "hasTrialHistory = true; // A prior MusicScale subscription exists, so no second trial.",
  "No new Stripe trial: evaluation is issued separately by the Hub.",
];

for (const token of required) {
  if (!source.includes(token)) {
    throw new Error(`Missing one-trial-per-organization contract token: ${token}`);
  }
}

const forbidden = [
  "sessionArgs.subscription_data.trial_period_days = 7",
  "eligibility.reason === 'previous_subscription_canceled'",
  "eligibility.reason === 'previous_subscription_terminal'",
];

for (const token of forbidden) {
  if (source.includes(token)) {
    throw new Error(`Stale trial-history reason remains in checkout: ${token}`);
  }
}

console.log('PASS: MusicScale checkout never starts a new Stripe trial and preserves prior subscription protections.');
