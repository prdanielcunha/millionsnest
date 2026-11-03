/** New MusicScale customers only. No Stripe subscriptions or customer records are created. */
import {Timestamp,type Firestore} from 'firebase-admin/firestore';
import {DAY_MS,TRIAL_BASE_DAYS,trialWindow} from './HubTrialExtensionService.js';
import {HubTrialError} from './HubNoCardTrialService.js';
import {ECOSYSTEM_TRIAL_POLICY_VERSION} from '../../lib/ecosystemTrialPolicy.js';
import {MUSIC_SCALE_PLANS} from '../../lib/musicScalePlans.js';
export const MUSICSCALE_TRIAL_MS=TRIAL_BASE_DAYS.musicscale*DAY_MS;
/** A reservation permits launching, never musical data or AI. */
export function isPendingMusicScaleHubTrial(d:any,organizationId:string):boolean {
  return !!d&&d.appId==='musicscale'&&d.organizationId===organizationId&&
    d.source==='hub_internal_trial'&&d.status==='pending_first_access'&&
    d.startsOnFirstAccess===true&&d.consumed===true&&d.revoked===false&&
    d.grantVersion===ECOSYSTEM_TRIAL_POLICY_VERSION&&
    typeof d.ownerUid==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(d.ownerUid)&&
    d.beginsAt==null&&d.expiresAt==null&&d.extensionCount==null;
}
/** Existing NestLocal subscription must not use up a MusicScale evaluation.
 * Legacy MusicScale contracts live in the root of the subscription document.
 */
export function hasPriorMusicScaleSubscription(record:any):boolean {
  if(!record || typeof record!=='object')return false;
  if(record.apps?.musicscale && Object.keys(record.apps.musicscale).length>0)return true;
  return Boolean(record.stripeSubscriptionId || record.subscriptionId ||
    record.priceId || record.trialUsed || record.subscriptionStatus ||
    record.app==='musicscale' || record.status || record.plan);
}

/** Only verified MusicScale Stripe contracts can lift an existing Hub trial.
 * Do not confuse this with hasPriorMusicScaleSubscription: that deliberately
 * detects ambiguous commercial history to STOP new-trial eligibility.
 */
export function hasActiveStripeMusicScaleContract(record:any):boolean {
  if(!record || typeof record!=='object')return false;
  const valid=(data:any)=>data && typeof data==='object' &&
    ['active','trialing'].includes(String(data.status||'').trim().toLowerCase()) &&
    typeof data.stripeSubscriptionId==='string' && data.stripeSubscriptionId.trim().length>0;
  if(valid(record.apps?.musicscale))return true;
  return record.app==='musicscale' && valid(record);
}

export function musicScaleTrialEnabledForOrganization(id:string,env:NodeJS.ProcessEnv=process.env) {
  if(!/^[A-Za-z0-9_-]{1,128}$/.test(id)||env.MUSICSCALE_INTERNAL_TRIAL_ENABLED!=='true')return false;
  if(env.MUSICSCALE_INTERNAL_TRIAL_PUBLIC_ENABLED==='true')return true;
  return String(env.MUSICSCALE_INTERNAL_TRIAL_PILOT_ORGS||'').split(',').map(s=>s.trim()).includes(id);
}
export async function activateMusicScaleHubTrial(params:{
  db:Firestore;organizationId:string;ownerUid:string;stripeHistoricalClear:boolean;nowMs?:number;
  deferUntilFirstAccess?:boolean;
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
      if(trialSnap.data()?.ownerUid===ownerUid&&isPendingMusicScaleHubTrial(trialSnap.data(),organizationId))
        return {status:'already_active' as const,organizationId,expiresAt:null,canWrite:false,pendingFirstAccess:true};
      const w=trialWindow('musicscale',trialSnap.data(),now,organizationId);
      if(trialSnap.data()?.ownerUid===ownerUid&&w.active)
        return {status:'already_active' as const,organizationId,
          expiresAt:new Date(w.endsAt).toISOString(),canWrite:true};
      throw new HubTrialError('TRIAL_ALREADY_CONSUMED');
    }
    if(ownerSnap.exists)throw new HubTrialError('OWNER_TRIAL_ALREADY_CONSUMED');
    // Root subscriptions/{orgId} still carries legacy MusicScale customers.
    if(subSnap.exists&&hasPriorMusicScaleSubscription(subSnap.data()))
      throw new HubTrialError('PRIOR_MUSICSCALE_SUBSCRIPTION');
    const projection=org.apps?.musicscale,ent=entSnap.exists?entSnap.data():{};
    if(projection&&(projection.stripeSubscriptionId||projection.trialUsed||
       ['active','trialing','expired','canceled','cancelled','past_due','unpaid'].includes(String(projection.status||''))))
      throw new HubTrialError('PRIOR_MUSICSCALE_ACCESS');
    if(ent&&(ent.trialUsed||ent.stripeSubscriptionId||ent.source))
      throw new HubTrialError('PRIOR_MUSICSCALE_ENTITLEMENT');
    const deferred=params.deferUntilFirstAccess===true;
    const beginning=Timestamp.fromMillis(now),end=Timestamp.fromMillis(now+MUSICSCALE_TRIAL_MS);
    tx.create(trialRef,{appId:'musicscale',organizationId,ownerUid,
      source:'hub_internal_trial',status:deferred?'pending_first_access':'active',revoked:false,consumed:true,
      ...(deferred?{startsOnFirstAccess:true}:{}),
      grantVersion:ECOSYSTEM_TRIAL_POLICY_VERSION,beginsAt:deferred?null:beginning,expiresAt:deferred?null:end,createdAt:beginning});
    tx.create(ownerRef,{appId:'musicscale',organizationId,trialRef:trialRef.path,createdAt:beginning});
    tx.set(entitlementRef,{schemaVersion:3,appId:'musicscale',source:'hub_internal_trial',
      accessState:deferred?'pending_first_access':'internal_trial_active',trialStartedAt:deferred?null:beginning,
      trialEndsAt:deferred?null:end,trialUsed:true,canRead:!deferred,canWrite:!deferred,updatedAt:beginning});
    tx.update(orgRef,{'apps.musicscale.status':deferred?'pending_first_access':'trialing',
      'apps.musicscale.plan':'pro',
      'apps.musicscale.features':{...MUSIC_SCALE_PLANS.pro.features,aiSetlistAnalysis:true},
      'apps.musicscale.trialSource':'hub_internal_trial',
      'apps.musicscale.trialEndsAt':deferred?null:end,'apps.musicscale.trialUsed':true});
    return {status:'created' as const,organizationId,expiresAt:deferred?null:new Date(now+MUSICSCALE_TRIAL_MS).toISOString(),canWrite:!deferred,pendingFirstAccess:deferred};
  });
}

