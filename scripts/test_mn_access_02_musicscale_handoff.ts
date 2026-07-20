import { MusicScaleHandoffService } from '../src/server/services/MusicScaleHandoffService.js';
import { DENIAL_REASONS } from '../src/server/services/EcosystemAccessResolver.js';
import * as admin from 'firebase-admin';

import { createRequire } from 'module';
const requireModule = createRequire(import.meta.url);
let networkAttempts = 0;
const originalFetch = globalThis.fetch;
let originalHttpReq: any;
let originalHttpsReq: any;
let httpModule: any;
let httpsModule: any;

try {
  httpModule = requireModule('http');
  httpsModule = requireModule('https');
  originalHttpReq = httpModule.request;
  originalHttpsReq = httpsModule.request;
} catch (e) {}

function installNetworkGuard() {
  networkAttempts = 0;
  globalThis.fetch = () => { networkAttempts++; throw new Error("Network not allowed"); };
  if (httpModule) {
    httpModule.request = () => { networkAttempts++; throw new Error("Network not allowed"); };
  }
  if (httpsModule) {
    httpsModule.request = () => { networkAttempts++; throw new Error("Network not allowed"); };
  }
}

function restoreNetworkGuard() {
  globalThis.fetch = originalFetch;
  if (httpModule) httpModule.request = originalHttpReq;
  if (httpsModule) httpsModule.request = originalHttpsReq;
}

// Global Spy for console.log [HANDOFF] format check
let lastHandoffLog: any = null;
const originalConsoleLog = console.log;
console.log = (...args: any[]) => {
  if (args[0] === '[HANDOFF]') {
    lastHandoffLog = args[1];
  }
  originalConsoleLog(...args);
};

class MockDocumentReference {
  constructor(public path: string, private db: MockFirestore) {}
  async get() {
    this.db.documentReads++;
    const data = this.db.getData(this.path);
    return {
      exists: data !== null && data !== undefined,
      data: () => data ? JSON.parse(JSON.stringify(data)) : null,
      id: this.path.split('/').pop()
    };
  }
  set() { this.db.writeAttempts++; throw new Error('Write operation set() not allowed'); }
  update() { this.db.writeAttempts++; throw new Error('Write operation update() not allowed'); }
  delete() { this.db.writeAttempts++; throw new Error('Write operation delete() not allowed'); }
  create() { this.db.writeAttempts++; throw new Error('Write operation create() not allowed'); }
}

class MockCollectionReference {
  constructor(public path: string, private db: MockFirestore) {
    this.db.collectionCalls.push(path);
  }
  doc(id?: string) {
    if (!id) throw new Error('doc() must be called with id');
    return new MockDocumentReference(`${this.path}/${id}`, this.db);
  }
  where(field: string, op: string, value: any) {
    this.db.queryAttempts++;
    const path = this.path;
    const db = this.db;
    return {
      get: async () => {
        db.documentReads++;
        const docs = Object.keys(db.getMockDataRaw())
          .filter(k => k.startsWith(path + '/'))
          .map(k => {
            const data = db.getData(k);
            return {
              id: k.split('/').pop()!,
              data: () => data ? JSON.parse(JSON.stringify(data)) : null
            };
          })
          .filter(doc => {
            const d = doc.data();
            return d && d[field] === value;
          });
        return {
          empty: docs.length === 0,
          docs
        };
      }
    };
  }
}

class MockFirestore {
  private data: Record<string, any> = {};
  public accessedPaths: string[] = [];
  public collectionCalls: string[] = [];
  public documentReads = 0;
  public queryAttempts = 0;
  public writeAttempts = 0;
  public batchAttempts = 0;
  public transactionAttempts = 0;
  public initialSnapshot = '';

  setMockData(path: string, data: any) {
    this.data[path] = data;
    this.initialSnapshot = JSON.stringify(this.data);
  }

  getMockDataRaw() {
    return this.data;
  }

  getSnapshot() { return JSON.stringify(this.data); }

  getData(path: string) {
    this.accessedPaths.push(path);
    return this.data[path] ?? null;
  }

  collection(path: string) {
    return new MockCollectionReference(path, this);
  }

  batch() { this.batchAttempts++; throw new Error('Write operation batch() not allowed'); }
  runTransaction() { this.transactionAttempts++; throw new Error('Write operation runTransaction() not allowed'); }
}

class MockAuth {
  public tokensCreated = 0;
  public customTokenParams: any[] = [];

  async createCustomToken(uid: string, claims?: any) {
    this.tokensCreated++;
    this.customTokenParams.push({ uid, claims });
    return `mock-custom-token-for-${uid}-org-${claims?.orgId}`;
  }
}

let passed = 0;
let failed = 0;

