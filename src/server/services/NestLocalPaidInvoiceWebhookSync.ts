/** Reconcile a verified NestLocal paid invoice to the NestAI grant journal.
 * This is invoked ONLY after the Stripe signature and canonical organization
 * subscription have been processed by Hub's existing webhook pipeline.
 * Every call re-fetches Stripe state; no event payload is trusted as payment.
 * Disabled by default, including for all legacy MusicScale customers.
 */
import type {Firestore} from 'firebase-admin/firestore';
import {reconcileNestLocalPaidInvoiceCredits} from './NestLocalPaidInvoiceCreditReconciler.js';
type StripeReadOnly={
  invoices:{retrieve(id:string):Promise<unknown>};
  subscriptions:{retrieve(id:string):Promise<unknown>};
};
export async function syncNestLocalPaidInvoiceFromWebhook(input:{
  db:Firestore;invoiceId:string;organizationId:string;
  stripe:StripeReadOnly;
  env?:NodeJS.ProcessEnv;
  reconcile?:typeof reconcileNestLocalPaidInvoiceCredits;
}):Promise<{state:string;grantId?:string}> {
  const env=input.env??process.env;
  if(env.NESTLOCAL_PAID_CREDITS_OUTBOX_ENABLED!=='true' ||
     env.NESTAI_COMMERCIAL_CREDITS_ENABLED!=='true' ||
     env.NESTAI_GRANTS_SYNC_ENABLED!=='true')return {state:'disabled'};
  if(!/^in_[A-Za-z0-9]{6,}$/.test(input.invoiceId)||
     !/^[A-Za-z0-9_-]{1,128}$/.test(input.organizationId))
    throw Error('PAID_CREDITS_WEBHOOK_INPUT_INVALID');
  const outcome=await (input.reconcile??reconcileNestLocalPaidInvoiceCredits)({
    db:input.db,invoiceId:input.invoiceId,organizationId:input.organizationId,env,
    fetchStripe:async(invoiceId)=>{
      if(invoiceId!==input.invoiceId)throw Error('PAID_CREDITS_INVOICE_MISMATCH');
      const invoice=await input.stripe.invoices.retrieve(invoiceId) as Record<string,any>;
      const modern=invoice?.parent?.subscription_details?.subscription;
      const legacy=invoice?.subscription;
      if(legacy&&modern&&legacy!==modern)throw Error('PAID_CREDITS_INVOICE_RELATION_MISMATCH');
      const subscriptionId=legacy||modern;
      if(typeof subscriptionId!=='string'||!/^sub_[A-Za-z0-9]{6,}$/.test(subscriptionId))
        throw Error('PAID_CREDITS_STRIPE_SUBSCRIPTION_MISSING');
      const subscription=await input.stripe.subscriptions.retrieve(subscriptionId) as Record<string,any>;
      if(subscription?.id!==subscriptionId)
        throw Error('PAID_CREDITS_SUBSCRIPTION_RELATION_MISMATCH');
      return {invoice,subscription};
    },
  });
  // Stripe must NOT acknowledge a delivery if the grant was merely queued
  // behind a lease or backoff. Ack would hide an unpaid-credit incident until
  // someone manually invoked the outbox reconciler. Retain replay delivery.
  if(outcome.state==='busy'||outcome.state==='retry_later')
    throw Error('PAID_CREDITS_RETRY_SCHEDULED');
  return outcome;
}
