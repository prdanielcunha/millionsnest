import fs from 'fs';
import path from 'path';

function runTests() {
  console.log("Starting hygiene tests for MusicScale entitlement...");
  
  const serverPath = path.join(process.cwd(), 'server.ts');
  const serverCode = fs.readFileSync(serverPath, 'utf8');
  
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      failed++;
    }
  }

  // A. server.ts não cria subscriptionStatus: 'active' na rota /api/admin/users/:uid/create-organization.
  const createOrgRouteMatch = serverCode.match(/app\.post\('\/api\/admin\/users\/:uid\/create-organization'[\s\S]*?batch\.set\(orgRef[\s\S]*?\}\);/);
  
  if (createOrgRouteMatch) {
    const orgPayload = createOrgRouteMatch[0];
    
    assert(!orgPayload.includes("subscriptionStatus: 'active'"), "Não cria subscriptionStatus: 'active' na rota de criação de organização manual");
    assert(orgPayload.includes("subscriptionStatus: 'inactive'"), "Cria subscriptionStatus: 'inactive' na rota de criação manual");

    // B. server.ts não cria apps.musicscale.access: true
    assert(!orgPayload.includes("access: true"), "Não cria apps.musicscale.access: true na rota manual");
    assert(orgPayload.includes("access: false"), "Cria apps.musicscale.access: false na rota manual");
    
    // C. server.ts cria ou preserva apps.musicscale.status como inactive/ausente
    assert(orgPayload.includes("status: 'inactive'"), "Cria apps.musicscale.status como 'inactive' na rota manual");
  } else {
    assert(false, "Não foi possível encontrar o payload de batch.set(orgRef) na rota create-organization");
  }

  // D & E. upsertEcosystemSubscription continues writing canonical values
  const upsertMatch = serverCode.match(/export async function upsertEcosystemSubscription[\s\S]*?batch\.set\(subRef[\s\S]*?\}\);/);
  if (upsertMatch) {
    const upsertCode = upsertMatch[0];
    assert(upsertCode.includes("status: subscription.status"), "upsertEcosystemSubscription writes subscriptions.status");
    assert(upsertCode.includes("plan: resolvedPlan"), "upsertEcosystemSubscription writes subscriptions.plan");
    assert(upsertCode.includes("currentPeriodEnd: currentPeriodEnd"), "upsertEcosystemSubscription writes subscriptions.currentPeriodEnd");
  } else {
    assert(false, "upsertEcosystemSubscription not found or modified unexpectedly");
  }

  // Check diagnostic endpoint
  const diagEndpointStartIndex = serverCode.indexOf("app.get('/api/admin/billing/musicscale-entitlement-diagnostics'");
  if (diagEndpointStartIndex !== -1) {
    const diagCode = serverCode.substring(diagEndpointStartIndex, diagEndpointStartIndex + 4000);
    
    // F. list organizations.subscriptionStatus as ignored legacy
    assert(diagCode.includes("ignoredLegacySources"), "Endpoint contains ignoredLegacySources");
    assert(diagCode.includes("'organizations.subscriptionStatus':"), "Endpoint lists organizations.subscriptionStatus as ignored");

    // G & H. systemRole checks
    assert(!diagCode.includes("organizationRole"), "Endpoint doesn't check organizational role");
    assert(diagCode.includes("['ceo', 'global_admin', 'ecosystem_owner', 'founder'].includes(userData.systemRole)"), "Endpoint only allows specific system roles");
  } else {
    assert(false, "Diagnostic endpoint not found");
  }

  console.log(`\nTests completed: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
