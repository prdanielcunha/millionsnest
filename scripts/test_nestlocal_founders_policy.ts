import assert from 'node:assert/strict';
import {
  NESTLOCAL_COMMERCIAL_V2_PROPOSED,NESTLOCAL_FOUNDERS_PAID_INVOICES,
  NESTLOCAL_FOUNDERS_WINDOW_MS,evaluateNestLocalFoundersAvailability,
  foundersPaidCycleNumber,
} from '../src/lib/nestLocalCommercialV2.js';
assert.deepEqual(Object.entries(NESTLOCAL_COMMERCIAL_V2_PROPOSED).map(([id, p]) => [id,p.regularCents,p.foundersCents,p.seats,p.creditsPerMonth]), [
  ['essential',5990,4990,1,150],['growth',12900,10990,3,500],['pro',19900,16990,10,1500],
]);
const start=Date.parse('2026-10-08T15:00:00.000Z');
const query=(acceptedOrganizations:number,serverNowMs:number)=>evaluateNestLocalFoundersAvailability({
  launchedAtMs:start,acceptedOrganizations,serverNowMs,
});
assert.equal(evaluateNestLocalFoundersAvailability({launchedAtMs:null,acceptedOrganizations:0,serverNowMs:start}).reason,'not_launched');
assert.equal(query(0,start).remainingSlots,50);
assert.equal(query(49,start).eligible,true);
assert.equal(query(50,start).reason,'capacity_exhausted');
assert.equal(query(0,start+NESTLOCAL_FOUNDERS_WINDOW_MS-1).eligible,true);
assert.equal(query(0,start+NESTLOCAL_FOUNDERS_WINDOW_MS).reason,'time_expired');
assert.equal(foundersPaidCycleNumber(['in_A','in_A','in_B']),2);
assert.equal(foundersPaidCycleNumber(Array.from({length:20},(_,i)=>'in_'+String(i))),NESTLOCAL_FOUNDERS_PAID_INVOICES);
assert.throws(()=>foundersPaidCycleNumber(['evt_not_an_invoice']),/INVALID_PAID_INVOICE_ID/);
console.log('PASS staged NestLocal Founders price table, 50/30 first threshold and 12 paid invoice cycles');
