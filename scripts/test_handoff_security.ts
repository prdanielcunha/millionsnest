import assert from 'node:assert/strict';
import {
  enforceHandoffRateLimit,
  resolveAllowedHandoffOrigins,
  validateHandoffOrigin,
} from '../src/server/services/HandoffSecurityService.js';

class MockDoc {
  constructor(readonly path: string, private readonly data: Record<string, any>) {}
  async get() {
    const value = this.data[this.path];
    return { exists: value !== undefined, data: () => value };
  }
}

class MockCollection {
  constructor(private readonly path: string, private readonly data: Record<string, any>) {}
  doc(id: string) { return new MockDoc(this.path + '/' + id, this.data); }
}

class MockDb {
  constructor(readonly data: Record<string, any> = {}) {}
  collection(path: string) { return new MockCollection(path, this.data); }
  async runTransaction<T>(callback: (tx: any) => Promise<T>): Promise<T> {
    return callback({
      get: (ref: MockDoc) => ref.get(),
      set: (ref: MockDoc, value: Record<string, unknown>, options?: { merge?: boolean }) => {
        const previous = this.data[ref.path] || {};
        this.data[ref.path] = options?.merge ? { ...previous, ...value } : value;
      },
    });
  }
}

const productionOrigins = resolveAllowedHandoffOrigins({
  NODE_ENV: 'production',
} as NodeJS.ProcessEnv);
assert.equal(productionOrigins.has('https://www.millionsnest.com'), true);
assert.equal(productionOrigins.has('https://millionsnest.com'), true);
assert.equal(productionOrigins.has('http://localhost:5173'), false);

assert.deepEqual(
  validateHandoffOrigin('https://www.millionsnest.com', { NODE_ENV: 'production' } as NodeJS.ProcessEnv),
  { allowed: true, origin: 'https://www.millionsnest.com' },
);
assert.equal(
  validateHandoffOrigin('https://evil.example', { NODE_ENV: 'production' } as NodeJS.ProcessEnv).allowed,
  false,
);
assert.deepEqual(
  validateHandoffOrigin(undefined, { NODE_ENV: 'production' } as NodeJS.ProcessEnv),
  { allowed: true, origin: null },
);

const db = new MockDb();
const input = {
  db: db as any,
  scope: 'ecosystem_handoff_issue',
  uid: 'user-1',
  appId: 'nestfinance',
  organizationId: 'org-1',
  nowMs: 1_800_000_000_000,
  limit: 2,
  windowMs: 60_000,
};

const first = await enforceHandoffRateLimit(input);
const second = await enforceHandoffRateLimit(input);
const third = await enforceHandoffRateLimit(input);

assert.equal(first.allowed, true);
assert.equal(second.allowed, true);
assert.equal(third.allowed, false);
if (!third.allowed) assert.ok(third.retryAfterSeconds >= 1);

const nextWindow = await enforceHandoffRateLimit({
  ...input,
  nowMs: input.nowMs + 60_001,
});
assert.equal(nextWindow.allowed, true);

console.log('✅ Handoff security origin allowlist and durable fixed-window rate limit are certified.');
