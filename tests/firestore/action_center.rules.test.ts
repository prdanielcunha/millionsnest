import { after, before, test } from 'node:test';
import {
  assertFails,
  initializeTestEnvironment,
  type RulesTestEnvironment
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { readFile } from 'node:fs/promises';

let env: RulesTestEnvironment;
const [firestoreHost, firestorePort] =
  (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8180').split(':');

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-millionsnest-action-center-rules',
    firestore: {
      host: firestoreHost,
      port: Number(firestorePort),
      rules: await readFile('firestore.rules', 'utf8')
    }
  });

  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'organizations/org-1'), {
      status: 'active',
      ownerUid: 'owner-1'
    });
    await setDoc(doc(db, 'organizations/org-1/members/member-1'), {
      uid: 'member-1',
      status: 'active',
      role: 'member'
    });
    await setDoc(
      doc(db, 'organizations/org-1/actionCenterUsers/member-1/preferences/pref-1'),
      {
        dedupeKey: 'hub:pending_invites',
        fingerprint: 'hub:pending_invites:2',
        mode: 'dismissed'
      }
    );
  });
});

after(async () => env.cleanup());

for (const uid of ['member-1', 'owner-1', 'outsider']) {
  test(`${uid} cannot directly read or write Action OS preference documents`, async () => {
    const db = env.authenticatedContext(uid).firestore();
    const ref = doc(db, 'organizations/org-1/actionCenterUsers/member-1/preferences/pref-1');

    await assertFails(getDoc(ref));
    await assertFails(setDoc(ref, {
      dedupeKey: 'hub:pending_invites',
      fingerprint: 'hub:pending_invites:3',
      mode: 'dismissed'
    }));
  });
}

test('unauthenticated clients cannot access Action OS preference documents', async () => {
  const db = env.unauthenticatedContext().firestore();
  const ref = doc(db, 'organizations/org-1/actionCenterUsers/member-1/preferences/pref-1');
  await assertFails(getDoc(ref));
  await assertFails(setDoc(ref, { mode: 'dismissed' }));
});
