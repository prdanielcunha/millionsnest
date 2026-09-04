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

  // A. test2.ts não existe
  const test2Path = path.join(process.cwd(), 'test2.ts');
  assert(!fs.existsSync(test2Path), "test2.ts file does not exist");

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

  const orgCreateRegex = /match \/organizations\/\{orgId\} \{[\s\S]*?allow create: if isAuthenticated\(\) && isSystemAdmin\(\);/;
  assert(orgCreateRegex.test(rulesCode), "Organizations create rule requires system admin");

  // B, C
  const orgMatchRegex = /match \/organizations\/\{orgId\} \{([\s\S]*?)allow delete:/;
  const orgMatch = rulesCode.match(orgMatchRegex);
  if (orgMatch) {
    const orgRules = orgMatch[1];
    
    // B. contém allow read
    assert(orgRules.includes('allow read:'), "organizations/{orgId} contains allow read");
    
    // C. não contém fallback orgId == request.auth.uid (sem justificativa explícita)
    const readMatch = orgRules.match(/allow read:([^;]*);/);
    if (readMatch) {
      const readRule = readMatch[1];
      assert(!readRule.includes('orgId == request.auth.uid'), "organizations allow read does not have fallback orgId == request.auth.uid");
    } else {
      assert(false, "Could not extract allow read rule for organizations");
    }
  } else {
    assert(false, "match /organizations/{orgId} not found");
  }

  // D, E. match /invites/{inviteId}
  const invitesMatchRegex = /match \/invites\/\{inviteId\} \{([\s\S]*?)\}/;
  const invitesMatch = rulesCode.match(invitesMatchRegex);
  if (invitesMatch) {
    const invitesRule = invitesMatch[1];
    assert(!invitesRule.includes('allow read: if isAuthenticated();'), "invites does not allow broad read");
    assert(!invitesRule.includes('allow list: if isAuthenticated();'), "invites does not allow broad list");
    assert(invitesRule.includes('allow read, list: if isAuthenticated() && (') && (invitesRule.includes('checkOrgAccess(orgId)') || invitesRule.includes('isSystemAdmin()')), "invites requires checkOrgAccess or isSystemAdmin for read/list");
  } else {
    assert(false, "match /invites/{inviteId} not found in organizations");
  }

  // 4. Anonymous analytics diagnostics must never poison a valid public sales batch.
  const analyticsCode = fs.readFileSync(path.join(process.cwd(), 'src/lib/analytics.ts'), 'utf8');
  assert(
    analyticsCode.includes("'trial_cta_clicked'") && !analyticsCode.includes('| string;'),
    "analytics event types are explicit and include trial_cta_clicked"
  );
  assert(
    analyticsCode.includes('private isAllowedAnonymousRootEvent(event: AnalyticsEvent): boolean'),
    "analytics collector validates anonymous root events before batching"
  );
  assert(
    analyticsCode.includes('hasAuthenticatedAttribution || this.isAllowedAnonymousRootEvent(event)'),
    "analytics collector drops unattributed non-public root events before Firestore batching"
  );

  console.log(`\nTests completed: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
