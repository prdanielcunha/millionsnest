import assert from 'node:assert/strict';
import {hasPriorMusicScaleSubscription,hasActiveStripeMusicScaleContract} from
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
// A prior payment/history is NOT the same as a currently valid paid MusicScale
// contract. Only the latter can reactivate an existing Hub trial.
assert.equal(hasActiveStripeMusicScaleContract({
  status:'active',stripeSubscriptionId:'sub_local',
  apps:{nestlocal:{status:'active',stripeSubscriptionId:'sub_local'}},
}),false);
assert.equal(hasActiveStripeMusicScaleContract({
  status:'active',stripeSubscriptionId:'sub_unrelated',
  apps:{musicscale:{status:'expired'},nestlocal:{status:'active'}},
}),false);
assert.equal(hasActiveStripeMusicScaleContract({status:'active',subscriptionId:'sub_legacy_without_stripe'}),false);
assert.equal(hasActiveStripeMusicScaleContract({
  apps:{musicscale:{status:'active',stripeSubscriptionId:'sub_music',plan:'advanced'}},
}),true);
assert.equal(hasActiveStripeMusicScaleContract({
  app:'musicscale',status:'trialing',stripeSubscriptionId:'sub_legacy_music',
}),true);
assert.equal(hasActiveStripeMusicScaleContract({
  app:'musicscale',status:'past_due',stripeSubscriptionId:'sub_late',
}),false);
assert.equal(hasActiveStripeMusicScaleContract({
  apps:{musicscale:{status:'active'}},status:'active',stripeSubscriptionId:'sub_local',
}),false);
console.log('PASS: subscriptions scoped by app while legacy paid MusicScale remains protected');
