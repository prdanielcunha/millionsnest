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
const [firestoreHost, firestorePort] =
  (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8180').split(':');

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-millionsnest-nestaffiliate-gate',
    firestore: {
      host: firestoreHost,
      port: Number(firestorePort),
      rules: await readFile('firestore.rules', 'utf8'),
    },
  });

  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    for (const orgId of ['org-a', 'org-b']) {
      await setDoc(doc(db, `organizations/${orgId}`), {
        status: 'active',
        ownerUid: `owner-${orgId}`,
        apps: { nestaffiliate: { status: 'active' } },
      });
    }

    const members = [
      ['owner-a', 'owner'],
      ['admin-a', 'admin'],
      ['editor-a', 'editor'],
      ['viewer-a', 'viewer'],
    ] as const;

    for (const [uid, role] of members) {
      await setDoc(doc(db, `organizations/org-a/members/${uid}`), {
        uid,
        status: 'active',
        role,
        organizationRole: role,
      });
    }

    await setDoc(doc(db, 'organizations/org-b/members/editor-b'), {
      uid: 'editor-b',
      status: 'active',
      role: 'editor',
      organizationRole: 'editor',
    });
    await setDoc(doc(db, 'organizations/org-c'), {
      status: 'active',
      ownerUid: 'owner-org-c',
      apps: {},
    });
    await setDoc(doc(db, 'organizations/org-c/members/editor-c'), {
      uid: 'editor-c',
      status: 'active',
      role: 'editor',
      organizationRole: 'editor',
    });


    await setDoc(doc(db, 'organizations/org-a/products/nestaffiliate/campaigns/existing'), {
      id: 'existing',
      organizationId: 'org-a',
      status: 'READY',
      currentVersion: { version: 1 },
    });

    await setDoc(doc(db, 'organizations/org-a/products/nestaffiliate/auditEvents/audit-1'), {
      organizationId: 'org-a',
      action: 'SEEDED',
    });

    await setDoc(doc(db, 'organizations/org-a/products/nestaffiliate/providerConnections/pinterest'), {
      organizationId: 'org-a',
      provider: 'PINTEREST',
      status: 'disconnected',
    });
  });
});

after(async () => env.cleanup());

function campaign(organizationId = 'org-a') {
  return {
    id: 'new-campaign',
    organizationId,
    status: 'READY',
    currentVersion: { version: 1 },
  };
}

test('viewer can read own tenant but cannot write', async () => {
  const db = env.authenticatedContext('viewer-a').firestore();
  await assertSucceeds(
    getDoc(doc(db, 'organizations/org-a/products/nestaffiliate/campaigns/existing')),
  );
  await assertFails(
    setDoc(doc(db, 'organizations/org-a/products/nestaffiliate/campaigns/viewer-write'), campaign()),
  );
});

test('editor can create and update campaign inside own tenant', async () => {
  const db = env.authenticatedContext('editor-a').firestore();
  const ref = doc(db, 'organizations/org-a/products/nestaffiliate/campaigns/editor-write');
  await assertSucceeds(setDoc(ref, campaign()));
  await assertSucceeds(updateDoc(ref, { status: 'APPROVED' }));
});

test('editor cannot forge organizationId', async () => {
  const db = env.authenticatedContext('editor-a').firestore();
  await assertFails(
    setDoc(
      doc(db, 'organizations/org-a/products/nestaffiliate/campaigns/wrong-org'),
      campaign('org-b'),
    ),
  );
  await assertFails(
    updateDoc(
      doc(db, 'organizations/org-a/products/nestaffiliate/campaigns/existing'),
      { organizationId: 'org-b' },
    ),
  );
});

test('member without NestAffiliate entitlement cannot access product data', async () => {
  const db = env.authenticatedContext('editor-c').firestore();
  await assertFails(
    setDoc(
      doc(db, 'organizations/org-c/products/nestaffiliate/campaigns/no-entitlement'),
      campaign('org-c'),
    ),
  );
});

test('tenant B cannot read tenant A', async () => {
  const db = env.authenticatedContext('editor-b').firestore();
  await assertFails(
    getDoc(doc(db, 'organizations/org-a/products/nestaffiliate/campaigns/existing')),
  );
});

test('secret-looking fields are rejected from client-writable documents', async () => {
  const db = env.authenticatedContext('editor-a').firestore();
  await assertFails(
    setDoc(
      doc(db, 'organizations/org-a/products/nestaffiliate/campaigns/secret'),
      { ...campaign(), accessToken: 'must-never-be-here' },
    ),
  );
});

