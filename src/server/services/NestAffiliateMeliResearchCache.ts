import crypto from 'node:crypto';
import type {Firestore} from 'firebase-admin/firestore';

type SourceProduct=Record<string,any>;
const MAX_AGE_MS=72*60*60_000;
export function matchMeliResearchTerms(query:string,text:string){
 const norm=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ');
 const excluded=new Set(['para','com','sem','isso','esse','essa','uma','dos','das','que','de','do','da','em','no','na','por','mais','pequena','pequeno']);
 const tokens=norm(query).split(' ').filter(w=>w.length>2&&!excluded.has(w));
 const haystack=norm(text);
 if(tokens.length===0)return 0;
 const matches=tokens.filter(token=>haystack.split(' ').some(word=>word===token||word.startsWith(token)||token.startsWith(word)&&word.length>=5)).length;
 return matches===0?0:matches/tokens.length;
}
/** Research data only — never treats old price, sales, stock or commission as current. */
export function priorMeliResearchProduct(input:SourceProduct,organizationId:string):SourceProduct|null{
 if(input?.organizationId!==organizationId || input?.marketplace!=='MELI' || typeof input?.title?.value!=='string'||typeof input?.url?.value!=='string')return null;
 if(!/^https:\/\/([a-z0-9-]+\.)*(mercadolivre\.com\.br|mercadolibre\.com)(\/|$)/i.test(input.url.value))return null;
 const {price,availability,soldQuantity,availableQuantity,affiliateUrl,commissionRate,estimatedCommission,sellerCommissionRate,shopeeCommissionRate,discountRate,rating,sellerReputation,...safe}=input;
 void price;void availability;void soldQuantity;void availableQuantity;void affiliateUrl;void commissionRate;void estimatedCommission;void sellerCommissionRate;void shopeeCommissionRate;void discountRate;void rating;void sellerReputation;
 return {...safe,listingVerified:false,assetRights:'UNKNOWN',
   availability:{value:'unknown',source:'nestaffiliate-prior-official-observation',observedAt:input.title.observedAt}};
}
export async function readMeliPriorResearch(input:{db:Firestore;organizationId:string;query:string;limit:number;now?:number}){
 const now=input.now??Date.now();
 const root=input.db.collection('organizations').doc(input.organizationId).collection('products').doc('nestaffiliate');
 const key=crypto.createHash('sha256').update(input.query.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ')).digest('hex');
 const exact=(await root.collection('searchCache').doc(key).get()).data();
 const items:Array<{product:SourceProduct;observedAt:string;confidence:number}>=[];
 function add(prod:SourceProduct,at:string,queryHint:string){
   const observed=Date.parse(at);
   if(!Number.isFinite(observed)||now-observed<0||now-observed>MAX_AGE_MS)return;
   const safe=priorMeliResearchProduct(prod,input.organizationId);
   if(!safe)return;
   const similarity=matchMeliResearchTerms(input.query,[prod.title?.value??'',queryHint].join(' '));
   if(similarity<=0)return;
   if(items.some(x=>x.product.externalId===safe.externalId))return;
   items.push({product:safe,observedAt:at,confidence:similarity});
 }
 if(exact?.organizationId===input.organizationId&&Array.isArray(exact.products)){
   for(const p of exact.products.slice(0,30))add(p,exact.observedAt||'',exact.query||'');
 }
 if(items.length<input.limit){
   const recent=await root.collection('dailyAgentOpportunities').limit(35).get();
   for(const row of recent.docs){
     const x=row.data();
     if(x.organizationId===input.organizationId) add(x.product,x.lastRankedAt||x.createdAt||'',x.keyword||'');
   }
 }
 items.sort((a,b)=>b.confidence-a.confidence||Date.parse(b.observedAt)-Date.parse(a.observedAt));
 return items.slice(0,input.limit);
}
export async function recordMeliLiveSearch(input:{db:Firestore;organizationId:string;query:string;products:SourceProduct[];observedAt:string}){
 if(!input.products.length)return;
 const key=crypto.createHash('sha256').update(input.query.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ')).digest('hex');
 const root=input.db.collection('organizations').doc(input.organizationId).collection('products').doc('nestaffiliate');
 await root.collection('searchCache').doc(key).set({
   organizationId:input.organizationId,query:input.query,
   observedAt:input.observedAt,products:input.products.slice(0,20),
   source:'MELI_OFFICIAL',researchOnly:true,
 },{merge:false});
}
