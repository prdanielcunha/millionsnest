import { after, before, test } from 'node:test';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  Timestamp,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { readFile } from 'node:fs/promises';

let env: RulesTestEnvironment;
const [firestoreHost, firestorePort] =
  (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8180').split(':');

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-millionsnest-nestjourney-gate',
    firestore: {
      host: firestoreHost,
      port: Number(firestorePort),
      rules: await readFile('firestore.rules', 'utf8'),
    },
  });

  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();

    await setDoc(doc(db, 'organizations/org-a'), {
      status: 'active',
      ownerUid: 'owner-a',
      apps: {
        musicscale: { status: 'active' },
        nestjourney: { status: 'active' },
      },
    });
    await setDoc(doc(db, 'organizations/org-b'), {
      status: 'active',
      ownerUid: 'owner-b',
      apps: {
        musicscale: { status: 'active' },
        nestjourney: { status: 'active' },
      },
    });
    await setDoc(doc(db, 'organizations/org-disabled'), {
      status: 'active',
      ownerUid: 'owner-disabled',
      apps: { musicscale: { status: 'active' }, nestjourney: { status: 'inactive' } },
    });

    const members = [
      ['member-a', 'member', ['unit-a'], {}],
      ['care-a', 'care', ['unit-a'], {}],
      ['coord-a', 'coordinator', ['unit-a'], { canManagePeople: true }],
      ['pastor-a', 'pastor', ['unit-a', 'unit-b'], {}],
      ['leader-a', 'group_leader', ['unit-a'], {}],
      ['discipler-a', 'discipler', ['unit-a'], {}],
    ] as const;

    for (const [uid, role, congregationIds, permissions] of members) {
      await setDoc(doc(db, `organizations/org-a/members/${uid}`), {
        uid, status: 'active', role, organizationRole: role, congregationIds, permissions,
      });
    }
    await setDoc(doc(db, 'organizations/org-b/members/member-b'), {
      uid: 'member-b', status: 'active', role: 'member', organizationRole: 'member', congregationIds: ['unit-b'],
    });
    await setDoc(doc(db, 'organizations/org-disabled/members/disabled-a'), {
      uid: 'disabled-a', status: 'active', role: 'pastor', organizationRole: 'pastor', congregationIds: ['unit-a'],
    });

    for (const unit of ['unit-a', 'unit-b']) {
      await setDoc(doc(db, `organizations/org-a/products/raiz_e_mesa/congregations/${unit}`), {
        organizationId: 'org-a', name: unit, active: true,
      });
    }
    await setDoc(doc(db, 'organizations/org-a/products/raiz_e_mesa/people/person-a'), {
      organizationId: 'org-a', congregationId: 'unit-a', name: 'Person A', consent: true, phone: '43999999999',
    });
    await setDoc(doc(db, 'organizations/org-a/products/raiz_e_mesa/people/person-b'), {
      organizationId: 'org-a', congregationId: 'unit-b', name: 'Person B', consent: true, phone: '43999999998',
    });
    await setDoc(doc(db, 'organizations/org-disabled/products/raiz_e_mesa/people/person-x'), {
      organizationId: 'org-disabled', congregationId: 'unit-a', name: 'Disabled',
    });
    await setDoc(doc(db, 'organizations/org-a/products/raiz_e_mesa/facts/fact-a'), {
      organizationId: 'org-a', eventType: 'VISITOR_REGISTERED',
    });
  });
});

after(async () => env.cleanup());

function careRequest(uid: string, source: 'manual' | 'visitor_registration' = 'manual') {
  const manual = source === 'manual';
  return {
    organizationId: 'org-a',
    congregationId: 'unit-a',
    personId: 'person-a',
    careType: 'first_contact',
    source,
    summary: '',
    status: 'open',
    requestedAt: serverTimestamp(),
    requestedBy: uid,
    promiseHours: 48,
    dueAt: Timestamp.fromMillis(Date.now() + 48 * 60 * 60 * 1000),
    ownerRef: manual ? uid : '',
    assignedAt: manual ? serverTimestamp() : null,
    assignedBy: manual ? uid : '',
    resolvedAt: null,
    resolvedBy: '',
    resolutionCode: '',
    resolutionNote: '',
  };
}

test('ordinary scoped member can read People but cannot mutate NestJourney People', async () => {
  const db = env.authenticatedContext('member-a').firestore();
  const ref = doc(db, 'organizations/org-a/products/raiz_e_mesa/people/person-a');
  await assertSucceeds(getDoc(ref));
  await assertFails(updateDoc(ref, { name: 'Tampered' }));
});

