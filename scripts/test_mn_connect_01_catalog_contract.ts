import { ECOSYSTEM_APPS, getAvailableApps, getInstalledApps, EcosystemApp } from '../src/lib/apps.js';
import { openEcosystemModule, EcosystemLauncherDependencies } from '../src/lib/ecosystemLauncher.js';
import { User } from 'firebase/auth';

let testCount = 0;
let passCount = 0;
let failCount = 0;
let skipCount = 0;
let assertionCount = 0;

function assert(condition: boolean, message: string) {
  assertionCount++;
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTest(name: string, testFn: () => void | Promise<void>) {
  testCount++;
  try {
    await testFn();
    passCount++;
    console.log(`[PASS] ${name}`);
  } catch (error: unknown) {
    failCount++;
    if (error instanceof Error) {
      console.error(`[FAIL] ${name} - ${error.message}`);
    } else {
      console.error(`[FAIL] ${name} - ${String(error)}`);
    }
  }
}

class MockDependencies implements EcosystemLauncherDependencies {
  loadedApps: EcosystemApp[] = ECOSYSTEM_APPS;
  idTokenCalls = 0;
  fetchCalls = 0;
  assignCalls = 0;
  
  now = () => Date.now();
  sleep = async (ms: number) => {};
  assign = (url: string) => { this.assignCalls++; };
  readSupportSession = () => null;
  markPerformance = (name: string) => {};
  loadApps = async () => this.loadedApps;
  
  async getIdToken(): Promise<string> {
    this.idTokenCalls++;
    return 'mock-token';
  }
  
  async fetchFn(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    this.fetchCalls++;
    return new Response();
  }
}

async function runAll() {
  console.log('--- TEST MN CONNECT 01 CATALOG CONTRACT ---');

  await runTest('A. REGISTRO', () => {
    const connectApps = ECOSYSTEM_APPS.filter(app => app.id === 'connect');
    assert(connectApps.length === 1, 'existe exatamente uma entrada com id connect');
    
    const ids = ECOSYSTEM_APPS.map(app => app.id);
    const uniqueIds = new Set(ids);
    assert(ids.length === uniqueIds.size, 'não existem IDs duplicados no catálogo');
    
    const connectApp = connectApps[0];
    assert(connectApp.name === 'MillionsNest Connect', 'o nome é MillionsNest Connect');
    assert(connectApp.status === 'coming_soon', 'status é coming_soon');
    assert(connectApp.primaryAction === 'disabled', 'primaryAction é disabled');
    assert(connectApp.category === 'beta', 'category é beta');
    assert(connectApp.requiredPlan === 'free', 'requiredPlan é free');
    assert(connectApp.badgeLabelKey === 'footer_soon', 'badgeLabelKey é footer_soon');
    assert(connectApp.order === 2, 'order é 2');
  });

  await runTest('B. AUSÊNCIA DE DESTINO EXECUTÁVEL', () => {
    const connectApp = ECOSYSTEM_APPS.find(app => app.id === 'connect')!;
    assert(connectApp !== undefined, 'app connect was found');
    
    const isEmptyOrUndefined = (val: string | undefined) => {
      if (val === undefined) return true;
      if (val.trim() === '') return true;
      if (val === '#') return false;
      return false;
    };
    
    assert(connectApp.url === undefined || connectApp.url.trim() === '', 'url is undefined or empty string');
    assert(connectApp.operationalUrl === undefined || connectApp.operationalUrl.trim() === '', 'operationalUrl is undefined or empty string');
    assert(connectApp.internalRoute === undefined || connectApp.internalRoute.trim() === '', 'internalRoute is undefined or empty string');
    assert(connectApp.landingRoute === undefined || connectApp.landingRoute.trim() === '', 'landingRoute is undefined or empty string');
    
    assert(connectApp.url !== '#', 'url is not #');
  });

  await runTest('C. ORDEM', () => {
    const available = getAvailableApps([]);
    assert(available.length >= 6, 'has at least 6 apps');
    assert(available[0].id === 'musicscale', '1 is musicscale');
    assert(available[1].id === 'connect', '2 is connect');
    assert(available[2].id === 'nestfinance', '3 is nestfinance');
    assert(available[3].id === 'services', '4 is services');
    assert(available[4].id === 'cells', '5 is cells');
    assert(available[5].id === 'members', '6 is members');
  });

  await runTest('D. NÃO INSTALADO POR PADRÃO', () => {
    const installed = getInstalledApps([]);
    const hasConnect = installed.some(app => app.id === 'connect');
    assert(!hasConnect, 'connect is not in getInstalledApps([])');
  });

  await runTest('E. LAUNCHER BLOQUEADO ANTES DA AUTENTICAÇÃO', async () => {
    const deps = new MockDependencies();
    
    const mockUser = { uid: 'u1' };
    const mockProfile = { systemRole: 'user' };
    const mockOrg = { id: 'org1' };
    const mockUserData = {};
    
    let rejected = false;
    let errorMessage = '';
    
    // reset localStorage marks
    // localStorage.removeItem('handoff_started');
    // localStorage.removeItem('handoff_completed');
    
    try {
      await openEcosystemModule('connect', mockUser, mockProfile, mockOrg, mockUserData, deps);
    } catch (e: unknown) {
      rejected = true;
      if (e instanceof Error) errorMessage = e.message;
    }
    
    assert(rejected, 'must reject');
    assert(errorMessage.includes('não encontrado'), 'esperar rejeição com a mensagem pública atual de aplicativo sem destino válido');
    
    assert(deps.idTokenCalls === 0, 'getIdToken não foi chamado');
    assert(deps.fetchCalls === 0, 'fetchFn não foi chamado');
    assert(deps.assignCalls === 0, 'assign não foi chamado');
    
    // assert(localStorage.getItem('handoff_started') === null, 'handoff_started não foi marcado');
    // assert(localStorage.getItem('handoff_completed') === null, 'handoff_completed não foi marcado');
  });

  await runTest('F. REGRESSÃO DOS APPS EXISTENTES', () => {
    const musicscale = ECOSYSTEM_APPS.find(a => a.id === 'musicscale')!;
    assert(musicscale.status === 'active', 'musicscale continua active');
    assert(musicscale.primaryAction === 'open', 'musicscale continua primaryAction open');
    assert(typeof musicscale.url === 'string' && musicscale.url.length > 0, 'musicscale continua com URL não vazia');
    
    const nestfinance = ECOSYSTEM_APPS.find(a => a.id === 'nestfinance')!;
    assert(nestfinance.status === 'coming_soon', 'nestfinance continua coming_soon');
    assert(nestfinance.primaryAction === 'disabled', 'nestfinance continua primaryAction disabled');
  });

  console.log('--- SUMMARY ---');
  console.log(`Total: ${testCount}`);
  console.log(`Passed: ${passCount}`);
  console.log(`Failed: ${failCount}`);
  console.log(`Skipped: ${skipCount}`);
  console.log(`Assertions: ${assertionCount}`);
  
  if (failCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAll().catch(err => {
  console.error(err);
  process.exit(1);
});
