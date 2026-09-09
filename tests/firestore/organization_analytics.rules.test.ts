import { after, before, test } from 'node:test';
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
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { readFile } from 'node:fs/promises';

let env: RulesTestEnvironment;
const [firestoreHost, firestorePort] =
  (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8180').split(':');

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-millionsnest-organization-analytics-rules',
    firestore: {
      host: firestoreHost,
      port: Number(firestorePort),
      rules: await readFile('firestore.rules', 'utf8'),
    },
  });

  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();

    await setDoc(doc(db, 'organizations/org-1'), {
      status: 'active',
      ownerUid: 'owner-1',
    });

    for (const uid of ['member-1', 'member-2']) {
      await setDoc(doc(db, `organizations/org-1/members/${uid}`), {
        uid,
        status: 'active',
        role: 'member',
      });
    }

    await setDoc(doc(db, 'users/global-1'), {
      systemRole: 'global_admin',
    });

    await setDoc(doc(db, 'organizations/org-1/analytics/existing-event'), {
      eventType: 'action_os_interaction',
      organizationId: 'org-1',
      userId: 'member-1',
      sessionId: 'session-existing',
      app: 'millionsnest_core',
      metadata: {
        action: 'action_opened',
        lane: 'action',
        sourceApp: 'musicscale',
      },
      timestamp: Timestamp.now(),
    });
  });
});

after(async () => env.cleanup());

function event(
  userId: string,
  overrides: Record<string, unknown> = {}
) {
  return {
    eventType: 'action_os_interaction',
    organizationId: 'org-1',
    userId,
    sessionId: 'session-test-123',
    app: 'millionsnest_core',
    metadata: {
      action: 'action_opened',
      lane: 'action',
      sourceApp: 'musicscale',
    },
    timestamp: Timestamp.now(),
    ...overrides,
  };
}

test('active member can append a valid self-attributed analytics event', async () => {
  const db = env.authenticatedContext('member-1').firestore();

  await assertSucceeds(
    setDoc(
      doc(db, 'organizations/org-1/analytics/self-event'),
      event('member-1')
    )
  );
});

test('active member can append privacy-safe structured Action OS dismiss feedback', async () => {
  const db = env.authenticatedContext('member-1').firestore();

  await assertSucceeds(
    setDoc(
      doc(db, 'organizations/org-1/analytics/dismiss-feedback'),
      event('member-1', {
        metadata: {
          action: 'action_dismissed',
          lane: 'action',
          sourceApp: 'musicscale',
          signalType: 'musicscale_pending_responses',
          priority: 'high',
          dismissCode: 'already_handled',
        },
      })
    )
  );
});

test('Action OS analytics rejects free-text or unknown metadata fields', async () => {
  const db = env.authenticatedContext('member-1').firestore();

  await assertFails(
    setDoc(
      doc(db, 'organizations/org-1/analytics/free-text-feedback'),
      event('member-1', {
        metadata: {
          action: 'action_dismissed',
          lane: 'action',
          sourceApp: 'musicscale',
          dismissCode: 'already_handled',
          notes: 'Pastoral or personnel text must never be accepted here',
        },
      })
    )
  );

  await assertFails(
    setDoc(
      doc(db, 'organizations/org-1/analytics/invalid-dismiss-code'),
      event('member-1', {
        metadata: {
          action: 'action_dismissed',
          lane: 'action',
          sourceApp: 'musicscale',
          dismissCode: 'custom_free_text',
        },
      })
    )
  );
});

test('active member can append a valid anonymous-within-tenant analytics event', async () => {
  const db = env.authenticatedContext('member-1').firestore();

  await assertSucceeds(
    setDoc(
      doc(db, 'organizations/org-1/analytics/anonymous-event'),
      event('none')
    )
  );
});

test('member cannot spoof another user attribution', async () => {
  const db = env.authenticatedContext('member-1').firestore();

  await assertFails(
    setDoc(
      doc(db, 'organizations/org-1/analytics/spoofed-event'),
      event('member-2')
    )
  );
});

test('member cannot spoof another tenant in event envelope', async () => {
  const db = env.authenticatedContext('member-1').firestore();

  await assertFails(
    setDoc(
      doc(db, 'organizations/org-1/analytics/wrong-tenant'),
      event('member-1', { organizationId: 'org-2' })
    )
  );
});

test('ordinary members cannot read analytics events from the tenant', async () => {
  for (const uid of ['member-1', 'member-2']) {
    const db = env.authenticatedContext(uid).firestore();
    await assertFails(
      getDoc(
        doc(db, 'organizations/org-1/analytics/existing-event')
      )
    );
  }
});

test('global admin can read organization analytics for pilot analysis', async () => {
  const db = env.authenticatedContext('global-1').firestore();

  await assertSucceeds(
    getDoc(
      doc(db, 'organizations/org-1/analytics/existing-event')
    )
  );
});

test('clients cannot rewrite an existing analytics event', async () => {
  const db = env.authenticatedContext('member-1').firestore();

  await assertFails(
    updateDoc(
      doc(db, 'organizations/org-1/analytics/existing-event'),
      {
        metadata: {
          action: 'action_dismissed',
          lane: 'action',
          sourceApp: 'musicscale',
        },
      }
    )
  );
});

test('invalid analytics envelope is rejected', async () => {
  const db = env.authenticatedContext('member-1').firestore();

  await assertFails(
    setDoc(
      doc(db, 'organizations/org-1/analytics/invalid-envelope'),
      {
        ...event('member-1'),
        injected: 'not-allowed',
      }
    )
  );
});
