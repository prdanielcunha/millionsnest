/** Shopee shares are untrusted. Verify host before any outbound request. */
const HOSTS=new Set(['shope.ee','s.shopee.com.br','shopee.com.br','www.shopee.com.br','shopee.com','www.shopee.com']);
export function safeShopeeUrl(value:string):URL|null{
 try{const u=new URL(value);
  return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&!u.hostname.endsWith('.')&&HOSTS.has(u.hostname.toLowerCase())?u:null;
 }catch{return null;}
}
export function parseShopeeListingId(value:string):{shopId:string;itemId:string}|null{
 const u=safeShopeeUrl(value);if(!u)return null;
 const match=u.pathname.match(/-i\.(\d{3,20})\.(\d{3,20})(?:[/?#]|$)/i)
   ||u.pathname.match(/\/product\/(\d{3,20})\/(\d{3,20})(?:[/?#]|$)/i);
 if(match)return {shopId:match[1]!,itemId:match[2]!};
 const shop=u.searchParams.get('shopid')||u.searchParams.get('shop_id')||'';
 const item=u.searchParams.get('itemid')||u.searchParams.get('item_id')||'';
 return /^\d{3,20}$/.test(shop)&&/^\d{3,20}$/.test(item)?{shopId:shop,itemId:item}:null;
}
export function shopeeTitleHint(value:string):string|null{
 const u=safeShopeeUrl(value);if(!u)return null;
 const match=u.pathname.match(/^\/([^/]+?)-i\.\d{3,20}\.\d{3,20}(?:\/|$)/i);
 if(!match)return null;
 try{const title=decodeURIComponent(match[1]!).replace(/[-_]+/g,' ').replace(/\s+/g,' ').trim();
  return title.length>=8&&title.length<=160?title:null;
 }catch{return null;}
}
export async function resolveShopeeSharedUrl(value:string,request:typeof fetch=fetch):Promise<string>{
 let current=safeShopeeUrl(value);if(!current)throw new Error('SHOPEE_INVALID_HOST');
 for(let hop=0;hop<5;hop++){
  if(parseShopeeListingId(current.toString()))return current.toString();
  if(!['shope.ee','s.shopee.com.br'].includes(current.hostname))return current.toString();
  let response=await request(current.toString(),{method:'HEAD',redirect:'manual',signal:AbortSignal.timeout(5000)});
  if([405,501].includes(response.status))
   response=await request(current.toString(),{method:'GET',redirect:'manual',signal:AbortSignal.timeout(5000)});
  if(![301,302,303,307,308].includes(response.status)||!response.headers.get('location'))
   throw new Error('SHOPEE_SHORTLINK_UNAVAILABLE');
  const next=safeShopeeUrl(new URL(response.headers.get('location')!,current.toString()).toString());
  if(!next)throw new Error('SHOPEE_UNSAFE_REDIRECT');
  current=next;
 }
 throw new Error('SHOPEE_REDIRECT_LIMIT');
}
