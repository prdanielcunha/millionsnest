import { after, before, test } from 'node:test';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { readFile } from 'node:fs/promises';

let env: RulesTestEnvironment;
const [firestoreHost, firestorePort] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8180').split(':');

const analyticsEvent = (overrides: Record<string, unknown> = {}) => ({
  eventType: 'page_view',
  organizationId: 'none',
  userId: 'none',
  sessionId: 'session-1',
  app: 'musicscale',
  metadata: { page: 'sales_landing' },
  timestamp: new Date(),
  ...overrides,
});

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-millionsnest-analytics-rules',
    firestore: {
      host: firestoreHost,
      port: Number(firestorePort),
      rules: await readFile('firestore.rules', 'utf8'),
    },
  });

  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'users/ceo'), { systemRole: 'ceo' });
    await setDoc(doc(context.firestore(), 'users/member'), { systemRole: 'user' });
  });
});

after(async () => env.cleanup());

test('anonymous sales landing page view remains allowed', async () => {
  const db = env.unauthenticatedContext().firestore();
  await assertSucceeds(setDoc(doc(db, 'analytics_events/public-page'), analyticsEvent()));
});

test('anonymous guided demo events remain allowed only for the known actions', async () => {
  const db = env.unauthenticatedContext().firestore();

  await assertSucceeds(setDoc(doc(db, 'analytics_events/public-demo-open'), analyticsEvent({
    eventType: 'app_usage',
    metadata: { action: 'sales_demo_opened', source: 'sales_landing' },
  })));

  await assertSucceeds(setDoc(doc(db, 'analytics_events/public-demo-step'), analyticsEvent({
    eventType: 'app_usage',
    metadata: { action: 'sales_demo_step_selected', step: 3 },
  })));

  await assertFails(setDoc(doc(db, 'analytics_events/public-demo-invalid-step'), analyticsEvent({
    eventType: 'app_usage',
    metadata: { action: 'sales_demo_step_selected', step: 6 },
  })));
});

test('anonymous choose-plan CTA remains allowed with the exact public contract', async () => {
  const db = env.unauthenticatedContext().firestore();
  await assertSucceeds(setDoc(doc(db, 'analytics_events/public-cta'), analyticsEvent({
    eventType: 'trial_cta_clicked',
    metadata: { action: 'choose_plan', source: 'sales_landing_primary' },
  })));
});

test('anonymous clients cannot submit arbitrary analytics events or spoof identity', async () => {
  const db = env.unauthenticatedContext().firestore();

  await assertFails(setDoc(doc(db, 'analytics_events/public-login'), analyticsEvent({
    eventType: 'login',
    metadata: {},
  })));

  await assertFails(setDoc(doc(db, 'analytics_events/public-spoof-user'), analyticsEvent({
    userId: 'victim-user',
  })));

  await assertFails(setDoc(doc(db, 'analytics_events/public-wrong-app'), analyticsEvent({
    app: 'millionsnest_core',
  })));
});

test('root analytics rejects extra fields, oversized session IDs, and extra public metadata', async () => {
  const db = env.unauthenticatedContext().firestore();

  await assertFails(setDoc(doc(db, 'analytics_events/public-extra-field'), analyticsEvent({
    injected: 'unexpected',
  })));

  await assertFails(setDoc(doc(db, 'analytics_events/public-large-session'), analyticsEvent({
    sessionId: 'x'.repeat(129),
  })));

  await assertFails(setDoc(doc(db, 'analytics_events/public-extra-metadata'), analyticsEvent({
    metadata: { page: 'sales_landing', arbitrary: 'data' },
  })));
});

test('authenticated root events require the authenticated uid and a known event type', async () => {
  const db = env.authenticatedContext('member').firestore();

  await assertSucceeds(setDoc(doc(db, 'analytics_events/auth-login'), analyticsEvent({
    eventType: 'login',
    userId: 'member',
    app: 'millionsnest_core',
    metadata: {},
  })));

  await assertFails(setDoc(doc(db, 'analytics_events/auth-spoof'), analyticsEvent({
    eventType: 'login',
    userId: 'someone-else',
    app: 'millionsnest_core',
    metadata: {},
  })));

  await assertFails(setDoc(doc(db, 'analytics_events/auth-unknown'), analyticsEvent({
    eventType: 'made_up_event',
    userId: 'member',
    app: 'millionsnest_core',
    metadata: {},
  })));
});

test('analytics documents remain admin-readable and immutable from clients', async () => {
  const adminDb = env.authenticatedContext('ceo').firestore();
  const memberDb = env.authenticatedContext('member').firestore();
  const unauthDb = env.unauthenticatedContext().firestore();
  const ref = doc(adminDb, 'analytics_events/public-page');

  await assertSucceeds(getDoc(ref));
  await assertFails(getDoc(doc(memberDb, 'analytics_events/public-page')));
  await assertFails(getDoc(doc(unauthDb, 'analytics_events/public-page')));
  await assertFails(updateDoc(doc(memberDb, 'analytics_events/auth-login'), { app: 'tampered' }));
  await assertFails(deleteDoc(doc(memberDb, 'analytics_events/auth-login')));
});
