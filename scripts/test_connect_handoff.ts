import { handleConnectHandoffRequest } from '../src/server/services/ConnectHandoffService.js';
import { handleMusicScaleHandoffRequest } from '../src/server/services/MusicScaleHandoffService.js';
import { openEcosystemModule } from '../src/lib/ecosystemLauncher.js';

let checks = 0;
function assert(condition: unknown, message: string) {
  checks++;
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

class MockDocRef {
  constructor(private path: string, private db: MockDb) {}
  collection(name: string) {
    return new MockCollection(`${this.path}/${name}`, this.db);
  }
  async get() {
    this.db.reads.push(this.path);
    const data = this.db.data[this.path];
    return {
      exists: data !== undefined && data !== null,
      data: () => data ?? undefined,
    };
  }
}

class MockCollection {
  constructor(private path: string, private db: MockDb) {}
  doc(id: string) {
    return new MockDocRef(`${this.path}/${id}`, this.db);
  }
}

class MockDb {
  data: Record<string, any> = {};
  reads: string[] = [];
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

function standardDb(options: { uid?: string; orgId?: string; systemRole?: string; membership?: any } = {}) {
  const uid = options.uid ?? 'user-12345678';
  const orgId = options.orgId ?? 'org-1';
  const db = new MockDb();
  db.data[`users/${uid}`] = { status: 'active', systemRole: options.systemRole ?? 'user' };
  db.data[`organizations/${orgId}`] = { status: 'active', name: 'Org 1' };
  if (options.membership !== null) {
    db.data[`organizations/${orgId}/members/${uid}`] = options.membership ?? { status: 'active', role: 'member' };
  }
  return { db, uid, orgId };
}

async function execute(
  handler: typeof handleConnectHandoffRequest | typeof handleMusicScaleHandoffRequest,
  init: { authorization?: string; body?: any },
  db: MockDb | null,
  uid = 'user-12345678',
) {
  const res = new FakeResponse();
  let tokenClaims: Record<string, unknown> | undefined;
  await handler(
    { headers: init.authorization ? { authorization: init.authorization } : {}, body: init.body } as any,
    res as any,
    {
      verifyIdToken: async () => ({ uid }),
      getDb: () => db as any,
      createCustomToken: async (_uid: string, claims: Record<string, unknown>) => {
        tokenClaims = claims;
        return 'custom-connect-token';
      },
      now: () => 1_700_000_000_000,
      logger: { info() {}, warn() {}, error() {} },
    } as any,
  );
  return { res, tokenClaims };
}

console.log('--- Running Connect Handoff Tests ---');

{
  const { res } = await execute(handleConnectHandoffRequest, { body: { appId: 'connect', orgId: 'org-1' } }, null);
  assert(res.statusCode === 401, 'missing bearer fails closed');
  assert(res.headers['cache-control'] === 'no-store', 'handoff is never cacheable');
}

{
  const { db, uid, orgId } = standardDb();
  const { res, tokenClaims } = await execute(
    handleConnectHandoffRequest,
    { authorization: 'Bearer valid-token', body: { appId: 'connect', orgId } },
    db,
    uid,
  );
  assert(res.statusCode === 200, 'active organization member receives handoff');
  assert(res.body.appId === 'connect', 'handoff is bound to Connect');
  assert(res.body.orgId === orgId && res.body.uid === uid, 'response preserves requested actor/org hints');
  assert(tokenClaims?.appId === 'connect', 'custom token is app-marked');
  assert(!Object.prototype.hasOwnProperty.call(tokenClaims || {}, 'orgId'), 'custom token does not carry tenant authority');
  assert(!Object.prototype.hasOwnProperty.call(tokenClaims || {}, 'role'), 'custom token does not carry role authority');
  assert(!Object.prototype.hasOwnProperty.call(tokenClaims || {}, 'permissions'), 'custom token does not carry permission authority');
}

{
  const { db, uid, orgId } = standardDb({ membership: null });
  const { res } = await execute(
    handleConnectHandoffRequest,
    { authorization: 'Bearer valid-token', body: { appId: 'connect', orgId } },
    db,
    uid,
  );
  assert(res.statusCode === 403 && res.body.reason === 'MEMBERSHIP_REQUIRED', 'ordinary user cannot handoff into another tenant');
}

{
  const { db, uid, orgId } = standardDb({ membership: null, systemRole: 'ceo' });
  const { res } = await execute(
    handleConnectHandoffRequest,
    { authorization: 'Bearer valid-token', body: { appId: 'connect', orgId } },
    db,
    uid,
  );
  assert(res.statusCode === 200, 'canonical global role can handoff without local membership');
}

{
  const { db, uid, orgId } = standardDb();
  const { res } = await execute(
    handleConnectHandoffRequest,
    { authorization: 'Bearer valid-token', body: { appId: 'connect', orgId, supportMode: true } },
    db,
    uid,
  );
  assert(res.statusCode === 403 && res.body.code === 'SUPPORT_MODE_FORBIDDEN', 'support mode is never granted from a local membership');
}

{
  const { db, uid, orgId } = standardDb();
  const { res } = await execute(
    handleMusicScaleHandoffRequest,
    { authorization: 'Bearer valid-token', body: { appId: 'connect', orgId } },
    db,
    uid,
  );
  assert(res.statusCode === 200 && res.body.appId === 'connect', 'existing /create-handoff handler safely delegates Connect');
}

{
  let assignedUrl = '';
  const now = 1_700_000_000_000;
  await openEcosystemModule(
    'connect',
    { uid: 'user-12345678' },
    { systemRole: 'user' },
    { id: 'org-1' },
    {},
    {
      loadApps: async () => [{ id: 'connect', url: 'https://connect.example/start' }],
      getIdToken: async () => 'firebase-id-token',
      fetchFn: async (_input: any, init?: any) => {
        const sent = JSON.parse(String(init?.body || '{}'));
        assert(sent.appId === 'connect' && sent.orgId === 'org-1', 'launcher requests Connect handoff for selected tenant');
        return new Response(JSON.stringify({
          appId: 'connect',
          protocolVersion: '1.0.0',
          customToken: 'connect-custom-token',
          orgId: 'org-1',
          uid: 'user-12345678',
          expiresAt: now + 300_000,
          supportMode: false,
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      },
      sleep: async () => {},
      assign: (url) => { assignedUrl = url; },
      now: () => now,
      readSupportSession: () => null,
      markPerformance: () => {},
    },
  );
  const target = new URL(assignedUrl);
  const encoded = target.searchParams.get('ecosystem_ctx');
  assert(Boolean(encoded), 'launcher transfers a one-time ecosystem context');
  const payload = JSON.parse(atob(encoded!));
  assert(payload.appId === 'connect' && payload.orgId === 'org-1', 'launcher context is Connect + tenant bound');
}

console.log(`✅ Connect handoff passed ${checks} checks.`);
