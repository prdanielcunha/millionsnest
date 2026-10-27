/** Bounded read-only MusicScale incident diagnosis; emits no personal identifiers. */
import {createHash} from 'node:crypto';
import {initializeApp,applicationDefault} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {resolveEcosystemAppAccess} from '../src/server/services/EcosystemAccessResolver.js';
import {trialWindow} from '../src/server/services/HubTrialExtensionService.js';
if(process.env.GITHUB_REF!=='refs/heads/production'||process.env.GOOGLE_CLOUD_PROJECT!=='millionsnest')
  throw Error('PRODUCTION_READ_ONLY_SCOPE_REQUIRED');
const fingerprint='7d1b5a3a22a52435d45af6cad24a01eab077faba6f41dd005072f5a7b10f9722';
const hash=(v:string)=>createHash('sha256').update(v.trim().toLowerCase()).digest('hex');
initializeApp({credential:applicationDefault(),projectId:'millionsnest'});
const db=getFirestore();
const users=await db.collection('users').select('email','status','disabled','organizationId','activeOrganizationId','primaryOrganizationId','organizations').limit(1001).get();
if(users.size>1000)throw Error('BOUNDED_SCAN_LIMIT');
const matches=users.docs.filter(d=>hash(String(d.data().email||''))===fingerprint);
if(matches.length!==1)throw Error('ACCOUNT_MATCH_COUNT_'+matches.length);
const user=matches[0],u=user.data();
const orgs=await db.collection('organizations').limit(251).get();
if(orgs.size>250)throw Error('BOUNDED_ORGANIZATION_LIMIT');
const owned=orgs.docs.filter(d=>[d.data().ownerUid,d.data().ownerUserId,d.data().ownerId,d.data().owner_user_id].includes(user.id));
const findings=[];
for(const org of owned){
 const [sub,trial,ent,member]=await Promise.all([
  db.collection('subscriptions').doc(org.id).get(),
  db.collection('musicscale_internal_trials').doc(org.id).get(),
  org.ref.collection('app_entitlements').doc('musicscale').get(),
  org.ref.collection('members').doc(user.id).get()
 ]);
 const decision=await resolveEcosystemAppAccess({uid:user.id,organizationId:org.id,appId:'musicscale',db});
 const s=sub.data()||{},o=org.data(),t=trial.data(),m=member.data()||{};
 const w=trialWindow('musicscale',t,Date.now(),org.id);
 findings.push({
  selected:[u.activeOrganizationId,u.primaryOrganizationId,u.organizationId].includes(org.id),
  organizationStatus:o.status||'missing',
  memberExists:member.exists,memberStatus:m.status||'missing',memberDisabled:m.enabled===false,
  memberAppDisabled:m.appAccess?.musicscale?.enabled===false,
  subscriptionExists:sub.exists,subscriptionStatus:s.apps?.musicscale?.status||s.status||'missing',
  stripeContractRecorded:!!(s.apps?.musicscale?.stripeSubscriptionId||s.stripeSubscriptionId),
  appStatus:o.apps?.musicscale?.status||'missing',trialSource:o.apps?.musicscale?.trialSource||'missing',
  trialExists:trial.exists,trialValid:w.valid,trialActive:w.active,trialExpired:w.expired,
  entitlementExists:ent.exists,ownerTrialRecorded:(await db.collection('musicscale_trial_owners').doc(user.id).get()).exists,
  accessAllowed:decision.accessible,denialReason:decision.denialReason||null,
 });
}
console.log('MUSICSCALE_ACCESS_INCIDENT='+JSON.stringify({readOnly:true,containsIdentifiers:false,accountMatches:1,ownedOrganizationCount:owned.length,findings}));
