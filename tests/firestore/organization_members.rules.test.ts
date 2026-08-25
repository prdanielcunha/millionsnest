import { after, before, beforeEach, test } from 'node:test';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { readFile } from 'node:fs/promises';

const projectId = 'demo-millionsnest-rules-p0';
const [firestoreHost, firestorePort] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8180').split(':');
let testEnvironment: RulesTestEnvironment;

before(async () => {
  testEnvironment = await initializeTestEnvironment({
    projectId,
    firestore: {
      host: firestoreHost,
      port: Number(firestorePort),
      rules: await readFile('firestore.rules', 'utf8'),
    },
  });
});

after(async () => {
  await testEnvironment.cleanup();
});

beforeEach(async () => {
  await testEnvironment.clearFirestore();
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();

    await Promise.all([
      setDoc(doc(db, 'organizations/tenant-a'), { ownerUid: 'tenant-owner' }),
      setDoc(doc(db, 'organizations/tenant-b'), { ownerUid: 'other-owner' }),
      setDoc(doc(db, 'users/ordinary'), { systemRole: 'user' }),
      setDoc(doc(db, 'users/tenant-owner'), { systemRole: 'user' }),
      setDoc(doc(db, 'users/tenant-admin'), { systemRole: 'user' }),
      setDoc(doc(db, 'users/system-admin'), { systemRole: 'admin' }),
      setDoc(doc(db, 'users/ceo-user'), { systemRole: 'ceo' }),
      setDoc(doc(db, 'users/global-admin-user'), { systemRole: 'global_admin' }),
      setDoc(doc(db, 'users/ecosystem-owner-user'), { systemRole: 'ecosystem_owner' }),
      setDoc(doc(db, 'users/founder-user'), { systemRole: 'founder' }),
      setDoc(doc(db, 'organization_members/ordinary_tenant-a'), {
        uid: 'ordinary',
        organizationId: 'tenant-a',
        role: 'member',
      }),
      setDoc(doc(db, 'organization_members/tenant-a_ordinary'), {
        uid: 'ordinary',
        organizationId: 'tenant-a',
        role: 'member',
      }),
      setDoc(doc(db, 'organization_members/tenant-admin_tenant-a'), {
        uid: 'tenant-admin',
        organizationId: 'tenant-a',
        role: 'admin',
      }),
      setDoc(doc(db, 'organization_members/other-user_tenant-a'), {
        uid: 'other-user',
        organizationId: 'tenant-a',
        role: 'member',
      }),
      setDoc(doc(db, 'organization_members/other-user_tenant-b'), {
        uid: 'other-user',
        organizationId: 'tenant-b',
        role: 'member',
      }),
      setDoc(doc(db, 'organization_members/tenant-b_other-user'), {
        uid: 'other-user',
        organizationId: 'tenant-b',
        role: 'member',
      }),
    ]);
  });
});

function legacyCollection(uid?: string) {
  return collection(
    uid ? testEnvironment.authenticatedContext(uid).firestore() : testEnvironment.unauthenticatedContext().firestore(),
    'organization_members',
  );
}

test('unauthenticated global list is denied', async () => {
  await assertFails(getDocs(legacyCollection()));
});

for (const [label, uid] of [
  ['ordinary authenticated user', 'ordinary'],
  ['tenant owner', 'tenant-owner'],
  ['tenant admin', 'tenant-admin'],
  ['systemRole admin', 'system-admin'],
] as const) {
  test(`${label} global list is denied`, async () => {
    await assertFails(getDocs(legacyCollection(uid)));
  });
}

for (const [label, uid] of [
  ['ceo', 'ceo-user'],
  ['global_admin', 'global-admin-user'],
  ['ecosystem_owner', 'ecosystem-owner-user'],
  ['founder', 'founder-user'],
] as const) {
  test(`${label} global list is allowed`, async () => {
    await assertSucceeds(getDocs(legacyCollection(uid)));
  });
}

test('own legacy GET remains allowed for uid_orgId IDs', async () => {
  const db = testEnvironment.authenticatedContext('ordinary').firestore();
  await assertSucceeds(getDoc(doc(db, 'organization_members/ordinary_tenant-a')));
});

test('own legacy GET remains allowed for orgId_uid IDs', async () => {
  const db = testEnvironment.authenticatedContext('ordinary').firestore();
  await assertSucceeds(getDoc(doc(db, 'organization_members/tenant-a_ordinary')));
});

test('same-tenant legacy GET remains allowed by the existing owner contract', async () => {
  const db = testEnvironment.authenticatedContext('tenant-owner').firestore();
  await assertSucceeds(getDoc(doc(db, 'organization_members/other-user_tenant-a')));
});

test('cross-tenant GET remains denied for uid_orgId IDs', async () => {
  const db = testEnvironment.authenticatedContext('ordinary').firestore();
  await assertFails(getDoc(doc(db, 'organization_members/other-user_tenant-b')));
});

test('cross-tenant GET remains denied for orgId_uid IDs', async () => {
  const db = testEnvironment.authenticatedContext('ordinary').firestore();
  await assertFails(getDoc(doc(db, 'organization_members/tenant-b_other-user')));
});

test('create privilege escalation remains denied', async () => {
  const db = testEnvironment.authenticatedContext('ordinary').firestore();
  await assertFails(setDoc(doc(db, 'organization_members/ordinary_tenant-b'), {
    uid: 'ordinary',
    organizationId: 'tenant-b',
    role: 'owner',
  }));
});

test('update privilege escalation remains denied', async () => {
  const db = testEnvironment.authenticatedContext('ordinary').firestore();
  await assertFails(updateDoc(doc(db, 'organization_members/ordinary_tenant-a'), { role: 'owner' }));
});

test('delete privilege escalation remains denied', async () => {
  const db = testEnvironment.authenticatedContext('ordinary').firestore();
  await assertFails(deleteDoc(doc(db, 'organization_members/ordinary_tenant-a')));
});
