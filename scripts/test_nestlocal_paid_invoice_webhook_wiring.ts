import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {syncNestLocalPaidInvoiceFromWebhook}
  from '../src/server/services/NestLocalPaidInvoiceWebhookSync.js';
const env={
 NESTLOCAL_PAID_CREDITS_OUTBOX_ENABLED:'true',
 NESTAI_COMMERCIAL_CREDITS_ENABLED:'true',
 NESTAI_GRANTS_SYNC_ENABLED:'true',
} as any;
const invoiceId='in_123456789',subId='sub_123456789';
const invoice={id:invoiceId,status:'paid',parent:{subscription_details:{subscription:subId}}};
const subscription={id:subId,status:'active'};
let invoices=0,subs=0,attempts=0;
const stripe={
 invoices:{retrieve:async(id:string)=>{invoices++;assert.equal(id,invoiceId);return invoice;}},
 subscriptions:{retrieve:async(id:string)=>{subs++;assert.equal(id,subId);return subscription;}},
};
const reconcile=async(args:any)=>{
 attempts++;
 assert.equal(args.organizationId,'orgA');
 assert.equal(args.invoiceId,invoiceId);
 const fresh=await args.fetchStripe(args.invoiceId);
 assert.equal(fresh.invoice,invoice);
 assert.equal(fresh.subscription,subscription);
 return {state:'synced',grantId:'only_verified_grant'};
};
const input={db:{} as any,invoiceId,organizationId:'orgA',stripe,
 env,reconcile:reconcile as any};
assert.deepEqual(await syncNestLocalPaidInvoiceFromWebhook(input),
 {state:'synced',grantId:'only_verified_grant'});
assert.equal(attempts,1);assert.equal(invoices,1);assert.equal(subs,1);
assert.deepEqual(await syncNestLocalPaidInvoiceFromWebhook({
 ...input,env:{...env,NESTAI_COMMERCIAL_CREDITS_ENABLED:'false'},
}),{state:'disabled'});
assert.equal(attempts,1);
await assert.rejects(syncNestLocalPaidInvoiceFromWebhook({
 ...input,invoiceId:'in_invalid/other',
}),/PAID_CREDITS_WEBHOOK_INPUT_INVALID/);
await assert.rejects(syncNestLocalPaidInvoiceFromWebhook({
 ...input,stripe:{...stripe,invoices:{retrieve:async()=>({
   ...invoice,subscription:'sub_DIFFERENT',parent:{subscription_details:{subscription:subId}},
 })}},
}),/PAID_CREDITS_INVOICE_RELATION_MISMATCH/);
await assert.rejects(syncNestLocalPaidInvoiceFromWebhook({
 ...input,stripe:{...stripe,subscriptions:{retrieve:async()=>({id:'sub_otherXYZ'})}},
}),/PAID_CREDITS_SUBSCRIPTION_RELATION_MISMATCH/);
await assert.rejects(syncNestLocalPaidInvoiceFromWebhook({
 ...input,reconcile:(async()=>{throw Error('PAID_CREDITS_RETRY_SCHEDULED')}) as any,
}),/PAID_CREDITS_RETRY_SCHEDULED/);
for(const queuedState of ['busy','retry_later']){
  await assert.rejects(syncNestLocalPaidInvoiceFromWebhook({
    ...input,reconcile:(async()=>({state:queuedState})) as any,
  }),/PAID_CREDITS_RETRY_SCHEDULED/);
}
assert.deepEqual(await syncNestLocalPaidInvoiceFromWebhook({
 ...input,reconcile:(async()=>({state:'already_synced',grantId:'verified'})) as any,
}),{state:'already_synced',grantId:'verified'});

// The production webhook must actually call this tested gate, not only stage it.
const server=readFileSync('server.ts','utf8');
const stage=server.indexOf('await stageNestLocalPaidInvoiceGrant({');
const bridge=server.indexOf('await syncNestLocalPaidInvoiceFromWebhook({');
assert.ok(stage>=0&&bridge>stage&&bridge-stage<1500);
assert.ok(server.slice(stage,bridge).includes('state:paidGrant.state'));
assert.ok(server.includes("event.type==='invoice.paid'"));
console.log('PASS: webhook fresh Stripe, strict invoice/sub linkage, disabled gate, errors propagate, server wiring');
