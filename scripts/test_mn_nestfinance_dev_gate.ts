import { resolveEcosystemAppAccess, DENIAL_REASONS } from '../src/server/services/EcosystemAccessResolver.js';
import { canAccessNestFinanceDevelopment } from '../src/lib/permissionService.js';

let passed = 0;
let failed = 0;
let assertions = 0;

function assert(condition: boolean, message: string) {
  assertions++;
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`[FAIL] ${message}`);
  }
}

class MockDoc {
  constructor(public id: string, public dataObj: any) {}
  get exists() { return !!this.dataObj; }
  data() { return this.dataObj; }
}

class MockFirestore {
  collections: Record<string, any> = {
    users: {},
    organizations: {},
    subscriptions: {}
  };

  collection(path: string) {
    if (path.startsWith('organizations/') && path.endsWith('/members')) {
      const orgId = path.split('/')[1];
      if (!this.collections.members) this.collections.members = {};
      if (!this.collections.members[orgId]) this.collections.members[orgId] = {};
      return {
        doc: (id: string) => ({ get: async () => new MockDoc(id, this.collections.members[orgId][id]) })
      };
    }

    if (!this.collections[path]) this.collections[path] = {};
    return {
      doc: (id: string) => ({ get: async () => new MockDoc(id, this.collections[path][id]) })
    };
  }
}

async function runTests() {
  console.log('--- TEST MN NESTFINANCE DEV GATE ---');

  // Test canAccessNestFinanceDevelopment
  assert(canAccessNestFinanceDevelopment('ceo'), 'ceo permitido');
  assert(canAccessNestFinanceDevelopment('global_admin'), 'global_admin permitido');
  assert(canAccessNestFinanceDevelopment('ecosystem_owner'), 'ecosystem_owner permitido');
  assert(!canAccessNestFinanceDevelopment('founder'), 'founder negado');
  assert(!canAccessNestFinanceDevelopment('admin'), 'admin negado');
  assert(!canAccessNestFinanceDevelopment('ecosystem_support'), 'ecosystem_support negado');
  assert(!canAccessNestFinanceDevelopment(null), 'null negado');

  const db = new MockFirestore() as any;

  // Setup basic active org
  db.collections.organizations['org1'] = { status: 'active', enabledApps: ['nestfinance'] };
  
  // Test ceo access
  db.collections.users['u_ceo'] = { status: 'active', systemRole: 'ceo' };
  db.collections.organizations['org1'] = { status: 'active', enabledApps: ['nestfinance'] };
  let result = await resolveEcosystemAppAccess({ uid: 'u_ceo', organizationId: 'org1', appId: 'nestfinance', db });
  assert(result.accessible === true && result.decisionState === 'granted', 'ceo allowed in resolver');

  // Test founder access
  db.collections.users['u_founder'] = { status: 'active', systemRole: 'founder' };
  result = await resolveEcosystemAppAccess({ uid: 'u_founder', organizationId: 'org1', appId: 'nestfinance', db });
  assert(result.accessible === false && result.denialReason === DENIAL_REASONS.NESTFINANCE_DEVELOPMENT_ACCESS_RESTRICTED, 'founder denied in resolver');

  // Test member with owner org role and app enabled/entitled
  db.collections.users['u_owner'] = { status: 'active', systemRole: null };
  db.collections.organizations['org1'].entitlements = { nestfinance: { active: true } };
  if (!db.collections.members) db.collections.members = {};
  db.collections.members['org1'] = {
    'u_owner': { status: 'active', role: 'owner', appAccess: { nestFinance: { enabled: true } } }
  };
  result = await resolveEcosystemAppAccess({ uid: 'u_owner', organizationId: 'org1', appId: 'nestfinance', db });
  assert(result.accessible === false && result.denialReason === DENIAL_REASONS.NESTFINANCE_DEVELOPMENT_ACCESS_RESTRICTED, 'org owner denied in resolver');

  // Test inactive user
  db.collections.users['u_inactive_ceo'] = { status: 'inactive', systemRole: 'ceo' };
  result = await resolveEcosystemAppAccess({ uid: 'u_inactive_ceo', organizationId: 'org1', appId: 'nestfinance', db });
  assert(result.accessible === false && result.denialReason === DENIAL_REASONS.USER_INACTIVE, 'inactive user denied before dev gate');

  // Test missing org id
  result = await resolveEcosystemAppAccess({ uid: 'u_ceo', organizationId: null, appId: 'nestfinance', db });
  assert(result.accessible === false && result.denialReason === DENIAL_REASONS.ORGANIZATION_REQUIRED, 'organizationId required');

  // Test missing org
  result = await resolveEcosystemAppAccess({ uid: 'u_ceo', organizationId: 'missing_org', appId: 'nestfinance', db });
  assert(result.accessible === false && result.denialReason === DENIAL_REASONS.ORGANIZATION_NOT_FOUND, 'organization nonexistent denied');

  // Test inactive org
  db.collections.organizations['org2'] = { status: 'inactive' };
  result = await resolveEcosystemAppAccess({ uid: 'u_ceo', organizationId: 'org2', appId: 'nestfinance', db });
  assert(result.accessible === false && result.denialReason === DENIAL_REASONS.ORGANIZATION_INACTIVE, 'organization inactive denied');

  // Test MusicScale preserves behavior for founder
  result = await resolveEcosystemAppAccess({ uid: 'u_founder', organizationId: 'org1', appId: 'musicscale', db });
  assert(result.accessible === true && result.decisionState === 'granted', 'MusicScale preserves access for founder');

  console.log('--- SUMMARY ---');
  console.log(`Total: ${assertions}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Skipped: 0`);
  console.log(`Assertions: ${assertions}`);
  
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
