/** Founders campaign, separate from MusicScale and ordinary NestLocal Stripe entitlements.
 * No campaign start is fabricated: operator must create an approved start record
 * after pilot certification AND set a server-side flag.
 */
import {Timestamp,type Firestore} from 'firebase-admin/firestore';
import {allowFoundersDiscount,NESTLOCAL_FOUNDERS_COUPONS} from '../../lib/nestLocalFoundersCoupon.js';
type Claim={status:'reserved'|'accepted';uid:string;tier:string;expiresAtMs:number;sessionId?:string};
const CAMPAIGN_PATH='nestlocal_founders_campaign/2026';
const LEASE_MS=24*60*60*1000;
function goodId(v:string){return /^[a-zA-Z0-9_-]{1,128}$/.test(v||'');}
function moment(x:any):number|null{return Number.isSafeInteger(x)?x:typeof x?.toMillis==='function'?x.toMillis():null;}
export function founderClaimCount(claims:Record<string,Claim>,nowMs:number){
 return Object.values(claims||{}).filter(x=>x?.status==='accepted'||(x?.status==='reserved'&&x.expiresAtMs>nowMs)).length;
}
export async function reserveNestLocalFoundersOffer(input:{db:Firestore;organizationId:string;uid:string;tier:'essential'|'growth'|'pro';nowMs?:number;env?:NodeJS.ProcessEnv}){
 const env=input.env||process.env,now=input.nowMs??Date.now();
 if(env.NESTLOCAL_FOUNDERS_ENABLED!=='true')return {ok:false,reason:'campaign_disabled'} as const;
 if(!goodId(input.organizationId)||!goodId(input.uid)||!NESTLOCAL_FOUNDERS_COUPONS[input.tier]||
    !Number.isSafeInteger(now))throw Error('FOUNDERS_INPUT_INVALID');
 const ref=input.db.doc(CAMPAIGN_PATH);
 return input.db.runTransaction(async tx=>{
  const snapshot=await tx.get(ref),state=snapshot.data()||{};
  const launchMs=moment(state.startedAt);
  if(state.enabled!==true)return {ok:false,reason:'campaign_not_started'} as const;
  const existing=(state.claims||{})[input.organizationId] as Claim|undefined;
  const claims:Record<string,Claim>={};
  for(const [org,claim] of Object.entries(state.claims||{}) as [string,Claim][]){
   if(goodId(org)&&claim&&(claim.status==='accepted'||(claim.status==='reserved'&&claim.expiresAtMs>now)))
    claims[org]=claim;
  }
  if(existing?.status==='accepted')return {ok:false,reason:'already_founder'} as const;
  if(existing?.status==='reserved'&&existing.expiresAtMs>now){
   if(existing.uid!==input.uid||existing.tier!==input.tier)return {ok:false,reason:'reservation_conflict'} as const;
   return {ok:true,reason:'already_reserved',couponId:NESTLOCAL_FOUNDERS_COUPONS[input.tier],expiresAtMs:existing.expiresAtMs} as const;
  }
  const decision=allowFoundersDiscount({enabled:true,launchMs,nowMs:now,
   enrolled:founderClaimCount(claims,now),ownerAuthorized:true,priorSubscription:false});
  if(!decision.allowed)return {ok:false,reason:decision.reason} as const;
  const expiration=now+LEASE_MS;
  claims[input.organizationId]={status:'reserved',uid:input.uid,tier:input.tier,expiresAtMs:expiration};
  tx.update(ref,{claims,updatedAt:Timestamp.fromMillis(now)});
  return {ok:true,reason:'reserved',couponId:NESTLOCAL_FOUNDERS_COUPONS[input.tier],expiresAtMs:expiration} as const;
 });
}
export async function markNestLocalFoundersAccepted(input:{db:Firestore;organizationId:string;uid:string;tier:string;sessionId:string;couponId:string;nowMs?:number}){
 if(!goodId(input.organizationId)||!goodId(input.uid)||!/^cs_[a-zA-Z0-9_]+$/.test(input.sessionId)||NESTLOCAL_FOUNDERS_COUPONS[input.tier]!==input.couponId)
  throw Error('FOUNDERS_FINALIZE_INVALID');
 const ref=input.db.doc(CAMPAIGN_PATH),now=input.nowMs??Date.now();
 return input.db.runTransaction(async tx=>{
  const snap=await tx.get(ref),state=snap.data()||{},claims:Record<string,Claim>=state.claims||{};
  const c=claims[input.organizationId];
  if(!c||c.uid!==input.uid||c.tier!==input.tier)throw Error('FOUNDERS_RESERVATION_NOT_FOUND');
  if(c.status==='accepted'){
   if(c.sessionId!==input.sessionId)throw Error('FOUNDERS_SESSION_CONFLICT');
   return {state:'already_accepted'};
  }
  if(c.status!=='reserved'||c.expiresAtMs<=now)throw Error('FOUNDERS_RESERVATION_EXPIRED');
  const updated={...claims,[input.organizationId]:{...c,status:'accepted',sessionId:input.sessionId}};
  tx.update(ref,{claims:updated,updatedAt:Timestamp.fromMillis(now)});
  return {state:'accepted'};
 });
}
export async function releaseFailedNestLocalFoundersReservation(input:{db:Firestore;organizationId:string;uid:string;tier:string;nowMs?:number}){
 const ref=input.db.doc(CAMPAIGN_PATH),now=input.nowMs??Date.now();
 await input.db.runTransaction(async tx=>{
  const snapshot=await tx.get(ref),data=snapshot.data()||{},claims=data.claims||{};
  const existing=claims[input.organizationId];
  if(existing?.status!=='reserved'||existing?.uid!==input.uid||existing?.tier!==input.tier)return;
  const updated={...claims};delete updated[input.organizationId];
  tx.update(ref,{claims:updated,updatedAt:Timestamp.fromMillis(now)});
 });
}
