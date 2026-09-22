import { after, before, beforeEach, test } from 'node:test';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { readFile } from 'node:fs/promises';

const projectId = 'demo-millionsnest-musicscale-live-rules';
const [firestoreHost, firestorePort] = (
  process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8180'
).split(':');

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
      setDoc(doc(db, 'organizations/org-a'), {
        name: 'Org A',
        ownerUid: 'owner-a',
        status: 'active',
      }),
      setDoc(doc(db, 'organizations/org-b'), {
        name: 'Org B',
        ownerUid: 'owner-b',
        status: 'active',
      }),
      setDoc(doc(db, 'users/owner-a'), { systemRole: 'user' }),
      setDoc(doc(db, 'users/admin-a'), { systemRole: 'user' }),
      setDoc(doc(db, 'users/operator-a'), { systemRole: 'user' }),
      setDoc(doc(db, 'users/viewer-a'), { systemRole: 'user' }),
      setDoc(doc(db, 'users/inactive-a'), { systemRole: 'user' }),
      setDoc(doc(db, 'users/automation-a'), { systemRole: 'user' }),
      setDoc(doc(db, 'users/leader-a'), { systemRole: 'user' }),
      setDoc(doc(db, 'users/other-b'), { systemRole: 'user' }),
      setDoc(doc(db, 'users/ceo-user'), { systemRole: 'ceo' }),

      setDoc(doc(db, 'organizations/org-a/members/admin-a'), {
        uid: 'admin-a',
        organizationId: 'org-a',
        status: 'active',
        organizationRole: 'admin',
      }),
      setDoc(doc(db, 'organizations/org-a/members/operator-a'), {
        uid: 'operator-a',
        organizationId: 'org-a',
        status: 'active',
        organizationRole: 'member',
        permissions: {
          'musicscale.live.conduct': true,
        },
      }),
      setDoc(doc(db, 'organizations/org-a/members/viewer-a'), {
        uid: 'viewer-a',
        organizationId: 'org-a',
        status: 'active',
        organizationRole: 'member',
      }),
      setDoc(doc(db, 'organizations/org-a/members/inactive-a'), {
        uid: 'inactive-a',
        organizationId: 'org-a',
        status: 'inactive',
        organizationRole: 'admin',
        permissions: {
          'musicscale.live.conduct': true,
          'musicscale.live.configure': true,
        },
      }),
      setDoc(doc(db, 'organizations/org-a/members/automation-a'), {
        uid: 'automation-a',
        organizationId: 'org-a',
        status: 'active',
        organizationRole: 'member',
        permissions: {
          'musicscale.live.automation.manage': true,
        },
      }),
      setDoc(doc(db, 'organizations/org-a/members/leader-a'), {
        uid: 'leader-a',
        organizationId: 'org-a',
        status: 'active',
        organizationRole: 'worship_leader',
      }),
      setDoc(doc(db, 'organizations/org-b/members/other-b'), {
        uid: 'other-b',
        organizationId: 'org-b',
        status: 'active',
        organizationRole: 'admin',
      }),

      setDoc(doc(db, 'musicScaleLiveVenues/venue-a'), {
        organizationId: 'org-a',
        name: 'Main sanctuary',
        timeZone: 'America/Sao_Paulo',
        active: true,
      }),
      setDoc(doc(db, 'musicScaleLiveVenues/venue-b'), {
        organizationId: 'org-b',
        name: 'Other sanctuary',
        timeZone: 'America/Sao_Paulo',
        active: true,
      }),
      setDoc(doc(db, 'musicScaleLiveRequests/request-a'), {
        id: 'request-a',
        organizationId: 'org-a',
        venueId: 'venue-a',
        liveSessionId: 'session-a',
        actorId: 'viewer-a',
        kind: 'bible',
        payload: { reference: 'João 3:16' },
        status: 'pending',
        createdAt: '2026-09-22T18:00:00.000Z',
      }),
      setDoc(doc(db, 'musicScaleLiveEvents/event-a'), {
        id: 'event-a',
        organizationId: 'org-a',
        venueId: 'venue-a',
        liveSystemId: 'system-a',
        liveSessionId: 'session-a',
        actorId: 'operator-a',
        type: 'take',
        occurredAt: '2026-09-22T18:00:00.000Z',
        source: 'live-ui',
        payload: {},
      }),
    ]);
  });
});

