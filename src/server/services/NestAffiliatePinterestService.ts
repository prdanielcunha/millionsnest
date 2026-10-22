import crypto from 'node:crypto';
import express, {type Express, type Request, type Response} from 'express';
import type {Firestore, DocumentData} from 'firebase-admin/firestore';

export const PINTEREST_APP_ID = '1625057';
export const PINTEREST_REDIRECT_URI = 'https://nestaffiliate.millionsnest.com/integrations/pinterest/callback';
const ORIGIN = 'https://nestaffiliate.millionsnest.com';
const SANDBOX = 'https://api-sandbox.pinterest.com/v5';
const TOKEN_URL = 'https://api.pinterest.com/v5/oauth/token';
export const PINTEREST_SCOPES = ['boards:read','boards:write','pins:read','pins:write','user_accounts:read'];
type Context = {dbInstance:Firestore; organizationId:string; actorUid:string; isGlobal:boolean};
type Resolver = (req:Request,res:Response,options:{adminOnly:boolean})=>Promise<Context|null>;
type Fetch = typeof fetch;
const digest = (s:string)=>crypto.createHash('sha256').update(s).digest('hex');
const fail = (code:string)=>{throw new Error(code);};
const privateCollection = (c:Context)=>c.dbInstance.collection('organizations').doc(c.organizationId)
  .collection('products').doc('nestaffiliate').collection('providerSecretState');
const userKey = (uid:string)=>digest(uid);
const tokenRef = (c:Context)=>privateCollection(c).doc('pinterest-token-'+userKey(c.actorUid));
const stateRef = (c:Context)=>privateCollection(c).doc('pinterest-state-'+userKey(c.actorUid));
const appRef = (c:Context)=>privateCollection(c).doc('pinterest-app');

export function pinterestAuthorizationUrl(state:string) {
  const url=new URL('https://www.pinterest.com/oauth/');
  url.search=new URLSearchParams({client_id:PINTEREST_APP_ID,redirect_uri:PINTEREST_REDIRECT_URI,
    response_type:'code',scope:PINTEREST_SCOPES.join(','),state}).toString();
  return url.href;
}

