/** Provider Retry-After only: never leak sensitive upstream payloads.
 * Clamp to a reasonable API cooldown. No cross-tenant state is stored. */
export function resolveNestAffiliateRetryAfterSeconds(value:string|null,now=Date.now()):number{
 if(!value)return 60;
 const numeric=Number(value);
 const parsed=Number.isFinite(numeric)?numeric:(Date.parse(value)-now)/1000;
 if(!Number.isFinite(parsed))return 60;
 return Math.max(60,Math.min(3600,Math.ceil(parsed)));
}
