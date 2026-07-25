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

  getIdToken = async () => {
    this.getIdTokenAttempts++;
    return 'fake-id-token';
  };
  
  fetchFn = async (url: any, options: any) => {
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
    sleepAttempts++;
    this.sleepCount++;
  };
  
  assign = (url: string) => {
    assignAttempts++;
    this.assignCount++;
    this.assignedUrl = url;
  };
  
  now = () => FIXED_NOW;
  
  readSupportSession = () => this.supportSessionStr;
  
  markPerformance = (name: string) => {
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

    const user = { uid: 'u1' };
    const profile = {};
    const org = { id: 'org1' };
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

    // 5.6 TOKEN E TELEMETRIA
    // Sucesso comum
    {
      const deps = new FakeDependencies();
      deps.fetchResponses.push({ ok: true, status: 200, body: { appId: 'musicscale', orgId: 'org1', uid: 'u1', customToken: 'ct', expiresAt: FIXED_NOW + 300000, supportMode: false, protocolVersion: '1.0.0' } });
      await openEcosystemModule('musicscale', user, profile, org, currentUserData, deps as any);
      
      assert(deps.getIdTokenAttempts === 1, 'getIdTokenAttempts === 1');
      assert(deps.currentFetchCount === 1, 'currentFetchCount === 1');
      assert(deps.markPerformanceCalled.filter(n => n === 'handoff_started').length === 1, 'handoff_started exatamente uma vez');
      assert(deps.markPerformanceCalled.filter(n => n === 'handoff_completed').length === 1, 'handoff_completed exatamente uma vez');
      assert(deps.assignCount === 1, 'assignCount === 1');
    }

    // Retentativa 503 -> 200
    {
      const deps = new FakeDependencies();
      deps.fetchResponses.push({ ok: false, status: 503, body: { retryable: true } });
      deps.fetchResponses.push({ ok: true, status: 200, body: { appId: 'musicscale', orgId: 'org1', uid: 'u1', customToken: 'ct', expiresAt: FIXED_NOW + 300000, supportMode: false, protocolVersion: '1.0.0' } });
      await openEcosystemModule('musicscale', user, profile, org, currentUserData, deps as any);
      
      assert(deps.getIdTokenAttempts === 1, 'getIdTokenAttempts === 1 (retry)');
      assert(deps.currentFetchCount === 2, 'currentFetchCount === 2 (retry)');
      assert(deps.sleepCount === 1, 'sleepCount === 1 (retry)');
      assert(deps.markPerformanceCalled.filter(n => n === 'handoff_started').length === 1, 'handoff_started exatamente uma vez (retry)');
      assert(deps.markPerformanceCalled.filter(n => n === 'handoff_completed').length === 1, 'handoff_completed exatamente uma vez (retry)');
      assert(deps.assignCount === 1, 'assignCount === 1 (retry)');
    }

    // Duas respostas retryable sem sucesso
    {
      const deps = new FakeDependencies();
      deps.fetchResponses.push({ ok: false, status: 503, body: { retryable: true } });
      deps.fetchResponses.push({ ok: false, status: 503, body: { retryable: true } });
      let thrown = false;
      try {
        await openEcosystemModule('musicscale', user, profile, org, currentUserData, deps as any);
      } catch(e) { thrown = true; }
      
      assert(thrown, 'deve lançar');
      assert(deps.getIdTokenAttempts === 1, 'getIdTokenAttempts === 1');
      assert(deps.currentFetchCount === 2, 'currentFetchCount === 2');
      assert(deps.markPerformanceCalled.filter(n => n === 'handoff_started').length === 1, 'handoff_started exatamente uma vez');
      assert(deps.markPerformanceCalled.filter(n => n === 'handoff_completed').length === 0, 'handoff_completed zero');
      assert(deps.assignCount === 0, 'assignCount zero');
    }

    // Invalid cases 
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
      { appId: 'musicscale', orgId: 'org1', uid: 'u1', customToken: 'ct', expiresAt: FIXED_NOW - 1000, supportMode: false, protocolVersion: '1.0.0' },
      { appId: 'musicscale', orgId: 'org1', uid: 'u1', customToken: 'ct', expiresAt: FIXED_NOW + 700000, supportMode: false, protocolVersion: '1.0.0' },
      { appId: 'musicscale', orgId: 'org1', uid: 'u1', customToken: 'ct', expiresAt: FIXED_NOW + 300000, protocolVersion: '1.0.0' },
      { appId: 'musicscale', orgId: 'org1', uid: 'u1', customToken: 'ct', expiresAt: FIXED_NOW + 300000, supportMode: 'true', protocolVersion: '1.0.0' },
      null
    ];

    for (let c of invalidCases) {
      const deps = new FakeDependencies();
      deps.fetchResponses.push({ ok: true, status: 200, body: c, jsonThrows: c === null });
      let thrown = false;
      try { await openEcosystemModule('musicscale', user, profile, org, currentUserData, deps as any); } catch (e: any) { thrown = true; assert(e.message === 'A resposta de acesso ao MusicScale é inválida. Tente novamente.', 'lança erro público correto'); }
      assert(thrown, 'deve rejeitar');
      assert(deps.markPerformanceCalled.filter(n => n === 'handoff_started').length === 1, 'handoff_started exatamente uma vez');
      assert(deps.markPerformanceCalled.filter(n => n === 'handoff_completed').length === 0, 'handoff_completed zero');
      assert(deps.assignCount === 0, 'assignCount zero');
      assert(deps.currentFetchCount === 1, 'não repetir (currentFetchCount == 1)');
    }

    // PRIVACIDADE E HIGIENE
    const launcherPath = path.resolve('src/lib/ecosystemLauncher.ts');
    const launcherSrc = fs.readFileSync(launcherPath, 'utf8');
    assert(!launcherSrc.includes('Subscription missing'), 'ausência do texto Subscription missing');
    assert(!launcherSrc.includes('errorData.error.includes'), 'ausência de errorData.error.includes');
    assert(!launcherSrc.includes('resolveUserRoleDisplay'), 'ausência de resolveUserRoleDisplay');
    assert(!launcherSrc.includes('isGlobalPrivilegedUser'), 'ausência de isGlobalPrivilegedUser');
    assert(!launcherSrc.includes('user: {'), 'ausência da criação da chave user no payload de URL');
    assert(!launcherSrc.includes('organization: {'), 'ausência da criação da chave organization no payload de URL');
    assert(!launcherSrc.includes('capabilities: {'), 'ausência da criação da chave capabilities no payload de URL');
    assert(!launcherSrc.includes('localStorage.setItem(\'customToken'), 'nenhuma gravação de customToken em localStorage');
    assert(!launcherSrc.includes('localStorage.setItem("customToken'), 'nenhuma gravação de customToken em localStorage');
    assert(!launcherSrc.includes('sessionStorage.setItem'), 'nenhuma gravação de customToken em sessionStorage');
    assert(!launcherSrc.includes('document.cookie'), 'nenhuma gravação de customToken em cookie');

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
    const url = new URL(depsPayload.assignedUrl!);
    const ctx = JSON.parse(atob(url.searchParams.get('ecosystem_ctx')!));
    assertDeepStrictEqual(ctx, expectedPayload, 'payload correto das sete chaves');
    
    assert(ctx.email === undefined, 'sem email');
    assert(ctx.displayName === undefined, 'sem displayName');
    assert(ctx.user === undefined, 'sem user');
    assert(ctx.organization === undefined, 'sem organization');
    assert(ctx.roleDisplay === undefined, 'sem roleDisplay');
    assert(ctx.systemRole === undefined, 'sem systemRole');
    assert(ctx.subscriptionPlan === undefined, 'sem subscriptionPlan');
    assert(ctx.subscriptionStatus === undefined, 'sem subscriptionStatus');
    assert(ctx.capabilities === undefined, 'sem capabilities');
    assert(ctx.canBypassBilling === undefined, 'sem canBypassBilling');
    assert(ctx.canUseAllFeatures === undefined, 'sem canUseAllFeatures');

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