/** No generic URL proxy, production writes, response caching or provider payload logging. */
export class NestAffiliatePinterestService {
  constructor(private request:Fetch=fetch, private now:()=>number=Date.now) {}
  private async app(c:Context) {
    const app=(await appRef(c).get()).data();
    if(!app?.secret || !app?.version)fail('PINTEREST_SETUP_REQUIRED');
    return app!;
  }
  async configure(c:Context,secret:unknown) {
    // This is the operator's single reviewed app, NOT customer BYOK credentials.
    if(!c.isGlobal)fail('PINTEREST_OPERATOR_REQUIRED');
    if(typeof secret!=='string'||secret.length<16||secret.length>512||/\s/.test(secret))fail('PINTEREST_SECRET_FORMAT');
    await appRef(c).set({secret,version:crypto.randomUUID(),appId:PINTEREST_APP_ID,configuredBy:c.actorUid,
      configuredAt:new Date(this.now()).toISOString()});
    return {configured:true};
  }
  async status(c:Context) {
    const [a,t]=await Promise.all([appRef(c).get(),tokenRef(c).get()]);
    const app=a.data(),token=t.data();
    return {appId:PINTEREST_APP_ID,accessTier:'TRIAL',environment:'SANDBOX',publicPublishing:false,
      configured:Boolean(app?.secret),canConfigure:c.isGlobal,redirectUri:PINTEREST_REDIRECT_URI,
      connected:Boolean(token?.accessToken&&token?.appVersion===app?.version),
      expiresAt:token?.expiresAt?new Date(token.expiresAt).toISOString():null};
  }
  async begin(c:Context) {
    const app=await this.app(c),state=crypto.randomBytes(32).toString('hex');
    await stateRef(c).set({stateHash:digest(state),expiresAt:this.now()+600_000,used:false,appVersion:app.version,
      actorUid:c.actorUid,organizationId:c.organizationId});
    return {authorizationUrl:pinterestAuthorizationUrl(state),state,redirectUri:PINTEREST_REDIRECT_URI};
  }
  private async exchange(secret:string,body:URLSearchParams) {
    const response=await this.request(TOKEN_URL,{method:'POST',redirect:'error',
      headers:{Authorization:'Basic '+Buffer.from(PINTEREST_APP_ID+':'+secret).toString('base64'),
        'Content-Type':'application/x-www-form-urlencoded'},body,signal:AbortSignal.timeout(15000)});
    if(!response.ok)fail(response.status===429?'PINTEREST_RATE_LIMITED':'PINTEREST_AUTH_REJECTED');
    const data=await response.json();
    if(typeof data.access_token!=='string'||!data.access_token||typeof data.refresh_token!=='string'||
      !data.refresh_token||!Number.isFinite(data.expires_in)||data.expires_in<=0)fail('PINTEREST_AUTH_RESPONSE');
    const scopes=String(data.scope||'').split(/[ ,]+/).filter(Boolean);
    if(!PINTEREST_SCOPES.every(scope=>scopes.includes(scope)))fail('PINTEREST_SCOPES_REQUIRED');
    return {accessToken:data.access_token as string,refreshToken:data.refresh_token as string,scopes,
      expiresAt:this.now()+data.expires_in*1000};
  }
  async complete(c:Context,code:unknown,state:unknown) {
    if(typeof code!=='string'||!code||code.length>4096||typeof state!=='string'||!/^[a-f0-9]{64}$/.test(state))fail('PINTEREST_STATE_INVALID');
    const app=await this.app(c),ref=stateRef(c),generation=crypto.randomUUID();
    // Single use, actor + tenant + credential version bound. Consume before network exchange.
    await c.dbInstance.runTransaction(async tx=>{
      const s=(await tx.get(ref)).data();
      if(!s||s.used||s.expiresAt<=this.now()||s.stateHash!==digest(state as string)||
        s.actorUid!==c.actorUid||s.organizationId!==c.organizationId||s.appVersion!==app.version)fail('PINTEREST_STATE_INVALID');
      tx.set(ref,{...s,used:true});
      tx.set(tokenRef(c),{generation,connecting:true});
    });
    const tokens=await this.exchange(app.secret,new URLSearchParams({grant_type:'authorization_code',code:code as string,redirect_uri:PINTEREST_REDIRECT_URI}));
    await c.dbInstance.runTransaction(async tx=>{
      const [t,a]=await Promise.all([tx.get(tokenRef(c)),tx.get(appRef(c))]);
      if(t.data()?.generation!==generation||a.data()?.version!==app.version)fail('PINTEREST_CONNECTION_CHANGED');
      tx.set(tokenRef(c),{...tokens,appVersion:app.version,generation,connectedAt:new Date(this.now()).toISOString()});
    });
    return {connected:true,environment:'SANDBOX'};
  }
  async disconnect(c:Context) {
    await c.dbInstance.runTransaction(async tx=>{
      tx.set(tokenRef(c),{generation:crypto.randomUUID(),disconnectedAt:new Date(this.now()).toISOString()});
      tx.set(stateRef(c),{used:true,expiresAt:0});
    });
    return {connected:false};
  }
  private async token(c:Context) {
    const app=await this.app(c),ref=tokenRef(c),lease=crypto.randomUUID();
    let current:DocumentData|undefined,refresh=false;
    await c.dbInstance.runTransaction(async tx=>{
      const t=(await tx.get(ref)).data();
      if(!t?.accessToken||t.appVersion!==app.version)fail('PINTEREST_CONNECT_REQUIRED');
      current=t;
      if(t.expiresAt>this.now()+90_000)return;
      if(t.refreshLeaseUntil>this.now())fail('PINTEREST_REFRESH_BUSY');
      refresh=true;
      tx.set(ref,{refreshLease:lease,refreshLeaseUntil:this.now()+30_000},{merge:true});
    });
    if(refresh) {
      try {
        const tokens=await this.exchange(app.secret,new URLSearchParams({grant_type:'refresh_token',refresh_token:current!.refreshToken}));
        await c.dbInstance.runTransaction(async tx=>{
          const t=(await tx.get(ref)).data();
          if(t?.generation!==current!.generation||t?.refreshLease!==lease)fail('PINTEREST_CONNECTION_CHANGED');
          tx.set(ref,{...tokens,refreshLease:null,refreshLeaseUntil:0},{merge:true});
        });
        current={...current,...tokens};
      } catch {
        await c.dbInstance.runTransaction(async tx=>{
          const t=(await tx.get(ref)).data();
          if(t?.refreshLease===lease)tx.set(ref,{refreshLease:null,refreshLeaseUntil:0},{merge:true});
        });
        fail('PINTEREST_RECONNECT_REQUIRED');
      }
    }
    return current!;
  }
  private async call(token:string,path:string,body?:unknown) {
    const response=await this.request(SANDBOX+path,{method:body?'POST':'GET',redirect:'error',
      headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
      ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});
    if(!response.ok)fail(response.status===429?'PINTEREST_RATE_LIMITED':response.status===401?'PINTEREST_RECONNECT_REQUIRED':'PINTEREST_SANDBOX_REJECTED');
    return response.json();
  }
  async boards(c:Context,bookmark?:unknown) {
    if(bookmark!==undefined&&(typeof bookmark!=='string'||bookmark.length>2048))fail('PINTEREST_INPUT_INVALID');
    const token=await this.token(c);
    const q=new URLSearchParams({page_size:'100',...(bookmark?{bookmark:String(bookmark)}:{})});
    const data=await this.call(token.accessToken,'/boards?'+q);
    return {items:(Array.isArray(data.items)?data.items:[]).filter((x:any)=>/^\d+$/.test(String(x.id))&&typeof x.name==='string')
      .map((x:any)=>({id:String(x.id),name:x.name})),bookmark:typeof data.bookmark==='string'?data.bookmark:null,environment:'SANDBOX'};
  }
  private async once(c:Context,key:unknown,action:string,execute:(token:string)=>Promise<unknown>) {
    if(typeof key!=='string'||!/^[a-f0-9-]{32,64}$/.test(key))fail('PINTEREST_REQUEST_ID_REQUIRED');
    const token=await this.token(c),base=privateCollection(c);
    const op=base.doc('pinterest-op-'+digest(c.actorUid+':'+key));
    const quota=base.doc('pinterest-quota-'+userKey(c.actorUid));
    await c.dbInstance.runTransaction(async tx=>{
      const [o,q,t]=await Promise.all([tx.get(op),tx.get(quota),tx.get(tokenRef(c))]);
      if(o.exists)fail('PINTEREST_REQUEST_ALREADY_ATTEMPTED');
      if(t.data()?.generation!==token.generation)fail('PINTEREST_CONNECTION_CHANGED');
      const previous=q.data(),inHour=previous?.windowStart>this.now()-3600_000;
      const count=inHour?Number(previous?.count||0):0;
      if(count>=10||previous?.lastAttempt>this.now()-30_000)fail('PINTEREST_TEST_LIMIT');
      tx.set(quota,{count:count+1,lastAttempt:this.now(),windowStart:inHour?previous!.windowStart:this.now()});
      tx.set(op,{action,attemptedAt:new Date(this.now()).toISOString(),outcome:'ATTEMPTED'});
    });
    // Never retry POST automatically, including ambiguous network outcomes.
    const result=await execute(token.accessToken);
    await op.set({outcome:'COMPLETED'},{merge:true});
    return result;
  }
  async createBoard(c:Context,input:any) {
    if(input.consent!==true||typeof input.name!=='string'||!input.name.trim()||input.name.length>100)fail('PINTEREST_REVIEW_REQUIRED');
    return this.once(c,input.requestId,'SANDBOX_BOARD',async token=>{
      const result=await this.call(token,'/boards',{name:input.name.trim(),description:'NestAffiliate API Sandbox test'});
      return {id:String(result.id),name:String(result.name),environment:'SANDBOX'};
    });
  }
  async createPin(c:Context,input:any) {
    const body=validatePinterestTestPin(input);
    return this.once(c,input.requestId,'SANDBOX_PIN',async token=>{
      const result=await this.call(token,'/pins',body);
      return {id:String(result.id),environment:'SANDBOX',publicPublishing:false};
    });
  }
}

