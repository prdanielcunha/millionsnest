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
      ['leader-b', 'group_leader', ['unit-a'], {}],
      ['discipler-a', 'discipler', ['unit-a'], {}],
      ['admin-a', 'admin', ['unit-a'], {}],
      ['data-a', 'data_admin', ['unit-a'], {}],
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


test('explicit Casa roster stays private to its leader and scoped pastoral oversight', async () => {
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'organizations/org-a/products/raiz_e_mesa/groups/group-roster-a'), {
      organizationId: 'org-a', congregationId: 'unit-a', name: 'Casa A',
      leaderId: 'leader-a', capacity: 12, participants: 0, createdBy: 'leader-a',
    });
    await setDoc(doc(db, 'organizations/org-a/products/raiz_e_mesa/groups/group-roster-b'), {
      organizationId: 'org-a', congregationId: 'unit-a', name: 'Casa B',
      leaderId: 'leader-b', capacity: 12, participants: 0, createdBy: 'leader-b',
    });
  });

  const leaderDb = env.authenticatedContext('leader-a').firestore();
  const ownMembership = doc(leaderDb, 'organizations/org-a/products/raiz_e_mesa/groupMemberships/group-roster-a__person-a');
  await assertSucceeds(setDoc(ownMembership, {
    organizationId: 'org-a', congregationId: 'unit-a', groupId: 'group-roster-a',
    personId: 'person-a', personName: 'Person A', status: 'active',
    joinedAt: serverTimestamp(), joinedBy: 'leader-a', leftAt: null, leftBy: '',
  }));
  await assertSucceeds(getDoc(ownMembership));

  await assertFails(setDoc(
    doc(leaderDb, 'organizations/org-a/products/raiz_e_mesa/groupMemberships/group-roster-b__person-a'),
    {
      organizationId: 'org-a', congregationId: 'unit-a', groupId: 'group-roster-b',
      personId: 'person-a', personName: 'Person A', status: 'active',
      joinedAt: serverTimestamp(), joinedBy: 'leader-a', leftAt: null, leftBy: '',
    },
  ));
  await assertFails(updateDoc(
    doc(leaderDb, 'organizations/org-a/products/raiz_e_mesa/groups/group-roster-b'),
    { participants: 1 },
  ));

  const pastorDb = env.authenticatedContext('pastor-a').firestore();
  await assertSucceeds(getDoc(doc(
    pastorDb,
    'organizations/org-a/products/raiz_e_mesa/groupMemberships/group-roster-a__person-a',
  )));

  const otherLeaderDb = env.authenticatedContext('leader-b').firestore();
  await assertFails(getDoc(doc(
    otherLeaderDb,
    'organizations/org-a/products/raiz_e_mesa/groupMemberships/group-roster-a__person-a',
  )));
});

test('Casa membership lifecycle is status-based and cannot be hard-deleted', async () => {
  await env.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'organizations/org-a/products/raiz_e_mesa/groups/group-lifecycle'), {
      organizationId: 'org-a', congregationId: 'unit-a', name: 'Casa Lifecycle',
      leaderId: 'leader-a', capacity: 12, participants: 1, createdBy: 'leader-a',
    });
  });
  const db = env.authenticatedContext('leader-a').firestore();
  const ref = doc(db, 'organizations/org-a/products/raiz_e_mesa/groupMemberships/group-lifecycle__person-a');
  await assertSucceeds(setDoc(ref, {
    organizationId: 'org-a', congregationId: 'unit-a', groupId: 'group-lifecycle',
    personId: 'person-a', personName: 'Person A', status: 'active',
    joinedAt: serverTimestamp(), joinedBy: 'leader-a', leftAt: null, leftBy: '',
  }));
  await assertSucceeds(updateDoc(ref, {
    status: 'left', leftAt: serverTimestamp(), leftBy: 'leader-a',
  }));
  await assertFails(deleteDoc(ref));
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
    organizationId: 'org-a',
    congregationId: 'unit-a',
    playbookId: 'raiz_e_mesa_2026',
    status: 'active',
    startedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    createdBy: 'coord-a',
  }));

  const step = doc(db, 'organizations/org-a/products/raiz_e_mesa/implementationCycles/cycle-a/steps/prep.1');
  await assertSucceeds(setDoc(step, {
    organizationId: 'org-a',
    congregationId: 'unit-a',
    cycleId: 'cycle-a',
    playbookId: 'raiz_e_mesa_2026',
    key: 'prep.1',
    completedAt: serverTimestamp(),
    completedBy: 'coord-a',
  }));

  await assertFails(updateDoc(step, { key: 'prep.2' }));
  await assertFails(updateDoc(cycle, { status: 'completed' }));
});

