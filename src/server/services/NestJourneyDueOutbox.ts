import { randomUUID } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import { nestJourneyDueEventId, parseJourneyOperatorTargets, publishNestJourneyFollowupDue,
  type NestJourneyConnectFollowupSource } from './NestJourneyFollowupEventPublisher.js';
import { verifyCurrentNestJourneyDueAuthority } from './NestJourneyDueAuthority.js';

// products/raiz_e_mesa unknown subcollections are already deny-by-default in
// canonical Hub Rules. Never use the generic organization/app wildcard here.
export const journeyDueOutboxPath = (organizationId: string) =>
  `organizations/${organizationId}/products/raiz_e_mesa/connectDueOutbox`;
type DueRecord = {
  schemaVersion: 1; source: NestJourneyConnectFollowupSource;
  state: 'pending' | 'processing' | 'complete' | 'cancelled' | 'needs_review';
  attempts: number; leaseToken?: string; leaseUntil?: string; retryAt?: string; resultCode?: string;
};
const iso = (v: any): string | null => {
  const date = typeof v === 'string' ? new Date(v) : v?.toDate?.();
  return date instanceof Date && Number.isFinite(+date) ? date.toISOString() : null;
};
function record(raw: unknown, organizationId: string, id: string): DueRecord | null {
  try {
    const r=raw as DueRecord;
    if (!r || r.schemaVersion!==1 || r.source.organizationId!==organizationId ||
        nestJourneyDueEventId(r.source)!==id || !Number.isInteger(r.attempts) || r.attempts<0 || r.attempts>3 ||
        !['pending','processing','complete','cancelled','needs_review'].includes(r.state)) return null;
    return r;
  } catch { return null; }
}
/** Consent and all canonical source records are read in the SAME transaction
 * as creation. No event exists if a concurrent consent/owner/source edit wins. */
export async function stageNestJourneyDue(input: {
  db: Firestore; enabled: boolean; source: NestJourneyConnectFollowupSource; now?: () => number;
}) {
  if (!input.enabled) return 'disabled';
  const { db, source }=input;
  return db.runTransaction(async tx => {
    const authorityDb = { doc: (path: string) => ({ get: () => tx.get(db.doc(path)) }) };
    if (!await verifyCurrentNestJourneyDueAuthority({ db: authorityDb as any, event: source, now: input.now })) return 'denied';
    const ref=db.doc(`${journeyDueOutboxPath(source.organizationId)}/${nestJourneyDueEventId(source)}`);
    const existing=await tx.get(ref);
    if (existing.exists) return 'existing';
    tx.set(ref, { schemaVersion: 1, source, state: 'pending', attempts: 0 } satisfies DueRecord);
    return 'staged';
  });
}

