import assert from 'node:assert/strict';
import * as crypto from 'node:crypto';
import {
  isNestLocalInternalTrialActive, isNestLocalInternalTrialExpired, resolveNestLocalAiEntitlement,
} from '../src/server/services/NestLocalAiEntitlement.js';
import { issueNestAiToken } from '../src/server/services/NestAiTokenService.js';

const now = Date.parse('2026-10-08T12:00:00.000Z');
const trialStart = new Date(now - 2 * 86_400_000);
const trialEnd = new Date(trialStart.getTime() + 7 * 86_400_000);
const trial = {
  appId:'nestlocal',source:'hub_internal_trial',status:'active',consumed:true,
  beginsAt:{toDate:()=>trialStart}, expiresAt:{toDate:()=>trialEnd},grantVersion:2,
};
assert.equal(isNestLocalInternalTrialActive(trial,now),true);
assert.equal(isNestLocalInternalTrialActive({...trial,revoked:true},now),false);
assert.equal(isNestLocalInternalTrialActive({...trial,expiresAt:new Date(now)},now),false);
assert.equal(isNestLocalInternalTrialActive({...trial,expiresAt:new Date(now+8*86_400_000)},now),false);
assert.equal(isNestLocalInternalTrialActive({...trial,source:'stripe'},now),false);
assert.equal(isNestLocalInternalTrialActive({...trial,grantVersion:1},now),false);

const issued={...trial,organizationId:'org-1',consumed:true};
assert.equal(isNestLocalInternalTrialExpired(issued, now, 'org-1'),false);
assert.equal(isNestLocalInternalTrialExpired(issued, trialEnd.getTime(), 'org-1'),true);
assert.equal(isNestLocalInternalTrialExpired(issued, trialEnd.getTime(), 'org-2'),false);
assert.equal(isNestLocalInternalTrialExpired({...issued,revoked:true},trialEnd.getTime(),'org-1'),false);
assert.equal(isNestLocalInternalTrialExpired({...issued,consumed:false},trialEnd.getTime(),'org-1'),false);
assert.equal(resolveNestLocalAiEntitlement({
  organizationApp:{status:'trialing'},internalTrial:issued,now:trialEnd.getTime(),
}),null);
const org={status:'trialing'};
const internal=resolveNestLocalAiEntitlement({organizationApp:org,internalTrial:trial,now});
assert.equal(internal?.accessState,'trial_active');
assert.equal(internal?.billingSource,'hub_internal_trial');
assert.equal(internal?.canUseAI,true);
assert.equal(internal?.trialEndsAt,trialEnd.toISOString());

const paid=resolveNestLocalAiEntitlement({
  organizationApp:{status:'active',plan:'pro'},
  subscription:{status:'active',plan:'growth',currentPeriodEnd:{toDate:()=>new Date(now+30*86_400_000)}},
  internalTrial:trial,now,
});
assert.equal(paid?.accessState,'paid_active');
assert.equal(paid?.plan,'growth');
assert.equal(paid?.billingSource,'stripe');
assert.equal(paid?.grantVersion,2);
assert.equal(resolveNestLocalAiEntitlement({organizationApp:org,subscription:{status:'trialing'},now}),null);
assert.equal(resolveNestLocalAiEntitlement({
  organizationApp:{status:'inactive'},subscription:{status:'active',plan:'growth',currentPeriodEnd:new Date(now+99_000)},
  now,
}),null);
assert.equal(resolveNestLocalAiEntitlement({
  organizationApp:{status:'active'},subscription:{status:'active',plan:'unknown',currentPeriodEnd:new Date(now+99_000)},
  now,
}),null);

const {privateKey}=crypto.generateKeyPairSync('ec',{namedCurve:'P-256'});
const signingEnv={...process.env,NESTAI_SIGNING_PRIVATE_JWK:JSON.stringify(privateKey.export({format:'jwk'}))};
const token=issueNestAiToken({
  uid:'member',organizationId:'orgA',appId:'nestlocal',
  appCheckAppId:'appcheck',aiEntitlement:internal!,env:signingEnv,
});
const jwtBody=JSON.parse(Buffer.from(token.token.split('.')[1]!,'base64url').toString('utf8'));
assert.equal(jwtBody.aiEntitlement.appId,'nestlocal');
assert.equal(jwtBody.aiEntitlement.trialEndsAt,trialEnd.toISOString());

const crossApp=issueNestAiToken({
  uid:'member',organizationId:'orgA',appId:'musicscale',
  appCheckAppId:'appcheck',aiEntitlement:internal!,env:signingEnv,
});
const crossAppBody=JSON.parse(Buffer.from(crossApp.token.split('.')[1]!,'base64url').toString('utf8'));
assert.equal(crossAppBody.aiEntitlement,undefined);
console.log('PASS NestLocal Hub trial/paid entitlement isolation and signed token claims');
