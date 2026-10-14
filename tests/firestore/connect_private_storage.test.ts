import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, collection, getDoc, getDocs, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { readFile } from 'node:fs/promises';
const host = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8180').split(':');
const env = await initializeTestEnvironment({ projectId: 'demo-connect-private-store', firestore: { host: host[0], port: Number(host[1]), rules: await readFile(process.env.CONNECT_LIVE_RULES_FILE ?? 'firestore.rules', 'utf8') } });
const groups = ['connectPushDevices', 'connectPushDeliveries', 'connectPushReadStates', 'connectProductRoutes', 'connectAutomationJobs', 'connectAutomationBudgets'];
let checks = 0;
try {
  await env.withSecurityRulesDisabled(async ctx => {
    const db=ctx.firestore();
    for(const [uid,role] of [['qa-member','member'],['qa-owner','owner'],['qa-admin','admin'],['qa-ceo','ceo']]) {
      await setDoc(doc(db,'users',uid),{systemRole:role,status:'active'});
      await setDoc(doc(db,'organizations','qa-org-a','members',uid),{uid,role,status:'active'});
    }
    await setDoc(doc(db,'organizations','qa-org-a'),{status:'active',ownerUid:'qa-owner'});
    for(const group of groups) {
      const ref=doc(db,group,'synthetic-private-record');
      await setDoc(ref,{organizationId:'qa-org-b',actorUid:'qa-member',recordJson:'SYNTHETIC_NO_REAL_SECRET'});
      await assertSucceeds(getDoc(ref));checks++;
    }
  });
  const actors=[env.unauthenticatedContext(),env.authenticatedContext('qa-member'),env.authenticatedContext('qa-owner'),env.authenticatedContext('qa-admin'),env.authenticatedContext('qa-ceo',{role:'ceo',organizationId:'qa-org-a'})];
  for(const actor of actors) for(const group of groups) {
    const db=actor.firestore(),ref=doc(db,group,'synthetic-private-record');
    await assertFails(getDoc(ref));await assertFails(getDocs(collection(db,group)));
    await assertFails(setDoc(doc(db,group,'synthetic-new-record'),{organizationId:'qa-org-a',actorUid:'qa-member'}));
    await assertFails(updateDoc(ref,{actorUid:'injected'}));await assertFails(deleteDoc(ref));checks+=5;
  }
  console.log('CONNECT_PRIVATE_STORE_RULES_CHECKS_PASSED='+checks);
} finally { await env.cleanup(); }
