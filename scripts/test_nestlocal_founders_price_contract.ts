import assert from 'node:assert/strict';
import {eligibleNestLocalStripePrices,validNestLocalStripePrice} from '../src/lib/nestLocalStripePrices.js';
import {validateFoundersCoupon,allowFoundersDiscount,NESTLOCAL_FOUNDERS_COUPONS} from '../src/lib/nestLocalFoundersCoupon.js';
import {NESTLOCAL_COMMERCIAL_V2_PROPOSED,evaluateNestLocalFoundersAvailability} from '../src/lib/nestLocalCommercialV2.js';
import {PRODUCT_CATALOG} from '../src/lib/pricingCatalog.js';
const now=Date.parse('2026-10-09T12:00:00Z');
const prices=[
 {id:'price_test_essential',tier:'essential',productId:'prod_test_essential'},
 {id:'price_test_growth',tier:'growth',productId:'prod_test_growth'},
 {id:'price_test_pro',tier:'pro',productId:'prod_test_pro'},
].map(({id,tier,productId})=>({
 id,active:true,livemode:true,type:'recurring',currency:'brl',
 unit_amount:NESTLOCAL_COMMERCIAL_V2_PROPOSED[tier as 'essential'|'growth'|'pro'].regularCents,
 lookup_key:`nestlocal_${tier}_monthly`,
 recurring:{interval:'month',interval_count:1,usage_type:'licensed'},
 product:{id:productId,active:true,metadata:{app:'nestlocal',type:'plan',tier}},
 metadata:{app:'nestlocal',type:'plan',tier}
}));
const valid=eligibleNestLocalStripePrices(prices);
assert.equal(Object.keys(valid).length,3);
for(const tier of ['essential','growth','pro'] as const){
 const plan=NESTLOCAL_COMMERCIAL_V2_PROPOSED[tier];
 assert.ok(PRODUCT_CATALOG.some(x=>x.app==='nestlocal'&&x.tier===tier&&x.priceInCents===plan.regularCents));
 const original=prices.find(x=>x.metadata.tier===tier)!;
 assert.equal(validNestLocalStripePrice({...original,unit_amount:plan.foundersCents},tier),false);
 assert.equal(validNestLocalStripePrice({...original,product:{...original.product,metadata:{app:'musicscale',type:'plan',tier}}},tier),false);
 assert.equal(validNestLocalStripePrice({...original,currency:'usd'},tier),false);
 assert.equal(validNestLocalStripePrice(original,tier),true);
 const coupon={id:NESTLOCAL_FOUNDERS_COUPONS[tier],amount_off:plan.regularCents-plan.foundersCents,
  currency:'brl',duration:'repeating',duration_in_months:12,valid:true,livemode:true,
  max_redemptions:50,metadata:{app:'nestlocal',campaign:'founders_2026',tier,product_id:original.product.id},
  applies_to:{products:[original.product.id]}};
 assert.equal(validateFoundersCoupon(coupon,tier,original.product.id,true),true);
 assert.equal(validateFoundersCoupon({...coupon,applies_to:undefined},tier,original.product.id,true),true,'Stripe coupon GET may omit applies_to despite product restriction');
 assert.equal(validateFoundersCoupon({...coupon,metadata:{...coupon.metadata,product_id:'prod_wrong'}},tier,original.product.id,true),false);
 assert.equal(validateFoundersCoupon({...coupon,amount_off:10},tier,original.product.id,true),false);
 assert.equal(validateFoundersCoupon({...coupon,duration_in_months:13},tier,original.product.id,true),false);
 assert.equal(validateFoundersCoupon({...coupon,applies_to:{products:['prod_musicscale']}},tier,original.product.id,true),false);
}
assert.equal(Object.keys(eligibleNestLocalStripePrices([...prices,prices[0]])).length,2,'Duplicate prices fail closed');
assert.equal(allowFoundersDiscount({enabled:true,launchMs:now-1000,nowMs:now,enrolled:49,ownerAuthorized:true,priorSubscription:false}).allowed,true);
assert.equal(allowFoundersDiscount({enabled:true,launchMs:now-1000,nowMs:now,enrolled:50,ownerAuthorized:true,priorSubscription:false}).allowed,false);
assert.equal(allowFoundersDiscount({enabled:true,launchMs:now-1000,nowMs:now,enrolled:0,ownerAuthorized:true,priorSubscription:true}).allowed,false);
assert.equal(allowFoundersDiscount({enabled:true,launchMs:now-31*86400_000,nowMs:now,enrolled:0,ownerAuthorized:true,priorSubscription:false}).allowed,false);
assert.equal(allowFoundersDiscount({enabled:true,launchMs:null,nowMs:now,enrolled:0,ownerAuthorized:true,priorSubscription:false}).allowed,false);
console.log('PASS NestLocal Founders: 49.90 / 109.90 / 169.90, 12-month coupon on regular price, 50 orgs / 30d and strict app isolation');
