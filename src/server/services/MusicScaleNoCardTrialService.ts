/** New MusicScale customers only. No Stripe subscriptions or customer records are created. */
import {Timestamp,type Firestore} from 'firebase-admin/firestore';
import {DAY_MS,TRIAL_BASE_DAYS,trialWindow} from './HubTrialExtensionService.js';
import {HubTrialError} from './HubNoCardTrialService.js';
export const MUSICSCALE_TRIAL_MS=TRIAL_BASE_DAYS.musicscale*DAY_MS;
export function musicScaleTrialEnabledForOrganization(id:string,env:NodeJS.ProcessEnv=process.env) {
  if(!/^[A-Za-z0-9_-]{1,128}$/.test(id)||env.MUSICSCALE_INTERNAL_TRIAL_ENABLED!=='true')return false;
  if(env.MUSICSCALE_INTERNAL_TRIAL_PUBLIC_ENABLED==='true')return true;
  return String(env.MUSICSCALE_INTERNAL_TRIAL_PILOT_ORGS||'').split(',').map(s=>s.trim()).includes(id);
}
export async function activateMusicScaleHubTrial(params:{
  db:Firestore;organizationId:string;ownerUid:string;stripeHistoricalClear:boolean;nowMs?:number;
}) {
  const {db,organizationId,ownerUid}=params,now=params.nowMs??Date.now();
  if(!/^[A-Za-z0-9_-]{1,128}$/.test(organizationId)||!/^[A-Za-z0-9_-]{1,128}$/.test(ownerUid))
    throw new HubTrialError('INVALID_TRIAL_ACTIVATION',400);
  if(!params.stripeHistoricalClear)throw new HubTrialError('STRIPE_HISTORY_UNVERIFIED');
  if(!Number.isSafeInteger(now)||now<=0)throw new HubTrialError('INVALID_SERVER_TIME',500);
  const orgRef=db.collection('organizations').doc(organizationId);
  const trialRef=db.collection('musicscale_internal_trials').doc(organizationId);
  const ownerRef=db.collection('musicscale_trial_owners').doc(ownerUid);
  const subscriptionRef=db.collection('subscriptions').doc(organizationId);
  const entitlementRef=orgRef.collection('app_entitlements').doc('musicscale');
  return db.runTransaction(async tx=>{
    const [orgSnap,trialSnap,ownerSnap,subSnap,entSnap]=await Promise.all([
      tx.get(orgRef),tx.get(trialRef),tx.get(ownerRef),tx.get(subscriptionRef),tx.get(entitlementRef),
    ]);
    if(!orgSnap.exists)throw new HubTrialError('ORGANIZATION_NOT_FOUND',404);
    const org=orgSnap.data()||{};
    if(org.disabled===true||['inactive','disabled','suspended','archived'].includes(String(org.status||'')))
      throw new HubTrialError('ORGANIZATION_INACTIVE');
    if(trialSnap.exists){
      const w=trialWindow('musicscale',trialSnap.data(),now,organizationId);
      if(trialSnap.data()?.ownerUid===ownerUid&&w.active)
        return {status:'already_active' as const,organizationId,
          expiresAt:new Date(w.endsAt).toISOString(),canWrite:true};
      throw new HubTrialError('TRIAL_ALREADY_CONSUMED');
    }
    if(ownerSnap.exists)throw new HubTrialError('OWNER_TRIAL_ALREADY_CONSUMED');
    // Root subscriptions/{orgId} still carries legacy MusicScale customers.
    if(subSnap.exists&&Object.keys(subSnap.data()||{}).length)
      throw new HubTrialError('PRIOR_MUSICSCALE_SUBSCRIPTION');
    const projection=org.apps?.musicscale,ent=entSnap.exists?entSnap.data():{};
    if(projection&&(projection.stripeSubscriptionId||projection.trialUsed||
       ['active','trialing','expired','canceled','cancelled','past_due','unpaid'].includes(String(projection.status||''))))
      throw new HubTrialError('PRIOR_MUSICSCALE_ACCESS');
    if(ent&&(ent.trialUsed||ent.stripeSubscriptionId||ent.source))
      throw new HubTrialError('PRIOR_MUSICSCALE_ENTITLEMENT');
    const beginning=Timestamp.fromMillis(now),end=Timestamp.fromMillis(now+MUSICSCALE_TRIAL_MS);
    tx.create(trialRef,{appId:'musicscale',organizationId,ownerUid,
      source:'hub_internal_trial',status:'active',revoked:false,consumed:true,
      grantVersion:2,beginsAt:beginning,expiresAt:end,createdAt:beginning});
    tx.create(ownerRef,{appId:'musicscale',organizationId,trialRef:trialRef.path,createdAt:beginning});
    tx.set(entitlementRef,{schemaVersion:3,appId:'musicscale',source:'hub_internal_trial',
      accessState:'internal_trial_active',trialStartedAt:beginning,
      trialEndsAt:end,trialUsed:true,canRead:true,canWrite:true,updatedAt:beginning});
    tx.update(orgRef,{'apps.musicscale.status':'trialing',
      'apps.musicscale.trialSource':'hub_internal_trial',
      'apps.musicscale.trialEndsAt':end,'apps.musicscale.trialUsed':true});
    return {status:'created' as const,organizationId,expiresAt:new Date(now+MUSICSCALE_TRIAL_MS).toISOString(),canWrite:true};
  });
}