function dbFor(uid: string) {
  return testEnvironment.authenticatedContext(uid).firestore();
}

test('active tenant member can read own Live configuration but not another tenant', async () => {
  const db = dbFor('viewer-a');

  await assertSucceeds(getDoc(doc(db, 'musicScaleLiveVenues/venue-a')));
  await assertFails(getDoc(doc(db, 'musicScaleLiveVenues/venue-b')));

  await assertSucceeds(
    getDocs(
      query(
        collection(db, 'musicScaleLiveVenues'),
        where('organizationId', '==', 'org-a'),
      ),
    ),
  );
});

test('unauthenticated users cannot read Live configuration', async () => {
  const db = testEnvironment.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(db, 'musicScaleLiveVenues/venue-a')));
});

test('admin, owner and global CEO can configure Live resources while ordinary member cannot', async () => {
  const admin = dbFor('admin-a');
  const owner = dbFor('owner-a');
  const viewer = dbFor('viewer-a');
  const ceo = dbFor('ceo-user');

  const venue = (organizationId: string, name: string) => ({
    organizationId,
    name,
    timeZone: 'America/Sao_Paulo',
    active: true,
  });

  await assertSucceeds(
    setDoc(doc(admin, 'musicScaleLiveVenues/admin-created'), venue('org-a', 'Admin room')),
  );
  await assertSucceeds(
    setDoc(doc(owner, 'musicScaleLiveSystems/owner-system'), {
      organizationId: 'org-a',
      venueId: 'venue-a',
      name: 'Owner system',
      activeProfileId: null,
    }),
  );
  await assertSucceeds(
    setDoc(doc(ceo, 'musicScaleLiveVenues/ceo-created'), venue('org-b', 'CEO room')),
  );
  await assertFails(
    setDoc(doc(viewer, 'musicScaleLiveVenues/viewer-denied'), venue('org-a', 'Denied')),
  );
});

test('conductor permission can prepare service plans without gaining system configuration authority', async () => {
  const operator = dbFor('operator-a');

  await assertSucceeds(
    setDoc(doc(operator, 'musicScaleLiveServicePlans/plan-a'), {
      id: 'plan-a',
      organizationId: 'org-a',
      venueId: 'venue-a',
      liveSystemId: 'system-a',
      title: 'Sunday',
      scheduledAt: '2026-09-27T19:00:00-03:00',
      items: [],
      revision: 1,
    }),
  );

  await assertFails(
    setDoc(doc(operator, 'musicScaleLiveSystems/system-denied'), {
      organizationId: 'org-a',
      venueId: 'venue-a',
      name: 'Denied system config',
      activeProfileId: null,
    }),
  );
});

test('recognized worship leadership roles can save scenes', async () => {
  const leader = dbFor('leader-a');

  await assertSucceeds(
    setDoc(doc(leader, 'musicScaleLiveScenes/scene-a'), {
      id: 'scene-a',
      organizationId: 'org-a',
      venueId: 'venue-a',
      liveSystemId: 'system-a',
      name: 'Pregação',
      actions: [],
    }),
  );
});

test('automation management is narrower than ordinary conduct permission', async () => {
  const operator = dbFor('operator-a');
  const automation = dbFor('automation-a');
  const admin = dbFor('admin-a');

  const rule = {
    id: 'auto-a',
    organizationId: 'org-a',
    venueId: 'venue-a',
    name: 'Auto',
    enabled: false,
    trigger: 'manual',
    conditions: [],
    actions: [],
  };

  await assertFails(
    setDoc(doc(operator, 'musicScaleLiveAutomations/operator-denied'), rule),
  );
  await assertSucceeds(
    setDoc(doc(automation, 'musicScaleLiveAutomations/automation-allowed'), {
      ...rule,
      id: 'automation-allowed',
    }),
  );
  await assertSucceeds(
    setDoc(doc(admin, 'musicScaleLiveAutomations/admin-allowed'), {
      ...rule,
      id: 'admin-allowed',
    }),
  );
});

