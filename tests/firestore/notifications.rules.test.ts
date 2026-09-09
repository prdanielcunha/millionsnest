import { after, before, test } from 'node:test';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment
} from '@firebase/rules-unit-testing';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where
} from 'firebase/firestore';
import { readFile } from 'node:fs/promises';

let env: RulesTestEnvironment;
const [firestoreHost, firestorePort] =
  (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8180').split(':');

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-millionsnest-notification-rules',
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

    await setDoc(doc(db, 'organizations/org-1/members/member-2'), {
      uid: 'member-2',
      status: 'active',
      role: 'member'
    });

    await setDoc(doc(db, 'organizations/org-1/notifications/notif-1'), {
      organizationId: 'org-1',
      recipientId: 'member-1',
      type: 'music_scale_changed',
      title: 'Sua escala mudou',
      message: 'Revise a mudança.',
      isRead: false,
      isArchived: false
    });

    await setDoc(doc(db, 'organizations/org-1/notifications/notif-2'), {
      organizationId: 'org-1',
      recipientId: 'member-2',
      type: 'music_scale_changed',
      title: 'Outra notificação',
      message: 'Somente member-2.',
      isRead: false,
      isArchived: false
    });
  });
});

after(async () => env.cleanup());

test('recipient can read their own notification', async () => {
  const db = env.authenticatedContext('member-1').firestore();
  await assertSucceeds(
    getDoc(doc(db, 'organizations/org-1/notifications/notif-1'))
  );
});

test('active member cannot read another member notification', async () => {
  const db = env.authenticatedContext('member-2').firestore();
  await assertFails(
    getDoc(doc(db, 'organizations/org-1/notifications/notif-1'))
  );
});

test('recipient-scoped query returns only own notifications', async () => {
  const db = env.authenticatedContext('member-1').firestore();
  const own = query(
    collection(db, 'organizations/org-1/notifications'),
    where('recipientId', '==', 'member-1')
  );

  const snapshot = await assertSucceeds(getDocs(own));
  if (snapshot.size !== 1) {
    throw new Error(`Expected 1 personal notification, got ${snapshot.size}`);
  }
});

test('tenant-wide query without recipient constraint is denied', async () => {
  const db = env.authenticatedContext('member-1').firestore();
  await assertFails(
    getDocs(collection(db, 'organizations/org-1/notifications'))
  );
});

test('recipient can update only read/archive interaction fields', async () => {
  const db = env.authenticatedContext('member-1').firestore();
  const ref = doc(db, 'organizations/org-1/notifications/notif-1');

  await assertSucceeds(updateDoc(ref, {
    isRead: true,
    readAt: '2026-09-09T10:00:00.000Z'
  }));

  await assertFails(updateDoc(ref, {
    recipientId: 'member-2'
  }));
});

test('another active member cannot mutate the recipient notification', async () => {
  const db = env.authenticatedContext('member-2').firestore();
  await assertFails(
    updateDoc(
      doc(db, 'organizations/org-1/notifications/notif-1'),
      { isRead: true }
    )
  );
});

test('unauthenticated clients cannot read notifications', async () => {
  const db = env.unauthenticatedContext().firestore();
  await assertFails(
    getDoc(doc(db, 'organizations/org-1/notifications/notif-1'))
  );
});
