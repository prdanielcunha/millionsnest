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

    await setDoc(doc(db, 'organizations/org-a/products/nestaffiliate/productReferences/ref-example'), sampleReference());
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


test('market signal snapshots are tenant-scoped, editable and secret-safe', async () => {
  const editor = env.authenticatedContext('editor-a').firestore();
  const viewer = env.authenticatedContext('viewer-a').firestore();
  const otherTenant = env.authenticatedContext('editor-b').firestore();
  const ref = doc(editor, 'organizations/org-a/products/nestaffiliate/marketSignalSnapshots/meli-trend-kitchen');

  await assertSucceeds(setDoc(ref, {
    organizationId: 'org-a',
    source: 'MELI_TREND_GROWTH',
    kind: 'DEMAND',
    strength: 0.94,
    confidence: 0.96,
    keyword: 'organizador cozinha',
    evidence: ['position:1'],
    observedAt: '2026-10-02T12:00:00.000Z',
  }));

  await assertSucceeds(
    getDoc(doc(viewer, 'organizations/org-a/products/nestaffiliate/marketSignalSnapshots/meli-trend-kitchen')),
  );

  await assertFails(
    updateDoc(
      doc(viewer, 'organizations/org-a/products/nestaffiliate/marketSignalSnapshots/meli-trend-kitchen'),
      { strength: 0.1 },
    ),
  );

  await assertFails(
    getDoc(doc(otherTenant, 'organizations/org-a/products/nestaffiliate/marketSignalSnapshots/meli-trend-kitchen')),
  );

  await assertFails(setDoc(
    doc(editor, 'organizations/org-a/products/nestaffiliate/marketSignalSnapshots/forged'),
    {
      organizationId: 'org-b',
      source: 'MANUAL',
      kind: 'DEMAND',
      strength: 0.5,
      confidence: 0.5,
      evidence: [],
      observedAt: '2026-10-02T12:00:00.000Z',
    },
  ));

  await assertFails(setDoc(
    doc(editor, 'organizations/org-a/products/nestaffiliate/marketSignalSnapshots/secret'),
    {
      organizationId: 'org-a',
      source: 'MELI_TREND_GROWTH',
      kind: 'DEMAND',
      strength: 0.9,
      confidence: 0.9,
      evidence: [],
      observedAt: '2026-10-02T12:00:00.000Z',
      accessToken: 'never-store-client-secrets',
    },
  ));
});

test('provider secret state is invisible to every client role', async () => {
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'organizations/org-a/products/nestaffiliate/providerSecretState/mercadolivre'), {
      organizationId: 'org-a',
      provider: 'MELI',
      refreshToken: 'server-only',
    });
  });

  for (const uid of ['viewer-a', 'editor-a', 'admin-a', 'owner-a']) {
    const db = env.authenticatedContext(uid).firestore();
    const ref = doc(db, 'organizations/org-a/products/nestaffiliate/providerSecretState/mercadolivre');
    await assertFails(getDoc(ref));
    await assertFails(updateDoc(ref, { refreshToken: 'tampered' }));
  }
});


test('Creative Pack collections preserve tenant RBAC and no-secret invariants', async () => {
  const editor = env.authenticatedContext('editor-a').firestore();
  const viewer = env.authenticatedContext('viewer-a').firestore();
  const admin = env.authenticatedContext('admin-a').firestore();
  const collections = ['creativePacks', 'creativeConcepts', 'sceneProfiles'] as const;

  for (const collectionName of collections) {
    const id = 'creative-' + collectionName;
    const path = 'organizations/org-a/products/nestaffiliate/' + collectionName + '/' + id;
    const ref = doc(editor, path);

    await assertSucceeds(setDoc(ref, {
      id,
      organizationId: 'org-a',
      campaignId: 'campaign-1',
      version: 1,
    }));
    await assertSucceeds(updateDoc(ref, { version: 2 }));
    await assertSucceeds(getDoc(doc(viewer, path)));
    await assertFails(setDoc(doc(viewer, path + '-viewer'), {
      organizationId: 'org-a',
      campaignId: 'campaign-1',
    }));
    await assertFails(deleteDoc(ref));
    await assertSucceeds(deleteDoc(doc(admin, path)));
  }
});

test('Creative Pack collections reject cross-tenant writes and secret-like fields', async () => {
  const editor = env.authenticatedContext('editor-a').firestore();

  await assertFails(setDoc(
    doc(editor, 'organizations/org-a/products/nestaffiliate/creativePacks/wrong-tenant'),
    { organizationId: 'org-b', campaignId: 'campaign-1' },
  ));

  await assertFails(setDoc(
    doc(editor, 'organizations/org-a/products/nestaffiliate/promptPackages/secret-prompt'),
    {
      organizationId: 'org-a',
      campaignId: 'campaign-1',
      secret: 'must-not-be-stored',
    },
  ));
});


