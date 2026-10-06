import assert from 'node:assert/strict';
import {
  handleConnectChannelGrantCreateRequest,
  handleConnectChannelSessionRequest,
} from '../src/server/services/ConnectChannelGrantService.js';

type Stored = Record<string, any>;

class MockDocRef {
  constructor(private path: string, private db: MockDb) {}
  collection(name: string) {
    return new MockCollection(`${this.path}/${name}`, this.db);
  }
  async get() {
    this.db.reads.push(this.path);
    const data = this.db.data[this.path];
    return { exists: data !== undefined, data: () => data };
  }
  async set(value: Stored) {
    this.db.writes.push(this.path);
    this.db.data[this.path] = JSON.parse(JSON.stringify(value));
  }
}

class MockCollection {
  constructor(private path: string, private db: MockDb) {}
  doc(id: string) {
    return new MockDocRef(`${this.path}/${id}`, this.db);
  }
}

class MockDb {
  data: Record<string, Stored> = {};
  reads: string[] = [];
  writes: string[] = [];
  collection(name: string) {
    return new MockCollection(name, this);
  }
}

class FakeResponse {
  statusCode = 200;
  body: any = null;
  headers: Record<string, string> = {};
  status(code: number) { this.statusCode = code; return this; }
  json(body: unknown) { this.body = body; return this; }
  setHeader(name: string, value: string) { this.headers[name.toLowerCase()] = value; }
}

const identityRef = 'a'.repeat(64);
const fixedNow = 1_800_000_000_000;

function setup(options: { systemRole?: string; membership?: Stored | null } = {}) {
  const db = new MockDb();
  const uid = 'channel-user-123456';
  const orgId = 'org-music-1';
  db.data[`users/${uid}`] = { status: 'active', systemRole: options.systemRole ?? 'user' };
  db.data[`organizations/${orgId}`] = { status: 'active', name: 'Igreja 1' };
  if (options.membership !== null) {
    db.data[`organizations/${orgId}/members/${uid}`] =
      options.membership ?? { status: 'active', role: 'member' };
  }
  return { db, uid, orgId };
}

function deps(db: MockDb, uid: string, onCustomToken?: (claims: Record<string, unknown>) => void) {
  return {
    verifyIdToken: async (token: string) => {
      assert.equal(token, 'firebase-id-token');
      return { uid };
    },
    getDb: () => db as any,
    createCustomToken: async (tokenUid: string, claims: Record<string, unknown> = {}) => {
      assert.equal(tokenUid, uid);
      onCustomToken?.(claims);
      return 'firebase-custom-channel-token';
    },
    now: () => fixedNow,
    randomBytes: () => Buffer.alloc(32, 7),
    logger: { info() {}, warn() {}, error() {} },
  };
}

async function createGrant(db: MockDb, uid: string, orgId: string) {
  const res = new FakeResponse();
  await handleConnectChannelGrantCreateRequest(
    {
      headers: { authorization: 'Bearer firebase-id-token' },
      body: { channel: 'whatsapp', channelIdentityRef: identityRef, organizationId: orgId },
    },
    res,
    deps(db, uid) as any,
  );
  return res;
}

console.log('--- Running Connect WhatsApp Channel Grant Tests ---');

{
  const { db, uid, orgId } = setup();
  const res = new FakeResponse();
  await handleConnectChannelGrantCreateRequest(
    {
      headers: {},
      body: { channel: 'whatsapp', channelIdentityRef: identityRef, organizationId: orgId },
    },
    res,
    deps(db, uid) as any,
  );
  assert.equal(res.statusCode, 401, 'channel link requires a real authenticated MillionsNest user');
  assert.equal(res.headers['cache-control'], 'no-store');
}

