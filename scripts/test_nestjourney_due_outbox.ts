import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { stageNestJourneyDue, runNestJourneyDueRecovery, authorizeQueuedJourneyEvent, journeyDueOutboxPath } from '../src/server/services/NestJourneyDueOutbox.js';
import { nestJourneyDueEventId } from '../src/server/services/NestJourneyFollowupEventPublisher.js';
import { createJourneyQueuedEventAuthority } from '../src/server/services/NestJourneyQueuedEventAuthority.js';
const now=Date.parse('2026-10-16T20:00:00Z'), dueAt=new Date(now-1000).toISOString();
const secret='synthetic-journey-source-key-more-than-32-characters';
const targets=JSON.stringify({'org-a':{recipientUid:'operator-a',conversationId:'thread-a'}});
const source={organizationId:'org-a',followupId:'followup-a',ownerUid:'caregiver-a',dueAt};
const prefix='organizations/org-a/products/raiz_e_mesa', privatePrefix=journeyDueOutboxPath('org-a');
class Database {
  rows=new Map<string,any>();
  writes:string[]=[];
  doc(path:string):any { const self=this;return {path,id:path.split('/').at(-1),async get(){return {
    exists:self.rows.has(path),data:()=>structuredClone(self.rows.get(path)),
  };}}; }
  collection(path:string):any {
    assert(path===`${prefix}/followups`||path===privatePrefix,'tenant-bound source/outbox queries only');
    return {doc:(id:string)=>this.doc(path+'/'+id),where:(field:string,op:string,value:any)=>{
      let after='',take=0; const q:any={orderBy:(key:string)=>{assert.equal(key,'__name__');return q;},
        limit:(n:number)=>{take=n;assert(n<=5);return q;},startAfter:(id:string)=>{after=id;return q;},
        get:async()=>({docs:[...this.rows.keys()].filter(key=>key.startsWith(path+'/')&&key.slice(path.length+1).indexOf('/')<0)
          .sort().filter(key=>key.split('/').at(-1)!>after).filter(key=>op==='in'?value.includes(this.rows.get(key)[field]):this.rows.get(key)[field]===value)
          .slice(0,take).map(key=>({...this.doc(key),ref:this.doc(key),data:()=>structuredClone(this.rows.get(key))}))})};
      return q;
    }};
  }
  async runTransaction(fn:any) {return fn({get:(ref:any)=>ref.get(),set:(ref:any,data:any)=>{
    assert(ref.path.startsWith(privatePrefix+'/'),'only outbox may be written');this.rows.set(ref.path,structuredClone(data));this.writes.push(ref.path);
  },update:(ref:any,patch:any)=>{assert(ref.path.startsWith(privatePrefix+'/'));Object.assign(this.rows.get(ref.path),patch);this.writes.push(ref.path);}});}
}
function seed() {
 const db=new Database();
 db.rows.set('organizations/org-a',{status:'active',apps:{nestjourney:{status:'active'}}});
 db.rows.set('organizations/org-a/members/caregiver-a',{status:'active',role:'care',congregationIds:['congregation-a']});
 db.rows.set(`${prefix}/followups/followup-a`,{organizationId:'org-a',congregationId:'congregation-a',kind:'first_contact',status:'pending',ownerRef:'caregiver-a',dueAt,careRequestId:'care-a',personId:'person-a'});
 db.rows.set(`${prefix}/careRequests/care-a`,{organizationId:'org-a',congregationId:'congregation-a',personId:'person-a',careType:'first_contact',status:'open',ownerRef:'caregiver-a',summary:'synthetic-sensitive-do-not-export'});
 db.rows.set(`${prefix}/people/person-a`,{organizationId:'org-a',congregationId:'congregation-a',name:'Synthetic Person',phone:'synthetic-phone',consent:true,preferredContactChannel:'whatsapp'});
 return db;
}
const recordPath=privatePrefix+'/'+nestJourneyDueEventId(source);
const args=(db:Database,fetchImpl?:typeof fetch)=>({enabled:true,db:()=>db as any,signingSecret:secret,operatorTargetsJson:targets,now:()=>now,fetchImpl});
let touched=0;
assert.equal((await runNestJourneyDueRecovery({enabled:false,db:()=>{touched++;throw Error();}})).tenants,0);assert.equal(touched,0);
const denied=seed();denied.rows.get(`${prefix}/people/person-a`).consent=false;
assert.equal(await stageNestJourneyDue({db:denied as any,enabled:true,source,now:()=>now}),'denied');
assert(!denied.rows.has(recordPath),'no durable event without consent at creation');
const sent:any[]=[];
const transport:typeof fetch=async(_url,init)=>{
 const raw=String(init?.body),h=init?.headers as Record<string,string>;
 assert.equal(h['x-connect-signature'],createHmac('sha256',secret).update('nestjourney\n'+h['x-connect-timestamp']+'\n'+raw).digest('hex'));
 assert(!/synthetic-phone|Synthetic Person|sensitive|personId|careRequestId|followupId|ownerUid/.test(raw));
 sent.push(JSON.parse(raw));return new Response(JSON.stringify({accepted:true,duplicate:sent.length>1}),{status:202});
};
const db=seed();const first=await runNestJourneyDueRecovery(args(db,transport));
assert.equal(first.staged,1);assert.equal(first.completed,1);assert.equal(sent.length,1);
assert.equal(db.rows.get(recordPath).state,'complete');
await runNestJourneyDueRecovery(args(db,transport));await runNestJourneyDueRecovery(args(db,transport));assert.equal(sent.length,1);
assert.equal(await authorizeQueuedJourneyEvent({db:db as any,event:sent[0],operatorTargetsJson:targets,now:()=>now}),true);
db.rows.get(`${prefix}/people/person-a`).consentRevokedAt=dueAt;
assert.equal(await authorizeQueuedJourneyEvent({db:db as any,event:sent[0],operatorTargetsJson:targets,now:()=>now}),false,'revocation after Connect ACK denies queued delivery');
for(const mutate of [
 (d:Database)=>d.rows.get(`${prefix}/people/person-a`).consent=false,
 (d:Database)=>d.rows.get(`${prefix}/careRequests/care-a`).status='closed',
 (d:Database)=>d.rows.get(`${prefix}/followups/followup-a`).ownerRef='another-caregiver',
 (d:Database)=>d.rows.get('organizations/org-a/members/caregiver-a').status='inactive',
 (d:Database)=>d.rows.get(`${prefix}/people/person-a`).preferredContactChannel='phone',
 (d:Database)=>d.rows.get(`${prefix}/careRequests/care-a`).congregationId='other-congregation',
]) {
 const d=seed();await stageNestJourneyDue({db:d as any,enabled:true,source,now:()=>now});mutate(d);
 const previous=sent.length;const result=await runNestJourneyDueRecovery(args(d,transport));
 assert.equal(result.cancelled,1);assert.equal(sent.length,previous);assert.equal(d.rows.get(recordPath).state,'cancelled');
}
const failed=seed();let clock=now,calls=0;
const flaky:typeof fetch=async()=>{calls++;if(calls===1)throw Error('synthetic-ambiguous-delivery');return new Response(JSON.stringify({accepted:true,duplicate:true}),{status:202});};
const recovery={...args(failed,flaky),now:()=>clock};
assert.equal((await runNestJourneyDueRecovery(recovery)).pending,1);
await runNestJourneyDueRecovery(recovery);await runNestJourneyDueRecovery(recovery);assert.equal(calls,1,'backoff');
clock+=70000;
await runNestJourneyDueRecovery(recovery);await runNestJourneyDueRecovery(recovery);
assert.equal(calls,2);assert.equal(failed.rows.get(recordPath).state,'complete','ambiguous delivery reuses same source identity');

