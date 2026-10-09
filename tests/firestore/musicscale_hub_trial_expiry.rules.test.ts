import { before, beforeEach, after, test } from 'node:test';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { readFile } from 'node:fs/promises';

let env: RulesTestEnvironment;
const DAY=86_400_000;
const [host,port]=(process.env.FIRESTORE_EMULATOR_HOST||'127.0.0.1:8180').split(':');
const msDb=()=>env.authenticatedContext('owner').firestore();
const targetPaths=['songs/music','scales/scale','bandScales/band','fixedBandScales/fixed','liveSessions/live','roles/role'];
const get=async (path:string)=>getDoc(doc(msDb(),path));

before(async()=>{
 env=await initializeTestEnvironment({
  projectId:'demo-millionsnest-music-trial-expiry',
  firestore:{host,port:Number(port),rules:await readFile('firestore.rules','utf8')}
 });
});
beforeEach(async()=>{await env.clearFirestore()});
after(async()=>{await env.cleanup()});

async function seed(options:{scope?:boolean;daysLeft?:number;extended?:number;paid?:boolean;nestLocal?:boolean;invalidDays?:boolean}={}){
 await env.withSecurityRulesDisabled(async context=>{
  const db=context.firestore();
  await setDoc(doc(db,'organizations/org-1'),{
   ownerUid:'owner',status:'active',
   apps:{musicscale: options.scope?{status:'trialing',trialSource:'hub_internal_trial',
     trialUsed:true,trialEndsAt:Timestamp.fromMillis(Date.now()+(options.daysLeft??12)*DAY)}:{status:'active'}},
  });
  await setDoc(doc(db,'users/owner'),{systemRole:'user'});
  await setDoc(doc(db,'organizations/org-1/members/owner'),{uid:'owner',organizationId:'org-1',status:'active',role:'owner',organizationRole:'owner',permissions:{canManageScales:true,canManageRepertoire:true}});
  for(const p of targetPaths)await setDoc(doc(db,p),{organizationId:'org-1',userId:'owner',name:'fixture'});
  await setDoc(doc(db,'scales/scale/responses/owner'),{organizationId:'org-1',userId:'owner',status:'accepted'});
  if(options.scope){
   const end=Date.now()+(options.daysLeft??12)*DAY,begin=end-(options.invalidDays?13:14)*DAY;
   await setDoc(doc(db,'musicscale_internal_trials/org-1'),{
    appId:'musicscale',organizationId:'org-1',ownerUid:'owner',source:'hub_internal_trial',
    consumed:true,revoked:false,status:'active',grantVersion:2,
    beginsAt:Timestamp.fromMillis(begin),expiresAt:Timestamp.fromMillis(end),
    ...(options.extended?{extensionCount:1,extensionDays:options.extended,
      extensionEndsAt:Timestamp.fromMillis(end+options.extended*DAY)}:{})
   });
  }
  await setDoc(doc(db,'subscriptions/org-1'), options.paid
   ? {apps:{musicscale:{status:'active',stripeSubscriptionId:'sub_ms'}}}
   : options.nestLocal
    ? {status:'active',stripeSubscriptionId:'sub_local',apps:{nestlocal:{status:'active'}}}
    : {status:options.scope?'inactive':'active'});
 });
}

test('legacy active MusicScale contract keeps working',async()=>{
 await seed();
 for(const p of targetPaths)await assertSucceeds(get(p));
});

test('valid no-card 14-day grant authorizes musical reads',async()=>{
 await seed({scope:true,daysLeft:12});
 for(const p of targetPaths)await assertSucceeds(get(p));
 await assertSucceeds(get('scales/scale/responses/owner'));
});

test('expired Hub grant denies music/roles/scale responses and writes',async()=>{
 await seed({scope:true,daysLeft:-1});
 for(const p of targetPaths)await assertFails(get(p));
 await assertFails(get('scales/scale/responses/owner'));
 await assertFails(updateDoc(doc(msDb(),'songs/music'),{name:'altered'}));
 await assertSucceeds(get('organizations/org-1')); // account and billing shell remain
});

test('NestLocal-only paid root subscription cannot re-open MusicScale music',async()=>{
 await seed({scope:true,daysLeft:-1,nestLocal:true});
 await assertFails(get('songs/music'));
 await assertFails(get('fixedBandScales/fixed'));
});

test('verified MusicScale payment reactivates the same organization',async()=>{
 await seed({scope:true,daysLeft:-1,paid:true});
 await assertSucceeds(get('songs/music'));
 await assertSucceeds(get('fixedBandScales/fixed'));
});

test('one valid +7-day extension extends a grant, malformed trial is denied',async()=>{
 await seed({scope:true,daysLeft:-1,extended:7});
 await assertSucceeds(get('songs/music'));
 await env.clearFirestore();
 await seed({scope:true,daysLeft:12,invalidDays:true});
 await assertFails(get('songs/music'));
});

test('owners cannot mutate a consumed trial projection from a browser',async()=>{
 await seed({scope:true,daysLeft:-1});
 await assertFails(updateDoc(doc(msDb(),'organizations/org-1'),{'apps.musicscale.trialSource':''}));
 await assertFails(updateDoc(doc(msDb(),'organizations/org-1'),{'apps.musicscale.trialEndsAt':Timestamp.fromMillis(Date.now()+30*DAY)}));
});

test('a member from another tenant never sees trial-protected music',async()=>{
 await seed({scope:true,daysLeft:12});
 await assertFails(getDoc(doc(env.authenticatedContext('outsider').firestore(),'songs/music')));
});
