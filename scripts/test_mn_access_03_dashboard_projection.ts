import { handleEcosystemAccessProjectionRequest, EcosystemAccessProjectionDependencies } from '../src/server/services/EcosystemAccessProjectionService.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string, res?: any) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`❌ [FAILED] ${message}`);
    if (res && res.jsonData) console.error("Response:", JSON.stringify(res.jsonData, null, 2));
    throw new Error(`Assertion failed: ${message}`);
  }
}

class FakeRequest {
  headers: Record<string, string | undefined> = {};
  body: any = null;

  constructor(authHeader: string | undefined, body: any) {
    this.headers['authorization'] = authHeader;
    this.body = body;
  }
}

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

class FakeDependencies implements EcosystemAccessProjectionDependencies {
  public mockResolveAccess: (args: any) => Promise<any>;
  public mockVerifyIdToken: (token: string) => Promise<any>;

  constructor() {
    this.mockResolveAccess = async () => ({});
    this.mockVerifyIdToken = async (token) => {
      if (token === "valid_token") return { uid: "test_uid" };
      throw new Error("Invalid token");
    };
  }

  async verifyIdToken(token: string) {
    return this.mockVerifyIdToken(token);
  }

  getDb(): any {
    return { isMockDb: true };
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

async function runTest(desc: string, req: FakeRequest, deps: FakeDependencies, expectedStatus: number, validateFn?: (res: FakeResponse) => void) {
  const res = new FakeResponse();
  await handleEcosystemAccessProjectionRequest(req as any, res as any, deps);
  
  if (res.statusCode !== expectedStatus) {
    console.error(`❌ [FAILED] ${desc} (Expected status ${expectedStatus}, got ${res.statusCode})`);
    console.error("Response:", JSON.stringify(res.jsonData, null, 2));
    failed++;
  } else {
    passed++;
  }
  
  if (res.statusCode === expectedStatus && validateFn) {
    try {
      validateFn(res);
    } catch (err: any) {
      console.error(`Error in ${desc}:`, err);
      console.log("Response:", JSON.stringify(res.jsonData, null, 2));
    }
  }
}

async function runTests() {
  console.log("Starting test_mn_access_03_dashboard_projection...");

  const baseDeps = new FakeDependencies();

  // Test 1: Missing auth header
  await runTest("Auth: missing header", new FakeRequest(undefined, { organizationId: "org1" }), baseDeps, 401);

  // Test 2: Invalid token
  await runTest("Auth: invalid token", new FakeRequest("Bearer invalid", { organizationId: "org1" }), baseDeps, 401);

  // Test 3: Body validation - no body
  await runTest("Body: missing", new FakeRequest("Bearer valid_token", null), baseDeps, 400);

  // Test 4: Body validation - empty org
  await runTest("Body: empty org", new FakeRequest("Bearer valid_token", { organizationId: "" }), baseDeps, 400);

  // Test 5: Body validation - invalid org string
  await runTest("Body: invalid org chars", new FakeRequest("Bearer valid_token", { organizationId: "org..test" }), baseDeps, 400);

  // Tests 6-14: The 9 variations of mapCanonicalDecisionToCatalogState

  // Variation 1: Active
  let deps = new FakeDependencies();
  deps.mockResolveAccess = async () => ({
    appId: "musicscale", accessible: true, isGlobalAccess: false, denialReason: null, accessSource: "organization_membership",
    entitlement: { canonicalStatus: "active", cancellationScheduled: false, currentPeriodEndMs: null }
  });
  await runTest("State: Active", new FakeRequest("Bearer valid_token", { organizationId: "org1" }), deps, 200, (res) => {
    assert(res.jsonData.apps.musicscale.catalogState === "active", "Expected catalogState active");
    assert(res.jsonData.apps.musicscale.accessible === true, "Expected accessible true");
  });

  // Variation 2: Trialing
  deps = new FakeDependencies();
  deps.mockResolveAccess = async () => ({
    appId: "musicscale", accessible: true, isGlobalAccess: false, denialReason: null, accessSource: "organization_membership",
    entitlement: { canonicalStatus: "trialing", cancellationScheduled: false, currentPeriodEndMs: null }
  });
  await runTest("State: Trialing", new FakeRequest("Bearer valid_token", { organizationId: "org1" }), deps, 200, (res) => {
    assert(res.jsonData.apps.musicscale.catalogState === "trialing", "Expected catalogState trialing");
  });

  // Variation 3: Cancel Scheduled
  deps = new FakeDependencies();
  deps.mockResolveAccess = async () => ({
    appId: "musicscale", accessible: true, isGlobalAccess: false, denialReason: null, accessSource: "organization_membership",
    entitlement: { canonicalStatus: "active", cancellationScheduled: true, currentPeriodEndMs: null }
  });
  await runTest("State: Cancel Scheduled", new FakeRequest("Bearer valid_token", { organizationId: "org1" }), deps, 200, (res) => {
    assert(res.jsonData.apps.musicscale.catalogState === "cancel_scheduled", "Expected catalogState cancel_scheduled");
  });

  // Variation 4: Administrative
  deps = new FakeDependencies();
  deps.mockResolveAccess = async () => ({
    appId: "musicscale", accessible: true, isGlobalAccess: true, denialReason: null, accessSource: "global_system_role"
  });
  await runTest("State: Administrative", new FakeRequest("Bearer valid_token", { organizationId: "org1" }), deps, 200, (res) => {
    assert(res.jsonData.apps.musicscale.catalogState === "administrative", "Expected catalogState administrative");
  });

  // Variation 5: Active (No entitlement but accessible)
  deps = new FakeDependencies();
  deps.mockResolveAccess = async () => ({
    appId: "musicscale", accessible: true, isGlobalAccess: false, denialReason: null, accessSource: "organization_membership", entitlement: null
  });
  await runTest("State: Active (no ent)", new FakeRequest("Bearer valid_token", { organizationId: "org1" }), deps, 200, (res) => {
    assert(res.jsonData.apps.musicscale.catalogState === "active", "Expected catalogState active");
  });

  // Variation 6: Available (No sub logic)
  deps = new FakeDependencies();
  deps.mockResolveAccess = async () => ({
    appId: "musicscale", accessible: false, isGlobalAccess: false, denialReason: "SUBSCRIPTION_NOT_FOUND", accessSource: "denied"
  });
  await runTest("State: Available (denied sub not found)", new FakeRequest("Bearer valid_token", { organizationId: "org1" }), deps, 200, (res) => {
    assert(res.jsonData.apps.musicscale.catalogState === "available", "Expected catalogState available", res);
    assert(res.jsonData.apps.musicscale.accessible === false, "Expected accessible false", res);
  });

  // Variation 7: Payment Issue
  deps = new FakeDependencies();
  deps.mockResolveAccess = async () => ({
    appId: "musicscale", accessible: false, isGlobalAccess: false, denialReason: "SUBSCRIPTION_PAYMENT_REQUIRED", accessSource: "denied"
  });
  await runTest("State: Payment Issue", new FakeRequest("Bearer valid_token", { organizationId: "org1" }), deps, 200, (res) => {
    assert(res.jsonData.apps.musicscale.catalogState === "payment_issue", "Expected catalogState payment_issue");
  });

  // Variation 8: Unavailable (Membership not found)
  deps = new FakeDependencies();
  deps.mockResolveAccess = async () => ({
    appId: "musicscale", accessible: false, isGlobalAccess: false, denialReason: "MEMBERSHIP_NOT_FOUND", accessSource: "denied"
  });
  await runTest("State: Unavailable", new FakeRequest("Bearer valid_token", { organizationId: "org1" }), deps, 200, (res) => {
    assert(res.jsonData.apps.musicscale.catalogState === "unavailable", "Expected catalogState unavailable");
  });

  // Variation 9: Error simulation
  deps = new FakeDependencies();
  deps.mockResolveAccess = async () => { throw new Error("DB Failure"); };
  await runTest("State: Error (Resolver failed)", new FakeRequest("Bearer valid_token", { organizationId: "org1" }), deps, 500, (res) => {
    assert(res.jsonData.code === "ACCESS_PROJECTION_FAILED", "Expected ACCESS_PROJECTION_FAILED code");
  });

  // Contract verification
  deps = new FakeDependencies();
  deps.mockResolveAccess = async () => ({
    appId: "musicscale", accessible: true, isGlobalAccess: false, denialReason: null, accessSource: "organization_membership"
  });
  await runTest("Contract: Valid projection payload", new FakeRequest("Bearer valid_token", { organizationId: "org_test" }), deps, 200, (res) => {
    assert(res.jsonData.success === true, "Expected success: true");
    assert(res.jsonData.organizationId === "org_test", "Expected organizationId: org_test");
    assert(res.jsonData.generatedAtMs === 1234567890, "Expected generatedAtMs");
    assert(res.jsonData.apps.musicscale.decisionState === "granted", "Expected decisionState granted");
  });

  console.log(`Final Test Results. Total assertions: ${passed + failed}. Passed: ${passed}, Failed: ${failed}`);
  if (failed > 0) throw new Error("Tests failed");
}

runTests().catch(error => {
  console.error(error);
  process.exit(1);
});

