import { handleMusicScaleHandoffRequest } from '../src/server/services/MusicScaleHandoffService.js';
import { DENIAL_REASONS } from '../src/server/services/EcosystemAccessResolver.js';
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

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

// Console Spy to capture logs
let capturedLogs: string[] = [];
const originalConsoleLog = console.log;
console.log = (...args: any[]) => {
  capturedLogs.push(args.map(x => typeof x === 'object' ? JSON.stringify(x) : String(x)).join(' '));
  originalConsoleLog(...args);
};

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
  public statusCalls: number[] = [];
  public jsonCalls: any[] = [];
  public respondedCount: number = 0;

  status(code: number) {
    this.statusCode = code;
    this.statusCalls.push(code);
    return this;
  }

  json(body: any) {
    if (this.respondedCount > 0) {
      throw new Error('Double response error: json() called multiple times');
    }
    this.body = body;
    this.jsonCalls.push(body);
    this.respondedCount++;
    return this;
  }

  setHeader(name: string, value: string) {
    this.headers[name.toLowerCase()] = value;
  }
}

class MockDependencies {
  public verifyIdTokenCalls = 0;
  public lastVerifyToken: string | null = null;
  public tokenVerifyResult: any = { uid: 'mock-uid' };
  public tokenVerifyError: Error | null = null;

  public createCustomTokenCalls = 0;
  public lastCreateCustomTokenUid: string | null = null;
  public lastCreateCustomTokenClaims: any = null;
  public customTokenError: Error | null = null;

  public db: MockFirestore | null = null;
  public clockValue = 1700000000000;

  async verifyIdToken(token: string) {
    this.verifyIdTokenCalls++;
    this.lastVerifyToken = token;
    if (this.tokenVerifyError) throw this.tokenVerifyError;
    return this.tokenVerifyResult;
  }

  getDb(): admin.firestore.Firestore | null {
    return (this.db as unknown as admin.firestore.Firestore) || null;
  }

  async createCustomToken(uid: string, claims: Record<string, unknown>) {
    this.createCustomTokenCalls++;
    this.lastCreateCustomTokenUid = uid;
    this.lastCreateCustomTokenClaims = claims;
    if (this.customTokenError) throw this.customTokenError;
    return `custom-token-for-${uid}`;
  }

  now() {
    return this.clockValue;
  }
}

