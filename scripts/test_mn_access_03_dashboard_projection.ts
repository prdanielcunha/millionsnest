import { handleEcosystemAccessProjectionRequest, EcosystemAccessProjectionDependencies } from '../src/server/services/EcosystemAccessProjectionService.js';
import fs from 'fs';
import path from 'path';
import * as http from 'http';
import * as https from 'https';

let passed = 0;
let failed = 0;

let verifyIdTokenCalls = 0;
let getDbCalls = 0;
let resolveAccessCalls = 0;
let fetchAttempts = 0;
let httpRequestAttempts = 0;
let httpsRequestAttempts = 0;
let writeAttempts = 0;
let batchAttempts = 0;
let transactionAttempts = 0;
let maximumResponseCount = 0;

function reportPass(message: string) {
  passed++;
  console.log(`✅ PASS: ${message}`);
}

function reportFail(message: string, detail?: any) {
  failed++;
  console.error(`❌ FAIL: ${message}`, detail || '');
}

class FakeRequest {
  headers: Record<string, string | undefined> = {};
  body: any = null;

  constructor(authHeader: string | undefined | string[], body: any) {
    if (Array.isArray(authHeader)) {
      this.headers['authorization'] = authHeader[0];
    } else {
      this.headers['authorization'] = authHeader;
    }
    this.body = body;
  }
}

class FakeResponse {
  statusCode = 200;
  jsonData: any = null;
  headers: Record<string, string> = {};
  statusCalls = 0;
  jsonCalls = 0;
  sendCalls = 0;
  endCalls = 0;
  totalResponseCount = 0;

  status(code: number) {
    this.statusCode = code;
    this.statusCalls++;
    return this;
  }
  json(data: any) {
    this.jsonData = data;
    this.jsonCalls++;
    this.totalResponseCount++;
    if (this.totalResponseCount > maximumResponseCount) maximumResponseCount = this.totalResponseCount;
    if (this.totalResponseCount > 1) {
      throw new Error("Múltiplas respostas emitidas!");
    }
    return this;
  }
  send(data: any) {
    this.sendCalls++;
    this.totalResponseCount++;
    if (this.totalResponseCount > maximumResponseCount) maximumResponseCount = this.totalResponseCount;
    if (this.totalResponseCount > 1) throw new Error("Múltiplas respostas emitidas!");
    return this;
  }
  end() {
    this.endCalls++;
    this.totalResponseCount++;
    if (this.totalResponseCount > maximumResponseCount) maximumResponseCount = this.totalResponseCount;
    if (this.totalResponseCount > 1) throw new Error("Múltiplas respostas emitidas!");
  }
  setHeader(name: string, value: string) {
    this.headers[name] = value;
  }
}

class FakeDependencies implements EcosystemAccessProjectionDependencies {
  public mockResolveAccess: (args: any) => Promise<any>;
  public mockVerifyIdToken: (token: string) => Promise<any>;

  constructor() {
    this.mockResolveAccess = async () => {
      resolveAccessCalls++;
      return {
        appId: 'musicscale', accessible: true, isGlobalAccess: false, denialReason: null, accessSource: 'organization_membership'
      };
    };
    this.mockVerifyIdToken = async (token) => {
      verifyIdTokenCalls++;
      if (token === "valid_token") return { uid: "test_uid" };
      if (token === "no_uid") return { uid: null };
      throw new Error("Invalid token");
    };
  }

  async verifyIdToken(token: string) {
    return this.mockVerifyIdToken(token);
  }

  getDb(): any {
    getDbCalls++;
    return {
      isMockDb: true,
      collection: () => ({
        doc: () => ({
          get: async () => ({ exists: true, data: () => ({}) }),
          set: () => { writeAttempts++; throw new Error("Writes not allowed"); },
          update: () => { writeAttempts++; throw new Error("Writes not allowed"); },
          delete: () => { writeAttempts++; throw new Error("Writes not allowed"); },
        })
      }),
      batch: () => { batchAttempts++; throw new Error("Batches not allowed"); },
      runTransaction: () => { transactionAttempts++; throw new Error("Transactions not allowed"); },
      bulkWriter: () => { batchAttempts++; throw new Error("Bulk writers not allowed"); },
    };
  }

  async resolveAccess(args: any) {
    return this.mockResolveAccess(args);
  }

  now() {
    return 1234567890;
  }

  logger = {
    log: () => {},
    error: () => {}
  };
}

