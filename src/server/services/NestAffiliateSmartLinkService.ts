/** Read only official Mercado Livre listing facts from allowlisted links. */
const HOSTS = new Set(['meli.la','mercadolivre.com.br','www.mercadolivre.com.br','mercadolibre.com.br','www.mercadolibre.com.br']);
export function safeMeliLink(value:string): URL | null {
  try {
    const u=new URL(value);
    if(u.protocol!=='https:' || u.username || u.password || u.port || u.hostname.endsWith('.')) return null;
    return HOSTS.has(u.hostname.toLowerCase()) ? u : null;
  }catch {return null;}
}
export function itemIdFromMeliUrl(value:string):string|null{
  const u=safeMeliLink(value);
  if(!u)return null;
  const m=u.pathname.match(/(?:^|[\/_-])MLB[-_]?([0-9]{7,14})(?:$|[\/_-])/i);
  return m?'MLB'+m[1]:null;
}
export async function resolveMeliLink(value:string,request:typeof fetch=fetch):Promise<string>{
  let current=safeMeliLink(value);
  if(!current)throw new Error('INVALID_MARKETPLACE_LINK');
  for(let i=0;i<4;i++){
    if(current.hostname.toLowerCase()!=='meli.la')return current.toString();
    const response=await request(current.toString(),{
      method:'HEAD',redirect:'manual',signal:AbortSignal.timeout(6000),
    });
    if(![301,302,303,307,308].includes(response.status))throw new Error('SHORTLINK_UNRESOLVED');
    const next=response.headers.get('location');
    if(!next)throw new Error('SHORTLINK_UNRESOLVED');
    current=safeMeliLink(new URL(next,current.toString()).toString());
    if(!current)throw new Error('UNEXPECTED_REDIRECT_HOST');
  }
  throw new Error('SHORTLINK_TOO_MANY_REDIRECTS');
}
export function officialMeliItem(payload:unknown,itemId:string) {
  if(!payload || typeof payload!=='object')return null;
  const x=payload as Record<string,unknown>;
  if(x.id!==itemId || typeof x.title!=='string' || x.title.length<5
     || typeof x.permalink!=='string' || !safeMeliLink(x.permalink))return null;
  return {
    id:itemId,title:x.title,url:x.permalink,
    ...(typeof x.price==='number' && Number.isFinite(x.price)&&x.price>0?{price:x.price}:{}),
    currency:typeof x.currency_id==='string'?x.currency_id:'BRL',
    availability:x.status==='active'?'available':x.status==='paused'?'unavailable':'unknown',
    ...(typeof x.sold_quantity==='number' && x.sold_quantity>=0?{soldQuantity:x.sold_quantity}:{}),
    ...(typeof x.available_quantity==='number' && x.available_quantity>=0?{availableQuantity:x.available_quantity}:{}),
    ...(typeof x.thumbnail==='string' && /^https?:\/\/[^/]*mlstatic\.com\//i.test(x.thumbnail)
      ?{imageUrl:x.thumbnail.replace(/^http:/,'https:')}:{}),
  };
}
