import assert from 'node:assert/strict';
import {activateMusicScaleHubTrial,beginMusicScaleTrialOnFirstAccess,isPendingMusicScaleHubTrial} from '../src/server/services/MusicScaleNoCardTrialService.js';
import {resolveEcosystemAppAccess} from '../src/server/services/EcosystemAccessResolver.js';
import {trialWindow} from '../src/server/services/HubTrialExtensionService.js';
import {handleEcosystemAccessProjectionRequest} from '../src/server/services/EcosystemAccessProjectionService.js';
class DB {
 docs=new Map<string,any>();writes=0;
 collection(p:string):any{return this.ref(p)}
 ref(p:string):any{return {path:p,doc:(id:string)=>this.ref(p+'/'+id),collection:(n:string)=>this.ref(p+'/'+n),get:async()=>this.read(p)}}
 read(p:string):any{return {exists:this.docs.has(p),data:()=>this.docs.get(p)}}
 async runTransaction<T>(fn:(tx:any)=>Promise<T>):Promise<T>{
  const writes:any[]=[];
  const result=await fn({get:async(r:any)=>this.read(r.path),create:(r:any,d:any)=>writes.push({p:r.path,d,create:true}),
   set:(r:any,d:any)=>writes.push({p:r.path,d}),update:(r:any,d:any)=>writes.push({p:r.path,d})});
  for(const w of writes){
   if(w.create&&this.docs.has(w.p))throw Error('ALREADY_EXISTS');
   const v={...(this.docs.get(w.p)||{})};
   for(const [k,d] of Object.entries(w.d)){
    const keys=k.split('.');let o=v;
    for(const key of keys.slice(0,-1))o=o[key]={...(o[key]||{})};
    o[keys.at(-1)!]=d;
   }this.docs.set(w.p,v);this.writes++;
  }return result;
 }
}
const now=Date.parse('2026-10-27T20:00:00Z'),DAY=86400000,db=new DB();
db.docs.set('users/owner',{status:'active',systemRole:'user'});
db.docs.set('organizations/org-a',{ownerUid:'owner',status:'active'});
db.docs.set('organizations/org-a/members/owner',{status:'active',role:'owner'});
const args={db:db as any,organizationId:'org-a',ownerUid:'owner',stripeHistoricalClear:true,nowMs:now,deferUntilFirstAccess:true};
const reserved=await activateMusicScaleHubTrial(args);
assert.equal(reserved.expiresAt,null);assert.equal(reserved.canWrite,false);
const pending=db.docs.get('musicscale_internal_trials/org-a');
assert.equal(isPendingMusicScaleHubTrial(pending,'org-a'),true);
assert.equal(trialWindow('musicscale',pending,now,'org-a').active,false);
const count=db.writes;
await activateMusicScaleHubTrial({...args,nowMs:now+20*DAY});
assert.equal(db.writes,count,'waiting/retry cannot start time');
const projection=await resolveEcosystemAppAccess({db:db as any,uid:'owner',organizationId:'org-a',appId:'musicscale'});
assert.equal(projection.accessible,false,'pending grants must deny ALL operational services, including AI');assert.equal(projection.launchable,true);assert.equal(projection.canWrite,false);assert.equal(projection.canUseAI,false);
assert.deepEqual(projection.permissions,[]);
let launchProjection:any;
const response:any={setHeader:()=>{},status:()=>response,json:(data:any)=>{launchProjection=data;return data;}};
await handleEcosystemAccessProjectionRequest(
 {headers:{authorization:'Bearer token'},body:{organizationId:'org-a',appId:'musicscale'}} as any,response,
 {verifyIdToken:async()=>({uid:'owner'}),getDb:()=>db,resolveAccess:async()=>projection,now:()=>now,logger:{log:()=>{},error:()=>{}}} as any);
assert.equal(launchProjection.apps.musicscale.accessible,true,'catalog allows the authenticated app bootstrap');
assert.equal(launchProjection.apps.musicscale.catalogState,'trialing');
assert.equal(launchProjection.apps.musicscale.canReadManagedScaleResponses,false,'catalog launch is not music data authority');
for(const [path,change] of [['users/owner',{disabled:true}],['organizations/org-a',{status:'disabled'}],
 ['organizations/org-a/members/owner',{status:'removed'}],['organizations/org-a/members/owner',{appAccess:{musicscale:{enabled:false}}}]] as const){
 const old=db.docs.get(path);db.docs.set(path,{...old,...change});
 await assert.rejects(beginMusicScaleTrialOnFirstAccess({db:db as any,uid:'owner',organizationId:'org-a',nowMs:now+20*DAY}),/FIRST_ACCESS_FORBIDDEN/);
 assert.equal(db.writes,count);db.docs.set(path,old);
}
await assert.rejects(beginMusicScaleTrialOnFirstAccess({db:db as any,uid:'stranger',organizationId:'org-a',nowMs:now}),/FIRST_ACCESS_FORBIDDEN/);
const enteredAt=now+20*DAY;
const started=await beginMusicScaleTrialOnFirstAccess({db:db as any,uid:'owner',organizationId:'org-a',nowMs:enteredAt});
assert.equal(started.started,true);assert.equal(Date.parse(started.expiresAt!),enteredAt+7*DAY);
const after=db.writes;
const retry=await beginMusicScaleTrialOnFirstAccess({db:db as any,uid:'owner',organizationId:'org-a',nowMs:enteredAt+DAY});
assert.equal(retry.started,false);assert.equal(retry.expiresAt,started.expiresAt);assert.equal(db.writes,after);
await assert.rejects(beginMusicScaleTrialOnFirstAccess({db:db as any,uid:'owner',organizationId:'org-a',nowMs:enteredAt+7*DAY}),/NO_PENDING_TRIAL/);
db.docs.set('subscriptions/org-a',{app:'musicscale',status:'active',stripeSubscriptionId:'sub_paid'});
assert.equal((await beginMusicScaleTrialOnFirstAccess({db:db as any,uid:'owner',organizationId:'org-a',nowMs:enteredAt+8*DAY})).paid,true);
assert.equal(db.writes,after,'paid contracts and expiry get zero writes');
console.log('PASS first app access: pending time, no data/AI rights, membership/tenant gates, immutable deadline, expiry and paid preservation');
