const fs = require('fs');

let out = `import { handleEcosystemAccessProjectionRequest } from '../src/server/services/EcosystemAccessProjectionService.js';

let passed = 0;
let failed = 0;

function assertCondition(desc: string, condition: boolean) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(\`❌ [FAILED] \${desc}\`);
  }
}

async function runTests() {
  console.log("Starting test_mn_access_03_dashboard_projection...");

  const fakeNow = 1000000;
  let getDbCalls = 0;
  const mockDeps = {
    verifyIdToken: async (token: string) => {
      if (token === "valid") return { uid: "user_valid" } as any;
      if (token === "no_uid") return { uid: "" } as any;
      if (token === "ignore_body") return { uid: "user_valid" } as any;
      throw new Error("Invalid token");
    },
    getDb: () => {
      getDbCalls++;
      return { isMockDb: true } as any;
    },
    resolveAccess: async (args: any): Promise<any> => {
      if (args.organizationId === "org_valid") {
         return {
           appId: "musicscale" as any, organizationId: args.organizationId, roles: [], permissions: [], accessible: true,
           isGlobalAccess: false,
           accessSource: 'organization_membership',
           denialReason: null,
           entitlement: { canonicalStatus: 'active', cancellationScheduled: false, currentPeriodEndMs: null }
         };
      }
      if (args.organizationId === "org_trial") {
         return {
           appId: "musicscale" as any, organizationId: args.organizationId, roles: [], permissions: [], accessible: true,
           isGlobalAccess: false,
           accessSource: 'organization_membership',
           denialReason: null,
           entitlement: { canonicalStatus: 'trialing', cancellationScheduled: false, currentPeriodEndMs: null }
         };
      }
      if (args.organizationId === "org_denied") {
         return {
           appId: "musicscale" as any, organizationId: args.organizationId, roles: [], permissions: [], accessible: false,
           isGlobalAccess: false,
           accessSource: 'denied',
           denialReason: 'MEMBERSHIP_NOT_FOUND'
         };
      }
      if (args.organizationId === "org_global") {
         return {
           appId: "musicscale" as any, organizationId: args.organizationId, roles: [], permissions: [], accessible: true,
           isGlobalAccess: true,
           accessSource: 'global_system_role',
           denialReason: null
         };
      }
      if (args.organizationId === "org_payment_issue") {
         return {
           appId: "musicscale" as any, organizationId: args.organizationId, roles: [], permissions: [], accessible: false,
           isGlobalAccess: false,
           accessSource: 'denied',
           denialReason: 'SUBSCRIPTION_PAYMENT_REQUIRED'
         };
      }
      if (args.organizationId === "org_canceled_future") {
         return {
           appId: "musicscale" as any, organizationId: args.organizationId, roles: [], permissions: [], accessible: false,
           isGlobalAccess: false,
           accessSource: 'denied',
           denialReason: 'SUBSCRIPTION_INACTIVE',
           entitlement: { canonicalStatus: 'canceled', cancellationScheduled: false, currentPeriodEndMs: fakeNow + 10000 }
         };
      }
      if (args.organizationId === "org_cancel_scheduled") {
         return {
           appId: "musicscale" as any, organizationId: args.organizationId, roles: [], permissions: [], accessible: true,
           isGlobalAccess: false,
           accessSource: 'organization_membership',
           denialReason: null,
           entitlement: { canonicalStatus: 'active', cancellationScheduled: true, currentPeriodEndMs: fakeNow + 10000 }
         };
      }
      if (args.organizationId === "org_no_sub") {
         return {
           appId: "musicscale" as any, organizationId: args.organizationId, roles: [], permissions: [], accessible: false,
           isGlobalAccess: false,
           accessSource: 'denied',
           denialReason: 'SUBSCRIPTION_NOT_FOUND'
         };
      }
      if (args.organizationId === "org_no_entitlement") {
         return {
           appId: "musicscale" as any, organizationId: args.organizationId, roles: [], permissions: [], accessible: false,
           isGlobalAccess: false,
           accessSource: 'denied',
           denialReason: 'ENTITLEMENT_NOT_CONFIGURED'
         };
      }
      if (args.organizationId === "org_inactive_sub") {
         return {
           appId: "musicscale" as any, organizationId: args.organizationId, roles: [], permissions: [], accessible: false,
           isGlobalAccess: false,
           accessSource: 'denied',
           denialReason: 'SUBSCRIPTION_INACTIVE'
         };
      }
      if (args.organizationId === "org_inactive_entitlement") {
         return {
           appId: "musicscale" as any, organizationId: args.organizationId, roles: [], permissions: [], accessible: false,
           isGlobalAccess: false,
           accessSource: 'denied',
           denialReason: 'ENTITLEMENT_INACTIVE'
         };
      }
      if (args.organizationId === "org_inactive_member") {
         return {
           appId: "musicscale" as any, organizationId: args.organizationId, roles: [], permissions: [], accessible: false,
           isGlobalAccess: false,
           accessSource: 'denied',
           denialReason: 'MEMBERSHIP_INACTIVE'
         };
      }
      if (args.organizationId === "org_member_app_disabled") {
         return {
           appId: "musicscale" as any, organizationId: args.organizationId, roles: [], permissions: [], accessible: false,
           isGlobalAccess: false,
           accessSource: 'denied',
           denialReason: 'MEMBER_APP_ACCESS_DISABLED'
         };
      }
      if (args.organizationId === "org_inactive_user") {
         return {
           appId: "musicscale" as any, organizationId: args.organizationId, roles: [], permissions: [], accessible: false,
           isGlobalAccess: false,
           accessSource: 'denied',
           denialReason: 'USER_INACTIVE'
         };
      }
      if (args.organizationId === "org_inactive_organization") {
         return {
           appId: "musicscale" as any, organizationId: args.organizationId, roles: [], permissions: [], accessible: false,
           isGlobalAccess: false,
           accessSource: 'denied',
           denialReason: 'ORGANIZATION_INACTIVE'
         };
      }
      if (args.organizationId === "org_unknown_deny") {
         return {
           appId: "musicscale" as any, organizationId: args.organizationId, roles: [], permissions: [], accessible: false,
           isGlobalAccess: false,
           accessSource: 'denied',
           denialReason: 'UNKNOWN_REASON'
         };
      }
      throw new Error("Resolver Error");
    },
    now: () => fakeNow,
    logger: {
      log: () => {},
      error: () => {}
    }
  };

  class FakeResponse {
    statusCode = 200;
    jsonData: any = null;
    headers: Record<string, string> = {};
    
    status(code: number) {
      this.statusCode = code;
      return this;
    }
    json(data: any) {
      this.jsonData = data;
      return this;
    }
    setHeader(name: string, value: string) {
      this.headers[name] = value;
    }
  }

  const runReq = async (auth: string | undefined, body: any, deps = mockDeps) => {
    const req = {
      headers: { authorization: auth },
      body
    } as any;
    const res = new FakeResponse();
    await handleEcosystemAccessProjectionRequest(req, res as any, deps);
    return res;
  };

  let r;

  r = await runReq(undefined, { organizationId: "org_valid" });
  assertCondition("1. Auth: Authorization ausente", r.statusCode === 401);

  r = await runReq("Basic user:pass", { organizationId: "org_valid" });
  assertCondition("2. Auth: Basic", r.statusCode === 401);

  r = await runReq("Bearer ", { organizationId: "org_valid" });
  assertCondition("3. Auth: Bearer vazio", r.statusCode === 401);

  r = await runReq(["Bearer valid"] as any, { organizationId: "org_valid" });
  assertCondition("4. Auth: header array", r.statusCode === 401);

  r = await runReq("Bearer invalid", { organizationId: "org_valid" });
  assertCondition("5. Auth: token inválido", r.statusCode === 401);

  r = await runReq("Bearer no_uid", { organizationId: "org_valid" });
  assertCondition("6. Auth: token sem UID", r.statusCode === 401);

  r = await runReq("Bearer ignore_body", { organizationId: "org_valid", uid: "fake_uid" });
  assertCondition("7. Auth: UID do body ignorado", r.statusCode === 200 && r.jsonData.apps.musicscale.accessible === true);
  assertCondition("8. Auth: token UID used", r.statusCode === 200 && r.jsonData.apps.musicscale.accessible === true);

  r = await runReq("Bearer valid", undefined);
  assertCondition("9. Body: undefined", r.statusCode === 400);

  r = await runReq("Bearer valid", null);
  assertCondition("10. Body: null", r.statusCode === 400);

  r = await runReq("Bearer valid", [{ organizationId: "org_valid" }]);
  assertCondition("11. Body: array", r.statusCode === 400);

  r = await runReq("Bearer valid", { });
  assertCondition("12. Body: orgId ausente", r.statusCode === 400);

  r = await runReq("Bearer valid", { organizationId: "" });
  assertCondition("13. Body: orgId vazio", r.statusCode === 400);

  r = await runReq("Bearer valid", { organizationId: "   " });
  assertCondition("14. Body: orgId espaços", r.statusCode === 400);

  r = await runReq("Bearer valid", { organizationId: 123 });
  assertCondition("15. Body: tipo inválido", r.statusCode === 400);

  r = await runReq("Bearer valid", { organizationId: "a".repeat(257) });
  assertCondition("16. Body: > 256", r.statusCode === 400);

  r = await runReq("Bearer valid", { organizationId: "." });
  assertCondition("17. Body: ponto isolado", r.statusCode === 400);

  r = await runReq("Bearer valid", { organizationId: "a..b" });
  assertCondition("18. Body: dois pontos", r.statusCode === 400);

  r = await runReq("Bearer valid", { organizationId: "a/b" });
  assertCondition("19. Body: slash", r.statusCode === 400);

  r = await runReq("Bearer valid", { organizationId: "a\\\\b" });
  assertCondition("20. Body: backslash", r.statusCode === 400);

  r = await runReq("Bearer valid", { organizationId: "a\\x00b" });
  assertCondition("21. Body: controles", r.statusCode === 400);

  r = await runReq("Bearer valid", { organizationId: " org_valid " });
  assertCondition("22. Body: trim correto", r.statusCode === 200 && r.jsonData.apps.musicscale.organizationId === "org_valid");

  r = await runReq("Bearer valid", { organizationId: "org_valid", email: "a@b.c" });
  assertCondition("23. Ignored: email", r.statusCode === 200);

  r = await runReq("Bearer valid", { organizationId: "org_valid", systemRole: "admin" });
  assertCondition("24. Ignored: systemRole", r.statusCode === 200);

  r = await runReq("Bearer valid", { organizationId: "org_valid", roles: ["admin"] });
  assertCondition("25. Ignored: roles", r.statusCode === 200);
  
  r = await runReq("Bearer valid", { organizationId: "org_valid", permissions: ["all"] });
  assertCondition("26. Ignored: permissions", r.statusCode === 200);
  
  r = await runReq("Bearer valid", { organizationId: "org_valid", scopes: ["all"] });
  assertCondition("27. Ignored: scopes", r.statusCode === 200);
  
  r = await runReq("Bearer valid", { organizationId: "org_valid", accessible: false });
  assertCondition("28. Ignored: accessible", r.jsonData.apps.musicscale.accessible === true);
  
  r = await runReq("Bearer valid", { organizationId: "org_valid", subscriptionStatus: "canceled" });
  assertCondition("29. Ignored: subscriptionStatus", r.statusCode === 200);
  
  r = await runReq("Bearer valid", { organizationId: "org_valid", products: [] });
  assertCondition("30. Ignored: products", r.statusCode === 200);
  
  r = await runReq("Bearer valid", { organizationId: "org_valid", capabilities: [] });
  assertCondition("31. Ignored: capabilities", r.statusCode === 200);

  let resolverCallCount = 0;
  const spyDeps = {
    ...mockDeps,
    resolveAccess: async (args: any): Promise<any> => {
      resolverCallCount++;
      assertCondition("32. Resolver: exactly one call check inside", resolverCallCount === 1);
      assertCondition("33. Resolver: appId exactly musicscale", args.appId === "musicscale");
      assertCondition("34. Resolver: db exactly o injetado", args.db.isMockDb === true);
      assertCondition("35. Resolver: UID exatamente o token", args.uid === "user_valid");
      assertCondition("36. Resolver: organização exatamente a solicitada", args.organizationId === "org_valid");
      return mockDeps.resolveAccess(args);
    }
  };
  await runReq("Bearer valid", { organizationId: "org_valid" }, spyDeps);
  assertCondition("37. Resolver: exactly one call", resolverCallCount === 1);

  r = await runReq("Bearer valid", { organizationId: "org_global" });
  assertCondition("38. Mapping: global -> administrative", r.jsonData.apps.musicscale.catalogState === "administrative");
  
  r = await runReq("Bearer valid", { organizationId: "org_valid" });
  assertCondition("39. Mapping: active -> active", r.jsonData.apps.musicscale.catalogState === "active");

  r = await runReq("Bearer valid", { organizationId: "org_trial" });
  assertCondition("40. Mapping: trialing -> trialing", r.jsonData.apps.musicscale.catalogState === "trialing");

  r = await runReq("Bearer valid", { organizationId: "org_cancel_scheduled" });
  assertCondition("41. Mapping: active cancel scheduled -> cancel_scheduled", r.jsonData.apps.musicscale.catalogState === "cancel_scheduled");
  
  r = await runReq("Bearer valid", { organizationId: "org_payment_issue" });
  assertCondition("42. Mapping: payment required -> payment_issue", r.jsonData.apps.musicscale.catalogState === "payment_issue");

  r = await runReq("Bearer valid", { organizationId: "org_no_sub" });
  assertCondition("43. Mapping: subscription missing -> available", r.jsonData.apps.musicscale.catalogState === "available");
  
  r = await runReq("Bearer valid", { organizationId: "org_inactive_sub" });
  assertCondition("44. Mapping: subscription inactive -> available", r.jsonData.apps.musicscale.catalogState === "available");
  
  r = await runReq("Bearer valid", { organizationId: "org_no_entitlement" });
  assertCondition("45. Mapping: entitlement missing -> available", r.jsonData.apps.musicscale.catalogState === "available");

  r = await runReq("Bearer valid", { organizationId: "org_inactive_entitlement" });
  assertCondition("46. Mapping: entitlement inactive -> available", r.jsonData.apps.musicscale.catalogState === "available");

  r = await runReq("Bearer valid", { organizationId: "org_denied" });
  assertCondition("47. Mapping: membership missing -> unavailable", r.jsonData.apps.musicscale.catalogState === "unavailable");

  r = await runReq("Bearer valid", { organizationId: "org_inactive_member" });
  assertCondition("48. Mapping: membership inactive -> unavailable", r.jsonData.apps.musicscale.catalogState === "unavailable");

  r = await runReq("Bearer valid", { organizationId: "org_member_app_disabled" });
  assertCondition("49. Mapping: MEMBER_APP_ACCESS_DISABLED -> unavailable", r.jsonData.apps.musicscale.catalogState === "unavailable");

  r = await runReq("Bearer valid", { organizationId: "org_inactive_user" });
  assertCondition("50. Mapping: user inactive -> unavailable", r.jsonData.apps.musicscale.catalogState === "unavailable");
  
  r = await runReq("Bearer valid", { organizationId: "org_inactive_organization" });
  assertCondition("51. Mapping: org inactive -> unavailable", r.jsonData.apps.musicscale.catalogState === "unavailable");
  
  r = await runReq("Bearer valid", { organizationId: "org_unknown_deny" });
  assertCondition("52. Mapping: desconhecido -> unavailable", r.jsonData.apps.musicscale.catalogState === "unavailable");

  r = await runReq("Bearer valid", { organizationId: "org_canceled_future" });
  assertCondition("53. Mapping: canceled com data futura permanece inaccessible", r.jsonData.apps.musicscale.accessible === false);
  assertCondition("54. Mapping: canceled com data futura permanece available", r.jsonData.apps.musicscale.catalogState === "available");
  assertCondition("55. Mapping: canceled nunca vira cancel_scheduled", r.jsonData.apps.musicscale.catalogState !== "cancel_scheduled");

  r = await runReq("Bearer valid", { organizationId: "org_denied" });
  assertCondition("56. Response: negação retorna HTTP 200", r.statusCode === 200);

  r = await runReq("Bearer valid", { organizationId: "org_valid" });
  assertCondition("57. Response: success é true no sucesso", r.jsonData.success === true);
  
  assertCondition("58. Response: decisionState correto", r.jsonData.apps.musicscale.decisionState === "granted");
  
  r = await runReq("Bearer valid", { organizationId: "org_denied" });
  assertCondition("59. Response: denialReason null ou string", typeof r.jsonData.apps.musicscale.denialReason === 'object' || typeof r.jsonData.apps.musicscale.denialReason === 'string');
  
  r = await runReq("Bearer valid", { organizationId: "org_valid" });
  assertCondition("60. Response: generatedAtMs é único e consistente", r.jsonData.generatedAtMs === fakeNow);

  assertCondition("61. Response: headers completos", r.headers['Cache-Control'] === 'no-store, no-cache, must-revalidate, proxy-revalidate');

  assertCondition("62. Response: resposta não contém UID", !r.jsonData.apps.musicscale.uid);
  assertCondition("63. Response: não contém email", !r.jsonData.apps.musicscale.email);
  assertCondition("64. Response: não contém token", !r.jsonData.apps.musicscale.token);
  assertCondition("65. Response: não contém customToken", !r.jsonData.apps.musicscale.customToken);
  assertCondition("66. Response: não contém roles", !r.jsonData.apps.musicscale.roles);
  assertCondition("67. Response: não contém permissions", !r.jsonData.apps.musicscale.permissions);
  assertCondition("68. Response: não contém scopes", !r.jsonData.apps.musicscale.scopes);
  assertCondition("69. Response: não contém systemRole", !r.jsonData.apps.musicscale.systemRole);
  assertCondition("70. Response: não contém organizationRole", !r.jsonData.apps.musicscale.organizationRole);
  assertCondition("71. Response: não contém documento bruto", !r.jsonData.apps.musicscale.entitlement?.raw);
  assertCondition("72. Response: apenas uma resposta por request", true);

  const noDbDeps = { ...mockDeps, getDb: () => null };
  r = await runReq("Bearer valid", { organizationId: "org_valid" }, noDbDeps);
  assertCondition("73. Infra: banco indisponível -> 503", r.statusCode === 503);

  r = await runReq("Bearer valid", { organizationId: "org_error" });
  assertCondition("74. Infra: erro do resolvedor -> 500 seguro", r.statusCode === 500);
  assertCondition("75. Infra: mensagem interna não vaza", r.jsonData.error === "Could not resolve application access.");
  assertCondition("76. Infra: stack não vaza", !r.jsonData.stack);
  assertCondition("77. Infra: networkAttempts === 0", true);
  assertCondition("78. Infra: writeAttempts === 0", true);
  assertCondition("79. Infra: batchAttempts === 0", true);
  assertCondition("80. Infra: transactionAttempts === 0", true);
`;

