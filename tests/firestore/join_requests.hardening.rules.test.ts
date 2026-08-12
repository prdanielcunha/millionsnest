import { after, before, test } from 'node:test';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore';
import { readFile } from 'node:fs/promises';

let env: RulesTestEnvironment;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-millionsnest-rules-p0',
    firestore: {
      host: '127.0.0.1',
      port: 8080,
      rules: await readFile('firestore.rules', 'utf8')
    }
  });
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await Promise.all([
      setDoc(doc(db, 'organizations/a'), { status: 'active' }),
      setDoc(doc(db, 'users/admin'), { systemRole: 'user' }),
      setDoc(doc(db, 'users/member'), { systemRole: 'user' }),
      setDoc(doc(db, 'users/ceo'), { systemRole: 'ceo' }),
      setDoc(doc(db, 'users/global-admin'), { systemRole: 'global_admin' }),
      setDoc(doc(db, 'users/ecosystem-owner'), { systemRole: 'ecosystem_owner' }),
      setDoc(doc(db, 'users/founder'), { systemRole: 'founder' }),
      setDoc(doc(db, 'users/system-admin'), { systemRole: 'admin' }),
      setDoc(doc(db, 'users/global-support'), { systemRole: 'global_support' }),
      setDoc(doc(db, 'users/ecosystem-support'), { systemRole: 'ecosystem_support' }),
      setDoc(doc(db, 'organizations/a/members/admin'), { uid: 'admin', status: 'active', role: 'admin' }),
      setDoc(doc(db, 'organizations/a/members/member'), { uid: 'member', status: 'active', role: 'member' }),
      setDoc(doc(db, 'organizations/a/join_requests/requester'), { requesterUid: 'requester', organizationId: 'a', status: 'pending' })
    ]);
  });
});

after(async () => env.cleanup());

test('canonical tenant admin can get and list join requests', async () => {
  const db = env.authenticatedContext('admin').firestore();
  await assertSucceeds(getDoc(doc(db, 'organizations/a/join_requests/requester')));
  await assertSucceeds(getDocs(collection(db, 'organizations/a/join_requests')));
});

for (const uid of ['ceo', 'global-admin', 'ecosystem-owner', 'founder']) {
  test(`${uid} exact canonical global can get and list join requests but cannot mutate`, async () => {
    const db = env.authenticatedContext(uid).firestore();
    await assertSucceeds(getDoc(doc(db, 'organizations/a/join_requests/requester')));
    await assertSucceeds(getDocs(collection(db, 'organizations/a/join_requests')));
    await assertFails(setDoc(doc(db, 'organizations/a/join_requests/new'), { status: 'pending' }));
    await assertFails(updateDoc(doc(db, 'organizations/a/join_requests/requester'), { status: 'approved' }));
    await assertFails(deleteDoc(doc(db, 'organizations/a/join_requests/requester')));
  });
}

for (const uid of ['member', 'system-admin', 'global-support', 'ecosystem-support', 'outsider']) {
  test(`${uid} cannot read or directly mutate join requests`, async () => {
    const db = env.authenticatedContext(uid).firestore();
    await assertFails(getDoc(doc(db, 'organizations/a/join_requests/requester')));
    await assertFails(setDoc(doc(db, 'organizations/a/join_requests/new'), { status: 'pending' }));
    await assertFails(updateDoc(doc(db, 'organizations/a/join_requests/requester'), { status: 'approved' }));
    await assertFails(deleteDoc(doc(db, 'organizations/a/join_requests/requester')));
  });
}

test('unauthenticated client cannot read or mutate join requests', async () => {
  const db = env.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(db, 'organizations/a/join_requests/requester')));
  await assertFails(setDoc(doc(db, 'organizations/a/join_requests/new'), { status: 'pending' }));
});