/** Authenticated app bootstrap, with time and eligibility owned by the Hub. */
export async function beginMusicScaleTrialOnFirstAccess(params:{
  db:Firestore;organizationId:string;uid:string;nowMs?:number;
}) {
  const {db,organizationId,uid}=params,now=params.nowMs??Date.now();
  if(!/^[A-Za-z0-9_-]{1,128}$/.test(organizationId)||!/^[A-Za-z0-9_-]{1,128}$/.test(uid))
    throw new HubTrialError('INVALID_TRIAL_ACTIVATION',400);
  if(!Number.isSafeInteger(now)||now<=0)throw new HubTrialError('INVALID_SERVER_TIME',500);
  const orgRef=db.collection('organizations').doc(organizationId);
  const ref=db.collection('musicscale_internal_trials').doc(organizationId);
  return db.runTransaction(async tx=>{
    const [org,trial,user,member,sub]=await Promise.all([
      tx.get(orgRef),tx.get(ref),tx.get(db.collection('users').doc(uid)),
      tx.get(orgRef.collection('members').doc(uid)),tx.get(db.collection('subscriptions').doc(organizationId)),
    ]);
    const inactive=(d:any)=>d?.disabled===true||d?.enabled===false||
      ['inactive','suspended','disabled','archived','removed','revoked','deleted'].includes(String(d?.status||''));
    if(!org.exists||!user.exists||!member.exists||inactive(org.data())||inactive(user.data())||
      inactive(member.data())||member.data()?.appAccess?.musicscale?.enabled===false)
      throw new HubTrialError('FIRST_ACCESS_FORBIDDEN',403);
    if(hasActiveStripeMusicScaleContract(sub.data()))return {started:false,paid:true};
    const data=trial.data();
    if(!isPendingMusicScaleHubTrial(data,organizationId)){
      const w=trialWindow('musicscale',data,now,organizationId);
      if(w.active)return {started:false,expiresAt:new Date(w.endsAt).toISOString()};
      throw new HubTrialError('NO_PENDING_TRIAL',409);
    }
    if(hasPriorMusicScaleSubscription(sub.data()))throw new HubTrialError('PRIOR_MUSICSCALE_SUBSCRIPTION');
    const ownerUid=String(data!.ownerUid);
    const owners=[org.data()?.ownerUid,org.data()?.ownerUserId,org.data()?.ownerId,org.data()?.owner_user_id]
      .filter(v=>typeof v==='string'&&v.length>0);
    const owner=await tx.get(db.collection('musicscale_trial_owners').doc(ownerUid));
    if(!owners.length||owners.some(v=>v!==ownerUid)||!owner.exists||owner.data()?.organizationId!==organizationId)
      throw new HubTrialError('TRIAL_OWNER_MISMATCH',403);
    const beginning=Timestamp.fromMillis(now),end=Timestamp.fromMillis(now+MUSICSCALE_TRIAL_MS);
    tx.update(ref,{status:'active',beginsAt:beginning,expiresAt:end,firstAccessAt:beginning,firstAccessUid:uid});
    tx.set(orgRef.collection('app_entitlements').doc('musicscale'),{
      schemaVersion:3,appId:'musicscale',source:'hub_internal_trial',accessState:'internal_trial_active',
      trialStartedAt:beginning,trialEndsAt:end,trialUsed:true,canRead:true,canWrite:true,updatedAt:beginning,
    },{merge:true});
    tx.update(orgRef,{'apps.musicscale.status':'trialing','apps.musicscale.trialEndsAt':end});
    return {started:true,expiresAt:new Date(now+MUSICSCALE_TRIAL_MS).toISOString()};
  });
}