export async function runNestJourneyDueRecovery(input: {
  enabled: boolean; db: () => Firestore; signingSecret?: string; operatorTargetsJson?: string;
  now?: () => number; fetchImpl?: typeof fetch;
}) {
  const result={ enabled: input.enabled, tenants:0, failures:0, discovered:0, staged:0, scanned:0, completed:0, cancelled:0, pending:0, review:0 };
  if (!input.enabled) return result;
  const targets=parseJourneyOperatorTargets(input.operatorTargetsJson);
  if (!targets || !Object.keys(targets).length || !input.signingSecret ||
      input.signingSecret.length<32 || input.signingSecret.length>4096) throw Error('JOURNEY_RECOVERY_NOT_CONFIGURED');
  const db=input.db(), clock=input.now??Date.now;
  for (const organizationId of Object.keys(targets).sort()) {
    result.tenants++;
    try {
      const outbox=db.collection(journeyDueOutboxPath(organizationId));
      // Independent durable discovery: future/unauthorized first pages cannot
      // permanently hide later due followups. No global people/notes scan.
      for (const kind of ['discovery','recovery'] as const) {
        const cursorRef=outbox.doc(`_${kind}CursorV1`), cursor=(await cursorRef.get()).data();
        const token=typeof cursor?.token==='string'?cursor.token:'';
        const after=typeof cursor?.after==='string' && cursor.after.length<=180 &&
          !/[\\/\u0000-\u001f\u007f]/.test(cursor.after)?cursor.after:'';
        const collection=kind==='discovery'
          ? db.collection(`organizations/${organizationId}/products/raiz_e_mesa/followups`) : outbox;
        let query=kind==='discovery'?collection.where('status','==','pending')
          :collection.where('state','in',['pending','processing']);
        query=query.orderBy('__name__').limit(5);
        if (after) query=query.startAfter(after);
        const page=await query.get();
        for (const row of page.docs) {
          if (kind==='discovery') {
            result.discovered++;
            const value=row.data(), dueAt=iso(value.dueAt);
            if (!dueAt || value.organizationId!==organizationId || typeof value.ownerRef!=='string') continue;
            const outcome=await stageNestJourneyDue({ db, enabled:true, now:clock,
              source:{ organizationId, followupId:row.id, ownerUid:value.ownerRef, dueAt } });
            if (outcome==='staged') result.staged++;
          } else {
            result.scanned++;
            const leaseToken=randomUUID(), now=clock();
            const claimed=await db.runTransaction(async tx => {
              const marker=record((await tx.get(row.ref)).data(),organizationId,row.id);
              if (!marker || !['pending','processing'].includes(marker.state) ||
                  Date.parse(marker.retryAt??'')>now ||
                  marker.state==='processing' && Date.parse(marker.leaseUntil??'')>now) return null;
              if (marker.attempts>=3) {
                tx.update(row.ref,{state:'needs_review',resultCode:'retry_limit'});return 'review' as const;
              }
              tx.update(row.ref,{state:'processing',attempts:marker.attempts+1,leaseToken,
                leaseUntil:new Date(now+30000).toISOString()});
              return {...marker,attempts:marker.attempts+1};
            });
            if (claimed==='review') {result.review++;continue;}
            if (!claimed) continue;
            let outcome: string;
            try { outcome=await publishNestJourneyFollowupDue({ ...claimed.source,enabled:true,
              signingSecret:input.signingSecret,operatorTargetsJson:input.operatorTargetsJson,
              now:clock,fetchImpl:input.fetchImpl,
              revalidateBeforeSend:()=>verifyCurrentNestJourneyDueAuthority({db,event:claimed.source,now:clock}),
            }); } catch {outcome='transport_unconfirmed';}
            const state=outcome==='accepted'||outcome==='duplicate'?'complete'
              :outcome==='not_authorized'||outcome==='not_due'?'cancelled'
              :claimed.attempts>=3?'needs_review':'pending';
            const committed=await db.runTransaction(async tx => {
              const current=record((await tx.get(row.ref)).data(),organizationId,row.id);
              if (!current || current.state!=='processing' || current.leaseToken!==leaseToken) return false;
              tx.update(row.ref,{state,resultCode:outcome,leaseToken:'',leaseUntil:'',
                retryAt:state==='pending'?new Date(clock()+30000*2**claimed.attempts).toISOString():''});
              return true;
            });
            if (committed) {
              if (state==='complete') result.completed++;
              else if (state==='needs_review') result.review++;
              else if (state==='cancelled') result.cancelled++;
              else result.pending++;
            }
          }
        }
        await db.runTransaction(async tx => {
          const current=(await tx.get(cursorRef)).data();
          if ((typeof current?.token==='string'?current.token:'')!==token) return;
          tx.set(cursorRef,{schemaVersion:1,token:randomUUID(),after:page.docs.at(-1)?.id??''});
        });
      }
    } catch {result.failures++;}
  }
  return result;
}

/** Source proof for an event ALREADY queued at Connect. No pastoral data leaves
 * Hub. Stored identity, current approved target and current consent all match. */
export async function authorizeQueuedJourneyEvent(input: {
  db: Firestore; event: Record<string, unknown>; operatorTargetsJson?: string; now?: () => number;
}) {
  const e=input.event;
  if (e.sourceApp!=='nestjourney'||e.schemaVersion!==1||e.trigger!=='followup.due'||
      typeof e.organizationId!=='string'||typeof e.eventId!=='string'||!/^[a-f0-9]{64}$/.test(e.eventId)) return false;
  const target=parseJourneyOperatorTargets(input.operatorTargetsJson)?.[e.organizationId];
  if (!target || target.conversationId!==e.conversationId || target.recipientUid!==e.recipientUid) return false;
  const snapshot=await input.db.doc(`${journeyDueOutboxPath(e.organizationId)}/${e.eventId}`).get();
  const stored=record(snapshot.data(),e.organizationId,e.eventId);
  if (!stored || !['pending','processing','complete'].includes(stored.state)||stored.source.dueAt!==e.occurredAt) return false;
  return verifyCurrentNestJourneyDueAuthority({db:input.db,event:stored.source,now:input.now});
}
