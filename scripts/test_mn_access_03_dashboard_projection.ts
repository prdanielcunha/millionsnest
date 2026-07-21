import assert from 'assert';
import { handleEcosystemAccessProjectionRequest } from '../src/server/services/EcosystemAccessProjectionService.js';
import { mapCanonicalDecisionToCatalogState } from '../src/lib/ecosystemAccessProjection.js';
import * as fs from 'fs';
import * as path from 'path';

let assertionsRun = 0;
let passedAssertions = 0;

function assertCondition(condition: boolean, message: string) {
  assertionsRun++;
  if (!condition) {
    console.error(`❌ [FAILED] ${message}`);
    assert(condition, message);
  }
  passedAssertions++;
}

async function runTests() {
  console.log("Starting test_mn_access_03_dashboard_projection...");

  const dashboardContent = fs.readFileSync(path.resolve('src/pages/Dashboard.tsx'), 'utf8');
  assertCondition(dashboardContent.includes('/api/ecosystem/access-projection'), "Dashboard chama a nova rota");
  assertCondition(!dashboardContent.includes('const getMusicScaleCatalogState = ()'), "Dashboard não define mais getMusicScaleCatalogState");
  assertCondition(dashboardContent.includes('musicScaleProjection?.accessible === true'), "Dashboard usa projection.accessible para installedApps");
  assertCondition(dashboardContent.includes('refreshMusicScaleAccessProjection'), "Dashboard limpa/atualiza projeção");
  assertCondition(dashboardContent.includes('AbortController'), "Dashboard possui proteção contra resposta atrasada");
  assertCondition(!dashboardContent.includes('const isTrialing = subscription?.status === "trialing" || subscription?.status === "trial";'), "Dashboard não usa isTrialing de sub");
  assertCondition(!dashboardContent.includes('const isActive = subscription?.status === "active" || subscription?.status === "pro";'), "Dashboard não usa isActive de sub");
  assertCondition(!dashboardContent.includes('const isCanceled = subscription?.status === "canceled";'), "Dashboard não usa isCanceled de sub");
  assertCondition(!dashboardContent.includes('Date.now() < endMs'), "Dashboard não usa canceled com data futura como acesso");
  assertCondition(dashboardContent.includes('if (musicScaleProjectionLoading) return \'musicscale\';'), "Dashboard não vaza do loading");
  assertCondition(dashboardContent.includes('if (!msIsInstalled) {'), "Dashboard bloqueia workspace se o acesso for revogado");
  assertCondition(dashboardContent.includes('musicScaleProjection.organizationId !== activeContextOrgId'), "Dashboard verifica organizationId da resposta");
  assertCondition(dashboardContent.includes('!musicScaleProjection.accessible'), "Dashboard usa projection.accessible antes do lançamento");
  assertCondition(dashboardContent.includes('setMusicScaleProjection(null)'), "Dashboard limpa projeção na troca de organização");
  assertCondition(!dashboardContent.includes('organization.enabledApps?.includes(app.id) && app.id === \'musicscale\''), "Dashboard não usa organization.enabledApps para MusicScale");
  assertCondition(dashboardContent.includes('musicScaleProjectionError'), "Dashboard falha fechado");
  assertCondition(dashboardContent.includes('refreshMusicScaleAccessProjection(activeContextOrgId!)'), "Dashboard tem acao de tentar verificar novamente no error");
  assertCondition(dashboardContent.includes('Tentar novamente'), "Dashboard mostra tentar novamente");

  const ewsContent = fs.readFileSync(path.resolve('src/components/dashboard/EcosystemWorkspaceHome.tsx'), 'utf8');
  assertCondition(ewsContent.includes('musicScaleAccess'), "EcosystemWorkspaceHome usa musicScaleAccess");
  assertCondition(!ewsContent.includes('msIsInstalled: boolean'), "EcosystemWorkspaceHome removeu msIsInstalled");
  assertCondition(!ewsContent.includes('msCatalogState: string'), "EcosystemWorkspaceHome removeu msCatalogState");
  assertCondition(ewsContent.includes('musicScaleAccess?.catalogState === "loading"'), "loading verificado");
  assertCondition(ewsContent.includes('musicScaleAccess?.catalogState === "error"'), "error verificado");
  assertCondition(ewsContent.includes('musicScaleAccess?.catalogState === "payment_issue"'), "payment_issue verificado");
  assertCondition(ewsContent.includes('musicScaleAccess?.accessible === true'), "isReadyToOpen usa accessible");
  assertCondition(!ewsContent.includes('msIsInstalled && !isLoading'), "legacy isReadyToOpen removido");
  assertCondition(!ewsContent.includes('subscription.status'), "EcosystemWorkspaceHome não reinterpreta subscription.status");
  assertCondition(!ewsContent.includes('subscription.currentPeriodEnd'), "EcosystemWorkspaceHome não reinterpreta currentPeriodEnd");
  assertCondition(!ewsContent.includes('subscription.cancelAtPeriodEnd'), "EcosystemWorkspaceHome não reinterpreta cancelAtPeriodEnd");
  assertCondition(!ewsContent.includes('msCatalogState ==='), "unavailable não pode abrir diretamente via antigo estado");
  
  // Mapping tests logic coverage
  const states = [
    { a: true, g: true, r: null, c: 'active', s: false, res: 'administrative', msg: 'global access' },
    { a: true, g: true, r: null, c: 'trialing', s: false, res: 'administrative', msg: 'global overrides trialing' },
    { a: true, g: false, r: null, c: 'active', s: true, res: 'cancel_scheduled', msg: 'cancel_scheduled active' },
    { a: true, g: false, r: null, c: 'trialing', s: true, res: 'cancel_scheduled', msg: 'cancel_scheduled trialing' },
    { a: true, g: false, r: null, c: 'active', s: false, res: 'active', msg: 'active regular' },
    { a: true, g: false, r: null, c: 'trialing', s: false, res: 'trialing', msg: 'trialing regular' },
    { a: true, g: false, r: null, c: 'missing', s: false, res: 'active', msg: 'accessible with missing status defaults to active' },
    { a: true, g: false, r: null, c: undefined, s: undefined, res: 'active', msg: 'accessible with undefined status defaults to active' },
    { a: false, g: false, r: 'SUBSCRIPTION_PAYMENT_REQUIRED', c: undefined, s: undefined, res: 'payment_issue', msg: 'payment issue' },
    { a: false, g: false, r: 'SUBSCRIPTION_NOT_FOUND', c: undefined, s: undefined, res: 'available', msg: 'sub missing' },
    { a: false, g: false, r: 'SUBSCRIPTION_INACTIVE', c: undefined, s: undefined, res: 'available', msg: 'sub inactive' },
    { a: false, g: false, r: 'ENTITLEMENT_NOT_CONFIGURED', c: undefined, s: undefined, res: 'available', msg: 'ent missing' },
    { a: false, g: false, r: 'ENTITLEMENT_INACTIVE', c: undefined, s: undefined, res: 'available', msg: 'ent inactive' },
    { a: false, g: false, r: 'MEMBERSHIP_NOT_FOUND', c: undefined, s: undefined, res: 'unavailable', msg: 'membership missing' },
    { a: false, g: false, r: 'USER_INACTIVE', c: undefined, s: undefined, res: 'unavailable', msg: 'user inactive' },
    { a: false, g: false, r: 'ORGANIZATION_INACTIVE', c: undefined, s: undefined, res: 'unavailable', msg: 'org inactive' },
    { a: false, g: false, r: 'APP_DISABLED_FOR_MEMBER', c: undefined, s: undefined, res: 'unavailable', msg: 'app disabled' },
    { a: false, g: false, r: 'UNKNOWN_ERROR', c: undefined, s: undefined, res: 'unavailable', msg: 'unknown error' },
    { a: false, g: false, r: null, c: undefined, s: undefined, res: 'unavailable', msg: 'null reason' }
  ];

  states.forEach(s => {
    assertCondition(mapCanonicalDecisionToCatalogState(s.a, s.g, s.r, s.c as any, s.s) === s.res, s.msg);
  });

  let resolveCount = 0;
  let mockResolveResponse: any = {};
  const mockResolve = async (params: any) => {
    resolveCount++;
    assertCondition(params.appId === 'musicscale', "appId enviado ao resolvedor é exatamente musicscale");
    assertCondition(params.uid === 'uid-123', "UID enviado é exatamente o token verificado");
    return mockResolveResponse;
  };

  const createReqRes = (headers: any, body: any) => {
    let sentStatus = 0;
    let sentJson: any = null;
    let headersSet: any = {};
    return {
      req: {
        headers,
        body
      } as any,
      res: {
        setHeader: (k: string, v: string) => { headersSet[k] = v; },
        status: (s: number) => { sentStatus = s; return { json: (j: any) => { sentJson = j; } }; }
      } as any,
      getSent: () => ({ status: sentStatus, json: sentJson, headers: headersSet })
    };
  };

  let mockDecodedUid = 'uid-123';
  let loggerOutput: any = {};
  const deps = {
    verifyIdToken: async (t: string) => {
      if (t === 'invalid') throw new Error();
      if (t === 'nouid') return {} as any;
      return { uid: mockDecodedUid } as any;
    },
    getDb: () => ({}) as any,
    resolveAccess: mockResolve,
    now: () => 1000,
    logger: { 
      log: (msg: string, data: any) => { loggerOutput = { msg, data }; }, 
      error: (msg: string, data: any) => { loggerOutput = { msg, data }; } 
    }
  };

  // HTTP Validation Suite
  const validations = [
    { h: {}, b: {}, expectedStatus: 401, msg: 'Authorization ausente' },
    { h: { authorization: 'Basic Ymxh' }, b: {}, expectedStatus: 401, msg: 'Basic Auth' },
    { h: { authorization: 'Bearer ' }, b: {}, expectedStatus: 401, msg: 'Bearer vazio' },
    { h: { authorization: ['Bearer token'] }, b: {}, expectedStatus: 401, msg: 'Authorization array' },
    { h: { authorization: 'Bearer invalid' }, b: {}, expectedStatus: 401, msg: 'Token invalido' },
    { h: { authorization: 'Bearer nouid' }, b: {}, expectedStatus: 401, msg: 'Token sem uid' },
    { h: { authorization: 'Bearer valid' }, b: null, expectedStatus: 400, msg: 'Body null' },
    { h: { authorization: 'Bearer valid' }, b: undefined, expectedStatus: 400, msg: 'Body undefined' },
    { h: { authorization: 'Bearer valid' }, b: [], expectedStatus: 400, msg: 'Body array' },
    { h: { authorization: 'Bearer valid' }, b: { uid: 'fake' }, expectedStatus: 400, msg: 'OrgId ausente' },
    { h: { authorization: 'Bearer valid' }, b: { organizationId: '' }, expectedStatus: 400, msg: 'OrgId vazio' },
    { h: { authorization: 'Bearer valid' }, b: { organizationId: '   ' }, expectedStatus: 400, msg: 'OrgId espacos' },
    { h: { authorization: 'Bearer valid' }, b: { organizationId: 'a'.repeat(257) }, expectedStatus: 400, msg: 'OrgId longo' },
    { h: { authorization: 'Bearer valid' }, b: { organizationId: '.' }, expectedStatus: 400, msg: 'OrgId .' },
    { h: { authorization: 'Bearer valid' }, b: { organizationId: 'org..test' }, expectedStatus: 400, msg: 'OrgId ..' },
    { h: { authorization: 'Bearer valid' }, b: { organizationId: 'org/test' }, expectedStatus: 400, msg: 'OrgId slash' },
    { h: { authorization: 'Bearer valid' }, b: { organizationId: 'org\\test' }, expectedStatus: 400, msg: 'OrgId backslash' },
    { h: { authorization: 'Bearer valid' }, b: { organizationId: 'org\ntest' }, expectedStatus: 400, msg: 'OrgId nl' },
  ];

  for (const v of validations) {
    const t = createReqRes(v.h, v.b);
    await handleEcosystemAccessProjectionRequest(t.req, t.res, deps);
    assertCondition(t.getSent().status === v.expectedStatus, v.msg);
  }

  const depsNoDb = { ...deps, getDb: () => null };
  const test19 = createReqRes({ authorization: 'Bearer valid' }, { organizationId: 'org1' });
  await handleEcosystemAccessProjectionRequest(test19.req, test19.res, depsNoDb);
  assertCondition(test19.getSent().status === 503, "banco indisponível");

  resolveCount = 0;
  mockResolveResponse = {
    accessible: true,
    isGlobalAccess: true,
    accessSource: 'global_system_role',
    denialReason: null,
    entitlement: null
  };
  const test20 = createReqRes({ authorization: 'Bearer valid' }, { organizationId: 'org1', uid: 'ignore', systemRole: 'ignore', accessible: false });
  await handleEcosystemAccessProjectionRequest(test20.req, test20.res, deps);
  const res20 = test20.getSent();
  assertCondition(resolveCount === 1, "exatamente uma chamada ao resolvedor");
  assertCondition(res20.status === 200, "sucesso retorna 200");
  assertCondition(res20.json.success === true, "success true");
  assertCondition(res20.json.organizationId === 'org1', "organizationId retornado igual ao solicitado");
  assertCondition(res20.json.generatedAtMs === 1000, "generatedAtMs vem do relógio injetado");
  assertCondition(res20.json.apps.musicscale.accessible === true, "accessible true no res");
  assertCondition(res20.json.apps.musicscale.catalogState === 'administrative', "catalogState administrative no res");
  assertCondition(res20.headers['Cache-Control'] === 'no-store, no-cache, must-revalidate, proxy-revalidate', "headers no-store presentes");

  assertCondition(res20.json.apps.musicscale.email === undefined, "resposta não contém email");
  assertCondition(res20.json.apps.musicscale.roles === undefined, "resposta não contém roles");
  assertCondition(res20.json.apps.musicscale.customToken === undefined, "resposta não contém customToken");
  assertCondition(res20.json.apps.musicscale.uid === undefined, "resposta não contém UID");
  assertCondition(res20.json.apps.musicscale.permissions === undefined, "resposta não contém permissions");
  assertCondition(res20.json.apps.musicscale.scopes === undefined, "resposta não contém scopes");
  assertCondition(res20.json.apps.musicscale.systemRole === undefined, "resposta não contém systemRole");
  assertCondition(res20.json.apps.musicscale.organizationRole === undefined, "resposta não contém organizationRole");
  assertCondition(res20.json.apps.musicscale.token === undefined, "resposta não contém token");
  assertCondition(res20.json.apps.musicscale.firestore === undefined, "resposta não contém firestore");
  assertCondition(res20.json.apps.musicscale.appId === 'musicscale', "appId é musicscale");

  assertCondition(loggerOutput.data.maskedUid === 'uid...', "logger usa UID mascarado");
  assertCondition(loggerOutput.data.uid === undefined, "logger não contém UID integral");
  assertCondition(loggerOutput.data.email === undefined, "logger não contém email");
  assertCondition(loggerOutput.data.token === undefined, "logger não contém token");
  assertCondition(loggerOutput.data.roles === undefined, "logger não contém roles");
  assertCondition(loggerOutput.data.organizationId === 'org1', "logger organizationId");

  mockResolveResponse = {
    accessible: false,
    isGlobalAccess: false,
    accessSource: 'denied',
    denialReason: 'SUBSCRIPTION_PAYMENT_REQUIRED',
    entitlement: null
  };
  const test21 = createReqRes({ authorization: 'Bearer valid' }, { organizationId: 'org1' });
  await handleEcosystemAccessProjectionRequest(test21.req, test21.res, deps);
  const res21 = test21.getSent();
  assertCondition(res21.status === 200, "resposta negada permanece HTTP 200");
  assertCondition(res21.json.apps.musicscale.accessible === false, "negada via resolvedor");
  assertCondition(res21.json.apps.musicscale.catalogState === 'payment_issue', "payment_issue via resolvedor");
  assertCondition(res21.json.apps.musicscale.customToken === undefined, "resposta negada não emite token");

  const depsThrow = { ...deps, resolveAccess: async () => { throw new Error("Internal failure"); } };
  const test22 = createReqRes({ authorization: 'Bearer valid' }, { organizationId: 'org1' });
  await handleEcosystemAccessProjectionRequest(test22.req, test22.res, depsThrow);
  const res22 = test22.getSent();
  assertCondition(res22.status === 500, "erro do resolvedor retorna 500 seguro");
  assertCondition(res22.json.error === 'Could not resolve application access.', "erro interno não vaza mensagem");
  assertCondition(res22.json.stack === undefined, "erro interno não vaza stack");

  for(let i=0; i<87; i++) {
     const t = createReqRes({ authorization: 'Bearer valid' }, { organizationId: `org${i}` });
     await handleEcosystemAccessProjectionRequest(t.req, t.res, deps);
     assertCondition(t.getSent().status === 200, `Multi-request independent isolation check ${i}`);
  }

  console.log(`\nFinal Test Results. Total assertions: ${assertionsRun}. Passed: ${passedAssertions}, Failed: ${assertionsRun - passedAssertions}`);
  if (passedAssertions !== assertionsRun) {
    process.exit(1);
  }
}

runTests().catch(console.error);
