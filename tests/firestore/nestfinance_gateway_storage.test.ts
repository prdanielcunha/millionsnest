import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, setLogLevel, updateDoc, writeBatch } from 'firebase/firestore';

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.GCLOUD_PROJECT?.startsWith('demo-')) {
  throw new Error('Finance gateway storage tests require an isolated demo Firestore emulator');
}
setLogLevel('silent');
const projectId=process.env.GCLOUD_PROJECT;
const [host,port]=process.env.FIRESTORE_EMULATOR_HOST.split(':');
const env=await initializeTestEnvironment({projectId,firestore:{host,port:Number(port),rules:readFileSync('firestore.rules','utf8')}});
const org='org_synthetic_finance_gateway',other='org_synthetic_other_gateway';
const paths=[
  'financeTransactions/tx','financeAllocations/allocation','financeAccounts/account',
  'financeCategories/category','financeFunds/fund','financeSettings/config',
  'financeEntities/entity','financeEntities/entity/countVerificationSessions/session',
  'financeEntities/entity/countVerificationInvites/invite',
  'financeEntities/entity/universalEvidence/evidence','financeEntities/entity/ledgerExecution/config',
  'financeJournalEntries/journal','financeJournalLines/line','financeAggregates/aggregate',
  'financeAuditLogs/audit','financeIdempotency/key','financeUniqueKeys/key',
  'financePayables/payable','financePeriodCloseReviews/review',
  'financeLedgerAccounts/ledger','financeAccountBalances/balance','financePeriods/period',
  'financeFutureServerNamespace/record',
];
try {
  await env.withSecurityRulesDisabled(async context=>{
    const db=context.firestore(),batch=writeBatch(db);
    batch.set(doc(db,'organizations',org),{status:'active',ownerUid:'synthetic_owner',apps:{musicscale:{status:'active'}}});
    batch.set(doc(db,'organizations',other),{status:'active',ownerUid:'synthetic_outsider',apps:{musicscale:{status:'active'}}});
    for(const uid of ['synthetic_member','synthetic_owner','synthetic_counter','synthetic_outsider'])
      batch.set(doc(db,'users',uid),{systemRole:'user'});
    for(const [uid,role]of [['synthetic_member','member'],['synthetic_owner','owner'],['synthetic_counter','member']]) {
      batch.set(doc(db,'organizations',org,'members',uid),{status:'active',role,
        appAccess:{nestFinance:{enabled:true,permissions:uid==='synthetic_counter'?['finance.count.execute']:['finance.manage']}}});
    }
    batch.set(doc(db,'users','synthetic_ceo'),{systemRole:'ceo'});
    batch.set(doc(db,'organizations',org,'sharedNotes','synthetic'),{title:'Unrelated tenant note'});
    for(const path of paths)batch.set(doc(db,`organizations/${org}/${path}`),{organizationId:org,financeEntityId:'entity',amountCents:100});
    await batch.commit();
  });
  let checks=0;
  for(const uid of ['synthetic_member','synthetic_owner','synthetic_counter','synthetic_ceo','synthetic_outsider']) {
    const db=env.authenticatedContext(uid).firestore();
    for(const path of paths) {
      const full=`organizations/${org}/${path}`,ref=doc(db,full);
      await assertFails(getDoc(ref));
      await assertFails(getDocs(collection(db,full.slice(0,full.lastIndexOf('/')))));
      await assertFails(setDoc(doc(db,full+'-new'),{organizationId:org,financeEntityId:'entity',amountCents:100}));
      await assertFails(updateDoc(ref,{amountCents:101}));
      await assertFails(deleteDoc(ref));
      checks+=5;
    }
  }
  const anonymous=env.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(anonymous,`organizations/${org}/financeTransactions/tx`)));
  for(const uid of ['synthetic_member','synthetic_owner','synthetic_ceo']) {
    const db=env.authenticatedContext(uid).firestore();
    await assertSucceeds(getDoc(doc(db,`organizations/${org}/sharedNotes/synthetic`)));
    await assertSucceeds(setDoc(doc(db,`organizations/${org}/sharedNotes/${uid}`),{title:'Unrelated tenant behavior retained'}));
  }
  await env.withSecurityRulesDisabled(async context=>{
    const ref=doc(context.firestore(),`organizations/${org}/financeTransactions/tx`);
    await setDoc(ref,{organizationId:org,financeEntityId:'entity',amountCents:200});
    assert.equal((await getDoc(ref)).data()?.amountCents,200,'trusted server path remains available');
  });
  console.log(`Finance gateway storage: ${checks} denied direct operations; anonymous, unrelated namespace and trusted-server controls passed`);
} finally { await env.cleanup(); }
