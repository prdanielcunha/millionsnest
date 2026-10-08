import assert from 'node:assert/strict';
import {hasPriorMusicScaleSubscription} from
 '../src/server/services/MusicScaleNoCardTrialService.js';
assert.equal(hasPriorMusicScaleSubscription({}),false);
assert.equal(hasPriorMusicScaleSubscription(undefined),false);
assert.equal(hasPriorMusicScaleSubscription({
  schemaVersion:2,organizationId:'shared-org',stripeCustomerId:'cus_nestlocal',
  apps:{nestlocal:{app:'nestlocal',status:'active',stripeSubscriptionId:'sub_localPaid'}},
}),false,'NestLocal paid sub does not consume MusicScale trial');
assert.equal(hasPriorMusicScaleSubscription({
  apps:{nestlocal:{status:'active'},musicscale:{status:'canceled',trialUsed:true}},
}),true,'expired MusicScale contracts still block repeat trials');
assert.equal(hasPriorMusicScaleSubscription({
  stripeSubscriptionId:'sub_oldMusic',status:'canceled',app:'musicscale',
}),true,'legacy root MusicScale must block duplicate trials');
assert.equal(hasPriorMusicScaleSubscription({status:'past_due'}),true,
  'ambiguous legacy root commercial status fails closed');
assert.equal(hasPriorMusicScaleSubscription({apps:{nestlocal:{status:'active'}},plan:'pro'}),true,
  'ambiguous root plan requires manual history review');
console.log('PASS: subscriptions scoped by app while legacy paid MusicScale remains protected');
