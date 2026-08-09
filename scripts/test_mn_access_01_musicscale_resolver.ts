import { resolveEcosystemAppAccess, DENIAL_REASONS } from '../src/server/services/EcosystemAccessResolver.js';
import type { EcosystemAppId, CanonicalMusicScaleSubscriptionStatus, CanonicalAppAccessState, MusicScaleIndividualAccessSource } from '../src/server/services/EcosystemAccessResolver.js';
import * as admin from 'firebase-admin';




import { createRequire } from 'module';
const requireModule = createRequire(import.meta.url);
let networkAttempts = 0;
const originalFetch = globalThis.fetch;
let originalHttpReq: any;
let originalHttpsReq: any;
let httpModule: any;
let httpsModule: any;
try {
  httpModule = requireModule('http');
  httpsModule = requireModule('https');
  originalHttpReq = httpModule.request;
  originalHttpsReq = httpsModule.request;
} catch (e) {}

function installNetworkGuard() {
  networkAttempts = 0;
  globalThis.fetch = () => { networkAttempts++; throw new Error("Network not allowed"); };
  if (httpModule) {
    httpModule.request = () => { networkAttempts++; throw new Error("Network not allowed"); };
  }
  if (httpsModule) {
    httpsModule.request = () => { networkAttempts++; throw new Error("Network not allowed"); };
  }
}

function restoreNetworkGuard() {
  globalThis.fetch = originalFetch;
  if (httpModule) httpModule.request = originalHttpReq;
  if (httpsModule) httpsModule.request = originalHttpsReq;
}


class MockDocumentReference {
  constructor(public path: string, private db: MockFirestore) {}
  async get() {
    this.db.documentReads++;
    const data = this.db.getData(this.path);
    return {
      exists: data !== null && data !== undefined,
      data: () => data ? JSON.parse(JSON.stringify(data)) : null,
      id: this.path.split('/').pop()
    };
  }
  set() { this.db.writeAttempts++; throw new Error('Write operation set() not allowed'); }
  update() { this.db.writeAttempts++; throw new Error('Write operation update() not allowed'); }
  delete() { this.db.writeAttempts++; throw new Error('Write operation delete() not allowed'); }
  create() { this.db.writeAttempts++; throw new Error('Write operation create() not allowed'); }
}

class MockCollectionReference {
  constructor(public path: string, private db: MockFirestore) {
    this.db.collectionCalls.push(path);
  }
  doc(id?: string) {
    if (!id) throw new Error('doc() must be called with id');
    return new MockDocumentReference(`${this.path}/${id}`, this.db);
  }
  where() { this.db.queryAttempts++; throw new Error('Query where() not allowed'); }
  orderBy() { this.db.queryAttempts++; throw new Error('Query orderBy() not allowed'); }
  limit() { this.db.queryAttempts++; throw new Error('Query limit() not allowed'); }
  get() { this.db.queryAttempts++; throw new Error('Query get() not allowed'); }
}

class MockFirestore {
  private data: Record<string, any> = {};
  public accessedPaths: string[] = [];
  public collectionCalls: string[] = [];
  public documentReads = 0;
  public queryAttempts = 0;
  public writeAttempts = 0;
  public batchAttempts = 0;
  public transactionAttempts = 0;
  public initialSnapshot = '';

  setMockData(path: string, data: any) {
    this.data[path] = data;
    this.initialSnapshot = JSON.stringify(this.data);
  }

  getSnapshot() { return JSON.stringify(this.data); }

  getData(path: string) {
    this.accessedPaths.push(path);
    return this.data[path] ?? null;
  }

  collection(path: string) {
    return new MockCollectionReference(path, this);
  }

  batch() { this.batchAttempts++; throw new Error('Write operation batch() not allowed'); }
  runTransaction() { this.transactionAttempts++; throw new Error('Write operation runTransaction() not allowed'); }
  recursiveDelete() { this.writeAttempts++; throw new Error('Write operation recursiveDelete() not allowed'); }
}


let passed = 0;
let failed = 0;


