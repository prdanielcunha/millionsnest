import { handleMusicScaleHandoffRequest } from '../src/server/services/MusicScaleHandoffService.js';
import { DENIAL_REASONS } from '../src/server/services/EcosystemAccessResolver.js';
import * as admin from 'firebase-admin';

// Network block guard
let networkAttempts = 0;
const originalFetch = globalThis.fetch;
let originalHttpReq: any;
let originalHttpsReq: any;
let httpModule: any;
let httpsModule: any;
import { createRequire } from 'module';
const requireModule = createRequire(import.meta.url);
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

// Global assertions tracking
let passedAssertions = 0;
let totalChecksRun = 0;
function assert(condition: boolean, desc: string) {
  totalChecksRun++;
  if (!condition) {
    throw new Error(`Assertion failed: ${desc}`);
  }
  passedAssertions++;
}

// Global registries
const allMockDatabases: MockFirestore[] = [];
const allResponses: FakeResponse[] = [];

class MockDocumentReference {
  constructor(public path: string, private db: MockFirestore) {}
  async get() {
    this.db.documentReads++;
    if (this.db.simulateErrorOnReadPath === this.path) {
      throw new Error('Simulated Read Error');
    }
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
    throw new Error('Query operations like where() are strictly forbidden in this flow.');
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
  public simulateErrorOnReadPath: string | null = null;
  
  constructor() {
    allMockDatabases.push(this);
  }

  setMockData(path: string, data: any) {
    this.data[path] = data;
  }
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

class FakeRequest {
  public headers: Record<string, string | string[]> = {};
  public body: any = undefined;
  constructor(init?: { headers?: Record<string, string | string[]>; body?: any }) {
    if (init?.headers) this.headers = init.headers;
    if (init?.body !== undefined) this.body = init.body;
  }
}

class FakeResponse {
  public statusCode: number = 200;
  public body: any = undefined;
  public headers: Record<string, string> = {};
  public respondedCount: number = 0;

  constructor() {
    allResponses.push(this);
  }

  status(code: number) {
    this.statusCode = code;
    return this;
  }
  json(body: any) {
    if (this.respondedCount > 0) {
      throw new Error('Double response error: json() called multiple times');
    }
    this.body = body;
    this.respondedCount++;
    return this;
  }
  setHeader(name: string, value: string) {
    this.headers[name.toLowerCase()] = value;
  }
}

class MockDependencies {
  public verifyIdTokenCalls = 0;
  public tokenVerifyResult: any = { uid: 'mock-uid' };
  public tokenVerifyError: Error | null = null;
  public createCustomTokenCalls = 0;
  public customTokenError: Error | null = null;
  public db: MockFirestore | null = null;
  public clockValue = 1700000000000;
  public logger?: {
    info?: (...args: any[]) => void;
    warn?: (...args: any[]) => void;
    error?: (...args: any[]) => void;
  };

  async verifyIdToken(token: string) {
    this.verifyIdTokenCalls++;
    if (this.tokenVerifyError) throw this.tokenVerifyError;
    return this.tokenVerifyResult;
  }
  getDb(): admin.firestore.Firestore | null {
    return (this.db as unknown as admin.firestore.Firestore) || null;
  }
  async createCustomToken(uid: string, claims: Record<string, unknown>) {
    this.createCustomTokenCalls++;
    if ((this as any).customTokenError) throw (this as any).customTokenError;
    return `custom-token-for-${uid}`;
  }
  now() {
    return this.clockValue;
  }
}

async function runReq(options: any, deps: MockDependencies) {
  const req = new FakeRequest(options);
  const res = new FakeResponse();
  await handleMusicScaleHandoffRequest(req as any, res as any, deps);
  return res;
}

const setupStandardUserAndOrg = (db: MockFirestore, uid = 'u1', orgId = 'org1', sysRole = 'user', subStatus = 'active', appStatus = 'active') => {
  db.setMockData(`users/${uid}`, { status: 'active', systemRole: sysRole });
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

async function testHarness() {
  installNetworkGuard();
  try {
    let loggedResolverError: any = null;
    let loggedTokenError: any = null;

    // 1 to 11
    {
      const req = new FakeRequest({ headers: {} });
      const res = new FakeResponse();
      const deps = new MockDependencies();
      await handleMusicScaleHandoffRequest(req as any, res as any, deps);
      assert(res.statusCode === 401, '1. header ausente retorna 401');
      assert(res.body.code === 'UNAUTHORIZED', '1. header ausente retorna 401 code');
      
      const req2 = new FakeRequest({ headers: { authorization: 'Basic dXNlcjpwYXNz' } });
      const res2 = new FakeResponse();
      await handleMusicScaleHandoffRequest(req2 as any, res2 as any, deps);
      assert(res2.statusCode === 401, '2. Basic retorna 401');
      assert(res2.body.code === 'UNAUTHORIZED', '2. Basic retorna 401 code');
      
      const req3 = new FakeRequest({ headers: { authorization: 'Bearer ' } });
      const res3 = new FakeResponse();
      await handleMusicScaleHandoffRequest(req3 as any, res3 as any, deps);
      assert(res3.statusCode === 401, '3. Bearer vazio retorna 401');
      
      const req4 = new FakeRequest({ headers: { authorization: 'Bearer invalid' } });
      const res4 = new FakeResponse();
      deps.tokenVerifyError = new Error('invalid token');
      await handleMusicScaleHandoffRequest(req4 as any, res4 as any, deps);
      assert(res4.statusCode === 401, '4. invalid token');
    }

    // Body Validation
    {
      const deps = new MockDependencies();
      deps.tokenVerifyResult = { uid: 'u1' };
      const res = await runReq({ headers: { authorization: 'Bearer t1' } }, deps);
      assert(res.statusCode === 400, '400 missing body');

      const res2 = await runReq({ headers: { authorization: 'Bearer t1' }, body: {} }, deps);
      assert(res2.statusCode === 400, '400 empty body');
      
      const res3 = await runReq({ headers: { authorization: 'Bearer t1' }, body: { appId: 'other' } }, deps);
      assert(res3.statusCode === 400, '400 invalid appId');
      
      const res4 = await runReq({ headers: { authorization: 'Bearer t1' }, body: { appId: 'musicscale' } }, deps);
      assert(res4.statusCode === 400, '400 missing orgId');
    }

    // 500 REAL ERROR
    {
      const db = new MockFirestore();
      setupStandardUserAndOrg(db, 'u1', 'org1', 'user', 'active', 'active');
      db.simulateErrorOnReadPath = 'organizations/org1'; // O banco quebrado que lança durante leitura
      
      const deps = new MockDependencies();
      deps.db = db;
      deps.tokenVerifyResult = { uid: 'u1' };
      deps.logger = {
        error: (err, meta) => { loggedResolverError = meta; }
      };
      const req = new FakeRequest({ headers: { authorization: 'Bearer t1' }, body: { appId: 'musicscale', orgId: 'org1' } });
      const res = new FakeResponse();
      await handleMusicScaleHandoffRequest(req as any, res as any, deps);
      
      assert(res.statusCode === 500, 'statusCode 500');
      assert(res.headers['cache-control'] === 'no-store', 'Cache-Control no-store');
      assert(res.headers['pragma'] === 'no-cache', 'Pragma no-cache');
      assert(res.headers['expires'] === '0', 'Expires 0');
      assert(res.body.retryable === true, 'retryable true no erro 500');
      assert(res.respondedCount === 1, 'respondedCount 1 no 500');

      if (loggedResolverError) {
        const rKeys = Object.keys(loggedResolverError).sort();
        const rExp = ['appId', 'code', 'maskedUid', 'organizationId', 'timestamp'].sort();
        assert(JSON.stringify(rKeys) === JSON.stringify(rExp), 'log do resolvedor possui somente appId, code, maskedUid, organizationId, timestamp no 500');
      } else {
        assert(false, 'loggedResolverError is null');
      }
    }

    // SUBSCRIPTION NOT FOUND
    {
      const db14 = new MockFirestore();
      setupStandardUserAndOrg(db14, 'u1', 'org1', 'user', 'active', 'active');
      db14.setMockData('subscriptions/org1', null);
      const deps14 = new MockDependencies(); deps14.db = db14; deps14.tokenVerifyResult = { uid: 'u1' };
      const res14 = await runReq({ headers: { authorization: 'Bearer t1' }, body: { appId: 'musicscale', orgId: 'org1' }}, deps14);
      assert(res14.body.reason === 'SUBSCRIPTION_NOT_FOUND', 'reason is SUBSCRIPTION_NOT_FOUND');
      assert(res14.body.retryable === true, 'SUBSCRIPTION_NOT_FOUND retryable true');
    }

    // ENTITLEMENT_NOT_CONFIGURED
    {
      const db15 = new MockFirestore();
      setupStandardUserAndOrg(db15, 'u1', 'org1', 'user', 'active', 'active');
      db15.setMockData('organizations/org1', { status: 'active', apps: {} });
      const deps15 = new MockDependencies(); deps15.db = db15; deps15.tokenVerifyResult = { uid: 'u1' };
      const res15 = await runReq({ headers: { authorization: 'Bearer t1' }, body: { appId: 'musicscale', orgId: 'org1' }}, deps15);
      assert(res15.body.reason === 'ENTITLEMENT_NOT_CONFIGURED', 'reason is ENTITLEMENT_NOT_CONFIGURED');
      assert(res15.body.retryable === true, 'ENTITLEMENT_NOT_CONFIGURED retryable true');
    }

    // SUBSCRIPTION_INACTIVE
    {
      const db16 = new MockFirestore();
      setupStandardUserAndOrg(db16, 'u1', 'org1', 'user', 'canceled', 'active');
      const deps16 = new MockDependencies(); deps16.db = db16; deps16.tokenVerifyResult = { uid: 'u1' };
      const res16 = await runReq({ headers: { authorization: 'Bearer t1' }, body: { appId: 'musicscale', orgId: 'org1' }}, deps16);
      assert(res16.body.reason === 'SUBSCRIPTION_INACTIVE', 'reason is SUBSCRIPTION_INACTIVE');
      assert(res16.body.retryable === false, 'SUBSCRIPTION_INACTIVE retryable false');
    }

    // SUBSCRIPTION_PAYMENT_REQUIRED
    {
      const db17 = new MockFirestore();
      setupStandardUserAndOrg(db17, 'u1', 'org1', 'user', 'past_due', 'active');
      const deps17 = new MockDependencies(); deps17.db = db17; deps17.tokenVerifyResult = { uid: 'u1' };
      const res17 = await runReq({ headers: { authorization: 'Bearer t1' }, body: { appId: 'musicscale', orgId: 'org1' }}, deps17);
      assert(res17.body.reason === 'SUBSCRIPTION_PAYMENT_REQUIRED', 'reason is SUBSCRIPTION_PAYMENT_REQUIRED');
      assert(res17.body.retryable === false, 'SUBSCRIPTION_PAYMENT_REQUIRED retryable false');
    }

    // ENTITLEMENT_INACTIVE
    {
      const db18 = new MockFirestore();
      setupStandardUserAndOrg(db18, 'u1', 'org1', 'user', 'active', 'canceled');
      const deps18 = new MockDependencies(); deps18.db = db18; deps18.tokenVerifyResult = { uid: 'u1' };
      const res18 = await runReq({ headers: { authorization: 'Bearer t1' }, body: { appId: 'musicscale', orgId: 'org1' }}, deps18);
      assert(res18.body.reason === 'ENTITLEMENT_INACTIVE', 'reason is ENTITLEMENT_INACTIVE');
      assert(res18.body.retryable === false, 'ENTITLEMENT_INACTIVE retryable false');
    }
    
    // MEMBER_APP_ACCESS_DISABLED
    {
      const db19 = new MockFirestore();
      setupStandardUserAndOrg(db19, 'u1', 'org1', 'user', 'active', 'active');
      db19.setMockData('organizations/org1/members/u1', { 
         uid: 'u1', role: 'member', status: 'active', 
         appAccess: { musicscale: { enabled: false } } 
      });
      const deps19 = new MockDependencies(); deps19.db = db19; deps19.tokenVerifyResult = { uid: 'u1' };
      const res19 = await runReq({ headers: { authorization: 'Bearer t1' }, body: { appId: 'musicscale', orgId: 'org1' }}, deps19);
      assert(res19.statusCode === 403, 'status 403');
      assert(res19.body.reason === DENIAL_REASONS.MEMBER_APP_ACCESS_DISABLED, 'reason === MEMBER_APP_ACCESS_DISABLED');
      assert(res19.body.retryable === false, 'retryable === false');
      assert(deps19.createCustomTokenCalls === 0, 'createCustomTokenCalls === 0');
      assert(res19.respondedCount === 1, 'respondedCount === 1');
    }

    // SUPPORT_MODE_FORBIDDEN
    {
      const db20 = new MockFirestore();
      setupStandardUserAndOrg(db20, 'u1', 'org1', 'user', 'active', 'active'); // normal user
      const deps20 = new MockDependencies(); deps20.db = db20; deps20.tokenVerifyResult = { uid: 'u1' };
      const res20 = await runReq({ headers: { authorization: 'Bearer t1' }, body: { appId: 'musicscale', orgId: 'org1', supportMode: true }}, deps20);
      assert(res20.body.reason === 'SUPPORT_MODE_FORBIDDEN', 'reason is SUPPORT_MODE_FORBIDDEN');
      assert(res20.body.retryable === false, 'SUPPORT_MODE_FORBIDDEN retryable false');
    }
    
    // SUCESSO COMPLETO
    {
      const db21 = new MockFirestore();
      setupStandardUserAndOrg(db21, 'u1', 'org1', 'user', 'active', 'active');
      const deps21 = new MockDependencies(); deps21.db = db21; deps21.tokenVerifyResult = { uid: 'u1' };
      const res21 = await runReq({ headers: { authorization: 'Bearer t1' }, body: { appId: 'musicscale', orgId: 'org1' }}, deps21);
      
      const keys200 = Object.keys(res21.body).sort();
      assert(keys200.length === 7, '200 contém exatamente sete chaves');
      const expectedKeys = ['appId', 'customToken', 'expiresAt', 'orgId', 'protocolVersion', 'supportMode', 'uid'].sort();
      assert(JSON.stringify(keys200) === JSON.stringify(expectedKeys), 'chaves exatas no 200');
      assert(res21.body.appId === 'musicscale', 'appId é musicscale');
      assert(res21.body.protocolVersion === '1.0.0', 'protocolVersion é 1.0.0');
      assert(res21.body.supportMode === false, 'supportMode false no fluxo comum');
      assert(res21.body.expiresAt === deps21.clockValue + 300000, 'expiresAt é exatamente now + 300000');
    }
    
    // SUPPORT MODE SUCESSO
    {
      const db25 = new MockFirestore();
      setupStandardUserAndOrg(db25, 'u1', 'org1', 'global_admin', 'active', 'active');
      const deps25 = new MockDependencies(); deps25.db = db25; deps25.tokenVerifyResult = { uid: 'u1' };
      const res25 = await runReq({ headers: { authorization: 'Bearer t1' }, body: { appId: 'musicscale', orgId: 'org1', supportMode: true }}, deps25);
      assert(res25.body.supportMode === true, 'supportMode true somente quando solicitado e autorizado');
    }
    
    // Log verification for token errors
    {
      const depsToken = new MockDependencies();
      const dbToken = new MockFirestore();
      setupStandardUserAndOrg(dbToken, 'u1', 'org1', 'user', 'active', 'active');
      depsToken.db = dbToken;
      depsToken.tokenVerifyResult = { uid: 'u1' };
      depsToken.customTokenError = new Error('token error');
      depsToken.logger = {
        error: (...args) => { loggedTokenError = args[1] || args[0]; }
      };
      await runReq({ headers: { authorization: 'Bearer t1' }, body: { appId: 'musicscale', orgId: 'org1' } }, depsToken);

      assert(loggedTokenError !== null, 'loggedTokenError exists');
      if (loggedTokenError) {
        const tKeys = Object.keys(loggedTokenError).sort();
        const tExp = ['appId', 'code', 'maskedUid', 'organizationId', 'timestamp'].sort();
        assert(JSON.stringify(tKeys) === JSON.stringify(tExp), 'log de erro do token contém somente chaves seguras');
      }
    }

    // Calculate global stats
    const totalWriteAttempts = allMockDatabases.reduce((sum, db) => sum + db.writeAttempts, 0);
    const totalQueryAttempts = allMockDatabases.reduce((sum, db) => sum + db.queryAttempts, 0);
    const totalBatchAttempts = allMockDatabases.reduce((sum, db) => sum + db.batchAttempts, 0);
    const totalTransactionAttempts = allMockDatabases.reduce((sum, db) => sum + db.transactionAttempts, 0);
    const maximumResponseCount = Math.max(0, ...allResponses.map(response => response.respondedCount));

    assert(networkAttempts === 0, 'networkAttempts === 0');
    assert(totalWriteAttempts === 0, 'totalWriteAttempts === 0');
    assert(totalQueryAttempts === 0, 'totalQueryAttempts === 0');
    assert(totalBatchAttempts === 0, 'totalBatchAttempts === 0');
    assert(totalTransactionAttempts === 0, 'totalTransactionAttempts === 0');
    assert(maximumResponseCount === 1, 'maximumResponseCount === 1');

    console.log(`totalWriteAttempts: ${totalWriteAttempts}`);
    console.log(`totalQueryAttempts: ${totalQueryAttempts}`);
    console.log(`totalBatchAttempts: ${totalBatchAttempts}`);
    console.log(`totalTransactionAttempts: ${totalTransactionAttempts}`);
    console.log(`maximumResponseCount: ${maximumResponseCount}`);
    console.log(`networkAttempts: ${networkAttempts}`);
    console.log(`assertionCount: ${passedAssertions}`);

  } catch (err) {
    console.error(err);
    process.exit(1);
  } finally {
    restoreNetworkGuard();
  }
}
testHarness();
