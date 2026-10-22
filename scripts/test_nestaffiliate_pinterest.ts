import assert from 'node:assert/strict';
import express from 'express';
import {NestAffiliatePinterestService,registerNestAffiliatePinterestRoutes,PINTEREST_REDIRECT_URI,
  PINTEREST_SCOPES,validatePinterestTestPin} from '../src/server/services/NestAffiliatePinterestService.ts';
import type {Firestore} from 'firebase-admin/firestore';

// Synthetic private storage only. No production Firestore or provider calls.
let clock=Date.now(),calls:Array<{url:string;init:any}>=[];
const records=new Map<string,any>();
const node=(path:string):any=>({collection:(s:string)=>node(path+'/'+s),doc:(s:string)=>node(path+'/'+s),
  get:async()=>({exists:records.has(path),data:()=>records.get(path)}),
  set:async(value:any,options?:any)=>{records.set(path,options?.merge?{...records.get(path),...value}:value);},path});
const db={collection:(s:string)=>node(s),runTransaction:async(fn:any)=>fn({get:(r:any)=>r.get(),set:(r:any,v:any,o:any)=>r.set(v,o)})} as Firestore;
const c={dbInstance:db,organizationId:'org-a',actorUid:'owner',isGlobal:true};
const fakeFetch:typeof fetch=async(url,init)=>{
  calls.push({url:String(url),init});
  const data=String(url).endsWith('/oauth/token')?
    {access_token:'synthetic-access',refresh_token:'synthetic-refresh',expires_in:3600,scope:PINTEREST_SCOPES.join(' ')}:
    init?.method==='POST'?{id:'123',name:'Synthetic Sandbox'}:{items:[],bookmark:'next'};
  return new Response(JSON.stringify(data),{status:200,headers:{'content-type':'application/json'}});
};
const service=new NestAffiliatePinterestService(fakeFetch,()=>clock);
await assert.rejects(()=>service.configure({...c,isGlobal:false},'synthetic-secret-12345'),/OPERATOR_REQUIRED/);
await service.configure(c,'synthetic-secret-12345');
const start=await service.begin(c),url=new URL(start.authorizationUrl);
assert.equal(url.origin,'https://www.pinterest.com');
assert.equal(url.searchParams.get('redirect_uri'),PINTEREST_REDIRECT_URI);
assert.equal(url.searchParams.get('client_id'),'1625057');
assert.ok(!url.href.includes('synthetic-secret'));
await assert.rejects(()=>service.complete({...c,actorUid:'other'},'code',start.state),/STATE_INVALID/);
await assert.rejects(()=>service.complete({...c,organizationId:'other'},'code',start.state),/SETUP_REQUIRED/);
await assert.rejects(()=>service.complete(c,'code','0'.repeat(64)),/STATE_INVALID/);
await service.complete(c,'synthetic-code',start.state);
await assert.rejects(()=>service.complete(c,'code',start.state),/STATE_INVALID/);
assert.equal(calls.length,1);
assert.ok(String(calls[0].init.body).includes('grant_type=authorization_code'));
assert.ok(!JSON.stringify(await service.status(c)).includes('synthetic-'));
assert.equal((await service.status(c)).publicPublishing,false);
assert.equal((await service.boards(c)).bookmark,'next');
assert.ok(calls[1].url.startsWith('https://api-sandbox.pinterest.com/v5/boards?'));
await service.createBoard(c,{name:'My reviewed test',consent:true,requestId:'a'.repeat(32)});
clock+=31_000;
await assert.rejects(()=>service.createBoard(c,{name:'test',consent:true,requestId:'a'.repeat(32)}),/ALREADY_ATTEMPTED/);
const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),Buffer.alloc(40)]).toString('base64');
const pin={boardId:'123',title:'Reviewed Pin',description:'Affiliate link: we may earn a commission.',
  link:'https://nestaffiliate.millionsnest.com/',altText:'Original authorized creative',
  imageData:'data:image/png;base64,'+png,consent:true,rightsConfirmed:true,requestId:'b'.repeat(32)};
assert.throws(()=>validatePinterestTestPin({...pin,rightsConfirmed:false}),/REVIEW_REQUIRED/);
assert.throws(()=>validatePinterestTestPin({...pin,link:'javascript:alert(1)'}),/LINK_INVALID/);
assert.throws(()=>validatePinterestTestPin({...pin,imageData:'data:image/png;base64,'+Buffer.alloc(50).toString('base64')}),/IMAGE_INVALID/);
await service.createPin(c,pin);
assert.equal(calls.at(-1)?.url,'https://api-sandbox.pinterest.com/v5/pins');
assert.ok(!JSON.stringify([...records.values()]).includes('"id":"123"')); // provider content is not cached
clock+=3600_000;
await service.boards(c);
assert.ok(calls.some(x=>String(x.init.body).includes('grant_type=refresh_token')));
await service.disconnect(c);
await assert.rejects(()=>service.boards(c),/CONNECT_REQUIRED/);
const expired=await service.begin(c);clock+=600_001;
await assert.rejects(()=>service.complete(c,'code',expired.state),/STATE_INVALID/);

// Real local HTTP boundary: existing resolver remains authoritative; POST origin enforced.
const app=express();
registerNestAffiliatePinterestRoutes(app,async(req,res)=>{
  if(req.headers.authorization!=='Bearer synthetic-firebase'){res.status(401).json({error:'UNAUTHENTICATED'});return null;}
  if((req.method==='GET'?req.query.organizationId:req.body.organizationId)!=='org-a'){
    res.status(403).json({error:'FORBIDDEN'});return null;
  }
  return c;
},service);
const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
try {
  const address=server.address() as {port:number},base=`http://127.0.0.1:${address.port}/api/v1/nestaffiliate/pinterest`;
  assert.equal((await fetch(base+'/status?organizationId=org-a')).status,401);
  assert.equal((await fetch(base+'/status?organizationId=other',{headers:{Authorization:'Bearer synthetic-firebase'}})).status,403);
  const headers={Authorization:'Bearer synthetic-firebase','Content-Type':'application/json'};
  assert.equal((await fetch(base+'/oauth/start',{method:'POST',headers,body:JSON.stringify({organizationId:'org-a'})})).status,403);
  const result=await fetch(base+'/status?organizationId=org-a',{headers});
  assert.equal(result.status,200);assert.equal(result.headers.get('cache-control'),'private, no-store');
  assert.ok(!(await result.text()).includes('synthetic-secret'));
} finally {server.close();}
console.log('NESTAFFILIATE_PINTEREST_OAUTH_SANDBOX_SECURITY_OK');