export function validatePinterestTestPin(input:any) {
  if(input?.consent!==true||input?.rightsConfirmed!==true)fail('PINTEREST_REVIEW_REQUIRED');
  if(typeof input.boardId!=='string'||!/^\d{1,40}$/.test(input.boardId)||
    typeof input.title!=='string'||!input.title.trim()||input.title.length>100||
    typeof input.description!=='string'||input.description.length>800||
    typeof input.altText!=='string'||input.altText.length>500)fail('PINTEREST_INPUT_INVALID');
  let link:URL;
  try {link=new URL(input.link);}catch {return fail('PINTEREST_LINK_INVALID');}
  if(link.protocol!=='https:'||link.username||link.password||!link.hostname.includes('.')||link.href.length>2048)fail('PINTEREST_LINK_INVALID');
  if(typeof input.imageData!=='string'||input.imageData.length>7_000_000)fail('PINTEREST_IMAGE_INVALID');
  const match=/^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/]+={0,2})$/.exec(input.imageData);
  if(!match)fail('PINTEREST_IMAGE_INVALID');
  const bytes=Buffer.from(match![2],'base64');
  if(bytes.length<32||bytes.length>5_000_000||bytes.toString('base64')!==match![2]||
    (match![1]==='image/png'?!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):
      !(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)))fail('PINTEREST_IMAGE_INVALID');
  return {board_id:input.boardId,title:input.title.trim(),description:input.description,link:link!.href,
    alt_text:input.altText,media_source:{source_type:'image_base64',content_type:match![1],data:match![2]}};
}

