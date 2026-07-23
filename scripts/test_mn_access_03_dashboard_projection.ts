import assert from 'node:assert/strict';

let assertionCount = 0;
function check<T>(actual: T, expected: T, message?: string) {
  assertionCount++;
  assert.strictEqual(actual, expected, message);
}

import { handleEcosystemAccessProjectionRequest } from '../src/server/services/EcosystemAccessProjectionService.js';
import fs from 'fs';
import path from 'path';
import http from 'node:http';
import https from 'node:https';

// State counters
let fetchAttempts = 0;
let httpRequestAttempts = 0;
let httpsRequestAttempts = 0;
let writeAttempts = 0;
let batchAttempts = 0;
let transactionAttempts = 0;

// Intercept network calls
const originalFetch = globalThis.fetch;
globalThis.fetch = async (...args) => {
  fetchAttempts++;
  throw new Error("Network blocked");
};

const originalHttpRequest = http.request;
(http as any).request = (...args: any[]) => {
  httpRequestAttempts++;
  throw new Error("HTTP blocked");
};

const originalHttpsRequest = https.request;
(https as any).request = (...args: any[]) => {
  httpsRequestAttempts++;
  throw new Error("HTTPS blocked");
};

// Mock Firestore
const fakeDb = {
  collection: () => fakeDb,
  doc: () => fakeDb,
  set: async () => { writeAttempts++; throw new Error("Write blocked"); },
  update: async () => { writeAttempts++; throw new Error("Write blocked"); },
  create: async () => { writeAttempts++; throw new Error("Write blocked"); },
  delete: async () => { writeAttempts++; throw new Error("Write blocked"); },
  add: async () => { writeAttempts++; throw new Error("Write blocked"); },
  batch: () => { batchAttempts++; throw new Error("Batch blocked"); },
  runTransaction: async () => { transactionAttempts++; throw new Error("Transaction blocked"); },
  bulkWriter: () => { writeAttempts++; throw new Error("BulkWriter blocked"); }
};

class FakeRequest {
  public headers: Record<string, string | string[] | undefined> = {};
  public body: any;

  constructor(authorization?: string | string[] | undefined, body?: any) {
    if (authorization !== undefined) {
      this.headers.authorization = authorization;
    }
    this.body = body;
  }
}

class FakeResponse {
  public statusCalls = 0;
  public jsonCalls = 0;
  public sendCalls = 0;
  public endCalls = 0;
  public totalResponseCount = 0;
  public _status = 200;
  public _body: any;
  public _headers: Record<string, string> = {};

  status(code: number) {
    this.statusCalls++;
    this._status = code;
    return this;
  }

  json(data: any) {
    this.jsonCalls++;
    this.totalResponseCount++;
    if (this.totalResponseCount > 1) throw new Error("Multiple responses sent");
    this._body = data;
    return this;
  }

  send(data: any) {
    this.sendCalls++;
    this.totalResponseCount++;
    if (this.totalResponseCount > 1) throw new Error("Multiple responses sent");
    this._body = data;
    return this;
  }

  end() {
    this.endCalls++;
    this.totalResponseCount++;
    if (this.totalResponseCount > 1) throw new Error("Multiple responses sent");
  }

  setHeader(name: string, value: string) {
    this._headers[name] = value;
  }
}

function verifyNoSensitiveData(obj: any, path = "") {
  if (!obj || typeof obj !== "object") return;

  const forbiddenKeys = [
    "uid", "email", "token", "customToken", "roles", "permissions", "scopes", 
    "systemRole", "organizationRole", "raw", "firestore", 
    "subscriptionDocument", "membershipDocument", "stack"
  ];

  for (const key of Object.keys(obj)) {
    if (forbiddenKeys.includes(key)) {
      throw new Error(`Sensitive key '${key}' found at ${path}.${key}`);
    }
    verifyNoSensitiveData(obj[key], `${path}.${key}`);
  }
}

