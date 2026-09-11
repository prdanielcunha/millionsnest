import { after, before, test } from 'node:test';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc
} from 'firebase/firestore';
import { readFile } from 'node:fs/promises';

let env: RulesTestEnvironment;
const [firestoreHost, firestorePort] =
  (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8180').split(':');

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-millionsnest-connect-personal-vault-rules',
    firestore: {
      host: firestoreHost,
      port: Number(firestorePort),
      rules: await readFile('firestore.rules', 'utf8')
    }
  });

  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();

    await setDoc(doc(db, 'users/owner-1'), {
      email: 'owner@example.test',
      systemRole: 'user'
    });

    await setDoc(doc(db, 'users/other-1'), {
      email: 'other@example.test',
      systemRole: 'user'
    });

    await setDoc(doc(db, 'users/global-admin'), {
      email: 'admin@example.test',
      systemRole: 'global_admin'
    });

    await setDoc(doc(db, 'users/owner-1/connect/state/sources/source-1'), {
      sourceType: 'whatsapp_export',
      fileName: 'authorized-export.txt',
      ownerUid: 'owner-1'
    });
  });
});

after(async () => env.cleanup());

const sourcePath = 'users/owner-1/connect/state/sources/source-1';

test('Connect Personal Vault owner can read and update their own nested source', async () => {
  const db = env.authenticatedContext('owner-1').firestore();
  const sourceRef = doc(db, sourcePath);

  const snapshot = await assertSucceeds(getDoc(sourceRef));
  if (!snapshot.exists()) {
    throw new Error('Expected the owner source to exist');
  }

  await assertSucceeds(updateDoc(sourceRef, {
    fileName: 'authorized-export-renamed.txt'
  }));
});

test('Connect Personal Vault owner can create and delete their own nested source', async () => {
  const db = env.authenticatedContext('owner-1').firestore();
  const temporaryRef = doc(db, 'users/owner-1/connect/state/sources/source-temp');

  await assertSucceeds(setDoc(temporaryRef, {
    sourceType: 'whatsapp_export',
    ownerUid: 'owner-1'
  }));

  await assertSucceeds(deleteDoc(temporaryRef));
});

test('Connect Personal Vault owner can list only their own source collection', async () => {
  const db = env.authenticatedContext('owner-1').firestore();
  const snapshot = await assertSucceeds(
    getDocs(collection(db, 'users/owner-1/connect/state/sources'))
  );

  if (snapshot.size < 1) {
    throw new Error('Expected at least one owner-scoped Personal Vault source');
  }
});

test('another authenticated user cannot read or write the owner Personal Vault', async () => {
  const db = env.authenticatedContext('other-1').firestore();

  await assertFails(getDoc(doc(db, sourcePath)));
  await assertFails(setDoc(
    doc(db, 'users/owner-1/connect/state/sources/intruder-source'),
    { sourceType: 'whatsapp_export', ownerUid: 'other-1' }
  ));
  await assertFails(getDocs(collection(db, 'users/owner-1/connect/state/sources')));
});

test('unauthenticated clients cannot access the Connect Personal Vault', async () => {
  const db = env.unauthenticatedContext().firestore();

  await assertFails(getDoc(doc(db, sourcePath)));
  await assertFails(setDoc(
    doc(db, 'users/owner-1/connect/state/sources/anonymous-source'),
    { sourceType: 'whatsapp_export' }
  ));
});

test('global governance cannot bypass owner-only privacy for another user Personal Vault', async () => {
  const db = env.authenticatedContext('global-admin').firestore();

  await assertFails(getDoc(doc(db, sourcePath)));
  await assertFails(getDocs(collection(db, 'users/owner-1/connect/state/sources')));
  await assertFails(setDoc(
    doc(db, 'users/owner-1/connect/state/sources/admin-source'),
    { sourceType: 'whatsapp_export', ownerUid: 'global-admin' }
  ));
});
