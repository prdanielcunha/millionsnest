import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolveNestAffiliateRetryAfterSeconds} from '../src/server/services/NestAffiliateRetryAfterPolicy.js';

test('provider Retry-After is bounded and safely parsed',()=>{
 const at=Date.parse('2026-10-08T16:00:00Z');
 assert.equal(resolveNestAffiliateRetryAfterSeconds(null,at),60);
 assert.equal(resolveNestAffiliateRetryAfterSeconds('120',at),120);
 assert.equal(resolveNestAffiliateRetryAfterSeconds('Thu, 08 Oct 2026 16:03:00 GMT',at),180);
 assert.equal(resolveNestAffiliateRetryAfterSeconds('invalid',at),60);
 assert.equal(resolveNestAffiliateRetryAfterSeconds('0',at),60);
 assert.equal(resolveNestAffiliateRetryAfterSeconds('9999999',at),3600);
});
