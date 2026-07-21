import { planSupportTicketRequest } from '../src/server/services/SupportTicketPlanner.js';
import { deliverSupportTicketEmail } from '../src/server/services/SupportEmailAdapter.js';
import { resolveEcosystemPrivilegePolicy, resolveEffectiveSupportAccess } from '../src/lib/permissionService.js';
import { getSupportCapabilities } from '../src/server/services/SupportCapabilitiesService.js';
import admin from 'firebase-admin';
import { getAuth } from 'firebase-admin/auth';

// Setup environment for testing
process.env.SUPPORT_EMAIL_PROVIDER = 'disabled';
process.env.RESEND_API_KEY = '';

if (admin.apps.length === 0) {
  admin.initializeApp({
    projectId: 'test-project'
  });
}

async function runTests() {
  console.log('=== STARTING EXPANDED SUPPORT ACCESS & PRIVILEGES TESTS ===\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`✅ [PASS] ${message}`);
      passed++;
    } else {
      console.log(`❌ [FAIL] ${message}`);
      failed++;
    }
  }

  // ==========================================
  // 1. SupportTicketPlanner Tests
  // ==========================================
  console.log('--- 1. Testing SupportTicketPlanner ---');

  const nowMs = Date.now();

  const validRequest = {
    requestId: '12345678-1234-1234-1234-1234567890ab',
    organizationId: 'org-test-999',
    category: 'billing',
    message: 'Hello, this is a valid support request with more than twenty characters.',
    whatsapp: '+55 11 99999-9999',
    appId: 'musicscale',
    pagePath: '/dashboard/overview',
    locale: 'pt'
  };
  const res1 = planSupportTicketRequest(validRequest, nowMs);
  assert(res1.success === true, 'Should plan and normalize valid request successfully');
  assert(res1.normalized?.requestId === '12345678-1234-1234-1234-1234567890ab', 'Normalized requestId matches');
  assert(res1.normalized?.organizationId === 'org-test-999', 'Normalized organizationId matches');

  const shortRequest = {
    ...validRequest,
    message: 'Too short.'
  };
  const res2 = planSupportTicketRequest(shortRequest, nowMs);
  assert(res2.success === false && res2.reasonCode === 'MESSAGE_TOO_SHORT', 'Should fail when message is too short');

  const badOrgRequest1 = {
    ...validRequest,
    organizationId: ''
  };
  const res3 = planSupportTicketRequest(badOrgRequest1, nowMs);
  assert(res3.success === false && res3.reasonCode === 'INVALID_ORGANIZATION_ID', 'Should fail on empty organizationId');

  const badOrgRequest2 = {
    ...validRequest,
    organizationId: 'a'.repeat(129)
  };
  const res4 = planSupportTicketRequest(badOrgRequest2, nowMs);
  assert(res4.success === false && res4.reasonCode === 'INVALID_ORGANIZATION_ID', 'Should fail on organizationId too long');


  // ==========================================
  // 2. SupportEmailAdapter Tests
  // ==========================================
  console.log('\n--- 2. Testing SupportEmailAdapter ---');

  const ticketMock = {
    id: 'ticket-123',
    reference: 'MN-TEST1234',
    category: 'billing',
    userName: 'Tester',
    userEmail: 'tester@test.com',
    organizationName: 'Test Org',
    organizationId: 'org-test-999',
    supportTier: 'standard' as const,
    message: 'Testing disabled provider behavior.',
    locale: 'pt' as const
  };

  const emailRes1 = await deliverSupportTicketEmail(ticketMock);
  assert(emailRes1.status === 'not_configured', 'Should return not_configured when provider is disabled');


  // ==========================================
  // 3. PermissionService & Support Precedence Tests
  // ==========================================
  console.log('\n--- 3. Testing PermissionService & Support Precedence ---');

  // Test 3.1: Privilege policies
  const ceoPolicy = resolveEcosystemPrivilegePolicy('ceo');
  assert(ceoPolicy.isCanonicalGlobalRole === true && ceoPolicy.canBypassSupportMembership === true, 'CEO should bypass support membership');
  assert(ceoPolicy.hasPrioritySupport === true, 'CEO should have priority support entitlement');

  const supportPolicy = resolveEcosystemPrivilegePolicy('ecosystem_support');
  assert(supportPolicy.isEcosystemSupportStaff === true && supportPolicy.canBypassSupportMembership === true, 'Ecosystem Support should bypass membership');
  assert(supportPolicy.hasPrioritySupport === true, 'Ecosystem Support should have priority support');
  assert(supportPolicy.isCanonicalGlobalRole === false, 'Ecosystem Support is not a canonical global role (governance isolation)');

  const userPolicy = resolveEcosystemPrivilegePolicy('user');
  assert(userPolicy.canBypassSupportMembership === false && userPolicy.hasPrioritySupport === false, 'Regular user has no automatic privilege bypass or priority');

  // Test 3.2: resolveEffectiveSupportAccess precedence rules
  // Rule 1: Privilege override priority
  const accessCEO = resolveEffectiveSupportAccess({ systemRole: 'ceo' });
  assert(accessCEO.supportTier === 'priority' && accessCEO.accessSource === 'global_privilege', 'CEO precedence leads to priority support from global_privilege');

  const accessStaff = resolveEffectiveSupportAccess({ systemRole: 'ecosystem_support' });
  assert(accessStaff.supportTier === 'priority' && accessStaff.accessSource === 'ecosystem_support', 'Support staff precedence leads to priority support from ecosystem_support');

  // Rule 2: Subscription support tier
  const accessSub = resolveEffectiveSupportAccess({
    systemRole: 'user',
    subscription: { supportTier: 'priority' }
  });
  assert(accessSub.supportTier === 'priority' && accessSub.accessSource === 'subscription', 'Subscription support tier overrides fallback');

  // Rule 3: Organization app support tier
  const accessOrg = resolveEffectiveSupportAccess({
    systemRole: 'user',
    organization: { apps: { musicscale: { supportTier: 'basic' } } }
  });
  assert(accessOrg.supportTier === 'basic_priority' && accessOrg.accessSource === 'organization', 'Organization app support tier basic resolves to basic_priority');

  // Rule 4: Fallback
  const accessFallback = resolveEffectiveSupportAccess({ systemRole: 'user' });
  assert(accessFallback.supportTier === 'standard' && accessFallback.accessSource === 'fallback', 'Fallback resolves to standard support tier');


  // ==========================================
  // 4. SupportCapabilitiesService Mock Tests
  // ==========================================
  console.log('\n--- 4. Testing SupportCapabilitiesService ---');

  const auth = getAuth();
  let stubVerifyIdToken = async (token: string): Promise<any> => {
    return { uid: 'test-user-uid', email: 'test@test.com' };
  };
  auth.verifyIdToken = (token: string) => stubVerifyIdToken(token);

  let mockDbData: any = {};
  const originalFirestore = admin.firestore;
  Object.defineProperty(admin, 'firestore', {
    get: () => {
      return () => {
        return {
          settings: () => {},
          collection: (colName: string) => {
            return {
              doc: (docId: string) => {
                return {
                  get: async () => {
                    const path = `${colName}/${docId}`;
                    const data = mockDbData[path];
                    if (!data) return { exists: false };
                    return {
                      exists: true,
                      data: () => data
                    };
                  },
                  collection: (subColName: string) => {
                    return {
                      doc: (subDocId: string) => {
                        return {
                          get: async () => {
                            const path = `${colName}/${docId}/${subColName}/${subDocId}`;
                            const data = mockDbData[path];
                            if (!data) return { exists: false };
                            return {
                              exists: true,
                              data: () => data
                            };
                          }
                        };
                      }
                    };
                  }
                };
              }
            };
          }
        };
      };
    },
    configurable: true
  });

  // Scenario 4.1: Canonical role success capabilities retrieval
  stubVerifyIdToken = async () => ({ uid: 'ceo-uid', email: 'ceo@test.com' });
  mockDbData = {
    'users/ceo-uid': { systemRole: 'ceo' },
    'organizations/org-star': { name: 'Starter Church', apps: { musicscale: { supportTier: 'standard' } } },
    'subscriptions/org-star': { supportTier: 'standard' }
  };

  let resStatus = 0;
  let resJson: any = null;
  const mockRes = {
    status: (code: number) => {
      resStatus = code;
      return mockRes;
    },
    json: (payload: any) => {
      resJson = payload;
      return mockRes;
    }
  } as any;

  const mockReq1 = {
    headers: { authorization: 'Bearer dummy-token-1' },
    query: { organizationId: 'org-star' }
  } as any;

  await getSupportCapabilities(mockReq1, mockRes);
  assert(resStatus === 200, 'CEO capability request returns 200 OK');
  assert(resJson?.success === true, 'Response indicates success');
  assert(resJson?.supportTier === 'priority', 'CEO resolved to priority support tier');
  assert(resJson?.hasPrioritySupport === true, 'CEO hasPrioritySupport is true');
  assert(resJson?.hasGlobalEntitlementOverride === true, 'CEO hasGlobalEntitlementOverride is true');
  assert(resJson?.systemRole === undefined, 'Does not leak systemRole in payload');

  // Scenario 4.2: Ecosystem Support staff success capabilities retrieval
  stubVerifyIdToken = async () => ({ uid: 'staff-uid', email: 'staff@test.com' });
  mockDbData = {
    'users/staff-uid': { systemRole: 'ecosystem_support' },
    'organizations/org-star': { name: 'Starter Church', apps: { musicscale: { supportTier: 'standard' } } },
    'subscriptions/org-star': { supportTier: 'standard' }
  };

  const mockReq2 = {
    headers: { authorization: 'Bearer dummy-token-2' },
    query: { organizationId: 'org-star' }
  } as any;

  await getSupportCapabilities(mockReq2, mockRes);
  assert(resStatus === 200, 'Support staff request returns 200 OK');
  assert(resJson?.supportTier === 'priority', 'Support staff resolved to priority support tier');
  assert(resJson?.hasGlobalEntitlementOverride === true, 'Support staff has override true');

  // Scenario 4.3: Regular user context mismatch validation
  stubVerifyIdToken = async () => ({ uid: 'user-uid', email: 'user@test.com' });
  mockDbData = {
    'users/user-uid': { systemRole: 'user', activeOrganizationId: 'org-active' },
    'organizations/org-other': { name: 'Other Church' }
  };

  const mockReq3 = {
    headers: { authorization: 'Bearer dummy-token-3' },
    query: { organizationId: 'org-other' }
  } as any;

  await getSupportCapabilities(mockReq3, mockRes);
  assert(resStatus === 409, 'Querying different organization than active returning 409 mismatch');
  assert(resJson?.reasonCode === 'ORGANIZATION_CONTEXT_MISMATCH', 'Correct reason code returned');

  // Restore firestore mock
  Object.defineProperty(admin, 'firestore', {
    get: () => originalFirestore,
    configurable: true
  });

  // ==========================================
  // SUMMARY
  // ==========================================
  console.log('\n==========================================');
  console.log(`TEST SUMMARY: ${passed} passed, ${failed} failed`);
  console.log('==========================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('Test execution failed critically:', err);
  process.exit(1);
});
