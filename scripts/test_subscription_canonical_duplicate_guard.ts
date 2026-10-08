import assert from 'node:assert/strict';
import { resolveSubscriptionPurchaseEligibility } from '../src/server/services/SubscriptionEligibility.js';

type Entry = Record<string, unknown>;
function firestore(subscription: Entry | undefined, appStatus?: string) {
  return {
    collection(collection: string) {
      return {
        doc(_id: string) {
          return {
            async get() {
              if (collection === 'subscriptions') return {
                exists: subscription !== undefined, data: () => subscription,
              };
              if (collection === 'organizations') return {
                exists: true, data: () => ({
                  apps: { nestlocal: {status: appStatus}, musicscale: {status: appStatus} },
                }),
              };
              throw Error('UNEXPECTED_COLLECTION');
            },
          };
        },
      };
    },
  };
}
function fakeStripe(subscriptions: Entry[] = []) {
  return { subscriptions: { async list() {
    return { data: subscriptions, has_more: false };
  } } } as any;
}
async function check(subscription: Entry | undefined, customer?: string,
  providerRows: Entry[] = [], app: 'nestlocal'|'musicscale' = 'nestlocal') {
  return resolveSubscriptionPurchaseEligibility(fakeStripe(providerRows),
    firestore(subscription, 'active') as any, 'orgA', customer, app, true);
}
const active = { apps: { nestlocal: {
  status: 'active', stripeSubscriptionId: 'sub_paidABC',
  stripeCustomerId: 'cus_correctABC',
} } };
const awaitingPayment = { apps: { nestlocal: {
  status: 'past_due', stripeSubscriptionId: 'sub_paidABC',
} } };
const canceled = { apps: { nestlocal: {
  status: 'canceled', stripeSubscriptionId: 'sub_pastABC',
} } };

// Previously, a missing customer returned allow_new_subscription despite
// an active canonical paid subscription; never offer a duplicate Checkout.
const withoutCustomer = await check(active);
assert.equal(withoutCustomer.allowed, false);
assert.equal(withoutCustomer.decision, 'block_duplicate');
assert.equal(withoutCustomer.repairRequired, true);

// Stripe list for the WRONG customer can be empty even while the original
// customer's contract is still active.
const wrongCustomer = await check(active, 'cus_wrongABC');
assert.equal(wrongCustomer.allowed, false);
assert.equal(wrongCustomer.decision, 'block_duplicate');
assert.equal(wrongCustomer.repairRequired, true);

// A pending contract must be regularized, not repurchased.
const pending = await check(awaitingPayment);
assert.equal(pending.allowed, false);
assert.equal(pending.decision, 'regularize_existing');

// Old canceled subscriptions without residual access are allowed to rejoin.
const returning = await check(canceled);
assert.equal(returning.decision, 'allow_new_subscription');

// An active NestLocal subscription must not block an independent MusicScale
// purchase; app-specific rights and history remain isolated.
const otherApp = await check(active, 'cus_correctABC', [], 'musicscale');
assert.equal(otherApp.decision, 'allow_new_subscription');

// Correct Stripe active subscriptions keep their existing protections.
const existing = await check(active, 'cus_correctABC', [{
  id: 'sub_paidABC', customer: 'cus_correctABC',
  metadata: {app: 'nestlocal', organizationId: 'orgA'},
  status: 'active', cancel_at_period_end: false,
}]);
assert.equal(existing.decision, 'block_duplicate');
assert.equal(existing.reason, 'active_subscription_exists');

console.log('PASS: canonical paid/pending subscriptions cannot create duplicate checkout after Stripe customer mismatch; other apps and expired customers preserved');
