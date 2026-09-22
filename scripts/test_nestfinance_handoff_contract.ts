import assert from 'node:assert/strict';
import { handleMusicScaleHandoffRequest } from '../src/server/services/MusicScaleHandoffService.js';

class MockDoc {
  constructor(
    private readonly path: string,
    private readonly data: Record<string, unknown>,
  ) {}

  async get() {
    const value = this.data[this.path];
    return {
      exists: value !== undefined && value !== null,
      data: () => value ?? undefined,
    };
  }
}

class MockCollection {
  constructor(
    private readonly path: string,
    private readonly data: Record<string, unknown>,
  ) {}

  doc(id: string) {
    return new MockDoc(this.path + '/' + id, this.data);
  }
}

class MockDb {
  constructor(private readonly data: Record<string, unknown>) {}

  collection(path: string) {
    return new MockCollection(path, this.data);
  }
}

class MockResponse {
  statusCode = 200;
  body: any = null;
  headers: Record<string, string> = {};

  status(code: number) {
    this.statusCode = code;
    return this;
  }

  json(body: unknown) {
    this.body = body;
    return this;
  }

  setHeader(name: string, value: string) {
    this.headers[name.toLowerCase()] = value;
  }
}

const uid = 'ceo-user';
const orgId = 'org-nestfinance';
const db = new MockDb({
  ['users/' + uid]: {
    status: 'active',
    systemRole: 'ceo',
  },
  ['organizations/' + orgId]: {
    status: 'active',
    name: 'NestFinance Contract Test',
  },
});

const response = new MockResponse();
let capturedClaims: Record<string, unknown> | null = null;

await handleMusicScaleHandoffRequest(
  {
    headers: { authorization: 'Bearer valid-hub-id-token' },
    body: { appId: 'nestfinance', orgId },
  },
  response,
  {
    verifyIdToken: async () => ({ uid }),
    getDb: () => db as any,
    createCustomToken: async (tokenUid, claims) => {
      assert.equal(tokenUid, uid);
      capturedClaims = claims;
      return 'nestfinance-custom-token';
    },
    now: () => 1_800_000_000_000,
    logger: { info() {}, warn() {}, error() {} },
  },
);

assert.equal(response.statusCode, 200);
assert.equal(response.headers['cache-control'], 'no-store');
assert.equal(response.body.appId, 'nestfinance');
assert.equal(response.body.orgId, orgId);
assert.equal(response.body.uid, uid);
assert.equal(response.body.protocolVersion, '1.0.0');
assert.equal(response.body.customToken, 'nestfinance-custom-token');

assert.ok(capturedClaims);
assert.equal(capturedClaims!.appId, 'nestfinance');
assert.equal(capturedClaims!.orgId, orgId);
assert.equal(capturedClaims!.supportMode, false);

assert.equal(capturedClaims!.mn_app_id, 'nestfinance');
assert.equal(capturedClaims!.mn_organization_id, orgId);
assert.equal(capturedClaims!.mn_handoff_version, 1);
assert.equal(capturedClaims!.mn_access_source, 'global_system_role');

for (const forbidden of ['role', 'permissions', 'scopes']) {
  assert.equal(
    Object.prototype.hasOwnProperty.call(capturedClaims!, forbidden),
    false,
    'handoff token must not carry mutable RBAC payload: ' + forbidden,
  );
}

console.log('✅ NestFinance Hub handoff claim contract is aligned with the strict NestFinance resolver.');
