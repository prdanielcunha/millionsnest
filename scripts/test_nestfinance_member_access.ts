import assert from 'node:assert/strict';
import { clearInvitationEmulator, requireInvitationEmulator } from './helpers/p0HandlerTestHarness.js';
import { financePermissionsForAccess, nestFinanceMemberAccess, projectFinanceMemberAccess, type FinanceMemberAccess } from '../src/server/services/NestFinanceMemberAccessCommandService.js';

const db = requireInvitationEmulator();
const access: FinanceMemberAccess = { enabled: true, count: true, register: false, review: false, approve: false, balance: false, manage: false };
const deps = { getFirestore: () => db, verifyIdToken: async (token: string) => {
  if (token === 'invalid') throw Error('INVALID'); return { uid: token };
} };
async function call(actor = 'owner', method = 'PATCH', body: any = { access, expectedRevision: 0, reason: 'team_setup' }, organizationId = 'finance-test', memberId = 'target') {
  let status = 200, data: any;
  await nestFinanceMemberAccess({ method, headers: actor ? { authorization: `Bearer ${actor}` } : {}, params: { organizationId, memberId }, body } as any,
    { setHeader() {}, status(code: number) { status = code; return this; }, json(value: any) { data = value; return this; } } as any, deps);
  return { status, data };
}
async function seed() {
  await clearInvitationEmulator();
  await db.doc('organizations/finance-test').set({ status: 'active', ownerUid: 'owner', enabledApps: ['nestfinance'], entitlements: { nestfinance: { active: true } } });
  for (const uid of ['owner', 'target', 'manager', 'global', 'support']) {
    await db.doc(`users/${uid}`).set({ status: 'active', systemRole: uid === 'global' ? 'ceo' : uid === 'support' ? 'ecosystem_support' : 'user', ecosystemSessionVersion: 4 });
    await db.doc(`organizations/finance-test/members/${uid}`).set({ status: 'active', role: uid === 'owner' ? 'owner' : 'member',
      permissions: { 'organization.roles.manage': uid === 'manager' },
      appAccess: { nestFinance: { enabled: true, roles: ['conferente'], permissions: uid === 'owner' ? ['finance.manage'] : ['finance.view'], scopes: { financeEntityIds: ['church-a'] } }, nestjourney: { enabled: true, permissions: ['kept'] } } });
  }
}
await seed();
for (const grants of [
  ['finance.view', 'finance.create_drafts', 'finance.count.execute', 'finance.balance.view'],
  ['finance.view', 'finance.create_drafts', 'finance.balance.view'],
]) {
  const member = { role: 'member', appAccess: { nestFinance: { enabled: true, roles: ['conferente'], permissions: grants, scopes: { financeEntityIds: ['church-a'] } } } };
  const projected = projectFinanceMemberAccess(member);
  assert.equal(projected.count, true);
  assert.equal(projected.register, false);
  assert.equal(projected.balance, false);
  await db.doc('organizations/finance-test/members/target').set(member);
  const read = await call('owner', 'GET');
  assert.equal(read.status, 200);
  assert.equal((read.data.access as FinanceMemberAccess).register, false);
  const unchanged = await call('owner', 'PATCH', { access: read.data.access, expectedRevision: read.data.revision, reason: 'team_setup' });
  assert.equal(unchanged.status, 200);
  const savedGrants = (await db.doc('organizations/finance-test/members/target').get()).data()!.appAccess.nestFinance.permissions;
  assert(!savedGrants.includes('finance.create_drafts'));
  assert(!savedGrants.includes('finance.treasury.view'));
  assert(!savedGrants.includes('finance.balance.view'));
}
await seed();
assert.equal((await call('')).status, 401);
assert.equal((await call('invalid')).status, 401);
assert.equal((await call('owner', 'POST')).status, 405);
assert.equal((await call('manager')).status, 403, 'Team management cannot grant financial access');
assert.equal((await call('support')).status, 403);
assert.equal((await call('owner', 'PATCH', undefined, 'another-org')).status, 403);
assert.equal((await call('owner', 'PATCH', undefined, 'finance-test', '../target')).status, 400);
assert.equal((await call('owner', 'PATCH', { access: { ...access, evil: true }, expectedRevision: 0, reason: 'team_setup' })).status, 400);
assert.equal((await call('owner', 'PATCH', { access, expectedRevision: 0, reason: 'unknown' })).status, 400);
assert.equal((await call('owner', 'PATCH', { access, expectedRevision: 0, reason: 'team_setup', role: 'owner' })).status, 400);
const before = (await db.doc('organizations/finance-test/members/target').get()).data()!;
let result = await call('owner', 'GET');
assert.equal(result.status, 200); assert.equal(result.data.editable, true); assert.equal(result.data.revision, 0);
assert.deepEqual((await db.doc('organizations/finance-test/members/target').get()).data(), before, 'GET never migrates data');
result = await call(); assert.equal(result.status, 200); assert.equal(result.data.revision, 1);
const after = (await db.doc('organizations/finance-test/members/target').get()).data()!;
assert.deepEqual(after.appAccess.nestFinance.permissions, financePermissionsForAccess(access));
assert(!after.appAccess.nestFinance.permissions.includes('finance.create_drafts'), 'Count must not receive generic drafts');
assert(!after.appAccess.nestFinance.permissions.includes('finance.balance.view'));
assert.deepEqual(after.appAccess.nestFinance.scopes, before.appAccess.nestFinance.scopes);
assert.deepEqual(after.appAccess.nestFinance.roles, before.appAccess.nestFinance.roles);
assert.deepEqual(after.appAccess.nestjourney, before.appAccess.nestjourney);
assert.deepEqual(after.permissions, before.permissions);
assert.equal((await db.doc('users/target').get()).data()!.ecosystemSessionVersion, 5);
assert.equal((await db.collection('organizations/finance-test/audit_logs').get()).size, 1);
assert.equal((await call()).status, 409, 'Stale update cannot overwrite another administrator');
assert.equal((await db.collection('organizations/finance-test/audit_logs').get()).size, 1);
assert.equal((await call('owner', 'PATCH', undefined, 'finance-test', 'owner')).status, 403, 'Self edit denied');
assert.equal((await call('owner', 'PATCH', undefined, 'finance-test', 'global')).status, 403, 'Global authority cannot be falsely restricted');
assert.equal((await call('global', 'PATCH', undefined, 'finance-test', 'owner')).status, 200);
await seed();
await db.doc('organizations/finance-test/members/manager').set({ status: 'active', role: 'admin', appAccess: { nestFinance: { enabled: true, permissions: ['finance.view', 'finance.create_drafts', 'finance.count.execute'] } } });
assert.equal((await call('manager')).status, 403, 'Count-only admin cannot grant broader access');
await db.doc('organizations/finance-test/members/owner').update({ 'appAccess.nestFinance.scopes.financeEntityIds': ['church-b'] });
assert.equal((await call()).status, 403, 'Scoped admin cannot widen another church entity');
await seed();
await db.doc('users/owner').update({ disabled: true });
assert.equal((await call()).status, 403, 'Disabled users cannot manage permissions');
await seed();
await db.doc('organizations/finance-test').update({ 'entitlements.nestfinance.active': false });
assert.equal((await call('global')).status, 403, 'Editor never provisions entitlements');
await seed();
await db.doc('organizations/finance-test/members/target').update({ enabled: false });
assert.equal((await call()).status, 403);
await seed();
result = await call('owner', 'PATCH', { access: { ...access, count: false, enabled: false }, expectedRevision: 0, reason: 'access_removed' });
assert.equal(result.status, 200);
assert.deepEqual((await db.doc('organizations/finance-test/members/target').get()).data()!.appAccess.nestFinance.permissions, ['finance.access.individual_v1']);
console.log('PASS: real Firestore transaction, strict request, authorization, scope, audit, session revocation, concurrency and preservation checks');
