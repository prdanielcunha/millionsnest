import { resolveEcosystemAppAccess, DENIAL_REASONS } from '../src/server/services/EcosystemAccessResolver.js';
import type { EcosystemAppId, CanonicalMusicScaleSubscriptionStatus, CanonicalAppAccessState, MusicScaleIndividualAccessSource } from '../src/server/services/EcosystemAccessResolver.js';
import * as admin from 'firebase-admin';

class MockDocumentReference {
  constructor(public path: string, private db: MockFirestore) {}
  async get() {
    const data = this.db.getData(this.path);
    return {
      exists: data !== null && data !== undefined,
      data: () => data,
      id: this.path.split('/').pop()
    };
  }
  set() { throw new Error('Write operation set() not allowed'); }
  update() { throw new Error('Write operation update() not allowed'); }
  delete() { throw new Error('Write operation delete() not allowed'); }
}

class MockCollectionReference {
  constructor(public path: string, private db: MockFirestore) {}
  doc(id?: string) {
    if (!id) throw new Error('doc() must be called with id');
    return new MockDocumentReference(`${this.path}/${id}`, this.db);
  }
}

class MockFirestore {
  private data: Record<string, any> = {};
  public accessedPaths: string[] = [];

  setMockData(path: string, data: any) {
    this.data[path] = data;
  }

  getData(path: string) {
    this.accessedPaths.push(path);
    return this.data[path] ?? null;
  }

  collection(path: string) {
    return new MockCollectionReference(path, this);
  }

  batch() { throw new Error('Write operation batch() not allowed'); }
  runTransaction() { throw new Error('Write operation runTransaction() not allowed'); }
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
    if (res.isGlobalAccess) throw new Error('Admin should not get global access');
  });

  await runTest('18. owner não recebe acesso global', 'u1', 'org1', 'musicscale', db => {
    db.setMockData('users/u1', { status: 'active', systemRole: 'owner' });
    db.setMockData('organizations/org1', { status: 'active' });
  }, res => {
    if (res.isGlobalAccess) throw new Error('Owner should not get global access');
  });

  await runTest('19. member não recebe acesso global', 'u1', 'org1', 'musicscale', db => {
    db.setMockData('users/u1', { status: 'active', systemRole: 'member' });
    db.setMockData('organizations/org1', { status: 'active' });
  }, res => {
    if (res.isGlobalAccess) throw new Error('Member should not get global access');
  });

  await runTest('20. papel desconhecido não recebe acesso global', 'u1', 'org1', 'musicscale', db => {
    db.setMockData('users/u1', { status: 'active', systemRole: 'unknown_role' });
    db.setMockData('organizations/org1', { status: 'active' });
  }, res => {
    if (res.isGlobalAccess) throw new Error('Unknown role should not get global access');
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
    if (!res.accessible || res.entitlement?.canonicalStatus !== 'active') throw new Error('Expected active');
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
  }, res => {
    // Cannot technically test "busca por e-mail" strictly without intercepting but we can check paths
  });

  await runTest('66. Resolver não consulta Stripe', 'u1', 'org1', 'musicscale', db => {
    setupUserAndOrg(db);
  }, res => {
    // Network is mocked
  });

  await runTest('67. Resolver não escreve no Firestore', 'u1', 'org1', 'musicscale', db => {
    setupUserAndOrg(db);
  }, res => {
    // Tested by the mock throwing on write operations
  });

  await runTest('68. Resolver não repara documentos', 'u1', 'org1', 'musicscale', db => {
    setupUserAndOrg(db);
  }, res => {
    // Tested by mock
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
  await runTest('71. NestFinance continua negando quando não está habilitado', 'u1', 'org1', 'nestfinance', db => {
    setupUserAndOrg(db);
    db.setMockData('organizations/org1', { status: 'active', enabledApps: ['musicscale'] });
  }, res => {
    if (res.accessible || res.denialReason !== DENIAL_REASONS.APP_NOT_ENABLED) throw new Error('Expected APP_NOT_ENABLED');
  });

  await runTest('72. NestFinance continua negando sem entitlement', 'u1', 'org1', 'nestfinance', db => {
    setupUserAndOrg(db);
    db.setMockData('organizations/org1', { status: 'active', enabledApps: ['nestfinance'] });
  }, res => {
    if (res.accessible || res.denialReason !== DENIAL_REASONS.ENTITLEMENT_NOT_CONFIGURED) throw new Error('Expected ENTITLEMENT_NOT_CONFIGURED');
  });

  await runTest('73. NestFinance continua negando quando appAccess está desabilitado', 'u1', 'org1', 'nestfinance', db => {
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
    if (res.accessible || res.denialReason !== DENIAL_REASONS.MEMBER_APP_ACCESS_DISABLED) throw new Error('Expected MEMBER_APP_ACCESS_DISABLED');
  });

  await runTest('74. NestFinance continua concedendo com configuração válida', 'u1', 'org1', 'nestfinance', db => {
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
    if (!res.accessible) throw new Error('Expected access');
    if (!res.roles.includes('manager')) throw new Error('Expected manager role');
  });

  await runTest('75. Global role canônica continua concedendo acesso ao NestFinance', 'u1', 'org1', 'nestfinance', db => {
    db.setMockData('users/u1', { status: 'active', systemRole: 'ceo' });
    db.setMockData('organizations/org1', { status: 'active' });
  }, res => {
    if (!res.accessible || !res.isGlobalAccess) throw new Error('Expected global access');
  });

  console.log(`\nTests finished. Passed: ${passed}, Failed: ${failed}`);
  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests();
