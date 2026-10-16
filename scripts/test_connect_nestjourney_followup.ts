import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { publishNestJourneyFollowupDue } from '../src/server/services/NestJourneyFollowupEventPublisher.js';
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
    consent: true, consentRevokedAt: null, contactStatus: 'pending', preferredContactChannel: 'whatsapp', privateNote: 'must not leak',
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
  assert.equal(res.body.consentContract,'whatsapp_explicit_v1');
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
  assert.equal(res.body.code,'FOLLOWUP_OWNER_REQUIRED');
}
{
  const db=new MockDb(); seed(db,'admin');
  db.docs['organizations/org1/products/raiz_e_mesa/followups/first-contact-care1'].ownerRef='other';
  db.docs['organizations/org1/products/raiz_e_mesa/careRequests/care1'].ownerRef='other';
  const res=await execute(db,{organizationId:'org1',followupId:'first-contact-care1'},{accessible:true,isGlobalAccess:false,organizationRole:'admin'});
  assert.equal(res.statusCode,403);
  assert.equal(res.body.code,'FOLLOWUP_OWNER_REQUIRED');
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
for (const patch of [
  { preferredContactChannel: 'phone' }, { preferredContactChannel: undefined },
  { consentRevokedAt: '2026-10-15T08:00:00Z' }, { contactStatus: 'closed' },
  { organizationId: 'org-other' }, { congregationId: 'other-camp' },
]) {
  const db=new MockDb();seed(db);
  Object.assign(db.docs['organizations/org1/products/raiz_e_mesa/people/person1'],patch);
  const res=await execute(db);
  assert.equal(res.statusCode,409);
  assert.equal(res.body.consentContract,undefined);
  assert.equal(res.body.person,undefined,'denial discloses no person details');
}
for (const membership of [undefined,{role:'care',status:'inactive'}, {status:'active',permissions:{}}]) {
  const db=new MockDb();seed(db);
  db.docs['organizations/org1/members/user1']=membership;
  const res=await execute(db,undefined,{accessible:true,isGlobalAccess:true,organizationRole:'admin'});
  assert.equal(res.statusCode,403,'global app access cannot replace active church care authority');
  assert.equal(res.body.person,undefined);
}
{
  const db=new MockDb();seed(db);
  db.docs['organizations/org1'].ownerUid='user1';
  delete db.docs['organizations/org1/members/user1'];
  assert.equal((await execute(db)).statusCode,200,'canonical church owner still requires assigned followup');
  db.docs['organizations/org1/products/raiz_e_mesa/followups/first-contact-care1'].ownerRef='other';
  assert.equal((await execute(db)).statusCode,403,'church owner cannot impersonate assigned caregiver');
}
{
  const db=new MockDb();seed(db,'member');
  db.docs['organizations/org1/members/user1'].permissions={canManageCare:true};
  assert.equal((await execute(db)).statusCode,200,'active scoped capability remains supported');
  db.docs['organizations/org1/members/user1'].congregationIds=['different-camp'];
  assert.equal((await execute(db)).statusCode,403,'capability does not bypass congregation scope');
}
console.log('NestJourney -> Connect follow-up context contract: explicit consent, revocation, church membership, assigned owner and tenant isolation OK');

const now = Date.parse('2026-10-16T18:00:00.000Z');
const dueAt = new Date(now - 1000).toISOString();
const key = 'synthetic-nestjourney-signature-secret-32-minimum';
const targets = JSON.stringify({ org1: { conversationId: 'authorized-thread', recipientUid: 'current-connect-operator' } });
const source = { organizationId: 'org1', followupId: 'first-contact-care1', ownerUid: 'user1', dueAt };
async function signalSourcePatch(patch: (db: MockDb) => void) {
  const db = new MockDb(); seed(db); patch(db);
  const events: unknown[] = [];
  const res = response();
  await handleNestJourneyFollowupContextRequest(request({
    organizationId: 'org1', followupId: 'first-contact-care1',
  }), res, {
    verifyIdToken: async () => ({ uid: 'user1' } as any),
    getDb: () => db as any,
    resolveAccess: async () => ({ accessible: true, isGlobalAccess: false } as any),
    now: () => now,
    onEligibleDueFollowup: async input => { events.push(input); },
  });
  return { res, events };
}
{
  const a = await signalSourcePatch(db => {
    db.docs['organizations/org1/products/raiz_e_mesa/followups/first-contact-care1'].dueAt = dueAt;
  });
  assert.equal(a.res.statusCode, 200);
  assert.deepEqual(a.events, [source]);
  assert(!JSON.stringify(a.events).includes('phone'));
  assert(!JSON.stringify(a.events).includes('João'));
}
for(const patch of [
  (db: MockDb) => { db.docs['organizations/org1/products/raiz_e_mesa/people/person1'].consent = false; },
  (db: MockDb) => { db.docs['organizations/org1/products/raiz_e_mesa/people/person1'].consentRevokedAt = dueAt; },
  (db: MockDb) => { db.docs['organizations/org1/products/raiz_e_mesa/followups/first-contact-care1'].ownerRef = 'other'; },
  (db: MockDb) => { db.docs['organizations/org1/products/raiz_e_mesa/followups/first-contact-care1'].dueAt = new Date(now + 3600000).toISOString(); },
  (db: MockDb) => { db.docs['organizations/org1/products/raiz_e_mesa/followups/first-contact-care1'].dueAt = new Date(now - 8 * 86400000).toISOString(); },
]) {
  const a = await signalSourcePatch(patch);
  assert.deepEqual(a.events, [], 'revoked consent, wrong caregiver or outside due window never emits');
}
const inputs = { ...source, enabled: true, signingSecret: key, operatorTargetsJson: targets, now: () => now };
let sent = 0;
const fetchImpl: typeof fetch = async (url, init) => {
  sent++;
  assert.equal(String(url), 'https://connect.millionsnest.com/api/core/automations/events/nestjourney');
  assert.equal(init?.redirect, 'error');
  const raw = String(init?.body), headers = init!.headers as Record<string, string>;
  assert.equal(headers['x-connect-signature'], createHmac('sha256', key)
    .update('nestjourney\\n' + headers['x-connect-timestamp'] + '\\n' + raw).digest('hex'));
  const body = JSON.parse(raw);
  assert.deepEqual(Object.keys(body).sort(), [
    'schemaVersion','sourceApp','eventId','organizationId','conversationId','occurredAt','trigger','recipientUid',
  ].sort());
  assert.equal(body.trigger, 'followup.due');
  assert.equal(body.recipientUid, 'current-connect-operator');
  assert(!JSON.stringify(body).includes('phone'));
  assert(!JSON.stringify(body).includes('person'));
  assert(!JSON.stringify(body).includes('careRequest'));
  return new Response(JSON.stringify({ accepted: true, duplicate: sent > 1 }), { status: 202 });
};
assert.equal(await publishNestJourneyFollowupDue({ ...inputs, enabled: false, fetchImpl }), 'disabled');
assert.equal(await publishNestJourneyFollowupDue({ ...inputs, dueAt: new Date(now + 60000).toISOString(), fetchImpl }), 'not_due');
assert.equal(await publishNestJourneyFollowupDue({ ...inputs, operatorTargetsJson: '{}', fetchImpl }), 'not_configured');
assert.equal(await publishNestJourneyFollowupDue({ ...inputs, fetchImpl }), 'accepted');
assert.equal(await publishNestJourneyFollowupDue({ ...inputs, fetchImpl }), 'duplicate');
assert.equal(sent, 2);
let uncertain = 0;
await assert.rejects(publishNestJourneyFollowupDue({ ...inputs,
  fetchImpl: (async () => { uncertain++; throw Error('ambiguous network'); }) as typeof fetch,
}), /JOURNEY_CONNECT_TRANSPORT_UNCERTAIN/);
assert.equal(uncertain, 1, 'no unbounded retries or Meta sends');
console.log('NestJourney canonical Hub consent-to-signed Connect operator event: revoked, due-only, tenant, HMAC, no PII OK');