test('ordinary member cannot escape congregation scope', async () => {
  const db = env.authenticatedContext('member-a').firestore();
  await assertFails(getDoc(doc(db, 'organizations/org-a/products/raiz_e_mesa/people/person-b')));
});

test('generic products wildcard no longer grants manual Care writes to ordinary members', async () => {
  const db = env.authenticatedContext('member-a').firestore();
  await assertFails(setDoc(
    doc(db, 'organizations/org-a/products/raiz_e_mesa/careRequests/member-care'),
    careRequest('member-a'),
  ));
});

test('care capability can create and resolve its own Care Request', async () => {
  const db = env.authenticatedContext('care-a').firestore();
  const ref = doc(db, 'organizations/org-a/products/raiz_e_mesa/careRequests/care-a');
  await assertSucceeds(setDoc(ref, careRequest('care-a')));
  await assertSucceeds(updateDoc(ref, {
    status: 'resolved',
    resolvedAt: serverTimestamp(),
    resolvedBy: 'care-a',
    resolutionCode: 'contact_completed',
    resolutionNote: 'Completed',
  }));
});

test('People manager may create visitor-origin Care without gaining Care claim capability', async () => {
  const db = env.authenticatedContext('coord-a').firestore();
  const ref = doc(db, 'organizations/org-a/products/raiz_e_mesa/careRequests/visitor-care');
  await assertSucceeds(setDoc(ref, careRequest('coord-a', 'visitor_registration')));
  await assertFails(updateDoc(ref, {
    ownerRef: 'coord-a',
    assignedAt: serverTimestamp(),
    assignedBy: 'coord-a',
  }));
});

test('NestJourney entitlement is required even for a scoped operational member', async () => {
  const db = env.authenticatedContext('disabled-a').firestore();
  await assertFails(getDoc(doc(db, 'organizations/org-disabled/products/raiz_e_mesa/people/person-x')));
});

test('raw canonical facts remain hidden from operational roles and visible to Journey admin lens', async () => {
  const careDb = env.authenticatedContext('care-a').firestore();
  const pastorDb = env.authenticatedContext('pastor-a').firestore();
  const ref = doc(careDb, 'organizations/org-a/products/raiz_e_mesa/facts/fact-a');
  await assertFails(getDoc(ref));
  await assertSucceeds(getDoc(doc(pastorDb, 'organizations/org-a/products/raiz_e_mesa/facts/fact-a')));
});

test('other product namespaces preserve previous generic tenant behavior', async () => {
  const db = env.authenticatedContext('member-a').firestore();
  const ref = doc(db, 'organizations/org-a/products/example_product/state/example');
  await assertSucceeds(setDoc(ref, { organizationId: 'org-a', value: 1 }));
  await assertSucceeds(getDoc(ref));
});

test('Presence session plus canonical fact can be created atomically by scoped coordinator', async () => {
  const db = env.authenticatedContext('coord-a').firestore();
  const session = doc(db, 'organizations/org-a/products/raiz_e_mesa/presenceSessions/session-a');
  const fact = doc(db, 'organizations/org-a/products/raiz_e_mesa/facts/fact-session-a');
  const batch = writeBatch(db);
  batch.set(session, {
    organizationId: 'org-a', congregationId: 'unit-a', eventRef: 'event:session-a', eventName: 'Sunday',
    openedAt: serverTimestamp(), closedAt: null, status: 'open', expectedPeopleCount: 10,
    minimumCoveragePercent: 90, createdBy: 'coord-a',
  });
  batch.set(fact, {
    eventId: 'fact-session-a', eventType: 'PRESENCE_SESSION_OPENED',
    occurredAt: serverTimestamp(), recordedAt: serverTimestamp(),
    organizationId: 'org-a', actorId: 'coord-a', subjectRef: 'presenceSession:session-a',
    sourceApp: 'nestjourney', scope: 'congregation:unit-a',
    evidenceRef: 'presenceSession:session-a', sensitivity: 'internal', version: 1,
    payload: { sessionId: 'session-a' },
  });
  await assertSucceeds(batch.commit());
});


