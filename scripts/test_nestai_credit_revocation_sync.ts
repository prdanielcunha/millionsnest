import assert from 'node:assert/strict';
import * as crypto from 'node:crypto';
import {
  revokeNestLocalPaidCreditsFromHub,validateVerifiedCreditReversal,
} from '../src/server/services/NestAiCreditRevocationSyncService.js';

const {privateKey}=crypto.generateKeyPairSync('ec',{namedCurve:'P-256'});
const env={...process.env,
  NESTAI_SIGNING_PRIVATE_JWK:JSON.stringify(privateKey.export({format:'jwk'})),
  NESTAI_COMMERCIAL_CREDITS_ENABLED:'true',
  NESTAI_GRANTS_SYNC_ENABLED:'true',
  NESTAI_CREDIT_REVOCATIONS_ENABLED:'true',
};
const intent={organizationId:'org_payment_abc',sourceRef:'nestlocal:paid:in_123456abc',
  reason:'refund' as const};
const grantId='f'.repeat(64);
let calls=0;
const fetcher=(async(input:RequestInfo|URL,init?:RequestInit)=>{
  calls++;
  assert.equal(String(input),'https://ai.millionsnest.com/v1/credits/grants/revoke');
  assert.equal(init?.method,'POST');
  const headers=init?.headers as Record<string,string>;
  assert.equal(headers['x-millionsnest-org'],intent.organizationId);
  assert.equal(headers['x-millionsnest-app'],'nestlocal');
  const claims=JSON.parse(Buffer.from(headers.authorization.split('.')[1],'base64url').toString());
  assert.equal(claims.tokenType,'service');
  assert.equal(claims.organizationId,intent.organizationId);
  assert.equal(claims.appId,'nestlocal');
  assert.ok(claims.capabilities.includes('ai:credits.revoke'));
  assert.ok(claims.scopes.includes('credits:revoke'));
  assert.ok(!claims.capabilities.includes('ai:credits.grant'));
  assert.deepEqual(JSON.parse(String(init?.body)),{
    sourceRef:intent.sourceRef,reason:'refund',
  });
  return new Response(JSON.stringify({grantId,revoked:true,alreadyRevoked:false}),{
    status:200,headers:{'content-type':'application/json'},
  });
}) as typeof fetch;
assert.deepEqual(await revokeNestLocalPaidCreditsFromHub(intent,{env,fetcher}),
  {grantId,revoked:true,alreadyRevoked:false});
assert.equal(calls,1);
await assert.rejects(()=>revokeNestLocalPaidCreditsFromHub(intent,{
  env:{...env,NESTAI_CREDIT_REVOCATIONS_ENABLED:'false'},fetcher,
}),/NESTAI_REVOCATIONS_DISABLED/);
for(const invalid of [
  {...intent,organizationId:'org/other'},
  {...intent,sourceRef:'nestlocal:trial:in_123456abc'},
  {...intent,sourceRef:'nestlocal:paid:in_x'},
  {...intent,reason:'goodwill' as any},
]){
  assert.throws(()=>validateVerifiedCreditReversal(invalid));
}
await assert.rejects(()=>revokeNestLocalPaidCreditsFromHub(intent,{
  env:{...env,NESTAI_INTERNAL_API_BASE_URL:'https://evil.example'},fetcher,
}),/NESTAI_REVOCATION_ENDPOINT_INVALID/);
await assert.rejects(()=>revokeNestLocalPaidCreditsFromHub(intent,{
  env,fetcher:(async()=>new Response(JSON.stringify({grantId,revoked:true,alreadyRevoked:true}))) as typeof fetch,
}),/NESTAI_REVOCATION_SYNC_FAILED/);
assert.equal(calls,1);
console.log('PASS: service-scoped reversal, tenant and invoice constraints, disable gates, replay shape and hostile endpoint');
