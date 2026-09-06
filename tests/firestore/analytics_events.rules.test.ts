import { after, before, test } from 'node:test';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { readFile } from 'node:fs/promises';

let env: RulesTestEnvironment;
const [firestoreHost, firestorePort] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8180').split(':');

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-millionsnest-analytics-rules',
    firestore: {
      host: firestoreHost,
      port: Number(firestorePort),
      rules: await readFile('firestore.rules', 'utf8'),
    },
  });
});

after(async () => env.cleanup());

const baseEvent = {
  organizationId: 'none',
  userId: 'none',
  sessionId: 'session-public-123',
  app: 'musicscale',
  timestamp: Timestamp.now(),
};

test('anonymous MusicScale sales landing page_view remains allowed', async () => {
  const db = env.unauthenticatedContext().firestore();
  await assertSucceeds(setDoc(doc(db, 'analytics_events/public-page-view'), {
    ...baseEvent,
    eventType: 'page_view',
    metadata: { page: 'sales_landing' },
  }));
});

test('anonymous MusicScale demo interactions remain allowed', async () => {
  const db = env.unauthenticatedContext().firestore();
  await assertSucceeds(setDoc(doc(db, 'analytics_events/public-demo-opened'), {
    ...baseEvent,
    eventType: 'app_usage',
    metadata: { action: 'sales_demo_opened', source: 'sales_landing' },
  }));
  await assertSucceeds(setDoc(doc(db, 'analytics_events/public-demo-step'), {
    ...baseEvent,
    eventType: 'app_usage',
    metadata: { action: 'sales_demo_step_selected', step: 3 },
  }));
});

test('anonymous MusicScale choose-plan CTA remains allowed', async () => {
  const db = env.unauthenticatedContext().firestore();
  await assertSucceeds(setDoc(doc(db, 'analytics_events/public-plan-choice'), {
    ...baseEvent,
    eventType: 'trial_cta_clicked',
    metadata: { action: 'choose_plan', source: 'sales_landing_primary' },
  }));
});

test('anonymous arbitrary analytics event is denied', async () => {
  const db = env.unauthenticatedContext().firestore();
  await assertFails(setDoc(doc(db, 'analytics_events/public-arbitrary'), {
    ...baseEvent,
    eventType: 'checkout_completed',
    metadata: {},
  }));
});

test('anonymous public event cannot spoof identity or add arbitrary fields', async () => {
  const db = env.unauthenticatedContext().firestore();
  await assertFails(setDoc(doc(db, 'analytics_events/public-spoofed-user'), {
    ...baseEvent,
    userId: 'victim-user',
    eventType: 'page_view',
    metadata: { page: 'sales_landing' },
  }));
  await assertFails(setDoc(doc(db, 'analytics_events/public-extra-field'), {
    ...baseEvent,
    eventType: 'page_view',
    metadata: { page: 'sales_landing' },
    injected: true,
  }));
});

test('authenticated root analytics remains allowed only for self or none identity', async () => {
  const db = env.authenticatedContext('user-1').firestore();
  await assertSucceeds(setDoc(doc(db, 'analytics_events/auth-self'), {
    ...baseEvent,
    userId: 'user-1',
    eventType: 'checkout_started',
    metadata: { source: 'checkout' },
  }));
  await assertFails(setDoc(doc(db, 'analytics_events/auth-spoof'), {
    ...baseEvent,
    userId: 'another-user',
    eventType: 'checkout_started',
    metadata: { source: 'checkout' },
  }));
});