const page=seed();const real=page.rows.get(`${prefix}/followups/followup-a`);page.rows.delete(`${prefix}/followups/followup-a`);
for(let i=0;i<13;i++)page.rows.set(`${prefix}/followups/${String(i).padStart(2,'0')}`,{...real,dueAt:i===12?dueAt:new Date(now+60000).toISOString()});
// Last source id has the same canonical care, but a distinct stable event.
for(let i=0;i<3;i++)await runNestJourneyDueRecovery(args(page,transport));
assert(page.rows.has(privatePrefix+'/'+nestJourneyDueEventId({...source,followupId:'12'})),'durable discovery crosses future first pages');
assert(db.writes.every(p=>p.startsWith(privatePrefix+'/')));

const handler=createJourneyQueuedEventAuthority({enabled:()=>true,secret:()=>secret,targets:()=>targets,db:()=>db as any,now:()=>now});
const raw=Buffer.from(JSON.stringify(sent[0])),timestamp=String(now);
const sig=createHmac('sha256',secret).update('nestjourney-authority\n'+timestamp+'\n').update(raw).digest('hex');
function response(){const r:any={statusCode:200,body:undefined,setHeader(){},status(n:number){r.statusCode=n;return r;},json(v:any){r.body=v;return r;}};return r;}
for(const signature of ['bad',createHmac('sha256',secret).update('nestjourney\n'+timestamp+'\n').update(raw).digest('hex')]){
 const res=response();await handler({body:raw,headers:{'x-connect-timestamp':timestamp,'x-connect-signature':signature}} as any,res);assert.equal(res.statusCode,401);
}
const res=response();await handler({body:raw,headers:{'x-connect-timestamp':timestamp,'x-connect-signature':sig}} as any,res);assert.deepEqual(res.body,{authorized:false});
console.log('NestJourney durable due outbox PASS: transactional consent gate, independent discovery, stable HMAC, leases/backoff, cancellation, post-queue revocation proof, minimal payload, tenant scopes and counts. Synthetic storage/HTTP only.');
