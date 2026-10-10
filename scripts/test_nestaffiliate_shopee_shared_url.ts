import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {safeShopeeUrl,parseShopeeListingId,shopeeTitleHint,resolveShopeeSharedUrl} from '../src/server/services/NestAffiliateShopeeLinkService.ts';
test('rejects outbound SSRF and credentials in URLs',()=>{
 for(const url of ['http://shope.ee/x','https://shope.ee.evil.com/x','https://127.0.0.1/x','https://user@shope.ee/x','https://shope.ee:8080/x'])
  assert.equal(safeShopeeUrl(url),null);
});
test('shortlink resolves to exact product URL without claiming listing or commission verified',async()=>{
 const mock=async()=>({status:302,headers:new Headers({location:'https://shopee.com.br/Jogo-de-Panelas-i.123456.654321'})}) as Response;
 const url=await resolveShopeeSharedUrl('https://s.shopee.com.br/ABC123',mock as typeof fetch);
 assert.deepEqual(parseShopeeListingId(url),{shopId:'123456',itemId:'654321'});
 assert.equal(shopeeTitleHint(url),'Jogo de Panelas');
 const bad=async()=>({status:302,headers:new Headers({location:'https://evil.example/secret'})}) as Response;
 await assert.rejects(resolveShopeeSharedUrl('https://shope.ee/x',bad as typeof fetch),/SHOPEE_UNSAFE_REDIRECT/);
});
test('opaque short code has no verified shop or item id',()=>assert.equal(parseShopeeListingId('https://shope.ee/abc'),null));
