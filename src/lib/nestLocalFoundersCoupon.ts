/** Canonical NestLocal Founders (2026) — single source of effective invoice math.
 * A separate 12-month Stripe coupon reduces each REGULAR recurring price.
 * Coupon is not public; checkout must check eligibility independently.
 */
import {NESTLOCAL_COMMERCIAL_V2_PROPOSED,evaluateNestLocalFoundersAvailability}
 from './nestLocalCommercialV2.js';
export const NESTLOCAL_FOUNDERS_COUPONS:Record<string,string>=Object.freeze({
 essential:'nestlocal_founders_essential_12m_2026',
 growth:'nestlocal_founders_growth_12m_2026',
 pro:'nestlocal_founders_pro_12m_2026',
});
export type FoundersCoupon={id:string;amount_off:number;currency:string;duration:string;duration_in_months:number;valid:boolean;livemode:boolean;
 applies_to?:{products?:string[]};metadata?:Record<string,string>;max_redemptions?:number};
export function validateFoundersCoupon(coupon:FoundersCoupon,tier:string,productId:string,expectedLive:boolean){
 const plan=NESTLOCAL_COMMERCIAL_V2_PROPOSED[tier as keyof typeof NESTLOCAL_COMMERCIAL_V2_PROPOSED];
 return !!plan && !!coupon && !!productId &&
 coupon.id===NESTLOCAL_FOUNDERS_COUPONS[tier]&&coupon.valid===true&&
 coupon.livemode===expectedLive&&coupon.currency==='brl'&&coupon.duration==='repeating'&&
 coupon.duration_in_months===12&&coupon.amount_off===plan.regularCents-plan.foundersCents&&
 coupon.max_redemptions===50&&coupon.metadata?.app==='nestlocal'&&
 coupon.metadata?.tier===tier&&coupon.metadata?.campaign==='founders_2026'&&
 coupon.applies_to?.products?.length===1&&coupon.applies_to.products[0]===productId;
}
export function allowFoundersDiscount(input:{enabled:boolean;launchMs:number|null;nowMs:number;enrolled:number;
 ownerAuthorized:boolean;priorSubscription:boolean}){
 if(!input.enabled)return {allowed:false,reason:'disabled'};
 if(!input.ownerAuthorized)return {allowed:false,reason:'requires_owner'};
 if(input.priorSubscription)return {allowed:false,reason:'existing_subscription'};
 const elig=evaluateNestLocalFoundersAvailability({
 launchedAtMs:input.launchMs,acceptedOrganizations:input.enrolled,serverNowMs:input.nowMs});
 return {allowed:elig.eligible,reason:elig.reason,remaining:elig.remainingSlots,endsAt:elig.endsAt};
}
