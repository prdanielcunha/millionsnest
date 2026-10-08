/** Private, opt-in Hub -> NestAI credit grant synchronizer.
 * Never call directly from user input; it must be driven by verified Hub
 * trial issuance or canonical, reconciled Stripe subscription events.
 */
import { issueNestAiToken } from './NestAiTokenService.js';

export const PROPOSED_NESTLOCAL_AI_CREDITS = Object.freeze({
  trial:40, essential:150,growth:500,pro:1500,
});

export type NestLocalCreditGrantIntent =
  | { source:'trial'; organizationId:string; sourceRef:string; grantVersion:2;
      beginsAt:string; expiresAt:string; }
  | { source:'plan'; organizationId:string; sourceRef:string; grantVersion:2;
      plan:'essential'|'growth'|'pro'; beginsAt:string; expiresAt:string; };

export async function syncNestLocalAiCreditsFromHub(
  intent:NestLocalCreditGrantIntent,
  options:{env?:NodeJS.ProcessEnv;fetcher?:typeof fetch}={},
):Promise<{grantId:string;created:boolean}> {
  const env=options.env??process.env;
  if(env.NESTAI_COMMERCIAL_CREDITS_ENABLED!=='true' ||
     env.NESTAI_GRANTS_SYNC_ENABLED!=='true') throw new Error('NESTAI_GRANTS_SYNC_DISABLED');
  if(!/^[-_a-zA-Z0-9:.]{3,200}$/.test(intent.organizationId) ||
     !/^[-_a-zA-Z0-9:.]{6,200}$/.test(intent.sourceRef)) throw new Error('NESTAI_GRANTS_SOURCE_INVALID');
  if(intent.grantVersion!==2) throw new Error('NESTAI_GRANTS_VERSION_INVALID');
  const begins=Date.parse(intent.beginsAt),expires=Date.parse(intent.expiresAt);
  if(!Number.isFinite(begins)||!Number.isFinite(expires)||expires<=begins) {
    throw new Error('NESTAI_GRANTS_WINDOW_INVALID');
  }
  if(intent.source==='trial' && expires-begins>7*86_400_000) {
    throw new Error('NESTAI_GRANTS_TRIAL_TOO_LONG');
  }
  const amount=intent.source==='trial'
    ? PROPOSED_NESTLOCAL_AI_CREDITS.trial
    : PROPOSED_NESTLOCAL_AI_CREDITS[intent.plan];
  if(!Number.isSafeInteger(amount)||amount<1)throw new Error('NESTAI_GRANTS_AMOUNT_INVALID');
  // A separate service-scoped Hub ES256 token cannot be minted by a consumer app.
  const signed=issueNestAiToken({
    uid:'service:hub:nestai-grants',organizationId:intent.organizationId,
    appId:'nestlocal',appCheckAppId:'server:hub',
    capabilities:['ai:credits.grant','credits:grant'],tokenType:'service',env,
  });
  const endpoint=env.NESTAI_INTERNAL_API_BASE_URL||'https://ai.millionsnest.com';
  const target=new URL('/v1/credits/grants',endpoint);
  if(target.protocol!=='https:' || !['ai.millionsnest.com'].includes(target.hostname)) {
    throw new Error('NESTAI_GRANTS_ENDPOINT_INVALID');
  }
  const response=await(options.fetcher??fetch)(target,{
    method:'POST',
    headers:{
      authorization:'Bearer '+signed.token,
      'content-type':'application/json',
      'x-millionsnest-app':'nestlocal',
      'x-millionsnest-org':intent.organizationId,
    },
    body:JSON.stringify({
      source:intent.source,sourceRef:intent.sourceRef,grantVersion:intent.grantVersion,
      amount,beginsAt:new Date(begins).toISOString(),expiresAt:new Date(expires).toISOString(),
    }),
    signal:AbortSignal.timeout(10_000),
  });
  const body=await response.json() as {grantId?:unknown;created?:unknown;error?:unknown};
  if(!response.ok||typeof body.grantId!=='string'||typeof body.created!=='boolean'){
    throw new Error('NESTAI_GRANTS_SYNC_FAILED');
  }
  return {grantId:body.grantId,created:body.created};
}
