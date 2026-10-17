import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, collection, collectionGroup, getDoc, getDocs, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { readFile } from 'node:fs/promises';
const host = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8180').split(':');
const env = await initializeTestEnvironment({ projectId: 'demo-connect-private-store', firestore: { host: host[0], port: Number(host[1]), rules: await readFile(process.env.CONNECT_LIVE_RULES_FILE ?? 'firestore.rules', 'utf8') } });
const groups = ['connectPushDevices', 'connectPushDeliveries', 'connectPushReadStates', 'connectProductRoutes', 'connectAutomationJobs', 'connectAutomationBudgets', 'organizations/qa-org-a/connectAgentProfiles', 'organizations/qa-org-b/connectAgentProfiles', 'organizations/qa-org-a/_commandReceipts', 'organizations/qa-org-b/_commandReceipts', 'organizations/qa-org-a/financeIdempotency', 'organizations/qa-org-b/financeIdempotency', 'organizations/qa-org-a/products/raiz_e_mesa/connectDueOutbox', 'organizations/qa-org-b/products/raiz_e_mesa/connectDueOutbox'];
let checks = 0;
try {
  await env.withSecurityRulesDisabled(async ctx => {
    const db=ctx.firestore();
    for(const [uid,role] of [['qa-member','member'],['qa-owner','owner'],['qa-admin','admin'],['qa-ceo','ceo'],['qa-support','ecosystem_support']]) {
      await setDoc(doc(db,'users',uid),{systemRole:role,status:'active'});
      await setDoc(doc(db,'organizations','qa-org-a','members',uid),{uid,role,status:'active'});
    }
    await setDoc(doc(db,'organizations','qa-org-a'),{status:'active',ownerUid:'qa-owner'});
    await setDoc(doc(db,'organizations','qa-org-b'),{status:'active',ownerUid:'qa-other-owner'});
    // Make generic tenant access genuinely available. Otherwise an inactive
    // subscription could hide an overlapping allow and produce a false proof.
    for(const orgId of ['qa-org-a','qa-org-b']) await setDoc(doc(db,'subscriptions',orgId),{status:'active'});
    for(const group of groups) {
      const ref=doc(db,group,'synthetic-private-record');
      await setDoc(ref,{organizationId:'qa-org-b',actorUid:'qa-member',recordJson:'SYNTHETIC_NO_REAL_SECRET'});
      await assertSucceeds(getDoc(ref));checks++;
    }
  });
  // The existing generic namespace remains usable by an authorized member.
  const controlDb=env.authenticatedContext('qa-member').firestore();
  const control=doc(controlDb,'organizations/qa-org-a/qa-connect-control/record');
  await assertSucceeds(setDoc(control,{synthetic:true}));
  await assertSucceeds(getDoc(control));
  await assertSucceeds(getDocs(collection(controlDb,'organizations/qa-org-a/qa-connect-control')));
  await assertSucceeds(updateDoc(control,{synthetic:false}));
  await assertSucceeds(deleteDoc(control));checks+=5;
  const actors=[env.unauthenticatedContext(),env.authenticatedContext('qa-member'),env.authenticatedContext('qa-owner'),env.authenticatedContext('qa-admin'),env.authenticatedContext('qa-ceo',{role:'ceo',organizationId:'qa-org-a'}),env.authenticatedContext('qa-support')];
  for(const actor of actors) for(const group of groups) {
    const db=actor.firestore(),ref=doc(db,group,'synthetic-private-record');
    await assertFails(getDoc(ref));await assertFails(getDocs(collection(db,group)));
    await assertFails(setDoc(doc(db,group,'synthetic-new-record'),{organizationId:'qa-org-a',actorUid:'qa-member'}));
    await assertFails(updateDoc(ref,{actorUid:'injected'}));await assertFails(deleteDoc(ref));checks+=5;
  }
  for(const actor of actors) {await assertFails(getDocs(collectionGroup(actor.firestore(),'connectAgentProfiles')));checks++;}
  console.log('CONNECT_PRIVATE_STORE_RULES_CHECKS_PASSED='+checks);
} finally { await env.cleanup(); }
