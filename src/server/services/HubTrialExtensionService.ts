/** Hub-authorized trial extension policy for NestLocal and MusicScale. */
export type TrialApp = 'musicscale' | 'nestlocal';
export const TRIAL_BASE_DAYS: Record<TrialApp,number> = { musicscale:14, nestlocal:7 };
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