async function runTest(
  name: string, 
  uid: string | null, 
  orgId: string | null, 
  appId: EcosystemAppId,
  setupData: (db: MockFirestore) => void, 
  validate: (result: any, db: MockFirestore) => void
) {
  const db = new MockFirestore();
  setupData(db);
  db.initialSnapshot = db.getSnapshot();

  installNetworkGuard();
  try {
    const result = await resolveEcosystemAppAccess({
      uid,
      organizationId: orgId,
      appId,
      db: db as unknown as admin.firestore.Firestore
    });
    
    validate(result, db);
    console.log(`✅ PASS: ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`❌ FAIL: ${name}`);
    console.error(err);
    failed++;
  } finally {
    restoreNetworkGuard();
  }
}

async function runAllTests() {
  console.log('Running tests for EcosystemAccessResolver (MusicScale)...');

  // Helper for common setup
  const setupUserAndOrg = (db: MockFirestore, sysRole = 'user', orgStatus = 'active', memStatus = 'active', memEnabled = true, subStatus = 'active', appStatus = 'active') => {
    db.setMockData('users/u1', { status: 'active', systemRole: sysRole });
    db.setMockData('organizations/org1', { 
       status: orgStatus, 
       apps: { musicscale: { status: appStatus } } 
    });
    db.setMockData('organizations/org1/members/u1', { 
       status: memStatus, 
       appAccess: { musicscale: { enabled: memEnabled } } 
    });
    db.setMockData('subscriptions/org1', { status: subStatus });
  };

  // IDENTIDADE
  await runTest('1. UID ausente', null, 'org1', 'musicscale', db => {}, res => {
    if (res.accessible || res.denialReason !== DENIAL_REASONS.UNAUTHENTICATED) throw new Error('Expected UNAUTHENTICATED');
  });

  await runTest('2. Usuário inexistente', 'u1', 'org1', 'musicscale', db => {}, res => {
    if (res.accessible || res.denialReason !== DENIAL_REASONS.USER_NOT_FOUND) throw new Error('Expected USER_NOT_FOUND');
  });

  await runTest('3. Usuário inactive', 'u1', 'org1', 'musicscale', db => {
    db.setMockData('users/u1', { status: 'inactive' });
  }, res => {
    if (res.accessible || res.denialReason !== DENIAL_REASONS.USER_INACTIVE) throw new Error('Expected USER_INACTIVE');
  });

  await runTest('4. Usuário suspended', 'u1', 'org1', 'musicscale', db => {
    db.setMockData('users/u1', { status: 'suspended' });
  }, res => {
    if (res.accessible || res.denialReason !== DENIAL_REASONS.USER_INACTIVE) throw new Error('Expected USER_INACTIVE');
  });

  await runTest('5. Usuário disabled por flag', 'u1', 'org1', 'musicscale', db => {
    db.setMockData('users/u1', { status: 'active', disabled: true });
  }, res => {
    if (res.accessible || res.denialReason !== DENIAL_REASONS.USER_INACTIVE) throw new Error('Expected USER_INACTIVE');
  });

  await runTest('6. Usuário comum ativo (mas sem org e etc)', 'u1', 'org1', 'musicscale', db => {
    db.setMockData('users/u1', { status: 'active' });
  }, res => {
    if (res.accessible || res.denialReason !== DENIAL_REASONS.ORGANIZATION_NOT_FOUND) throw new Error('Expected ORGANIZATION_NOT_FOUND');
  });

  // ORGANIZAÇÃO
  await runTest('7. organizationId ausente', 'u1', null, 'musicscale', db => {
    db.setMockData('users/u1', { status: 'active' });
  }, res => {
    if (res.accessible || res.denialReason !== DENIAL_REASONS.ORGANIZATION_REQUIRED) throw new Error('Expected ORGANIZATION_REQUIRED');
  });

  await runTest('8. Organização inexistente', 'u1', 'org1', 'musicscale', db => {
    db.setMockData('users/u1', { status: 'active' });
  }, res => {
    if (res.accessible || res.denialReason !== DENIAL_REASONS.ORGANIZATION_NOT_FOUND) throw new Error('Expected ORGANIZATION_NOT_FOUND');
  });

  await runTest('9. Organização archived', 'u1', 'org1', 'musicscale', db => {
    db.setMockData('users/u1', { status: 'active' });
    db.setMockData('organizations/org1', { status: 'archived' });
  }, res => {
    if (res.accessible || res.denialReason !== DENIAL_REASONS.ORGANIZATION_INACTIVE) throw new Error('Expected ORGANIZATION_INACTIVE');
  });

  await runTest('10. Organização inactive', 'u1', 'org1', 'musicscale', db => {
    db.setMockData('users/u1', { status: 'active' });
    db.setMockData('organizations/org1', { status: 'inactive' });
  }, res => {
    if (res.accessible || res.denialReason !== DENIAL_REASONS.ORGANIZATION_INACTIVE) throw new Error('Expected ORGANIZATION_INACTIVE');
  });

  await runTest('11. Organização suspended', 'u1', 'org1', 'musicscale', db => {
    db.setMockData('users/u1', { status: 'active' });
    db.setMockData('organizations/org1', { status: 'suspended' });
  }, res => {
    if (res.accessible || res.denialReason !== DENIAL_REASONS.ORGANIZATION_INACTIVE) throw new Error('Expected ORGANIZATION_INACTIVE');
  });

  await runTest('12. Organização disabled por flag', 'u1', 'org1', 'musicscale', db => {
    db.setMockData('users/u1', { status: 'active' });
    db.setMockData('organizations/org1', { status: 'active', disabled: true });
  }, res => {
    if (res.accessible || res.denialReason !== DENIAL_REASONS.ORGANIZATION_INACTIVE) throw new Error('Expected ORGANIZATION_INACTIVE');
  });

  // PAPÉIS GLOBAIS
  const globalRoles = ['ceo', 'global_admin', 'ecosystem_owner', 'founder'];
  for (let i = 0; i < globalRoles.length; i++) {
    const role = globalRoles[i];
    await runTest(`1${3 + i}. ${role} recebe acesso sem membership e sem assinatura`, 'u1', 'org1', 'musicscale', db => {
      db.setMockData('users/u1', { status: 'active', systemRole: role });
      db.setMockData('organizations/org1', { status: 'active' });
    }, res => {
      if (!res.accessible || !res.isGlobalAccess || res.decisionState !== 'granted') throw new Error(`Expected access for ${role}`);
    });
  }

  await runTest('17. admin não recebe acesso global', 'u1', 'org1', 'musicscale', db => {
    db.setMockData('users/u1', { status: 'active', systemRole: 'admin' });
    db.setMockData('organizations/org1', { status: 'active' });
  }, res => {
    if (res.isGlobalAccess || res.accessible || res.denialReason !== DENIAL_REASONS.MEMBERSHIP_NOT_FOUND) throw new Error('Expected MEMBERSHIP_NOT_FOUND');
    if (res.permissions.includes('*') || Object.keys(res.scopes || {}).includes('*')) throw new Error('Should not have global permissions');
    if (res.roles.includes('global_admin')) throw new Error('Should not have global_admin role');
    if (res.accessSource !== 'denied') throw new Error('Expected accessSource denied');
  });

  await runTest('18. owner não recebe acesso global', 'u1', 'org1', 'musicscale', db => {
    db.setMockData('users/u1', { status: 'active', systemRole: 'owner' });
    db.setMockData('organizations/org1', { status: 'active' });
  }, res => {
    if (res.isGlobalAccess || res.accessible || res.denialReason !== DENIAL_REASONS.MEMBERSHIP_NOT_FOUND) throw new Error('Expected MEMBERSHIP_NOT_FOUND');
    if (res.permissions.includes('*') || Object.keys(res.scopes || {}).includes('*')) throw new Error('Should not have global permissions');
    if (res.roles.includes('global_admin')) throw new Error('Should not have global_admin role');
    if (res.accessSource !== 'denied') throw new Error('Expected accessSource denied');
  });

  await runTest('19. member não recebe acesso global', 'u1', 'org1', 'musicscale', db => {
    db.setMockData('users/u1', { status: 'active', systemRole: 'member' });
    db.setMockData('organizations/org1', { status: 'active' });
  }, res => {
    if (res.isGlobalAccess || res.accessible || res.denialReason !== DENIAL_REASONS.MEMBERSHIP_NOT_FOUND) throw new Error('Expected MEMBERSHIP_NOT_FOUND');
    if (res.permissions.includes('*') || Object.keys(res.scopes || {}).includes('*')) throw new Error('Should not have global permissions');
    if (res.roles.includes('global_admin')) throw new Error('Should not have global_admin role');
    if (res.accessSource !== 'denied') throw new Error('Expected accessSource denied');
  });

  await runTest('20. papel desconhecido não recebe acesso global', 'u1', 'org1', 'musicscale', db => {
    db.setMockData('users/u1', { status: 'active', systemRole: 'unknown_role' });
    db.setMockData('organizations/org1', { status: 'active' });
  }, res => {
    if (res.isGlobalAccess || res.accessible || res.denialReason !== DENIAL_REASONS.MEMBERSHIP_NOT_FOUND) throw new Error('Expected MEMBERSHIP_NOT_FOUND');
    if (res.permissions.includes('*') || Object.keys(res.scopes || {}).includes('*')) throw new Error('Should not have global permissions');
    if (res.roles.includes('global_admin')) throw new Error('Should not have global_admin role');
    if (res.accessSource !== 'denied') throw new Error('Expected accessSource denied');
  });

  // MEMBERSHIP
  await runTest('21. Membership ausente', 'u1', 'org1', 'musicscale', db => {
    db.setMockData('users/u1', { status: 'active' });
    db.setMockData('organizations/org1', { status: 'active' });
  }, res => {
    if (res.accessible || res.denialReason !== DENIAL_REASONS.MEMBERSHIP_NOT_FOUND) throw new Error('Expected MEMBERSHIP_NOT_FOUND');
  });

  await runTest('22. Membership active', 'u1', 'org1', 'musicscale', db => {
    setupUserAndOrg(db);
  }, res => {
    if (!res.accessible) throw new Error('Expected access');
  });

  await runTest('23. Membership sem campo status, por compatibilidade', 'u1', 'org1', 'musicscale', db => {
    setupUserAndOrg(db, 'user', 'active', undefined as any);
  }, res => {
    if (!res.accessible) throw new Error('Expected access (fallback to active)');
  });

  const inactiveStatuses = ['inactive', 'suspended', 'disabled', 'removed', 'revoked', 'archived'];
  for (let i = 0; i < inactiveStatuses.length; i++) {
    const status = inactiveStatuses[i];
    await runTest(`2${4 + i}. Membership ${status}`, 'u1', 'org1', 'musicscale', db => {
      setupUserAndOrg(db, 'user', 'active', status);
    }, res => {
      if (res.accessible || res.denialReason !== DENIAL_REASONS.MEMBERSHIP_INACTIVE) throw new Error(`Expected MEMBERSHIP_INACTIVE for ${status}`);
    });
  }

  await runTest('30. ownerUid sem membership não concede acesso', 'u1', 'org1', 'musicscale', db => {
    db.setMockData('users/u1', { status: 'active' });
    db.setMockData('organizations/org1', { status: 'active', ownerUid: 'u1' });
  }, res => {
    if (res.accessible) throw new Error('Expected denial');
  });

  // ACESSO INDIVIDUAL
  await runTest('31. appAccess.musicscale.enabled false nega', 'u1', 'org1', 'musicscale', db => {
    setupUserAndOrg(db, 'user', 'active', 'active', false);
  }, res => {
    if (res.accessible || res.denialReason !== DENIAL_REASONS.MEMBER_APP_ACCESS_DISABLED) throw new Error('Expected MEMBER_APP_ACCESS_DISABLED');
  });

  await runTest('32. appAccess.musicscale.enabled true permite prosseguir', 'u1', 'org1', 'musicscale', db => {
    setupUserAndOrg(db, 'user', 'active', 'active', true);
  }, res => {
    if (!res.accessible) throw new Error('Expected access');
    if (res.entitlement?.individualAccessSource !== 'explicit_enabled') throw new Error('Expected explicit_enabled');
  });

  await runTest('33. appAccess.musicscale ausente permite compatibilidade por membership', 'u1', 'org1', 'musicscale', db => {
    setupUserAndOrg(db);
    db.setMockData('organizations/org1/members/u1', { status: 'active' }); // missing appAccess
  }, res => {
    if (!res.accessible) throw new Error('Expected access');
    if (res.entitlement?.individualAccessSource !== 'membership_compatibility') throw new Error('Expected membership_compatibility');
  });

  // ASSINATURA E ENTITLEMENT
  await runTest('34. subscription active + organization app active concede', 'u1', 'org1', 'musicscale', db => {
    setupUserAndOrg(db, 'user', 'active', 'active', true, 'active', 'active');
  }, res => {
    if (!res.accessible || res.entitlement?.canonicalStatus !== 'active') throw new Error('Expected active');
  });

  await runTest('35. subscription trialing + organization app trialing concede', 'u1', 'org1', 'musicscale', db => {
    setupUserAndOrg(db, 'user', 'active', 'active', true, 'trialing', 'trialing');
  }, res => {
    if (!res.accessible || res.entitlement?.canonicalStatus !== 'trialing') throw new Error('Expected trialing');
  });

  await runTest('36. subscription active + organization app trialing concede', 'u1', 'org1', 'musicscale', db => {
    setupUserAndOrg(db, 'user', 'active', 'active', true, 'active', 'trialing');
  }, res => {
    if (!res.accessible || res.entitlement?.canonicalStatus !== 'active') throw new Error('Expected active');
  });

  await runTest('37. subscription trialing + organization app active concede', 'u1', 'org1', 'musicscale', db => {
    setupUserAndOrg(db, 'user', 'active', 'active', true, 'trialing', 'active');
  }, res => {
    if (!res.accessible || res.entitlement?.canonicalStatus !== 'trialing') throw new Error('Expected trialing');
  });

  await runTest('38. subscription active + cancelAtPeriodEnd true concede e marca cancellationScheduled', 'u1', 'org1', 'musicscale', db => {
    setupUserAndOrg(db, 'user', 'active', 'active', true, 'active', 'active');
    db.setMockData('subscriptions/org1', { status: 'active', cancelAtPeriodEnd: true });
  }, res => {
    if (!res.accessible || res.entitlement?.cancellationScheduled !== true) throw new Error('Expected cancellationScheduled true');
  });

  await runTest('39. subscription trialing + cancel_at_period_end true concede e marca cancellationScheduled', 'u1', 'org1', 'musicscale', db => {
    setupUserAndOrg(db, 'user', 'active', 'active', true, 'trialing', 'trialing');
    db.setMockData('subscriptions/org1', { status: 'trialing', cancel_at_period_end: true });
  }, res => {
    if (!res.accessible || res.entitlement?.cancellationScheduled !== true) throw new Error('Expected cancellationScheduled true');
  });

  await runTest('40. subscription canceled com currentPeriodEnd futuro nega', 'u1', 'org1', 'musicscale', db => {
    setupUserAndOrg(db, 'user', 'active', 'active', true, 'canceled', 'active');
    db.setMockData('subscriptions/org1', { status: 'canceled', currentPeriodEnd: { toMillis: () => Date.now() + 10000 } });
  }, res => {
    if (res.accessible || res.denialReason !== DENIAL_REASONS.SUBSCRIPTION_INACTIVE) throw new Error('Expected SUBSCRIPTION_INACTIVE');
  });

  await runTest('41. subscription canceled expirado nega', 'u1', 'org1', 'musicscale', db => {
    setupUserAndOrg(db, 'user', 'active', 'active', true, 'canceled', 'active');
  }, res => {
    if (res.accessible || res.denialReason !== DENIAL_REASONS.SUBSCRIPTION_INACTIVE) throw new Error('Expected SUBSCRIPTION_INACTIVE');
  });

  const paymentIssueStatuses = ['past_due', 'unpaid', 'incomplete', 'paused'];
  for (let i = 0; i < paymentIssueStatuses.length; i++) {
    const status = paymentIssueStatuses[i];
    await runTest(`4${2 + i}. ${status} nega com motivo de pagamento`, 'u1', 'org1', 'musicscale', db => {
      setupUserAndOrg(db, 'user', 'active', 'active', true, status, 'active');
    }, res => {
      if (res.accessible || res.denialReason !== DENIAL_REASONS.SUBSCRIPTION_PAYMENT_REQUIRED) throw new Error(`Expected SUBSCRIPTION_PAYMENT_REQUIRED for ${status}`);
    });
  }

  await runTest('46. incomplete_expired nega', 'u1', 'org1', 'musicscale', db => {
    setupUserAndOrg(db, 'user', 'active', 'active', true, 'incomplete_expired', 'active');
  }, res => {
    if (res.accessible || res.denialReason !== DENIAL_REASONS.SUBSCRIPTION_INACTIVE) throw new Error('Expected SUBSCRIPTION_INACTIVE');
  });

  await runTest('47. trial legado nega', 'u1', 'org1', 'musicscale', db => {
    setupUserAndOrg(db, 'user', 'active', 'active', true, 'trial', 'active');
  }, res => {
    if (res.accessible) throw new Error('Expected denial for trial');
  });

  await runTest('48. pro como status nega', 'u1', 'org1', 'musicscale', db => {
    setupUserAndOrg(db, 'user', 'active', 'active', true, 'pro', 'active');
  }, res => {
    if (res.accessible) throw new Error('Expected denial for pro');
  });

  await runTest('49. none nega', 'u1', 'org1', 'musicscale', db => {
    setupUserAndOrg(db, 'user', 'active', 'active', true, 'none', 'active');
  }, res => {
    if (res.accessible || res.denialReason !== DENIAL_REASONS.SUBSCRIPTION_INACTIVE) throw new Error('Expected SUBSCRIPTION_INACTIVE');
  });

  await runTest('50. expired nega', 'u1', 'org1', 'musicscale', db => {
    setupUserAndOrg(db, 'user', 'active', 'active', true, 'expired', 'active');
  }, res => {
    if (res.accessible || res.denialReason !== DENIAL_REASONS.SUBSCRIPTION_INACTIVE) throw new Error('Expected SUBSCRIPTION_INACTIVE');
  });

  await runTest('51. status desconhecido nega', 'u1', 'org1', 'musicscale', db => {
    setupUserAndOrg(db, 'user', 'active', 'active', true, 'unknown_magic', 'active');
  }, res => {
    if (res.accessible) throw new Error('Expected denial for unknown status');
  });

  await runTest('52. documento subscription ausente nega', 'u1', 'org1', 'musicscale', db => {
    setupUserAndOrg(db);
    db.setMockData('subscriptions/org1', null);
  }, res => {
    if (res.accessible || res.denialReason !== DENIAL_REASONS.SUBSCRIPTION_NOT_FOUND) throw new Error('Expected SUBSCRIPTION_NOT_FOUND');
  });

  await runTest('53. subscription ativa + organizations.apps.musicscale ausente nega', 'u1', 'org1', 'musicscale', db => {
    setupUserAndOrg(db);
    db.setMockData('organizations/org1', { status: 'active' }); // missing apps object
  }, res => {
    if (res.accessible || res.denialReason !== DENIAL_REASONS.ENTITLEMENT_NOT_CONFIGURED) throw new Error('Expected ENTITLEMENT_NOT_CONFIGURED');
  });

  await runTest('54. subscription ativa + app status canceled nega', 'u1', 'org1', 'musicscale', db => {
    setupUserAndOrg(db, 'user', 'active', 'active', true, 'active', 'canceled');
  }, res => {
    if (res.accessible || res.denialReason !== DENIAL_REASONS.ENTITLEMENT_INACTIVE) throw new Error('Expected ENTITLEMENT_INACTIVE');
  });

  await runTest('55. subscription ativa + app status past_due nega', 'u1', 'org1', 'musicscale', db => {
    setupUserAndOrg(db, 'user', 'active', 'active', true, 'active', 'past_due');
  }, res => {
    if (res.accessible || res.denialReason !== DENIAL_REASONS.ENTITLEMENT_INACTIVE) throw new Error('Expected ENTITLEMENT_INACTIVE');
  });

  await runTest('56. subscription ativa + app status desconhecido nega', 'u1', 'org1', 'musicscale', db => {
    setupUserAndOrg(db, 'user', 'active', 'active', true, 'active', 'some_unknown');
  }, res => {
    if (res.accessible || res.denialReason !== DENIAL_REASONS.ENTITLEMENT_INACTIVE) throw new Error('Expected ENTITLEMENT_INACTIVE');
  });

  await runTest('57. organizations.apps.musicscale.access true sozinho não concede', 'u1', 'org1', 'musicscale', db => {
    setupUserAndOrg(db, 'user', 'active', 'active', true, 'canceled', 'canceled');
    db.setMockData('organizations/org1', { status: 'active', apps: { musicscale: { access: true, status: 'canceled' } } });
  }, res => {
    if (res.accessible) throw new Error('Expected denial');
  });

  await runTest('58. organizations.subscriptionStatus active sozinho não concede', 'u1', 'org1', 'musicscale', db => {
    setupUserAndOrg(db, 'user', 'active', 'active', true, 'canceled', 'canceled');
    db.setMockData('organizations/org1', { status: 'active', subscriptionStatus: 'active', apps: { musicscale: { status: 'canceled' } } });
  }, res => {
    if (res.accessible) throw new Error('Expected denial');
  });

  await runTest('59. organizations.plan pro sozinho não concede', 'u1', 'org1', 'musicscale', db => {
    setupUserAndOrg(db, 'user', 'active', 'active', true, 'canceled', 'canceled');
    db.setMockData('organizations/org1', { status: 'active', plan: 'pro', apps: { musicscale: { status: 'canceled' } } });
  }, res => {
    if (res.accessible) throw new Error('Expected denial');
  });

  await runTest('60. users.subscription active sozinho não concede', 'u1', 'org1', 'musicscale', db => {
    setupUserAndOrg(db, 'user', 'active', 'active', true, 'canceled', 'canceled');
    db.setMockData('users/u1', { status: 'active', subscription: 'active' });
  }, res => {
    if (res.accessible) throw new Error('Expected denial');
  });

  // ISOLAMENTO
  await runTest('61. Assinatura ativa em outra organização não concede para a organização solicitada', 'u1', 'org1', 'musicscale', db => {
    setupUserAndOrg(db);
    db.setMockData('subscriptions/org1', { status: 'canceled' });
    db.setMockData('subscriptions/org2', { status: 'active' });
  }, res => {
    if (res.accessible) throw new Error('Expected denial');
  });

  await runTest('62. Membership em outra organização não concede', 'u1', 'org1', 'musicscale', db => {
    setupUserAndOrg(db);
    db.setMockData('organizations/org1/members/u1', null);
    db.setMockData('organizations/org2/members/u1', { status: 'active' });
  }, res => {
    if (res.accessible) throw new Error('Expected denial');
  });

  await runTest('63. Resolver não procura outra organização', 'u1', 'org1', 'musicscale', db => {
    setupUserAndOrg(db);
  }, (res, db) => {
    if (db.accessedPaths.some(p => p.includes('org2'))) throw new Error('Should not access org2');
  });

  await runTest('64. Resolver não consulta organization_members', 'u1', 'org1', 'musicscale', db => {
    setupUserAndOrg(db);
  }, (res, db) => {
    if (db.accessedPaths.some(p => p.includes('organization_members'))) throw new Error('Should not access organization_members');
  });

  await runTest('65. Resolver não busca por e-mail', 'u1', 'org1', 'musicscale', db => {
    setupUserAndOrg(db);
  }, (res, db) => {
    if (db.queryAttempts !== 0) throw new Error('Executed a query attempt (possibly search by email)');
    if (db.accessedPaths.some(p => p.includes('@'))) throw new Error('Accessed a path containing an email address');
    if (db.collectionCalls.some(c => c === 'users' && db.queryAttempts > 0)) throw new Error('Attempted query on users collection');
  });

  await runTest('66. Resolver não consulta Stripe', 'u1', 'org1', 'musicscale', db => {
    setupUserAndOrg(db);
  }, async (res, db) => {
    if (networkAttempts !== 0) throw new Error('Executed a network attempt (possibly Stripe)');
    const fs = await import('fs');
    const resolverCode = fs.readFileSync('src/server/services/EcosystemAccessResolver.ts', 'utf8');
    if (resolverCode.includes('import Stripe') || resolverCode.includes('stripe.') || resolverCode.includes('axios') || resolverCode.includes('checkout.sessions')) {
      throw new Error('Resolver contains structural evidence of Stripe/HTTP integration');
    }
  });

  await runTest('67. Resolver não escreve no Firestore', 'u1', 'org1', 'musicscale', db => {
    setupUserAndOrg(db);
  }, (res, db) => {
    if (db.writeAttempts !== 0 || db.batchAttempts !== 0 || db.transactionAttempts !== 0) {
      throw new Error('Write attempts detected');
    }
  });

  await runTest('68. Resolver não repara documentos', 'u1', 'org1', 'musicscale', db => {
    setupUserAndOrg(db);
    db.setMockData('organizations/org1/members/u1', { status: 'invalid_status_repair_test' });
  }, (res, db) => {
    if (db.writeAttempts !== 0 || db.batchAttempts !== 0 || db.transactionAttempts !== 0) {
      throw new Error('Write operation executed');
    }
    if (db.getSnapshot() !== db.initialSnapshot) {
       throw new Error('Document was altered by resolver (snapshot mismatch)');
    }
  });

  await runTest('69. O organizationId retornado é exatamente o solicitado e validado', 'u1', 'org1', 'musicscale', db => {
    setupUserAndOrg(db);
  }, res => {
    if (res.organizationId !== 'org1') throw new Error('Mismatched organizationId');
  });

  await runTest('70. Generic admin sem membership permanece negado', 'u1', 'org1', 'musicscale', db => {
    db.setMockData('users/u1', { status: 'active', systemRole: 'admin' });
    db.setMockData('organizations/org1', { status: 'active', apps: { musicscale: { status: 'active' } } });
    db.setMockData('subscriptions/org1', { status: 'active' });
    // No membership
  }, res => {
    if (res.accessible || res.denialReason !== DENIAL_REASONS.MEMBERSHIP_NOT_FOUND) throw new Error('Expected MEMBERSHIP_NOT_FOUND');
  });

  // REGRESSÃO NESTFINANCE
  await runTest('71. Gate de desenvolvimento do NestFinance prevalece antes de enabledApps', 'u1', 'org1', 'nestfinance', db => {
    setupUserAndOrg(db);
    db.setMockData('organizations/org1', { status: 'active', enabledApps: ['musicscale'] });
  }, res => {
    if (res.accessible || res.denialReason !== DENIAL_REASONS.NESTFINANCE_DEVELOPMENT_ACCESS_RESTRICTED || res.decisionState !== 'denied' || res.accessSource !== 'denied') throw new Error('Expected NESTFINANCE_DEVELOPMENT_ACCESS_RESTRICTED');
  });

  await runTest('72. enabledApps não contorna gate de desenvolvimento do NestFinance', 'u1', 'org1', 'nestfinance', db => {
    setupUserAndOrg(db);
    db.setMockData('organizations/org1', { status: 'active', enabledApps: ['nestfinance'] });
  }, res => {
    if (res.accessible || res.denialReason !== DENIAL_REASONS.NESTFINANCE_DEVELOPMENT_ACCESS_RESTRICTED || res.decisionState !== 'denied' || res.accessSource !== 'denied') throw new Error('Expected NESTFINANCE_DEVELOPMENT_ACCESS_RESTRICTED');
  });

  await runTest('73. entitlement e appAccess não contornam gate de desenvolvimento', 'u1', 'org1', 'nestfinance', db => {
    setupUserAndOrg(db);
    db.setMockData('organizations/org1', { 
       status: 'active', 
       enabledApps: ['nestfinance'],
       entitlements: { nestfinance: { active: true } }
    });
    db.setMockData('organizations/org1/members/u1', { 
       status: 'active',
       appAccess: { nestFinance: { enabled: false } }
    });
  }, res => {
    if (res.accessible || res.denialReason !== DENIAL_REASONS.NESTFINANCE_DEVELOPMENT_ACCESS_RESTRICTED || res.decisionState !== 'denied' || res.accessSource !== 'denied') throw new Error('Expected NESTFINANCE_DEVELOPMENT_ACCESS_RESTRICTED');
  });

  await runTest('74. configuração legada completa não contorna gate de desenvolvimento', 'u1', 'org1', 'nestfinance', db => {
    setupUserAndOrg(db);
    db.setMockData('organizations/org1', { 
       status: 'active', 
       enabledApps: ['nestfinance'],
       entitlements: { nestfinance: { active: true } }
    });
    db.setMockData('organizations/org1/members/u1', { 
       status: 'active',
       appAccess: { nestFinance: { enabled: true, roles: ['manager'] } }
    });
  }, res => {
    if (res.accessible || res.denialReason !== DENIAL_REASONS.NESTFINANCE_DEVELOPMENT_ACCESS_RESTRICTED || res.decisionState !== 'denied' || res.accessSource !== 'denied') throw new Error('Expected NESTFINANCE_DEVELOPMENT_ACCESS_RESTRICTED');
    if (res.roles && res.roles.includes('manager')) throw new Error('Expected roles not to contain manager');
  });

  await runTest('75. Global role canônica continua concedendo acesso ao NestFinance', 'u1', 'org1', 'nestfinance', db => {
    db.setMockData('users/u1', { status: 'active', systemRole: 'ceo' });
    db.setMockData('organizations/org1', { status: 'active' });
  }, res => {
    if (!res.accessible || !res.isGlobalAccess) throw new Error('Expected global access');
  });

  
  await runTest('76. user.status disabled nega USER_INACTIVE', 'u1', 'org1', 'musicscale', db => {
    setupUserAndOrg(db, 'user', 'active', 'active', true, 'active', 'active');
    db.setMockData('users/u1', { status: 'disabled', systemRole: 'user' });
  }, res => {
    if (res.accessible || res.denialReason !== DENIAL_REASONS.USER_INACTIVE) throw new Error('Expected USER_INACTIVE');
  });
  await runTest('77. organization.status disabled nega ORGANIZATION_INACTIVE', 'u1', 'org1', 'musicscale', db => {
    setupUserAndOrg(db, 'user', 'disabled', 'active', true, 'active', 'active');
  }, res => {
    if (res.accessible || res.denialReason !== DENIAL_REASONS.ORGANIZATION_INACTIVE) throw new Error('Expected ORGANIZATION_INACTIVE');
  });
  await runTest('78. membership.enabled false nega MEMBERSHIP_INACTIVE', 'u1', 'org1', 'musicscale', db => {
    setupUserAndOrg(db, 'user', 'active', 'active', true, 'active', 'active');
    db.setMockData('organizations/org1/members/u1', { status: 'active', enabled: false });
  }, res => {
    if (res.accessible || res.denialReason !== DENIAL_REASONS.MEMBERSHIP_INACTIVE) throw new Error('Expected MEMBERSHIP_INACTIVE');
  });
  await runTest('79. membership.enabled true permite prosseguir', 'u1', 'org1', 'musicscale', db => {
    setupUserAndOrg(db, 'user', 'active', 'active', true, 'active', 'active');
    db.setMockData('organizations/org1/members/u1', { status: 'active', enabled: true, appAccess: { musicscale: { enabled: true } } });
  }, res => {
    if (!res.accessible) throw new Error('Expected access');
  });
  await runTest('80. ceo retorna roles exatamente [\"ceo\"]', 'u1', 'org1', 'musicscale', db => {
    setupUserAndOrg(db, 'ceo');
  }, res => {
    if (!res.accessible || res.roles.length !== 1 || res.roles[0] !== 'ceo') throw new Error('Expected roles: ["ceo"]');
  });
  await runTest('81. global_admin retorna roles exatamente [\"global_admin\"]', 'u1', 'org1', 'musicscale', db => {
    setupUserAndOrg(db, 'global_admin');
  }, res => {
    if (!res.accessible || res.roles.length !== 1 || res.roles[0] !== 'global_admin') throw new Error('Expected roles: ["global_admin"]');
  });
  await runTest('82. ecosystem_owner retorna roles exatamente [\"ecosystem_owner\"]', 'u1', 'org1', 'musicscale', db => {
    setupUserAndOrg(db, 'ecosystem_owner');
  }, res => {
    if (!res.accessible || res.roles.length !== 1 || res.roles[0] !== 'ecosystem_owner') throw new Error('Expected roles: ["ecosystem_owner"]');
  });
  await runTest('83. founder retorna roles exatamente [\"founder\"]', 'u1', 'org1', 'musicscale', db => {
    setupUserAndOrg(db, 'founder');
  }, res => {
    if (!res.accessible || res.roles.length !== 1 || res.roles[0] !== 'founder') throw new Error('Expected roles: ["founder"]');
  });
  await runTest('84. subscription trialing + app active retorna canonicalStatus trialing', 'u1', 'org1', 'musicscale', db => {
    setupUserAndOrg(db, 'user', 'active', 'active', true, 'trialing', 'active');
  }, res => {
    if (!res.accessible || res.entitlement?.canonicalStatus !== 'trialing') throw new Error('Expected trialing canonicalStatus');
  });
  await runTest('85. subscription active + app trialing retorna canonicalStatus active', 'u1', 'org1', 'musicscale', db => {
    setupUserAndOrg(db, 'user', 'active', 'active', true, 'active', 'trialing');
  }, res => {
    if (!res.accessible || res.entitlement?.canonicalStatus !== 'active') throw new Error('Expected active canonicalStatus');
  });
  await runTest('86. writeAttempts permanece zero', 'u1', 'org1', 'musicscale', db => {
    setupUserAndOrg(db);
  }, (res, db) => {
    if (db.writeAttempts !== 0) throw new Error('Expected writeAttempts 0');
  });
  await runTest('87. batchAttempts permanece zero', 'u1', 'org1', 'musicscale', db => {
    setupUserAndOrg(db);
  }, (res, db) => {
    if (db.batchAttempts !== 0) throw new Error('Expected batchAttempts 0');
  });
  await runTest('88. transactionAttempts permanece zero', 'u1', 'org1', 'musicscale', db => {
    setupUserAndOrg(db);
  }, (res, db) => {
    if (db.transactionAttempts !== 0) throw new Error('Expected transactionAttempts 0');
  });
  await runTest('89. queryAttempts permanece zero', 'u1', 'org1', 'musicscale', db => {
    setupUserAndOrg(db);
  }, (res, db) => {
    if (db.queryAttempts !== 0) throw new Error('Expected queryAttempts 0');
  });
  await runTest('90. networkAttempts permanece zero', 'u1', 'org1', 'musicscale', db => {
    setupUserAndOrg(db);
  }, (res, db) => {
    if (networkAttempts !== 0) throw new Error('Expected networkAttempts 0');
  });
  await runTest('91. somente paths permitidos foram lidos no fluxo MusicScale organizacional', 'u1', 'org1', 'musicscale', db => {
    setupUserAndOrg(db);
  }, (res, db) => {
    const allowed = ['users/u1', 'organizations/org1', 'organizations/org1/members/u1', 'subscriptions/org1'];
    for (const path of db.accessedPaths) {
      if (!allowed.includes(path)) throw new Error('Accessed unallowed path: ' + path);
    }
  });
  await runTest('92. acesso global não lê membership', 'u1', 'org1', 'musicscale', db => {
    setupUserAndOrg(db, 'ceo');
  }, (res, db) => {
    if (db.accessedPaths.some(p => p.includes('members'))) throw new Error('Global access should not read membership');
  });
  await runTest('93. acesso global não lê subscription', 'u1', 'org1', 'musicscale', db => {
    setupUserAndOrg(db, 'ceo');
  }, (res, db) => {
    if (db.accessedPaths.some(p => p.includes('subscriptions'))) throw new Error('Global access should not read subscription');
  });
  await runTest('94. admin não recebe role global nem permissões globais', 'u1', 'org1', 'musicscale', db => {
    db.setMockData('users/u1', { status: 'active', systemRole: 'admin' });
    db.setMockData('organizations/org1', { status: 'active' });
  }, res => {
    if (res.isGlobalAccess || res.accessible || res.denialReason !== DENIAL_REASONS.MEMBERSHIP_NOT_FOUND) throw new Error('Expected MEMBERSHIP_NOT_FOUND, got ' + res.denialReason);
  });
  await runTest('95. canceled com data futura continua negado após o endurecimento', 'u1', 'org1', 'musicscale', db => {
    setupUserAndOrg(db, 'user', 'active', 'active', true, 'canceled', 'active');
    db.setMockData('subscriptions/org1', { status: 'canceled', currentPeriodEnd: { toMillis: () => Date.now() + 100000 } });
  }, res => {
    if (res.accessible || res.denialReason !== DENIAL_REASONS.SUBSCRIPTION_INACTIVE) throw new Error('Expected SUBSCRIPTION_INACTIVE');
  });

  console.log(`\nTests finished. Passed: ${passed}, Failed: ${failed}`);
  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests();