test('implementation gate rejects invalid keys, cross-scope cycles and ordinary members', async () => {
  const coordDb = env.authenticatedContext('coord-a').firestore();
  const cycle = doc(coordDb, 'organizations/org-a/products/raiz_e_mesa/implementationCycles/cycle-b');
  await assertSucceeds(setDoc(cycle, {
    organizationId: 'org-a',
    congregationId: 'unit-a',
    playbookId: 'raiz_e_mesa_2026',
    status: 'active',
    startedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    createdBy: 'coord-a',
  }));

  await assertFails(setDoc(
    doc(coordDb, 'organizations/org-a/products/raiz_e_mesa/implementationCycles/cycle-b/steps/invented.step'),
    {
      organizationId: 'org-a',
      congregationId: 'unit-a',
      cycleId: 'cycle-b',
      playbookId: 'raiz_e_mesa_2026',
      key: 'invented.step',
      completedAt: serverTimestamp(),
      completedBy: 'coord-a',
    },
  ));

  await assertFails(setDoc(
    doc(coordDb, 'organizations/org-a/products/raiz_e_mesa/implementationCycles/cycle-outside'),
    {
      organizationId: 'org-a',
      congregationId: 'unit-b',
      playbookId: 'raiz_e_mesa_2026',
      status: 'active',
      startedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      createdBy: 'coord-a',
    },
  ));

  const memberDb = env.authenticatedContext('member-a').firestore();
  await assertFails(setDoc(
    doc(memberDb, 'organizations/org-a/products/raiz_e_mesa/implementationCycles/member-cycle'),
    {
      organizationId: 'org-a',
      congregationId: 'unit-a',
      playbookId: 'raiz_e_mesa_2026',
      status: 'active',
      startedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      createdBy: 'member-a',
    },
  ));
});


test('governance data admin can register a structured privacy request and append an audit event', async () => {
  const db = env.authenticatedContext('data-a').firestore();
  const requestRef = doc(db, 'organizations/org-a/products/raiz_e_mesa/retentionRequests/privacy-a');
  const auditRef = doc(db, 'organizations/org-a/products/raiz_e_mesa/audit/privacy-a');
  const batch = writeBatch(db);
  batch.set(requestRef, {
    organizationId: 'org-a',
    congregationId: 'unit-a',
    personId: 'person-a',
    personName: 'Person A',
    requestType: 'correction',
    targetField: 'phone',
    proposedValue: '43988888888',
    status: 'open',
    requestedAt: serverTimestamp(),
    requestedBy: 'data-a',
  });
  batch.set(auditRef, {
    organizationId: 'org-a',
    congregationId: 'unit-a',
    actorId: 'data-a',
    action: 'privacy.requested',
    targetRef: 'privacyRequest:privacy-a',
    subjectRef: 'person:person-a',
    requestType: 'correction',
    createdAt: serverTimestamp(),
  });
  await assertSucceeds(batch.commit());
  await assertSucceeds(getDoc(requestRef));
  await assertSucceeds(getDoc(auditRef));
  await assertFails(updateDoc(requestRef, { status: 'resolved' }));
  await assertFails(updateDoc(auditRef, { action: 'tampered' }));
});

test('governance gate rejects invalid correction fields and cross-scope privacy requests', async () => {
  const db = env.authenticatedContext('data-a').firestore();
  await assertFails(setDoc(
    doc(db, 'organizations/org-a/products/raiz_e_mesa/retentionRequests/privacy-invalid'),
    {
      organizationId: 'org-a',
      congregationId: 'unit-a',
      personId: 'person-a',
      personName: 'Person A',
      requestType: 'correction',
      targetField: 'private_notes',
      proposedValue: 'sensitive narrative',
      status: 'open',
      requestedAt: serverTimestamp(),
      requestedBy: 'data-a',
    },
  ));
  await assertFails(setDoc(
    doc(db, 'organizations/org-a/products/raiz_e_mesa/retentionRequests/privacy-outside'),
    {
      organizationId: 'org-a',
      congregationId: 'unit-b',
      personId: 'person-a',
      personName: 'Person A',
      requestType: 'retention_review',
      targetField: '',
      proposedValue: '',
      status: 'open',
      requestedAt: serverTimestamp(),
      requestedBy: 'data-a',
    },
  ));
});