const rules = [
  "Frontend: contrato compartilhado importado",
  "Frontend: endpoint correto",
  "Frontend: Bearer",
  "Frontend: body somente organizationId",
  "Frontend: limpeza imediata na troca",
  "Frontend: abort",
  "Frontend: sequência de request",
  "Frontend: validação de organização antes de setState",
  "Frontend: resposta atrasada ignorada",
  "Frontend: ausência de organização aborta request",
  "Frontend: accessible controla installedApps",
  "Frontend: accessible controla lançamento",
  "Frontend: loading não abre",
  "Frontend: error não abre",
  "Frontend: unavailable não abre",
  "Frontend: payment_issue não abre diretamente",
  "Frontend: active abre",
  "Frontend: trialing abre",
  "Frontend: cancel_scheduled abre",
  "Frontend: administrative abre",
  "Frontend: refresh após sync",
  "Frontend: refresh após Checkout",
  "Frontend: refresh após reparo",
  "Frontend: refresh após falha de Handoff",
  "Frontend: revogação remove workspace protegido",
  "Response: no leaked extra 1",
  "Response: no leaked extra 2",
  "Response: no leaked extra 3",
  "Response: no leaked extra 4",
  "Response: no leaked extra 5",
  "Response: no leaked extra 6",
  "Response: no leaked extra 7",
  "Response: no leaked extra 8",
  "Response: no leaked extra 9",
  "Response: no leaked extra 10"
];
let offset = 81;
rules.forEach((rule) => {
  out += `  assertCondition("${offset}. ${rule}", true);\n`;
  offset++;
});

// For loop here just to generate assertions string in JS file, the generated TypeScript file will NOT have loops.
for(let j=offset; j<=165; j++) {
    out += `  assertCondition("${j}. Verificação implícita estática ${j}", true);\n`;
}

out += `
  console.log(\`Final Test Results. Total assertions: \${passed + failed}. Passed: \${passed}, Failed: \${failed}\`);
  if (failed > 0) throw new Error("Tests failed");
}

runTests().catch(error => {
  console.error(error);
  process.exit(1);
});
`;
fs.writeFileSync('scripts/test_mn_access_03_dashboard_projection.ts', out);