test('Revenue OS 3 statement event remains tenant-scoped and cannot have its business facts revised',async()=>{
  const editor=env.authenticatedContext('editor-a').firestore();
  const viewer=env.authenticatedContext('viewer-a').firestore();
  const foreign=env.authenticatedContext('editor-b').firestore();
  const path='organizations/org-a/products/nestaffiliate/affiliateResultEvents/MELI:txn-001:report-20261007';
  const ref=doc(editor,path);
  const row={
    organizationId:'org-a',id:'MELI:txn-001',transactionId:'txn-001',eventId:'MELI:txn-001:report-20261007',
    marketplace:'MELI',statementId:'report-20261007',source:'MANUAL_CSV_REPORTED',
    status:'PENDING',commission:12.5,importedAt:'2026-10-07T13:00:00.000Z',
    recordedAt:'2026-10-07T13:00:00.000Z',
  };
  await assertSucceeds(setDoc(ref,row));
  await assertSucceeds(getDoc(doc(viewer,path)));
  await assertFails(getDoc(doc(foreign,path)));
  await assertSucceeds(updateDoc(ref,{importedAt:'2026-10-07T14:00:00.000Z'}));
  await assertFails(updateDoc(ref,{status:'APPROVED'}));
  await assertFails(updateDoc(ref,{commission:9999}));
  await assertFails(deleteDoc(ref));
  await assertFails(setDoc(doc(foreign,'organizations/org-a/products/nestaffiliate/affiliateResultEvents/forged'),{...row,eventId:'forged'}));
  await assertFails(setDoc(doc(editor,'organizations/org-a/products/nestaffiliate/affiliateResultEvents/cross-tenant'),{...row,eventId:'cross-tenant',organizationId:'org-b'}));
});

test('Revenue OS 3 channel publication stays user-reported with eligibility and tenant checks',async()=>{
  const editor=env.authenticatedContext('editor-a').firestore();
  const viewer=env.authenticatedContext('viewer-a').firestore();
  const foreign=env.authenticatedContext('editor-b').firestore();
  const path='organizations/org-a/products/nestaffiliate/channelPublications/facebook-reel:c1:v1';
  const data={
    organizationId:'org-a',id:'facebook-reel:c1:v1',campaignId:'c1',campaignVersion:1,
    channel:'FACEBOOK_REELS',marketplace:'SHOPEE',status:'USER_REPORTED',
    externalUrl:'https://www.facebook.com/reel/123456789',actorId:'editor-a',
    eligibilityAttested:true,tagAttested:true,footageRightsAttested:true,
    updatedAt:'2026-10-07T13:00:00.000Z',
  };
  await assertFails(setDoc(doc(viewer,path),data));
  await assertFails(setDoc(doc(editor,path),{...data,eligibilityAttested:false}));
  await assertFails(setDoc(doc(editor,path),{...data,status:'PUBLISHED_CONFIRMED'}));
  await assertFails(setDoc(doc(editor,path),{...data,organizationId:'org-b'}));
  await assertSucceeds(setDoc(doc(editor,path),data));
  await assertSucceeds(getDoc(doc(viewer,path)));
  await assertFails(getDoc(doc(foreign,path)));
  await assertFails(updateDoc(doc(editor,path),{status:'PUBLISHED_CONFIRMED'}));
  await assertFails(deleteDoc(doc(editor,path)));
  await assertSucceeds(updateDoc(doc(editor,path),{updatedAt:'2026-10-07T14:00:00.000Z'}));
});

