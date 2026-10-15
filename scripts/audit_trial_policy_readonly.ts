/** Read-only aggregate preflight/postflight. No PII or account identifiers in output. */
import {initializeApp,getApps,applicationDefault} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
if(process.env.MN_INTEGRITY_AUDIT_READ_ONLY!=='true'||process.env.GOOGLE_CLOUD_PROJECT!=='millionsnest')
  throw Error('READ_ONLY_PRODUCTION_SCOPE_REQUIRED');
if(!getApps().length)initializeApp({credential:applicationDefault(),projectId:'millionsnest'});
const db=getFirestore(),LIMIT=1000;
const [subs,music,local]=await Promise.all(['subscriptions','musicscale_internal_trials','nestlocal_internal_trials']
  .map(name=>db.collection(name).limit(LIMIT+1).get()));
if([subs,music,local].some(s=>s.size>LIMIT))throw Error('AUDIT_LIMIT_REACHED');
function trialCounts(snapshot:typeof music){
  const result={total:snapshot.size,sevenDays:0,legacyFourteenDays:0,otherDuration:0};
  for(const doc of snapshot.docs){
    const data=doc.data(),begin=data.beginsAt?.toMillis?.(),end=data.expiresAt?.toMillis?.();
    if(end-begin===7*86_400_000)result.sevenDays++;
    else if(end-begin===14*86_400_000&&data.grantVersion===2)result.legacyFourteenDays++;
    else result.otherDuration++;
  }
  return result;
}
const paid={musicscale:0,nestlocal:0};
for(const doc of subs.docs){
  const data=doc.data();
  const musicContract=data.apps?.musicscale||
    ((!data.app||data.app==='musicscale')&&!data.apps?.nestlocal?data:null);
  if(musicContract?.status==='active'&&musicContract?.stripeSubscriptionId)paid.musicscale++;
  if(data.apps?.nestlocal?.status==='active'&&data.apps.nestlocal.stripeSubscriptionId)paid.nestlocal++;
}
console.log('ECOSYSTEM_TRIAL_READ_ONLY_AUDIT='+JSON.stringify({readOnly:true,containsIdentifiers:false,
  subscriptionDocuments:subs.size,paid,musicscale:trialCounts(music),nestlocal:trialCounts(local)}));
