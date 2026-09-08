import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const server = readFileSync('server.ts', 'utf8');

const fnStart = server.indexOf('async function upsertEcosystemSubscription');
const fnEnd = server.indexOf('\nasync function startServer()', fnStart);
assert.ok(fnStart >= 0 && fnEnd > fnStart, 'upsertEcosystemSubscription must exist');
const source = server.slice(fnStart, fnEnd);

assert.equal(
  /const orgPayload:[\s\S]{0,1500}ownerUid:\s*userId/.test(source),
  false,
  'subscription sync must not unconditionally overwrite organization ownerUid'
);
assert.equal(
  /const orgPayload:[\s\S]{0,1500}ownerUserId:\s*userId/.test(source),
  false,
  'subscription sync must not unconditionally overwrite organization ownerUserId'
);
assert.match(
  source,
  /if \(!orgDoc\.exists\) \{[\s\S]{0,1200}orgPayload\.ownerUid = userId;[\s\S]{0,1200}orgPayload\.ownerUserId = userId;/,
  'ownership may be established only for a brand-new organization'
);
assert.match(
  source,
  /if \(!orgDoc\.exists\) \{[\s\S]{0,2200}role: 'owner',[\s\S]{0,2200}batch\.set\(memberRef, memberData/,
  'initial owner membership may be created only with a brand-new organization'
);
assert.equal(
  /if \(memberDoc\.exists\)[\s\S]{0,1000}role:\s*'owner'/.test(source),
  false,
  'existing organization membership must never be promoted to owner by billing sync'
);
assert.match(
  source,
  /Subscription reconciliation must never transfer an[\s\S]{0,300}existing tenant/,
  'source must document that billing and ownership are independent'
);

console.log('PASS subscription ownership integrity: Stripe reconciliation cannot transfer tenant ownership or overwrite existing organization roles');
