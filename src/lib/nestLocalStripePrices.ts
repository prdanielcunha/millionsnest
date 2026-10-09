// Only NestLocal. Never rewrite or filter MusicScale prices/subscriptions.
// Compare *live Stripe data* against the exact approved BRL monthly catalog.
export const NESTLOCAL_LIVE_MONTHLY_CENTS: Record<string,number> = Object.freeze({
  essential:5990,growth:12900,pro:19900,
});
export function validNestLocalStripePrice(price:any,tier:string):boolean {
  const expected=NESTLOCAL_LIVE_MONTHLY_CENTS[tier];
  if(!expected||!price||typeof price!=='object'||price.active!==true||
    typeof price.livemode!=='boolean'||price.currency!=='brl'||price.unit_amount!==expected||
    price.type!=='recurring'||price.recurring?.interval!=='month'||price.recurring?.interval_count!==1||
    price.recurring?.usage_type!=='licensed'||price.lookup_key!==`nestlocal_${tier}_monthly`)return false;
  const product=price.product;
  return !!product&&typeof product==='object'&&product.active===true&&
    product.metadata?.app==='nestlocal'&&product.metadata?.type==='plan'&&product.metadata?.tier===tier&&
    price.metadata?.app==='nestlocal'&&price.metadata?.type==='plan'&&price.metadata?.tier===tier;
}
export function eligibleNestLocalStripePrices(rows:any[]):Record<string,string> {
  const result:Record<string,string>={};
  for(const tier of Object.keys(NESTLOCAL_LIVE_MONTHLY_CENTS)){
    const matches=(Array.isArray(rows)?rows:[]).filter(p=>validNestLocalStripePrice(p,tier));
    if(matches.length===1)result[tier]=matches[0].id;
  }
  return result;
}
