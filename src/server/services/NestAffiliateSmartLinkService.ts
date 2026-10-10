/** Read only official Mercado Livre listing facts from allowlisted links. */
const OFFICIAL_DOMAINS=['mercadolivre.com.br','mercadolibre.com.br','mercadolibre.com'];
function ownedMeliHost(host:string){return host==='meli.la'||OFFICIAL_DOMAINS.some(domain=>host===domain||host.endsWith('.'+domain));}
export function safeMeliLink(value:string): URL | null {
  try {
    const u=new URL(value);
    if(u.protocol!=='https:' || u.username || u.password || u.port || u.hostname.endsWith('.')) return null;
    return ownedMeliHost(u.hostname.toLowerCase()) ? u : null;
  }catch {return null;}
}
export function itemIdFromMeliUrl(value:string):string|null{
  const u=safeMeliLink(value);
  if(!u)return null;
  if(/\/p\/MLB[0-9]{7,14}/i.test(u.pathname))return null;
  const m=u.pathname.match(/(?:^|[\/_-])MLB[-_]?([0-9]{7,14})(?:$|[\/_-])/i);
  return m?'MLB'+m[1]:null;
}

type MeliLanding = {canonicalUrl:string;title?:string;imageUrl?:string};
export function parseMeliPublicMetadata(html:string,base:string){
  const find=(name:string)=>{
    const tags=html.match(/<meta\b[^>]{0,1500}>/gi)||[];
    for(const tag of tags){
      if(!new RegExp('(?:name|property)\\s*=\\s*["\\x27]'+name+'["\\x27]','i').test(tag))continue;
      const value=tag.match(/\bcontent\s*=\s*(?:"([^"]{0,1000})"|'([^']{0,1000})')/i);
      if(value)return (value[1]||value[2]||'').trim().replace(/&amp;/gi,'&').replace(/&quot;/gi,'"');
    }
    return '';
  };
  const candidate=find('og:url');
  const parsed=candidate?safeMeliLink(new URL(candidate,base).toString()):null;
  const title=(find('og:title')||html.match(/<title>\s*([^<]{4,220})<\/title>/i)?.[1]||'')
    .replace(/\s+/g,' ').trim().slice(0,180);
  const validTitle=title.length>=8&&!/^(mercado livre|mercadolibre|mercado libre|access denied|acesso negado|just a moment)(\s*[-|].*)?$/i.test(title);
  const img=find('og:image');let imageUrl:string|undefined;
  try{
    const u=new URL(img);
    if(u.protocol==='https:'&&!u.port&&(u.hostname==='mlstatic.com'||u.hostname.endsWith('.mlstatic.com')))imageUrl=u.toString();
  }catch{}
  return {...(parsed?{canonicalUrl:parsed.toString()}:{}),
    ...(validTitle?{title}:{}),...(imageUrl?{imageUrl}:{})};
}
async function boundedHtml(response:Response):Promise<string>{
  if(!/text\/html/i.test(response.headers.get('content-type')||''))return '';
  const reader=response.body?.getReader();if(!reader)return '';
  const dec=new TextDecoder();let total=0,body='';
  try{while(total<96_000){const {value,done}=await reader.read();if(done)break;
    const bytes=value.slice(0,96_000-total);total+=bytes.byteLength;body+=dec.decode(bytes,{stream:true});
  }}finally{await reader.cancel().catch(()=>undefined);}
  return body;
}
export async function resolveMeliLanding(value:string,request:typeof fetch=fetch):Promise<MeliLanding>{
  let current=safeMeliLink(value);
  if(!current)throw new Error('INVALID_MARKETPLACE_LINK');
  let title:string|undefined,imageUrl:string|undefined;
  for(let hop=0;hop<6;hop++){
    if(current.hostname!=='meli.la'&&(itemIdFromMeliUrl(current.toString())||catalogIdFromMeliUrl(current.toString())))
      return {canonicalUrl:current.toString(),...(title?{title}:{}),...(imageUrl?{imageUrl}:{})};
    let next:URL|null=null;
    for(const method of ['HEAD','GET'] as const){
      let response:Response;
      try{
        response=await request(current.toString(),{method,redirect:'manual',
          headers:{accept:'text/html','user-agent':'Mozilla/5.0 (compatible; NestAffiliate/1.0)'},
          signal:AbortSignal.timeout(6000)});
      }catch{continue;}
      const location=response.headers.get('location');
      if([301,302,303,307,308].includes(response.status)&&location){
        next=safeMeliLink(new URL(location,current).toString());
        if(!next)throw new Error('UNSAFE_MARKETPLACE_REDIRECT');
        break;
      }
      if(method==='GET'&&response.ok){
        const metadata=parseMeliPublicMetadata(await boundedHtml(response),current.toString());
        title=metadata.title||title;imageUrl=metadata.imageUrl||imageUrl;
        if(metadata.canonicalUrl&&metadata.canonicalUrl!==current.toString()){
          next=safeMeliLink(metadata.canonicalUrl);if(next)break;
        }
        if(title)return {canonicalUrl:current.toString(),title,...(imageUrl?{imageUrl}:{})};
      }
    }
    if(!next)throw new Error('SHORTLINK_UNRESOLVED');
    current=next;
  }
  throw new Error('SHORTLINK_TOO_MANY_REDIRECTS');
}
export async function resolveMeliLink(value:string,request:typeof fetch=fetch):Promise<string>{
  return (await resolveMeliLanding(value,request)).canonicalUrl;
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

export function catalogIdFromMeliUrl(value:string):string|null {
  const u=safeMeliLink(value);
  if(!u)return null;
  const m=u.pathname.match(/\/p\/(MLB[0-9]{7,14})(?:\/|$)/i);
  return m?m[1]!.toUpperCase():null;
}
export function officialMeliCatalog(payload:unknown,catalogId:string){
  if(!payload||typeof payload!=='object')return null;
  const p=payload as Record<string,unknown>;
  if(p.id!==catalogId || typeof p.name!=='string' || p.name.trim().length<5)return null;
  const pictures=Array.isArray(p.pictures)?p.pictures as Array<Record<string,unknown>>:[];
  const candidate=String(pictures[0]?.secure_url||pictures[0]?.url||'');
  const imageUrl=/^https:\/\/[^/]*mlstatic\.com\//i.test(candidate)?candidate:undefined;
  return {id:catalogId,title:p.name.trim(),...(imageUrl?{imageUrl}:{})};
}
