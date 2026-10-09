import assert from 'node:assert/strict';
import {reserveNestLocalFoundersOffer,markNestLocalFoundersAccepted,
 readNestLocalFoundersOffer,releaseFailedNestLocalFoundersReservation,founderClaimCount} from
 '../src/server/services/NestLocalFoundersCampaignService.js';
type Data=Record<string,any>;
class FakeFirestore{
 docs=new Map<string,Data>();
 doc(path:string){return {path};}
 async runTransaction<T>(execute:(tx:any)=>Promise<T>):Promise<T>{
  const writes:Function[]=[];
  const tx={
   get:async(ref:any)=>({exists:this.docs.has(ref.path),data:()=>this.docs.get(ref.path)}),
   update:(ref:any,data:Data)=>writes.push(()=>this.docs.set(ref.path,{...this.docs.get(ref.path),...data})),
  };
  const response=await execute(tx);for(const write of writes)write();return response;
 }
}
const env={NESTLOCAL_FOUNDERS_ENABLED:'true'} as any;
const now=Date.parse('2026-10-09T12:00:00Z');
const fresh=()=>{
 const db=new FakeFirestore();
 db.docs.set('nestlocal_founders_campaign/2026',{enabled:true,startedAt:now-60_000,claims:{}});
 return db;
};
const db=fresh();
assert.equal((await readNestLocalFoundersOffer({db:db as any,uid:'u_1',organizationId:'org_1',env,nowMs:now})).available,true);
let first=await reserveNestLocalFoundersOffer({db:db as any,organizationId:'org_1',uid:'u_1',tier:'essential',env,nowMs:now});
assert.equal(first.ok,true);assert.equal(first.reason,'reserved');
assert.equal(founderClaimCount(db.docs.get('nestlocal_founders_campaign/2026')!.claims,now),1);
let again=await reserveNestLocalFoundersOffer({db:db as any,organizationId:'org_1',uid:'u_1',tier:'essential',env,nowMs:now});
assert.equal(again.ok,true);assert.equal(again.reason,'already_reserved');
assert.equal((await reserveNestLocalFoundersOffer({db:db as any,organizationId:'org_1',uid:'attacker',tier:'essential',env,nowMs:now})).ok,false);
const accepted=await markNestLocalFoundersAccepted({db:db as any,organizationId:'org_1',uid:'u_1',tier:'essential',
 sessionId:'cs_test_123',couponId:'nestlocal_founders_essential_12m_2026',nowMs:now});
assert.equal(accepted.state,'accepted');
assert.equal((await markNestLocalFoundersAccepted({db:db as any,organizationId:'org_1',uid:'u_1',tier:'essential',
 sessionId:'cs_test_123',couponId:'nestlocal_founders_essential_12m_2026',nowMs:now})).state,'already_accepted');
assert.equal((await reserveNestLocalFoundersOffer({db:db as any,organizationId:'org_1',uid:'u_1',tier:'essential',env,nowMs:now})).ok,false);
await assert.rejects(markNestLocalFoundersAccepted({db:db as any,organizationId:'org_1',uid:'u_1',tier:'essential',
 sessionId:'cs_test_tampered',couponId:'nestlocal_founders_essential_12m_2026',nowMs:now}),/SESSION_CONFLICT/);
const cap=fresh();const claims:Record<string,Data>={};
for(let i=0;i<50;i++)claims['customer'+i]={status:'accepted',uid:'u'+i,tier:'essential',expiresAtMs:now};
cap.docs.get('nestlocal_founders_campaign/2026')!.claims=claims;
assert.equal((await reserveNestLocalFoundersOffer({db:cap as any,organizationId:'new_org',uid:'new_user',tier:'pro',env,nowMs:now})).ok,false);
cap.docs.get('nestlocal_founders_campaign/2026')!.claims={
 expired:{status:'reserved',uid:'old',tier:'essential',expiresAtMs:now-1},
};
assert.equal((await reserveNestLocalFoundersOffer({db:cap as any,organizationId:'new_org',uid:'new_user',tier:'pro',env,nowMs:now})).ok,true);
await releaseFailedNestLocalFoundersReservation({db:cap as any,organizationId:'new_org',uid:'new_user',tier:'pro',nowMs:now});
assert.equal(founderClaimCount(cap.docs.get('nestlocal_founders_campaign/2026')!.claims,now),0);
const expired=fresh();expired.docs.get('nestlocal_founders_campaign/2026')!.startedAt=now-31*86400000;
assert.equal((await reserveNestLocalFoundersOffer({db:expired as any,organizationId:'o',uid:'u',tier:'growth',env,nowMs:now})).ok,false);
assert.equal((await reserveNestLocalFoundersOffer({db:db as any,organizationId:'other',uid:'u',tier:'growth',env:{},nowMs:now})).ok,false);
console.log('PASS founders transactional lifecycle: no fake launch, 50/org quota, 30 days, idempotency, cross-user denial, paid attestation');
