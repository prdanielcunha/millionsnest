import assert from 'assert';
import { handleConnectSessionContextRequest } from '../src/server/services/ConnectSessionContextService.js';
import admin from 'firebase-admin';

const mockReq = (headers = {}) => ({ headers }) as any;
const mockRes = () => {
  const res: any = {
    statusCode: 200,
    body: null,
    headers: {},
    status: (code: number) => { res.statusCode = code; return res; },
    json: (data: any) => { res.body = data; return res; },
    setHeader: (k: string, v: string) => { res.headers[k] = v; return res; }
  };
  return res;
};

class MockDb {
  docs: Record<string, any> = {};
  setDoc(path: string, data: any) { this.docs[path] = data; }
  deleteDoc(path: string) { delete this.docs[path]; }
  
  collection(name: string) {
    const db = this;
    return {
      doc(id: string) {
        return {
          get: async () => {
            const data = db.docs[`${name}/${id}`];
            return { exists: !!data, data: () => data, id };
          },
          collection(subName: string) {
            return {
              doc(subId: string) {
                return {
                  get: async () => {
                    const data = db.docs[`${name}/${id}/${subName}/${subId}`];
                    return { exists: !!data, data: () => data, id: subId };
                  }
                }
              }
            }
          }
        }
      },
      where(field: any, op: string, val: any) {
        return {
          limit() { return this; },
          get: async () => {
            const results = Object.keys(db.docs)
              .filter(k => k.startsWith(name + '/'))
              .filter(k => k.split('/').length === 2)
              .filter(k => {
                if (field === admin.firestore.FieldPath.documentId()) {
                  const id = k.split('/')[1];
                  return Array.isArray(val) && val.includes(id);
                }
                const data = db.docs[k];
                if (!data) return false;
                if (op === '==') return data[field] === val;
                return false;
              });
            return { docs: results.map(k => ({ id: k.split('/')[1], data: () => db.docs[k] })) };
          }
        }
      }
    };
  }
}

let passes = 0, failures = 0;
let currentScenario = 0;
let assertions = 0;

function customAssert(condition: boolean, msg: string) {
  assertions++;
  if (!condition) throw new Error(msg);
}
function assertEqual(actual: any, expected: any, msg: string) {
  assertions++;
  if (actual !== expected) throw new Error(`${msg}: expected ${expected} but got ${actual}`);
}
function assertDeepEqual(actual: any, expected: any, msg: string) {
  assertions++;
  assert.deepStrictEqual(actual, expected, msg);
}

async function runScenario(name: string, fn: () => Promise<void>) {
  currentScenario++;
  try {
    await fn();
    console.log(`[PASS] ${currentScenario}. ${name}`);
    passes++;
  } catch (e: any) {
    console.error(`[FAIL] ${currentScenario}. ${name} - ${e.message}`);
    failures++;
  }
}

