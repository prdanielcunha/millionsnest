import fs from 'fs';
import path from 'path';
import http from 'http';
import https from 'https';
import { openEcosystemModule } from '../src/lib/ecosystemLauncher.js';

let assertionCount = 0;
function check(actual: any, expected: any, message: string) {
  assertionCount++;
  if (actual !== expected) {
    throw new Error(`\nAssertion failed: ${message}\nExpected: ${expected}\nActual: ${actual}`);
  }
}
function assert(condition: boolean, message: string) {
  assertionCount++;
  if (!condition) {
    throw new Error(`\nAssertion failed: ${message}`);
  }
}
function assertDeepStrictEqual(actual: any, expected: any, message: string) {
  assertionCount++;
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr !== expectedStr) {
    throw new Error(`\nAssertion failed: ${message}\nExpected: ${expectedStr}\nActual: ${actualStr}`);
  }
}

let fetchAttempts = 0;
let sleepAttempts = 0;
let assignAttempts = 0;
let maximumFetchCountPerScenario = 0;
let realNetworkAttempts = 0;
let writeAttempts = 0;

const FIXED_NOW = 1784806335579;

class FakeDependencies {
  public fetchResponses: any[] = [];
  public currentFetchCount = 0;
  public assignedUrl: string | null = null;
  public markPerformanceCalled: string[] = [];
  public supportSessionStr: string | null = null;
  public getIdTokenAttempts = 0;
  public sleepCount = 0;
  public assignCount = 0;
  public events: string[] = [];

  public loadAppsAttempts = 0;
  public loadedApps = [
    {
      id: 'musicscale',
      url: 'https://musicscale.millionsnest.com/start'
    }
  ];

  public loadAppsThrows = false;

  loadApps = async () => {
    this.events.push('loadApps');
    this.loadAppsAttempts++;
    if (this.loadAppsThrows) throw new Error('Failed to load apps');
    return this.loadedApps;
  };

  getIdToken = async () => {
    this.events.push('getIdToken');
    this.getIdTokenAttempts++;
    if (this.getIdTokenAttempts > 1) throw new Error('getIdToken failed'); // Optional if testing failure
    return 'fake-id-token';
  };
  
  fetchFn = async (url: any, options: any) => {
    this.events.push('fetch');
    fetchAttempts++;
    this.currentFetchCount++;
    if (this.currentFetchCount > maximumFetchCountPerScenario) {
      maximumFetchCountPerScenario = this.currentFetchCount;
    }
    const responseData = this.fetchResponses.shift();
    return {
      ok: responseData.ok,
      status: responseData.status,
      json: async () => {
        if (responseData.jsonThrows) throw new Error('json error');
        return responseData.body;
      }
    };
  };
  
  sleep = async (ms: number) => {
    check(ms, 1000, 'retry delay must be exactly 1000ms');
    this.events.push('sleep');
    sleepAttempts++;
    this.sleepCount++;
  };
  
  assign = (url: string) => {
    this.events.push('assign');
    assignAttempts++;
    this.assignCount++;
    this.assignedUrl = url;
  };
  
  now = () => FIXED_NOW;
  
  readSupportSession = () => this.supportSessionStr;
  
  markPerformance = (name: string) => {
    this.events.push(`mark:${name}`);
    this.markPerformanceCalled.push(name);
  };
}

