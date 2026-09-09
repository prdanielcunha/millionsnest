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
  getDocs,
  query,
  setDoc,
  where
} from 'firebase/firestore';
import { readFile } from 'node:fs/promises';

let env: RulesTestEnvironment;
const [firestoreHost, firestorePort] =
  (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8180').split(':');

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-millionsnest-personal-response-rules',
    firestore: {
      host: firestoreHost,
      port: Number(firestorePort),
      rules: await readFile('firestore.rules', 'utf8')
    }
  });

  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();

    await setDoc(doc(db, 'scales/scale-1'), {
      organizationId: 'org-1',
      status: 'published'
    });

    await setDoc(doc(db, 'scales/scale-1/responses/response-member-1'), {
      organizationId: 'org-1',
      musicScaleId: 'scale-1',
      userId: 'member-1',
      eventAssignmentId: 'assignment-member-1',
      active: true,
      status: 'pending'
    });

    await setDoc(doc(db, 'scales/scale-1/responses/response-member-2'), {
      organizationId: 'org-1',
      musicScaleId: 'scale-1',
      userId: 'member-2',
      eventAssignmentId: 'assignment-member-2',
      active: true,
      status: 'accepted'
    });
  });
});

after(async () => env.cleanup());

test('a MusicScale user can query only their own response state', async () => {
  const db = env.authenticatedContext('member-1').firestore();

  const ownResponses = query(
    collection(db, 'scales/scale-1/responses'),
    where('userId', '==', 'member-1')
  );

  const snapshot = await assertSucceeds(getDocs(ownResponses));
  if (snapshot.size !== 1) {
    throw new Error(`Expected one personal response, got ${snapshot.size}`);
  }
});

test('a MusicScale user cannot query another person response state', async () => {
  const db = env.authenticatedContext('member-1').firestore();

  const otherResponses = query(
    collection(db, 'scales/scale-1/responses'),
    where('userId', '==', 'member-2')
  );

  await assertFails(getDocs(otherResponses));
});

test('unauthenticated clients cannot read response state', async () => {
  const db = env.unauthenticatedContext().firestore();

  const responses = query(
    collection(db, 'scales/scale-1/responses'),
    where('userId', '==', 'member-1')
  );

  await assertFails(getDocs(responses));
});
