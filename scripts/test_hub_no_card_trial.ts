import assert from 'node:assert/strict';
import {
  HUB_TRIAL_DURATION_MS, shouldAddStripeTrial, hasConsumedHubTrial,
  activateNestLocalHubTrial, nestLocalTrialEnabledForOrganization,
} from '../src/server/services/HubNoCardTrialService.js';

assert.equal(HUB_TRIAL_DURATION_MS, 168 * 60 * 60 * 1000);
assert.equal(nestLocalTrialEnabledForOrganization('org-a', {}), false);
assert.equal(nestLocalTrialEnabledForOrganization('org-a', { NESTLOCAL_INTERNAL_TRIAL_ENABLED:'true' }), false);
assert.equal(nestLocalTrialEnabledForOrganization('org-a', {
  NESTLOCAL_INTERNAL_TRIAL_ENABLED:'true',NESTLOCAL_INTERNAL_TRIAL_PILOT_ORGS:'org-b,org-a',
}), true);
assert.equal(nestLocalTrialEnabledForOrganization('org-c', {
  NESTLOCAL_INTERNAL_TRIAL_ENABLED:'true',NESTLOCAL_INTERNAL_TRIAL_PILOT_ORGS:'org-b,org-a',
}), false);
assert.equal(nestLocalTrialEnabledForOrganization('org-c', {
  NESTLOCAL_INTERNAL_TRIAL_ENABLED:'true',NESTLOCAL_INTERNAL_TRIAL_PUBLIC_ENABLED:'true',
}), true);

const legacyMusicScale = {
  appId: 'musicscale' as const, hasLegacyTrialHistory: false,
  internalTrialConsumed: false, newNestLocalTrialEnabled: true,
};
assert.equal(shouldAddStripeTrial(legacyMusicScale), true);
assert.equal(shouldAddStripeTrial({ ...legacyMusicScale, hasLegacyTrialHistory: true }), false);
const newNestLocal = { ...legacyMusicScale, appId: 'nestlocal' as const };
assert.equal(shouldAddStripeTrial(newNestLocal), false);
assert.equal(shouldAddStripeTrial({ ...newNestLocal, newNestLocalTrialEnabled: false }), true);
assert.equal(shouldAddStripeTrial({ ...newNestLocal, newNestLocalTrialEnabled: false, internalTrialConsumed: true }), false);

// Firestore-shaped transaction fake: prove idempotency and the eligibility vetoes.
// Firestore production handles actual concurrent retries atomically.
class FakeFirestore {
  docs = new Map<string, any>();
  ref(path: string): any {
    return {
      path,
      get: async () => this.read(path),
      doc: (id: string) => this.ref(path + '/' + id),
      collection: (id: string) => this.ref(path + '/' + id),
    };
  }
  collection(name: string): any { return this.ref(name); }
  read(path: string): any {
    const data = this.docs.get(path);
    return { exists: data !== undefined, data: () => data };
  }
  async runTransaction<T>(action: (tx: any) => Promise<T>): Promise<T> {
    const writes: { op: 'create'|'set'|'update'; path: string; data: any }[] = [];
    const tx = {
      get: async (ref: any) => this.read(ref.path),
      create: (ref: any, data: any) => writes.push({op:'create',path:ref.path,data}),
      set: (ref: any, data: any) => writes.push({op:'set',path:ref.path,data}),
      update: (ref: any, data: any) => writes.push({op:'update',path:ref.path,data}),
    };
    const result = await action(tx);
    for (const write of writes) {
      if (write.op === 'create' && this.docs.has(write.path)) throw Error('ALREADY_EXISTS');
    }
    for (const write of writes) {
      this.docs.set(write.path, { ...(this.docs.get(write.path) || {}), ...write.data });
    }
    return result;
  }
}
const start = Date.parse('2026-10-08T13:00:00.000Z');
const db = new FakeFirestore();
db.docs.set('organizations/org-1', { status:'active', apps:{} });
const created = await activateNestLocalHubTrial({
  db: db as any, organizationId:'org-1', ownerUid:'owner-1',
  stripeHistoricalClear:true, nowMs:start,
});
assert.equal(created.status, 'created');
assert.equal(Date.parse(created.expiresAt)-Date.parse(created.startsAt), HUB_TRIAL_DURATION_MS);
assert.equal(await hasConsumedHubTrial(db as any, 'org-1','nestlocal'), true);
assert.equal(await hasConsumedHubTrial(db as any, 'org-1','musicscale'), false);
assert.equal(db.docs.get('nestlocal_internal_trials/org-1')?.grantVersion, 2);
assert.equal(db.docs.get('organizations/org-1/app_entitlements/nestlocal')?.schemaVersion, 3);
const sameOwnerReload = await activateNestLocalHubTrial({
  db:db as any, organizationId:'org-1', ownerUid:'owner-1', stripeHistoricalClear:true, nowMs:start+1000,
});
assert.equal(sameOwnerReload.status, 'already_active');
assert.equal(sameOwnerReload.expiresAt, created.expiresAt);
await assert.rejects(
  activateNestLocalHubTrial({ db:db as any, organizationId:'org-1',
    ownerUid:'owner-1', stripeHistoricalClear:true, nowMs:start+HUB_TRIAL_DURATION_MS }),
  { code:'TRIAL_ALREADY_CONSUMED' },
);
db.docs.set('organizations/org-2', {status:'active'});
await assert.rejects(
  activateNestLocalHubTrial({ db:db as any, organizationId:'org-2',
    ownerUid:'owner-1', stripeHistoricalClear:true, nowMs:start }),
  { code:'OWNER_TRIAL_ALREADY_CONSUMED' },
);
db.docs.set('organizations/org-3', {status:'active'});
db.docs.set('subscriptions/org-3', { apps: {nestlocal:{status:'canceled'}} });
await assert.rejects(
  activateNestLocalHubTrial({ db:db as any, organizationId:'org-3',
    ownerUid:'owner-3', stripeHistoricalClear:true, nowMs:start }),
  { code:'PRIOR_NESTLOCAL_SUBSCRIPTION' },
);
db.docs.set('organizations/org-4', {status:'active'});
await assert.rejects(
  activateNestLocalHubTrial({ db:db as any, organizationId:'org-4',
    ownerUid:'owner-4', stripeHistoricalClear:false, nowMs:start }),
  { code:'PRIOR_SUBSCRIPTION_OR_STRIPE_UNVERIFIED' },
);
console.log('PASS Hub no-card trial: 168h, idempotency, history, owner, MusicScale and checkout guards');