test('active member can create only their own pending Live request', async () => {
  const viewer = dbFor('viewer-a');

  const request = {
    id: 'request-own',
    organizationId: 'org-a',
    venueId: 'venue-a',
    liveSessionId: 'session-a',
    actorId: 'viewer-a',
    kind: 'message',
    payload: { text: 'Voltar ao refrão' },
    status: 'pending',
    createdAt: '2026-09-22T18:05:00.000Z',
  };

  await assertSucceeds(
    setDoc(doc(viewer, 'musicScaleLiveRequests/request-own'), request),
  );
  await assertFails(
    setDoc(doc(viewer, 'musicScaleLiveRequests/request-spoof'), {
      ...request,
      id: 'request-spoof',
      actorId: 'operator-a',
    }),
  );
  await assertFails(
    setDoc(doc(viewer, 'musicScaleLiveRequests/request-preapproved'), {
      ...request,
      id: 'request-preapproved',
      status: 'accepted',
    }),
  );
});

test('requester cannot self-approve, conductor can resolve, and request identity is immutable', async () => {
  const viewer = dbFor('viewer-a');
  const operator = dbFor('operator-a');

  await assertFails(
    updateDoc(doc(viewer, 'musicScaleLiveRequests/request-a'), {
      status: 'accepted',
      resolvedBy: 'viewer-a',
    }),
  );

  await assertSucceeds(
    updateDoc(doc(operator, 'musicScaleLiveRequests/request-a'), {
      status: 'accepted',
      updatedAt: '2026-09-22T18:06:00.000Z',
      resolvedAt: null,
      resolvedBy: 'operator-a',
    }),
  );

  await assertFails(
    updateDoc(doc(operator, 'musicScaleLiveRequests/request-a'), {
      payload: { reference: 'Romanos 8:1' },
      status: 'completed',
      resolvedBy: 'operator-a',
    }),
  );
});

test('Live events are append-only and require conductor authority', async () => {
  const operator = dbFor('operator-a');
  const viewer = dbFor('viewer-a');

  const event = {
    id: 'event-new',
    organizationId: 'org-a',
    venueId: 'venue-a',
    liveSystemId: 'system-a',
    liveSessionId: 'session-a',
    actorId: 'operator-a',
    type: 'take',
    occurredAt: '2026-09-22T18:10:00.000Z',
    source: 'live-ui',
    payload: { sceneId: 'scene-a' },
  };

  await assertSucceeds(
    setDoc(doc(operator, 'musicScaleLiveEvents/event-new'), event),
  );
  await assertFails(
    setDoc(doc(viewer, 'musicScaleLiveEvents/event-viewer'), {
      ...event,
      id: 'event-viewer',
      actorId: 'viewer-a',
    }),
  );
  await assertFails(
    updateDoc(doc(operator, 'musicScaleLiveEvents/event-a'), {
      type: 'rewritten',
    }),
  );
});

test('tenant identity cannot be moved during updates', async () => {
  const admin = dbFor('admin-a');

  await assertFails(
    updateDoc(doc(admin, 'musicScaleLiveVenues/venue-a'), {
      organizationId: 'org-b',
    }),
  );
});

test('inactive membership cannot use Live even with privileged role and permissions', async () => {
  const inactive = dbFor('inactive-a');

  await assertFails(getDoc(doc(inactive, 'musicScaleLiveVenues/venue-a')));
  await assertFails(
    setDoc(doc(inactive, 'musicScaleLiveServicePlans/inactive-plan'), {
      id: 'inactive-plan',
      organizationId: 'org-a',
      venueId: 'venue-a',
      liveSystemId: 'system-a',
      title: 'Denied',
      scheduledAt: '2026-09-27T19:00:00-03:00',
      items: [],
      revision: 1,
    }),
  );
});

test('global CEO access is not coupled to local membership', async () => {
  const ceo = dbFor('ceo-user');

  await assertSucceeds(getDoc(doc(ceo, 'musicScaleLiveVenues/venue-a')));
  await assertSucceeds(getDoc(doc(ceo, 'musicScaleLiveVenues/venue-b')));
  await assertSucceeds(
    setDoc(doc(ceo, 'musicScaleLiveAutomations/global-automation'), {
      id: 'global-automation',
      organizationId: 'org-b',
      venueId: 'venue-b',
      name: 'Global',
      enabled: false,
      trigger: 'manual',
      conditions: [],
      actions: [],
    }),
  );
});
