import { handleConnectChannelDelegationRequest } from '../src/server/services/ConnectChannelDelegationService.js';

let checks = 0;
function assert(condition: unknown, message: string) {
  checks += 1;
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

class ResponseStub {
  statusCode = 200;
  body: any = null;
  headers: Record<string, string> = {};
  setHeader(name: string, value: string) { this.headers[name.toLowerCase()] = value; }
  status(code: number) { this.statusCode = code; return this; }
  json(body: unknown) { this.body = body; return this; }
}

function deps(overrides: Record<string, unknown> = {}) {
  let claims: Record<string, unknown> | null = null;
  const base = {
    verifyServiceIdentity: async (_token: string) => ({
      email: 'mn-connect-runtime@millionsnest.iam.gserviceaccount.com',
      subject: 'service-subject',
    }),
    getDb: () => ({ fake: true }),
    resolveAccess: async () => ({
      appId: 'musicscale',
      organizationId: 'org-1',
      accessible: true,
      isGlobalAccess: false,
      accessSource: 'organization_membership',
      roles: ['member'],
      permissions: ['scales.read'],
      decisionState: 'granted',
    }),
    createCustomToken: async (uid: string, inputClaims: Record<string, unknown>) => {
      assert(uid === 'user-12345678', 'delegation token is issued for the linked actor only');
      claims = inputClaims;
      return 'firebase-custom-token';
    },
    now: () => 1_700_000_000_000,
    logger: { info() {}, warn() {}, error() {} },
    ...overrides,
  };
  return { value: base as any, readClaims: () => claims };
}

async function call(input: { headers?: Record<string, string>; body?: unknown }, dependencyOverrides: Record<string, unknown> = {}) {
  const response = new ResponseStub();
  const dependencySet = deps(dependencyOverrides);
  await handleConnectChannelDelegationRequest(
    { headers: input.headers || {}, body: input.body } as any,
    response as any,
    dependencySet.value,
  );
  return { response, claims: dependencySet.readClaims() };
}

console.log('--- Running Connect Channel Delegation Tests ---');

{
  const { response } = await call({
    body: { uid: 'user-12345678', organizationId: 'org-1', channel: 'whatsapp', channelIdentityRef: 'wa:abc' },
  });
  assert(response.statusCode === 401, 'service identity is mandatory');
  assert(response.body.code === 'CONNECT_SERVICE_AUTH_REQUIRED', 'missing service identity fails explicitly');
  assert(response.headers['cache-control'] === 'no-store', 'delegation response is never cacheable');
}

{
  const { response } = await call({
    headers: { 'x-connect-service-authorization': 'Bearer invalid' },
    body: { uid: 'user-12345678', organizationId: 'org-1', channel: 'whatsapp', channelIdentityRef: 'wa:abc' },
  }, {
    verifyServiceIdentity: async () => { throw new Error('denied'); },
  });
  assert(response.statusCode === 401, 'invalid Google service identity is denied');
  assert(response.body.code === 'CONNECT_SERVICE_AUTH_INVALID', 'invalid service token never reaches actor resolution');
}

{
  const { response } = await call({
    headers: { 'x-connect-service-authorization': 'Bearer service-token' },
    body: { uid: 'user-12345678', organizationId: 'org-1', channel: 'telegram', channelIdentityRef: 'wa:abc' },
  });
  assert(response.statusCode === 400, 'delegation is WhatsApp-only in this phase');
}

{
  const { response } = await call({
    headers: { 'x-connect-service-authorization': 'Bearer service-token' },
    body: { uid: 'user-12345678', organizationId: 'org-1', channel: 'whatsapp', channelIdentityRef: 'wa:abc' },
  }, {
    resolveAccess: async () => ({
      appId: 'musicscale',
      organizationId: 'org-1',
      accessible: false,
      isGlobalAccess: false,
      accessSource: 'denied',
      roles: [],
      permissions: [],
      decisionState: 'denied',
      denialReason: 'MEMBERSHIP_INACTIVE',
    }),
  });
  assert(response.statusCode === 403, 'current Hub app access is revalidated before delegation');
  assert(response.body.reason === 'MEMBERSHIP_INACTIVE', 'canonical denial reason is preserved');
}

{
  const { response, claims } = await call({
    headers: { 'X-Connect-Service-Authorization': 'Bearer service-token' },
    body: { uid: 'user-12345678', organizationId: 'org-1', channel: 'whatsapp', channelIdentityRef: 'wa:abc' },
  });
  assert(response.statusCode === 200, 'trusted Connect runtime can obtain short-lived actor delegation');
  assert(response.body.customToken === 'firebase-custom-token', 'custom token is returned only to the trusted runtime');
  assert(response.body.exchangeByMs === 1_700_000_300_000, 'delegation has a narrow exchange window');
  assert(claims?.appId === 'connect', 'custom token is marked for Connect');
  assert(claims?.delegatedChannel === 'whatsapp', 'delegation channel is explicit');
  assert(!Object.prototype.hasOwnProperty.call(claims || {}, 'organizationId'), 'tenant authority is never embedded in the token');
  assert(!Object.prototype.hasOwnProperty.call(claims || {}, 'role'), 'role authority is never embedded in the token');
  assert(!Object.prototype.hasOwnProperty.call(claims || {}, 'permissions'), 'permissions are never embedded in the token');
}

{
  const { response } = await call({
    headers: { 'x-connect-service-authorization': 'Bearer service-token' },
    body: { uid: 'user-12345678', organizationId: 'org-1', channel: 'whatsapp', channelIdentityRef: 'wa:abc' },
  }, {
    getDb: () => null,
  });
  assert(response.statusCode === 503, 'delegation fails closed when canonical Hub storage is unavailable');
}

console.log(`✅ Connect channel delegation: ${checks} checks passed.`);
