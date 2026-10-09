import crypto from 'node:crypto';
import type {Firestore} from 'firebase-admin/firestore';

const SKEW_MS=90_000;
const LEASE_MS=20_000;
const BACKOFF_MS=90_000;
const inflight=new Map<string,Promise<MeliTokenOutcome>>();
type TokenState={accessToken?:string;accessTokenExpiresAt?:string;refreshToken?:string;clientId?:string;clientSecret?:string;refreshLeaseId?:string;refreshLeaseUntil?:number;refreshFailedUntil?:number;};
export type MeliTokenOutcome={token:string|null;reason:'FRESH'|'ROTATED'|'MISSING_CREDENTIALS'|'BUSY'|'PROVIDER_REFUSED'|'RATE_LIMITED'|'UNAVAILABLE'};

export function isMeliTokenUsable(state:TokenState,now:number=Date.now()){
 return Boolean(state.accessToken && Date.parse(state.accessTokenExpiresAt || '') > now+SKEW_MS);
}
export function shouldRefreshMeliToken(state:TokenState,now:number=Date.now()){
 return !isMeliTokenUsable(state,now) && Boolean(state.refreshToken && state.clientId && state.clientSecret) &&
   !(Number(state.refreshFailedUntil || 0)>now);
}
export function meliRefreshFailureDelay(status:number){
 return status===429?180_000:status===401||status===403||status===400?300_000:BACKOFF_MS;
}
/** Server only; never return credentials or detailed provider payload to browser. */
export async function ensureNestAffiliateMeliToken(input:{
 db:Firestore;organizationId:string;force?:boolean;now?:()=>number;
 requestToken?:(credentials:{clientId:string;clientSecret:string;refreshToken:string})=>Promise<{access_token:string;refresh_token:string;expires_in:number}>;
}):Promise<MeliTokenOutcome>{
 const key=input.organizationId;
 const existing=inflight.get(key);if(existing)return existing;
 const promise=refreshLocked(input);
 inflight.set(key,promise);
 try{return await promise;}finally{if(inflight.get(key)===promise)inflight.delete(key);}
}
async function refreshLocked(input:{
 db:Firestore;organizationId:string;force?:boolean;now?:()=>number;
 requestToken?:(credentials:{clientId:string;clientSecret:string;refreshToken:string})=>Promise<{access_token:string;refresh_token:string;expires_in:number}>;
}):Promise<MeliTokenOutcome>{
 const now=input.now??Date.now;
 const ref=input.db.collection('organizations').doc(input.organizationId)
   .collection('products').doc('nestaffiliate').collection('providerSecretState').doc('mercadolivre');
 let state=(await ref.get()).data() as TokenState|undefined;
 if(!state)return {token:null,reason:'MISSING_CREDENTIALS'};
 if(!input.force&&isMeliTokenUsable(state,now()))return {token:state.accessToken!,reason:'FRESH'};
 if(!state.refreshToken||!state.clientId||!state.clientSecret)
   return {token:isMeliTokenUsable(state,now())?state.accessToken!:null,reason:'MISSING_CREDENTIALS'};
 if(Number(state.refreshFailedUntil||0)>now())return {token:null,reason:'RATE_LIMITED'};
 const leaseId=crypto.randomUUID();
 const won=await input.db.runTransaction(async tx=>{
   const snap=await tx.get(ref);
   const latest=snap.data() as TokenState|undefined;
   if(!latest)return false;
   if(!input.force&&isMeliTokenUsable(latest,now()))return false;
   if(Number(latest.refreshLeaseUntil||0)>now())return false;
   if(Number(latest.refreshFailedUntil||0)>now())return false;
   if(!latest.refreshToken||!latest.clientId||!latest.clientSecret)return false;
   tx.set(ref,{refreshLeaseId:leaseId,refreshLeaseUntil:now()+LEASE_MS},{merge:true});
   state=latest;
   return true;
 });
 if(!won){
   // Another instance or GitHub workflow may have rotated credentials. Read latest.
   for(let attempt=0;attempt<3;attempt++){
     const snap=await ref.get();const latest=snap.data() as TokenState|undefined;
     if(latest && isMeliTokenUsable(latest,now()))return {token:latest.accessToken!,reason:'FRESH'};
     if(attempt<2)await new Promise(resolve=>setTimeout(resolve,350));
   }
   return {token:null,reason:'BUSY'};
 }
 try{
   const creds={clientId:state!.clientId!,clientSecret:state!.clientSecret!,refreshToken:state!.refreshToken!};
   const fetchToken=input.requestToken??(async (c:typeof creds)=>{
     const body=new URLSearchParams({grant_type:'refresh_token',client_id:c.clientId,client_secret:c.clientSecret,refresh_token:c.refreshToken});
     const response=await fetch('https://api.mercadolibre.com/oauth/token',{
       method:'POST',headers:{'content-type':'application/x-www-form-urlencoded',accept:'application/json'},body,
       signal:AbortSignal.timeout(11000),
     });
     if(!response.ok){const e=new Error('MELI_OAUTH_REFRESH_FAILED');(e as Error&{status?:number}).status=response.status;throw e;}
     return response.json() as Promise<{access_token:string;refresh_token:string;expires_in:number}>;
   });
   const fresh=await fetchToken(creds);
   if(!fresh.access_token || !fresh.refresh_token || !Number.isFinite(Number(fresh.expires_in)))throw new Error('MELI_OAUTH_INVALID_RESPONSE');
   let updated=false;
   await input.db.runTransaction(async tx=>{
     const snap=await tx.get(ref);const latest=snap.data() as TokenState|undefined;
     if(!latest||latest.refreshLeaseId!==leaseId||latest.refreshToken!==creds.refreshToken)return;
     tx.set(ref,{
       accessToken:String(fresh.access_token),
       refreshToken:String(fresh.refresh_token),
       accessTokenExpiresAt:new Date(now()+Math.max(60,Number(fresh.expires_in))*1000).toISOString(),
       rotatedAt:new Date(now()).toISOString(),
       refreshLeaseId:null,refreshLeaseUntil:0,refreshFailedUntil:0,
     },{merge:true});
     updated=true;
   });
   if(updated)return {token:String(fresh.access_token),reason:'ROTATED'};
   const latest=(await ref.get()).data() as TokenState|undefined;
   return latest && isMeliTokenUsable(latest,now())?{token:latest.accessToken!,reason:'FRESH'}:{token:null,reason:'BUSY'};
 }catch(error){
   const status=Number((error as {status?:number})?.status || 0);
   await input.db.runTransaction(async tx=>{
     const snap=await tx.get(ref);if(snap.data()?.refreshLeaseId!==leaseId)return;
     tx.set(ref,{refreshLeaseId:null,refreshLeaseUntil:0,refreshFailedUntil:now()+meliRefreshFailureDelay(status)},{merge:true});
   }).catch(()=>undefined);
   // Sanitized only — OAuth responses may contain user identity and secret material.
   console.warn('[NestAffiliate/MELI] server-side OAuth renewal failed',{status:status || 'network'});
   return {token:null,reason:status===429?'RATE_LIMITED':status>=400&&status<500?'PROVIDER_REFUSED':'UNAVAILABLE'};
 }
}