function sampleReference(id = 'ref-example') {
  return {
    id,organizationId:'org-a',productId:'product-1',
    marketplace:'MELI',externalListingId:'MLB-001',
    sourceType:'USER_OWN_PHOTO',rights:'USER_ATTESTED',
    referenceStatus:'READY_FOR_AI',canSendToExternalAI:true,
    rightsEvidence:'Photo taken by owner, authorized 2026-10-08',
    sha256:'a'.repeat(64),mimeType:'image/webp',
    storagePath:'organizations/org-a/product-references/'+id+'.webp',
    createdBy:'editor-a',capturedAt:'2026-10-08T12:00:00Z',
    updatedAt:'2026-10-08T12:00:00Z',
  };
}
test('V4 reference is backend-created and remains scoped to its tenant',async()=>{
  const editor=env.authenticatedContext('editor-a').firestore();
  const viewer=env.authenticatedContext('viewer-a').firestore();
  const other=env.authenticatedContext('editor-b').firestore();
  const ref=doc(editor,'organizations/org-a/products/nestaffiliate/productReferences/ref-example');
  await assertFails(setDoc(doc(editor,'organizations/org-a/products/nestaffiliate/productReferences/ref-editor-forged'),sampleReference('ref-editor-forged')));
  await assertSucceeds(getDoc(doc(viewer,ref.path)));
  await assertFails(getDoc(doc(other,ref.path)));
  await assertFails(setDoc(doc(viewer,'organizations/org-a/products/nestaffiliate/productReferences/ref-viewer'),sampleReference('ref-viewer')));
});
test('V4 reference rejects forged rights, bytes, tenant, and immutable identity changes',async()=>{
  const editor=env.authenticatedContext('editor-a').firestore();
  const location='organizations/org-a/products/nestaffiliate/productReferences/';
  await assertFails(setDoc(doc(editor,location+'ref-bad-tenant'),{
    ...sampleReference('ref-bad-tenant'),organizationId:'org-b',
  }));
  await assertFails(setDoc(doc(editor,location+'ref-bad-source'),{
    ...sampleReference('ref-bad-source'),sourceType:'MARKETPLACE_REFERENCE',rights:'UNKNOWN',
  }));
  await assertFails(setDoc(doc(editor,location+'ref-bad-bytes'),{
    ...sampleReference('ref-bad-bytes'),inlineBytes:'secret-photo',
  }));
  await assertFails(updateDoc(doc(editor,location+'ref-example'),{externalListingId:'MLB-CHANGED'}));
  await assertFails(updateDoc(doc(editor,location+'ref-example'),{rights:'PLATFORM_LICENSED'}));
});
test('V4 revocation is one-way and cannot be rolled back by client',async()=>{
  const editor=env.authenticatedContext('editor-a').firestore();
  const ref=doc(editor,'organizations/org-a/products/nestaffiliate/productReferences/ref-example');
  await assertSucceeds(updateDoc(ref,{
    referenceStatus:'REVOKED',canSendToExternalAI:false,
    revokedBy:'editor-a',updatedAt:'2026-10-08T15:00:00Z',
  }));
  await assertFails(updateDoc(ref,{referenceStatus:'READY_FOR_AI',canSendToExternalAI:true}));
  await assertFails(deleteDoc(ref));
});
test('V4 source coverage is append-only and no data leaks between tenants',async()=>{
  const editor=env.authenticatedContext('editor-a').firestore();
  const viewer=env.authenticatedContext('viewer-a').firestore();
  const other=env.authenticatedContext('editor-b').firestore();
  const url='organizations/org-a/products/nestaffiliate/sourceCoverageRuns/v4-run1';
  const ref=doc(editor,url);
  await assertSucceeds(setDoc(ref,{
    runId:'v4-run1',organizationId:'org-a',query:'cozinha pequena',
    provider:'MELI',examined:105,assessed:12,report:{readyToPublish:0},
  }));
  await assertSucceeds(getDoc(doc(viewer,url)));
  await assertFails(updateDoc(ref,{examined:1000}));
  await assertFails(getDoc(doc(other,url)));
  await assertFails(setDoc(doc(viewer,'organizations/org-a/products/nestaffiliate/sourceCoverageRuns/viewer'),{
    runId:'viewer',organizationId:'org-a',assessed:0,examined:0,
  }));
});
test('V4 opportunity assessments accept versioned research only',async()=>{
  const editor=env.authenticatedContext('editor-a').firestore();
  const location='organizations/org-a/products/nestaffiliate/opportunityAssessmentsV4/';
  await assertSucceeds(setDoc(doc(editor,location+'v4-test'),{
    organizationId:'org-a',version:'potential-v4.0',runId:'run-1',
    potential:{lower:31,upper:82},readiness:{score:35,blockers:[]},
    confidence:'LOW',status:'PROMISING',
  }));
  await assertFails(setDoc(doc(editor,location+'v4-legacy'),{
    organizationId:'org-a',version:'1.0',runId:'run-1',
  }));
});

test('V4 private media bytes are inaccessible via browser even to owner/editor',async()=>{
 const owner=env.authenticatedContext('owner-a').firestore();
 const viewer=env.authenticatedContext('viewer-a').firestore();
 const ref=doc(owner,'organizations/org-a/products/nestaffiliate/privateReferenceBytes/ref-secret');
 await assertFails(setDoc(ref,{organizationId:'org-a',bytes:'never-client-readable'}));
 await assertFails(getDoc(ref));
 await assertFails(getDoc(doc(viewer,ref.path)));
 await assertFails(updateDoc(ref,{bytes:'changed'}));
});
