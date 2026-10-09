/** Hub-authorized trial extension policy for NestLocal and MusicScale. */
export type TrialApp = 'musicscale' | 'nestlocal';
import {MUSIC_SCALE_HUB_NO_CARD_TRIAL_DAYS} from '../../lib/musicScaleTrialPolicy.js';
export const TRIAL_BASE_DAYS: Record<TrialApp,number> = {
  musicscale:MUSIC_SCALE_HUB_NO_CARD_TRIAL_DAYS,
  nestlocal:7,
};
export const MAX_TRIAL_EXTENSION_DAYS = 7;

import { Timestamp, type Firestore } from 'firebase-admin/firestore';
export const DAY_MS=86_400_000;
export class TrialExtensionError extends Error {
  constructor(public readonly code:string,public readonly httpStatus=409){
    super(code);this.name='TrialExtensionError';
  }
}
function toMs(value:any):number|null {
  if(value?.toMillis)return value.toMillis();
  if(value?.toDate)return value.toDate().getTime();
  if(value instanceof Date)return value.getTime();
  if(typeof value==='string'){const n=Date.parse(value);return Number.isFinite(n)?n:null}
  return null;
}
export function trialCollection(app:TrialApp):string {
  if(!['musicscale','nestlocal'].includes(app))throw new TrialExtensionError('UNSUPPORTED_APP',400);
  return app+'_internal_trials';
}
/** Immutable original deadline, with exactly one verifiable extension. */
export function trialWindow(app:TrialApp,data:any,now=Date.now(),orgId='') {
  const invalid={valid:false,active:false,expired:false,endsAt:0,extended:false};
  if(!data||data.appId!==app||data.source!=='hub_internal_trial'||
      data.status!=='active'||data.revoked===true||data.consumed!==true||
      !Number.isSafeInteger(data.grantVersion)||data.grantVersion<2||
      (orgId&&data.organizationId!==orgId))return invalid;
  const start=toMs(data.beginsAt),base=toMs(data.expiresAt);
  if(start===null||base===null||base-start!==TRIAL_BASE_DAYS[app]*DAY_MS)return invalid;
  let end=base;
  if(data.extensionCount===1){
    const days=data.extensionDays,actual=toMs(data.extensionEndsAt);
    if(!Number.isInteger(days)||days<1||days>7||actual!==base+days*DAY_MS)return invalid;
    end=actual;
  }else if(data.extensionCount!==undefined&&data.extensionCount!==0||
    data.extensionDays!=null||data.extensionEndsAt!=null)return invalid;
  return {valid:true,active:now>=start&&now<end,expired:now>=end,
    endsAt:end,extended:data.extensionCount===1};
}

export async function extendHubTrial(params:{
  db:Firestore;appId:TrialApp;organizationId:string;adminUid:string;
  days:number;reason:string;nowMs?:number;
}) {
  const {db,appId,organizationId,adminUid,days}=params;
  const reason=String(params.reason||'').trim();
  if(!/^[A-Za-z0-9_-]{1,128}$/.test(organizationId)||
     !/^[A-Za-z0-9_-]{1,128}$/.test(adminUid))throw new TrialExtensionError('INVALID_ID',400);
  if(!Number.isInteger(days)||days<1||days>MAX_TRIAL_EXTENSION_DAYS)
    throw new TrialExtensionError('INVALID_DAYS',400);
  if(reason.length<12||reason.length>500)throw new TrialExtensionError('INVALID_REASON',400);
  const now=params.nowMs??Date.now();
  if(!Number.isSafeInteger(now)||now<=0)throw new TrialExtensionError('INVALID_TIME',500);
  const ref=db.collection(trialCollection(appId)).doc(organizationId);
  const eventRef=db.collection('hub_trial_extension_events').doc(appId+'_'+organizationId);
  const orgRef=db.collection('organizations').doc(organizationId);
  const subRef=db.collection('subscriptions').doc(organizationId);
  const entRef=orgRef.collection('app_entitlements').doc(appId);
  return db.runTransaction(async tx=>{
    const [trial,event,org,sub]=await Promise.all([
      tx.get(ref),tx.get(eventRef),tx.get(orgRef),tx.get(subRef),
    ]);
    if(!trial.exists||!org.exists)throw new TrialExtensionError('TRIAL_NOT_FOUND',404);
    if(event.exists)throw new TrialExtensionError('EXTENSION_ALREADY_USED');
    const company=org.data()||{},subscription=sub.exists?sub.data()||{}:{};
    if(company.disabled===true||['inactive','archived','suspended','disabled'].includes(String(company.status||'')))
      throw new TrialExtensionError('ORGANIZATION_INACTIVE');
    const contract=subscription.apps?.[appId];
    if(contract&&Object.keys(contract).length>0||
      (appId==='musicscale'&&(subscription.stripeSubscriptionId||subscription.subscriptionId||
      ['active','trialing','canceled','cancelled','past_due','unpaid'].includes(String(subscription.status||'')))))
      throw new TrialExtensionError('EXISTING_SUBSCRIPTION_REVIEW_REQUIRED');
    const window=trialWindow(appId,trial.data(),now,organizationId);
    if(!window.valid||window.extended)throw new TrialExtensionError('TRIAL_ALREADY_EXTENDED_OR_INVALID');
    if(now>window.endsAt+2*DAY_MS)throw new TrialExtensionError('EXTENSION_WINDOW_CLOSED');
    const endsAt=window.endsAt+days*DAY_MS;
    if(endsAt<=now)throw new TrialExtensionError('EXTENSION_ALREADY_EXPIRED');
    const createdAt=Timestamp.fromMillis(now),newEnd=Timestamp.fromMillis(endsAt);
    tx.update(ref,{extensionCount:1,extensionDays:days,extensionEndsAt:newEnd,
      extensionGrantedAt:createdAt,extensionGrantedBy:adminUid});
    tx.create(eventRef,{kind:'manual_trial_extension',appId,organizationId,adminUid,
      reason,days,priorEndsAt:Timestamp.fromMillis(window.endsAt),
      newEndsAt:newEnd,createdAt});
    tx.set(entRef,{trialEffectiveEndsAt:newEnd,extensionCount:1,updatedAt:createdAt},{merge:true});
    tx.update(orgRef,{['apps.'+appId+'.trialEndsAt']:newEnd,
      ['apps.'+appId+'.trialExtensionDays']:days});
    return {appId,organizationId,extendedDays:days,effectiveEndsAt:new Date(endsAt).toISOString()};
  });
}
