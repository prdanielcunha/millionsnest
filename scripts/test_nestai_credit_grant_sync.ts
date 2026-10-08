import * as assert from 'node:assert/strict';
import * as crypto from 'node:crypto';
import { syncNestLocalAiCreditsFromHub } from '../src/server/services/NestAiCreditGrantSyncService.js';

const {privateKey}=crypto.generateKeyPairSync('ec',{namedCurve:'P-256'});
const env={...process.env,
  NESTAI_SIGNING_PRIVATE_JWK:JSON.stringify(privateKey.export({format:'jwk'})),
  NESTAI_COMMERCIAL_CREDITS_ENABLED:'true',
  NESTAI_GRANTS_SYNC_ENABLED:'true',
};
const start='2026-10-08T12:00:00.000Z';
const end='2026-10-15T12:00:00.000Z';
let calls=0;
const fetcher=(async(input:RequestInfo|URL,init?:RequestInit):Promise<Response>=>{
  calls++;
  assert.equal(String(input),'https://ai.millionsnest.com/v1/credits/grants');
  assert.equal(init?.method,'POST');
  const headers=init?.headers as Record<string,string>;
  assert.equal(headers['x-millionsnest-org'],'org_123');
  assert.equal(headers['x-millionsnest-app'],'nestlocal');
  const payload=JSON.parse(Buffer.from(headers.authorization.split('.')[1],'base64url').toString('utf8'));
  assert.equal(payload.tokenType,'service');
  assert.equal(payload.appId,'nestlocal');
  assert.ok(payload.capabilities.includes('ai:credits.grant'));
  assert.ok(payload.scopes.includes('credits:grant'));
  const request=JSON.parse(String(init?.body));
  assert.equal(request.amount,40);
  assert.equal(request.source,'trial');
  assert.equal(request.sourceRef,'trial_org_123_v1');
  return new Response(JSON.stringify({grantId:'grant-test-1',created:true}),{
    status:201,headers:{'content-type':'application/json'},
  });
}) as typeof fetch;
const intent={
  source:'trial' as const,organizationId:'org_123',sourceRef:'trial_org_123_v1',
  grantVersion:2 as const,beginsAt:start,expiresAt:end,
};
assert.deepEqual(await syncNestLocalAiCreditsFromHub(intent,{env,fetcher}),{grantId:'grant-test-1',created:true});
assert.equal(calls,1);
await assert.rejects(()=>syncNestLocalAiCreditsFromHub(intent,{
  env:{...env,NESTAI_GRANTS_SYNC_ENABLED:'false'},fetcher,
}),/NESTAI_GRANTS_SYNC_DISABLED/);
await assert.rejects(()=>syncNestLocalAiCreditsFromHub({
  ...intent,expiresAt:'2026-10-16T12:00:00.000Z',
},{env,fetcher}),/NESTAI_GRANTS_TRIAL_TOO_LONG/);
await assert.rejects(()=>syncNestLocalAiCreditsFromHub({...intent,sourceRef:'/'},{env,fetcher}),
  /NESTAI_GRANTS_SOURCE_INVALID/);
assert.equal(calls,1);
console.log('PASS Hub signed grant sync scoping, disabled default and trial ceiling');