test('group leader can manage a valid group only inside assigned scope', async () => {
  const db = env.authenticatedContext('leader-a').firestore();
  const ref = doc(db, 'organizations/org-a/products/raiz_e_mesa/groups/group-a');
  await assertSucceeds(setDoc(ref, {
    organizationId: 'org-a', congregationId: 'unit-a', name: 'Casa Norte',
    capacity: 12, participants: 0, createdAt: serverTimestamp(), createdBy: 'leader-a',
  }));
  await assertSucceeds(updateDoc(ref, { participants: 8 }));
  await assertFails(updateDoc(ref, { participants: 13 }));
  await assertFails(setDoc(
    doc(db, 'organizations/org-a/products/raiz_e_mesa/groups/group-b'),
    { organizationId: 'org-a', congregationId: 'unit-b', name: 'Outside', capacity: 12, participants: 0 },
  ));
});

test('discipler relation is append-progressive and cannot be reassigned', async () => {
  const db = env.authenticatedContext('discipler-a').firestore();
  const ref = doc(db, 'organizations/org-a/products/raiz_e_mesa/discipleships/d-a');
  await assertSucceeds(setDoc(ref, {
    organizationId: 'org-a', congregationId: 'unit-a', personId: 'person-a',
    personName: 'Person A', disciplerId: 'discipler-a', meeting: 1,
    status: 'active', nextMeeting: 'Agendar encontro 1',
  }));
  await assertSucceeds(updateDoc(ref, { meeting: 2, nextMeeting: 'Agendar encontro 2' }));
  await assertFails(updateDoc(ref, { meeting: 1 }));
  await assertFails(updateDoc(ref, { personId: 'person-b' }));
  await assertFails(updateDoc(ref, { meeting: 7, status: 'completed' }));
});


test('implementation coordinator can start a cycle and append only canonical steps', async () => {
  const db = env.authenticatedContext('coord-a').firestore();
  const cycle = doc(db, 'organizations/org-a/products/raiz_e_mesa/implementationCycles/cycle-a');
  await assertSucceeds(setDoc(cycle, {
    organizationId: 'org-a', congregationId: 'unit-a', playbookId: 'raiz_e_mesa_2026',
    status: 'active', startedAt: serverTimestamp(), createdAt: serverTimestamp(), createdBy: 'coord-a',
  }));
  const step = doc(db, 'organizations/org-a/products/raiz_e_mesa/implementationCycles/cycle-a/steps/prep.1');
  await assertSucceeds(setDoc(step, {
    organizationId: 'org-a', congregationId: 'unit-a', cycleId: 'cycle-a', playbookId: 'raiz_e_mesa_2026',
    key: 'prep.1', completedAt: serverTimestamp(), completedBy: 'coord-a',
  }));
  await assertFails(updateDoc(step, { key: 'prep.2' }));
  await assertFails(updateDoc(cycle, { status: 'completed' }));
});

test('implementation gate rejects invalid keys, cross-scope cycles and ordinary members', async () => {
  const coordDb = env.authenticatedContext('coord-a').firestore();
  const cycle = doc(coordDb, 'organizations/org-a/products/raiz_e_mesa/implementationCycles/cycle-b');
  await assertSucceeds(setDoc(cycle, {
    organizationId: 'org-a', congregationId: 'unit-a', playbookId: 'raiz_e_mesa_2026',
    status: 'active', startedAt: serverTimestamp(), createdAt: serverTimestamp(), createdBy: 'coord-a',
  }));
  await assertFails(setDoc(doc(coordDb, 'organizations/org-a/products/raiz_e_mesa/implementationCycles/cycle-b/steps/invented.step'), {
    organizationId: 'org-a', congregationId: 'unit-a', cycleId: 'cycle-b', playbookId: 'raiz_e_mesa_2026',
    key: 'invented.step', completedAt: serverTimestamp(), completedBy: 'coord-a',
  }));
  await assertFails(setDoc(doc(coordDb, 'organizations/org-a/products/raiz_e_mesa/implementationCycles/cycle-outside'), {
    organizationId: 'org-a', congregationId: 'unit-b', playbookId: 'raiz_e_mesa_2026',
    status: 'active', startedAt: serverTimestamp(), createdAt: serverTimestamp(), createdBy: 'coord-a',
  }));
  const memberDb = env.authenticatedContext('member-a').firestore();
  await assertFails(setDoc(doc(memberDb, 'organizations/org-a/products/raiz_e_mesa/implementationCycles/member-cycle'), {
    organizationId: 'org-a', congregationId: 'unit-a', playbookId: 'raiz_e_mesa_2026',
    status: 'active', startedAt: serverTimestamp(), createdAt: serverTimestamp(), createdBy: 'member-a',
  }));
});
