
import { resolveEcosystemAppAccess, DENIAL_REASONS } from '../src/server/services/EcosystemAccessResolver.js';
import { canAccessNestFinanceDevelopment } from '../src/lib/permissionService.js';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const http = require('node:http');
const https = require('node:https');

let passed = 0;
let failed = 0;
let assertions = 0;

let fetchAttempts = 0;
let httpRequestAttempts = 0;
let httpsRequestAttempts = 0;

let directWriteAttempts = 0;
let batchCreationAttempts = 0;
let batchMutationAttempts = 0;
let batchCommitAttempts = 0;
let transactionAttempts = 0;

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
        doc: (id: string) => ({
          get: async () => new MockDoc(id, this.collections.members[orgId][id]),
          set: async () => { directWriteAttempts++; },
          update: async () => { directWriteAttempts++; },
          delete: async () => { directWriteAttempts++; }
        })
      };
    }

    if (!this.collections[path]) this.collections[path] = {};
    return {
      doc: (id: string) => ({
        get: async () => new MockDoc(id, this.collections[path][id]),
        set: async () => { directWriteAttempts++; },
        update: async () => { directWriteAttempts++; },
        delete: async () => { directWriteAttempts++; }
      })
    };
  }

  // Intercept writes
  async runTransaction(updateFunction: any) {
    transactionAttempts++;
    return null;
  }

  batch() {
    batchCreationAttempts++;
    return {
      commit: async () => { batchCommitAttempts++; },
      set: () => { batchMutationAttempts++; },
      update: () => { batchMutationAttempts++; },
      delete: () => { batchMutationAttempts++; }
    };
  }
}

