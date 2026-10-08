/**
 * NestLocal paid-cycle credit intent. This helper is intentionally independent
 * from Stripe webhook handlers: a verified event MUST be reconciled to a
 * canonical same-tenant NestLocal subscription before any credit is queued.
 */
import {createHash} from 'node:crypto';
import type {Firestore} from 'firebase-admin/firestore';
import {Timestamp} from 'firebase-admin/firestore';
import type {NestLocalCreditGrantIntent} from './NestAiCreditGrantSyncService.js';

type Document = Record<string,any>;
export class PaidCreditPolicyError extends Error{
  constructor(public readonly reason:string){super(reason);}
}
function reject(reason:string):never{throw new PaidCreditPolicyError(reason);}
function id(value:any,prefix:string){return typeof value==='string'&&new RegExp('^'+prefix+'_[A-Za-z0-9]{6,}$').test(value)}
function subIdOf(invoice:Document):string|null {
  const legacy=typeof invoice.subscription==='string'?invoice.subscription:null;
  const current=typeof invoice.parent?.subscription_details?.subscription==='string'
    ? invoice.parent.subscription_details.subscription:null;
  if(legacy&&current&&legacy!==current)reject('INVOICE_SUBSCRIPTION_DISAGREEMENT');
  return legacy||current;
}
export function deriveNestLocalPaidInvoiceCredit(input:{
  invoice:Document;organizationId:string;subscription:Document;
  stripeSubscription:Document;
}):{intent:NestLocalCreditGrantIntent;invoiceId:string;subscriptionId:string;
  customerId:string;amountPaid:number;livemode:boolean}{
  const {invoice,organizationId,subscription:canonical,stripeSubscription:live}=input;
  if(!/^[A-Za-z0-9_-]{1,128}$/.test(organizationId))reject('TENANT_ID_INVALID');
  if(!id(invoice?.id,'in')||invoice.status!=='paid'||invoice.paid!==true)
    reject('INVOICE_NOT_PAID');
  if(!Number.isSafeInteger(invoice.amount_paid)||invoice.amount_paid<=0||invoice.currency!=='brl')
    reject('INVOICE_NOT_PAID_MONEY');
  if(typeof invoice.livemode!=='boolean')reject('INVOICE_MODE_UNVERIFIED');
  const subscriptionId=subIdOf(invoice);
  const customerId=typeof invoice.customer==='string'?invoice.customer:null;
  if(!id(subscriptionId,'sub')||!id(customerId,'cus')||!live||live.id!==subscriptionId||
     live.customer!==customerId)reject('STRIPE_RELATION_MISMATCH');
  if(live.metadata?.app!=='nestlocal'||live.metadata?.organizationId!==organizationId)
    reject('STRIPE_APP_OR_TENANT_MISMATCH');
  if(live.livemode!==invoice.livemode||live.status!=='active')
    reject('PAID_SUBSCRIPTION_NOT_ACTIVE');
  const projected=canonical.apps?.nestlocal;
  if(!projected||projected.app!=='nestlocal'||projected.status!=='active'||
    projected.stripeSubscriptionId!==subscriptionId||projected.stripeCustomerId!==customerId)
    reject('CANONICAL_SUBSCRIPTION_MISMATCH');
  const plan=String(projected.plan||'').toLowerCase();
  if(!['essential','growth','pro'].includes(plan))reject('UNKNOWN_PAID_PLAN');
  if(invoice.billing_reason!=='subscription_cycle' &&
     invoice.billing_reason!=='subscription_create')reject('NON_RECURRING_INVOICE');
  const lines=invoice.lines;
  if(lines?.has_more===true||!Array.isArray(lines?.data))reject('INVOICE_LINES_UNVERIFIED');
  const eligible=lines.data.filter((line:Document)=>{
    const linked=(typeof line.subscription==='string'?line.subscription:
      line.parent?.subscription_item_details?.subscription);
    const price=line.price||line.pricing?.price_details?.price;
    return (linked===subscriptionId || (!linked&&lines.data.length===1)) &&
      line.period&&line.period.start&&line.period.end&&
      (line.price?.recurring?.interval==='month'||line.plan?.interval==='month' ||
       line.parent?.subscription_item_details?.subscription) &&
      (line.price?.recurring?.interval_count??line.plan?.interval_count??1)===1;
  });
  if(eligible.length!==1)reject('MONTHLY_BILLING_PERIOD_AMBIGUOUS');
  const start=Number(eligible[0].period.start),end=Number(eligible[0].period.end);
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||end-start<25*86400||
     end-start>35*86400)reject('MONTHLY_BILLING_PERIOD_INVALID');
  const sourceRef='nestlocal:paid:'+invoice.id;
  return {
    intent:{source:'plan',organizationId,sourceRef,grantVersion:2,
      plan:plan as 'essential'|'growth'|'pro',
      beginsAt:new Date(start*1000).toISOString(),expiresAt:new Date(end*1000).toISOString()},
    invoiceId:invoice.id,subscriptionId,customerId,amountPaid:invoice.amount_paid,
    livemode:invoice.livemode,
  };
}
/** Staged, idempotent outbox creation; only a VERIFIED invoice.paid webhook
 * may invoke it. It NEVER posts credits directly or modifies Stripe.
 */
