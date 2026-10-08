/**
 * Trusted Hub retry worker for NestAI trial credits. Does not mutate Stripe,
 * make purchases, or grant a fresh entitlement. Outbox is created only in the
 * same Firestore transaction that creates a one-time Hub trial.
 */
import * as crypto from 'node:crypto';
import { Timestamp, type Firestore } from 'firebase-admin/firestore';
import { nestLocalTrialOutboxIdentity } from './HubNoCardTrialService.js';
import {
  syncNestLocalAiCreditsFromHub, type NestLocalCreditGrantIntent,
} from './NestAiCreditGrantSyncService.js';

export type TrialCreditReconcileResult =
  | { state:'synced'; grantId:string; created:boolean }
  | { state:'already_synced'; grantId:string }
  | { state:'busy' | 'expired' | 'revoked' | 'retry_later' };
const ONE_MINUTE = 60_000;
const LEASE_MS = 30_000;
function timestampMs(value: any): number | null {
  const ms = value?.toMillis?.() ?? value?.toDate?.()?.getTime?.();
  return typeof ms === 'number' && Number.isFinite(ms) ? ms : null;
}
export function trialCreditRetryDelayMs(attempt: number): number {
  return Math.min(60 * ONE_MINUTE, ONE_MINUTE * Math.pow(2, Math.min(10, Math.max(0, attempt - 1))));
}
export async function reconcileNestLocalTrialCredits(input: {
  db: Firestore;
  organizationId: string;
  nowMs?: number;
  env?: NodeJS.ProcessEnv;
  sync?: typeof syncNestLocalAiCreditsFromHub;
}): Promise<TrialCreditReconcileResult> {
  const env = input.env ?? process.env;
  if (env.NESTAI_COMMERCIAL_CREDITS_ENABLED !== 'true' ||
      env.NESTAI_GRANTS_SYNC_ENABLED !== 'true') throw new Error('NESTAI_GRANTS_SYNC_DISABLED');
  const nowMs = input.nowMs ?? Date.now();
  if (!Number.isSafeInteger(nowMs) || nowMs <= 0) throw new Error('INVALID_SERVER_TIME');
  const identity = nestLocalTrialOutboxIdentity(input.organizationId);
  const outboxRef = input.db.collection('nestai_credit_grant_outbox').doc(identity.documentId);
  const trialRef = input.db.collection('nestlocal_internal_trials').doc(input.organizationId);
  const leaseId = crypto.randomUUID();
  const claim = await input.db.runTransaction(async tx => {
    const [outboxDoc, trialDoc] = await Promise.all([tx.get(outboxRef),tx.get(trialRef)]);
    if (!outboxDoc.exists || !trialDoc.exists) throw new Error('NESTAI_OUTBOX_OR_TRIAL_MISSING');
    const data = outboxDoc.data() || {};
    const trial = trialDoc.data() || {};
    const begin = timestampMs(data.beginsAt), end = timestampMs(data.expiresAt);
    const trialBegin = timestampMs(trial.beginsAt), trialEnd = timestampMs(trial.expiresAt);
    if (data.kind !== 'nestlocal_trial_credits' || data.schemaVersion !== 1 ||
        data.organizationId !== input.organizationId || data.appId !== 'nestlocal' ||
        data.source !== 'trial' || data.grantVersion !== 2 ||
        data.sourceRef !== identity.sourceRef ||
        begin === null || end === null || trialBegin !== begin || trialEnd !== end ||
        end-begin !== 168 * 60 * ONE_MINUTE ||
        trial.organizationId !== input.organizationId ||
        trial.appId !== 'nestlocal' || trial.source !== 'hub_internal_trial' ||
        trial.grantVersion !== 2 || trial.consumed !== true) {
      throw new Error('NESTAI_OUTBOX_INTEGRITY_FAILURE');
    }
    if (data.status === 'synced') {
      if (typeof data.grantId !== 'string' || !data.grantId) throw new Error('NESTAI_OUTBOX_INTEGRITY_FAILURE');
      return { state:'already_synced' as const, grantId:data.grantId };
    }
    if (trial.revoked === true || trial.status !== 'active') {
      tx.update(outboxRef, {status:'revoked',updatedAt:Timestamp.fromMillis(nowMs)});
      return {state:'revoked' as const};
    }
    if (end <= nowMs) {
      tx.update(outboxRef, {status:'expired',updatedAt:Timestamp.fromMillis(nowMs)});
      return {state:'expired' as const};
    }
    if (data.status === 'processing' && (timestampMs(data.leaseUntil) ?? 0) > nowMs) {
      return {state:'busy' as const};
    }
    if ((timestampMs(data.retryAfter) ?? 0) > nowMs) return {state:'retry_later' as const};
    const attempts = Math.max(0,Number(data.attempts)||0)+1;
    tx.update(outboxRef, {
      status:'processing',leaseId,leaseUntil:Timestamp.fromMillis(nowMs+LEASE_MS),
      attempts,updatedAt:Timestamp.fromMillis(nowMs),
    });
    const intent: NestLocalCreditGrantIntent = {
      source:'trial',organizationId:input.organizationId,sourceRef:identity.sourceRef,
      grantVersion:2,beginsAt:new Date(begin).toISOString(),expiresAt:new Date(end).toISOString(),
    };
    return {state:'claimed' as const, intent, attempts};
  });
  if (claim.state === 'already_synced') return claim;
  if (claim.state !== 'claimed') return claim;
  try {
    const grant = await (input.sync ?? syncNestLocalAiCreditsFromHub)(claim.intent,{env});
    await input.db.runTransaction(async tx => {
      const current = await tx.get(outboxRef);
      if (!current.exists || current.data()?.leaseId !== leaseId) throw new Error('NESTAI_OUTBOX_LEASE_LOST');
      tx.update(outboxRef, {
        status:'synced',grantId:grant.grantId,created:grant.created,
        syncedAt:Timestamp.fromMillis(Date.now()),updatedAt:Timestamp.fromMillis(Date.now()),
        leaseId:null,leaseUntil:null,retryAfter:null,lastErrorCode:null,
      });
    });
    return {state:'synced',grantId:grant.grantId,created:grant.created};
  } catch (error) {
    // If the provider applied a grant but the ack was lost, sourceRef replay
    // returns the same grant without duplicate credit.
    await input.db.runTransaction(async tx => {
      const current = await tx.get(outboxRef);
      if (!current.exists || current.data()?.leaseId !== leaseId) return;
      const message = error instanceof Error ? error.message : 'NESTAI_GRANTS_SYNC_FAILED';
      const allowedErrors = new Set([
        'NESTAI_GRANTS_SYNC_FAILED','NESTAI_GRANTS_SYNC_DISABLED','NESTAI_GRANTS_ENDPOINT_INVALID',
        'NESTAI_GRANTS_SOURCE_INVALID','NESTAI_GRANTS_VERSION_INVALID','NESTAI_GRANTS_WINDOW_INVALID',
        'NESTAI_GRANTS_AMOUNT_INVALID','NESTAI_GRANTS_TRIAL_TOO_LONG',
      ]);
      tx.update(outboxRef, {
        status:'pending',leaseId:null,leaseUntil:null,
        lastErrorCode:allowedErrors.has(message)?message:'NESTAI_GRANTS_RETRYABLE_FAILURE',
        retryAfter:Timestamp.fromMillis(Date.now()+trialCreditRetryDelayMs(claim.attempts)),
        updatedAt:Timestamp.fromMillis(Date.now()),
      });
    });
    throw new Error('NESTAI_GRANTS_RETRY_SCHEDULED');
  }
}
