/** Server-only Stripe refund/dispute -> NestAI unused-credit revocation transport.
 * Call ONLY after independently verifying an actual Stripe reversal for the exact
 * invoice and canonical NestLocal organization. Never accept user-provided reasons.
 * Fail-closed and disabled by default.
 */
import {issueNestAiToken} from './NestAiTokenService.js';

export type PaidCreditReversalReason =
  'refund'|'dispute'|'chargeback'|'billing_correction';
export type VerifiedPaidCreditReversal = {
  organizationId:string;
  sourceRef:string;
  reason:PaidCreditReversalReason;
};

export function validateVerifiedCreditReversal(
  value:VerifiedPaidCreditReversal,
):VerifiedPaidCreditReversal {
  if(!/^[A-Za-z0-9_-]{1,128}$/.test(value.organizationId))
    throw Error('NESTAI_REVOCATION_TENANT_INVALID');
  if(!/^nestlocal:paid:in_[A-Za-z0-9]{6,}$/.test(value.sourceRef))
    throw Error('NESTAI_REVOCATION_SOURCE_INVALID');
  if(!['refund','dispute','chargeback','billing_correction'].includes(value.reason))
    throw Error('NESTAI_REVOCATION_REASON_INVALID');
  return value;
}

export async function revokeNestLocalPaidCreditsFromHub(
  verified:VerifiedPaidCreditReversal,
  options:{env?:NodeJS.ProcessEnv;fetcher?:typeof fetch}={},
):Promise<{grantId:string;revoked:boolean;alreadyRevoked:boolean}> {
  const env=options.env??process.env;
  if(env.NESTAI_COMMERCIAL_CREDITS_ENABLED!=='true' ||
     env.NESTAI_GRANTS_SYNC_ENABLED!=='true' ||
     env.NESTAI_CREDIT_REVOCATIONS_ENABLED!=='true')
    throw Error('NESTAI_REVOCATIONS_DISABLED');
  const intent=validateVerifiedCreditReversal(verified);
  const base=env.NESTAI_INTERNAL_API_BASE_URL||'https://ai.millionsnest.com';
  const target=new URL('/v1/credits/grants/revoke',base);
  if(target.protocol!=='https:'||target.hostname!=='ai.millionsnest.com' ||
     (target.port&&target.port!=='443')||target.username||target.password)
    throw Error('NESTAI_REVOCATION_ENDPOINT_INVALID');
  const signed=issueNestAiToken({
    uid:'service:hub:nestai-revocations',
    organizationId:intent.organizationId,
    appId:'nestlocal',
    appCheckAppId:'server:hub',
    capabilities:['ai:credits.revoke','credits:revoke'],
    tokenType:'service',
    env,
  });
  const response=await(options.fetcher??fetch)(target,{
    method:'POST',
    headers:{
      authorization:'Bearer '+signed.token,
      'content-type':'application/json',
      'x-millionsnest-app':'nestlocal',
      'x-millionsnest-org':intent.organizationId,
    },
    body:JSON.stringify({sourceRef:intent.sourceRef,reason:intent.reason}),
    signal:AbortSignal.timeout(10_000),
  });
  let body:{grantId?:unknown;revoked?:unknown;alreadyRevoked?:unknown}|null=null;
  try{body=await response.json() as typeof body;}catch{throw Error('NESTAI_REVOCATION_SYNC_FAILED');}
  if(!response.ok||typeof body?.grantId!=='string'||
    !/^[a-f0-9]{64}$/.test(body.grantId)||
    typeof body.revoked!=='boolean'||typeof body.alreadyRevoked!=='boolean'||
    body.revoked===body.alreadyRevoked)
    throw Error('NESTAI_REVOCATION_SYNC_FAILED');
  return {grantId:body.grantId,revoked:body.revoked,alreadyRevoked:body.alreadyRevoked};
}
