import assert from 'node:assert/strict';
import { handleNestJourneyFollowupContextRequest } from '../src/server/services/NestJourneyFollowupContextService.js';

class MockDoc {
  constructor(private value: any) {}
  get exists() { return this.value !== undefined; }
  data() { return this.value; }
}
class MockDb {
  docs: Record<string, any> = {};
  doc(path: string) { return { get: async () => new MockDoc(this.docs[path]) }; }
}
function response() {
  const state: any = { statusCode: 200, body: null, headers: {} };
  state.status = (code: number) => { state.statusCode = code; return state; };
  state.json = (body: unknown) => { state.body = body; return state; };
  state.setHeader = (key: string, value: string) => { state.headers[key] = value; return state; };
  return state;
}
function request(query: Record<string,string>, token='valid') {
  return { headers: { authorization: token ? `Bearer ${token}` : '' }, query } as any;
}
function seed(db: MockDb, role='care') {
  db.docs['organizations/org1'] = { name: 'OBPC', apps: { nestjourney: { status: 'active' } } };
  db.docs['organizations/org1/members/user1'] = { role, status: 'active', congregationIds: ['camp1'], permissions: {} };
  db.docs['organizations/org1/products/raiz_e_mesa/followups/first-contact-care1'] = {
    organizationId: 'org1', congregationId: 'camp1', personId: 'person1', careRequestId: 'care1',
    kind: 'first_contact', status: 'pending', ownerRef: 'user1', dueAt: '2026-09-19T12:00:00.000Z',
  };
  db.docs['organizations/org1/products/raiz_e_mesa/careRequests/care1'] = {
    organizationId: 'org1', congregationId: 'camp1', personId: 'person1', careType: 'first_contact',
    status: 'open', ownerRef: 'user1', summary: 'must not leak',
  };
  db.docs['organizations/org1/products/raiz_e_mesa/people/person1'] = {
    organizationId: 'org1', congregationId: 'camp1', name: 'João da Silva', phone: '5543999999999',
    consent: true, privateNote: 'must not leak',
  };
}
async function execute(db: MockDb, query={organizationId:'org1',followupId:'first-contact-care1'}, access:any={accessible:true,isGlobalAccess:false,organizationRole:'care'}) {
  const res=response();
  await handleNestJourneyFollowupContextRequest(request(query), res, {
    verifyIdToken: async () => ({ uid: 'user1' } as any),
    getDb: () => db as any,
    resolveAccess: async () => ({ appId:'nestjourney',organizationId:'org1',accessSource:'organization_membership',roles:[],permissions:[],decisionState:'granted',...access }),
    logger: { info() {} },
  } as any);
  return res;
}

{
  const db=new MockDb(); seed(db);
  const res=await execute(db);
  assert.equal(res.statusCode,200);
  assert.equal(res.body.person.name,'João da Silva');
  assert.equal(res.body.person.phone,'5543999999999');
  assert.equal(res.body.followup.careRequestId,'care1');
  assert.ok(String(res.body.returnTo).includes('followup=first-contact-care1'));
  const serialized=JSON.stringify(res.body);
  assert.equal(serialized.includes('must not leak'),false);
  assert.equal(serialized.includes('privateNote'),false);
}
{
  const db=new MockDb(); seed(db);
  db.docs['organizations/org1/products/raiz_e_mesa/followups/first-contact-care1'].ownerRef='other';
  const res=await execute(db);
  assert.equal(res.statusCode,403);
  assert.equal(res.body.code,'FOLLOWUP_SCOPE_DENIED');
}
{
  const db=new MockDb(); seed(db,'admin');
  db.docs['organizations/org1/products/raiz_e_mesa/followups/first-contact-care1'].ownerRef='other';
  db.docs['organizations/org1/products/raiz_e_mesa/careRequests/care1'].ownerRef='other';
  const res=await execute(db,{organizationId:'org1',followupId:'first-contact-care1'},{accessible:true,isGlobalAccess:false,organizationRole:'admin'});
  assert.equal(res.statusCode,200);
}
{
  const db=new MockDb(); seed(db);
  db.docs['organizations/org1/products/raiz_e_mesa/people/person1'].consent=false;
  const res=await execute(db);
  assert.equal(res.statusCode,409);
  assert.equal(res.body.code,'FOLLOWUP_SOURCE_INVALID');
}
{
  const db=new MockDb(); seed(db);
  const res=await execute(db,{organizationId:'org1',followupId:'../care1'});
  assert.equal(res.statusCode,400);
}
{
  const db=new MockDb(); seed(db);
  const res=await execute(db,{organizationId:'org1',followupId:'first-contact-care1'},{accessible:false,isGlobalAccess:false,organizationRole:'care'});
  assert.equal(res.statusCode,403);
  assert.equal(res.body.code,'NESTJOURNEY_ACCESS_DENIED');
}
console.log('NestJourney -> Connect follow-up context contract: OK');
