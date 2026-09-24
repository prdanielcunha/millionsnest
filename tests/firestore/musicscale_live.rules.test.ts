import { after, before, beforeEach, test } from 'node:test';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { readFile } from 'node:fs/promises';

const projectId = 'demo-millionsnest-musicscale-live-rules';
const [firestoreHost, firestorePort] =
  (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8180').split(':');

let env: RulesTestEnvironment;

before(async () => {
  env = await initializeTestEnvironment({
    projectId,
    firestore: {
      host: firestoreHost,
      port: Number(firestorePort),
      rules: await readFile('firestore.rules', 'utf8'),
    },
  });
});

after(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();

    await Promise.all([
      setDoc(doc(db, 'organizations/org-a'), {
        ownerUid: 'owner-a',
        status: 'active',
        apps: { musicscale: { status: 'active' } },
      }),
      setDoc(doc(db, 'organizations/org-b'), {
        ownerUid: 'owner-b',
        status: 'active',
        apps: { musicscale: { status: 'active' } },
      }),
      setDoc(doc(db, 'subscriptions/org-a'), {
        organizationId: 'org-a',
        status: 'active',
      }),
      setDoc(doc(db, 'subscriptions/org-b'), {
        organizationId: 'org-b',
        status: 'active',
      }),
      setDoc(doc(db, 'users/owner-a'), { systemRole: 'user' }),
      setDoc(doc(db, 'users/owner-b'), { systemRole: 'user' }),
      setDoc(doc(db, 'users/operator-a'), { systemRole: 'user' }),
      setDoc(doc(db, 'users/viewer-a'), { systemRole: 'user' }),
      setDoc(doc(db, 'users/admin-a'), { systemRole: 'user' }),
      setDoc(doc(db, 'users/other-b'), { systemRole: 'user' }),
      setDoc(doc(db, 'users/ceo-user'), { systemRole: 'ceo' }),
      setDoc(doc(db, 'organizations/org-a/members/operator-a'), {
        uid: 'operator-a',
        organizationId: 'org-a',
        status: 'active',
        role: 'member',
        organizationRole: 'member',
        permissions: {
          'musicscale.live.conduct': true,
        },
      }),
      setDoc(doc(db, 'organizations/org-a/members/viewer-a'), {
        uid: 'viewer-a',
        organizationId: 'org-a',
        status: 'active',
        role: 'member',
        organizationRole: 'member',
        permissions: {},
      }),
      setDoc(doc(db, 'organizations/org-a/members/admin-a'), {
        uid: 'admin-a',
        organizationId: 'org-a',
        status: 'active',
        role: 'admin',
        organizationRole: 'admin',
        permissions: {},
      }),
      setDoc(doc(db, 'organizations/org-b/members/other-b'), {
        uid: 'other-b',
        organizationId: 'org-b',
        status: 'active',
        role: 'member',
        organizationRole: 'member',
        permissions: {
          'musicscale.live.conduct': true,
        },
      }),
      setDoc(doc(db, 'musicScaleLiveVenues/venue-a'), {
        organizationId: 'org-a',
        name: 'Main',
        active: true,
      }),
      setDoc(doc(db, 'musicScaleLiveVenues/venue-b'), {
        organizationId: 'org-b',
        name: 'Other',
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
        createdAt: '2026-09-24T09:00:00.000Z',
      }),
    ]);
  });
});

test('active member reads same-tenant Live config but not another tenant', async () => {
  const db = env.authenticatedContext('viewer-a').firestore();

  await assertSucceeds(getDoc(doc(db, 'musicScaleLiveVenues/venue-a')));
  await assertFails(getDoc(doc(db, 'musicScaleLiveVenues/venue-b')));
});

test('configuration stays admin/configure-only', async () => {
  const admin = env.authenticatedContext('admin-a').firestore();
  const operator = env.authenticatedContext('operator-a').firestore();

  await assertSucceeds(setDoc(doc(admin, 'musicScaleLiveSystems/system-a'), {
    id: 'system-a',
    organizationId: 'org-a',
    venueId: 'venue-a',
    name: 'Main system',
  }));

  await assertFails(setDoc(doc(operator, 'musicScaleLiveSystems/system-denied'), {
    id: 'system-denied',
    organizationId: 'org-a',
    venueId: 'venue-a',
    name: 'Denied',
  }));
});

test('conductor can sync plans/scenes but viewer cannot', async () => {
  const operator = env.authenticatedContext('operator-a').firestore();
  const viewer = env.authenticatedContext('viewer-a').firestore();

  const plan = {
    id: 'plan-a',
    organizationId: 'org-a',
    venueId: 'venue-a',
    liveSystemId: 'system-a',
    title: 'Sunday',
    scheduledAt: '2026-09-27T19:00:00-03:00',
    items: [],
    revision: 1,
    _sync: {
      version: 'v1',
      mutationId: 'mutation-a',
      actorId: 'operator-a',
      origin: 'studio',
      updatedAt: '2026-09-24T09:00:00.000Z',
    },
  };

  await assertSucceeds(setDoc(
    doc(operator, 'musicScaleLiveServicePlans/plan-a'),
    plan,
  ));
  await assertFails(setDoc(
    doc(viewer, 'musicScaleLiveServicePlans/plan-viewer'),
    { ...plan, id: 'plan-viewer' },
  ));

  await assertSucceeds(setDoc(doc(operator, 'musicScaleLiveScenes/scene-a'), {
    id: 'scene-a',
    organizationId: 'org-a',
    venueId: 'venue-a',
    liveSystemId: 'system-a',
    name: 'Pregação',
    actions: [],
  }));
});

