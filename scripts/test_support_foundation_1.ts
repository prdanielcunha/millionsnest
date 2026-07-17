import { planSupportTicketRequest } from '../src/server/services/SupportTicketPlanner.js';
import { deliverSupportTicketEmail } from '../src/server/services/SupportEmailAdapter.js';

// Setup environment for testing
process.env.SUPPORT_EMAIL_PROVIDER = 'disabled';
process.env.RESEND_API_KEY = '';

async function runTests() {
  console.log('=== STARTING SUPPORT FOUNDATION 1 VALIDATION TESTS ===\n');

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

  // Test 1.1: Success Planning
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

  // Test 1.2: Message too short
  const shortRequest = {
    ...validRequest,
    message: 'Too short.'
  };
  const res2 = planSupportTicketRequest(shortRequest, nowMs);
  assert(res2.success === false && res2.reasonCode === 'MESSAGE_TOO_SHORT', 'Should fail when message is too short');

  // Test 1.3: Invalid Organization ID
  const badOrgRequest1 = {
    ...validRequest,
    organizationId: ''
  };
  const res3 = planSupportTicketRequest(badOrgRequest1, nowMs);
  assert(res3.success === false && res3.reasonCode === 'INVALID_ORGANIZATION_ID', 'Should fail on empty organizationId');

  const badOrgRequest2 = {
    ...validRequest,
    organizationId: 'a'.repeat(129) // over 128 characters
  };
  const res4 = planSupportTicketRequest(badOrgRequest2, nowMs);
  assert(res4.success === false && res4.reasonCode === 'INVALID_ORGANIZATION_ID', 'Should fail on organizationId too long');

  // Test 1.4: Null or missing Request ID
  const missingReqId = {
    ...validRequest,
    requestId: undefined
  };
  const res5 = planSupportTicketRequest(missingReqId as any, nowMs);
  assert(res5.success === false && res5.reasonCode === 'INVALID_REQUEST_ID', 'Should fail on missing requestId');


  // ==========================================
  // 2. SupportEmailAdapter Tests
  // ==========================================
  console.log('\n--- 2. Testing SupportEmailAdapter ---');

  // Test 2.1: Provider disabled
  process.env.SUPPORT_EMAIL_PROVIDER = 'disabled';
  const ticketMock = {
    id: 'ticket-123',
    reference: 'MN-TEST1234',
    category: 'billing',
    userName: 'Tester',
    userEmail: 'tester@test.com',
    organizationName: 'Test Org',
    organizationId: 'org-test-999',
    supportTier: 'standard',
    message: 'Testing disabled provider behavior.',
    locale: 'pt'
  };

  const emailRes1 = await deliverSupportTicketEmail(ticketMock);
  assert(emailRes1.status === 'not_configured', 'Should return not_configured when provider is disabled');

  // Test 2.2: Simulate Successful Send
  process.env.SUPPORT_EMAIL_PROVIDER = 'resend';
  process.env.RESEND_API_KEY = 're_test_123456';
  process.env.SUPPORT_FROM_EMAIL = 'support@test.com';
  process.env.SUPPORT_EMAIL_TO = 'recipient@test.com';

  const originalFetch = global.fetch;

  global.fetch = (async (url: string, options: any) => {
    assert(url === 'https://api.resend.com/emails', 'Deliver calls Resend API endpoint');
    assert(options.method === 'POST', 'HTTP method is POST');
    assert(options.headers.Authorization === 'Bearer re_test_123456', 'Auth header contains API key');
    
    const body = JSON.parse(options.body);
    assert(body.from === 'support@test.com', 'From email is mapped correctly');
    assert(body.to[0] === 'recipient@test.com', 'Recipient email is mapped correctly');
    assert(body.subject.includes('MN-TEST1234'), 'Subject contains ticket reference');

    return {
      ok: true,
      status: 200,
      json: async () => ({ id: 'resend-email-id' }),
      text: async () => 'OK'
    };
  }) as any;

  const emailRes2 = await deliverSupportTicketEmail(ticketMock);
  assert(emailRes2.status === 'sent', 'Should return sent status on successful fetch response');

  // Test 2.3: Simulate HTTP Failure
  global.fetch = (async (url: string, options: any) => {
    return {
      ok: false,
      status: 403,
      text: async () => 'Unauthorized'
    };
  }) as any;

  const emailRes3 = await deliverSupportTicketEmail(ticketMock);
  assert(emailRes3.status === 'failed' && emailRes3.errorCode === 'HTTP_403', 'Should return failed status with correct errorCode on 403 response');

  // Restore global fetch
  global.fetch = originalFetch;


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
