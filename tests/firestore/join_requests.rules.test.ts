import { after, before, test } from 'node:test';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { readFile } from 'node:fs/promises';

let env: RulesTestEnvironment;
const [firestoreHost, firestorePort] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8180').split(':');
before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-millionsnest-rules-p0',
    firestore: { host: firestoreHost, port: Number(firestorePort), rules: await readFile('firestore.rules', 'utf8') }
  });
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await Promise.all([
      setDoc(doc(db, 'organizations/a'), { status: 'active' }),
      setDoc(doc(db, 'organizations/b'), { status: 'active' }),
      setDoc(doc(db, 'users/admin'), { systemRole: 'user' }),
      setDoc(doc(db, 'users/member'), { systemRole: 'user' }),
      setDoc(doc(db, 'users/requester'), { systemRole: 'user' }),
      setDoc(doc(db, 'organizations/a/members/admin'), { uid: 'admin', status: 'active', role: 'admin' }),
      setDoc(doc(db, 'organizations/a/members/member'), { uid: 'member', status: 'active', role: 'member' }),
      setDoc(doc(db, 'organizations/a/join_requests/requester'), { requesterUid: 'requester', organizationId: 'a', status: 'pending' })
    ]);
  });
});
after(async () => env.cleanup());

for (const uid of ['admin', 'member', 'requester']) {
  test(`${uid} cannot directly create, update, or delete join requests`, async () => {
    const db = env.authenticatedContext(uid).firestore();
    await assertFails(setDoc(doc(db, 'organizations/a/join_requests/new'), { status: 'pending' }));
    await assertFails(updateDoc(doc(db, 'organizations/a/join_requests/requester'), { status: 'approved' }));
    await assertFails(deleteDoc(doc(db, 'organizations/a/join_requests/requester')));
  });
}

test('canonical organization admin can read tenant request', async () => {
  await assertSucceeds(getDoc(doc(env.authenticatedContext('admin').firestore(), 'organizations/a/join_requests/requester')));
});

test('common member, requester, unauthenticated, and cross-tenant actors cannot read request', async () => {
  await assertFails(getDoc(doc(env.authenticatedContext('member').firestore(), 'organizations/a/join_requests/requester')));
  await assertFails(getDoc(doc(env.authenticatedContext('requester').firestore(), 'organizations/a/join_requests/requester')));
  await assertFails(getDoc(doc(env.authenticatedContext('outsider').firestore(), 'organizations/a/join_requests/requester')));
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'organizations/a/join_requests/requester')));
});