async function runTests() {
  const logs: any[] = [];

  try {
    let resolverArgs: any[] = [];
    const deps = {
      verifyIdToken: async (token: string) => {
        if (token === "invalid") throw new Error("invalid token");
        if (token === "nouid") return { sub: "nouid" } as any;
        return { uid: "user123" } as any;
      },
      getDb: () => fakeDb,
      resolveAccess: async (...args: any[]) => {
        resolverArgs = args;
        return { 
          accessible: true,
          isGlobalAccess: false,
          accessSource: 'org',
          denialReason: null,
          entitlement: null
        };
      },
      logger: {
        log: () => {},
        info: () => {},
        error: () => {},
        warn: () => {}
      },
      now: () => Date.now()
    };

    // FakeRequest test
    const testsReq = [
      { auth: undefined, body: { organizationId: "org1" }, expectStatus: 401 },
      { auth: "Basic base64", body: { organizationId: "org1" }, expectStatus: 401 },
      { auth: "Bearer ", body: { organizationId: "org1" }, expectStatus: 401 },
      { auth: ["Bearer token1", "Bearer token2"], body: { organizationId: "org1" }, expectStatus: 401 },
      { auth: "Bearer invalid", body: { organizationId: "org1" }, expectStatus: 401 },
      { auth: "Bearer nouid", body: { organizationId: "org1" }, expectStatus: 401 }
    ];

    for (const t of testsReq) {
      const req = new FakeRequest(t.auth, t.body);
      const res = new FakeResponse();
      await handleEcosystemAccessProjectionRequest(req as any, res as any, deps as any);
      check(res._status, t.expectStatus);
      check(res.totalResponseCount, 1);
    }

    // Body ignored fields test
    const fakeBodyReq = new FakeRequest("Bearer token1", {
      organizationId: "  orgX  ",
      uid: "fake_uid",
      userId: "fake_uid",
      email: "fake@email.com",
      systemRole: "ceo",
      organizationRole: "owner",
      roles: ["admin"],
      permissions: ["write"],
      scopes: ["all"],
      accessible: true,
      isGlobalAccess: true,
      subscriptionStatus: "active",
      products: ["a"],
      capabilities: {}
    });
    const fakeBodyRes = new FakeResponse();
    await handleEcosystemAccessProjectionRequest(fakeBodyReq as any, fakeBodyRes as any, deps as any);
    check(fakeBodyRes._status, 200);
    check(resolverArgs[0].uid, "user123");
    check(resolverArgs[0].organizationId, "orgX");
    check(resolverArgs[0].appId, "musicscale");
    
    // Test dynamic cases for handler
    const dynamicCases = [
      // accessible, isGlobal, status -> mapped canonical state
      { granted: true, source: "global", status: "active", expectedAccessible: true, expectedCatalog: "active" },
      { granted: true, source: "global", status: "administrative", expectedAccessible: true, expectedCatalog: "administrative" },
      { granted: true, source: "org", status: "trialing", expectedAccessible: true, expectedCatalog: "trialing" },
      { granted: true, source: "org", status: "active", denialReason: "cancel_scheduled", expectedAccessible: true, expectedCatalog: "cancel_scheduled" }, 
    ];

    const generateCaseDeps = (granted: boolean, source: string, reason: string | null, entStatus?: string, cancelSched?: boolean) => {
      return {
        verifyIdToken: async () => ({ uid: "user123" } as any),
        getDb: () => fakeDb,
        resolveAccess: async () => ({
          accessible: granted,
          isGlobalAccess: source.includes("global"),
          accessSource: source,
          denialReason: reason,
          entitlement: entStatus ? { canonicalStatus: entStatus, cancellationScheduled: !!cancelSched } : null
        }),
        logger: { log: (msg:any, data:any) => { logs.push({level: 'log', msg, data}) }, info: (msg:any, data:any) => { logs.push({level: 'info', msg, data}) }, error: (msg:any, err:any) => { logs.push({level: 'error', msg, err}) }, warn: () => {} },
        now: () => Date.now()
      };
    };

    const caseTests = [
      { granted: true, source: "global_system_role", reason: null, expectedAccessible: true, expectedCatalog: "administrative" },
      { granted: true, source: "organization_membership", reason: null, expectedAccessible: true, expectedCatalog: "active" },
      { granted: true, source: "organization_membership", reason: null, entStatus: "trialing", expectedAccessible: true, expectedCatalog: "trialing" },
      { granted: true, source: "organization_membership", reason: null, entStatus: "active", cancelSched: true, expectedAccessible: true, expectedCatalog: "cancel_scheduled" },
      { granted: true, source: "organization_membership", reason: null, entStatus: "trialing", cancelSched: true, expectedAccessible: true, expectedCatalog: "cancel_scheduled" },
      { granted: false, source: "denied", reason: "SUBSCRIPTION_PAYMENT_REQUIRED", expectedAccessible: false, expectedCatalog: "payment_issue" },
      { granted: false, source: "denied", reason: "SUBSCRIPTION_NOT_FOUND", expectedAccessible: false, expectedCatalog: "available" },
      { granted: false, source: "denied", reason: "SUBSCRIPTION_INACTIVE", expectedAccessible: false, expectedCatalog: "available" },
      { granted: false, source: "denied", reason: "ENTITLEMENT_NOT_CONFIGURED", expectedAccessible: false, expectedCatalog: "available" },
      { granted: false, source: "denied", reason: "ENTITLEMENT_INACTIVE", expectedAccessible: false, expectedCatalog: "available" },
      { granted: false, source: "denied", reason: "MEMBERSHIP_NOT_FOUND", expectedAccessible: false, expectedCatalog: "unavailable" },
      { granted: false, source: "denied", reason: "MEMBERSHIP_INACTIVE", expectedAccessible: false, expectedCatalog: "unavailable" },
      { granted: false, source: "denied", reason: "MEMBER_APP_ACCESS_DISABLED", expectedAccessible: false, expectedCatalog: "unavailable" },
      { granted: false, source: "denied", reason: "USER_INACTIVE", expectedAccessible: false, expectedCatalog: "unavailable" },
      { granted: false, source: "denied", reason: "ORGANIZATION_INACTIVE", expectedAccessible: false, expectedCatalog: "unavailable" },
      { granted: false, source: "denied", reason: "UNKNOWN_DENIAL", expectedAccessible: false, expectedCatalog: "unavailable" },
      { granted: false, source: "denied", reason: "CANCELED", expectedAccessible: false, expectedCatalog: "unavailable" },
    ];

    let maximumResponseCount = 0;

    for (const ct of caseTests) {
      const res = new FakeResponse();
      const req = new FakeRequest("Bearer token1", { organizationId: "org1" });
      await handleEcosystemAccessProjectionRequest(req as any, res as any, generateCaseDeps(ct.granted, ct.source, ct.reason, (ct as any).entStatus, (ct as any).cancelSched) as any);
      check(res._status, 200);
      check(res.totalResponseCount, 1);
      if (res.totalResponseCount > maximumResponseCount) maximumResponseCount = res.totalResponseCount;
      check(res._body.success, true);
      check(res._body.apps.musicscale.accessible, ct.expectedAccessible);
      check(res._body.apps.musicscale.catalogState, ct.expectedCatalog);
      
      // Privacy check
      verifyNoSensitiveData(res._body);
      check(typeof res._body.generatedAtMs, "number");
      check(res._headers['Cache-Control'], 'no-store, no-cache, must-revalidate, proxy-revalidate');
    }

    
    const ignoredFields = ['uid', 'userId', 'email', 'systemRole', 'organizationRole', 'roles', 'permissions', 'scopes', 'accessible', 'isGlobalAccess', 'subscriptionStatus', 'products', 'capabilities'];
    for (const field of ignoredFields) {
      const res = new FakeResponse();
      const body: any = { organizationId: "org1" };
      body[field] = "malicious_value";
      const req = new FakeRequest("Bearer token1", body);
      
      let capturedArgs: any = null;
      const depsWithCapture = {
        verifyIdToken: async () => ({ uid: "user123" } as any),
        getDb: () => fakeDb,
        resolveAccess: async (args: any) => {
          capturedArgs = args;
          return {
            accessible: true,
            isGlobalAccess: false,
            accessSource: 'org',
            denialReason: null,
            entitlement: null
          };
        },
        logger: { log: () => {}, info: () => {}, error: () => {}, warn: () => {} },
        now: () => Date.now()
      };
      
      await handleEcosystemAccessProjectionRequest(req as any, res as any, depsWithCapture as any);
      check(res._status, 200, `Ignored field ${field} returned non-200`);
      check(capturedArgs.uid, "user123");
      check(capturedArgs.organizationId, "org1");
      check(capturedArgs.appId, "musicscale");
      assertionCount++;
      assert.ok(capturedArgs[field] === undefined || (field === 'uid' && capturedArgs[field] === "user123"), `Field ${field} leaked into resolver args`);
    }

    // Invalid body tests
    const invalidBodies = [
      undefined, null, [], {}, { organizationId: "" }, { organizationId: "   " },
      { organizationId: 123 }, { organizationId: "a".repeat(257) }, { organizationId: "." },
      { organizationId: "/" }, { organizationId: "\\" }, { organizationId: "\x00" }
    ];

    for (const ib of invalidBodies) {
      const res = new FakeResponse();
      const req = new FakeRequest("Bearer token1", ib);
      await handleEcosystemAccessProjectionRequest(req as any, res as any, deps as any);
      check(res._status, 400);
      check(res.totalResponseCount, 1);
      verifyNoSensitiveData(res._body);
    }

    // Test errors
    const errDeps = {
      verifyIdToken: async () => ({ uid: "user123" } as any),
      getDb: () => fakeDb,
      resolveAccess: async () => { throw new Error("Internal DB Error"); },
      logger: { log: (msg:any, data:any) => { logs.push({level: 'log', msg, data}) }, info: (msg:any, data:any) => { logs.push({level: 'info', msg, data}) }, error: (msg:any, err:any) => { logs.push({level: 'error', msg, err}) }, warn: () => {} },
      now: () => Date.now()
    };
    const resErr = new FakeResponse();
    const reqErr = new FakeRequest("Bearer token1", { organizationId: "org1" });
    await handleEcosystemAccessProjectionRequest(reqErr as any, resErr as any, errDeps as any);
    check(resErr._status, 500);
    check(resErr._body.error, "Could not resolve application access.");
    check(resErr._body.message, undefined);
    check(resErr._body.stack, undefined);
    verifyNoSensitiveData(resErr._body);

    
    // Test getDb null
    const noDbDeps = {
      verifyIdToken: async () => ({ uid: "user123" } as any),
      getDb: () => null,
      resolveAccess: async () => ({}),
      logger: { log: (msg:any, data:any) => { logs.push({level: 'log', msg, data}) }, info: (msg:any, data:any) => { logs.push({level: 'info', msg, data}) }, error: (msg:any, err:any) => { logs.push({level: 'error', msg, err}) }, warn: () => {} },
      now: () => Date.now()
    };
    const resNoDb = new FakeResponse();
    const reqNoDb = new FakeRequest("Bearer token1", { organizationId: "org1" });
    await handleEcosystemAccessProjectionRequest(reqNoDb as any, resNoDb as any, noDbDeps as any);
    check(resNoDb._status, 503);
    
    // Check logs for resolveAccess throwing
    const errLog = logs.find(l => l.level === 'error' && l.msg === '[ACCESS_PROJECTION_FATAL_ERROR]');
    assertionCount++; assert.ok(errLog !== undefined, "Error log missing");
    if (errLog) {
      assertionCount++; assert.ok(errLog.err !== undefined);
    }
    
    // Check logs for success
    const successLog = logs.find(l => l.level === 'log' && l.msg === '[ACCESS_PROJECTION]');
    assertionCount++; assert.ok(successLog !== undefined, "Success log missing");
    if (successLog) {
      check(successLog.data.organizationId, "org1");
      check(successLog.data.maskedUid, "use...");
      check(typeof successLog.data.timestamp, "number"); // Date.now is mocked to a specific value in deps? actually deps.now() is used.
    }

    // Assert final counters
    check(fetchAttempts, 0);
    check(httpRequestAttempts, 0);
    check(httpsRequestAttempts, 0);
    check(writeAttempts, 0);
    check(batchAttempts, 0);
    check(transactionAttempts, 0);
    check(maximumResponseCount, 1);

    // 12. Frontend Real Coverage
    const dashboardSrc = fs.readFileSync('src/pages/Dashboard.tsx', 'utf-8');
    assertionCount++; assert.ok(dashboardSrc.includes("'/api/ecosystem/access-projection'"));
    assertionCount++; assert.ok(dashboardSrc.includes("'Authorization': `Bearer ${idToken}`"));
    assertionCount++; assert.ok(dashboardSrc.includes("JSON.stringify({ organizationId: orgId })"));
    assertionCount++; assert.ok(dashboardSrc.includes("AbortController"));
    assertionCount++; assert.ok(dashboardSrc.includes("musicScaleProjectionSeqRef.current"));
    assertionCount++; assert.ok(dashboardSrc.includes("musicScaleExpectedOrgRef.current"));
    assertionCount++; assert.ok(dashboardSrc.includes("musicScaleExpectedOrgRef.current = null"));
    assertionCount++; assert.ok(dashboardSrc.includes("refreshMusicScaleAccessProjection"));
    // check billing, repair, handoff refresh
    assertionCount++; assert.ok(dashboardSrc.includes("billing.subscription.upgraded"));

    const homeSrc = fs.readFileSync('src/components/dashboard/EcosystemWorkspaceHome.tsx', 'utf-8');
    assertionCount++; assert.ok(homeSrc.includes("musicScaleAccess?.catalogState as MusicScaleDisplayStatus"));
    assertionCount++; assert.ok(!homeSrc.includes("Satisfy old test UX-FOUNDATION-1b1"));
    assertionCount++; assert.ok(homeSrc.includes("musicScaleDisplayStatus === 'payment_issue' || musicScaleDisplayStatus === 'available') onNavigateToBilling()"));
    assertionCount++; assert.ok(homeSrc.includes("musicScaleDisplayStatus === 'error') onRetryMusicScaleAccess()"));
    assertionCount++; assert.ok(!homeSrc.includes("unavailable') onLaunchApp"));
    assertionCount++; assert.ok(!homeSrc.includes("loading') onLaunchApp"));
    assertionCount++; assert.ok(homeSrc.includes("['active', 'trialing', 'cancel_scheduled', 'administrative'].includes(musicScaleDisplayStatus)"));

    const navSrc = fs.readFileSync('src/components/Navbar.tsx', 'utf-8');
    assertionCount++; assert.ok(navSrc.includes("if (app.id === 'musicscale') return false;"));
    assertionCount++; assert.ok(!navSrc.includes("app.id === 'musicscale' ? true"));
    assertionCount++; assert.ok(navSrc.includes("navigate('/dashboard/apps/musicscale')"));
    assertionCount++; assert.ok(navSrc.includes("nav-login-desktop"));
    assertionCount++; assert.ok(navSrc.includes("nav-login-mobile"));
    assertionCount++; assert.ok(navSrc.includes("nav-login-mobile-menu"));

  } finally {
    globalThis.fetch = originalFetch;
    (http as any).request = originalHttpRequest;
    (https as any).request = originalHttpsRequest;
  }
}

runTests().then(() => {
  console.log("assertionCount", assertionCount);
  console.log("fetchAttempts", fetchAttempts);
  console.log("httpRequestAttempts", httpRequestAttempts);
  console.log("httpsRequestAttempts", httpsRequestAttempts);
  console.log("writeAttempts", writeAttempts);
  console.log("batchAttempts", batchAttempts);
  console.log("transactionAttempts", transactionAttempts);
  }).catch(e => {
  console.error("Test failed", e);
  process.exit(1);
});
