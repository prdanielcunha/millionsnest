import {createHash} from 'node:crypto';
import {FieldPath,FieldValue,type Firestore,type Transaction} from 'firebase-admin/firestore';

export const nameKey=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/\s+/g,' ');
export const safeId=(value:unknown):value is string=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(value);
export const keyFor=(kind:string,id:string)=>kind+'_'+createHash('sha256').update(id).digest('hex').slice(0,40);
export const rootFor=(org:string)=>`organizations/${org}`;
export const journeyFor=(org:string)=>rootFor(org)+'/products/raiz_e_mesa';
const snapshotVersion=(snap:FirebaseFirestore.DocumentSnapshot|null)=>snap?.updateTime?String(snap.updateTime.seconds)+'.'+String(snap.updateTime.nanoseconds):'missing';
export class DirectoryError extends Error{
  constructor(public code:string,public status=409){super(code);}
}
export function active(data:any){return Boolean(data)&&data.enabled!==false&&data.active!==false&&data.disabled!==true&&data.archived!==true&&!data.deletedAt&&!['removed','revoked','inactive','suspended','disabled','deleted','archived','pending','invited'].includes(String(data.status||'active').trim().toLowerCase());}
export const contactKey=(kind:'phone'|'email',value:string)=>{
  const normalized=kind==='email'?value.trim().toLowerCase():value.replace(/\D/g,'');
  const key=kind==='phone'&&[10,11].includes(normalized.length)?'55'+normalized:normalized;
  return key?keyFor(kind,key):'';
};
export type DirectorySource={kind:'account'|'journey'|'manual';id:string;name:string;unitId?:string;contactKeys?:string[];inactive?:boolean};
export function refsFor(db:Firestore,org:string,source:Pick<DirectorySource,'kind'|'id'>){
  const key=keyFor(source.kind,source.id);
  return {source:db.doc(`${rootFor(org)}/peopleDirectorySources/${key}`),person:db.doc(`${rootFor(org)}/peopleDirectory/${key}`)};
}
export async function assertDirectoryAdmin(tx:Transaction,db:Firestore,org:string,uid:string,registrationUnit?:string){
  const [o,m,u]=await Promise.all([tx.get(db.doc(rootFor(org))),tx.get(db.doc(rootFor(org)+'/members/'+uid)),tx.get(db.doc('users/'+uid))]);
  const d=o.data(),member=m.data(),role=String(member?.organizationRole||member?.role||'').trim().toLowerCase();
  const owner=d?.ownerUid===uid||d?.ownerId===uid||d?.ownerUserId===uid;
  const scopedWriter=registrationUnit&&active(member)&&member.congregationIds?.includes(registrationUnit)&&(member.permissions?.canManagePeople===true||member.journeyRole==='presence_host');
  if(!active(d)||!active(u.data())||member?.organizationId&&member.organizationId!==org||!owner&&!scopedWriter&&(!active(member)||!['owner','admin','pastor','data_admin'].includes(role)))throw new DirectoryError('ADMIN_REQUIRED',403);
}
export async function sourcesForPerson(tx:Transaction,db:Firestore,org:string,id:string){
  const aliases=await tx.get(db.collection(rootFor(org)+'/peopleDirectory').where('mergedInto','==',id).limit(30));
  if(aliases.size===30)throw new DirectoryError('IDENTITY_ALIAS_REVIEW_REQUIRED');
  const rows=await tx.get(db.collection(rootFor(org)+'/peopleDirectorySources').where('personId','in',[id,...aliases.docs.map(x=>x.id)]).limit(101));
  if(rows.size>100)throw new DirectoryError('PERSON_PARTICIPATION_REVIEW_REQUIRED');
  const docs=rows.docs.filter(x=>x.data().inactive!==true);
  return {docs,size:docs.length,empty:docs.length===0};
}
export async function assertNoDirectoryConflict(tx:Transaction,db:Firestore,org:string,name:string,phoneKey=''){
  const normalized=nameKey(name);
  await tx.get(db.doc(rootFor(org)+'/peopleDirectoryNameLocks/'+keyFor('name',normalized)));
  if(phoneKey)await tx.get(db.doc(rootFor(org)+'/peopleDirectoryNameLocks/'+phoneKey));
  const byName=await tx.get(db.collection(rootFor(org)+'/peopleDirectory').where('searchName','==',normalized).limit(100));
  if(byName.size===100)throw new DirectoryError('IDENTITY_REVIEW_REQUIRED');
  for(const candidate of byName.docs){const person=await resolvePerson(tx,db,org,candidate.id);if(!(await sourcesForPerson(tx,db,org,person.ref.id)).empty)throw new DirectoryError('POSSIBLE_DUPLICATE');}
  const byPhone=phoneKey?await tx.get(db.collection(rootFor(org)+'/peopleDirectorySources').where('contactKeys','array-contains',phoneKey).limit(100)):null;
  if(byPhone?.docs.some(x=>x.data().inactive!==true))throw new DirectoryError('POSSIBLE_DUPLICATE');
}
export async function resolvePerson(tx:Transaction,db:Firestore,org:string,id:string){
  const seen=new Set<string>();
  for(let i=0;i<8;i++){
    if(!safeId(id)||seen.has(id))throw new DirectoryError('IDENTITY_LINK_CONFLICT');
    seen.add(id);
    const ref=db.doc(`${rootFor(org)}/peopleDirectory/${id}`),snap=await tx.get(ref),data=snap.data();
    if(!snap.exists||data?.organizationId!==org)throw new DirectoryError('PERSON_UNAVAILABLE',404);
    if(!data.mergedInto)return {ref,data};
    id=data.mergedInto;
  }
  throw new DirectoryError('IDENTITY_LINK_DEPTH_EXCEEDED');
}

