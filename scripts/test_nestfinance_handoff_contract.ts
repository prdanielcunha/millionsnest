import assert from 'node:assert/strict';
import { handleMusicScaleHandoffRequest } from '../src/server/services/MusicScaleHandoffService.js';

class MockDoc {
  constructor(
    readonly path: string,
    private readonly data: Record<string, any>,
  ) {}

  async get() {
    const value = this.data[this.path];
    return {
      exists: value !== undefined && value !== null,
      data: () => value ?? undefined,
    };
  }

  async set(value: Record<string, unknown>, options?: { merge?: boolean }) {
    const previous = this.data[this.path] || {};
    this.data[this.path] = options?.merge ? { ...previous, ...value } : value;
  }
}

class MockCollection {
  private static sequence = 0;

  constructor(
    private readonly path: string,
    private readonly data: Record<string, any>,
  ) {}

  doc(id?: string) {
    const resolvedId = id || 'generated-' + (++MockCollection.sequence);
    return new MockDoc(this.path + '/' + resolvedId, this.data);
  }
}

class MockDb {
  constructor(readonly data: Record<string, any>) {}

  collection(path: string) {
    return new MockCollection(path, this.data);
  }

  async runTransaction<T>(callback: (tx: any) => Promise<T>): Promise<T> {
    const tx = {
      get: (ref: MockDoc) => ref.get(),
      set: (ref: MockDoc, value: Record<string, unknown>, options?: { merge?: boolean }) =>
        ref.set(value, options),
    };
    return callback(tx);
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
    ecosystemSessionVersion: 7,
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
    headers: {
      authorization: 'Bearer valid-hub-id-token',
      origin: 'https://www.millionsnest.com',
    },
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
assert.equal(response.headers['access-control-allow-origin'], 'https://www.millionsnest.com');
assert.equal(response.headers['vary'], 'Origin');
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
assert.equal(capturedClaims!.mn_session_version, 7);

for (const forbidden of ['role', 'permissions', 'scopes']) {
  assert.equal(
    Object.prototype.hasOwnProperty.call(capturedClaims!, forbidden),
    false,
    'handoff token must not carry mutable RBAC payload: ' + forbidden,
  );
}


const auditEntries = Object.entries(db.data)
  .filter(([path]) => path.startsWith('ecosystemHandoffAudit/'))
  .map(([, value]) => value as any);
assert.ok(
  auditEntries.some(event =>
    event.eventType === 'handoff.issued' &&
    event.appId === 'nestfinance' &&
    event.organizationId === orgId &&
    event.protocol === 'ecosystem_ctx'
  ),
  'successful handoff issuance must write a durable sanitized audit event',
);

const wrongOriginResponse = new MockResponse();
await handleMusicScaleHandoffRequest(
  {
    headers: {
      authorization: 'Bearer valid-hub-id-token',
      origin: 'https://evil.example',
    },
    body: { appId: 'nestfinance', orgId },
  },
  wrongOriginResponse,
  {
    verifyIdToken: async () => ({ uid }),
    getDb: () => db as any,
    createCustomToken: async () => {
      throw new Error('token must not be minted for rejected origin');
    },
    now: () => 1_800_000_000_100,
    logger: { info() {}, warn() {}, error() {} },
  },
);
assert.equal(wrongOriginResponse.statusCode, 403);
assert.equal(wrongOriginResponse.body.code, 'ORIGIN_NOT_ALLOWED');

console.log('✅ NestFinance Hub handoff claims, origin policy, durable rate-limit path and audit contract are aligned.');
