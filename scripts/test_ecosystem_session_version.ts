import assert from 'node:assert/strict';
import {
  normalizeEcosystemSessionVersion,
  nextEcosystemSessionVersion,
  readCanonicalEcosystemSessionVersion,
  revokeCurrentEcosystemSession,
} from '../src/server/services/EcosystemSessionVersionService.js';

class MockDoc {
  constructor(
    readonly path: string,
    private readonly db: MockDb,
  ) {}

  async get() {
    const value = this.db.data[this.path];
    return {
      exists: value !== undefined,
      data: () => value,
    };
  }
}

class MockCollection {
  constructor(
    private readonly path: string,
    private readonly db: MockDb,
  ) {}

  doc(id?: string) {
    return new MockDoc(
      `${this.path}/${id || 'generated-event'}`,
      this.db,
    );
  }
}

class MockDb {
  writes: Array<{ path: string; data: Record<string, unknown>; merge: boolean }> = [];

  constructor(public data: Record<string, any>) {}

  collection(path: string) {
    return new MockCollection(path, this);
  }

  async runTransaction<T>(callback: (transaction: any) => Promise<T>): Promise<T> {
    const transaction = {
      get: async (ref: MockDoc) => ref.get(),
      set: (ref: MockDoc, patch: Record<string, unknown>, options?: { merge?: boolean }) => {
        const merge = options?.merge === true;
        const previous = this.data[ref.path] || {};
        this.data[ref.path] = merge ? { ...previous, ...patch } : { ...patch };
        this.writes.push({ path: ref.path, data: patch, merge });
      },
    };
    return callback(transaction);
  }
}

class MockResponse {
  statusCode = 200;
  body: any = null;
  headers: Record<string, string> = {};

  setHeader(name: string, value: string) {
    this.headers[name.toLowerCase()] = value;
  }

  status(code: number) {
    this.statusCode = code;
    return this;
  }

  json(body: unknown) {
    this.body = body;
    return this;
  }
}

assert.equal(normalizeEcosystemSessionVersion(undefined), 1);
assert.equal(normalizeEcosystemSessionVersion(0), 1);
assert.equal(normalizeEcosystemSessionVersion(7), 7);
assert.equal(nextEcosystemSessionVersion(undefined), 2);
assert.equal(nextEcosystemSessionVersion(7), 8);

const uid = 'session-user';
const db = new MockDb({
  [`users/${uid}`]: {
    uid,
    ecosystemSessionVersion: 7,
  },
});

assert.equal(
  await readCanonicalEcosystemSessionVersion(db as any, uid),
  7,
);

const response = new MockResponse();
await revokeCurrentEcosystemSession(
  {
    method: 'POST',
    headers: { authorization: 'Bearer valid-id-token' },
  } as any,
  response as any,
  {
    verifyIdToken: async () => ({ uid }),
    getFirestore: () => db as any,
  },
);

assert.equal(response.statusCode, 200);
assert.equal(response.body.success, true);
assert.equal(response.body.sessionVersion, 8);
assert.equal(db.data[`users/${uid}`].ecosystemSessionVersion, 8);

const eventWrite = db.writes.find(write => write.path === 'ecosystemSessionEvents/generated-event');
assert.ok(eventWrite, 'revocation must write a durable ecosystem session event');
assert.equal(eventWrite!.data.eventType, 'ecosystem.session.revoked');
assert.equal(eventWrite!.data.previousSessionVersion, 7);
assert.equal(eventWrite!.data.sessionVersion, 8);

const unauthenticated = new MockResponse();
await revokeCurrentEcosystemSession(
  { method: 'POST', headers: {} } as any,
  unauthenticated as any,
  {
    verifyIdToken: async () => ({ uid }),
    getFirestore: () => db as any,
  },
);
assert.equal(unauthenticated.statusCode, 401);

console.log('✅ Ecosystem session version and coordinated logout revocation contract are certified.');
