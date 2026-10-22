import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ECOSYSTEM_TRIAL_DAYS,ECOSYSTEM_TRIAL_MS,isSupportedHubTrialDuration} from '../src/lib/ecosystemTrialPolicy.js';
import {activateMusicScaleHubTrial,MUSICSCALE_TRIAL_MS} from '../src/server/services/MusicScaleNoCardTrialService.js';
import {trialWindow,extendHubTrial} from '../src/server/services/HubTrialExtensionService.js';
import {shouldAddStripeTrial} from '../src/server/services/HubNoCardTrialService.js';
import {MUSIC_SCALE_PLANS} from '../src/lib/musicScalePlans.js';

const DAY=86_400_000,now=Date.parse('2026-10-15T21:00:00Z');
assert.equal(ECOSYSTEM_TRIAL_DAYS,7);
assert.equal(MUSICSCALE_TRIAL_MS,ECOSYSTEM_TRIAL_MS);
for(const plan of Object.values(MUSIC_SCALE_PLANS))assert.equal(plan.trialDays,7);
for(const appId of ['musicscale','nestlocal','nestfinance','nestjourney','connect','future-app']){
  assert.equal(isSupportedHubTrialDuration(appId,7*DAY,3),true);
  assert.equal(isSupportedHubTrialDuration(appId,14*DAY,3),false);
  for(const enabled of [true,false])for(const consumed of [true,false])for(const history of [true,false]){
    assert.equal(shouldAddStripeTrial({appId,hasLegacyTrialHistory:history,
      internalTrialConsumed:consumed,newNestLocalTrialEnabled:enabled,newMusicScaleTrialEnabled:enabled}),false);
  }
}
assert.equal(isSupportedHubTrialDuration('nestlocal',14*DAY,2),false);
const legacy={appId:'musicscale',organizationId:'legacy',source:'hub_internal_trial',status:'active',
  consumed:true,revoked:false,grantVersion:2,beginsAt:new Date(now),expiresAt:new Date(now+14*DAY)};
assert.equal(trialWindow('musicscale',legacy,now+8*DAY,'legacy').active,true);
assert.equal(trialWindow('musicscale',legacy,now+14*DAY,'legacy').expired,true);
assert.equal(trialWindow('musicscale',{...legacy,grantVersion:3},now,'legacy').valid,false);

class TrialDb {
  docs=new Map<string,any>();
  collection(path:string):any{return this.ref(path)}
  ref(path:string):any{return {path,doc:(id:string)=>this.ref(path+'/'+id),collection:(name:string)=>this.ref(path+'/'+name)}}
  async runTransaction<T>(fn:(tx:any)=>Promise<T>):Promise<T>{
    const writes:Array<{path:string;data:any;create?:boolean}>=[];
    const result=await fn({get:async(ref:any)=>({exists:this.docs.has(ref.path),data:()=>this.docs.get(ref.path)}),
      create:(ref:any,data:any)=>writes.push({path:ref.path,data,create:true}),
      set:(ref:any,data:any)=>writes.push({path:ref.path,data}),update:(ref:any,data:any)=>writes.push({path:ref.path,data})});
    for(const w of writes)if(w.create&&this.docs.has(w.path))throw Error('ALREADY_EXISTS');
    for(const w of writes)this.docs.set(w.path,{...this.docs.get(w.path),...w.data});
    return result;
  }
}
const db=new TrialDb();
db.docs.set('organizations/new-org',{status:'active'});
const args={db:db as any,organizationId:'new-org',ownerUid:'new-owner',stripeHistoricalClear:true,nowMs:now};
const created=await activateMusicScaleHubTrial(args);
assert.equal(Date.parse(created.expiresAt),now+7*DAY);
assert.equal(db.docs.has('subscriptions/new-org'),false,'trial must never create billing records');
const grant=db.docs.get('musicscale_internal_trials/new-org');
assert.equal(grant.grantVersion,3);
const projection=db.docs.get('organizations/new-org');
assert.equal(projection['apps.musicscale.plan'],'pro');
for(const feature of ['aiImport','aiStructuring','aiSuggestions','aiSetlistAnalysis'])
  assert.equal(projection['apps.musicscale.features'][feature],true);
assert.equal(trialWindow('musicscale',grant,now+7*DAY-1,'new-org').active,true);
assert.equal(trialWindow('musicscale',grant,now+7*DAY,'new-org').expired,true);
const retry=await activateMusicScaleHubTrial({...args,nowMs:now+DAY});
assert.equal(retry.expiresAt,created.expiresAt,'retry never restarts countdown');
await assert.rejects(activateMusicScaleHubTrial({...args,nowMs:now+7*DAY}),/TRIAL_ALREADY_CONSUMED/);
const extension=await extendHubTrial({db:db as any,appId:'musicscale',organizationId:'new-org',adminUid:'support',
  days:7,reason:'Authorized test of one administrative extension',nowMs:now+6*DAY});
assert.equal(Date.parse(extension.effectiveEndsAt),now+14*DAY);

for(const subscription of [
  {status:'active',plan:'pro',stripeSubscriptionId:'sub_paid'},
  {apps:{musicscale:{status:'active',plan:'advanced',stripeSubscriptionId:'sub_scoped'}}},
  {status:'trialing',stripeSubscriptionId:'sub_legacy_trial'},
  {status:'past_due',stripeSubscriptionId:'sub_payment_issue'},
]){
  const paidDb=new TrialDb();
  paidDb.docs.set('organizations/paid-org',{status:'active'});
  paidDb.docs.set('subscriptions/paid-org',subscription);
  const before=JSON.stringify([...paidDb.docs]);
  await assert.rejects(activateMusicScaleHubTrial({...args,db:paidDb as any,organizationId:'paid-org'}),/PRIOR_MUSICSCALE_SUBSCRIPTION/);
  assert.equal(JSON.stringify([...paidDb.docs]),before,'paid and legacy accounts must receive zero writes');
}
const source=readFileSync('server.ts','utf8');
assert.ok(source.includes('days:TRIAL_BASE_DAYS[appId]'));
assert.ok(!/trial_period_days\s*=\s*\d/.test(source),'neither checkout may issue a new Stripe trial');
assert.equal((source.match(/checkout_policy\$\{ECOSYSTEM_TRIAL_POLICY_VERSION\}/g)||[]).length,2,
  'old Stripe idempotency responses must not resurrect a pre-policy checkout');
console.log('PASS ecosystem trial policy: 7 days, legacy deadlines, no Stripe trial, idempotency, extensions and zero writes to paid accounts');