test('provider tokens and nested history payload secrets are rejected', async () => {
  const operator = env.authenticatedContext('operator-a').firestore();

  await assertFails(setDoc(doc(operator, 'musicScaleLiveProviderLinks/link-secret'), {
    id: 'link-secret',
    organizationId: 'org-a',
    venueId: 'venue-a',
    providerInstanceId: 'holyrics-primary',
    entityType: 'song',
    externalId: 'song-1',
    token: 'must-never-reach-cloud',
  }));

  await assertFails(setDoc(doc(operator, 'musicScaleLiveChangeHistory/history-secret'), {
    id: 'history-secret',
    organizationId: 'org-a',
    venueId: 'venue-a',
    entityKind: 'providerLink',
    entityId: 'link-secret',
    operation: 'upsert',
    payload: { providerToken: 'forbidden' },
    version: 'v1',
    origin: 'studio',
    actorId: 'operator-a',
    createdAt: '2026-09-24T09:00:00.000Z',
    committedAt: '2026-09-24T09:00:01.000Z',
  }));
});

test('requester can create only their own pending request and cannot self-approve', async () => {
  const viewer = env.authenticatedContext('viewer-a').firestore();

  await assertSucceeds(setDoc(doc(viewer, 'musicScaleLiveRequests/request-own'), {
    id: 'request-own',
    organizationId: 'org-a',
    venueId: 'venue-a',
    liveSessionId: 'session-a',
    actorId: 'viewer-a',
    kind: 'message',
    payload: { text: 'Voltar ao refrão' },
    status: 'pending',
    createdAt: '2026-09-24T09:00:00.000Z',
  }));

  await assertFails(setDoc(doc(viewer, 'musicScaleLiveRequests/request-spoof'), {
    id: 'request-spoof',
    organizationId: 'org-a',
    venueId: 'venue-a',
    liveSessionId: 'session-a',
    actorId: 'operator-a',
    kind: 'message',
    payload: { text: 'spoof' },
    status: 'pending',
    createdAt: '2026-09-24T09:00:00.000Z',
  }));

  await assertFails(updateDoc(doc(viewer, 'musicScaleLiveRequests/request-a'), {
    status: 'accepted',
  }));
});

test('conductor resolves a request while tenant identity remains immutable', async () => {
  const operator = env.authenticatedContext('operator-a').firestore();

  await assertSucceeds(updateDoc(doc(operator, 'musicScaleLiveRequests/request-a'), {
    status: 'accepted',
    updatedAt: '2026-09-24T09:05:00.000Z',
    resolvedBy: 'operator-a',
  }));

  await assertFails(updateDoc(doc(operator, 'musicScaleLiveRequests/request-a'), {
    organizationId: 'org-b',
  }));
});

test('presence can only be written for the authenticated actor', async () => {
  const viewer = env.authenticatedContext('viewer-a').firestore();

  await assertSucceeds(setDoc(doc(viewer, 'musicScaleLivePresence/presence-viewer'), {
    id: 'presence-viewer',
    organizationId: 'org-a',
    venueId: 'venue-a',
    liveSystemId: 'system-a',
    liveSessionId: 'session-a',
    actorId: 'viewer-a',
    role: 'viewer',
    active: true,
    lastSeenAt: '2026-09-24T09:00:00.000Z',
  }));

  await assertFails(setDoc(doc(viewer, 'musicScaleLivePresence/presence-spoof'), {
    id: 'presence-spoof',
    organizationId: 'org-a',
    venueId: 'venue-a',
    liveSessionId: 'session-a',
    actorId: 'operator-a',
    role: 'operator',
    active: true,
    lastSeenAt: '2026-09-24T09:00:00.000Z',
  }));
});

test('change history and Live events are append-only', async () => {
  const operator = env.authenticatedContext('operator-a').firestore();

  await assertSucceeds(setDoc(doc(operator, 'musicScaleLiveChangeHistory/mutation-a'), {
    id: 'mutation-a',
    organizationId: 'org-a',
    venueId: 'venue-a',
    entityKind: 'scene',
    entityId: 'scene-a',
    operation: 'upsert',
    payload: { id: 'scene-a', name: 'Scene A' },
    version: 'v1',
    origin: 'studio',
    actorId: 'operator-a',
    createdAt: '2026-09-24T09:00:00.000Z',
    committedAt: '2026-09-24T09:00:01.000Z',
  }));

  await assertFails(updateDoc(
    doc(operator, 'musicScaleLiveChangeHistory/mutation-a'),
    { version: 'tampered' },
  ));

  await assertSucceeds(setDoc(doc(operator, 'musicScaleLiveEvents/event-a'), {
    id: 'event-a',
    organizationId: 'org-a',
    venueId: 'venue-a',
    liveSystemId: 'system-a',
    liveSessionId: 'session-a',
    actorId: 'operator-a',
    type: 'scene.executed',
    occurredAt: '2026-09-24T09:00:00.000Z',
    source: 'live-node',
    payload: {},
  }));

  await assertFails(updateDoc(
    doc(operator, 'musicScaleLiveEvents/event-a'),
    { type: 'rewritten' },
  ));
});

test('global CEO keeps tenant-independent Live access without local membership', async () => {
  const ceo = env.authenticatedContext('ceo-user').firestore();

  await assertSucceeds(getDoc(doc(ceo, 'musicScaleLiveVenues/venue-a')));
  await assertSucceeds(setDoc(doc(ceo, 'musicScaleLiveSystems/system-ceo'), {
    id: 'system-ceo',
    organizationId: 'org-a',
    venueId: 'venue-a',
    name: 'CEO managed',
  }));
});