async function runTest(
  name: string,
  params: { uid: string; appId: string; orgId?: string; supportMode?: boolean },
  setupData: (db: MockFirestore) => void,
  validate: (result: any, err: any, db: MockFirestore, auth: MockAuth) => void
) {
  const db = new MockFirestore();
  const auth = new MockAuth();
  setupData(db);
  db.initialSnapshot = db.getSnapshot();

  lastHandoffLog = null;
  installNetworkGuard();

  try {
    const service = new MusicScaleHandoffService(
      db as unknown as admin.firestore.Firestore,
      auth as unknown as admin.auth.Auth
    );

    let result: any = null;
    let caughtErr: any = null;

    try {
      result = await service.processHandoff(params);
    } catch (err: any) {
      caughtErr = err;
    }

    validate(result, caughtErr, db, auth);
    console.log(`✅ PASS: ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`❌ FAIL: ${name}`);
    console.error(err);
    failed++;
  } finally {
    restoreNetworkGuard();
  }
}

async function runAllTests() {
  console.log('Running behavioral tests for MusicScaleHandoffService...');

  // Helper for common setup
  const setupStandardUser = (db: MockFirestore, uid = 'u1', orgId = 'org1', sysRole = 'user', subStatus = 'active', appStatus = 'active') => {
    db.setMockData(`users/${uid}`, { status: 'active', systemRole: sysRole, activeOrganizationId: orgId, organizations: [orgId] });
    db.setMockData(`organizations/${orgId}`, {
      status: 'active',
      apps: { musicscale: { status: appStatus } }
    });
    db.setMockData(`organizations/${orgId}/members/${uid}`, {
      status: 'active',
      appAccess: { musicscale: { enabled: true } }
    });
    db.setMockData(`subscriptions/${orgId}`, { status: subStatus });
  };

  // TEST CASES

  await runTest('1. User without organizations or context fails handoff',
    { uid: 'u1', appId: 'musicscale' },
    db => {
      db.setMockData('users/u1', { status: 'active', systemRole: 'user' });
    },
    (res, err, db, auth) => {
      if (res) throw new Error('Expected failure');
      if (!err || !err.message.includes('Access denied: Subscription missing')) {
        throw new Error('Expected Subscription missing error, got: ' + err?.message);
      }
      if (auth.tokensCreated !== 0) throw new Error('Expected no custom token issued');
      if (lastHandoffLog?.accessGranted !== false) throw new Error('Expected accessGranted: false in logs');
      if (lastHandoffLog?.stripeLookupPerformed !== false) throw new Error('Expected stripeLookupPerformed: false in logs');
      if (lastHandoffLog?.selfHealingExecuted !== false) throw new Error('Expected selfHealingExecuted: false in logs');
    }
  );

  await runTest('2. User with active organization successfully completes handoff',
    { uid: 'u1', appId: 'musicscale' },
    db => {
      setupStandardUser(db);
    },
    (res, err, db, auth) => {
      if (err) throw new Error('Expected success, got: ' + err.message);
      if (!res || res.orgId !== 'org1' || res.uid !== 'u1') throw new Error('Mismatched output payload');
      if (!res.customToken.includes('mock-custom-token-for-u1-org-org1')) throw new Error('Incorrect custom token issued');
      if (auth.tokensCreated !== 1) throw new Error('Expected 1 custom token issued');
      if (lastHandoffLog?.accessGranted !== true) throw new Error('Expected accessGranted: true in logs');
      if (lastHandoffLog?.stripeLookupPerformed !== false) throw new Error('Expected stripeLookupPerformed: false');
      if (lastHandoffLog?.selfHealingExecuted !== false) throw new Error('Expected selfHealingExecuted: false');
    }
  );

  await runTest('3. Specific allowed organization requested successfully',
    { uid: 'u1', appId: 'musicscale', orgId: 'org1' },
    db => {
      setupStandardUser(db);
    },
    (res, err, db, auth) => {
      if (err) throw new Error('Expected success, got: ' + err.message);
      if (res.orgId !== 'org1') throw new Error('Expected orgId to be org1');
    }
  );

  await runTest('4. Non-admin requesting unassociated organization is forbidden (cross-tenant violation)',
    { uid: 'u1', appId: 'musicscale', orgId: 'org2' },
    db => {
      setupStandardUser(db);
      // user is associated with org1, but requests org2
      db.setMockData('organizations/org2', { status: 'active' });
    },
    (res, err, db, auth) => {
      if (res) throw new Error('Expected failure');
      if (!err || !err.message.includes('Forbidden: You do not have access to this organization.')) {
        throw new Error('Expected Forbidden access violation, got: ' + err?.message);
      }
      if (auth.tokensCreated !== 0) throw new Error('Expected no token');
    }
  );

  await runTest('5. Global Admin bypassing membership checks for arbitrary organization',
    { uid: 'u1', appId: 'musicscale', orgId: 'orgArbitrary' },
    db => {
      db.setMockData('users/u1', { status: 'active', systemRole: 'ceo' });
      db.setMockData('organizations/orgArbitrary', { status: 'active' });
    },
    (res, err, db, auth) => {
      if (err) throw new Error('Expected success, got: ' + err.message);
      if (res.orgId !== 'orgArbitrary') throw new Error('Expected arbitrary org to be resolved');
      if (auth.tokensCreated !== 1) throw new Error('Expected custom token to be generated');
    }
  );

  await runTest('6. Support mode forbidden for non-admin',
    { uid: 'u1', appId: 'musicscale', supportMode: true },
    db => {
      setupStandardUser(db);
    },
    (res, err, db, auth) => {
      if (res) throw new Error('Expected failure');
      if (!err || !err.message.includes('Forbidden: only global admins can use support mode')) {
        throw new Error('Expected Forbidden support mode error, got: ' + err?.message);
      }
    }
  );

  await runTest('7. Support mode allowed for global admin',
    { uid: 'u1', appId: 'musicscale', supportMode: true, orgId: 'org1' },
    db => {
      db.setMockData('users/u1', { status: 'active', systemRole: 'global_admin' });
      db.setMockData('organizations/org1', { status: 'active' });
    },
    (res, err, db, auth) => {
      if (err) throw new Error('Expected success, got: ' + err.message);
      const claims = auth.customTokenParams[0]?.claims;
      if (claims?.supportMode !== true) throw new Error('Expected supportMode: true in claims');
    }
  );

  await runTest('8. Candidate organizations loops and selects the first active one',
    { uid: 'u1', appId: 'musicscale' },
    db => {
      // org1 is inactive, org2 is active
      db.setMockData('users/u1', {
        status: 'active',
        systemRole: 'user',
        activeOrganizationId: 'org1',
        organizations: ['org1', 'org2']
      });

      // org1 (inactive)
      db.setMockData('organizations/org1', { status: 'active', apps: { musicscale: { status: 'active' } } });
      db.setMockData('organizations/org1/members/u1', { status: 'active', appAccess: { musicscale: { enabled: true } } });
      db.setMockData('subscriptions/org1', { status: 'canceled' }); // inactive sub

      // org2 (active)
      db.setMockData('organizations/org2', { status: 'active', apps: { musicscale: { status: 'active' } } });
      db.setMockData('organizations/org2/members/u1', { status: 'active', appAccess: { musicscale: { enabled: true } } });
      db.setMockData('subscriptions/org2', { status: 'active' }); // active sub
    },
    (res, err, db, auth) => {
      if (err) throw new Error('Expected success, got: ' + err.message);
      if (res.orgId !== 'org2') throw new Error('Expected org2 to be selected because org1 is inactive');
    }
  );

  await runTest('9. Legacy memberships in organization_members collection are searched',
    { uid: 'u1', appId: 'musicscale' },
    db => {
      db.setMockData('users/u1', { status: 'active', systemRole: 'user' });
      // linked via legacy collection
      db.setMockData('organization_members/link1', { uid: 'u1', organizationId: 'org1' });
      
      db.setMockData('organizations/org1', { status: 'active', apps: { musicscale: { status: 'active' } } });
      db.setMockData('organizations/org1/members/u1', { status: 'active', appAccess: { musicscale: { enabled: true } } });
      db.setMockData('subscriptions/org1', { status: 'active' });
    },
    (res, err, db, auth) => {
      if (err) throw new Error('Expected success, got: ' + err.message);
      if (res.orgId !== 'org1') throw new Error('Expected org1 to be found via legacy membership search');
    }
  );

  await runTest('10. Immutability guard - no writes or queries with side-effects on Firestore',
    { uid: 'u1', appId: 'musicscale' },
    db => {
      setupStandardUser(db);
    },
    (res, err, db, auth) => {
      if (db.writeAttempts !== 0 || db.batchAttempts !== 0 || db.transactionAttempts !== 0) {
        throw new Error('Detected write operations on Firestore!');
      }
    }
  );

  await runTest('11. Network guard - zero network calls/Stripe/HTTP executed',
    { uid: 'u1', appId: 'musicscale' },
    db => {
      setupStandardUser(db);
    },
    (res, err, db, auth) => {
      if (networkAttempts !== 0) {
        throw new Error('Detected HTTP/Stripe network attempts!');
      }
    }
  );

  console.log(`\nTests finished. Passed: ${passed}, Failed: ${failed}`);
  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests();