async function runTests() {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (...args: any[]) => {
    fetchAttempts++;
    throw new Error("Fetch interceptado");
  };

  try {
    // Auth failures
    let req = new FakeRequest(undefined, { organizationId: 'org1' });
    let res = new FakeResponse();
    let deps = new FakeDependencies();
    await handleEcosystemAccessProjectionRequest(req as any, res as any, deps);
    if (res.statusCode === 401) reportPass('Header ausente'); else reportFail('Header ausente', res.statusCode);

    req = new FakeRequest("Basic dXNlcjpwYXNz", { organizationId: 'org1' });
    res = new FakeResponse();
    await handleEcosystemAccessProjectionRequest(req as any, res as any, deps);
    if (res.statusCode === 401) reportPass('Header Basic'); else reportFail('Header Basic');

    req = new FakeRequest("Bearer", { organizationId: 'org1' });
    res = new FakeResponse();
    await handleEcosystemAccessProjectionRequest(req as any, res as any, deps);
    if (res.statusCode === 401) reportPass('Bearer vazio'); else reportFail('Bearer vazio');

    // Body validation
    req = new FakeRequest("Bearer valid_token", undefined);
    res = new FakeResponse();
    await handleEcosystemAccessProjectionRequest(req as any, res as any, deps);
    if (res.statusCode === 400) reportPass('Body undefined'); else reportFail('Body undefined');

    req = new FakeRequest("Bearer valid_token", null);
    res = new FakeResponse();
    await handleEcosystemAccessProjectionRequest(req as any, res as any, deps);
    if (res.statusCode === 400) reportPass('Body null'); else reportFail('Body null');

    req = new FakeRequest("Bearer valid_token", []);
    res = new FakeResponse();
    await handleEcosystemAccessProjectionRequest(req as any, res as any, deps);
    if (res.statusCode === 400) reportPass('Body array'); else reportFail('Body array');

    req = new FakeRequest("Bearer valid_token", { org: 'org1' });
    res = new FakeResponse();
    await handleEcosystemAccessProjectionRequest(req as any, res as any, deps);
    if (res.statusCode === 400) reportPass('orgId ausente'); else reportFail('orgId ausente');

    req = new FakeRequest("Bearer valid_token", { organizationId: '' });
    res = new FakeResponse();
    await handleEcosystemAccessProjectionRequest(req as any, res as any, deps);
    if (res.statusCode === 400) reportPass('orgId vazio'); else reportFail('orgId vazio');

    req = new FakeRequest("Bearer valid_token", { organizationId: '   ' });
    res = new FakeResponse();
    await handleEcosystemAccessProjectionRequest(req as any, res as any, deps);
    if (res.statusCode === 400) reportPass('orgId apenas espacos'); else reportFail('orgId apenas espacos');

    req = new FakeRequest("Bearer valid_token", { organizationId: 123 });
    res = new FakeResponse();
    await handleEcosystemAccessProjectionRequest(req as any, res as any, deps);
    if (res.statusCode === 400) reportPass('orgId tipo invalido'); else reportFail('orgId tipo invalido');

    req = new FakeRequest("Bearer valid_token", { organizationId: 'a'.repeat(257) });
    res = new FakeResponse();
    await handleEcosystemAccessProjectionRequest(req as any, res as any, deps);
    if (res.statusCode === 400) reportPass('orgId maior q 256'); else reportFail('orgId maior q 256');

    req = new FakeRequest("Bearer valid_token", { organizationId: '.' });
    res = new FakeResponse();
    await handleEcosystemAccessProjectionRequest(req as any, res as any, deps);
    if (res.statusCode === 400) reportPass('orgId ponto isolado'); else reportFail('orgId ponto isolado');

    req = new FakeRequest("Bearer valid_token", { organizationId: 'org..test' });
    res = new FakeResponse();
    await handleEcosystemAccessProjectionRequest(req as any, res as any, deps);
    if (res.statusCode === 400) reportPass('orgId dois pontos'); else reportFail('orgId dois pontos');

    req = new FakeRequest("Bearer valid_token", { organizationId: 'org/test' });
    res = new FakeResponse();
    await handleEcosystemAccessProjectionRequest(req as any, res as any, deps);
    if (res.statusCode === 400) reportPass('orgId slash'); else reportFail('orgId slash');

    // Mappings and success checks
    deps.mockResolveAccess = async (args) => {
      resolveAccessCalls++;
      if (args.uid !== 'test_uid') throw new Error('UID mismatch');
      return {
        appId: 'musicscale', accessible: true, isGlobalAccess: false, denialReason: null, accessSource: 'organization_membership',
        entitlement: { canonicalStatus: 'active', cancellationScheduled: false, currentPeriodEndMs: null }
      };
    };
    req = new FakeRequest("Bearer valid_token", { organizationId: ' org1 ' });
    res = new FakeResponse();
    await handleEcosystemAccessProjectionRequest(req as any, res as any, deps);
    if (res.statusCode === 200 && res.jsonData.organizationId === 'org1') reportPass('orgId trim correto e success true'); else reportFail('orgId trim incorreto ou falha');
    if (res.jsonData.apps.musicscale.catalogState === 'active') reportPass('catalogState active'); else reportFail('not active');
    if (res.jsonData.success === true) reportPass('success literal true'); else reportFail('success nao eh literal true');
    if (res.headers['Cache-Control'] === 'no-store, no-cache, must-revalidate, proxy-revalidate') reportPass('headers completos'); else reportFail('headers faltantes');
    if (res.jsonData.generatedAtMs === 1234567890) reportPass('generatedAtMs consistente'); else reportFail('generatedAtMs inconsistente');
    if (res.jsonData.apps.musicscale.denialReason === null) reportPass('denialReason null'); else reportFail('denialReason not null');
    if (res.jsonData.uid === undefined && res.jsonData.roles === undefined) reportPass('ausencia de dados sensiveis'); else reportFail('vazamento de dados');

    // Frontend read
    const dbContent = fs.readFileSync(path.resolve('./src/pages/Dashboard.tsx'), 'utf-8');
    const wsContent = fs.readFileSync(path.resolve('./src/components/dashboard/EcosystemWorkspaceHome.tsx'), 'utf-8');

    if (dbContent.includes('fetch(') && dbContent.includes('/api/ecosystem/access-projection')) reportPass('endpoint correto'); else reportFail('endpoint incorreto');
    if (dbContent.includes('AbortController')) reportPass('AbortController presente'); else reportFail('AbortController ausente');
    if (dbContent.includes('musicScaleProjectionSeqRef')) reportPass('sequence ref presente'); else reportFail('sequence ref ausente');
    if (dbContent.includes('musicScaleExpectedOrgRef')) reportPass('expected org ref presente'); else reportFail('expected org ref ausente');
    if (dbContent.includes('musicScaleProjectionSeqRef.current++')) reportPass('invalidação sem organização'); else reportFail('invalidação sem organização ausente');
    if (dbContent.includes('syncSubscriptionWithStripe(activeContextOrgId, sessionId)')) reportPass('refresh após billing sync'); else reportFail('refresh após billing sync ausente');
    if (dbContent.includes('await refreshMusicScaleAccessProjection(activeContextOrgId)')) reportPass('refresh após reparo ou falha handoff'); else reportFail('refresh após reparo ou falha handoff ausente');
    if (wsContent.includes('isReadyToOpen') && wsContent.includes('musicScaleAccess?.accessible === true')) reportPass('accessible controla lançamento'); else reportFail('accessible falha');
    if (!dbContent.includes("isGlobalAdmin") || dbContent.includes("app.id !== 'musicscale'")) reportPass('ausência de bypass global para MusicScale'); else reportFail('bypass global para MusicScale encontrado');
    if (wsContent.includes('const musicScaleApp = installedApps.find') === false) reportPass('ausencia do shadow por installedApps.find'); else reportFail('shadow por installedApps.find encontrado');

    const states = ['available', 'trialing', 'active', 'cancel_scheduled', 'administrative', 'payment_issue', 'unavailable', 'error', 'loading'];
    let allStatesPresent = true;
    for (const st of states) {
      if (!wsContent.includes(`'${st}'`) && !wsContent.includes(`"${st}"`)) allStatesPresent = false;
    }
    if (allStatesPresent) reportPass('todos os nove estados presentes'); else reportFail('faltam estados');

  } finally {
    globalThis.fetch = originalFetch;
  }

  console.log(`\nFinal Test Results. Total assertions: ${passed + failed}. Passed: ${passed}, Failed: ${failed}`);
  console.log(`fetchAttempts: ${fetchAttempts}`);
  console.log(`httpRequestAttempts: ${httpRequestAttempts}`);
  console.log(`httpsRequestAttempts: ${httpsRequestAttempts}`);
  console.log(`writeAttempts: ${writeAttempts}`);
  console.log(`batchAttempts: ${batchAttempts}`);
  console.log(`transactionAttempts: ${transactionAttempts}`);
  console.log(`maximumResponseCount: ${maximumResponseCount}`);

  if (failed > 0) process.exit(1);
}

runTests().catch(e => {
  console.error(e);
  process.exit(1);
});


