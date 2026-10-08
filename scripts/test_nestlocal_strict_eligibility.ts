import assert from 'node:assert/strict';
import { resolveSubscriptionPurchaseEligibility } from '../src/server/services/SubscriptionEligibility.js';

const dbOk={
  collection:(collection:string)=>({
    doc:(id:string)=>({
      get:async()=>({
        exists:collection==='organizations',
        data:()=>collection==='organizations'?{apps:{nestlocal:{}}}:{},
      }),
    }),
  }),
};
const stripeOk={subscriptions:{list:async()=>({data:[],has_more:false})}};
const base=['org_new','cus_new','nestlocal'] as const;
const valid=await resolveSubscriptionPurchaseEligibility(stripeOk as any,dbOk as any,...base,true);
assert.equal(valid.allowed,true);
assert.equal(valid.reason,'no_subscription');
const failDb={
  collection:()=>({doc:()=>({get:async()=>{throw new Error('Firestore unavailable');}})}),
};
await assert.rejects(
  resolveSubscriptionPurchaseEligibility(stripeOk as any,failDb as any,...base,true),
  /BILLING_HISTORY_DB_UNAVAILABLE/,
);
await assert.rejects(
  resolveSubscriptionPurchaseEligibility(stripeOk as any,null as any,...base,true),
  /BILLING_HISTORY_DB_UNAVAILABLE/,
);
const truncated={subscriptions:{list:async()=>({data:[],has_more:true})}};
await assert.rejects(
  resolveSubscriptionPurchaseEligibility(truncated as any,dbOk as any,...base,true),
  /BILLING_HISTORY_INCOMPLETE/,
);
const compatibility=await resolveSubscriptionPurchaseEligibility(stripeOk as any,failDb as any,...base);
assert.equal(compatibility.allowed,true);
console.log('PASS: Strict pilot blocks incomplete Stripe or Firestore history while legacy path unchanged');