async function runTests() {
  console.log('--- TEST MN NESTFINANCE DEV GATE ---');

  // Intercept network
  const originalFetch = globalThis.fetch;
  const originalHttpRequest = http.request;
  const originalHttpsRequest = https.request;

  globalThis.fetch = async () => {
    fetchAttempts++;
    throw new Error('Network call blocked by interceptor (fetch)');
  };

  http.request = (...args: any[]) => {
    httpRequestAttempts++;
    throw new Error('Network call blocked by interceptor (http)');
  };

  https.request = (...args: any[]) => {
    httpsRequestAttempts++;
    throw new Error('Network call blocked by interceptor (https)');
  };

  try {
    // 1-3. canAccessNestFinanceDevelopment logic
    assert(canAccessNestFinanceDevelopment('ceo'), 'ceo permitido na function');
    assert(canAccessNestFinanceDevelopment('global_admin'), 'global_admin permitido na function');
    assert(canAccessNestFinanceDevelopment('ecosystem_owner'), 'ecosystem_owner permitido na function');
    assert(!canAccessNestFinanceDevelopment('founder'), 'founder negado na function');
    assert(!canAccessNestFinanceDevelopment('admin'), 'admin negado na function');
    assert(!canAccessNestFinanceDevelopment('ecosystem_support'), 'ecosystem_support negado na function');
    assert(!canAccessNestFinanceDevelopment(null as any), 'null negado na function');
    assert(!canAccessNestFinanceDevelopment(undefined as any), 'undefined negado na function');
    assert(!canAccessNestFinanceDevelopment(''), 'string vazia negada na function');

    const runCase = async (uid: string | null, orgId: string | null, setupDb: (db: any) => void) => {
      const db = new MockFirestore() as any;
      setupDb(db);
      return await resolveEcosystemAppAccess({ uid, organizationId: orgId, appId: 'nestfinance', db });
    };

    // 1. ceo permitido
    let res = await runCase('u1', 'o1', (db) => {
      db.collections.users['u1'] = { status: 'active', systemRole: 'ceo' };
      db.collections.organizations['o1'] = { status: 'active' };
    });
    assert(res.accessible === true && res.decisionState === 'granted', 'ceo permitido');

    // 2. global_admin permitido
    res = await runCase('u2', 'o2', (db) => {
      db.collections.users['u2'] = { status: 'active', systemRole: 'global_admin' };
      db.collections.organizations['o2'] = { status: 'active' };
    });
    assert(res.accessible === true && res.decisionState === 'granted', 'global_admin permitido');

    // 3. ecosystem_owner permitido
    res = await runCase('u3', 'o3', (db) => {
      db.collections.users['u3'] = { status: 'active', systemRole: 'ecosystem_owner' };
      db.collections.organizations['o3'] = { status: 'active' };
    });
    assert(res.accessible === true && res.decisionState === 'granted', 'ecosystem_owner permitido');

    // 4. founder negado
    res = await runCase('u4', 'o4', (db) => {
      db.collections.users['u4'] = { status: 'active', systemRole: 'founder' };
      db.collections.organizations['o4'] = { status: 'active' };
    });
    assert(res.accessible === false && res.denialReason === DENIAL_REASONS.NESTFINANCE_DEVELOPMENT_ACCESS_RESTRICTED, 'founder negado');

    // 5. admin legado negado
    res = await runCase('u5', 'o5', (db) => {
      db.collections.users['u5'] = { status: 'active', systemRole: 'admin' };
      db.collections.organizations['o5'] = { status: 'active' };
    });
    assert(res.accessible === false && res.denialReason === DENIAL_REASONS.NESTFINANCE_DEVELOPMENT_ACCESS_RESTRICTED, 'admin legado negado');

    // 6. ecosystem_support negado
    res = await runCase('u6', 'o6', (db) => {
      db.collections.users['u6'] = { status: 'active', systemRole: 'ecosystem_support' };
      db.collections.organizations['o6'] = { status: 'active' };
    });
    assert(res.accessible === false && res.denialReason === DENIAL_REASONS.NESTFINANCE_DEVELOPMENT_ACCESS_RESTRICTED, 'ecosystem_support negado');

    // 7. sem systemRole negado
    res = await runCase('u7', 'o7', (db) => {
      db.collections.users['u7'] = { status: 'active' };
      db.collections.organizations['o7'] = { status: 'active' };
    });
    assert(res.accessible === false && res.denialReason === DENIAL_REASONS.NESTFINANCE_DEVELOPMENT_ACCESS_RESTRICTED, 'sem systemRole negado');

    // 8. owner org negado
    res = await runCase('u8', 'o8', (db) => {
      db.collections.users['u8'] = { status: 'active' };
      db.collections.organizations['o8'] = { status: 'active' };
      db.collections.members = { 'o8': { 'u8': { status: 'active', role: 'owner' } } };
    });
    assert(res.accessible === false && res.denialReason === DENIAL_REASONS.NESTFINANCE_DEVELOPMENT_ACCESS_RESTRICTED, 'owner de org negado');

    // 9. admin org negado
    res = await runCase('u9', 'o9', (db) => {
      db.collections.users['u9'] = { status: 'active' };
      db.collections.organizations['o9'] = { status: 'active' };
      db.collections.members = { 'o9': { 'u9': { status: 'active', role: 'admin' } } };
    });
    assert(res.accessible === false && res.denialReason === DENIAL_REASONS.NESTFINANCE_DEVELOPMENT_ACCESS_RESTRICTED, 'admin de org negado');

    // 10. membro comum negado
    res = await runCase('u10', 'o10', (db) => {
      db.collections.users['u10'] = { status: 'active' };
      db.collections.organizations['o10'] = { status: 'active' };
      db.collections.members = { 'o10': { 'u10': { status: 'active', role: 'member' } } };
    });
    assert(res.accessible === false && res.denialReason === DENIAL_REASONS.NESTFINANCE_DEVELOPMENT_ACCESS_RESTRICTED, 'membro comum negado');

    // 11. UID ausente negado
    res = await runCase(null, 'o11', (db) => {});
    assert(res.accessible === false && res.denialReason === DENIAL_REASONS.UNAUTHENTICATED, 'UID ausente negado');

    // 12. usuário inativo negado
    res = await runCase('u12', 'o12', (db) => {
      db.collections.users['u12'] = { status: 'inactive', systemRole: 'ceo' };
      db.collections.organizations['o12'] = { status: 'active' };
    });
    assert(res.accessible === false && res.denialReason === DENIAL_REASONS.USER_INACTIVE, 'usuário inativo negado');

    // 13. orgId ausente negado
    res = await runCase('u13', null, (db) => {
      db.collections.users['u13'] = { status: 'active', systemRole: 'ceo' };
    });
    assert(res.accessible === false && res.denialReason === DENIAL_REASONS.ORGANIZATION_REQUIRED, 'orgId ausente negado');

    // 14. organização inexistente negada
    res = await runCase('u14', 'o14', (db) => {
      db.collections.users['u14'] = { status: 'active', systemRole: 'ceo' };
    });
    assert(res.accessible === false && res.denialReason === DENIAL_REASONS.ORGANIZATION_NOT_FOUND, 'organização inexistente negada');

    // 15. organização inativa negada
    res = await runCase('u15', 'o15', (db) => {
      db.collections.users['u15'] = { status: 'active', systemRole: 'ceo' };
      db.collections.organizations['o15'] = { status: 'inactive' };
    });
    assert(res.accessible === false && res.denialReason === DENIAL_REASONS.ORGANIZATION_INACTIVE, 'organização inativa negada');

    // 16. enabledApps isolado
    res = await runCase('u16', 'o16', (db) => {
      db.collections.users['u16'] = { status: 'active' };
      db.collections.organizations['o16'] = { status: 'active', enabledApps: ['nestfinance'] };
    });
    assert(res.accessible === false && res.denialReason === DENIAL_REASONS.NESTFINANCE_DEVELOPMENT_ACCESS_RESTRICTED, 'enabledApps isoladamente não libera');

    // 17. entitlement ativo isolado
    res = await runCase('u17', 'o17', (db) => {
      db.collections.users['u17'] = { status: 'active' };
      db.collections.organizations['o17'] = { status: 'active', entitlements: { nestfinance: { active: true } } };
    });
    assert(res.accessible === false && res.denialReason === DENIAL_REASONS.NESTFINANCE_DEVELOPMENT_ACCESS_RESTRICTED, 'entitlement ativo isoladamente não libera');

    // 18. appAccess enabled isolado
    res = await runCase('u18', 'o18', (db) => {
      db.collections.users['u18'] = { status: 'active' };
      db.collections.organizations['o18'] = { status: 'active' };
      db.collections.members = { 'o18': { 'u18': { status: 'active', appAccess: { nestFinance: { enabled: true } } } } };
    });
    assert(res.accessible === false && res.denialReason === DENIAL_REASONS.NESTFINANCE_DEVELOPMENT_ACCESS_RESTRICTED, 'appAccess enabled isoladamente não libera');

    // 19. enabledApps + entitlement ativos
    res = await runCase('u19', 'o19', (db) => {
      db.collections.users['u19'] = { status: 'active' };
      db.collections.organizations['o19'] = { status: 'active', enabledApps: ['nestfinance'], entitlements: { nestfinance: { active: true } } };
    });
    assert(res.accessible === false && res.denialReason === DENIAL_REASONS.NESTFINANCE_DEVELOPMENT_ACCESS_RESTRICTED, 'enabledApps + entitlement ativos não liberam');

    // 20. enabledApps + appAccess
    res = await runCase('u20', 'o20', (db) => {
      db.collections.users['u20'] = { status: 'active' };
      db.collections.organizations['o20'] = { status: 'active', enabledApps: ['nestfinance'] };
      db.collections.members = { 'o20': { 'u20': { status: 'active', appAccess: { nestFinance: { enabled: true } } } } };
    });
    assert(res.accessible === false && res.denialReason === DENIAL_REASONS.NESTFINANCE_DEVELOPMENT_ACCESS_RESTRICTED, 'enabledApps + appAccess não liberam');

    // 21. entitlement + appAccess
    res = await runCase('u21', 'o21', (db) => {
      db.collections.users['u21'] = { status: 'active' };
      db.collections.organizations['o21'] = { status: 'active', entitlements: { nestfinance: { active: true } } };
      db.collections.members = { 'o21': { 'u21': { status: 'active', appAccess: { nestFinance: { enabled: true } } } } };
    });
    assert(res.accessible === false && res.denialReason === DENIAL_REASONS.NESTFINANCE_DEVELOPMENT_ACCESS_RESTRICTED, 'entitlement + appAccess não liberam');

    // 22. enabledApps + entitlement + appAccess
    res = await runCase('u22', 'o22', (db) => {
      db.collections.users['u22'] = { status: 'active' };
      db.collections.organizations['o22'] = { status: 'active', enabledApps: ['nestfinance'], entitlements: { nestfinance: { active: true } } };
      db.collections.members = { 'o22': { 'u22': { status: 'active', appAccess: { nestFinance: { enabled: true } } } } };
    });
    assert(res.accessible === false && res.denialReason === DENIAL_REASONS.NESTFINANCE_DEVELOPMENT_ACCESS_RESTRICTED, 'enabledApps + entitlement + appAccess não liberam');

    // 23. MusicScale preserva comportamento para founder
    const dbMS = new MockFirestore() as any;
    dbMS.collections.users['u23'] = { status: 'active', systemRole: 'founder' };
    dbMS.collections.organizations['o23'] = { status: 'active' };
    let resMS = await resolveEcosystemAppAccess({ uid: 'u23', organizationId: 'o23', appId: 'musicscale', db: dbMS });
    assert(resMS.accessible === true && resMS.decisionState === 'granted', 'MusicScale preserva comportamento para founder');

    // 24. nenhuma chamada de rede
    const networkAttempts = fetchAttempts + httpRequestAttempts + httpsRequestAttempts;
    assert(fetchAttempts === 0, 'nenhuma chamada de rede ocorreu (fetch)');
    assert(httpRequestAttempts === 0, 'nenhuma chamada de rede ocorreu (http)');
    assert(httpsRequestAttempts === 0, 'nenhuma chamada de rede ocorreu (https)');
    assert(networkAttempts === 0, 'nenhuma chamada de rede ocorreu no total');

    // 25. nenhuma escrita, batch ou transaction
    const totalWriteAttempts = directWriteAttempts + batchCreationAttempts + batchMutationAttempts + batchCommitAttempts + transactionAttempts;
    assert(directWriteAttempts === 0, 'nenhuma escrita direta ocorreu');
    assert(batchCreationAttempts === 0, 'nenhuma criacao de batch ocorreu');
    assert(batchMutationAttempts === 0, 'nenhuma operacao de batch ocorreu');
    assert(batchCommitAttempts === 0, 'nenhum commit de batch ocorreu');
    assert(transactionAttempts === 0, 'nenhuma transaction ocorreu');
    assert(totalWriteAttempts === 0, 'nenhuma escrita, batch ou transaction ocorreu no total');

  } finally {
    globalThis.fetch = originalFetch;
    http.request = originalHttpRequest;
    https.request = originalHttpsRequest;
  }

  console.log('--- SUMMARY ---');
  console.log(`Total: ${assertions}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Skipped: 0`);
  console.log(`Assertions: ${assertions}`);
  console.log(`fetchAttempts: ${fetchAttempts}`);
  console.log(`httpRequestAttempts: ${httpRequestAttempts}`);
  console.log(`httpsRequestAttempts: ${httpsRequestAttempts}`);

  const networkAttempts = fetchAttempts + httpRequestAttempts + httpsRequestAttempts;
  console.log(`networkAttempts: ${networkAttempts}`);

  console.log(`directWriteAttempts: ${directWriteAttempts}`);
  console.log(`batchCreationAttempts: ${batchCreationAttempts}`);
  console.log(`batchMutationAttempts: ${batchMutationAttempts}`);
  console.log(`batchCommitAttempts: ${batchCommitAttempts}`);
  console.log(`transactionAttempts: ${transactionAttempts}`);

  const totalWriteAttempts = directWriteAttempts + batchCreationAttempts + batchMutationAttempts + batchCommitAttempts + transactionAttempts;
  console.log(`totalWriteAttempts: ${totalWriteAttempts}`);

  if (failed > 0 || networkAttempts > 0 || totalWriteAttempts > 0) {
    process.exit(1);
  }
}

runTests();
