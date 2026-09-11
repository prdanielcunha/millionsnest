import assert from 'node:assert/strict';
import admin from 'firebase-admin';
import { handleConnectSessionContextRequest } from '../src/server/services/ConnectSessionContextService.js';

class MockDb {
  docs: Record<string, any> = {};
  setDoc(path: string, data: any) { this.docs[path] = data; }

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
                  },
                };
              },
            };
          },
        };
      },
      where(field: any, op: string, val: any) {
        return {
          limit() { return this; },
          get: async () => {
            const results = Object.keys(db.docs)
              .filter(k => k.startsWith(name + '/'))
              .filter(k => k.split('/').length === name.split('/').length + 1)
              .filter(k => {
                const data = db.docs[k];
                if (field === admin.firestore.FieldPath.documentId()) {
                  const id = k.split('/').at(-1)!;
                  return Array.isArray(val) && val.includes(id);
                }
                return op === '==' && data?.[field] === val;
              });
            return { docs: results.map(k => ({ id: k.split('/').at(-1)!, data: () => db.docs[k] })) };
          },
        };
      },
    };
  }
}

function req(organizationId?: string) {
  return {
    headers: { authorization: 'Bearer valid' },
    query: organizationId ? { organizationId } : {},
  } as any;
}

function res() {
  const response: any = {
    statusCode: 200,
    body: null,
    headers: {},
    status(code: number) { response.statusCode = code; return response; },
    json(body: unknown) { response.body = body; return response; },
    setHeader(name: string, value: string) { response.headers[name] = value; return response; },
  };
  return response;
}

function deps(db: MockDb) {
  return {
    verifyIdToken: async () => ({ uid: 'user123' }) as admin.auth.DecodedIdToken,
    getDb: () => db as any,
    logger: { info() {}, error() {} },
  };
}

{
  const db = new MockDb();
  db.setDoc('users/user123', {
    name: 'Founder',
    status: 'active',
    systemRole: 'ceo',
    activeOrganizationId: 'org-stale',
  });
  db.setDoc('organizations/org-stale', { name: 'Stale Org', status: 'active' });
  db.setDoc('organizations/org-selected', { name: 'Selected Org', status: 'active' });

  const response = res();
  await handleConnectSessionContextRequest(req('org-selected'), response, deps(db));

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.activeOrganizationId, 'org-selected');
  assert.equal(response.body.activeOrganization.id, 'org-selected');
  assert.equal(response.body.activeOrganization.accessSource, 'global_system_role');
}

{
  const db = new MockDb();
  db.setDoc('users/user123', {
    name: 'Member',
    status: 'active',
    systemRole: 'user',
    activeOrganizationId: 'org-member',
  });
  db.setDoc('organizations/org-member', { name: 'Member Org', status: 'active' });
  db.setDoc('organizations/org-member/members/user123', { role: 'member', status: 'active' });
  db.setDoc('organizations/org-denied', { name: 'Denied Org', status: 'active' });

  const response = res();
  await handleConnectSessionContextRequest(req('org-denied'), response, deps(db));

  assert.equal(response.statusCode, 403);
  assert.equal(response.body.code, 'ORGANIZATION_ACCESS_DENIED');
}

{
  const db = new MockDb();
  db.setDoc('users/user123', {
    name: 'Founder',
    status: 'active',
    systemRole: 'ceo',
    activeOrganizationId: 'org-active',
  });
  db.setDoc('organizations/org-active', { name: 'Active Org', status: 'active' });

  const response = res();
  await handleConnectSessionContextRequest(req(), response, deps(db));

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.activeOrganizationId, 'org-active');
}

console.log('Connect selected organization context regression: OK');