async function runTests() {
  const originalFetch = globalThis.fetch;
  const originalHttpRequest = http.request;
  const originalHttpsRequest = https.request;
  const originalWriteFileSync = fs.writeFileSync;
  const originalAppendFileSync = fs.appendFileSync;
  const originalCreateWriteStream = fs.createWriteStream;
  const originalWriteFile = fs.promises.writeFile;
  const originalAppendFile = fs.promises.appendFile;

  try {
    globalThis.fetch = async (...args) => {
      realNetworkAttempts++;
      throw new Error('Real network is forbidden');
    };
    (http as any).request = (...args: any[]) => {
      realNetworkAttempts++;
      throw new Error('Real network is forbidden');
    };
    (https as any).request = (...args: any[]) => {
      realNetworkAttempts++;
      throw new Error('Real network is forbidden');
    };

    fs.writeFileSync = (...args: any[]) => {
      writeAttempts++;
      throw new Error('File writes are forbidden');
    };
    fs.appendFileSync = (...args: any[]) => {
      writeAttempts++;
      throw new Error('File writes are forbidden');
    };
    fs.createWriteStream = (...args: any[]) => {
      writeAttempts++;
      throw new Error('File writes are forbidden');
    };
    fs.promises.writeFile = async (...args: any[]) => {
      writeAttempts++;
      throw new Error('File writes are forbidden');
    };
    fs.promises.appendFile = async (...args: any[]) => {
      writeAttempts++;
      throw new Error('File writes are forbidden');
    };

    const user = { uid: '  u1  ' };
    const profile = {};
    const org = { id: '  org1  ' };
    const currentUserData = {};

    // 5.5 INCOMPLETE IDENTITY SCENARIOS
    const incompleteCases = [
      { u: null, o: org, msg: 'user null' },
      { u: {}, o: org, msg: 'user sem uid' },
      { u: { uid: '' }, o: org, msg: 'uid vazio' },
      { u: { uid: '   ' }, o: org, msg: 'uid somente espaços' },
      { u: user, o: null, msg: 'organization null' },
      { u: user, o: {}, msg: 'organization sem id' },
      { u: user, o: { id: '' }, msg: 'id vazio' },
      { u: user, o: { id: '   ' }, msg: 'id somente espaços' }
    ];

    for (const c of incompleteCases) {
      const deps = new FakeDependencies();
      let thrown = false;
      try {
        await openEcosystemModule('musicscale', c.u, profile, c.o, currentUserData, deps as any);
      } catch (e: any) {
        thrown = true;
        assert(e.message === 'Sessão inválida ou dados incompletos. Tente recarregar a página.', 'lança erro público correto');
      }
      assert(thrown, `deve lançar erro para ${c.msg}`);
      assert(deps.getIdTokenAttempts === 0, 'getIdTokenAttempts === 0');
      assert(deps.currentFetchCount === 0, 'currentFetchCount === 0');
      assert(deps.assignCount === 0, 'assignCount === 0');
    }

    // 5.6 TOKEN E TELEMETRIA (Sucesso Completo)
    {
      const deps = new FakeDependencies();
      deps.fetchResponses.push({ ok: true, status: 200, body: { appId: 'musicscale', orgId: 'org1', uid: 'u1', customToken: 'ct', expiresAt: FIXED_NOW + 300000, supportMode: false, protocolVersion: '1.0.0' } });
      await openEcosystemModule('musicscale', user, profile, org, currentUserData, deps as any);
      
      assert(deps.loadAppsAttempts === 1, 'loadAppsAttempts === 1');
      assert(deps.getIdTokenAttempts === 1, 'getIdTokenAttempts === 1');
      assert(deps.currentFetchCount === 1, 'currentFetchCount === 1');
      assert(deps.markPerformanceCalled.filter(n => n === 'handoff_started').length === 1, 'handoff_started exatamente uma vez');
      assert(deps.markPerformanceCalled.filter(n => n === 'handoff_completed').length === 1, 'handoff_completed exatamente uma vez');
      assert(deps.assignCount === 1, 'assignCount === 1');

      // Check Order
      const lIdx = deps.events.indexOf('loadApps');
      const gIdx = deps.events.indexOf('getIdToken');
      const sIdx = deps.events.indexOf('mark:handoff_started');
      const fIdx = deps.events.indexOf('fetch');
      const cIdx = deps.events.indexOf('mark:handoff_completed');
      const aIdx = deps.events.indexOf('assign');

      assert(lIdx < gIdx, 'loadApps before getIdToken');
      assert(gIdx < sIdx, 'getIdToken before handoff_started');
      assert(sIdx < fIdx, 'handoff_started before fetch');
      assert(fIdx < cIdx, 'fetch before handoff_completed');
      assert(cIdx < aIdx, 'handoff_completed before assign');

      // Normalization verification
      const url = new URL(deps.assignedUrl!);
      const ctx = JSON.parse(atob(url.searchParams.get('ecosystem_ctx')!));
      const expectedPayload = {
        appId: 'musicscale',
        orgId: 'org1',
        userId: 'u1',
        customToken: 'ct',
        expiresAt: FIXED_NOW + 300000,
        supportMode: false,
        protocolVersion: '1.0.0'
      };
      assertDeepStrictEqual(ctx, expectedPayload, 'payload correto das sete chaves (normalization)');
    }

    // 5.4 SUPPORT MODE
    {
       // A. active true, targetOrganizationId matches
       const depsA = new FakeDependencies();
       depsA.supportSessionStr = JSON.stringify({ active: true, targetOrganizationId: 'org1' });
       depsA.fetchResponses.push({ ok: true, status: 200, body: { appId: 'musicscale', orgId: 'org1', uid: 'u1', customToken: 'ct', expiresAt: FIXED_NOW + 300000, supportMode: true, protocolVersion: '1.0.0' } });
       await openEcosystemModule('musicscale', user, profile, org, currentUserData, depsA as any);
       const urlA = new URL(depsA.assignedUrl!);
       const ctxA = JSON.parse(atob(urlA.searchParams.get('ecosystem_ctx')!));
       assert(ctxA.supportMode === true, 'A. supportMode true');
       
       // B. active true, targetOrganizationId different
       const depsB = new FakeDependencies();
       depsB.supportSessionStr = JSON.stringify({ active: true, targetOrganizationId: 'org2' });
       depsB.fetchResponses.push({ ok: true, status: 200, body: { appId: 'musicscale', orgId: 'org1', uid: 'u1', customToken: 'ct', expiresAt: FIXED_NOW + 300000, supportMode: false, protocolVersion: '1.0.0' } });
       await openEcosystemModule('musicscale', user, profile, org, currentUserData, depsB as any);
       const urlB = new URL(depsB.assignedUrl!);
       const ctxB = JSON.parse(atob(urlB.searchParams.get('ecosystem_ctx')!));
       assert(ctxB.supportMode === false, 'B. supportMode false');
       
       // C. JSON inválido
       const depsC = new FakeDependencies();
       depsC.supportSessionStr = 'invalid json';
       depsC.fetchResponses.push({ ok: true, status: 200, body: { appId: 'musicscale', orgId: 'org1', uid: 'u1', customToken: 'ct', expiresAt: FIXED_NOW + 300000, supportMode: false, protocolVersion: '1.0.0' } });
       await openEcosystemModule('musicscale', user, profile, org, currentUserData, depsC as any);
       const urlC = new URL(depsC.assignedUrl!);
       const ctxC = JSON.parse(atob(urlC.searchParams.get('ecosystem_ctx')!));
       assert(ctxC.supportMode === false, 'C. supportMode false (invalido)');
    }

    // 5.5 CATÁLOGO
    {
      // A. loadApps lança erro
      const depsA = new FakeDependencies();
      depsA.loadAppsThrows = true;
      let thrownA = false;
      try { await openEcosystemModule('musicscale', user, profile, org, currentUserData, depsA as any); } catch(e: any) {
        thrownA = true;
        assert(e.message === 'Não foi possível carregar o catálogo de aplicativos.', 'msg exata catalog A');
      }
      assert(thrownA, 'A deve lançar');
      assert(depsA.loadAppsAttempts === 1, 'loadApps 1');
      assert(depsA.getIdTokenAttempts === 0, 'getIdToken 0');
      assert(depsA.currentFetchCount === 0, 'fetch 0');
      assert(depsA.markPerformanceCalled.length === 0, 'mark 0');
      assert(depsA.assignCount === 0, 'assign 0');

      // B. catálogo vazio
      const depsB = new FakeDependencies();
      depsB.loadedApps = [];
      let thrownB = false;
      try { await openEcosystemModule('musicscale', user, profile, org, currentUserData, depsB as any); } catch(e: any) {
        thrownB = true;
        assert(e.message === 'Aplicativo não encontrado no catálogo.', 'msg exata catalog B');
      }
      assert(thrownB, 'B deve lançar');
      assert(depsB.loadAppsAttempts === 1, 'loadApps 1');
      assert(depsB.getIdTokenAttempts === 0, 'getIdToken 0');
      assert(depsB.currentFetchCount === 0, 'fetch 0');
      assert(depsB.markPerformanceCalled.length === 0, 'mark 0');
      assert(depsB.assignCount === 0, 'assign 0');
      
      // C. sem url
      const depsC = new FakeDependencies();
      depsC.loadedApps = [{ id: 'musicscale' } as any];
      let thrownC = false;
      try { await openEcosystemModule('musicscale', user, profile, org, currentUserData, depsC as any); } catch(e: any) {
        thrownC = true;
      }
      assert(thrownC, 'C deve lançar');
      assert(depsC.loadAppsAttempts === 1, 'loadApps 1');
      assert(depsC.getIdTokenAttempts === 0, 'getIdToken 0');
      
      // D. url vazia
      const depsD = new FakeDependencies();
      depsD.loadedApps = [{ id: 'musicscale', url: '   ' }];
      let thrownD = false;
      try { await openEcosystemModule('musicscale', user, profile, org, currentUserData, depsD as any); } catch(e: any) {
        thrownD = true;
      }
      assert(thrownD, 'D deve lançar');
      assert(depsD.loadAppsAttempts === 1, 'loadApps 1');
      assert(depsD.getIdTokenAttempts === 0, 'getIdToken 0');
    }

    // 5.6 FALHA DO TOKEN
    {
      const deps = new FakeDependencies();
      deps.getIdToken = async () => { deps.getIdTokenAttempts++; throw new Error('Token Error'); };
      let thrown = false;
      try { await openEcosystemModule('musicscale', user, profile, org, currentUserData, deps as any); } catch(e: any) { thrown = true; }
      assert(thrown, 'deve lançar em Token Error');
      assert(deps.loadAppsAttempts === 1, 'loadApps 1');
      assert(deps.getIdTokenAttempts === 1, 'getIdToken 1');
      assert(deps.currentFetchCount === 0, 'fetch 0');
      assert(deps.markPerformanceCalled.length === 0, 'mark 0');
      assert(deps.assignCount === 0, 'assign 0');
    }

    // 5.7 URL INVÁLIDA
    {
      const deps = new FakeDependencies();
      deps.loadedApps = [{ id: 'musicscale', url: 'not a valid url' }];
      deps.fetchResponses.push({ ok: true, status: 200, body: { appId: 'musicscale', orgId: 'org1', uid: 'u1', customToken: 'ct', expiresAt: FIXED_NOW + 300000, supportMode: false, protocolVersion: '1.0.0' } });
      let thrown = false;
      try { await openEcosystemModule('musicscale', user, profile, org, currentUserData, deps as any); } catch(e: any) { thrown = true; }
      assert(thrown, 'URL invalida lanca error');
      assert(deps.currentFetchCount === 1, 'fetch uma vez');
      assert(deps.markPerformanceCalled.filter(n => n === 'handoff_started').length === 1, 'handoff_started uma vez');
      assert(deps.markPerformanceCalled.filter(n => n === 'handoff_completed').length === 0, 'handoff_completed zero');
      assert(deps.assignCount === 0, 'assign zero');
    }

    // 5.8 RETENTATIVAS
    {
      // A. 503 retryable true -> 200
      const depsA = new FakeDependencies();
      depsA.fetchResponses.push({ ok: false, status: 503, body: { retryable: true } });
      depsA.fetchResponses.push({ ok: true, status: 200, body: { appId: 'musicscale', orgId: 'org1', uid: 'u1', customToken: 'ct', expiresAt: FIXED_NOW + 300000, supportMode: false, protocolVersion: '1.0.0' } });
      await openEcosystemModule('musicscale', user, profile, org, currentUserData, depsA as any);
      assert(depsA.getIdTokenAttempts === 1, 'getIdToken 1');
      assert(depsA.currentFetchCount === 2, 'fetch 2');
      assert(depsA.sleepCount === 1, 'sleep 1');
      assert(depsA.markPerformanceCalled.filter(n => n === 'handoff_started').length === 1, 'started 1');
      assert(depsA.markPerformanceCalled.filter(n => n === 'handoff_completed').length === 1, 'completed 1');
      assert(depsA.assignCount === 1, 'assign 1');
      
      // B. 403 reason: SUBSCRIPTION_NOT_FOUND
      const depsB = new FakeDependencies();
      depsB.fetchResponses.push({ ok: false, status: 403, body: { retryable: true, reason: 'SUBSCRIPTION_NOT_FOUND' } });
      depsB.fetchResponses.push({ ok: true, status: 200, body: { appId: 'musicscale', orgId: 'org1', uid: 'u1', customToken: 'ct', expiresAt: FIXED_NOW + 300000, supportMode: false, protocolVersion: '1.0.0' } });
      await openEcosystemModule('musicscale', user, profile, org, currentUserData, depsB as any);
      assert(depsB.currentFetchCount === 2, 'fetch 2 em SUBSCRIPTION_NOT_FOUND');
      assert(depsB.sleepCount === 1, 'sleep 1 em SUBSCRIPTION_NOT_FOUND');

      // C. 403 error: Subscription missing, retryable false
      const depsC = new FakeDependencies();
      depsC.fetchResponses.push({ ok: false, status: 403, body: { retryable: false, error: 'Subscription missing' } });
      let thrownC = false;
      try { await openEcosystemModule('musicscale', user, profile, org, currentUserData, depsC as any); } catch(e) { thrownC = true; }
      assert(thrownC, 'C deve lançar');
      assert(depsC.currentFetchCount === 1, 'uma chamada em 403 sem retryable');
      assert(depsC.sleepCount === 0, 'zero sleep em 403 sem retryable');
      assert(depsC.assignCount === 0, 'zero assign em 403 sem retryable');

      // D. duas respostas 503 retryable true
      const depsD = new FakeDependencies();
      depsD.fetchResponses.push({ ok: false, status: 503, body: { retryable: true } });
      depsD.fetchResponses.push({ ok: false, status: 503, body: { retryable: true } });
      let thrownD = false;
      try { await openEcosystemModule('musicscale', user, profile, org, currentUserData, depsD as any); } catch(e) { thrownD = true; }
      assert(thrownD, 'D deve lançar');
      assert(depsD.currentFetchCount === 2, 'maximo duas chamadas');
      assert(depsD.sleepCount === 1, 'um sleep');
      assert(depsD.markPerformanceCalled.filter(n => n === 'handoff_completed').length === 0, 'completed zero');
      assert(depsD.assignCount === 0, 'assign zero');
      
      // E. 400 com retryable true malformado
      const depsE = new FakeDependencies();
      depsE.fetchResponses.push({ ok: false, status: 400, body: { retryable: true } });
      let thrownE = false;
      try { await openEcosystemModule('musicscale', user, profile, org, currentUserData, depsE as any); } catch(e) { thrownE = true; }
      assert(thrownE, 'E deve lançar');
      assert(depsE.currentFetchCount === 1, 'E: uma chamada');
      assert(depsE.sleepCount === 0, 'E: zero sleep');

      // F. 401 com retryable true malformado
      const depsF = new FakeDependencies();
      depsF.fetchResponses.push({ ok: false, status: 401, body: { retryable: true } });
      let thrownF = false;
      try { await openEcosystemModule('musicscale', user, profile, org, currentUserData, depsF as any); } catch(e) { thrownF = true; }
      assert(thrownF, 'F deve lançar');
      assert(depsF.currentFetchCount === 1, 'F: uma chamada');
      assert(depsF.sleepCount === 0, 'F: zero sleep');
    }

    // 5.9 RESPOSTAS INVÁLIDAS
    const invalidCases = [
      { appId: 'other', orgId: 'org1', uid: 'u1', customToken: 'ct', expiresAt: FIXED_NOW + 300000, supportMode: false, protocolVersion: '1.0.0' },
      { appId: 'musicscale', orgId: 'org1', uid: 'u1', customToken: 'ct', expiresAt: FIXED_NOW + 300000, supportMode: false, protocolVersion: '2.0.0' },
      { appId: 'musicscale', orgId: 'other', uid: 'u1', customToken: 'ct', expiresAt: FIXED_NOW + 300000, supportMode: false, protocolVersion: '1.0.0' },
      { appId: 'musicscale', orgId: 'org1', uid: 'other', customToken: 'ct', expiresAt: FIXED_NOW + 300000, supportMode: false, protocolVersion: '1.0.0' },
      { appId: 'musicscale', orgId: 'org1', uid: 'u1', expiresAt: FIXED_NOW + 300000, supportMode: false, protocolVersion: '1.0.0' },
      { appId: 'musicscale', orgId: 'org1', uid: 'u1', customToken: '', expiresAt: FIXED_NOW + 300000, supportMode: false, protocolVersion: '1.0.0' },
      { appId: 'musicscale', orgId: 'org1', uid: 'u1', customToken: 'a'.repeat(16385), expiresAt: FIXED_NOW + 300000, supportMode: false, protocolVersion: '1.0.0' },
      { appId: 'musicscale', orgId: 'org1', uid: 'u1', customToken: 'ct', supportMode: false, protocolVersion: '1.0.0' },
      { appId: 'musicscale', orgId: 'org1', uid: 'u1', customToken: 'ct', expiresAt: 'invalid', supportMode: false, protocolVersion: '1.0.0' },
      { appId: 'musicscale', orgId: 'org1', uid: 'u1', customToken: 'ct', expiresAt: NaN, supportMode: false, protocolVersion: '1.0.0' },
      { appId: 'musicscale', orgId: 'org1', uid: 'u1', customToken: 'ct', expiresAt: Infinity, supportMode: false, protocolVersion: '1.0.0' },
      { appId: 'musicscale', orgId: 'org1', uid: 'u1', customToken: 'ct', expiresAt: FIXED_NOW - 1000, supportMode: false, protocolVersion: '1.0.0' },
      { appId: 'musicscale', orgId: 'org1', uid: 'u1', customToken: 'ct', expiresAt: FIXED_NOW + 700000, supportMode: false, protocolVersion: '1.0.0' },
      { appId: 'musicscale', orgId: 'org1', uid: 'u1', customToken: 'ct', expiresAt: FIXED_NOW + 300000, protocolVersion: '1.0.0' },
      { appId: 'musicscale', orgId: 'org1', uid: 'u1', customToken: 'ct', expiresAt: FIXED_NOW + 300000, supportMode: 'true', protocolVersion: '1.0.0' },
      null, // json throws
      [] // array
    ];

    for (let c of invalidCases) {
      const deps = new FakeDependencies();
      deps.fetchResponses.push({ ok: true, status: 200, body: c, jsonThrows: c === null });
      let thrown = false;
      try { await openEcosystemModule('musicscale', user, profile, org, currentUserData, deps as any); } catch (e: any) { thrown = true; assert(e.message === 'A resposta de acesso ao MusicScale é inválida. Tente novamente.', 'lança erro público correto'); }
      assert(thrown, 'deve rejeitar');
      assert(deps.markPerformanceCalled.filter(n => n === 'handoff_completed').length === 0, 'handoff_completed zero');
      assert(deps.assignCount === 0, 'assignCount zero');
      assert(deps.currentFetchCount === 1, 'não repetir (currentFetchCount == 1)');
    }

    // PRIVACIDADE E HIGIENE
    const expectedPayload = {
      appId: 'musicscale',
      orgId: 'org1',
      userId: 'u1',
      customToken: 'ct',
      expiresAt: FIXED_NOW + 300000,
      supportMode: false,
      protocolVersion: '1.0.0'
    };
    
    const depsPayload = new FakeDependencies();
    depsPayload.fetchResponses.push({ ok: true, status: 200, body: { appId: 'musicscale', orgId: 'org1', uid: 'u1', customToken: 'ct', expiresAt: FIXED_NOW + 300000, supportMode: false, protocolVersion: '1.0.0' } });
    await openEcosystemModule('musicscale', user, profile, org, currentUserData, depsPayload as any);
    const urlPayload = new URL(depsPayload.assignedUrl!);
    const ctxPayload = JSON.parse(atob(urlPayload.searchParams.get('ecosystem_ctx')!));
    assertDeepStrictEqual(ctxPayload, expectedPayload, 'payload correto das sete chaves');
    
    assert(ctxPayload.email === undefined, 'sem email');
    assert(ctxPayload.displayName === undefined, 'sem displayName');
    assert(ctxPayload.user === undefined, 'sem user');
    assert(ctxPayload.organization === undefined, 'sem organization');
    assert(ctxPayload.roleDisplay === undefined, 'sem roleDisplay');
    assert(ctxPayload.systemRole === undefined, 'sem systemRole');
    assert(ctxPayload.subscriptionPlan === undefined, 'sem subscriptionPlan');
    assert(ctxPayload.subscriptionStatus === undefined, 'sem subscriptionStatus');
    assert(ctxPayload.capabilities === undefined, 'sem capabilities');
    assert(ctxPayload.canBypassBilling === undefined, 'sem canBypassBilling');
    assert(ctxPayload.canUseAllFeatures === undefined, 'sem canUseAllFeatures');

    assert(realNetworkAttempts === 0, 'realNetworkAttempts === 0');
    assert(writeAttempts === 0, 'writeAttempts === 0');
    assert(maximumFetchCountPerScenario === 2, 'maximumFetchCountPerScenario === 2');
    
    assert(!fs.existsSync('fix_lint.cjs'), 'fix_lint.cjs not exists');
    assert(!fs.existsSync('debug_mock.ts'), 'debug_mock.ts not exists');
    assert(!fs.existsSync('test_import.ts'), 'test_import.ts not exists');
    assert(!fs.existsSync('scripts/temp_launcher_bundle.mjs'), 'scripts/temp_launcher_bundle.mjs not exists');

    console.log(`assertionCount: ${assertionCount}`);
    console.log(`fetchAttempts: ${fetchAttempts}`);
    console.log(`sleepAttempts: ${sleepAttempts}`);
    console.log(`assignAttempts: ${assignAttempts}`);
    console.log(`realNetworkAttempts: ${realNetworkAttempts}`);
    console.log(`writeAttempts: ${writeAttempts}`);
    console.log(`maximumFetchCountPerScenario: ${maximumFetchCountPerScenario}`);

  } finally {
    globalThis.fetch = originalFetch;
    (http as any).request = originalHttpRequest;
    (https as any).request = originalHttpsRequest;
    fs.writeFileSync = originalWriteFileSync;
    fs.appendFileSync = originalAppendFileSync;
    fs.createWriteStream = originalCreateWriteStream;
    fs.promises.writeFile = originalWriteFile;
    fs.promises.appendFile = originalAppendFile;
  }
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