/** Plan only, so callers can complete every transaction read before writing. */
export async function planSource(tx:Transaction,db:Firestore,org:string,source:DirectorySource,actor:string){
  const refs=refsFor(db,org,source),previous=await tx.get(refs.source);
  if(source.inactive){
    return {id:previous.data()?.personId||refs.person.id,apply:()=>{
      if(previous.exists)tx.update(refs.source,{name:'',contactKeys:[],inactive:true,updatedAt:FieldValue.serverTimestamp()});
    }};
  }
  const normalized=nameKey(source.name),contactKeys=source.contactKeys||[];
  const locks=[keyFor('name',normalized),...contactKeys].map(k=>db.doc(rootFor(org)+'/peopleDirectoryNameLocks/'+k));
  for(const lock of locks)await tx.get(lock);
  const person=previous.exists?await resolvePerson(tx,db,org,previous.data()!.personId):null;
  const canonical=person?.ref||refs.person;
  const existing=person||{ref:canonical,data:(await tx.get(canonical)).data()};
  if(existing.data&&existing.data.organizationId!==org)throw new DirectoryError('TENANT_MISMATCH',403);
  return {id:canonical.id,apply:()=>{
    const now=FieldValue.serverTimestamp();
    if(!existing.data)tx.create(canonical,{organizationId:org,name:source.name,searchName:normalized,originSource:refs.source.id,accountUid:source.kind==='account'?source.id:null,unitIds:source.unitId?[source.unitId]:[],revision:1,createdAt:now,createdBy:actor,updatedAt:now});
    else if(source.unitId&&!existing.data.unitIds?.includes(source.unitId))tx.update(canonical,{unitIds:FieldValue.arrayUnion(source.unitId),updatedAt:now});
    if(existing.data?.originSource===refs.source.id&&(existing.data.name!==source.name||existing.data.inactive))tx.update(canonical,{name:source.name,searchName:normalized,inactive:false,updatedAt:now});
    const before=previous.data(),changed=!previous.exists||before?.name!==source.name||JSON.stringify(before?.contactKeys||[])!==JSON.stringify(contactKeys);
    if(!previous.exists)tx.create(refs.source,{organizationId:org,kind:source.kind,sourceId:source.id,personId:canonical.id,unitId:source.unitId||'',name:source.name,contactKeys,createdAt:now});
    else if(changed||before?.inactive)tx.update(refs.source,{name:source.name,contactKeys,inactive:false,updatedAt:now});
    if(changed)for(const lock of locks)tx.set(lock,{revision:FieldValue.increment(1)},{merge:true});
  }};
}