export async function stageNestLocalPaidInvoiceGrant(input:{
  db:Firestore;invoice:Document;organizationId:string;stripeSubscription:Document;
  env?:NodeJS.ProcessEnv;nowMs?:number;
}):Promise<{state:'queued'|'already_queued';documentId:string}>{
  const env=input.env??process.env;
  if(env.NESTLOCAL_PAID_CREDITS_OUTBOX_ENABLED!=='true')
    reject('PAID_CREDITS_OUTBOX_DISABLED');
  const now=input.nowMs??Date.now();
  if(!Number.isSafeInteger(now)||now<=0)reject('SERVER_TIME_INVALID');
  const subRef=input.db.collection('subscriptions').doc(input.organizationId);
  const orgRef=input.db.collection('organizations').doc(input.organizationId);
  const hash=createHash('sha256').update('nestlocal:paid:'+input.invoice.id).digest('hex');
  const documentId='paid_'+hash;
  const outboxRef=input.db.collection('nestai_paid_invoice_grant_outbox').doc(documentId);
  return input.db.runTransaction(async tx=>{
    const [sub,org,existing]=await Promise.all([
      tx.get(subRef),tx.get(orgRef),tx.get(outboxRef),
    ]);
    if(!sub.exists||!org.exists||org.data()?.disabled===true||
      ['disabled','suspended','archived','inactive'].includes(String(org.data()?.status||'')))
      reject('TENANT_NOT_ACTIVE');
    const parsed=deriveNestLocalPaidInvoiceCredit({
      invoice:input.invoice,organizationId:input.organizationId,
      subscription:sub.data()||{},stripeSubscription:input.stripeSubscription,
    });
    if(existing.exists){
      const prev=existing.data()||{};
      if(prev.organizationId!==input.organizationId||
         prev.invoiceId!==parsed.invoiceId||
         prev.subscriptionId!==parsed.subscriptionId||
         prev.sourceRef!==parsed.intent.sourceRef)
        reject('PAID_CREDITS_LEDGER_INTEGRITY_FAILURE');
      return {state:'already_queued' as const,documentId};
    }
    tx.create(outboxRef,{
      kind:'nestlocal_paid_invoice_credits',schemaVersion:1,
      status:'pending',appId:'nestlocal',organizationId:input.organizationId,
      source:'plan',sourceRef:parsed.intent.sourceRef,grantVersion:2,
      plan:parsed.intent.plan,invoiceId:parsed.invoiceId,
      subscriptionId:parsed.subscriptionId,customerId:parsed.customerId,
      amountPaid:parsed.amountPaid,livemode:parsed.livemode,
      beginsAt:Timestamp.fromMillis(Date.parse(parsed.intent.beginsAt)),
      expiresAt:Timestamp.fromMillis(Date.parse(parsed.intent.expiresAt)),
      attempts:0,createdAt:Timestamp.fromMillis(now),
    });
    return {state:'queued' as const,documentId};
  });
}