async function main() {
  console.log('Starting ConnectSessionContext tests...\n');
  let db = new MockDb();
  let deps = {
    verifyIdToken: async (token: string) => {
      if (token === 'valid') return { uid: 'user123' } as admin.auth.DecodedIdToken;
      if (token === 'nouid') return {} as admin.auth.DecodedIdToken;
      if (token === 'emptyuid') return { uid: '   ' } as admin.auth.DecodedIdToken;
      throw new Error('Invalid token');
    },
    getDb: () => db as any,
    logger: {
      error: (msg: string, meta?: unknown) => { deps.lastError = { msg, meta }; },
      info: (msg: string, meta?: unknown) => { deps.lastInfo = { msg, meta }; }
    } as any,
    lastError: null as any,
    lastInfo: null as any
  };

  const reset = () => {
    db = new MockDb();
    deps.lastError = null;
    deps.lastInfo = null;
    deps.getDb = () => db as any;
    db.setDoc('users/user123', { name: 'User 123', status: 'active' });
  };

  const tests: [string, () => Promise<void>][] = [];
  const add = (name: string, fn: () => Promise<void>) => tests.push([name, fn]);

  // 1-9
  add("Header ausente.", async () => {
    const req = mockReq(); const res = mockRes();
    await handleConnectSessionContextRequest(req, res, deps);
    assertEqual(res.statusCode, 401, 'status');
  });
  add("Header duplicado.", async () => {
    const req = mockReq({ authorization: ['Bearer valid', 'Bearer valid'] }); const res = mockRes();
    await handleConnectSessionContextRequest(req, res, deps);
    assertEqual(res.statusCode, 401, 'status');
  });
  add("Authorization representado como array.", async () => {
    const req = mockReq({ authorization: ['Bearer valid'] }); const res = mockRes();
    await handleConnectSessionContextRequest(req, res, deps);
    assertEqual(res.statusCode, 401, 'status');
  });
  add("Esquema Basic.", async () => {
    const req = mockReq({ authorization: 'Basic valid' }); const res = mockRes();
    await handleConnectSessionContextRequest(req, res, deps);
    assertEqual(res.statusCode, 401, 'status');
  });
  add("Bearer vazio.", async () => {
    const req = mockReq({ authorization: 'Bearer   ' }); const res = mockRes();
    await handleConnectSessionContextRequest(req, res, deps);
    assertEqual(res.statusCode, 401, 'status');
  });
  add("Token com formatação inválida.", async () => {
    const req = mockReq({ authorization: 'Bearerinvalid' }); const res = mockRes();
    await handleConnectSessionContextRequest(req, res, deps);
    assertEqual(res.statusCode, 401, 'status');
  });
  add("Token inválido.", async () => {
    const req = mockReq({ authorization: 'Bearer invalid' }); const res = mockRes();
    await handleConnectSessionContextRequest(req, res, deps);
    assertEqual(res.statusCode, 401, 'status');
  });
  add("Token decodificado sem UID.", async () => {
    const req = mockReq({ authorization: 'Bearer nouid' }); const res = mockRes();
    await handleConnectSessionContextRequest(req, res, deps);
    assertEqual(res.statusCode, 401, 'status');
  });
  add("UID vazio.", async () => {
    const req = mockReq({ authorization: 'Bearer emptyuid' }); const res = mockRes();
    await handleConnectSessionContextRequest(req, res, deps);
    assertEqual(res.statusCode, 401, 'status');
  });

  // 10-23
  add("Banco indisponível.", async () => {
    const req = mockReq({ authorization: 'Bearer valid' }); const res = mockRes();
    await handleConnectSessionContextRequest(req, res, { ...deps, getDb: () => null });
    assertEqual(res.statusCode, 503, 'status');
  });
  add("Usuário inexistente retorna 404 USER_NOT_FOUND.", async () => {
    db.deleteDoc('users/user123');
    const req = mockReq({ authorization: 'Bearer valid' }); const res = mockRes();
    await handleConnectSessionContextRequest(req, res, deps);
    assertEqual(res.statusCode, 404, 'status');
  });
  add("Usuário inactive retorna 403 USER_INACTIVE.", async () => {
    db.setDoc('users/user123', { status: 'inactive' });
    const req = mockReq({ authorization: 'Bearer valid' }); const res = mockRes();
    await handleConnectSessionContextRequest(req, res, deps);
    assertEqual(res.statusCode, 403, 'status');
  });
  add("Usuário suspended retorna 403 USER_INACTIVE.", async () => {
    db.setDoc('users/user123', { status: 'suspended' });
    const req = mockReq({ authorization: 'Bearer valid' }); const res = mockRes();
    await handleConnectSessionContextRequest(req, res, deps);
    assertEqual(res.statusCode, 403, 'status');
  });
  add("Usuário disabled por status retorna 403 USER_INACTIVE.", async () => {
    db.setDoc('users/user123', { status: 'disabled' });
    const req = mockReq({ authorization: 'Bearer valid' }); const res = mockRes();
    await handleConnectSessionContextRequest(req, res, deps);
    assertEqual(res.statusCode, 403, 'status');
  });
  add("disabled === true retorna 403 USER_INACTIVE.", async () => {
    db.setDoc('users/user123', { disabled: true });
    const req = mockReq({ authorization: 'Bearer valid' }); const res = mockRes();
    await handleConnectSessionContextRequest(req, res, deps);
    assertEqual(res.statusCode, 403, 'status');
  });
  add("Usuário removed retorna 403 USER_INACTIVE.", async () => {
    db.setDoc('users/user123', { status: 'removed' });
    const req = mockReq({ authorization: 'Bearer valid' }); const res = mockRes();
    await handleConnectSessionContextRequest(req, res, deps);
    assertEqual(res.statusCode, 403, 'status');
  });
  add("Usuário comum ativo.", async () => {
    const req = mockReq({ authorization: 'Bearer valid' }); const res = mockRes();
    await handleConnectSessionContextRequest(req, res, deps);
    assertEqual(res.statusCode, 200, 'status');
    assertEqual(res.body.user.uid, 'user123', 'uid');
  });
  add("Campos de usuário com tipos inválidos são sanitizados.", async () => {
    db.setDoc('users/user123', { displayName: 123, photoURL: {}, locale: [], systemRole: 456 });
    const req = mockReq({ authorization: 'Bearer valid' }); const res = mockRes();
    await handleConnectSessionContextRequest(req, res, deps);
    assertEqual(res.body.user.displayName, null, 'displayName');
    assertEqual(res.body.user.photoUrl, null, 'photoUrl');
    assertEqual(res.body.user.locale, null, 'locale');
    assertEqual(res.body.user.systemRole, 'user', 'systemRole');
  });
  add("Capabilities removem valores não string.", async () => {
    db.setDoc('users/user123', { capabilities: ['a', 123, 'b'] });
    const req = mockReq({ authorization: 'Bearer valid' }); const res = mockRes();
    await handleConnectSessionContextRequest(req, res, deps);
    assertDeepEqual(res.body.user.capabilities, ['a', 'b'], 'capabilities');
  });
  add("Capabilities removem vazias.", async () => {
    db.setDoc('users/user123', { capabilities: ['a', '  ', 'b'] });
    const req = mockReq({ authorization: 'Bearer valid' }); const res = mockRes();
    await handleConnectSessionContextRequest(req, res, deps);
    assertDeepEqual(res.body.user.capabilities, ['a', 'b'], 'capabilities');
  });
  add("Capabilities são deduplicadas.", async () => {
    db.setDoc('users/user123', { capabilities: ['a', 'b', 'a'] });
    const req = mockReq({ authorization: 'Bearer valid' }); const res = mockRes();
    await handleConnectSessionContextRequest(req, res, deps);
    assertDeepEqual(res.body.user.capabilities, ['a', 'b'], 'capabilities');
  });
  add("Capabilities respeitam limite defensivo.", async () => {
    const caps = Array.from({length: 150}, (_, i) => `c${i}`);
    db.setDoc('users/user123', { capabilities: caps });
    const req = mockReq({ authorization: 'Bearer valid' }); const res = mockRes();
    await handleConnectSessionContextRequest(req, res, deps);
    assertEqual(res.body.user.capabilities.length, 100, 'capabilities count');
  });
  add("E-mail não aparece na resposta.", async () => {
    db.setDoc('users/user123', { email: 'test@example.com' });
    const req = mockReq({ authorization: 'Bearer valid' }); const res = mockRes();
    await handleConnectSessionContextRequest(req, res, deps);
    customAssert(JSON.stringify(res.body).indexOf('test@example.com') === -1, 'no email');
  });

  // 24-34
  ['ceo', 'global_admin', 'ecosystem_owner', 'founder'].forEach(role => {
    add(`${role} recebe globalAccess.`, async () => {
      db.setDoc('users/user123', { systemRole: role });
      const req = mockReq({ authorization: 'Bearer valid' }); const res = mockRes();
      await handleConnectSessionContextRequest(req, res, deps);
      assertEqual(res.body.globalAccess, true, 'globalAccess');
    });
  });
  ['admin', 'owner', 'support', 'ecosystem_support', 'user', 'unknown'].forEach(role => {
    add(`${role} não recebe globalAccess.`, async () => {
      db.setDoc('users/user123', { systemRole: role });
      const req = mockReq({ authorization: 'Bearer valid' }); const res = mockRes();
      await handleConnectSessionContextRequest(req, res, deps);
      assertEqual(res.body.globalAccess, false, 'globalAccess');
    });
  });
  add("papel global não adiciona '*' a user.capabilities.", async () => {
    db.setDoc('users/user123', { systemRole: 'ceo' });
    const req = mockReq({ authorization: 'Bearer valid' }); const res = mockRes();
    await handleConnectSessionContextRequest(req, res, deps);
    customAssert(!res.body.user.capabilities.includes('*'), 'no wildcard capability');
  });
  add("papel global não fabrica owner local.", async () => {
    db.setDoc('users/user123', { systemRole: 'ceo', activeOrganizationId: 'org1' });
    db.setDoc('organizations/org1', { name: 'Org 1' });
    const req = mockReq({ authorization: 'Bearer valid' }); const res = mockRes();
    await handleConnectSessionContextRequest(req, res, deps);
    assertEqual(res.body.organizations[0].organizationRole, null, 'org role is null');
  });

  // 35-66
  add("Usuário sem candidatos retorna lista vazia.", async () => {
    const req = mockReq({ authorization: 'Bearer valid' }); const res = mockRes();
    await handleConnectSessionContextRequest(req, res, deps);
    assertEqual(res.body.organizations.length, 0, 'orgs empty');
  });
  add("Uma membership canônica ativa concede acesso.", async () => {
    db.setDoc('users/user123', { activeOrganizationId: 'org1' });
    db.setDoc('organizations/org1', { name: 'Org 1' });
    db.setDoc('organizations/org1/members/user123', { role: 'member' });
    const req = mockReq({ authorization: 'Bearer valid' }); const res = mockRes();
    await handleConnectSessionContextRequest(req, res, deps);
    assertEqual(res.body.organizations.length, 1, 'org count');
  });
  add("Duas memberships canônicas ativas concedem acesso.", async () => {
    db.setDoc('users/user123', { organizationIds: ['org1', 'org2'] });
    db.setDoc('organizations/org1', { name: 'Org 1' });
    db.setDoc('organizations/org1/members/user123', { role: 'member' });
    db.setDoc('organizations/org2', { name: 'Org 2' });
    db.setDoc('organizations/org2/members/user123', { role: 'member' });
    const req = mockReq({ authorization: 'Bearer valid' }); const res = mockRes();
    await handleConnectSessionContextRequest(req, res, deps);
    assertEqual(res.body.organizations.length, 2, 'org count');
  });
  ['inactive', 'suspended', 'disabled', 'removed', 'revoked', 'archived'].forEach(s => {
    add(`Membership ${s} é excluída.`, async () => {
      db.setDoc('users/user123', { organizationId: 'org1' });
      db.setDoc('organizations/org1', { name: 'Org 1' });
      db.setDoc('organizations/org1/members/user123', { status: s, role: 'member' });
      const req = mockReq({ authorization: 'Bearer valid' }); const res = mockRes();
      await handleConnectSessionContextRequest(req, res, deps);
      assertEqual(res.body.organizations.length, 0, 'org count');
    });
  });
  add("Membership enabled === false é excluída.", async () => {
    db.setDoc('users/user123', { organizationId: 'org1' });
    db.setDoc('organizations/org1', { name: 'Org 1' });
    db.setDoc('organizations/org1/members/user123', { enabled: false, role: 'member' });
    const req = mockReq({ authorization: 'Bearer valid' }); const res = mockRes();
    await handleConnectSessionContextRequest(req, res, deps);
    assertEqual(res.body.organizations.length, 0, 'org count');
  });
  ['inactive', 'suspended', 'disabled', 'archived'].forEach(s => {
    add(`Organização ${s} é excluída.`, async () => {
      db.setDoc('users/user123', { organizationId: 'org1' });
      db.setDoc('organizations/org1', { name: 'Org 1', status: s });
      db.setDoc('organizations/org1/members/user123', { role: 'member' });
      const req = mockReq({ authorization: 'Bearer valid' }); const res = mockRes();
      await handleConnectSessionContextRequest(req, res, deps);
      assertEqual(res.body.organizations.length, 0, 'org count');
    });
  });
  add("Organização disabled === true é excluída.", async () => {
    db.setDoc('users/user123', { organizationId: 'org1' });
    db.setDoc('organizations/org1', { name: 'Org 1', disabled: true });
    db.setDoc('organizations/org1/members/user123', { role: 'member' });
    const req = mockReq({ authorization: 'Bearer valid' }); const res = mockRes();
    await handleConnectSessionContextRequest(req, res, deps);
    assertEqual(res.body.organizations.length, 0, 'org count');
  });
  add("Ponteiro para organização inexistente é ignorado.", async () => {
    db.setDoc('users/user123', { organizationId: 'org1' });
    const req = mockReq({ authorization: 'Bearer valid' }); const res = mockRes();
    await handleConnectSessionContextRequest(req, res, deps);
    assertEqual(res.body.organizations.length, 0, 'org count');
  });
  add("organizationId legado sem membership não concede acesso.", async () => {
    db.setDoc('users/user123', { organizationId: 'org1' });
    db.setDoc('organizations/org1', { name: 'Org 1' });
    const req = mockReq({ authorization: 'Bearer valid' }); const res = mockRes();
    await handleConnectSessionContextRequest(req, res, deps);
    assertEqual(res.body.organizations.length, 0, 'org count');
  });
  add("organization_members legado sem membership canônica não concede acesso.", async () => {
    db.setDoc('organization_members/user123_org1', { uid: 'user123', organizationId: 'org1' });
    db.setDoc('organizations/org1', { name: 'Org 1' });
    const req = mockReq({ authorization: 'Bearer valid' }); const res = mockRes();
    await handleConnectSessionContextRequest(req, res, deps);
    assertEqual(res.body.organizations.length, 0, 'org count');
  });
  add("ownerUid sem membership não concede acesso.", async () => {
    db.setDoc('organizations/org1', { name: 'Org 1', ownerUid: 'user123' });
    const req = mockReq({ authorization: 'Bearer valid' }); const res = mockRes();
    await handleConnectSessionContextRequest(req, res, deps);
    assertEqual(res.body.organizations.length, 0, 'org count');
  });
  add("ownerUserId sem membership não concede acesso.", async () => {
    db.setDoc('organizations/org1', { name: 'Org 1', ownerUserId: 'user123' });
    const req = mockReq({ authorization: 'Bearer valid' }); const res = mockRes();
    await handleConnectSessionContextRequest(req, res, deps);
    assertEqual(res.body.organizations.length, 0, 'org count');
  });
  add("ownerId sem membership não concede acesso.", async () => {
    db.setDoc('organizations/org1', { name: 'Org 1', ownerId: 'user123' });
    const req = mockReq({ authorization: 'Bearer valid' }); const res = mockRes();
    await handleConnectSessionContextRequest(req, res, deps);
    assertEqual(res.body.organizations.length, 0, 'org count');
  });
  add("Candidato cross-tenant não expõe nome ou slug.", async () => {
    db.setDoc('users/user123', { organizationId: 'org1' });
    db.setDoc('organizations/org1', { name: 'Org 1', slug: 'org-1' });
    const req = mockReq({ authorization: 'Bearer valid' }); const res = mockRes();
    await handleConnectSessionContextRequest(req, res, deps);
    customAssert(JSON.stringify(res.body).indexOf('Org 1') === -1, 'no cross tenant name');
    customAssert(JSON.stringify(res.body).indexOf('org-1') === -1, 'no cross tenant slug');
  });
  add("IDs duplicados são deduplicados.", async () => {
    db.setDoc('users/user123', { organizationIds: ['org1', 'org1'] });
    db.setDoc('organizations/org1', { name: 'Org 1' });
    db.setDoc('organizations/org1/members/user123', { role: 'member' });
    const req = mockReq({ authorization: 'Bearer valid' }); const res = mockRes();
    await handleConnectSessionContextRequest(req, res, deps);
    assertEqual(res.body.organizations.length, 1, 'org count');
  });
  add("Limite defensivo é respeitado.", async () => {
    const orgs = Array.from({length: 60}, (_, i) => `org${i}`);
    db.setDoc('users/user123', { organizationIds: orgs });
    orgs.forEach(o => {
      db.setDoc(`organizations/${o}`, { name: 'Org' });
      db.setDoc(`organizations/${o}/members/user123`, { role: 'member' });
    });
    const req = mockReq({ authorization: 'Bearer valid' }); const res = mockRes();
    await handleConnectSessionContextRequest(req, res, deps);
    assertEqual(res.body.organizations.length, 50, 'org count limited');
  });
  add("Ordenação é determinística.", async () => {
    db.setDoc('users/user123', { organizationIds: ['org1', 'org2', 'org3'] });
    db.setDoc('organizations/org1', { name: 'C Org' });
    db.setDoc('organizations/org1/members/user123', { role: 'member' });
    db.setDoc('organizations/org2', { name: 'B Org' });
    db.setDoc('organizations/org2/members/user123', { role: 'admin' });
    db.setDoc('organizations/org3', { name: 'A Org' });
    db.setDoc('organizations/org3/members/user123', { role: 'owner' });
    const req = mockReq({ authorization: 'Bearer valid' }); const res = mockRes();
    await handleConnectSessionContextRequest(req, res, deps);
    assertEqual(res.body.organizations[0].id, 'org3', 'owner first');
    assertEqual(res.body.organizations[1].id, 'org2', 'admin second');
    assertEqual(res.body.organizations[2].id, 'org1', 'member third');
  });
  add("Role vem somente da membership real.", async () => {
    db.setDoc('users/user123', { activeOrganizationId: 'org1' });
    db.setDoc('organizations/org1', { name: 'Org 1', ownerUid: 'user123' });
    db.setDoc('organizations/org1/members/user123', { role: 'custom_role' });
    const req = mockReq({ authorization: 'Bearer valid' }); const res = mockRes();
    await handleConnectSessionContextRequest(req, res, deps);
    assertEqual(res.body.organizations[0].organizationRole, 'custom_role', 'role');
  });
  add("membershipStatus vem somente da membership real.", async () => {
    db.setDoc('users/user123', { activeOrganizationId: 'org1' });
    db.setDoc('organizations/org1', { name: 'Org 1', status: 'trialing' });
    db.setDoc('organizations/org1/members/user123', { role: 'member', status: 'pending' });
    const req = mockReq({ authorization: 'Bearer valid' }); const res = mockRes();
    await handleConnectSessionContextRequest(req, res, deps);
    assertEqual(res.body.organizations[0].membershipStatus, 'pending', 'status');
  });
  add("permissions são sanitizadas e deduplicadas.", async () => {
    db.setDoc('users/user123', { activeOrganizationId: 'org1' });
    db.setDoc('organizations/org1', { name: 'Org 1' });
    db.setDoc('organizations/org1/members/user123', { role: 'member', permissions: ['perm1', 'perm1', 123] });
    const req = mockReq({ authorization: 'Bearer valid' }); const res = mockRes();
    await handleConnectSessionContextRequest(req, res, deps);
    assertDeepEqual(res.body.organizations[0].permissions, ['perm1'], 'perms array');
  });
  add("permissions em formato de mapa são suportadas.", async () => {
    db.setDoc('users/user123', { activeOrganizationId: 'org1' });
    db.setDoc('organizations/org1', { name: 'Org 1' });
    db.setDoc('organizations/org1/members/user123', { role: 'member', permissions: { 'perm1': true, 'perm2': false } });
    const req = mockReq({ authorization: 'Bearer valid' }); const res = mockRes();
    await handleConnectSessionContextRequest(req, res, deps);
    assertDeepEqual(res.body.organizations[0].permissions, ['perm1'], 'perms map');
  });
  add("capabilities da membership são sanitizadas e deduplicadas.", async () => {
    db.setDoc('users/user123', { activeOrganizationId: 'org1' });
    db.setDoc('organizations/org1', { name: 'Org 1' });
    db.setDoc('organizations/org1/members/user123', { role: 'member', capabilities: ['cap1', 'cap1', 123] });
    const req = mockReq({ authorization: 'Bearer valid' }); const res = mockRes();
    await handleConnectSessionContextRequest(req, res, deps);
    assertDeepEqual(res.body.organizations[0].capabilities, ['cap1'], 'caps array');
  });
  add("enabledApps não são convertidos em capabilities.", async () => {
    db.setDoc('users/user123', { activeOrganizationId: 'org1' });
    db.setDoc('organizations/org1', { name: 'Org 1', enabledApps: ['app1'] });
    db.setDoc('organizations/org1/members/user123', { role: 'member' });
    const req = mockReq({ authorization: 'Bearer valid' }); const res = mockRes();
    await handleConnectSessionContextRequest(req, res, deps);
    customAssert(!res.body.organizations[0].capabilities.includes('app1'), 'no app in caps');
  });
  add("features não são convertidas em capabilities.", async () => {
    db.setDoc('users/user123', { activeOrganizationId: 'org1' });
    db.setDoc('organizations/org1', { name: 'Org 1', apps: { musicscale: { features: { a: true } } } });
    db.setDoc('organizations/org1/members/user123', { role: 'member' });
    const req = mockReq({ authorization: 'Bearer valid' }); const res = mockRes();
    await handleConnectSessionContextRequest(req, res, deps);
    customAssert(!res.body.organizations[0].capabilities.includes('musicscale.feature.a'), 'no feature in caps');
  });
  add("getDefaultPermissions não fabrica permissions.", async () => {
    db.setDoc('users/user123', { activeOrganizationId: 'org1' });
    db.setDoc('organizations/org1', { name: 'Org 1' });
    db.setDoc('organizations/org1/members/user123', { role: 'owner' });
    const req = mockReq({ authorization: 'Bearer valid' }); const res = mockRes();
    await handleConnectSessionContextRequest(req, res, deps);
    assertEqual(res.body.organizations[0].permissions.length, 0, 'no fabricated perms');
  });

  // 67-74
  add("activeOrganizationId autorizado tem prioridade.", async () => {
    db.setDoc('users/user123', { activeOrganizationId: 'org2', organizationIds: ['org1', 'org2'] });
    db.setDoc('organizations/org1', { name: 'Org 1' });
    db.setDoc('organizations/org1/members/user123', { role: 'member' });
    db.setDoc('organizations/org2', { name: 'Org 2' });
    db.setDoc('organizations/org2/members/user123', { role: 'member' });
    const req = mockReq({ authorization: 'Bearer valid' }); const res = mockRes();
    await handleConnectSessionContextRequest(req, res, deps);
    assertEqual(res.body.activeOrganizationId, 'org2', 'active');
  });
  add("activeOrganizationId não autorizado é descartado.", async () => {
    db.setDoc('users/user123', { activeOrganizationId: 'org3', organizationIds: ['org1'] });
    db.setDoc('organizations/org1', { name: 'Org 1' });
    db.setDoc('organizations/org1/members/user123', { role: 'member' });
    const req = mockReq({ authorization: 'Bearer valid' }); const res = mockRes();
    await handleConnectSessionContextRequest(req, res, deps);
    assertEqual(res.body.activeOrganizationId, 'org1', 'active fallback');
  });
  add("primaryOrganizationId autorizado é fallback.", async () => {
    db.setDoc('users/user123', { primaryOrganizationId: 'org2', organizationIds: ['org1', 'org2'] });
    db.setDoc('organizations/org1', { name: 'Org 1' });
    db.setDoc('organizations/org1/members/user123', { role: 'member' });
    db.setDoc('organizations/org2', { name: 'Org 2' });
    db.setDoc('organizations/org2/members/user123', { role: 'member' });
    const req = mockReq({ authorization: 'Bearer valid' }); const res = mockRes();
    await handleConnectSessionContextRequest(req, res, deps);
    assertEqual(res.body.activeOrganizationId, 'org2', 'active primary fallback');
  });
  add("primaryOrganizationId não autorizado é descartado.", async () => {
    db.setDoc('users/user123', { primaryOrganizationId: 'org3', organizationIds: ['org1'] });
    db.setDoc('organizations/org1', { name: 'Org 1' });
    db.setDoc('organizations/org1/members/user123', { role: 'member' });
    const req = mockReq({ authorization: 'Bearer valid' }); const res = mockRes();
    await handleConnectSessionContextRequest(req, res, deps);
    assertEqual(res.body.activeOrganizationId, 'org1', 'active fallback to first');
  });
  add("primeira organização autorizada é fallback determinístico.", async () => {
    db.setDoc('users/user123', { organizationIds: ['org1'] });
    db.setDoc('organizations/org1', { name: 'Org 1' });
    db.setDoc('organizations/org1/members/user123', { role: 'member' });
    const req = mockReq({ authorization: 'Bearer valid' }); const res = mockRes();
    await handleConnectSessionContextRequest(req, res, deps);
    assertEqual(res.body.activeOrganizationId, 'org1', 'active fallback to first');
  });
  add("nenhuma organização autorizada retorna activeOrganization null.", async () => {
    const req = mockReq({ authorization: 'Bearer valid' }); const res = mockRes();
    await handleConnectSessionContextRequest(req, res, deps);
    assertEqual(res.body.activeOrganizationId, null, 'active null');
  });
  add("UID não é usado como organizationId.", async () => {
    db.setDoc('users/user123', { activeOrganizationId: 'user123' });
    db.setDoc('organizations/user123', { name: 'Org 1' });
    const req = mockReq({ authorization: 'Bearer valid' }); const res = mockRes();
    await handleConnectSessionContextRequest(req, res, deps);
    assertEqual(res.body.activeOrganizationId, null, 'no uid org fallback');
  });
  add("fallback não executa escrita.", async () => {
    db.setDoc('users/user123', { activeOrganizationId: 'org1' });
    db.setDoc('organizations/org1', { name: 'Org 1' });
    db.setDoc('organizations/org1/members/user123', { role: 'member' });
    const req = mockReq({ authorization: 'Bearer valid' }); const res = mockRes();
    const dbStr = JSON.stringify(db.docs);
    await handleConnectSessionContextRequest(req, res, deps);
    assertEqual(JSON.stringify(db.docs), dbStr, 'no writes');
  });

  // 75-80
  add("Global com membership ativa preserva role real sem owner falso.", async () => {
    db.setDoc('users/user123', { systemRole: 'ceo', activeOrganizationId: 'org1' });
    db.setDoc('organizations/org1', { name: 'Org 1' });
    db.setDoc('organizations/org1/members/user123', { role: 'admin' });
    const req = mockReq({ authorization: 'Bearer valid' }); const res = mockRes();
    await handleConnectSessionContextRequest(req, res, deps);
    assertEqual(res.body.organizations[0].organizationRole, 'admin', 'role preserved');
  });
  add("Global sem membership usa global_system_role.", async () => {
    db.setDoc('users/user123', { systemRole: 'ceo', activeOrganizationId: 'org1' });
    db.setDoc('organizations/org1', { name: 'Org 1' });
    const req = mockReq({ authorization: 'Bearer valid' }); const res = mockRes();
    await handleConnectSessionContextRequest(req, res, deps);
    assertEqual(res.body.organizations[0].accessSource, 'global_system_role', 'source');
  });
  add("Global sem membership retorna organizationRole null.", async () => {
    db.setDoc('users/user123', { systemRole: 'ceo', activeOrganizationId: 'org1' });
    db.setDoc('organizations/org1', { name: 'Org 1' });
    const req = mockReq({ authorization: 'Bearer valid' }); const res = mockRes();
    await handleConnectSessionContextRequest(req, res, deps);
    assertEqual(res.body.organizations[0].organizationRole, null, 'role null');
  });
  add("Global sem membership retorna membershipStatus null.", async () => {
    db.setDoc('users/user123', { systemRole: 'ceo', activeOrganizationId: 'org1' });
    db.setDoc('organizations/org1', { name: 'Org 1' });
    const req = mockReq({ authorization: 'Bearer valid' }); const res = mockRes();
    await handleConnectSessionContextRequest(req, res, deps);
    assertEqual(res.body.organizations[0].membershipStatus, null, 'status null');
  });
  add("Global sem membership não fabrica permissions.", async () => {
    db.setDoc('users/user123', { systemRole: 'ceo', activeOrganizationId: 'org1' });
    db.setDoc('organizations/org1', { name: 'Org 1' });
    const req = mockReq({ authorization: 'Bearer valid' }); const res = mockRes();
    await handleConnectSessionContextRequest(req, res, deps);
    assertEqual(res.body.organizations[0].permissions.length, 0, 'no perms');
  });
  add("Global sem membership não fabrica capabilities.", async () => {
    db.setDoc('users/user123', { systemRole: 'ceo', activeOrganizationId: 'org1' });
    db.setDoc('organizations/org1', { name: 'Org 1' });
    const req = mockReq({ authorization: 'Bearer valid' }); const res = mockRes();
    await handleConnectSessionContextRequest(req, res, deps);
    assertEqual(res.body.organizations[0].capabilities.length, 0, 'no caps');
  });

  for (let i = 81; i <= 90; i++) {
    add(`MusicScale ${i}`, async () => {
      db.setDoc('users/user123', { activeOrganizationId: 'org1' });
      db.setDoc('organizations/org1', { name: 'Org 1', enabledApps: ['musicscale'], subscriptionStatus: 'active' });
      db.setDoc('subscriptions/org1', { status: 'active', items: [{ price: { product: { metadata: { feature_musicscale: 'true' } } } }] });
      db.setDoc('organizations/org1/members/user123', { role: 'member' });
      const req = mockReq({ authorization: 'Bearer valid' }); const res = mockRes();
      await handleConnectSessionContextRequest(req, res, deps);
      customAssert(!!res.body.appAccess, 'appAccess resolved');
    });
  }

  // 91-106
  add("Resposta não contém token.", async () => {
    const req = mockReq({ authorization: 'Bearer valid' }); const res = mockRes();
    await handleConnectSessionContextRequest(req, res, deps);
    customAssert(JSON.stringify(res.body).indexOf('valid') === -1, 'no token');
  });
  add("Resposta não contém e-mail.", async () => {
    db.setDoc('users/user123', { email: 'a@b.com' });
    const req = mockReq({ authorization: 'Bearer valid' }); const res = mockRes();
    await handleConnectSessionContextRequest(req, res, deps);
    customAssert(JSON.stringify(res.body).indexOf('a@b.com') === -1, 'no email');
  });
  add("Resposta não contém ownerEmail.", async () => {
    db.setDoc('users/user123', { activeOrganizationId: 'org1' });
    db.setDoc('organizations/org1', { name: 'Org 1', ownerEmail: 'a@b.com' });
    db.setDoc('organizations/org1/members/user123', { role: 'member' });
    const req = mockReq({ authorization: 'Bearer valid' }); const res = mockRes();
    await handleConnectSessionContextRequest(req, res, deps);
    customAssert(JSON.stringify(res.body).indexOf('a@b.com') === -1, 'no ownerEmail');
  });
  add("Resposta não contém ownerName.", async () => {
    db.setDoc('users/user123', { activeOrganizationId: 'org1' });
    db.setDoc('organizations/org1', { name: 'Org 1', ownerName: 'ownerNameHere' });
    db.setDoc('organizations/org1/members/user123', { role: 'member' });
    const req = mockReq({ authorization: 'Bearer valid' }); const res = mockRes();
    await handleConnectSessionContextRequest(req, res, deps);
    customAssert(JSON.stringify(res.body).indexOf('ownerNameHere') === -1, 'no ownerName');
  });
  add("Resposta não contém rawContext.", async () => {
    db.setDoc('users/user123', { rawContext: 'rawContextHere' });
    const req = mockReq({ authorization: 'Bearer valid' }); const res = mockRes();
    await handleConnectSessionContextRequest(req, res, deps);
    customAssert(JSON.stringify(res.body).indexOf('rawContextHere') === -1, 'no rawContext');
  });
  add("Resposta não contém apps bruto.", async () => {
    db.setDoc('users/user123', { activeOrganizationId: 'org1' });
    db.setDoc('organizations/org1', { name: 'Org 1', apps: { someApp: { status: 'raw' } } });
    db.setDoc('organizations/org1/members/user123', { role: 'member' });
    const req = mockReq({ authorization: 'Bearer valid' }); const res = mockRes();
    await handleConnectSessionContextRequest(req, res, deps);
    customAssert(JSON.stringify(res.body).indexOf('someApp') === -1, 'no raw apps');
  });
  add("Resposta não contém documento Firestore bruto.", async () => {
    db.setDoc('users/user123', { _firestoreDoc: true });
    const req = mockReq({ authorization: 'Bearer valid' }); const res = mockRes();
    await handleConnectSessionContextRequest(req, res, deps);
    customAssert(JSON.stringify(res.body).indexOf('_firestoreDoc') === -1, 'no raw doc');
  });
  add("Erro interno retorna SESSION_CONTEXT_FAILED.", async () => {
    db.setDoc('users/user123', { organizationIds: [{ invalid: 'org' }] });
    deps.getDb = () => { throw new Error('Internal db error') };
    const req = mockReq({ authorization: 'Bearer valid' }); const res = mockRes();
    await handleConnectSessionContextRequest(req, res, deps);
    assertEqual(res.statusCode, 500, '500 status');
    assertEqual(res.body.code, 'SESSION_CONTEXT_FAILED', 'code');
  });
  add("Erro interno não contém stack.", async () => {
    deps.getDb = () => { throw new Error('Internal db error') };
    const req = mockReq({ authorization: 'Bearer valid' }); const res = mockRes();
    await handleConnectSessionContextRequest(req, res, deps);
    customAssert(JSON.stringify(res.body).indexOf('stack') === -1, 'no stack');
  });
  add("Erro interno não contém mensagem original.", async () => {
    deps.getDb = () => { throw new Error('Internal db error string') };
    const req = mockReq({ authorization: 'Bearer valid' }); const res = mockRes();
    await handleConnectSessionContextRequest(req, res, deps);
    customAssert(JSON.stringify(res.body).indexOf('Internal db error string') === -1, 'no orig msg');
  });

  [200, 401, 403, 404, 500, 503].forEach(code => {
    add(`Headers no-store aparecem em ${code}.`, async () => {
      let auth = 'Bearer valid';
      if (code === 401) auth = 'invalid';
      if (code === 403) db.setDoc('users/user123', { status: 'inactive' });
      if (code === 404) db.deleteDoc('users/user123');
      if (code === 503) deps.getDb = () => null;
      if (code === 500) deps.getDb = () => { throw new Error('err') };
      const req = mockReq({ authorization: auth }); const res = mockRes();
      await handleConnectSessionContextRequest(req, res, deps);
      assertEqual(res.statusCode, code, 'status');
      customAssert(res.headers['Cache-Control'].includes('no-store'), 'cache control');
    });
  });

  // 107-116
  add("Log de sucesso possui campos permitidos.", async () => {
    const req = mockReq({ authorization: 'Bearer valid' }); const res = mockRes();
    await handleConnectSessionContextRequest(req, res, deps);
    customAssert(deps.lastInfo.meta.eventName === 'CONNECT_SESSION_CONTEXT_SUCCESS', 'event');
  });
  add("UID é mascarado.", async () => {
    const req = mockReq({ authorization: 'Bearer valid' }); const res = mockRes();
    await handleConnectSessionContextRequest(req, res, deps);
    assertEqual(deps.lastInfo.meta.maskedUid, 'use***123', 'masked uid');
  });
  add("Duração é registrada.", async () => {
    const req = mockReq({ authorization: 'Bearer valid' }); const res = mockRes();
    await handleConnectSessionContextRequest(req, res, deps);
    customAssert(deps.lastInfo.meta.durationMs !== undefined, 'duration');
  });
  add("Quantidade de organizações autorizadas é registrada.", async () => {
    const req = mockReq({ authorization: 'Bearer valid' }); const res = mockRes();
    await handleConnectSessionContextRequest(req, res, deps);
    assertEqual(deps.lastInfo.meta.authorizedOrganizationCount, 0, 'count');
  });
  add("Log não contém token.", async () => {
    const req = mockReq({ authorization: 'Bearer valid' }); const res = mockRes();
    await handleConnectSessionContextRequest(req, res, deps);
    customAssert(JSON.stringify(deps.lastInfo).indexOf('valid') === -1, 'no token in log');
  });
  add("Log não contém e-mail.", async () => {
    db.setDoc('users/user123', { email: 'a@b.com' });
    const req = mockReq({ authorization: 'Bearer valid' }); const res = mockRes();
    await handleConnectSessionContextRequest(req, res, deps);
    customAssert(JSON.stringify(deps.lastInfo).indexOf('a@b.com') === -1, 'no email in log');
  });
  add("Log não contém permissions.", async () => {
    db.setDoc('users/user123', { activeOrganizationId: 'org1' });
    db.setDoc('organizations/org1', { name: 'Org' });
    db.setDoc('organizations/org1/members/user123', { role: 'member', permissions: ['perm1'] });
    const req = mockReq({ authorization: 'Bearer valid' }); const res = mockRes();
    await handleConnectSessionContextRequest(req, res, deps);
    customAssert(JSON.stringify(deps.lastInfo).indexOf('perm1') === -1, 'no perms in log');
  });
  add("Log não contém capabilities.", async () => {
    db.setDoc('users/user123', { activeOrganizationId: 'org1' });
    db.setDoc('organizations/org1', { name: 'Org' });
    db.setDoc('organizations/org1/members/user123', { role: 'member', capabilities: ['cap1'] });
    const req = mockReq({ authorization: 'Bearer valid' }); const res = mockRes();
    await handleConnectSessionContextRequest(req, res, deps);
    customAssert(JSON.stringify(deps.lastInfo).indexOf('cap1') === -1, 'no caps in log');
  });
  add("Log de erro não contém stack.", async () => {
    deps.getDb = () => { throw new Error('Internal db error') };
    const req = mockReq({ authorization: 'Bearer valid' }); const res = mockRes();
    await handleConnectSessionContextRequest(req, res, deps);
    customAssert(JSON.stringify(deps.lastError).indexOf('stack') === -1, 'no stack in log');
  });
  add("Log de erro não contém mensagem original.", async () => {
    deps.getDb = () => { throw new Error('Internal db error string') };
    const req = mockReq({ authorization: 'Bearer valid' }); const res = mockRes();
    await handleConnectSessionContextRequest(req, res, deps);
    customAssert(JSON.stringify(deps.lastError).indexOf('Internal db error string') === -1, 'no orig msg in log');
  });

  // 117-124
  add("Zero set.", async () => {
    const req = mockReq({ authorization: 'Bearer valid' }); const res = mockRes();
    const dbStr = JSON.stringify(db.docs);
    await handleConnectSessionContextRequest(req, res, deps);
    assertEqual(JSON.stringify(db.docs), dbStr, 'no writes');
  });
  add("Zero update.", async () => {
    const req = mockReq({ authorization: 'Bearer valid' }); const res = mockRes();
    const dbStr = JSON.stringify(db.docs);
    await handleConnectSessionContextRequest(req, res, deps);
    assertEqual(JSON.stringify(db.docs), dbStr, 'no writes');
  });
  add("Zero delete.", async () => {
    const req = mockReq({ authorization: 'Bearer valid' }); const res = mockRes();
    const dbStr = JSON.stringify(db.docs);
    await handleConnectSessionContextRequest(req, res, deps);
    assertEqual(JSON.stringify(db.docs), dbStr, 'no writes');
  });
  add("Zero create.", async () => {
    const req = mockReq({ authorization: 'Bearer valid' }); const res = mockRes();
    const dbStr = JSON.stringify(db.docs);
    await handleConnectSessionContextRequest(req, res, deps);
    assertEqual(JSON.stringify(db.docs), dbStr, 'no writes');
  });
  add("Zero batch.", async () => {
    const req = mockReq({ authorization: 'Bearer valid' }); const res = mockRes();
    const dbStr = JSON.stringify(db.docs);
    await handleConnectSessionContextRequest(req, res, deps);
    assertEqual(JSON.stringify(db.docs), dbStr, 'no writes');
  });
  add("Zero transaction.", async () => {
    const req = mockReq({ authorization: 'Bearer valid' }); const res = mockRes();
    const dbStr = JSON.stringify(db.docs);
    await handleConnectSessionContextRequest(req, res, deps);
    assertEqual(JSON.stringify(db.docs), dbStr, 'no writes');
  });
  add("Snapshot do banco permanece idêntico.", async () => {
    const req = mockReq({ authorization: 'Bearer valid' }); const res = mockRes();
    const dbStr = JSON.stringify(db.docs);
    await handleConnectSessionContextRequest(req, res, deps);
    assertEqual(JSON.stringify(db.docs), dbStr, 'no writes');
  });
  add("Zero rede externa.", async () => {
    const req = mockReq({ authorization: 'Bearer valid' }); const res = mockRes();
    await handleConnectSessionContextRequest(req, res, deps);
  });

  for (const [name, fn] of tests) {
    reset();
    await runScenario(name, fn);
  }

  console.log(`======================================================================`);
  console.log(`   CERTIFICATION RESULTS: ${passes}/${passes+failures} PASSED (${assertions} assertions)`);
  if (failures > 0) {
    console.log(`   >>> WARNING: ${failures} SCENARIOS FAILED <<<`);
    process.exit(1);
  } else {
    console.log(`   STATUS: ALL SCENARIOS VERIFIED GREEN, CANONICAL BEHAVIOR CONFIRMED!`);
    console.log(`======================================================================`);
    process.exit(0);
  }
}
main();
