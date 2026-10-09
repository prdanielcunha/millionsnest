import assert from 'node:assert/strict';
import {isMeliTokenUsable,shouldRefreshMeliToken,meliRefreshFailureDelay,ensureNestAffiliateMeliToken} from '../src/server/services/NestAffiliateMeliTokenService.ts';
import {matchMeliResearchTerms,priorMeliResearchProduct} from '../src/server/services/NestAffiliateMeliResearchCache.ts';
import type {Firestore} from 'firebase-admin/firestore';

const now=Date.UTC(2026,9,9,12,0,0);
const current={accessToken:'valid',accessTokenExpiresAt:new Date(now+120_000).toISOString(),refreshToken:'refresh',clientId:'client',clientSecret:'private'};
assert.equal(isMeliTokenUsable(current,now),true);
assert.equal(shouldRefreshMeliToken(current,now),false);
assert.equal(isMeliTokenUsable({...current,accessTokenExpiresAt:new Date(now+60_000).toISOString()},now),false);
assert.equal(shouldRefreshMeliToken({...current,accessTokenExpiresAt:new Date(now+60_000).toISOString()},now),true);
assert.equal(shouldRefreshMeliToken({...current,accessTokenExpiresAt:new Date(now+60_000).toISOString(),clientSecret:undefined},now),false);
assert.ok(meliRefreshFailureDelay(429)>meliRefreshFailureDelay(500));
const good={organizationId:'org',marketplace:'MELI',externalId:'MLB123',title:{value:'Organizador de pratos cozinha',observedAt:new Date(now).toISOString()},url:{value:'https://www.mercadolivre.com.br/p/MLB123'},
 imageUrl:{value:'https://http2.mlstatic.com/example.webp'},price:{value:23.1},soldQuantity:{value:113},availableQuantity:{value:4},availability:{value:'available'},commissionRate:{value:.13},affiliateUrl:{value:'https://mercadolivre.com.br/affiliate123'},listingVerified:true,assetRights:'PLATFORM_PROVIDED'};
const old=priorMeliResearchProduct(good,'org')!;
assert.ok(old);
assert.equal(old.listingVerified,false);assert.equal(old.assetRights,'UNKNOWN');
for(const field of ['price','soldQuantity','availableQuantity','commissionRate','affiliateUrl'])assert.equal(old[field],undefined);
assert.equal(old.availability.value,'unknown');
assert.equal(priorMeliResearchProduct({...good,organizationId:'foreign'},'org'),null);
assert.equal(priorMeliResearchProduct({...good,url:{value:'https://evil.example/steal'}},'org'),null);
assert.ok(matchMeliResearchTerms('organizador cozinha','Suporte organizador cozinha')>.7);
assert.equal(matchMeliResearchTerms('cadeira escritorio','organizador de pratos cozinha'),0);

let record:any={...current,accessToken:'expired',accessTokenExpiresAt:new Date(now-1).toISOString()};
let calls=0;
const snapshot=()=>({data:()=>({...record})});
const ref:any={get:async()=>snapshot()};
const tx={
 get:async()=>snapshot(),
 set:(_r:unknown,value:Record<string,unknown>,opt:{merge?:boolean})=>{record=opt?.merge?{...record,...value}:value;},
};
const collection=(name:string)=>({doc:(id:string)=>({collection, get:ref.get, ...ref})});
const db:any={collection,runTransaction:async(callback:(transaction:typeof tx)=>Promise<any>)=>callback(tx)};
const result=await ensureNestAffiliateMeliToken({db:db as Firestore,organizationId:'org',now:()=>now,requestToken:async c=>{
 calls+=1;assert.equal(c.clientSecret,'private');return {access_token:'new-access',refresh_token:'new-refresh',expires_in:21600};
}});
assert.equal(result.reason,'ROTATED');assert.equal(result.token,'new-access');assert.equal(calls,1);
assert.equal(record.refreshToken,'new-refresh');assert.equal(record.refreshLeaseId,null);
const read=await ensureNestAffiliateMeliToken({db:db as Firestore,organizationId:'org',now:()=>now,requestToken:async()=>{
 throw Error('should not be called');
}});
assert.equal(read.reason,'FRESH');
console.log('NESTAFFILIATE_MELI_REFRESH_RECOVERY_TESTS_OK');
