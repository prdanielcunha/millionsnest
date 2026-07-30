import { handleConnectSessionContextRequest } from '../src/server/services/ConnectSessionContextService.js';
import { isCanonicalGlobalRole } from '../src/lib/permissionService.js';
import { getDefaultPermissions } from '../src/lib/rbac.js';

let testCount = 0;
let passCount = 0;
let failCount = 0;
let assertionCount = 0;

function assert(condition: boolean, message: string) {
  assertionCount++;
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

class MockFirestore {
  data: Record<string, Record<string, any>> = {};

  setDoc(collection: string, docId: string, docData: any) {
    if (!this.data[collection]) this.data[collection] = {};
    this.data[collection][docId] = docData;
  }

  collection(name: string) {
    const self = this;
    return {
      doc(id: string) {
        return {
          get: async () => {
            const collectionData = self.data[name] || {};
            const docData = collectionData[id];
            return {
              exists: docData !== undefined,
              id,
              data: () => docData
            };
          },
          collection(subName: string) {
            const fullPath = `${name}/${id}/${subName}`;
            return {
              doc(subId: string) {
                return {
                  get: async () => {
                    const collectionData = self.data[fullPath] || {};
                    const docData = collectionData[subId];
                    return {
                      exists: docData !== undefined,
                      id: subId,
                      data: () => docData
                    };
                  }
                };
              }
            };
          }
        };
      },
      where(field: any, op: string, value: any) {
        return {
          get: async () => {
            const collectionData = self.data[name] || {};
            const docs = Object.keys(collectionData)
              .map(id => ({ id, data: collectionData[id] }))
              .filter(doc => {
                const isIdField = typeof field !== 'string';
                const actualValue = isIdField ? doc.id : doc.data[field];

                if (op === '==') {
                  return actualValue === value;
                }
                if (op === 'in' && Array.isArray(value)) {
                  return value.includes(actualValue);
                }
                return false;
              });
            return {
              empty: docs.length === 0,
              docs: docs.map(d => ({
                id: d.id,
                data: () => d.data
              }))
            };
          }
        };
      }
    } as any;
  }
}

class MockRequest {
  headers: Record<string, string> = {};
  query: Record<string, any> = {};
  constructor(headers: Record<string, string> = {}, query: Record<string, any> = {}) {
    this.headers = headers;
    this.query = query;
  }
}

class MockResponse {
  statusCode: number = 200;
  headers: Record<string, string> = {};
  body: any = null;

  status(code: number) {
    this.statusCode = code;
    return this;
  }

  setHeader(name: string, value: string) {
    this.headers[name.toLowerCase()] = value;
    return this;
  }

  json(data: any) {
    this.body = data;
    return this;
  }
}

async function runTest(name: string, testFn: () => void | Promise<void>) {
  testCount++;
  try {
    await testFn();
    passCount++;
    console.log(`[PASS] Scenario ${testCount.toString().padStart(2, '0')}: ${name}`);
  } catch (error: any) {
    failCount++;
    console.error(`[FAIL] Scenario ${testCount.toString().padStart(2, '0')}: ${name}`);
    console.error(`       Error: ${error.message}`);
  }
}

async function runAll() {
  console.log('======================================================================');
  console.log('   STARTING CERTIFICATION FOR CONNECT CANONICAL SESSION CONTEXT       ');
  console.log('======================================================================');

  // Set up mock Firebase and db env
  let mockDb = new MockFirestore();
  const mockVerifyToken = async (token: string) => {
    if (token === 'valid-user-token') return { uid: 'user-123', email: 'user@example.com' } as any;
    if (token === 'valid-admin-token') return { uid: 'admin-123', email: 'admin@example.com' } as any;
    if (token === 'valid-inactive-token') return { uid: 'inactive-user', email: 'inactive@example.com' } as any;
    if (token === 'valid-unregistered-token') return { uid: 'unregistered-user', email: 'unregistered@example.com' } as any;
    throw new Error('Invalid token');
  };

  const dependencies = {
    verifyIdToken: mockVerifyToken,
    getDb: () => mockDb as any,
    logger: console
  };

  // Preset Mock DB Data
  mockDb.setDoc('users', 'user-123', {
    uid: 'user-123',
    email: 'user@example.com',
    displayName: 'John Doe',
    photoURL: 'https://example.com/photo.jpg',
    locale: 'pt-BR',
    systemRole: 'user',
    activeOrganizationId: 'org-abc',
    primaryOrganizationId: 'org-abc'
  });

  mockDb.setDoc('users', 'admin-123', {
    uid: 'admin-123',
    email: 'admin@example.com',
    displayName: 'Global Admin',
    systemRole: 'ceo',
    organizationIds: ['org-abc']
  });

  mockDb.setDoc('users', 'inactive-user', {
    uid: 'inactive-user',
    email: 'inactive@example.com',
    status: 'inactive'
  });

  mockDb.setDoc('organizations', 'org-abc', {
    name: 'Metodista Central',
    slug: 'metodista-central',
    status: 'active',
    ownerUid: 'user-123',
    enabledApps: ['musicscale'],
    apps: {
      musicscale: {
        access: true,
        plan: 'pro',
        status: 'active',
        features: {
          aiImport: true,
          aiSuggestions: true
        }
      }
    }
  });

  // Organization members subcollection
  mockDb.setDoc('organizations/org-abc/members', 'user-123', {
    role: 'owner',
    status: 'active'
  });

  mockDb.setDoc('subscriptions', 'org-abc', {
    status: 'active',
    plan: 'pro',
    cancellationScheduled: false,
    currentPeriodEnd: { seconds: 1800000000 }
  });

  // --- SECTION 1: SECURITY, TOKEN AND HEADER CHECKS ---

  await runTest('Authentication - Missing Authorization header returns 401', async () => {
    const req = new MockRequest({}, {});
    const res = new MockResponse();
    await handleConnectSessionContextRequest(req as any, res as any, dependencies);
    assert(res.statusCode === 401, 'returns 401 status');
    assert(res.body.code === 'UNAUTHORIZED', 'returns code UNAUTHORIZED');
  });

  await runTest('Authentication - Empty token returns 401', async () => {
    const req = new MockRequest({ authorization: 'Bearer ' }, {});
    const res = new MockResponse();
    await handleConnectSessionContextRequest(req as any, res as any, dependencies);
    assert(res.statusCode === 401, 'returns 401 status');
  });

  await runTest('Authentication - Invalid bearer token prefix returns 401', async () => {
    const req = new MockRequest({ authorization: 'Basic some-credentials' }, {});
    const res = new MockResponse();
    await handleConnectSessionContextRequest(req as any, res as any, dependencies);
    assert(res.statusCode === 401, 'returns 401 status');
  });

  await runTest('Authentication - Invalid signature returns 401', async () => {
    const req = new MockRequest({ authorization: 'Bearer bad-token' }, {});
    const res = new MockResponse();
    await handleConnectSessionContextRequest(req as any, res as any, dependencies);
    assert(res.statusCode === 401, 'returns 401 status');
  });

  await runTest('P0-C Compliance - Security headers are strictly anti-caching', async () => {
    const req = new MockRequest({ authorization: 'Bearer valid-user-token' }, {});
    const res = new MockResponse();
    await handleConnectSessionContextRequest(req as any, res as any, dependencies);
    assert(res.headers['cache-control'] === 'no-store, no-cache, must-revalidate, proxy-revalidate', 'Cache-Control header set');
    assert(res.headers['pragma'] === 'no-cache', 'Pragma header set');
    assert(res.headers['expires'] === '0', 'Expires header set');
    assert(res.headers['surrogate-control'] === 'no-store', 'Surrogate-Control header set');
  });

  await runTest('DB Validation - Uninitialized database returns 503 Service Unavailable', async () => {
    const req = new MockRequest({ authorization: 'Bearer valid-user-token' }, {});
    const res = new MockResponse();
    const badDeps = { ...dependencies, getDb: () => null };
    await handleConnectSessionContextRequest(req as any, res as any, badDeps);
    assert(res.statusCode === 503, 'returns 503 status');
    assert(res.body.code === 'SERVICE_UNAVAILABLE', 'code SERVICE_UNAVAILABLE');
  });

  // --- SECTION 2: IDENTITY RESOLUTION & VALIDATION ---

  await runTest('Identity Validation - Unregistered user returns 401 Profile Not Found', async () => {
    const req = new MockRequest({ authorization: 'Bearer valid-unregistered-token' }, {});
    const res = new MockResponse();
    await handleConnectSessionContextRequest(req as any, res as any, dependencies);
    assert(res.statusCode === 401, 'returns 401 status');
    assert(res.body.error.includes('profile not found'), 'error message contains profile not found');
  });

  await runTest('Identity Validation - Inactive user returns 403 Forbidden', async () => {
    const req = new MockRequest({ authorization: 'Bearer valid-inactive-token' }, {});
    const res = new MockResponse();
    await handleConnectSessionContextRequest(req as any, res as any, dependencies);
    assert(res.statusCode === 403, 'returns 403 Forbidden');
    assert(res.body.code === 'FORBIDDEN', 'error code FORBIDDEN');
  });

  await runTest('Identity Validation - Suspended user status returns 403 Forbidden', async () => {
    mockDb.setDoc('users', 'suspended-user', { uid: 'suspended-user', status: 'suspended' });
    const localDeps = {
      ...dependencies,
      verifyIdToken: async () => ({ uid: 'suspended-user' } as any)
    };
    const req = new MockRequest({ authorization: 'Bearer valid-token' }, {});
    const res = new MockResponse();
    await handleConnectSessionContextRequest(req as any, res as any, localDeps);
    assert(res.statusCode === 403, 'returns 403 Forbidden');
  });

  await runTest('Identity Validation - Disabled flag true returns 403 Forbidden', async () => {
    mockDb.setDoc('users', 'disabled-user', { uid: 'disabled-user', disabled: true });
    const localDeps = {
      ...dependencies,
      verifyIdToken: async () => ({ uid: 'disabled-user' } as any)
    };
    const req = new MockRequest({ authorization: 'Bearer valid-token' }, {});
    const res = new MockResponse();
    await handleConnectSessionContextRequest(req as any, res as any, localDeps);
    assert(res.statusCode === 403, 'returns 403 Forbidden');
  });

  await runTest('Identity Verification - Valid user returns 200 and matches user fields', async () => {
    const req = new MockRequest({ authorization: 'Bearer valid-user-token' }, {});
    const res = new MockResponse();
    await handleConnectSessionContextRequest(req as any, res as any, dependencies);
    assert(res.statusCode === 200, 'returns 200 status');
    assert(res.body.success === true, 'success field true');
    assert(res.body.user.uid === 'user-123', 'matches uid');
    assert(res.body.user.displayName === 'John Doe', 'matches name');
    assert(res.body.user.photoUrl === 'https://example.com/photo.jpg', 'matches photoUrl');
    assert(res.body.user.locale === 'pt-BR', 'matches locale');
    assert(res.body.user.systemRole === 'user', 'matches systemRole');
  });

  // --- SECTION 3: SYSTEM ROLE & CAPABILITIES RESOLUTION ---

  await runTest('Capabilities - Global admin (ceo) receives globalAccess and wildcard capabilities', async () => {
    const req = new MockRequest({ authorization: 'Bearer valid-admin-token' }, {});
    const res = new MockResponse();
    await handleConnectSessionContextRequest(req as any, res as any, dependencies);
    assert(res.statusCode === 200, 'success response');
    assert(res.body.globalAccess === true, 'globalAccess is true');
    assert(res.body.user.capabilities.includes('*'), 'user.capabilities has *');
  });

  await runTest('Capabilities - Normal user does not receive globalAccess and is not wildcard', async () => {
    const req = new MockRequest({ authorization: 'Bearer valid-user-token' }, {});
    const res = new MockResponse();
    await handleConnectSessionContextRequest(req as any, res as any, dependencies);
    assert(res.statusCode === 200, 'success response');
    assert(res.body.globalAccess === false, 'globalAccess is false');
    assert(!res.body.user.capabilities.includes('*'), 'user.capabilities does not have *');
  });

  await runTest('Capabilities - Users receive explicit capabilities list from Firestore', async () => {
    mockDb.setDoc('users', 'user-cap', {
      uid: 'user-cap',
      capabilities: ['custom.capability', 'another.one'],
      systemRole: 'user'
    });
    const localDeps = {
      ...dependencies,
      verifyIdToken: async () => ({ uid: 'user-cap' } as any)
    };
    const req = new MockRequest({ authorization: 'Bearer token' }, {});
    const res = new MockResponse();
    await handleConnectSessionContextRequest(req as any, res as any, localDeps);
    assert(res.body.user.capabilities.includes('custom.capability'), 'has custom.capability');
    assert(res.body.user.capabilities.includes('another.one'), 'has another.one');
  });

  // --- SECTION 4: ORGANIZATIONS & ACTIVE TENANT RESOLUTION ---

  await runTest('Organizations - Empty memberships returns empty array and null active organization', async () => {
    mockDb.setDoc('users', 'user-empty', { uid: 'user-empty', systemRole: 'user' });
    const localDeps = {
      ...dependencies,
      verifyIdToken: async () => ({ uid: 'user-empty' } as any)
    };
    const req = new MockRequest({ authorization: 'Bearer token' }, {});
    const res = new MockResponse();
    await handleConnectSessionContextRequest(req as any, res as any, localDeps);
    assert(res.body.organizations.length === 0, 'no organizations returned');
    assert(res.body.activeOrganizationId === null, 'activeOrgId is null');
    assert(res.body.activeOrganization === null, 'activeOrg is null');
    assert(res.body.appAccess === null, 'appAccess is null when activeOrgId is null');
  });

  await runTest('Organizations - Fallback to owned organization when membership doc missing', async () => {
    mockDb.setDoc('users', 'user-owner', { uid: 'user-owner', systemRole: 'user' });
    mockDb.setDoc('organizations', 'org-owned', { name: 'Owned Church', ownerUid: 'user-owner' });
    const localDeps = {
      ...dependencies,
      verifyIdToken: async () => ({ uid: 'user-owner' } as any)
    };
    const req = new MockRequest({ authorization: 'Bearer token' }, {});
    const res = new MockResponse();
    await handleConnectSessionContextRequest(req as any, res as any, localDeps);
    assert(res.body.organizations.length === 1, 'has 1 organization');
    assert(res.body.activeOrganizationId === 'org-owned', 'active organization auto-resolved to owned org');
    assert(res.body.organizations[0].id === 'org-owned', 'matches id');
    assert(res.body.organizations[0].organizationRole === 'owner', 'matches computed owner role');
  });

  await runTest('Organizations - Fallback to legacy organizationId field', async () => {
    mockDb.setDoc('users', 'user-legacy-id', { uid: 'user-legacy-id', organizationId: 'org-leg' });
    mockDb.setDoc('organizations', 'org-leg', { name: 'Legacy Church' });
    const localDeps = {
      ...dependencies,
      verifyIdToken: async () => ({ uid: 'user-legacy-id' } as any)
    };
    const req = new MockRequest({ authorization: 'Bearer token' }, {});
    const res = new MockResponse();
    await handleConnectSessionContextRequest(req as any, res as any, localDeps);
    assert(res.body.organizations.length === 1, 'resolved via legacy field');
    assert(res.body.activeOrganizationId === 'org-leg', 'matches active organization id');
  });

  await runTest('Organizations - Legacy organization_members collection lookup fallback', async () => {
    mockDb.setDoc('users', 'user-legacy-member', { uid: 'user-legacy-member' });
    mockDb.setDoc('organizations', 'org-legacy-col', { name: 'Legacy Member Collection' });
    mockDb.setDoc('organization_members', 'user-legacy-member_org-legacy-col', {
      uid: 'user-legacy-member',
      organizationId: 'org-legacy-col',
      role: 'admin'
    });
    const localDeps = {
      ...dependencies,
      verifyIdToken: async () => ({ uid: 'user-legacy-member' } as any)
    };
    const req = new MockRequest({ authorization: 'Bearer token' }, {});
    const res = new MockResponse();
    await handleConnectSessionContextRequest(req as any, res as any, localDeps);
    assert(res.body.organizations.length === 1, 'resolved legacy membership collection');
    assert(res.body.activeOrganizationId === 'org-legacy-col', 'activeOrg is org-legacy-col');
  });

  await runTest('Organizations - Archived status organizations are filtered out of candidate list', async () => {
    mockDb.setDoc('users', 'user-archive', { uid: 'user-archive', activeOrganizationId: 'org-active' });
    mockDb.setDoc('organizations', 'org-active', { name: 'Active Org', status: 'active' });
    mockDb.setDoc('organizations', 'org-archived', { name: 'Archived Org', status: 'archived', ownerUid: 'user-archive' });
    mockDb.setDoc('organizations/org-active/members', 'user-archive', { role: 'member' });
    
    const localDeps = {
      ...dependencies,
      verifyIdToken: async () => ({ uid: 'user-archive' } as any)
    };
    const req = new MockRequest({ authorization: 'Bearer token' }, {});
    const res = new MockResponse();
    await handleConnectSessionContextRequest(req as any, res as any, localDeps);
    assert(res.body.organizations.length === 1, 'only active org is candidate');
    assert(res.body.organizations[0].id === 'org-active', 'active is returned');
  });

  await runTest('Organizations - Multiple organizations sorting weight prioritizes owner > admin > member', async () => {
    mockDb.setDoc('users', 'user-sort', { uid: 'user-sort', organizationIds: ['org-1', 'org-2', 'org-3'] });
    mockDb.setDoc('organizations', 'org-1', { name: 'Org 1', ownerUid: 'user-sort', createdAt: { seconds: 100 } });
    mockDb.setDoc('organizations', 'org-2', { name: 'Org 2', createdAt: { seconds: 200 } });
    mockDb.setDoc('organizations', 'org-3', { name: 'Org 3', createdAt: { seconds: 300 } });

    mockDb.setDoc('organizations/org-1/members', 'user-sort', { role: 'owner' });
    mockDb.setDoc('organizations/org-2/members', 'user-sort', { role: 'admin' });
    mockDb.setDoc('organizations/org-3/members', 'user-sort', { role: 'member' });

    const localDeps = {
      ...dependencies,
      verifyIdToken: async () => ({ uid: 'user-sort' } as any)
    };
    const req = new MockRequest({ authorization: 'Bearer token' }, {});
    const res = new MockResponse();
    await handleConnectSessionContextRequest(req as any, res as any, localDeps);
    assert(res.body.organizations[0].id === 'org-1', 'Org 1 (owner) is first');
    assert(res.body.organizations[1].id === 'org-2', 'Org 2 (admin) is second');
    assert(res.body.organizations[2].id === 'org-3', 'Org 3 (member) is third');
  });

  // --- SECTION 5: ROLES, PERMISSIONS AND CAPABILITIES CONTRACTS ---

  await runTest('Permissions - Global admin receives wildcard permissions list inside organizations', async () => {
    const req = new MockRequest({ authorization: 'Bearer valid-admin-token' }, {});
    const res = new MockResponse();
    await handleConnectSessionContextRequest(req as any, res as any, dependencies);
    const firstOrg = res.body.organizations[0];
    assert(firstOrg.permissions.includes('*'), 'permissions has wildcard');
  });

  await runTest('Permissions - Owner role receives standard default owner permissions list', async () => {
    const req = new MockRequest({ authorization: 'Bearer valid-user-token' }, {});
    const res = new MockResponse();
    await handleConnectSessionContextRequest(req as any, res as any, dependencies);
    const org = res.body.organizations.find((o: any) => o.id === 'org-abc');
    assert(org.permissions.includes('organization.settings.update'), 'has setting update');
    assert(org.permissions.includes('organization.members.manage'), 'has member manage');
  });

  await runTest('Capabilities - Active organization capabilities include enabled apps and subscription feature flags', async () => {
    const req = new MockRequest({ authorization: 'Bearer valid-user-token' }, {});
    const res = new MockResponse();
    await handleConnectSessionContextRequest(req as any, res as any, dependencies);
    const activeOrg = res.body.activeOrganization;
    assert(activeOrg.capabilities.includes('musicscale'), 'capabilities list includes musicscale');
    assert(activeOrg.capabilities.includes('musicscale.feature.aiImport'), 'capabilities list includes musicscale.feature.aiImport');
  });

  // --- SECTION 6: APP ACCESS & ENTITLEMENTS MAPPING ---

  await runTest('AppAccess - Correct mapping of catalogState, decisionState, and entitlements for active subscription', async () => {
    const req = new MockRequest({ authorization: 'Bearer valid-user-token' }, {});
    const res = new MockResponse();
    await handleConnectSessionContextRequest(req as any, res as any, dependencies);
    const msAccess = res.body.appAccess.musicscale;
    assert(msAccess.accessible === true, 'accessible is true');
    assert(msAccess.decisionState === 'granted', 'decisionState is granted');
    assert(msAccess.catalogState === 'active', 'catalogState matches active');
    assert(msAccess.entitlement.canonicalStatus === 'active', 'entitlement canonicalStatus matches active');
  });

  await runTest('AppAccess - Correct mapping of trialing catalogState and entitlement info', async () => {
    mockDb.setDoc('users', 'user-trial', { uid: 'user-trial', activeOrganizationId: 'org-trial' });
    mockDb.setDoc('organizations', 'org-trial', { name: 'Trial Church', enabledApps: ['musicscale'], apps: { musicscale: { status: 'trialing', access: true } } });
    mockDb.setDoc('organizations/org-trial/members', 'user-trial', { role: 'member' });
    mockDb.setDoc('subscriptions', 'org-trial', {
      status: 'trialing',
      plan: 'pro',
      cancellationScheduled: false,
      currentPeriodEnd: { seconds: 1800000000 }
    });

    const localDeps = {
      ...dependencies,
      verifyIdToken: async () => ({ uid: 'user-trial' } as any)
    };
    const req = new MockRequest({ authorization: 'Bearer token' }, {});
    const res = new MockResponse();
    await handleConnectSessionContextRequest(req as any, res as any, localDeps);
    const msAccess = res.body.appAccess.musicscale;
    assert(msAccess.accessible === true, 'accessible');
    assert(msAccess.catalogState === 'trialing', 'catalogState matches trialing');
    assert(msAccess.entitlement.canonicalStatus === 'trialing', 'entitlement trialing');
  });

  await runTest('AppAccess - Correct mapping of cancel_scheduled catalogState and cancellation flag', async () => {
    mockDb.setDoc('users', 'user-cancel', { uid: 'user-cancel', activeOrganizationId: 'org-cancel' });
    mockDb.setDoc('organizations', 'org-cancel', { name: 'Cancelling Church', enabledApps: ['musicscale'], apps: { musicscale: { status: 'active', access: true } } });
    mockDb.setDoc('organizations/org-cancel/members', 'user-cancel', { role: 'member' });
    mockDb.setDoc('subscriptions', 'org-cancel', {
      status: 'active',
      plan: 'pro',
      cancel_at_period_end: true,
      currentPeriodEnd: { seconds: 1800000000 }
    });

    const localDeps = {
      ...dependencies,
      verifyIdToken: async () => ({ uid: 'user-cancel' } as any)
    };
    const req = new MockRequest({ authorization: 'Bearer token' }, {});
    const res = new MockResponse();
    await handleConnectSessionContextRequest(req as any, res as any, localDeps);
    const msAccess = res.body.appAccess.musicscale;
    assert(msAccess.accessible === true, 'accessible');
    assert(msAccess.catalogState === 'cancel_scheduled', 'catalogState matches cancel_scheduled');
    assert(msAccess.entitlement.cancellationScheduled === true, 'cancellation flag is true');
  });

  await runTest('AppAccess - Blocked access maps decisionState to denied and catalogState to available', async () => {
    mockDb.setDoc('users', 'user-blocked', { uid: 'user-blocked', activeOrganizationId: 'org-blocked' });
    mockDb.setDoc('organizations', 'org-blocked', { name: 'Blocked Church', enabledApps: ['musicscale'] });
    mockDb.setDoc('organizations/org-blocked/members', 'user-blocked', { role: 'member' });
    mockDb.setDoc('subscriptions', 'org-blocked', {
      status: 'canceled',
      plan: 'starter'
    });

    const localDeps = {
      ...dependencies,
      verifyIdToken: async () => ({ uid: 'user-blocked' } as any)
    };
    const req = new MockRequest({ authorization: 'Bearer token' }, {});
    const res = new MockResponse();
    await handleConnectSessionContextRequest(req as any, res as any, localDeps);
    const msAccess = res.body.appAccess.musicscale;
    assert(msAccess.accessible === false, 'accessible is false');
    assert(msAccess.decisionState === 'denied', 'decisionState matches denied');
    assert(msAccess.catalogState === 'available', 'catalogState matches available (prompting user to buy)');
  });

  await runTest('AppAccess - Payment issue status maps to payment_issue catalogState', async () => {
    mockDb.setDoc('users', 'user-payment-issue', { uid: 'user-payment-issue', activeOrganizationId: 'org-payment-issue' });
    mockDb.setDoc('organizations', 'org-payment-issue', { name: 'Payment Issue Church', enabledApps: ['musicscale'], apps: { musicscale: { status: 'active', access: true } } });
    mockDb.setDoc('organizations/org-payment-issue/members', 'user-payment-issue', { role: 'member' });
    mockDb.setDoc('subscriptions', 'org-payment-issue', {
      status: 'past_due',
      plan: 'pro'
    });

    const localDeps = {
      ...dependencies,
      verifyIdToken: async () => ({ uid: 'user-payment-issue' } as any)
    };
    const req = new MockRequest({ authorization: 'Bearer token' }, {});
    const res = new MockResponse();
    await handleConnectSessionContextRequest(req as any, res as any, localDeps);
    const msAccess = res.body.appAccess.musicscale;
    assert(msAccess.accessible === false, 'accessible false');
    assert(msAccess.catalogState === 'payment_issue', 'catalogState matches payment_issue');
  });

  // --- SECTION 7: DURABLE WRITE-ISOLATION / PASSIVE COMPLIANCE CHECKS ---

  await runTest('Strict Read-Only Enforcement - Execution never modifies Firestore state (No AUTO-HEAL writes)', async () => {
    const originalDocs = JSON.stringify(mockDb.data);
    const req = new MockRequest({ authorization: 'Bearer valid-user-token' }, {});
    const res = new MockResponse();
    await handleConnectSessionContextRequest(req as any, res as any, dependencies);
    const currentDocs = JSON.stringify(mockDb.data);
    assert(originalDocs === currentDocs, 'No documents were created, updated, or deleted in the database');
  });

  console.log('======================================================================');
  console.log(`   CERTIFICATION RESULTS: ${passCount.toString()}/${testCount.toString()} PASSED (${assertionCount.toString()} assertions)`);
  if (failCount > 0) {
    console.error(`   >>> WARNING: ${failCount.toString()} SCENARIOS FAILED <<<`);
  } else {
    console.log('   STATUS: ALL SCENARIOS VERIFIED GREEN, CANONICAL BEHAVIOR CONFIRMED!');
  }
  console.log('======================================================================');
  
  if (failCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAll().catch(e => {
  console.error('[FATAL RUNNER CRASH]', e);
  process.exit(1);
});
