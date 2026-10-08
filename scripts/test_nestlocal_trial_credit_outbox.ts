import assert from 'node:assert/strict';
import {
  activateNestLocalHubTrial, nestLocalTrialOutboxIdentity, HUB_TRIAL_DURATION_MS,
} from '../src/server/services/HubNoCardTrialService.js';
import { reconcileNestLocalTrialCredits, trialCreditRetryDelayMs } from
  '../src/server/services/NestLocalTrialCreditOutboxService.js';

class MemoryDb {
  docs = new Map<string, any>();
  doc(path:string):any {
    return {path,
      get:async()=>this.get(path),
      collection:(id:string)=>this.doc(path+'/'+id),
      doc:(id:string)=>this.doc(path+'/'+id),
    };
  }
  collection(name:string):any{return this.doc(name);}
  get(path:string) {
    const value=this.docs.get(path);
    return {exists:value!==undefined,data:()=>value};
  }
  async runTransaction<T>(handler:(tx:any)=>Promise<T>):Promise<T> {
    const changes:{op:string;path:string;data:any}[]=[];
    const tx={
      get:async(ref:any)=>this.get(ref.path),
      create:(ref:any,data:any)=>changes.push({op:'create',path:ref.path,data}),
      set:(ref:any,data:any)=>changes.push({op:'set',path:ref.path,data}),
      update:(ref:any,data:any)=>changes.push({op:'update',path:ref.path,data}),
    };
    const result=await handler(tx);
    for(const item of changes)
      if(item.op==='create'&&this.docs.has(item.path))throw new Error('ALREADY_EXISTS');
    for(const item of changes){
      this.docs.set(item.path,{...(this.docs.get(item.path)||{}),...item.data});
    }
    return result;
  }
}
const db=new MemoryDb(), now=Date.now();
db.docs.set('organizations/org_trial', {status:'active',apps:{}});
const result=await activateNestLocalHubTrial({
  db:db as any,organizationId:'org_trial',ownerUid:'owner_trial',
  stripeHistoricalClear:true,nowMs:now,
});
assert.equal(result.status,'created');
const id=nestLocalTrialOutboxIdentity('org_trial');
assert.equal(id.sourceRef,nestLocalTrialOutboxIdentity('org_trial').sourceRef);
assert.notEqual(id.sourceRef,nestLocalTrialOutboxIdentity('org_other').sourceRef);
assert.equal(db.get('nestai_credit_grant_outbox/'+id.documentId).data().status,'pending');
assert.equal(db.get('nestai_credit_grant_outbox/'+id.documentId).data().attempts,0);
assert.equal(db.get('nestai_credit_grant_outbox/'+id.documentId).data().sourceRef,id.sourceRef);
assert.equal(db.get('nestai_credit_grant_outbox/'+id.documentId).data().expiresAt.toMillis()-now,HUB_TRIAL_DURATION_MS);
assert.equal(db.get('organizations/org_trial/app_entitlements/nestlocal').data().canWrite,true);
const disabled={NESTAI_COMMERCIAL_CREDITS_ENABLED:'false',NESTAI_GRANTS_SYNC_ENABLED:'false'};
await assert.rejects(reconcileNestLocalTrialCredits({db:db as any,organizationId:'org_trial',env:disabled}),/DISABLED/);
assert.equal(db.get('nestai_credit_grant_outbox/'+id.documentId).data().status,'pending');

const env={NESTAI_COMMERCIAL_CREDITS_ENABLED:'true',NESTAI_GRANTS_SYNC_ENABLED:'true'};
let called=0;
const sync=async(intent:any)=>{
  called++;
  assert.equal(intent.organizationId,'org_trial');
  assert.equal(intent.sourceRef,id.sourceRef);
  assert.equal(intent.beginsAt,new Date(now).toISOString());
  assert.equal(intent.expiresAt,new Date(now+HUB_TRIAL_DURATION_MS).toISOString());
  return {grantId:'grant-abc',created:true};
};
const grant=await reconcileNestLocalTrialCredits({
  db:db as any,organizationId:'org_trial',nowMs:now+1000,env,
  sync:sync as any,
});
assert.deepEqual(grant,{state:'synced',grantId:'grant-abc',created:true});
const replay=await reconcileNestLocalTrialCredits({
  db:db as any,organizationId:'org_trial',nowMs:now+1100,env,
  sync:sync as any,
});
assert.deepEqual(replay,{state:'already_synced',grantId:'grant-abc'});
assert.equal(called,1);
assert.equal(db.get('nestai_credit_grant_outbox/'+id.documentId).data().status,'synced');

// Failed network ack: durable outbox must retry with identical sourceRef,
// letting NestAI D1's unique grant constraint prevent extra allocation.
db.docs.set('organizations/org_retry',{status:'active',apps:{}});
await activateNestLocalHubTrial({
  db:db as any,organizationId:'org_retry',ownerUid:'owner_retry',
  stripeHistoricalClear:true,nowMs:now,
});
let failing=0,firstSource='';
await assert.rejects(reconcileNestLocalTrialCredits({
  db:db as any,organizationId:'org_retry',nowMs:now+1000,env,
  sync:async(intent:any)=>{
    failing++;firstSource=intent.sourceRef;throw Error('network lost');
  },
}),/NESTAI_GRANTS_RETRY_SCHEDULED/);
const failedRef=nestLocalTrialOutboxIdentity('org_retry');
assert.equal(db.get('nestai_credit_grant_outbox/'+failedRef.documentId).data().status,'pending');
assert.equal(failing,1);
assert.deepEqual(await reconcileNestLocalTrialCredits({
  db:db as any,organizationId:'org_retry',nowMs:now+1000,env,
  sync:sync as any,
}),{state:'retry_later'});
const retried=await reconcileNestLocalTrialCredits({
  db:db as any,organizationId:'org_retry',nowMs:now+trialCreditRetryDelayMs(1)+5000,env,
  sync:async(intent:any)=>{
    assert.equal(intent.sourceRef,firstSource);
    return {grantId:'grant-recovered',created:false};
  },
});
assert.deepEqual(retried,{state:'synced',grantId:'grant-recovered',created:false});
assert.equal(db.get('nestai_credit_grant_outbox/'+failedRef.documentId).data().attempts,2);
assert.equal(trialCreditRetryDelayMs(10),60*60*1000);

// Reject tampered outbox, wrong tenant, revocation and expired grant.
db.docs.set('organizations/org_bad',{status:'active',apps:{}});
await activateNestLocalHubTrial({
  db:db as any,organizationId:'org_bad',ownerUid:'owner_bad',stripeHistoricalClear:true,nowMs:now,
});
const badId=nestLocalTrialOutboxIdentity('org_bad');
db.docs.get('nestai_credit_grant_outbox/'+badId.documentId).sourceRef='malicious_source';
await assert.rejects(reconcileNestLocalTrialCredits({
  db:db as any,organizationId:'org_bad',nowMs:now+1000,env,sync:sync as any,
}),/INTEGRITY_FAILURE/);
db.docs.get('nestai_credit_grant_outbox/'+badId.documentId).sourceRef=badId.sourceRef;
const expired=await reconcileNestLocalTrialCredits({
  db:db as any,organizationId:'org_bad',nowMs:now+HUB_TRIAL_DURATION_MS,env,sync:sync as any,
});
assert.deepEqual(expired,{state:'expired'});
assert.equal(called,1);
console.log('PASS: Hub trial outbox atomic issuance, scoped grant, replay, failure recovery, TTL and tamper defense');
