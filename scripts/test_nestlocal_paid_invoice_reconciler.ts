import assert from 'node:assert/strict';
import {stageNestLocalPaidInvoiceGrant} from '../src/server/services/NestLocalPaidInvoiceCreditsService.js';
import {reconcileNestLocalPaidInvoiceCredits,paidInvoiceOutboxDocumentId}
  from '../src/server/services/NestLocalPaidInvoiceCreditReconciler.js';
const start=Date.UTC(2026,9,1)/1000,end=Date.UTC(2026,10,1)/1000;
const subscriptionId='sub_123456abc',invoiceId='in_123456abc',customerId='cus_123456abc';
const stripeSub={id:subscriptionId,customer:customerId,livemode:false,
  status:'active',metadata:{app:'nestlocal',organizationId:'orgA'}};
const invoice={id:invoiceId,subscription:subscriptionId,customer:customerId,
  status:'paid',paid:true,amount_paid:10990,currency:'brl',livemode:false,
  billing_reason:'subscription_cycle',lines:{has_more:false,data:[{
    subscription:subscriptionId,period:{start,end},
    price:{recurring:{interval:'month',interval_count:1}},
  }]}};
const canonical={apps:{nestlocal:{app:'nestlocal',status:'active',plan:'growth',
  stripeCustomerId:customerId,stripeSubscriptionId:subscriptionId}}};
class Db{
  readonly docs=new Map<string,any>([
    ['organizations/orgA',{status:'active'}],
    ['subscriptions/orgA',canonical],
  ]);
  collection(path:string):any{return {doc:(id:string)=>({path:path+'/'+id})};}
  async runTransaction<T>(f:(tx:any)=>Promise<T>):Promise<T>{
    const writes:any[]=[];
    const out=await f({
      get:async(ref:any)=>({exists:this.docs.has(ref.path),data:()=>this.docs.get(ref.path)}),
      create:(ref:any,data:any)=>writes.push(['create',ref.path,data]),
      update:(ref:any,data:any)=>writes.push(['update',ref.path,data]),
    });
    for(const [op,path,data] of writes){
      if(op==='create'&&this.docs.has(path))throw Error('ALREADY_EXISTS');
      this.docs.set(path,{...this.docs.get(path),...data});
    }
    return out;
  }
}
const db=new Db(),now=Date.parse('2026-10-08T12:00:00Z'),env={
  NESTLOCAL_PAID_CREDITS_OUTBOX_ENABLED:'true',NESTAI_COMMERCIAL_CREDITS_ENABLED:'true',
  NESTAI_GRANTS_SYNC_ENABLED:'true',
} as any;
const key=paidInvoiceOutboxDocumentId(invoiceId);
await stageNestLocalPaidInvoiceGrant({db:db as any,invoice,organizationId:'orgA',
  stripeSubscription:stripeSub,nowMs:now,env});
let syncCalls=0,fetchCalls=0;
const input={db:db as any,invoiceId,organizationId:'orgA',env,nowMs:now,
  fetchStripe:async()=>{fetchCalls++;return {invoice,subscription:stripeSub}},
  sync:async(intent:any)=>{
    syncCalls++;
    assert.equal(intent.source,'plan');
    assert.equal(intent.plan,'growth');
    assert.equal(intent.sourceRef,'nestlocal:paid:'+invoiceId);
    return {grantId:'grant_123',created:true};
  },
};
const first=await reconcileNestLocalPaidInvoiceCredits(input);
assert.equal(first.state,'synced');
assert.equal(first.grantId,'grant_123');
const again=await reconcileNestLocalPaidInvoiceCredits(input);
assert.equal(again.state,'already_synced');
assert.equal(syncCalls,1);assert.equal(fetchCalls,1);
const record=db.docs.get('nestai_paid_invoice_grant_outbox/'+key);
assert.equal(record.status,'synced');
db.docs.set('nestai_paid_invoice_grant_outbox/'+key,{...record,status:'pending',
  grantId:null,retryAfter:null,leaseId:null,leaseUntil:null});
await assert.rejects(reconcileNestLocalPaidInvoiceCredits({...input,
  fetchStripe:async()=>({invoice:{...invoice,paid:false},subscription:stripeSub})}),
  /PAID_CREDITS_RETRY_SCHEDULED/);
assert.equal(syncCalls,1);
assert.equal(db.docs.get('nestai_paid_invoice_grant_outbox/'+key).status,'pending');
assert.equal((await reconcileNestLocalPaidInvoiceCredits(input)).state,'retry_later');
console.log('PASS: fresh verified invoice, one sync, duplicate replay, refund/payout guard, retry backoff');
