/** Manual-first, fully authenticated NestLocal monthly credits reconciler.
 * Uses freshly read Stripe invoice/subscription and canonical Firestore state;
 * duplicate Stripe events always reuse one immutable sourceRef. Default OFF.
 */
import {randomUUID,createHash} from 'node:crypto';
import {Timestamp,type Firestore} from 'firebase-admin/firestore';
import {
  deriveNestLocalPaidInvoiceCredit,
  type PaidCreditPolicyError,
} from './NestLocalPaidInvoiceCreditsService.js';
import {syncNestLocalAiCreditsFromHub} from './NestAiCreditGrantSyncService.js';

function ms(v:any):number|null {
  if(v?.toMillis)return v.toMillis();
  if(v?.toDate)return v.toDate().getTime();
  return null;
}
export function paidInvoiceOutboxDocumentId(invoiceId:string) {
  if(!/^in_[A-Za-z0-9]{6,}$/.test(invoiceId))throw Error('INVALID_PAID_INVOICE_ID');
  return 'paid_'+createHash('sha256').update('nestlocal:paid:'+invoiceId).digest('hex');
}
export async function reconcileNestLocalPaidInvoiceCredits(input:{
  db:Firestore;invoiceId:string;organizationId:string;env?:NodeJS.ProcessEnv;
  nowMs?:number;
  fetchStripe:(invoiceId:string)=>Promise<{invoice:Record<string,any>;subscription:Record<string,any>}>;
  sync?:typeof syncNestLocalAiCreditsFromHub;
}):Promise<{state:'synced'|'already_synced'|'busy'|'retry_later'|'expired'|'inactive';
  grantId?:string}> {
  const env=input.env??process.env,now=input.nowMs??Date.now();
  if(env.NESTLOCAL_PAID_CREDITS_OUTBOX_ENABLED!=='true'||
    env.NESTAI_COMMERCIAL_CREDITS_ENABLED!=='true'||
    env.NESTAI_GRANTS_SYNC_ENABLED!=='true')throw Error('PAID_CREDITS_SYNC_DISABLED');
  if(!/^[A-Za-z0-9_-]{1,128}$/.test(input.organizationId)||!Number.isSafeInteger(now)||now<=0)
    throw Error('PAID_CREDITS_INPUT_INVALID');
  const ref=input.db.collection('nestai_paid_invoice_grant_outbox').doc(
    paidInvoiceOutboxDocumentId(input.invoiceId));
  const orgRef=input.db.collection('organizations').doc(input.organizationId);
  const subRef=input.db.collection('subscriptions').doc(input.organizationId);
  const leaseId=randomUUID();
  const claim=await input.db.runTransaction(async tx=>{
    const [snap,org,sub]=await Promise.all([tx.get(ref),tx.get(orgRef),tx.get(subRef)]);
    if(!snap.exists)throw Error('PAID_CREDITS_OUTBOX_NOT_FOUND');
    const row=snap.data()||{};
    if(row.kind!=='nestlocal_paid_invoice_credits'||row.schemaVersion!==1||
      row.appId!=='nestlocal'||row.organizationId!==input.organizationId||
      row.invoiceId!==input.invoiceId||
      row.sourceRef!=='nestlocal:paid:'+input.invoiceId||
      row.source!=='plan'||row.grantVersion!==2||
      !['essential','growth','pro'].includes(row.plan)||
      !org.exists||!sub.exists)throw Error('PAID_CREDITS_OUTBOX_INTEGRITY_FAILURE');
    if(row.status==='synced'){
      if(typeof row.grantId!=='string'||!row.grantId)throw Error('PAID_CREDITS_OUTBOX_INTEGRITY_FAILURE');
      return {state:'already_synced' as const,grantId:row.grantId};
    }
    if(org.data()?.disabled===true||['disabled','suspended','archived','inactive']
      .includes(String(org.data()?.status||''))){
      return {state:'inactive' as const};
    }
    const begins=ms(row.beginsAt),expires=ms(row.expiresAt);
    if(begins===null||expires===null||expires<=begins)throw Error('PAID_CREDITS_OUTBOX_INTEGRITY_FAILURE');
    if(expires<=now){tx.update(ref,{status:'expired',updatedAt:Timestamp.fromMillis(now)});
      return {state:'expired' as const};}
    if(row.status==='processing'&&(ms(row.leaseUntil)??0)>now)
      return {state:'busy' as const};
    if((ms(row.retryAfter)??0)>now)return {state:'retry_later' as const};
    tx.update(ref,{status:'processing',leaseId,leaseUntil:Timestamp.fromMillis(now+30_000),
      attempts:Math.max(0,Number(row.attempts)||0)+1,updatedAt:Timestamp.fromMillis(now)});
    return {state:'claimed' as const,row,canonical:sub.data()||{},begins,expires};
  });
  if(claim.state!=='claimed')return claim;
  try{
    // Do not trust an old webhook payload if a refund, tenant migration, plan
    // mutation or cancellation happened before the worker started.
    const fresh=await input.fetchStripe(input.invoiceId);
    const result=deriveNestLocalPaidInvoiceCredit({
      invoice:fresh.invoice,organizationId:input.organizationId,
      subscription:claim.canonical,stripeSubscription:fresh.subscription,
    });
    if(result.intent.plan!==claim.row.plan||
      Date.parse(result.intent.beginsAt)!==claim.begins||
      Date.parse(result.intent.expiresAt)!==claim.expires||
      result.invoiceId!==claim.row.invoiceId||
      result.subscriptionId!==claim.row.subscriptionId||
      result.customerId!==claim.row.customerId||
      result.livemode!==claim.row.livemode||
      result.amountPaid!==claim.row.amountPaid)
      throw Error('PAID_CREDITS_INVOICE_CHANGED');
    const grant=await(input.sync??syncNestLocalAiCreditsFromHub)(result.intent,{env});
    await input.db.runTransaction(async tx=>{
      const current=await tx.get(ref);
      if(current.data()?.leaseId!==leaseId)throw Error('PAID_CREDITS_LEASE_LOST');
      tx.update(ref,{status:'synced',grantId:grant.grantId,created:grant.created,
        syncedAt:Timestamp.fromMillis(Date.now()),updatedAt:Timestamp.fromMillis(Date.now()),
        leaseId:null,leaseUntil:null,retryAfter:null,lastErrorCode:null});
    });
    return {state:'synced',grantId:grant.grantId};
  }catch(error){
    await input.db.runTransaction(async tx=>{
      const current=await tx.get(ref),row=current.data()||{};
      if(row.leaseId!==leaseId)return;
      const next=Math.max(1,Number(row.attempts)||1);
      tx.update(ref,{status:'pending',leaseId:null,leaseUntil:null,
        retryAfter:Timestamp.fromMillis(Date.now()+Math.min(3600000,60000*2**Math.min(next-1,6))),
        lastErrorCode:'PAID_CREDITS_RETRYABLE_ERROR',updatedAt:Timestamp.fromMillis(Date.now())});
    });
    throw Error('PAID_CREDITS_RETRY_SCHEDULED');
  }
}