{
  const { db, uid, orgId } = setup();
  const res = await createGrant(db, uid, orgId);
  assert.equal(res.statusCode, 200, 'active organization member can create the opaque channel grant');
  assert.equal(res.body.success, true);
  assert.equal(res.body.grantRef, identityRef);
  assert.ok(typeof res.body.grantSecret === 'string' && res.body.grantSecret.length >= 32);

  const stored = db.data[`connect_channel_grants/${identityRef}`];
  assert.ok(stored, 'grant is persisted by opaque identity ref');
  assert.equal(stored.uid, uid);
  assert.equal(stored.organizationId, orgId);
  assert.equal(stored.channel, 'whatsapp');
  assert.equal(typeof stored.secretHash, 'string');
  assert.notEqual(stored.secretHash, res.body.grantSecret, 'Hub stores only a hash of the grant secret');
  assert.equal(Object.prototype.hasOwnProperty.call(stored, 'grantSecret'), false, 'raw grant secret is never persisted');
  assert.equal(JSON.stringify(stored).includes('+55'), false, 'raw phone data is not present in the grant');
}

{
  const { db, uid, orgId } = setup();
  const linked = await createGrant(db, uid, orgId);
  let claims: Record<string, unknown> = {};
  const res = new FakeResponse();
  await handleConnectChannelSessionRequest(
    {
      headers: {},
      body: { channel: 'whatsapp', grantRef: identityRef, grantSecret: linked.body.grantSecret },
    },
    res,
    deps(db, uid, (nextClaims) => { claims = nextClaims; }) as any,
  );
  assert.equal(res.statusCode, 200, 'valid Connect-held grant can mint a fresh identity session');
  assert.equal(res.body.organizationId, orgId);
  assert.equal(res.body.userId, uid);
  assert.equal(res.body.customToken, 'firebase-custom-channel-token');
  assert.equal(claims.appId, 'connect-channel');
  assert.equal(Object.prototype.hasOwnProperty.call(claims, 'organizationId'), false, 'custom token has no tenant authority');
  assert.equal(Object.prototype.hasOwnProperty.call(claims, 'role'), false, 'custom token has no role authority');
  assert.equal(Object.prototype.hasOwnProperty.call(claims, 'permissions'), false, 'custom token has no permission authority');
}

{
  const { db, uid, orgId } = setup();
  await createGrant(db, uid, orgId);
  const res = new FakeResponse();
  await handleConnectChannelSessionRequest(
    {
      headers: {},
      body: { channel: 'whatsapp', grantRef: identityRef, grantSecret: 'x'.repeat(43) },
    },
    res,
    deps(db, uid) as any,
  );
  assert.equal(res.statusCode, 401, 'wrong channel secret is rejected without revealing grant details');
  assert.equal(res.body.code, 'CHANNEL_GRANT_INVALID');
}

{
  const { db, uid, orgId } = setup();
  const linked = await createGrant(db, uid, orgId);
  db.data[`organizations/${orgId}/members/${uid}`].status = 'removed';
  const res = new FakeResponse();
  await handleConnectChannelSessionRequest(
    {
      headers: {},
      body: { channel: 'whatsapp', grantRef: identityRef, grantSecret: linked.body.grantSecret },
    },
    res,
    deps(db, uid) as any,
  );
  assert.equal(res.statusCode, 403, 'membership is revalidated for every channel session');
  assert.equal(res.body.reason, 'MEMBERSHIP_REQUIRED');
}

{
  const { db, uid, orgId } = setup({ membership: null, systemRole: 'ceo' });
  const res = await createGrant(db, uid, orgId);
  assert.equal(res.statusCode, 200, 'canonical global access can link without a local membership');
}

{
  const { db, uid, orgId } = setup();
  const res = new FakeResponse();
  await handleConnectChannelGrantCreateRequest(
    {
      headers: { authorization: 'Bearer firebase-id-token' },
      body: { channel: 'whatsapp', channelIdentityRef: '+5543999999999', organizationId: orgId },
    },
    res,
    deps(db, uid) as any,
  );
  assert.equal(res.statusCode, 400, 'raw provider identifiers cannot be used as the channel identity ref');
}

console.log('✅ Connect WhatsApp channel grants preserve identity-only, tenant-safe authorization.');
