import fs from 'fs';
import path from 'path';

function runTests() {
  console.log("Starting security governance P0 tests...");
  
  const serverPath = path.join(process.cwd(), 'server.ts');
  const serverCode = fs.readFileSync(serverPath, 'utf8');
  
  const rulesPath = path.join(process.cwd(), 'firestore.rules');
  const rulesCode = fs.readFileSync(rulesPath, 'utf8');

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

  // 1. /api/admin/debug-final-check requirements
  const debugFinalCheckIndex = serverCode.indexOf("app.get('/api/admin/debug-final-check'");
  if (debugFinalCheckIndex !== -1) {
    const code = serverCode.substring(debugFinalCheckIndex, debugFinalCheckIndex + 2000);
    assert(code.includes('headers.authorization'), "debug-final-check uses Authorization Bearer");
    assert(code.includes('verifyIdToken(token)'), "debug-final-check verifies ID Token");
    assert(code.includes("['ceo', 'global_admin', 'ecosystem_owner', 'founder'].includes("), "debug-final-check restricts to canonical global roles");
    assert(code.includes("audit_logs').add"), "debug-final-check adds audit log");
    assert(!code.includes('userData,'), "debug-final-check does not return full userData");
  } else {
    assert(false, "debug-final-check endpoint not found");
  }

  // 2. /api/debug/subscription-status requirements
  const subStatusIndex = serverCode.indexOf("app.get('/api/debug/subscription-status'");
  if (subStatusIndex !== -1) {
    const code = serverCode.substring(subStatusIndex, subStatusIndex + 8000);
    assert(code.includes('headers.authorization'), "subscription-status uses Authorization Bearer");
    assert(code.includes('verifyIdToken(token)'), "subscription-status verifies ID Token");
    assert(code.includes("['ceo', 'global_admin', 'ecosystem_owner', 'founder'].includes("), "subscription-status restricts to canonical global roles");
    assert(code.includes("audit_logs').add"), "subscription-status adds audit log");
    assert(!code.includes('stripe: {'), "subscription-status does not return full stripe data");
    assert(!code.includes('firestore: {'), "subscription-status does not return full firestore data");
  } else {
    assert(false, "subscription-status endpoint not found");
  }

  // 3. firestore.rules
  const isOrgActiveRegex = /function isOrgActive\(orgId\) \{[\s\S]*?\}/;
  const isOrgActiveMatch = rulesCode.match(isOrgActiveRegex);
  if (isOrgActiveMatch) {
    const code = isOrgActiveMatch[0];
    assert(!code.includes('subscription_status'), "isOrgActive does not accept legacy subscription_status");
    assert(!code.includes('subscriptionStatus'), "isOrgActive does not accept legacy subscriptionStatus");
    assert(!code.includes('userActive'), "isOrgActive does not rely on userActive");
  } else {
    assert(false, "isOrgActive function not found in firestore.rules");
  }

  const hasPermissionRegex = /function hasPermission\(orgId, permission\) \{[\s\S]*?\}/;
  const hasPermissionMatch = rulesCode.match(hasPermissionRegex);
  if (hasPermissionMatch) {
    const code = hasPermissionMatch[0];
    assert(!code.includes("role == 'member'"), "hasPermission does not fallback to member role");
  } else {
    assert(false, "hasPermission function not found in firestore.rules");
  }

  const orgCreateRegex = /match \/organizations\/\{orgId\} \{\s*allow create: if isAuthenticated\(\) && isSystemAdmin\(\);/;
  assert(orgCreateRegex.test(rulesCode), "Organizations create rule requires system admin");

  const invitesMatchRegex = /match \/invitations\/\{inviteId\} \{\s*allow read: if isAuthenticated\(\) && \('organizationId' in resource\.data && checkOrgAccess\(resource\.data\.organizationId\)\);/;
  assert(invitesMatchRegex.test(rulesCode), "Invitations read rule requires org access");

  console.log(`\nTests completed: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