export function registerNestAffiliatePinterestRoutes(app:Express,resolve:Resolver,service=new NestAffiliatePinterestService()) {
  const base='/api/v1/nestaffiliate/pinterest';
  const route=(method:'get'|'post',path:string,action:(c:Context,r:Request)=>Promise<unknown>)=>{
    const handler=async(req:Request,res:Response)=>{
      res.setHeader('Cache-Control','private, no-store');
      try {
        // Firebase bearer auth AND existing canonical tenant/entitlement/admin authority on every request.
        const c=await resolve(req,res,{adminOnly:true});if(!c)return;
        if(method==='post'&&req.headers.origin!==ORIGIN)return res.status(403).json({error:'PINTEREST_ORIGIN_REJECTED'});
        return res.json(await action(c,req));
      } catch(error) {
        const raw=error instanceof Error?error.message:'';
        const code=/^PINTEREST_[A-Z_]+$/.test(raw)?raw:'PINTEREST_UNAVAILABLE';
        return res.status(code.includes('REQUIRED')||code.includes('OPERATOR')?403:
          code.includes('LIMIT')?429:code.includes('ALREADY')||code.includes('CHANGED')||code.includes('BUSY')?409:
          code.includes('INVALID')||code.includes('FORMAT')?400:502).json({error:code});
      }
    };
    if(method==='post')app.post(base+path,express.json({limit:path==='/sandbox/pins'?'8mb':'8kb'}),handler);
    else app.get(base+path,handler);
  };
  route('get','/status',c=>service.status(c));
  route('post','/operator-credentials',(c,r)=>service.configure(c,r.body?.secret));
  route('post','/oauth/start',c=>service.begin(c));
  route('post','/oauth/complete',(c,r)=>service.complete(c,r.body?.code,r.body?.state));
  route('post','/disconnect',c=>service.disconnect(c));
  route('get','/sandbox/boards',(c,r)=>service.boards(c,r.query.bookmark));
  route('post','/sandbox/boards',(c,r)=>service.createBoard(c,r.body));
  route('post','/sandbox/pins',(c,r)=>service.createPin(c,r.body));
}