test('audit events are append-only and admin-readable', async () => {
  const editor = env.authenticatedContext('editor-a').firestore();
  const admin = env.authenticatedContext('admin-a').firestore();
  const ref = doc(editor, 'organizations/org-a/products/nestaffiliate/auditEvents/editor-event');

  await assertSucceeds(
    setDoc(ref, { organizationId: 'org-a', action: 'CAMPAIGN_APPROVED' }),
  );
  await assertFails(updateDoc(ref, { action: 'TAMPERED' }));
  await assertFails(deleteDoc(ref));
  await assertSucceeds(
    getDoc(doc(admin, 'organizations/org-a/products/nestaffiliate/auditEvents/editor-event')),
  );
});

test('provider connection documents are backend-managed', async () => {
  const viewer = env.authenticatedContext('viewer-a').firestore();
  const admin = env.authenticatedContext('admin-a').firestore();
  const ref = doc(viewer, 'organizations/org-a/products/nestaffiliate/providerConnections/pinterest');
  await assertFails(getDoc(ref));
  await assertSucceeds(
    getDoc(doc(admin, 'organizations/org-a/products/nestaffiliate/providerConnections/pinterest')),
  );
  await assertFails(
    setDoc(
      doc(admin, 'organizations/org-a/products/nestaffiliate/providerConnections/new'),
      { organizationId: 'org-a', provider: 'PINTEREST' },
    ),
  );
});


test('performanceDaily records are tenant-scoped and viewer is read-only', async () => {
  const editor = env.authenticatedContext('editor-a').firestore();
  const viewer = env.authenticatedContext('viewer-a').firestore();
  const otherTenant = env.authenticatedContext('editor-b').firestore();
  const ref = doc(editor, 'organizations/org-a/products/nestaffiliate/performanceDaily/campaign-1-2026-09-30');

  await assertSucceeds(setDoc(ref, {
    organizationId: 'org-a',
    campaignId: 'campaign-1',
    date: '2026-09-30',
    impressions: 100,
    outboundClicks: 5,
    revenue: 20,
    source: 'MANUAL',
  }));
  await assertSucceeds(getDoc(doc(viewer, 'organizations/org-a/products/nestaffiliate/performanceDaily/campaign-1-2026-09-30')));
  await assertFails(updateDoc(doc(viewer, 'organizations/org-a/products/nestaffiliate/performanceDaily/campaign-1-2026-09-30'), { revenue: 999 }));
  await assertFails(getDoc(doc(otherTenant, 'organizations/org-a/products/nestaffiliate/performanceDaily/campaign-1-2026-09-30')));
});

test('affiliateResults cannot be written with a forged tenant', async () => {
  const editor = env.authenticatedContext('editor-a').firestore();
  await assertFails(setDoc(
    doc(editor, 'organizations/org-a/products/nestaffiliate/affiliateResults/forged'),
    { organizationId: 'org-b', campaignId: 'campaign-1', revenue: 10 },
  ));
});


test('sensitive provider account collections are admin-only and backend-managed', async () => {
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'organizations/org-a/products/nestaffiliate/affiliateAccounts/shopee'), {
      organizationId: 'org-a',
      provider: 'SHOPEE',
      tokenRef: 'secret-manager://affiliate',
    });
    await setDoc(doc(db, 'organizations/org-a/products/nestaffiliate/pinterestAccounts/primary'), {
      organizationId: 'org-a',
      provider: 'PINTEREST',
      tokenRef: 'secret-manager://pinterest',
    });
    await setDoc(doc(db, 'organizations/org-a/products/nestaffiliate/quotaUsage/2026-09-30'), {
      organizationId: 'org-a',
      provider: 'GEMINI_FREE',
      used: 0,
    });
    await setDoc(doc(db, 'organizations/org-a/products/nestaffiliate/systemJobs/radar'), {
      organizationId: 'org-a',
      status: 'idle',
    });
  });

  const viewer = env.authenticatedContext('viewer-a').firestore();
  const editor = env.authenticatedContext('editor-a').firestore();
  const admin = env.authenticatedContext('admin-a').firestore();

  for (const path of [
    'affiliateAccounts/shopee',
    'pinterestAccounts/primary',
    'quotaUsage/2026-09-30',
    'systemJobs/radar',
  ]) {
    await assertFails(getDoc(doc(viewer, `organizations/org-a/products/nestaffiliate/${path}`)));
    await assertFails(getDoc(doc(editor, `organizations/org-a/products/nestaffiliate/${path}`)));
    await assertSucceeds(getDoc(doc(admin, `organizations/org-a/products/nestaffiliate/${path}`)));
  }

  await assertFails(setDoc(
    doc(admin, 'organizations/org-a/products/nestaffiliate/pinterestAccounts/client-write'),
    { organizationId: 'org-a', provider: 'PINTEREST' },
  ));
});