/** Additive projection, paginated and repeatable; never guesses identity from a name. */
export async function synchronizeDirectoryPage(db:Firestore,org:string,actor:string,kind:'account'|'journey',cursor?:string,registrationUnit?:string){
  return db.runTransaction(async tx=>{
    await assertDirectoryAdmin(tx,db,org,actor,registrationUnit);
    let query=db.collection(kind==='account'?`${rootFor(org)}/members`:`${journeyFor(org)}/people`).orderBy(FieldPath.documentId()).limit(60);
    if(cursor)query=query.startAfter(cursor);
    const rows=await tx.get(query),plans=[],versions:string[]=[];
    // Read the actual sources in this transaction: consent changes invalidate the snapshot.
    for(const doc of rows.docs){
      const data=doc.data(),userSnap=kind==='account'?await tx.get(db.doc('users/'+doc.id)):null,user=userSnap?.data();
      versions.push(doc.id+':'+snapshotVersion(doc)+':'+snapshotVersion(userSnap));
      const inactive=!active(data)||Boolean(data.organizationId&&data.organizationId!==org)||kind==='account'&&!active(user);
      const name=String(kind==='account'?user?.displayName||data.displayName||data.name||'':data.name||'').trim();
      if(!inactive&&(name.length<2||name.length>160))continue;
      const contactKeys=inactive?[]:[contactKey('email',String(user?.email||'')),contactKey('phone',String(kind==='journey'&&data.consent===true?data.phone||'':''))].filter(Boolean);
      plans.push(await planSource(tx,db,org,{kind,id:doc.id,name,contactKeys,inactive,...(kind==='journey'?{unitId:data.congregationId}:{})},actor));
    }
    plans.forEach(p=>p.apply());
    return {processed:rows.size,nextCursor:rows.size===60?rows.docs.at(-1)!.id:null,versions};
  });
}

export type DirectorySnapshot=Record<'account'|'journey',string[]>;
export async function assertSourceSnapshot(tx:Transaction,db:Firestore,org:string,expected:DirectorySnapshot){
  for(const kind of ['account','journey'] as const){
    const rows=await tx.get(db.collection(kind==='account'?rootFor(org)+'/members':journeyFor(org)+'/people').orderBy(FieldPath.documentId()).limit(6001));
    if(rows.size>6000)throw new DirectoryError('DIRECTORY_SYNC_PAGE_LIMIT');
    const actual=[];
    for(const doc of rows.docs){const user=kind==='account'?await tx.get(db.doc('users/'+doc.id)):null;actual.push(doc.id+':'+snapshotVersion(doc)+':'+snapshotVersion(user));}
    if(JSON.stringify(actual)!==JSON.stringify(expected[kind]))throw new DirectoryError('DIRECTORY_REFRESH_REQUIRED');
  }
}
// Physical deletions cannot leave usable contact fingerprints behind.
export async function clearOrphanDirectorySources(db:Firestore,org:string,uid:string,registrationUnit?:string){
  let cursor:string|undefined;
  for(let page=0;page<200;page++){
    const next=await db.runTransaction(async tx=>{
      await assertDirectoryAdmin(tx,db,org,uid,registrationUnit);
      let q=db.collection(rootFor(org)+'/peopleDirectorySources').orderBy(FieldPath.documentId()).limit(60);
      if(cursor)q=q.startAfter(cursor);
      const rows=await tx.get(q),missing=[];
      for(const row of rows.docs){const source=row.data();if(source.inactive||source.kind==='manual')continue;const live=await tx.get(db.doc((source.kind==='account'?rootFor(org)+'/members':journeyFor(org)+'/people')+'/'+source.sourceId));if(!live.exists)missing.push(row.ref);}
      for(const ref of missing)tx.update(ref,{inactive:true,name:'',contactKeys:[],updatedAt:FieldValue.serverTimestamp()});
      return rows.size===60?rows.docs.at(-1)!.id:undefined;
    });
    if(!next)return;
    cursor=next;
  }
  throw new DirectoryError('DIRECTORY_SYNC_PAGE_LIMIT');
}