test('pastor can view scoped governance audit but cannot read the privacy queue', async () => {
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'organizations/org-a/products/raiz_e_mesa/audit/governance-pastor'), {
      organizationId: 'org-a',
      congregationId: 'unit-a',
      actorId: 'data-a',
      action: 'privacy.requested',
      createdAt: new Date(),
    });
    await setDoc(doc(db, 'organizations/org-a/products/raiz_e_mesa/retentionRequests/governance-pastor'), {
      organizationId: 'org-a',
      congregationId: 'unit-a',
      personId: 'person-a',
      requestType: 'retention_review',
      targetField: '',
      proposedValue: '',
      status: 'open',
      requestedAt: new Date(),
      requestedBy: 'data-a',
    });
  });
  const db = env.authenticatedContext('pastor-a').firestore();
  await assertSucceeds(getDoc(doc(db, 'organizations/org-a/products/raiz_e_mesa/audit/governance-pastor')));
  await assertFails(getDoc(doc(db, 'organizations/org-a/products/raiz_e_mesa/retentionRequests/governance-pastor')));
});

test('ordinary operational members cannot create privacy-governance requests', async () => {
  const db = env.authenticatedContext('care-a').firestore();
  await assertFails(setDoc(
    doc(db, 'organizations/org-a/products/raiz_e_mesa/retentionRequests/privacy-care'),
    {
      organizationId: 'org-a',
      congregationId: 'unit-a',
      personId: 'person-a',
      personName: 'Person A',
      requestType: 'consent_revocation',
      targetField: '',
      proposedValue: '',
      status: 'open',
      requestedAt: serverTimestamp(),
      requestedBy: 'care-a',
    },
  ));
});


test('care handoff creates a restricted pastoral marker atomically without granting Care read access', async () => {
  const careDb = env.authenticatedContext('care-a').firestore();
  const careRef = doc(careDb, 'organizations/org-a/products/raiz_e_mesa/careRequests/pastoral-care');
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'organizations/org-a/products/raiz_e_mesa/careRequests/pastoral-care'), {
      organizationId: 'org-a', congregationId: 'unit-a', personId: 'person-a',
      careType: 'pastoral_contact', source: 'manual', summary: '', status: 'open',
      requestedAt: new Date(), requestedBy: 'care-a', promiseHours: 24,
      dueAt: new Date(Date.now() + 86400000), ownerRef: 'care-a',
      assignedAt: new Date(), assignedBy: 'care-a', resolvedAt: null, resolvedBy: '',
      resolutionCode: '', resolutionNote: '',
    });
  });
  const handoffRef = doc(careDb, 'organizations/org-a/products/raiz_e_mesa/pastoralHandoffs/pastoral-care');
  const batch = writeBatch(careDb);
  batch.update(careRef, {
    status: 'resolved', resolvedAt: serverTimestamp(), resolvedBy: 'care-a',
    resolutionCode: 'pastoral_handoff', resolutionNote: '',
  });
  batch.set(handoffRef, {
    organizationId: 'org-a', congregationId: 'unit-a', personId: 'person-a',
    sourceCareRequestId: 'pastoral-care', status: 'open',
    requestedAt: serverTimestamp(), requestedBy: 'care-a', resolvedAt: null, resolvedBy: '',
  });
  await assertSucceeds(batch.commit());
  await assertFails(getDoc(handoffRef));
});

test('pastoral markers cannot be invented independently of a matching Care handoff', async () => {
  const db = env.authenticatedContext('care-a').firestore();
  await assertFails(setDoc(
    doc(db, 'organizations/org-a/products/raiz_e_mesa/pastoralHandoffs/fake'),
    {
      organizationId: 'org-a', congregationId: 'unit-a', personId: 'person-a',
      sourceCareRequestId: 'fake', status: 'open',
      requestedAt: serverTimestamp(), requestedBy: 'care-a', resolvedAt: null, resolvedBy: '',
    },
  ));
});

test('pastor can read and resolve a scoped pastoral marker while ordinary admin cannot', async () => {
  await env.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'organizations/org-a/products/raiz_e_mesa/pastoralHandoffs/restricted-a'), {
      organizationId: 'org-a', congregationId: 'unit-a', personId: 'person-a',
      sourceCareRequestId: 'pastoral-care', status: 'open',
      requestedAt: new Date(), requestedBy: 'care-a', resolvedAt: null, resolvedBy: '',
    });
  });
  const pastorDb = env.authenticatedContext('pastor-a').firestore();
  const adminDb = env.authenticatedContext('admin-a').firestore();
  const pastorRef = doc(pastorDb, 'organizations/org-a/products/raiz_e_mesa/pastoralHandoffs/restricted-a');
  await assertSucceeds(getDoc(pastorRef));
  await assertFails(getDoc(doc(adminDb, 'organizations/org-a/products/raiz_e_mesa/pastoralHandoffs/restricted-a')));
  await assertSucceeds(updateDoc(pastorRef, {
    status: 'resolved', resolvedAt: serverTimestamp(), resolvedBy: 'pastor-a',
  }));
  await assertFails(updateDoc(pastorRef, { note: 'private narrative' }));
});
