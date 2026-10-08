import assert from 'node:assert/strict';
import {deriveNestLocalPaidInvoiceCredit,stageNestLocalPaidInvoiceGrant}
  from '../src/server/services/NestLocalPaidInvoiceCreditsService.js';
const start=Date.UTC(2026,9,1)/1000,end=Date.UTC(2026,10,1)/1000;
const subId='sub_123456abc',customerId='cus_123456abc',invoiceId='in_123456abc';
const line={subscription:subId,price:{recurring:{interval:'month',interval_count:1}},
  period:{start,end}};
const invoice:any={id:invoiceId,paid:true,status:'paid',currency:'brl',
  amount_paid:10990,livemode:false,billing_reason:'subscription_cycle',
  subscription:subId,customer:customerId,lines:{has_more:false,data:[line]}};
const stripe:any={id:subId,customer:customerId,status:'active',livemode:false,
  metadata:{app:'nestlocal',organizationId:'orgA'}};
const canonical:any={apps:{nestlocal:{app:'nestlocal',status:'active',
  plan:'growth',stripeSubscriptionId:subId,stripeCustomerId:customerId}}};
const expected=deriveNestLocalPaidInvoiceCredit({invoice,
  stripeSubscription:stripe,subscription:canonical,organizationId:'orgA'});
assert.equal(expected.intent.plan,'growth');
assert.equal(expected.intent.sourceRef,'nestlocal:paid:'+invoiceId);
assert.equal(expected.intent.beginsAt,new Date(start*1000).toISOString());
for(const fail of [
  {...invoice,status:'open'}, {...invoice,amount_paid:0},
  {...invoice,billing_reason:'subscription_update'},
  {...invoice,lines:{has_more:true,data:[line]}},
  {...invoice,lines:{has_more:false,data:[{...line,period:{start,end:start+15*86400}}]}},
  {...invoice,parent:{subscription_details:{subscription:'sub_otherABC'}}},
]){
  assert.throws(()=>deriveNestLocalPaidInvoiceCredit({invoice:fail,
    stripeSubscription:stripe,subscription:canonical,organizationId:'orgA'}));
}
assert.throws(()=>deriveNestLocalPaidInvoiceCredit({invoice,
  stripeSubscription:{...stripe,metadata:{app:'musicscale',organizationId:'orgA'}},
  subscription:canonical,organizationId:'orgA'}));
assert.throws(()=>deriveNestLocalPaidInvoiceCredit({invoice,
  stripeSubscription:stripe,subscription:canonical,organizationId:'orgB'}));
assert.throws(()=>deriveNestLocalPaidInvoiceCredit({invoice,
  stripeSubscription:stripe,subscription:{apps:{nestlocal:{...canonical.apps.nestlocal,
  stripeSubscriptionId:'sub_old999'}}},organizationId:'orgA'}));
class FakeDb {
  readonly docs=new Map<string,any>([
    ['organizations/orgA',{status:'active'}],
    ['subscriptions/orgA',canonical],
  ]);
  collection(name:string):any{return {doc:(id:string)=>({path:name+'/'+id})}}
  async runTransaction<T>(f:(tx:any)=>Promise<T>):Promise<T>{
    const writes:Array<[string,any]>=[];
    const result=await f({get:async(r:any)=>({exists:this.docs.has(r.path),
      data:()=>this.docs.get(r.path)}),create:(r:any,data:any)=>{
        if(this.docs.has(r.path))throw Error('ALREADY_EXISTS');
        writes.push([r.path,data]);
      }});
    for(const [path,data] of writes)this.docs.set(path,data);
    return result;
  }
}
const db=new FakeDb(),params={db:db as any,invoice,organizationId:'orgA',
  stripeSubscription:stripe,nowMs:Date.now(),env:{NESTLOCAL_PAID_CREDITS_OUTBOX_ENABLED:'true'} as any};
const created=await stageNestLocalPaidInvoiceGrant(params);
assert.equal(created.state,'queued');
assert.equal((await stageNestLocalPaidInvoiceGrant(params)).state,'already_queued');
assert.equal(db.docs.get('nestai_paid_invoice_grant_outbox/'+created.documentId).plan,'growth');
await assert.rejects(stageNestLocalPaidInvoiceGrant({...params,env:{} as any}),
  /PAID_CREDITS_OUTBOX_DISABLED/);
console.log('PASS: paid monthly invoice, exact tenant/Stripe association, no proration, idempotent outbox');
