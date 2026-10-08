import assert from 'node:assert/strict';
import {DAY_MS,TRIAL_BASE_DAYS,trialWindow,extendHubTrial} from '../src/server/services/HubTrialExtensionService.js';
const start=Date.parse('2026-10-01T12:00:00Z');
for(const app of ['musicscale','nestlocal'] as const) {
  const base=start+TRIAL_BASE_DAYS[app]*DAY_MS;
  const record={appId:app,organizationId:'org1',source:'hub_internal_trial',
    status:'active',consumed:true,revoked:false,grantVersion:2,
    beginsAt:{toMillis:()=>start},expiresAt:{toMillis:()=>base}};
  assert.equal(trialWindow(app,record,base-1,'org1').active,true);
  assert.equal(trialWindow(app,record,base,'org1').expired,true);
  const extended={...record,extensionCount:1,extensionDays:7,
    extensionEndsAt:{toMillis:()=>base+7*DAY_MS}};
  assert.equal(trialWindow(app,extended,base+1,'org1').active,true);
  assert.equal(trialWindow(app,extended,base+7*DAY_MS,'org1').expired,true);
  assert.equal(trialWindow(app,{...extended,extensionCount:2},base+1,'org1').valid,false);
  assert.equal(trialWindow(app,{...extended,extensionDays:8},base+1,'org1').valid,false);
  assert.equal(trialWindow(app,extended,base+1,'another_org').valid,false);
}

class TrialDb {
  readonly store=new Map<string,any>();
  collection(root:string):any{return this.ref(root)}
  ref(path:string):any{return {path,doc:(name:string)=>this.ref(path+'/'+name),
    collection:(name:string)=>this.ref(path+'/'+name)}}
  async runTransaction<T>(fn:(tx:any)=>Promise<T>):Promise<T>{
    const writes:Array<{op:string;path:string;data:any}>=[];
    const tx={get:async(ref:any)=>({exists:this.store.has(ref.path),data:()=>this.store.get(ref.path)}),
      create:(ref:any,data:any)=>writes.push({op:'create',path:ref.path,data}),
      set:(ref:any,data:any)=>writes.push({op:'set',path:ref.path,data}),
      update:(ref:any,data:any)=>writes.push({op:'update',path:ref.path,data})};
    const answer=await fn(tx);
    for(const w of writes)if(w.op==='create'&&this.store.has(w.path))throw Error('ALREADY_EXISTS');
    for(const w of writes)this.store.set(w.path,{...(this.store.get(w.path)||{}),...w.data});
    return answer;
  }
}
for(const appId of ['musicscale','nestlocal'] as const){
  const db=new TrialDb(),end=start+TRIAL_BASE_DAYS[appId]*DAY_MS;
  db.store.set('organizations/org1',{status:'active'});
  db.store.set(appId+'_internal_trials/org1',{
    appId,organizationId:'org1',source:'hub_internal_trial',
    status:'active',consumed:true,grantVersion:2,
    beginsAt:{toMillis:()=>start},expiresAt:{toMillis:()=>end},
  });
  const args={db:db as any,appId,organizationId:'org1',adminUid:'globalstaff',
    days:7,reason:'Solicitação de extensão para concluir avaliação',nowMs:end-1000};
  const outcome=await extendHubTrial(args);
  assert.equal(outcome.effectiveEndsAt,new Date(end+7*DAY_MS).toISOString());
  const stored=db.store.get(appId+'_internal_trials/org1');
  assert.equal(trialWindow(appId,stored,end+1,'org1').active,true);
  assert.equal(trialWindow(appId,stored,end+7*DAY_MS,'org1').expired,true);
  assert.equal(db.store.get('hub_trial_extension_events/'+appId+'_org1').adminUid,'globalstaff');
  await assert.rejects(extendHubTrial(args),/EXTENSION_ALREADY_USED/);
}
console.log('PASS: 14/7 day trials, seven-day extension, final expiry and tenant safety');
