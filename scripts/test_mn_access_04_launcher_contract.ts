import fs from 'fs';
import path from 'path';
import * as esbuild from 'esbuild';

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
const realNetworkAttempts = 0;
const writeAttempts = 0;
const FIXED_NOW = 1784806335579;

class FakeDependencies {
  public fetchResponses: any[] = [];
  public currentFetchCount = 0;
  public assignedUrl: string | null = null;
  public markPerformanceCalled: string[] = [];
  public supportSessionStr: string | null = null;

  getIdToken = async () => 'fake-id-token';
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
        if (responseData.jsonThrows) throw new Error('Invalid JSON');
        return responseData.body;
      }
    } as any;
  };
  sleep = async (ms: number) => {
    sleepAttempts++;
    check(ms, 1000, 'sleep deve ser de 1000ms');
  };
  assign = (url: string) => {
    assignAttempts++;
    this.assignedUrl = url;
  };
  now = () => FIXED_NOW;
  readSupportSession = () => this.supportSessionStr;
  markPerformance = (name: string) => {
    this.markPerformanceCalled.push(name);
  };
}

async function runTests() {
  const tmpOut = path.join(process.cwd(), 'scripts', 'temp_launcher_bundle.mjs');
  await esbuild.build({
    entryPoints: ['src/lib/ecosystemLauncher.ts'],
    outfile: tmpOut,
    bundle: true,
    format: 'esm',
    platform: 'node',
    define: {
      'import.meta.env.VITE_FIREBASE_API_KEY': '"fake"',
      'import.meta.env.VITE_FIREBASE_AUTH_DOMAIN': '"fake"',
      'import.meta.env.VITE_FIREBASE_PROJECT_ID': '"fake"',
      'import.meta.env.VITE_FIREBASE_STORAGE_BUCKET': '"fake"',
      'import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID': '"fake"',
      'import.meta.env.VITE_FIREBASE_APP_ID': '"fake"',
      'import.meta.env.VITE_MUSICSCALE_APP_URL': '"https://musicscale.millionsnest.com/start"'
    }
  });

  let openEcosystemModule: any;
  try {
    const mod = await import('file://' + tmpOut);
    openEcosystemModule = mod.openEcosystemModule;
  } finally {
    fs.unlinkSync(tmpOut);
  }

  const user = { uid: 'user-1', email: 'test@test.com', displayName: 'Test User' };
  const profile = { systemRole: 'user' };
  const org = { id: 'org-1', name: 'Org 1' };
  const currentUserData = {};

  // -----------------------------------------------------------------
  // 7.1 SUCESSO
  // -----------------------------------------------------------------
  {
    const deps = new FakeDependencies();
    deps.fetchResponses.push({
      ok: true,
      status: 200,
      body: {
        appId: 'musicscale',
        orgId: 'org-1',
        uid: 'user-1',
        customToken: 'custom-token-1',
        expiresAt: FIXED_NOW + 300000,
        supportMode: false,
        protocolVersion: '1.0.0'
      }
    });

    let fetchOpts: any;
    deps.fetchFn = async (url: any, options: any) => {
      fetchAttempts++;
      deps.currentFetchCount++;
      if (deps.currentFetchCount > maximumFetchCountPerScenario) maximumFetchCountPerScenario = deps.currentFetchCount;
      assert(url === '/api/ecosystem/create-handoff', 'endpoint é /api/ecosystem/create-handoff');
      fetchOpts = options;
      return {
        ok: true,
        status: 200,
        json: async () => deps.fetchResponses[0].body
      } as any;
    };

    await openEcosystemModule('musicscale', user, profile, org, currentUserData, deps);

    assert(deps.currentFetchCount === 1, 'fetchFn é chamado uma vez');
    assert(fetchOpts.method === 'POST', 'método é POST');
    assert(fetchOpts.headers['Authorization'] === 'Bearer fake-id-token', 'Authorization é Bearer seguido do ID token');
    assert(fetchOpts.headers['Content-Type'] === 'application/json', 'Content-Type é application/json');
    
    const bodyObj = JSON.parse(fetchOpts.body);
    assertDeepStrictEqual(Object.keys(bodyObj).sort(), ['appId', 'orgId', 'supportMode'], 'body contém somente appId, orgId e supportMode');
    assert(bodyObj.appId === 'musicscale', 'appId é musicscale');
    assert(bodyObj.orgId === 'org-1', 'orgId é a organização solicitada');
    assert(bodyObj.supportMode === false, 'supportMode é false no caso comum');

    assert(assignAttempts === 1, 'assign é chamado uma vez');
    assert(deps.markPerformanceCalled.includes('handoff_started'), 'handoff_started é marcado');
    assert(deps.markPerformanceCalled.includes('handoff_completed'), 'handoff_completed é marcado');

    const assignedUrl = new URL(deps.assignedUrl!);
    const ctxStr = assignedUrl.searchParams.get('ecosystem_ctx');
    assert(ctxStr !== null, 'ecosystem_ctx present');
    const ctx = JSON.parse(atob(ctxStr!));

    assertDeepStrictEqual(ctx, {
      appId: 'musicscale',
      orgId: 'org-1',
      userId: 'user-1',
      customToken: 'custom-token-1',
      expiresAt: FIXED_NOW + 300000,
      supportMode: false,
      protocolVersion: '1.0.0'
    }, 'payload exato');

    assert(ctx.email === undefined, 'não contém email');
    assert(ctx.displayName === undefined, 'não contém displayName');
    assert(ctx.organization === undefined, 'não contém organization');
    assert(ctx.systemRole === undefined, 'não contém systemRole');
    assert(ctx.roleDisplay === undefined, 'não contém roleDisplay');
    assert(ctx.subscriptionPlan === undefined, 'não contém subscriptionPlan');
    assert(ctx.subscriptionStatus === undefined, 'não contém subscriptionStatus');
    assert(ctx.capabilities === undefined, 'não contém capabilities');
    assert(ctx.canBypassBilling === undefined, 'não contém canBypassBilling');
    assert(ctx.canUseAllFeatures === undefined, 'não contém canUseAllFeatures');
  }

  // -----------------------------------------------------------------
  // 7.2 SUPPORT MODE
  // -----------------------------------------------------------------
  {
    const deps1 = new FakeDependencies();
    deps1.supportSessionStr = JSON.stringify({ active: true, targetOrganizationId: 'org-1' });
    deps1.fetchResponses.push({ ok: true, status: 200, body: { appId: 'musicscale', orgId: 'org-1', uid: 'user-1', customToken: 'ct', expiresAt: FIXED_NOW + 300000, supportMode: true, protocolVersion: '1.0.0' } });
    let supportModeSent = null;
    deps1.fetchFn = async (url: any, options: any) => { fetchAttempts++; deps1.currentFetchCount++; if (deps1.currentFetchCount > maximumFetchCountPerScenario) maximumFetchCountPerScenario = deps1.currentFetchCount; supportModeSent = JSON.parse(options.body).supportMode; return { ok: true, status: 200, json: async () => deps1.fetchResponses[0].body } as any; };
    await openEcosystemModule('musicscale', user, profile, org, currentUserData, deps1);
    assert(supportModeSent === true, 'request supportMode true');
    const ctx1 = JSON.parse(atob(new URL(deps1.assignedUrl!).searchParams.get('ecosystem_ctx')!));
    assert(ctx1.supportMode === true, 'payload final supportMode true');

    const deps2 = new FakeDependencies();
    deps2.supportSessionStr = JSON.stringify({ active: true, targetOrganizationId: 'org-2' });
    deps2.fetchResponses.push({ ok: true, status: 200, body: { appId: 'musicscale', orgId: 'org-1', uid: 'user-1', customToken: 'ct', expiresAt: FIXED_NOW + 300000, supportMode: false, protocolVersion: '1.0.0' } });
    let supportModeSent2 = null;
    deps2.fetchFn = async (url: any, options: any) => { fetchAttempts++; deps2.currentFetchCount++; if (deps2.currentFetchCount > maximumFetchCountPerScenario) maximumFetchCountPerScenario = deps2.currentFetchCount; supportModeSent2 = JSON.parse(options.body).supportMode; return { ok: true, status: 200, json: async () => deps2.fetchResponses[0].body } as any; };
    await openEcosystemModule('musicscale', user, profile, org, currentUserData, deps2);
    assert(supportModeSent2 === false, 'Com targetOrganizationId diferente: request supportMode false');

    const deps3 = new FakeDependencies();
    deps3.supportSessionStr = '{ invalid json';
    deps3.fetchResponses.push({ ok: true, status: 200, body: { appId: 'musicscale', orgId: 'org-1', uid: 'user-1', customToken: 'ct', expiresAt: FIXED_NOW + 300000, supportMode: false, protocolVersion: '1.0.0' } });
    let supportModeSent3 = null;
    deps3.fetchFn = async (url: any, options: any) => { fetchAttempts++; deps3.currentFetchCount++; if (deps3.currentFetchCount > maximumFetchCountPerScenario) maximumFetchCountPerScenario = deps3.currentFetchCount; supportModeSent3 = JSON.parse(options.body).supportMode; return { ok: true, status: 200, json: async () => deps3.fetchResponses[0].body } as any; };
    await openEcosystemModule('musicscale', user, profile, org, currentUserData, deps3);
    assert(supportModeSent3 === false, 'Com JSON inválido no storage: request supportMode false');
  }

  // -----------------------------------------------------------------
  // 7.3 VALIDAÇÃO DA RESPOSTA
  // -----------------------------------------------------------------
  {
    const invalidCases = [
      { appId: 'other', orgId: 'org-1', uid: 'user-1', customToken: 'ct', expiresAt: FIXED_NOW + 300000, supportMode: false, protocolVersion: '1.0.0' },
      { appId: 'musicscale', orgId: 'org-1', uid: 'user-1', customToken: 'ct', expiresAt: FIXED_NOW + 300000, supportMode: false, protocolVersion: '2.0.0' },
      { appId: 'musicscale', orgId: 'other', uid: 'user-1', customToken: 'ct', expiresAt: FIXED_NOW + 300000, supportMode: false, protocolVersion: '1.0.0' },
      { appId: 'musicscale', orgId: 'org-1', uid: 'other', customToken: 'ct', expiresAt: FIXED_NOW + 300000, supportMode: false, protocolVersion: '1.0.0' },
      { appId: 'musicscale', orgId: 'org-1', uid: 'user-1', expiresAt: FIXED_NOW + 300000, supportMode: false, protocolVersion: '1.0.0' },
      { appId: 'musicscale', orgId: 'org-1', uid: 'user-1', customToken: '', expiresAt: FIXED_NOW + 300000, supportMode: false, protocolVersion: '1.0.0' },
      { appId: 'musicscale', orgId: 'org-1', uid: 'user-1', customToken: 'a'.repeat(16385), expiresAt: FIXED_NOW + 300000, supportMode: false, protocolVersion: '1.0.0' },
      { appId: 'musicscale', orgId: 'org-1', uid: 'user-1', customToken: 'ct', supportMode: false, protocolVersion: '1.0.0' },
      { appId: 'musicscale', orgId: 'org-1', uid: 'user-1', customToken: 'ct', expiresAt: 'invalid', supportMode: false, protocolVersion: '1.0.0' },
      { appId: 'musicscale', orgId: 'org-1', uid: 'user-1', customToken: 'ct', expiresAt: FIXED_NOW - 1000, supportMode: false, protocolVersion: '1.0.0' },
      { appId: 'musicscale', orgId: 'org-1', uid: 'user-1', customToken: 'ct', expiresAt: FIXED_NOW + 700000, supportMode: false, protocolVersion: '1.0.0' },
      { appId: 'musicscale', orgId: 'org-1', uid: 'user-1', customToken: 'ct', expiresAt: FIXED_NOW + 300000, protocolVersion: '1.0.0' },
      { appId: 'musicscale', orgId: 'org-1', uid: 'user-1', customToken: 'ct', expiresAt: FIXED_NOW + 300000, supportMode: 'true', protocolVersion: '1.0.0' },
      null
    ];

    for (let c of invalidCases) {
      const deps = new FakeDependencies();
      deps.fetchResponses.push({ ok: true, status: 200, body: c, jsonThrows: c === null });
      let thrown = false;
      try { await openEcosystemModule('musicscale', user, profile, org, currentUserData, deps); } catch (e: any) { thrown = true; assert(e.message === 'A resposta de acesso ao MusicScale é inválida. Tente novamente.', 'lança erro público correto'); }
      assert(thrown, 'deve rejeitar');
      assert(deps.assignedUrl === null, 'não chamar assign');
      assert(deps.currentFetchCount === 1, 'não repetir (currentFetchCount == 1)');
    }
  }

  // -----------------------------------------------------------------
  // 7.4 RETENTATIVA
  // -----------------------------------------------------------------
  {
    const deps = new FakeDependencies();
    deps.fetchResponses.push({ ok: false, status: 503, body: { retryable: true } });
    deps.fetchResponses.push({ ok: true, status: 200, body: { appId: 'musicscale', orgId: 'org-1', uid: 'user-1', customToken: 'ct', expiresAt: FIXED_NOW + 300000, supportMode: false, protocolVersion: '1.0.0' } });
    const initialAssignAttempts = assignAttempts;
    const initialSleepAttempts = sleepAttempts;
    await openEcosystemModule('musicscale', user, profile, org, currentUserData, deps);
    assert(deps.currentFetchCount === 2, 'duas chamadas fetch');
    assert(sleepAttempts === initialSleepAttempts + 1, 'uma chamada sleep');
    assert(assignAttempts === initialAssignAttempts + 1, 'um assign');
  }

  {
    const deps = new FakeDependencies();
    deps.fetchResponses.push({ ok: false, status: 403, body: { reason: 'SUBSCRIPTION_NOT_FOUND', retryable: true } });
    deps.fetchResponses.push({ ok: true, status: 200, body: { appId: 'musicscale', orgId: 'org-1', uid: 'user-1', customToken: 'ct', expiresAt: FIXED_NOW + 300000, supportMode: false, protocolVersion: '1.0.0' } });
    await openEcosystemModule('musicscale', user, profile, org, currentUserData, deps);
    assert(deps.currentFetchCount === 2, 'duas chamadas fetch no Cenário B');
  }

  {
    const deps = new FakeDependencies();
    deps.fetchResponses.push({ ok: false, status: 403, body: { error: 'Subscription missing', retryable: false } });
    const initialAssignAttempts = assignAttempts;
    const initialSleepAttempts = sleepAttempts;
    let thrown = false;
    try { await openEcosystemModule('musicscale', user, profile, org, currentUserData, deps); } catch(e) { thrown = true; }
    assert(thrown, 'deve lançar');
    assert(deps.currentFetchCount === 1, 'somente uma chamada fetch');
    assert(sleepAttempts === initialSleepAttempts, 'nenhuma chamada sleep');
    assert(assignAttempts === initialAssignAttempts, 'nenhum assign');
  }

  {
    const deps = new FakeDependencies();
    deps.fetchResponses.push({ ok: false, status: 503, body: { retryable: true } });
    deps.fetchResponses.push({ ok: false, status: 503, body: { retryable: true } });
    const initialAssignAttempts = assignAttempts;
    const initialSleepAttempts = sleepAttempts;
    let thrown = false;
    try { await openEcosystemModule('musicscale', user, profile, org, currentUserData, deps); } catch(e) { thrown = true; }
    assert(thrown, 'deve lançar');
    assert(deps.currentFetchCount === 2, 'total máximo de duas chamadas');
    assert(sleepAttempts === initialSleepAttempts + 1, 'uma chamada sleep');
    assert(assignAttempts === initialAssignAttempts, 'nenhum assign');
  }

  {
    const deps = new FakeDependencies();
    deps.fetchResponses.push({ ok: false, status: 400, body: { retryable: true } });
    let thrown = false;
    try { await openEcosystemModule('musicscale', user, profile, org, currentUserData, deps); } catch(e) { thrown = true; }
    assert(thrown, 'deve lançar');
    assert(deps.currentFetchCount === 1, 'não repetir (status 400)');
  }

  {
    const deps = new FakeDependencies();
    deps.fetchResponses.push({ ok: false, status: 401, body: { retryable: true } });
    let thrown = false;
    try { await openEcosystemModule('musicscale', user, profile, org, currentUserData, deps); } catch(e) { thrown = true; }
    assert(thrown, 'deve lançar');
    assert(deps.currentFetchCount === 1, 'não repetir (status 401)');
  }

  // -----------------------------------------------------------------
  // 7.5 PRIVACIDADE E HIGIENE
  // -----------------------------------------------------------------
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

  console.log(`assertionCount: ${assertionCount}`);
  console.log(`fetchAttempts: ${fetchAttempts}`);
  console.log(`sleepAttempts: ${sleepAttempts}`);
  console.log(`assignAttempts: ${assignAttempts}`);
  console.log(`realNetworkAttempts: ${realNetworkAttempts}`);
  console.log(`writeAttempts: ${writeAttempts}`);
  console.log(`maximumFetchCountPerScenario: ${maximumFetchCountPerScenario}`);

}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
