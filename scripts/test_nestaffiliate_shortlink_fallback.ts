import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolveMeliLanding,parseMeliPublicMetadata} from '../src/server/services/NestAffiliateSmartLinkService.js';
test('GET resolves an affiliate link after HEAD 405',async()=>{
 const calls:string[]=[];
 const mocked=async(_url:string,init?:RequestInit)=>{calls.push(String(init?.method));
  return new Response(null,{status:init?.method==='HEAD'?405:302,headers:init?.method==='HEAD'?{}:
    {location:'https://produto.mercadolivre.com.br/MLB-1234567890'}});};
 assert.equal((await resolveMeliLanding('https://meli.la/2GDhhKL',mocked as typeof fetch)).canonicalUrl,
   'https://produto.mercadolivre.com.br/MLB-1234567890');
 assert.deepEqual(calls,['HEAD','GET']);
});
test('public page metadata survives shortlink GET 200',async()=>{
 const html='<meta property="og:title" content="Cadeira Rosa &amp; Cinza">'+
 '<meta property="og:image" content="https://http2.mlstatic.com/thing.jpg">';
 const mocked=async(_url:string,init?:RequestInit)=>init?.method==='HEAD'?new Response(null,{status:405}):
   new Response(html,{status:200,headers:{'content-type':'text/html'}});
 const row=await resolveMeliLanding('https://meli.la/2GDhhKL',mocked as typeof fetch);
 assert.equal(row.title,'Cadeira Rosa & Cinza');
 assert.match(row.imageUrl||'',/mlstatic.com/);
});
test('redirect to private network is not followed',async()=>{
 const mocked=async()=>new Response(null,{status:302,headers:{location:'https://localhost/secret'}});
 await assert.rejects(resolveMeliLanding('https://meli.la/test',mocked as typeof fetch),/UNSAFE_MARKETPLACE_REDIRECT/);
 assert.deepEqual(parseMeliPublicMetadata('<title>Mercado Livre</title>','https://meli.la/a'),{});
});