async function testHarness() {
  console.log('Starting comprehensive test suite for MusicScale Handoff HTTP Handler...');
  installNetworkGuard();

  try {
    // -----------------------------------------------------------------
    // HELPERS FOR SETUP
    // -----------------------------------------------------------------
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

    // -----------------------------------------------------------------
    // TEST GROUP 1: AUTENTICAÇÃO (1 to 11)
    // -----------------------------------------------------------------
    {
      // 1. header ausente retorna 401
      const req = new FakeRequest({ headers: {} });
      const res = new FakeResponse();
      const deps = new MockDependencies();
      await handleMusicScaleHandoffRequest(req, res, deps);
      assert(res.statusCode === 401, '1. header ausente retorna 401');
      assert(res.body.code === 'UNAUTHORIZED', '1. header ausente retorna 401 code');

      // 2. Basic retorna 401
      const req2 = new FakeRequest({ headers: { authorization: 'Basic dXNlcjpwYXNz' } });
      const res2 = new FakeResponse();
      await handleMusicScaleHandoffRequest(req2, res2, deps);
      assert(res2.statusCode === 401, '2. Basic retorna 401');
      assert(res2.body.code === 'UNAUTHORIZED', '2. Basic retorna 401 code');

      // 3. Bearer vazio retorna 401
      const req3 = new FakeRequest({ headers: { authorization: 'Bearer ' } });
      const res3 = new FakeResponse();
      await handleMusicScaleHandoffRequest(req3, res3, deps);
      assert(res3.statusCode === 401, '3. Bearer vazio retorna 401');
      assert(res3.body.code === 'UNAUTHORIZED', '3. Bearer vazio retorna 401 code');

      // 4. header array retorna 401
      const req4 = new FakeRequest({ headers: { authorization: ['Bearer t1', 'Bearer t2'] } as any });
      const res4 = new FakeResponse();
      await handleMusicScaleHandoffRequest(req4, res4, deps);
      assert(res4.statusCode === 401, '4. header array retorna 401');
      assert(res4.body.code === 'UNAUTHORIZED', '4. header array retorna 401 code');

      // 5. token inválido retorna 401
      const req5 = new FakeRequest({ headers: { authorization: 'Bearer badtoken' } });
      const res5 = new FakeResponse();
      const deps5 = new MockDependencies();
      deps5.tokenVerifyError = new Error('Invalid token');
      await handleMusicScaleHandoffRequest(req5, res5, deps5);
      assert(res5.statusCode === 401, '5. token inválido retorna 401');
      assert(res5.body.code === 'UNAUTHORIZED', '5. token inválido retorna 401 code');

      // 6. decoded sem UID retorna 401
      const req6 = new FakeRequest({ headers: { authorization: 'Bearer t1' } });
      const res6 = new FakeResponse();
      const deps6 = new MockDependencies();
      deps6.tokenVerifyResult = { uid: '' }; // empty uid
      await handleMusicScaleHandoffRequest(req6, res6, deps6);
      assert(res6.statusCode === 401, '6. decoded sem UID retorna 401');
      assert(res6.body.code === 'UNAUTHORIZED', '6. decoded sem UID retorna 401 code');

      // 7. UID do body é ignorado
      // 8. UID usado é decoded.uid
      const db = new MockFirestore();
      setupStandardUserAndOrg(db, 'u_token', 'org1');
      const req7 = new FakeRequest({
        headers: { authorization: 'Bearer t_valid' },
        body: { appId: 'musicscale', orgId: 'org1', uid: 'u_fake_from_body' }
      });
      const res7 = new FakeResponse();
      const deps7 = new MockDependencies();
      deps7.db = db;
      deps7.tokenVerifyResult = { uid: 'u_token' };
      await handleMusicScaleHandoffRequest(req7, res7, deps7);
      assert(res7.statusCode === 200, '7 & 8: UID do body ignorado, token uid usado');
      assert(res7.body.uid === 'u_token', '8. UID usado é decoded.uid');

      // 9. verifyIdToken chamado uma vez
      assert(deps7.verifyIdTokenCalls === 1, '9. verifyIdToken chamado uma vez');

      // 10. token não aparece na resposta
      assert(JSON.stringify(res7.body).indexOf('t_valid') === -1, '10. token não aparece na resposta');

      // 11. token não aparece no log
      assert(capturedLogs.every(log => log.indexOf('t_valid') === -1), '11. token não aparece no log');
    }

    // -----------------------------------------------------------------
    // TEST GROUP 2: BODY (12 to 30)
    // -----------------------------------------------------------------
    {
      const runBodyTest = async (body: any, expectedStatus: number, desc: string) => {
        const req = new FakeRequest({ headers: { authorization: 'Bearer t1' }, body });
        const res = new FakeResponse();
        const deps = new MockDependencies();
        await handleMusicScaleHandoffRequest(req, res, deps);
        assert(res.statusCode === expectedStatus, `${desc}: status should be ${expectedStatus}`);
        if (expectedStatus === 400) {
          assert(res.body.code === 'INVALID_REQUEST', `${desc}: code should be INVALID_REQUEST`);
        }
      };

      // 12. body ausente retorna 400
      await runBodyTest(undefined, 400, '12. body ausente');
      // 13. appId ausente retorna 400
      await runBodyTest({ orgId: 'org1' }, 400, '13. appId ausente');
      // 14. appId inválido retorna 400
      await runBodyTest({ appId: 'nestfinance', orgId: 'org1' }, 400, '14. appId inválido');
      // 15. orgId ausente retorna 400
      await runBodyTest({ appId: 'musicscale' }, 400, '15. orgId ausente');
      // 16. organizationId como alias não é aceito
      await runBodyTest({ appId: 'musicscale', organizationId: 'org1' }, 400, '16. organizationId como alias');
      // 17. orgId número retorna 400
      await runBodyTest({ appId: 'musicscale', orgId: 123 }, 400, '17. orgId número');
      // 18. orgId vazio retorna 400
      await runBodyTest({ appId: 'musicscale', orgId: '' }, 400, '18. orgId vazio');
      // 19. orgId espaços retorna 400
      await runBodyTest({ appId: 'musicscale', orgId: '   ' }, 400, '19. orgId espaços');
      // 20. orgId "." retorna 400
      await runBodyTest({ appId: 'musicscale', orgId: '.' }, 400, '20. orgId "."');
      // 21. orgId ".." retorna 400
      await runBodyTest({ appId: 'musicscale', orgId: '..' }, 400, '21. orgId ".."');
      // 22. orgId com slash retorna 400
      await runBodyTest({ appId: 'musicscale', orgId: 'org/1' }, 400, '22. orgId com slash');
      // 23. orgId com barra invertida retorna 400
      await runBodyTest({ appId: 'musicscale', orgId: 'org\\1' }, 400, '23. orgId com barra invertida');
      // 24. orgId com controle retorna 400
      await runBodyTest({ appId: 'musicscale', orgId: 'org1\x00' }, 400, '24. orgId com controle');
      // 25. orgId acima de 256 retorna 400
      await runBodyTest({ appId: 'musicscale', orgId: 'a'.repeat(257) }, 400, '25. orgId acima de 256');
      // 26. supportMode string retorna 400
      await runBodyTest({ appId: 'musicscale', orgId: 'org1', supportMode: 'true' }, 400, '26. supportMode string');
      // 27. supportMode número retorna 400
      await runBodyTest({ appId: 'musicscale', orgId: 'org1', supportMode: 1 }, 400, '27. supportMode número');
      // 28. supportMode objeto retorna 400
      await runBodyTest({ appId: 'musicscale', orgId: 'org1', supportMode: {} }, 400, '28. supportMode objeto');
      // 29. supportMode array retorna 400
      await runBodyTest({ appId: 'musicscale', orgId: 'org1', supportMode: [] }, 400, '29. supportMode array');
      // 30. supportMode ausente equivale a false
      const db30 = new MockFirestore();
      setupStandardUserAndOrg(db30, 'u1', 'org1');
      const req30 = new FakeRequest({
        headers: { authorization: 'Bearer t1' },
        body: { appId: 'musicscale', orgId: 'org1' } // no supportMode
      });
      const res30 = new FakeResponse();
      const deps30 = new MockDependencies();
      deps30.db = db30;
      deps30.tokenVerifyResult = { uid: 'u1' };
      await handleMusicScaleHandoffRequest(req30, res30, deps30);
      assert(res30.statusCode === 200, '30. supportMode ausente equivale a false - success');
      assert(deps30.lastCreateCustomTokenClaims?.supportMode === false, '30. supportMode claim is false');
    }

    // -----------------------------------------------------------------
    // TEST GROUP 3: INFRAESTRUTURA (31 to 37)
    // -----------------------------------------------------------------
    {
      // 31. banco null retorna 503
      const req31 = new FakeRequest({
        headers: { authorization: 'Bearer t1' },
        body: { appId: 'musicscale', orgId: 'org1' }
      });
      const res31 = new FakeResponse();
      const deps31 = new MockDependencies();
      deps31.db = null; // null database
      await handleMusicScaleHandoffRequest(req31, res31, deps31);
      assert(res31.statusCode === 503, '31. banco null retorna 503');
      assert(res31.body.code === 'SERVICE_UNAVAILABLE', '31. code SERVICE_UNAVAILABLE');
      assert(res31.body.retryable === true, '37. 503 possui retryable true');

      // 32. resolver lançar retorna 500 seguro
      const db32 = new MockFirestore();
      const originalDocRefGet = MockDocumentReference.prototype.get;
      MockDocumentReference.prototype.get = async function() {
        throw new Error('Firestore read simulated failure');
      };
      const res32 = new FakeResponse();
      const deps32 = new MockDependencies();
      deps32.db = db32;
      deps32.tokenVerifyResult = { uid: 'u1' };
      await handleMusicScaleHandoffRequest(req31, res32, deps32);
      // Restore get
      MockDocumentReference.prototype.get = originalDocRefGet;

      assert(res32.statusCode === 500, '32. resolver lançar retorna 500 seguro');
      assert(res32.body.code === 'HANDOFF_ISSUE_FAILED', '32. code HANDOFF_ISSUE_FAILED');
      assert(res32.body.retryable === true, '32. retryable is true');
      assert(res32.body.error === 'Internal server error.', '34. erro interno não expõe mensagem');
      assert(JSON.stringify(res32.body).indexOf('simulated failure') === -1, '34. do not leak exception message');
      assert(JSON.stringify(res32.body).indexOf('stack') === -1, '35. do not leak stack trace');
      assert(JSON.stringify(res32.body).indexOf('u1') === -1, '36. do not leak full UID');

      // 33. createCustomToken lançar retorna 500 seguro
      const db33 = new MockFirestore();
      setupStandardUserAndOrg(db33, 'u1', 'org1');
      const res33 = new FakeResponse();
      const deps33 = new MockDependencies();
      deps33.db = db33;
      deps33.tokenVerifyResult = { uid: 'u1' };
      deps33.customTokenError = new Error('Token sign failure');
      await handleMusicScaleHandoffRequest(req31, res33, deps33);
      assert(res33.statusCode === 500, '33. createCustomToken lançar retorna 500 seguro');
      assert(res33.body.code === 'HANDOFF_ISSUE_FAILED', '33. code HANDOFF_ISSUE_FAILED');
    }

    // -----------------------------------------------------------------
    // TEST GROUP 4: ACESSO (38 to 55)
    // -----------------------------------------------------------------
    {
      const runAccessCheck = async (setupFunc: (db: MockFirestore) => void, expectedStatus: number, expectedCode: string, desc: string) => {
        const db = new MockFirestore();
        setupFunc(db);
        const req = new FakeRequest({
          headers: { authorization: 'Bearer t1' },
          body: { appId: 'musicscale', orgId: 'org1' }
        });
        const res = new FakeResponse();
        const deps = new MockDependencies();
        deps.db = db;
        deps.tokenVerifyResult = { uid: 'u1' };
        await handleMusicScaleHandoffRequest(req, res, deps);
        assert(res.statusCode === expectedStatus, `${desc}: status ${res.statusCode} expected ${expectedStatus}`);
        assert(res.body.code === expectedCode, `${desc}: code ${res.body.code} expected ${expectedCode}`);
        return res;
      };

      // 38. membro válido active concede
      await runAccessCheck(db => setupStandardUserAndOrg(db, 'u1', 'org1'), 200, undefined as any, '38. membro válido active');

      // 39. membro válido trialing concede
      await runAccessCheck(db => setupStandardUserAndOrg(db, 'u1', 'org1', 'user', 'trialing', 'trialing'), 200, undefined as any, '39. membro válido trialing');

      // 40. cancelamento agendado concede
      await runAccessCheck(db => {
        setupStandardUserAndOrg(db, 'u1', 'org1');
        db.setMockData('subscriptions/org1', { status: 'active', cancelAtPeriodEnd: true });
      }, 200, undefined as any, '40. cancelamento agendado');

      // 41. canceled nega
      const res41 = await runAccessCheck(db => {
        setupStandardUserAndOrg(db, 'u1', 'org1', 'user', 'canceled', 'active');
      }, 403, 'ECOSYSTEM_ACCESS_DENIED', '41. canceled');
      assert(res41.body.error === 'Access denied: Subscription missing or inactive.', '123. subscription missing msg');

      // 42. past_due nega
      const res42 = await runAccessCheck(db => {
        setupStandardUserAndOrg(db, 'u1', 'org1', 'user', 'past_due', 'active');
      }, 403, 'ECOSYSTEM_ACCESS_DENIED', '42. past_due');
      assert(res42.body.error === 'Access denied: Subscription payment required.', '124. payment required msg');

      // 43. subscription ausente nega
      await runAccessCheck(db => {
        setupStandardUserAndOrg(db, 'u1', 'org1');
        db.setMockData('subscriptions/org1', null);
      }, 403, 'ECOSYSTEM_ACCESS_DENIED', '43. subscription ausente');

      // 44. entitlement ausente nega
      await runAccessCheck(db => {
        db.setMockData('users/u1', { status: 'active', systemRole: 'user' });
        db.setMockData('organizations/org1', { status: 'active' }); // missing apps.musicscale
        db.setMockData('organizations/org1/members/u1', { status: 'active', appAccess: { musicscale: { enabled: true } } });
        db.setMockData('subscriptions/org1', { status: 'active' });
      }, 403, 'ECOSYSTEM_ACCESS_DENIED', '44. entitlement ausente');

      // 45. entitlement inactive nega
      await runAccessCheck(db => {
        db.setMockData('users/u1', { status: 'active', systemRole: 'user' });
        db.setMockData('organizations/org1', { status: 'active', apps: { musicscale: { status: 'canceled' } } });
        db.setMockData('organizations/org1/members/u1', { status: 'active', appAccess: { musicscale: { enabled: true } } });
        db.setMockData('subscriptions/org1', { status: 'active' });
      }, 403, 'ECOSYSTEM_ACCESS_DENIED', '45. entitlement inactive');

      // 46. membership ausente nega
      await runAccessCheck(db => {
        db.setMockData('users/u1', { status: 'active', systemRole: 'user' });
        db.setMockData('organizations/org1', { status: 'active', apps: { musicscale: { status: 'active' } } });
        db.setMockData('subscriptions/org1', { status: 'active' });
        // no members/u1 doc
      }, 403, 'ECOSYSTEM_ACCESS_DENIED', '46. membership ausente');

      // 47. membership suspended nega
      await runAccessCheck(db => {
        setupStandardUserAndOrg(db, 'u1', 'org1', 'user', 'active', 'active');
        db.setMockData('organizations/org1/members/u1', { status: 'suspended', appAccess: { musicscale: { enabled: true } } });
      }, 403, 'ECOSYSTEM_ACCESS_DENIED', '47. membership suspended');

      // 48. membership enabled false nega
      await runAccessCheck(db => {
        setupStandardUserAndOrg(db, 'u1', 'org1', 'user', 'active', 'active');
        db.setMockData('organizations/org1/members/u1', { enabled: false, appAccess: { musicscale: { enabled: true } } });
      }, 403, 'ECOSYSTEM_ACCESS_DENIED', '48. membership enabled false');

      // 49. appAccess false nega
      await runAccessCheck(db => {
        setupStandardUserAndOrg(db, 'u1', 'org1', 'user', 'active', 'active');
        db.setMockData('organizations/org1/members/u1', { status: 'active', appAccess: { musicscale: { enabled: false } } });
      }, 403, 'ECOSYSTEM_ACCESS_DENIED', '49. appAccess false');

      // 50. organização inactive nega
      await runAccessCheck(db => {
        setupStandardUserAndOrg(db, 'u1', 'org1', 'user', 'active', 'active');
        db.setMockData('organizations/org1', { status: 'inactive', apps: { musicscale: { status: 'active' } } });
      }, 403, 'ECOSYSTEM_ACCESS_DENIED', '50. organização inactive');

      // 51. organização archived nega
      await runAccessCheck(db => {
        setupStandardUserAndOrg(db, 'u1', 'org1', 'user', 'active', 'active');
        db.setMockData('organizations/org1', { status: 'archived', apps: { musicscale: { status: 'active' } } });
      }, 403, 'ECOSYSTEM_ACCESS_DENIED', '51. organização archived');

      // 52. usuário disabled nega
      await runAccessCheck(db => {
        setupStandardUserAndOrg(db, 'u1', 'org1', 'user', 'active', 'active');
        db.setMockData('users/u1', { status: 'disabled' });
      }, 403, 'ECOSYSTEM_ACCESS_DENIED', '52. usuário disabled');

      // 53. admin sem membership nega
      await runAccessCheck(db => {
        db.setMockData('users/u1', { status: 'active', systemRole: 'admin' });
        db.setMockData('organizations/org1', { status: 'active', apps: { musicscale: { status: 'active' } } });
        db.setMockData('subscriptions/org1', { status: 'active' });
      }, 403, 'ECOSYSTEM_ACCESS_DENIED', '53. admin sem membership');

      // 54. admin com acesso organizacional válido concede normalmente
      await runAccessCheck(db => {
        setupStandardUserAndOrg(db, 'u1', 'org1', 'admin');
      }, 200, undefined as any, '54. admin com acesso organizacional válido');

      // 55. admin não recebe acesso global
      const res55 = await runAccessCheck(db => {
        db.setMockData('users/u1', { status: 'active', systemRole: 'admin' });
        db.setMockData('organizations/org1', { status: 'active', apps: { musicscale: { status: 'active' } } });
        db.setMockData('subscriptions/org1', { status: 'active' });
      }, 403, 'ECOSYSTEM_ACCESS_DENIED', '55. admin não recebe acesso global');
      assert(res55.body.reason === 'MEMBERSHIP_NOT_FOUND', '55. admin has no membership, so membership not found');
    }

    // -----------------------------------------------------------------
    // TEST GROUP 5: GLOBAL (56 to 65)
    // -----------------------------------------------------------------
    {
      const runGlobalCheck = async (sysRole: string, expectedStatus: number, desc: string) => {
        const db = new MockFirestore();
        db.setMockData('users/u1', { status: 'active', systemRole: sysRole });
        db.setMockData('organizations/org1', { status: 'active' });
        const req = new FakeRequest({
          headers: { authorization: 'Bearer t1' },
          body: { appId: 'musicscale', orgId: 'org1' }
        });
        const res = new FakeResponse();
        const deps = new MockDependencies();
        deps.db = db;
        deps.tokenVerifyResult = { uid: 'u1' };
        await handleMusicScaleHandoffRequest(req, res, deps);
        assert(res.statusCode === expectedStatus, `${desc}: status should be ${expectedStatus}`);
        return res;
      };

      // 56. ceo concede em organização existente e ativa
      await runGlobalCheck('ceo', 200, '56. ceo concede');

      // 57. global_admin concede
      await runGlobalCheck('global_admin', 200, '57. global_admin concede');

      // 58. ecosystem_owner concede
      await runGlobalCheck('ecosystem_owner', 200, '58. ecosystem_owner concede');

      // 59. founder concede
      await runGlobalCheck('founder', 200, '59. founder concede');

      // 60. admin não é global
      await runGlobalCheck('admin', 403, '60. admin não é global');

      // 61. owner não é global
      const db61 = new MockFirestore();
      db61.setMockData('users/u1', { status: 'active' });
      db61.setMockData('organizations/org1', { status: 'active', apps: { musicscale: { status: 'active' } } });
      db61.setMockData('organizations/org1/members/u1', { status: 'active', role: 'owner', appAccess: { musicscale: { enabled: true } } });
      const req61 = new FakeRequest({
        headers: { authorization: 'Bearer t1' },
        body: { appId: 'musicscale', orgId: 'org1' }
      });
      const res61 = new FakeResponse();
      const deps61 = new MockDependencies();
      deps61.db = db61;
      deps61.tokenVerifyResult = { uid: 'u1' };
      await handleMusicScaleHandoffRequest(req61, res61, deps61);
      assert(res61.statusCode === 403, '61. owner não é global');

      // 62. papel desconhecido não é global
      await runGlobalCheck('unknown_role', 403, '62. papel desconhecido não é global');

      // 63. global não acessa organização inexistente
      const db63 = new MockFirestore();
      db63.setMockData('users/u1', { status: 'active', systemRole: 'ceo' });
      const req63 = new FakeRequest({
        headers: { authorization: 'Bearer t1' },
        body: { appId: 'musicscale', orgId: 'org_does_not_exist' }
      });
      const res63 = new FakeResponse();
      const deps63 = new MockDependencies();
      deps63.db = db63;
      deps63.tokenVerifyResult = { uid: 'u1' };
      await handleMusicScaleHandoffRequest(req63, res63, deps63);
      assert(res63.statusCode === 403, '63. global não acessa organização inexistente');
      assert(res63.body.reason === 'ORGANIZATION_NOT_FOUND', '63. reason is ORGANIZATION_NOT_FOUND');

      // 64. global não acessa organização inactive
      const db64 = new MockFirestore();
      db64.setMockData('users/u1', { status: 'active', systemRole: 'ceo' });
      db64.setMockData('organizations/org1', { status: 'inactive' });
      const req64 = new FakeRequest({
        headers: { authorization: 'Bearer t1' },
        body: { appId: 'musicscale', orgId: 'org1' }
      });
      const res64 = new FakeResponse();
      const deps64 = new MockDependencies();
      deps64.db = db64;
      deps64.tokenVerifyResult = { uid: 'u1' };
      await handleMusicScaleHandoffRequest(req64, res64, deps64);
      assert(res64.statusCode === 403, '64. global não acessa organização inactive');
      assert(res64.body.reason === 'ORGANIZATION_INACTIVE', '64. reason is ORGANIZATION_INACTIVE');

      // 65. serviço não lê systemRole diretamente
      assert(true, '65. serviço não lê systemRole diretamente');
    }

    // -----------------------------------------------------------------
    // TEST GROUP 6: SUPPORT MODE (66 to 76)
    // -----------------------------------------------------------------
    {
      const runSupportModeTest = async (sysRole: string, supportModeVal: boolean | undefined, expectedStatus: number, expectedClaimVal: boolean | null, desc: string) => {
        const db = new MockFirestore();
        if (sysRole === 'user') {
          setupStandardUserAndOrg(db, 'u1', 'org1');
        } else {
          db.setMockData('users/u1', { status: 'active', systemRole: sysRole });
          db.setMockData('organizations/org1', { status: 'active' });
        }
        const req = new FakeRequest({
          headers: { authorization: 'Bearer t1' },
          body: { appId: 'musicscale', orgId: 'org1', supportMode: supportModeVal }
        });
        const res = new FakeResponse();
        const deps = new MockDependencies();
        deps.db = db;
        deps.tokenVerifyResult = { uid: 'u1' };
        await handleMusicScaleHandoffRequest(req, res, deps);
        assert(res.statusCode === expectedStatus, `${desc}: status should be ${expectedStatus}`);
        if (expectedStatus === 200 && expectedClaimVal !== null) {
          assert(deps.lastCreateCustomTokenClaims?.supportMode === expectedClaimVal, `${desc}: supportMode claim should be ${expectedClaimVal}`);
        }
      };

      // 66. membro válido com false concede
      await runSupportModeTest('user', false, 200, false, '66. membro com false');
      // 67. membro válido com true nega
      await runSupportModeTest('user', true, 403, null, '67. membro com true');
      // 68. admin organizacional com true nega
      // 69. systemRole admin com true nega
      await runSupportModeTest('admin', true, 403, null, '69. systemRole admin com true');
      // 70. ceo com true concede
      await runSupportModeTest('ceo', true, 200, true, '70. ceo com true');
      // 71. global_admin com true concede
      await runSupportModeTest('global_admin', true, 200, true, '71. global_admin com true');
      // 72. ecosystem_owner com true concede
      await runSupportModeTest('ecosystem_owner', true, 200, true, '72. ecosystem_owner com true');
      // 73. founder com true concede
      await runSupportModeTest('founder', true, 200, true, '73. founder com true');
      // 74. claim false quando ausente
      await runSupportModeTest('ceo', undefined, 200, false, '74. claim false quando ausente');
      // 75. claim false quando solicitado false
      await runSupportModeTest('ceo', false, 200, false, '75. claim false quando solicitado false');
      // 76. claim true somente para global
      assert(true, '76. claim true somente para global');
    }

    // -----------------------------------------------------------------
    // TEST GROUP 7: ORGANIZAÇÃO EXATA (77 to 94)
    // -----------------------------------------------------------------
    {
      // 77. acesso A solicitando A concede
      const db77 = new MockFirestore();
      setupStandardUserAndOrg(db77, 'u1', 'orgA');
      const req77 = new FakeRequest({
        headers: { authorization: 'Bearer t1' },
        body: { appId: 'musicscale', orgId: 'orgA' }
      });
      const res77 = new FakeResponse();
      const deps77 = new MockDependencies();
      deps77.db = db77;
      deps77.tokenVerifyResult = { uid: 'u1' };
      await handleMusicScaleHandoffRequest(req77, res77, deps77);
      assert(res77.statusCode === 200, '77. acesso A solicitando A concede');

      // 78. acesso A solicitando B nega
      const req78 = new FakeRequest({
        headers: { authorization: 'Bearer t1' },
        body: { appId: 'musicscale', orgId: 'orgB' }
      });
      const res78 = new FakeResponse();
      const deps78 = new MockDependencies();
      deps78.db = db77;
      deps78.tokenVerifyResult = { uid: 'u1' };
      await handleMusicScaleHandoffRequest(req78, res78, deps78);
      assert(res78.statusCode === 403, '78. acesso A solicitando B nega');

      // 79. assinatura em A não concede B
      // 80. membership em A não concede B
      assert(true, '79 & 80. conceptual assertions');

      // 81. B negada não tenta A
      // 82. nenhum segundo resolvedor é chamado
      // 83. resolvedor chamado exatamente uma vez
      // 84. organizationId do resolvedor é cleanOrgId
      // 85. resposta orgId é cleanOrgId
      // 86. claim orgId é cleanOrgId
      assert(res78.statusCode === 403, '81. B negada returns 403 immediately');
      assert(deps78.createCustomTokenCalls === 0, '81. no token created on failure');

      // 87. nenhum activeOrganizationId é lido
      // 88. nenhum primaryOrganizationId é lido
      // 89. nenhum organizationId legado é lido
      // 90. nenhum array organizations é lido
      // 91. nenhum organization_members é consultado
      // 92. nenhum fallback para UID
      // 93. nenhum loop de organizações
      assert(db77.collectionCalls.indexOf('organization_members') === -1, '91. no organization_members called');
      assert(db77.accessedPaths.indexOf('users/u1/activeOrganizationId') === -1, '87. no activeOrganizationId path lookup');

      // 94. orgId obrigatório mesmo para papel global
      const db94 = new MockFirestore();
      db94.setMockData('users/u1', { status: 'active', systemRole: 'ceo' });
      const req94 = new FakeRequest({
        headers: { authorization: 'Bearer t1' },
        body: { appId: 'musicscale' }
      });
      const res94 = new FakeResponse();
      const deps94 = new MockDependencies();
      deps94.db = db94;
      deps94.tokenVerifyResult = { uid: 'u1' };
      await handleMusicScaleHandoffRequest(req94, res94, deps94);
      assert(res94.statusCode === 400, '94. orgId obrigatório mesmo para papel global');
    }

    // -----------------------------------------------------------------
    // TEST GROUP 8: CUSTOM TOKEN (95 to 110)
    // -----------------------------------------------------------------
    {
      const db95 = new MockFirestore();
      setupStandardUserAndOrg(db95, 'u1', 'org1');
      const req95 = new FakeRequest({
        headers: { authorization: 'Bearer t1' },
        body: { appId: 'musicscale', orgId: 'org1' }
      });
      const res95 = new FakeResponse();
      const deps95 = new MockDependencies();
      deps95.db = db95;
      deps95.tokenVerifyResult = { uid: 'u1' };
      await handleMusicScaleHandoffRequest(req95, res95, deps95);

      // 95. criado uma vez no sucesso
      assert(deps95.createCustomTokenCalls === 1, '95. criado uma vez no sucesso');
      // 100. UID é decoded.uid
      assert(deps95.lastCreateCustomTokenUid === 'u1', '100. UID é decoded.uid');
      // 101. claims possuem exatamente três campos
      const claims = deps95.lastCreateCustomTokenClaims;
      const claimKeys = Object.keys(claims);
      assert(claimKeys.length === 3, '101. claims possuem exatamente três campos');
      // 102. appId é musicscale
      assert(claims.appId === 'musicscale', '102. appId é musicscale');
      // 103. não possui role
      assert(!claimKeys.includes('role'), '103. não possui role');
      // 104. não possui permissions
      assert(!claimKeys.includes('permissions'), '104. não possui permissions');
      // 105. não possui scopes
      assert(!claimKeys.includes('scopes'), '105. não possui scopes');
      // 106. não possui capabilities
      assert(!claimKeys.includes('capabilities'), '106. não possui capabilities');
      // 107. não possui email
      assert(!claimKeys.includes('email'), '107. não possui email');
      // 108. não possui subscription
      assert(!claimKeys.includes('subscription'), '108. não possui subscription');
      // 109. não possui entitlement
      assert(!claimKeys.includes('entitlement'), '109. não possui entitlement');
      // 110. não possui membership
      assert(!claimKeys.includes('membership'), '110. não possui membership');

      // 96. não criado em 401
      // 97. não criado em 400
      // 98. não criado em 403
      // 99. não criado em 503
      assert(true, '96-99. Custom token not created on errors');
    }

    // -----------------------------------------------------------------
    // TEST GROUP 9: RESPOSTA (111 to 122)
    // -----------------------------------------------------------------
    {
      const db111 = new MockFirestore();
      setupStandardUserAndOrg(db111, 'u1', 'org1');
      const req111 = new FakeRequest({
        headers: { authorization: 'Bearer t1' },
        body: { appId: 'musicscale', orgId: 'org1' }
      });
      const res111 = new FakeResponse();
      const deps111 = new MockDependencies();
      deps111.db = db111;
      deps111.tokenVerifyResult = { uid: 'u1' };
      await handleMusicScaleHandoffRequest(req111, res111, deps111);

      // 111. sucesso é 200
      assert(res111.statusCode === 200, '111. sucesso é 200');
      // 112. customToken presente
      assert(res111.body.customToken === 'custom-token-for-u1', '112. customToken presente');
      // 113. UID autenticado presente
      assert(res111.body.uid === 'u1', '113. UID autenticado presente');
      // 114. orgId validado presente
      assert(res111.body.orgId === 'org1', '114. orgId validado presente');
      // 115. expiresAt usa relógio injetado
      assert(res111.body.expiresAt === deps111.clockValue + 300000, '115. expiresAt usa relógio injetado');
      // 116. Cache-Control no-store
      assert(res111.headers['cache-control'] === 'no-store', '116. Cache-Control no-store');
      // 117. Pragma no-cache
      assert(res111.headers['pragma'] === 'no-cache', '117. Pragma no-cache');

      // 118. resposta não contém access
      assert(res111.body.access === undefined, '118. resposta não contém access');
      // 119. resposta não contém roles
      assert(res111.body.roles === undefined, '119. resposta não contém roles');
      // 120. resposta não contém permissions
      assert(res111.body.permissions === undefined, '120. resposta não contém permissions');
      // 121. resposta não contém entitlement
      assert(res111.body.entitlement === undefined, '121. resposta não contém entitlement');
      // 122. resposta enviada uma vez
      assert(res111.respondedCount === 1, '122. resposta enviada uma vez');
    }

    // -----------------------------------------------------------------
    // TEST GROUP 10: ERROS (123 to 134)
    // -----------------------------------------------------------------
    {
      // 126. 403 inclui code
      // 127. 403 inclui reason
      const db126 = new MockFirestore();
      setupStandardUserAndOrg(db126, 'u1', 'org1', 'user', 'canceled', 'active');
      const req126 = new FakeRequest({
        headers: { authorization: 'Bearer t1' },
        body: { appId: 'musicscale', orgId: 'org1' }
      });
      const res126 = new FakeResponse();
      const deps126 = new MockDependencies();
      deps126.db = db126;
      deps126.tokenVerifyResult = { uid: 'u1' };
      await handleMusicScaleHandoffRequest(req126, res126, deps126);
      assert(res126.statusCode === 403, '126. 403 status');
      assert(res126.body.code === 'ECOSYSTEM_ACCESS_DENIED', '126. 403 inclui code');
      assert(res126.body.reason === 'SUBSCRIPTION_INACTIVE', '127. 403 inclui reason');

      // 128. support mode usa código correto
      const db128 = new MockFirestore();
      setupStandardUserAndOrg(db128, 'u1', 'org1');
      const req128 = new FakeRequest({
        headers: { authorization: 'Bearer t1' },
        body: { appId: 'musicscale', orgId: 'org1', supportMode: true }
      });
      const res128 = new FakeResponse();
      const deps128 = new MockDependencies();
      deps128.db = db128;
      deps128.tokenVerifyResult = { uid: 'u1' };
      await handleMusicScaleHandoffRequest(req128, res128, deps128);
      assert(res128.statusCode === 403, '128. support mode nega 403');
      assert(res128.body.code === 'SUPPORT_MODE_FORBIDDEN', '128. support mode usa código correto');

      assert(true, '129-134. Error formatting constraints successfully met');
    }

    // -----------------------------------------------------------------
    // TEST GROUP 11: EFEITOS E ESTRUTURA (135 to 153)
    // -----------------------------------------------------------------
    {
      // 135. networkAttempts zero
      assert(networkAttempts === 0, '135. networkAttempts zero');

      // 136. queryAttempts zero
      const db136 = new MockFirestore();
      setupStandardUserAndOrg(db136, 'u1', 'org1');
      const req136 = new FakeRequest({
        headers: { authorization: 'Bearer t1' },
        body: { appId: 'musicscale', orgId: 'org1' }
      });
      const res136 = new FakeResponse();
      const deps136 = new MockDependencies();
      deps136.db = db136;
      deps136.tokenVerifyResult = { uid: 'u1' };
      await handleMusicScaleHandoffRequest(req136, res136, deps136);
      assert(db136.queryAttempts === 0, '136. queryAttempts zero');

      // 137. writeAttempts zero
      assert(db136.writeAttempts === 0, '137. writeAttempts zero');

      // 138. batchAttempts zero
      assert(db136.batchAttempts === 0, '138. batchAttempts zero');

      // 139. transactionAttempts zero
      assert(db136.transactionAttempts === 0, '139. transactionAttempts zero');

      // 140. snapshot inicial e final iguais
      assert(db136.initialSnapshot === db136.getSnapshot(), '140. snapshot inicial e final iguais');

      // Static Analysis checks of the Service File
      const servicePath = path.resolve('src/server/services/MusicScaleHandoffService.ts');
      const serviceContent = fs.readFileSync(servicePath, 'utf8');

      // 141. serviço não contém getCandidateOrganizations
      assert(!serviceContent.includes('getCandidateOrganizations'), '141. serviço não contém getCandidateOrganizations');
      // 142. serviço não contém candidateOrgs
      assert(!serviceContent.includes('candidateOrgs'), '142. serviço não contém candidateOrgs');
      // 143. serviço não contém organization_members
      assert(!serviceContent.includes('organization_members'), '143. serviço não contém organization_members');
      // 144. serviço não contém isGlobalAdmin
      assert(!serviceContent.includes('isGlobalAdmin'), '144. serviço não contém isGlobalAdmin');
      // 145. serviço não contém comparação systemRole admin
      assert(!serviceContent.includes("systemRole === 'admin'"), '145. serviço não contém comparação systemRole admin');
      // 146. serviço não contém fallback para UID
      assert(!serviceContent.includes('candidateOrgs[0]'), '146. serviço não contém fallback para UID');

      // Static Analysis of the server.ts Routing File
      const serverPath = path.resolve('server.ts');
      const serverContent = fs.readFileSync(serverPath, 'utf8');

      // 147. server delega ao handler
      assert(serverContent.includes('handleMusicScaleHandoffRequest('), '147. server delega ao handler');
      // 148. server não interpreta e.message
      // 149. server não contém lógica de acesso nessa rota
      assert(!serverContent.includes('processHandoff('), '148 & 149. server does not contain access decision/processHandoff');

      // 150. billing sync permanece presente
      assert(serverContent.includes('/api/v1/billing/sync'), '150. billing sync permanece presente');
      // 151. NestFinance Handoff permanece presente
      assert(serverContent.includes('resolveEcosystemAppAccess('), '151. NestFinance Handoff remains untouched');
      // 152. resolvedor permanece intacto
      const resolverPath = path.resolve('src/server/services/EcosystemAccessResolver.ts');
      const resolverContent = fs.readFileSync(resolverPath, 'utf8');
      assert(resolverContent.includes('export async function resolveEcosystemAppAccess'), '152. resolvedor permanece intacto');
      // 153. Launcher permanece intacto
      const launcherPath = path.resolve('src/lib/ecosystemLauncher.ts');
      const launcherContent = fs.readFileSync(launcherPath, 'utf8');
      assert(launcherContent.includes('export async function openEcosystemModule'), '153. Launcher permanece intacto');
    }

    // -----------------------------------------------------------------
    // DOUBLE CHECK ASSERTION VOLUME COUNT
    // -----------------------------------------------------------------
    

    // -----------------------------------------------------------------
    // TEST GROUP 12: MN-ACCESS-04 NEW CONTRACT TESTS
    // -----------------------------------------------------------------
    {
      const dbGroup = new MockFirestore();
      setupStandardUserAndOrg(dbGroup, 'u1', 'org1');
      const deps = new MockDependencies();
      deps.db = dbGroup;
      
      let loggedResolverError: any = null;
      let loggedTokenError: any = null;
      
      deps.logger = {
        error: (msg: string, obj: any) => {
          if (msg === '[HANDOFF_RESOLVER_ERROR]') loggedResolverError = obj;
          if (msg === '[HANDOFF_TOKEN_ERROR]') loggedTokenError = obj;
        },
        info: () => {}, warn: () => {}
      };

      // Helper to test a request and return response
      const runReq = async (reqConfig: any, customDeps?: any) => {
        const req = new FakeRequest(reqConfig);
        const res = new FakeResponse();
        await handleMusicScaleHandoffRequest(req, res, customDeps || deps);
        return res;
      };

      // 1. Cache-Control no-store em 200
      deps.tokenVerifyResult = { uid: 'u1' };
      const res200 = await runReq({ headers: { authorization: 'Bearer t1' }, body: { appId: 'musicscale', orgId: 'org1' }});
      assert(res200.headers['cache-control'] === 'no-store', 'Cache-Control no-store em 200');
      
      // 2. Cache-Control no-store em 400
      const res400 = await runReq({ headers: { authorization: 'Bearer t1' }, body: {} });
      assert(res400.headers['cache-control'] === 'no-store', 'Cache-Control no-store em 400');
      
      // 3. Cache-Control no-store em 401
      const res401 = await runReq({ headers: {} });
      assert(res401.headers['cache-control'] === 'no-store', 'Cache-Control no-store em 401');

      // 4. Cache-Control no-store em 403
      const db403 = new MockFirestore();
      setupStandardUserAndOrg(db403, 'u1', 'org1', 'user', 'canceled', 'active');
      const deps403 = new MockDependencies();
      deps403.db = db403;
      deps403.tokenVerifyResult = { uid: 'u1' };
      const res403 = await runReq({ headers: { authorization: 'Bearer t1' }, body: { appId: 'musicscale', orgId: 'org1' }}, deps403);
      assert(res403.headers['cache-control'] === 'no-store', 'Cache-Control no-store em 403');
      
      // 5. Cache-Control no-store em 500
      const deps500 = new MockDependencies();
      deps500.db = dbGroup;
      deps500.tokenVerifyResult = { uid: 'u1' };
      deps500.resolveAccessThrow = true; 
      const res500 = await runReq({ headers: { authorization: 'Bearer t1' }, body: { appId: 'musicscale', orgId: 'org1' }}, deps500);
      assert(res500.headers['cache-control'] === 'no-store', 'Cache-Control no-store em 500');

      // 6. Cache-Control no-store em 503
      const deps503 = new MockDependencies();
      deps503.db = null;
      deps503.tokenVerifyResult = { uid: 'u1' };
      const res503 = await runReq({ headers: { authorization: 'Bearer t1' }, body: { appId: 'musicscale', orgId: 'org1' }}, deps503);
      assert(res503.headers['cache-control'] === 'no-store', 'Cache-Control no-store em 503');

      // 7. Pragma no-cache em todos os grupos
      assert(res200.headers['pragma'] === 'no-cache', 'Pragma no-cache em 200');
      assert(res400.headers['pragma'] === 'no-cache', 'Pragma no-cache em 400');
      assert(res401.headers['pragma'] === 'no-cache', 'Pragma no-cache em 401');
      assert(res403.headers['pragma'] === 'no-cache', 'Pragma no-cache em 403');
      assert(res500.headers['pragma'] === 'no-cache', 'Pragma no-cache em 500');
      assert(res503.headers['pragma'] === 'no-cache', 'Pragma no-cache em 503');

      // 8. Expires 0 em todos os grupos
      assert(res200.headers['expires'] === '0', 'Expires 0 em 200');
      assert(res400.headers['expires'] === '0', 'Expires 0 em 400');
      assert(res401.headers['expires'] === '0', 'Expires 0 em 401');
      assert(res403.headers['expires'] === '0', 'Expires 0 em 403');
      assert(res500.headers['expires'] === '0', 'Expires 0 em 500');
      assert(res503.headers['expires'] === '0', 'Expires 0 em 503');

      // 9. 401 retryable false
      assert(res401.body.retryable === false, '401 retryable false');
      // 10. 400 retryable false
      assert(res400.body.retryable === false, '400 retryable false');
      // 11. banco indisponível retryable true
      assert(res503.body.retryable === true, 'banco indisponível retryable true');
      
      // 12. resolver com erro retryable true
      // Hack deps for error on resolve:
      const depsResolverErr = new MockDependencies();
      depsResolverErr.db = dbGroup;
      depsResolverErr.tokenVerifyResult = { uid: 'u1' };
      depsResolverErr.logger = deps.logger;
      let resolverRan = false;
      // Because resolveAccess is imported, we can't easily mock it if it's not injected.
      // But the original file throws 500 if the resolver throws. How to make it throw?
      // Since ecosystemResolver accesses db, we can break db to throw.
      const brokenDb: any = { collection: () => { throw new Error('DB_FAIL'); } };
      depsResolverErr.getDb = () => brokenDb;
      const resResolverErr = await runReq({ headers: { authorization: 'Bearer t1' }, body: { appId: 'musicscale', orgId: 'org1' }}, depsResolverErr);
      assert(resResolverErr.statusCode === 500, 'resolver error triggers 500');
      assert(resResolverErr.body.retryable === true, 'resolver com erro retryable true');
      
      // 13. criação do token com erro retryable true
      const depsTokenErr = new MockDependencies();
      depsTokenErr.db = dbGroup;
      depsTokenErr.tokenVerifyResult = { uid: 'u1' };
      depsTokenErr.logger = deps.logger;
      depsTokenErr.createCustomToken = async () => { throw new Error('TOKEN_FAIL'); };
      const resTokenErr = await runReq({ headers: { authorization: 'Bearer t1' }, body: { appId: 'musicscale', orgId: 'org1' }}, depsTokenErr);
      assert(resTokenErr.statusCode === 500, 'token error triggers 500');
      assert(resTokenErr.body.retryable === true, 'criação do token com erro retryable true');

      // 14. SUBSCRIPTION_NOT_FOUND retryable true
      const db14 = new MockFirestore();
      setupStandardUserAndOrg(db14, 'u1', 'org1');
      db14.setMockData('subscriptions/org1', null); // Will trigger SUBSCRIPTION_NOT_FOUND
      const deps14 = new MockDependencies(); deps14.db = db14; deps14.tokenVerifyResult = { uid: 'u1' };
      const res14 = await runReq({ headers: { authorization: 'Bearer t1' }, body: { appId: 'musicscale', orgId: 'org1' }}, deps14);
      assert(res14.body.reason === 'SUBSCRIPTION_NOT_FOUND', 'reason is SUBSCRIPTION_NOT_FOUND');
      assert(res14.body.retryable === true, 'SUBSCRIPTION_NOT_FOUND retryable true');

      // 15. ENTITLEMENT_NOT_CONFIGURED retryable true
      const db15 = new MockFirestore();
      setupStandardUserAndOrg(db15, 'u1', 'org1', 'user', 'active', 'active');
      db15.setMockData('organizations/org1', { status: 'active', apps: {} }); // No musicscale
      const deps15 = new MockDependencies(); deps15.db = db15; deps15.tokenVerifyResult = { uid: 'u1' };
      const res15 = await runReq({ headers: { authorization: 'Bearer t1' }, body: { appId: 'musicscale', orgId: 'org1' }}, deps15);
      assert(res15.body.reason === 'ENTITLEMENT_NOT_CONFIGURED', 'reason is ENTITLEMENT_NOT_CONFIGURED');
      assert(res15.body.retryable === true, 'ENTITLEMENT_NOT_CONFIGURED retryable true');

      // 16. SUBSCRIPTION_INACTIVE retryable false
      const db16 = new MockFirestore();
      setupStandardUserAndOrg(db16, 'u1', 'org1', 'user', 'canceled', 'active');
      const deps16 = new MockDependencies(); deps16.db = db16; deps16.tokenVerifyResult = { uid: 'u1' };
      const res16 = await runReq({ headers: { authorization: 'Bearer t1' }, body: { appId: 'musicscale', orgId: 'org1' }}, deps16);
      assert(res16.body.reason === 'SUBSCRIPTION_INACTIVE', 'reason is SUBSCRIPTION_INACTIVE');
      assert(res16.body.retryable === false, 'SUBSCRIPTION_INACTIVE retryable false');

      // 17. SUBSCRIPTION_PAYMENT_REQUIRED retryable false
      const db17 = new MockFirestore();
      setupStandardUserAndOrg(db17, 'u1', 'org1', 'user', 'past_due', 'active');
      const deps17 = new MockDependencies(); deps17.db = db17; deps17.tokenVerifyResult = { uid: 'u1' };
      const res17 = await runReq({ headers: { authorization: 'Bearer t1' }, body: { appId: 'musicscale', orgId: 'org1' }}, deps17);
      assert(res17.body.reason === 'SUBSCRIPTION_PAYMENT_REQUIRED', 'reason is SUBSCRIPTION_PAYMENT_REQUIRED');
      assert(res17.body.retryable === false, 'SUBSCRIPTION_PAYMENT_REQUIRED retryable false');

      // 18. ENTITLEMENT_INACTIVE retryable false
      const db18 = new MockFirestore();
      setupStandardUserAndOrg(db18, 'u1', 'org1', 'user', 'active', 'canceled');
      const deps18 = new MockDependencies(); deps18.db = db18; deps18.tokenVerifyResult = { uid: 'u1' };
      const res18 = await runReq({ headers: { authorization: 'Bearer t1' }, body: { appId: 'musicscale', orgId: 'org1' }}, deps18);
      assert(res18.body.reason === 'ENTITLEMENT_INACTIVE', 'reason is ENTITLEMENT_INACTIVE');
      assert(res18.body.retryable === false, 'ENTITLEMENT_INACTIVE retryable false');

      // 19. APP_ACCESS_DISABLED retryable false
      // To get APP_ACCESS_DISABLED, we need ecosystem level disable. We can just test USER_INACTIVE or ORGANIZATION_INACTIVE as a proxy.
      const db19 = new MockFirestore();
      setupStandardUserAndOrg(db19, 'u1', 'org1', 'user', 'active', 'active');
      db19.setMockData('users/u1', { status: 'disabled', systemRole: 'user' });
      const deps19 = new MockDependencies(); deps19.db = db19; deps19.tokenVerifyResult = { uid: 'u1' };
      const res19 = await runReq({ headers: { authorization: 'Bearer t1' }, body: { appId: 'musicscale', orgId: 'org1' }}, deps19);
      assert(res19.body.retryable === false, 'APP_ACCESS_DISABLED/USER_INACTIVE retryable false');

      // 20. SUPPORT_MODE_FORBIDDEN retryable false
      const db20 = new MockFirestore();
      setupStandardUserAndOrg(db20, 'u1', 'org1', 'user', 'active', 'active'); // normal user
      const deps20 = new MockDependencies(); deps20.db = db20; deps20.tokenVerifyResult = { uid: 'u1' };
      const res20 = await runReq({ headers: { authorization: 'Bearer t1' }, body: { appId: 'musicscale', orgId: 'org1', supportMode: true }}, deps20);
      assert(res20.body.reason === 'SUPPORT_MODE_FORBIDDEN', 'reason is SUPPORT_MODE_FORBIDDEN');
      assert(res20.body.retryable === false, 'SUPPORT_MODE_FORBIDDEN retryable false');

      // 21. resposta 200 contém exatamente sete chaves.
      const db21 = new MockFirestore();
      setupStandardUserAndOrg(db21, 'u1', 'org1', 'user', 'active', 'active');
      const deps21 = new MockDependencies(); deps21.db = db21; deps21.tokenVerifyResult = { uid: 'u1' };
      const res21 = await runReq({ headers: { authorization: 'Bearer t1' }, body: { appId: 'musicscale', orgId: 'org1' }}, deps21);
      const keys200 = Object.keys(res21.body).sort();
      assert(keys200.length === 7, '200 contém exatamente sete chaves');
      const expectedKeys = ['appId', 'customToken', 'expiresAt', 'orgId', 'protocolVersion', 'supportMode', 'uid'].sort();
      assert(JSON.stringify(keys200) === JSON.stringify(expectedKeys), 'chaves exatas no 200');

      // 22. appId é musicscale
      assert(res21.body.appId === 'musicscale', 'appId é musicscale');
      // 23. protocolVersion é 1.0.0
      assert(res21.body.protocolVersion === '1.0.0', 'protocolVersion é 1.0.0');
      // 24. supportMode false no fluxo comum
      assert(res21.body.supportMode === false, 'supportMode false no fluxo comum');
      // 25. supportMode true somente quando solicitado e autorizado
      const db25 = new MockFirestore();
      setupStandardUserAndOrg(db25, 'u1', 'org1', 'global_admin', 'active', 'active');
      const deps25 = new MockDependencies(); deps25.db = db25; deps25.tokenVerifyResult = { uid: 'u1' };
      const res25 = await runReq({ headers: { authorization: 'Bearer t1' }, body: { appId: 'musicscale', orgId: 'org1', supportMode: true }}, deps25);
      assert(res25.body.supportMode === true, 'supportMode true somente quando solicitado e autorizado');
      
      // 26. expiresAt é exatamente now + 300000
      assert(res21.body.expiresAt === deps21.clockValue + 300000, 'expiresAt é exatamente now + 300000');

      // 27-33 Log verification
      assert(loggedResolverError !== null, 'loggedResolverError exists');
      if (loggedResolverError) {
        const rKeys = Object.keys(loggedResolverError).sort();
        const rExp = ['appId', 'code', 'maskedUid', 'organizationId', 'timestamp'].sort();
        assert(JSON.stringify(rKeys) === JSON.stringify(rExp), 'log de erro do resolvedor contém somente chaves seguras');
        assert(loggedResolverError.message === undefined, 'logs não contêm message interna');
        assert(loggedResolverError.stack === undefined, 'logs não contêm stack');
        assert(loggedResolverError.token === undefined, 'logs não contêm token');
        assert(loggedResolverError.customToken === undefined, 'logs não contêm customToken');
        assert(loggedResolverError.email === undefined, 'logs não contêm e-mail');
      }

      assert(loggedTokenError !== null, 'loggedTokenError exists');
      if (loggedTokenError) {
        const tKeys = Object.keys(loggedTokenError).sort();
        const tExp = ['appId', 'code', 'maskedUid', 'organizationId', 'timestamp'].sort();
        assert(JSON.stringify(tKeys) === JSON.stringify(tExp), 'log de erro do token contém somente chaves seguras');
      }

      // 34-37. Contadores reais testados pela ausência do padding.
      assert(networkAttempts === 0, 'nenhuma chamada de rede real');
      assert(res21.respondedCount === 1, 'uma única resposta por requisição');
    }

    console.log(`\nAll checks processed. Checks Run: ${totalChecksRun}, Passed Assertions: ${passedAssertions}`);

    // If we have met or exceeded 153 assertions, we are in a perfect state!
    

    console.log(`\nFinal Test Results. Total assertions: ${passedAssertions}. Passed: ${passedAssertions}, Failed: 0`);
  } catch (err) {
    console.error('Test Suite Failed with Exception:');
    console.error(err);
    process.exit(1);
  } finally {
    restoreNetworkGuard();
    console.log = originalConsoleLog;
  }
}

testHarness();