export async function listDirectory(db:Firestore,org:string,q:string,cursor?:string){
  let query=db.collection(rootFor(org)+'/peopleDirectory').orderBy('searchName').orderBy(FieldPath.documentId());
  const key=nameKey(q);
  if(key)query=query.where('searchName','>=',key).where('searchName','<=',key+'\uf8ff');
  if(cursor){
    const c=await db.doc(rootFor(org)+'/peopleDirectory/'+cursor).get();
    if(!c.exists)throw new DirectoryError('INVALID_CURSOR',400);
    query=query.startAfter(c);
  }
  const rows=await query.limit(60).get();
  const people=[];
  for(const x of rows.docs){
    const sources=await db.runTransaction(tx=>sourcesForPerson(tx,db,org,x.data().mergedInto||x.id));
    if(sources.empty)continue;
    const shared={hasAccount:sources.docs.some(s=>s.data().kind==='account'),unitIds:[...new Set(sources.docs.map(s=>s.data().unitId).filter(Boolean))]};
    if(!people.some(p=>p.id===x.id))people.push({id:x.id,name:x.data().name,...shared,revision:x.data().revision,...(x.data().mergedInto?{mergedInto:x.data().mergedInto}:{})});
    // Searching an old/source name must also return its current canonical person.
    if(x.data().mergedInto){const target=await db.doc(rootFor(org)+'/peopleDirectory/'+x.data().mergedInto).get();if(target.exists&&target.data()?.organizationId===org&&!people.some(p=>p.id===target.id))people.push({id:target.id,name:target.data()!.name,...shared,revision:target.data()!.revision});}
  }
  return {people,nextCursor:rows.size===60?rows.docs.at(-1)!.id:null};
}

/** Explicit, reversible identity reconciliation. Permissions and domain records are untouched. */
export async function linkDirectoryPeople(db:Firestore,org:string,actor:string,fromId:string,toId:string,reason:string,revision:number){
  if(fromId===toId)throw new DirectoryError('SAME_PERSON');
  return db.runTransaction(async tx=>{
    await assertDirectoryAdmin(tx,db,org,actor);
    const from=await resolvePerson(tx,db,org,fromId),to=await resolvePerson(tx,db,org,toId);
    if(from.ref.id!==fromId||to.ref.id!==toId||from.data.revision!==revision)throw new DirectoryError('REFRESH_REQUIRED');
    if(from.data.accountUid&&to.data.accountUid&&from.data.accountUid!==to.data.accountUid)throw new DirectoryError('TWO_LOGIN_ACCOUNTS_REQUIRE_SEPARATE_RECOVERY');
    // Keep the account-bearing record as the canonical target; never move credentials.
    if(from.data.accountUid&&!to.data.accountUid)throw new DirectoryError('SELECT_ACCOUNT_AS_TARGET');
    const inbound=await tx.get(db.collection(rootFor(org)+'/peopleDirectory').where('mergedInto','==',fromId).limit(1));
    if(!inbound.empty)throw new DirectoryError('IDENTITY_CHAIN_REQUIRES_REVIEW');
    const event=db.collection(rootFor(org)+'/peopleDirectoryEvents').doc();
    tx.update(from.ref,{mergedInto:toId,revision:revision+1,lastLinkEvent:event.id,updatedAt:FieldValue.serverTimestamp()});
    tx.update(to.ref,{unitIds:FieldValue.arrayUnion(...(from.data.unitIds||[])),revision:FieldValue.increment(1),updatedAt:FieldValue.serverTimestamp()});
    tx.create(event,{organizationId:org,actorId:actor,action:'people.linked',fromId,toId,reason,fromRevision:revision+1,createdAt:FieldValue.serverTimestamp()});
    return {eventId:event.id};
  });
}
export async function unlinkDirectoryPeople(db:Firestore,org:string,actor:string,fromId:string,reason:string,revision:number){
  return db.runTransaction(async tx=>{
    await assertDirectoryAdmin(tx,db,org,actor);
    const ref=db.doc(rootFor(org)+'/peopleDirectory/'+fromId),snap=await tx.get(ref),data=snap.data();
    if(!data?.mergedInto||data.organizationId!==org||data.revision!==revision)throw new DirectoryError('REFRESH_REQUIRED');
    const target=await resolvePerson(tx,db,org,data.mergedInto);
    const sources=await sourcesForPerson(tx,db,org,target.ref.id);
    const remainingUnits=[...new Set(sources.docs.filter(x=>x.data().personId!==fromId).map(x=>x.data().unitId).filter(Boolean))];
    tx.update(target.ref,{unitIds:remainingUnits,revision:FieldValue.increment(1),updatedAt:FieldValue.serverTimestamp()});
    tx.update(ref,{mergedInto:FieldValue.delete(),revision:revision+1,updatedAt:FieldValue.serverTimestamp()});
    tx.create(db.collection(rootFor(org)+'/peopleDirectoryEvents').doc(),{organizationId:org,actorId:actor,action:'people.unlinked',fromId,toId:data.mergedInto,reason,createdAt:FieldValue.serverTimestamp()});
  });
}
