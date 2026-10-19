import {createHash} from 'node:crypto';
import {FieldPath,FieldValue,type Firestore,type Transaction} from 'firebase-admin/firestore';

export const nameKey=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/\s+/g,' ');
export const safeId=(value:unknown):value is string=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(value);
export const keyFor=(kind:string,id:string)=>kind+'_'+createHash('sha256').update(id).digest('hex').slice(0,40);
export const rootFor=(org:string)=>`organizations/${org}`;
export const journeyFor=(org:string)=>rootFor(org)+'/products/raiz_e_mesa';
export class DirectoryError extends Error{
  constructor(public code:string,public status=409){super(code);}
}
export function active(data:any){return Boolean(data)&&data.disabled!==true&&data.archived!==true&&!data.deletedAt&&!['removed','revoked','inactive','suspended','disabled','deleted','archived'].includes(String(data.status||'active').trim().toLowerCase());}
export const contactKey=(kind:'phone'|'email',value:string)=>{
  const normalized=kind==='email'?value.trim().toLowerCase():value.replace(/\D/g,'');
  const key=kind==='phone'&&[10,11].includes(normalized.length)?'55'+normalized:normalized;
  return key?keyFor(kind,key):'';
};
export type DirectorySource={kind:'account'|'journey';id:string;name:string;unitId?:string;contactKeys?:string[]};
export function refsFor(db:Firestore,org:string,source:Pick<DirectorySource,'kind'|'id'>){
  const key=keyFor(source.kind,source.id);
  return {source:db.doc(`${rootFor(org)}/peopleDirectorySources/${key}`),person:db.doc(`${rootFor(org)}/peopleDirectory/${key}`)};
}
export async function assertDirectoryAdmin(tx:Transaction,db:Firestore,org:string,uid:string){
  const [o,m,u]=await Promise.all([tx.get(db.doc(rootFor(org))),tx.get(db.doc(rootFor(org)+'/members/'+uid)),tx.get(db.doc('users/'+uid))]);
  const d=o.data(),member=m.data(),role=String(member?.organizationRole||member?.role||'').trim().toLowerCase();
  const owner=d?.ownerUid===uid||d?.ownerId===uid||d?.ownerUserId===uid;
  if(!active(d)||!active(u.data())||!owner&&(!active(member)||member?.organizationId&&member.organizationId!==org||!['owner','admin','pastor','data_admin'].includes(role)))throw new DirectoryError('ADMIN_REQUIRED',403);
}
export async function sourcesForPerson(tx:Transaction,db:Firestore,org:string,id:string){
  const aliases=await tx.get(db.collection(rootFor(org)+'/peopleDirectory').where('mergedInto','==',id).limit(30));
  if(aliases.size===30)throw new DirectoryError('IDENTITY_ALIAS_REVIEW_REQUIRED');
  const rows=await tx.get(db.collection(rootFor(org)+'/peopleDirectorySources').where('personId','in',[id,...aliases.docs.map(x=>x.id)]).limit(101));
  if(rows.size>100)throw new DirectoryError('PERSON_PARTICIPATION_REVIEW_REQUIRED');
  return rows;
}
export async function assertNoDirectoryConflict(tx:Transaction,db:Firestore,org:string,name:string,phoneKey=''){
  const normalized=nameKey(name);
  await tx.get(db.doc(rootFor(org)+'/peopleDirectoryNameLocks/'+keyFor('name',normalized)));
  if(phoneKey)await tx.get(db.doc(rootFor(org)+'/peopleDirectoryNameLocks/'+phoneKey));
  const byName=await tx.get(db.collection(rootFor(org)+'/peopleDirectory').where('searchName','==',normalized).limit(1));
  const byPhone=phoneKey?await tx.get(db.collection(rootFor(org)+'/peopleDirectorySources').where('contactKeys','array-contains',phoneKey).limit(1)):null;
  if(!byName.empty||byPhone&&!byPhone.empty)throw new DirectoryError('POSSIBLE_DUPLICATE');
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
    if(existing.data?.originSource===refs.source.id&&existing.data.name!==source.name)tx.update(canonical,{name:source.name,searchName:normalized,updatedAt:now});
    const before=previous.data(),changed=!previous.exists||before?.name!==source.name||JSON.stringify(before?.contactKeys||[])!==JSON.stringify(contactKeys);
    if(!previous.exists)tx.create(refs.source,{organizationId:org,kind:source.kind,sourceId:source.id,personId:canonical.id,unitId:source.unitId||'',name:source.name,contactKeys,createdAt:now});
    else if(changed)tx.update(refs.source,{name:source.name,contactKeys,updatedAt:now});
    if(changed)for(const lock of locks)tx.set(lock,{revision:FieldValue.increment(1)},{merge:true});
  }};
}

/** Additive projection, paginated and repeatable; never guesses identity from a name. */
export async function synchronizeDirectoryPage(db:Firestore,org:string,actor:string,kind:'account'|'journey',cursor?:string){
  let query=db.collection(kind==='account'?`${rootFor(org)}/members`:`${journeyFor(org)}/people`).orderBy(FieldPath.documentId()).limit(60);
  if(cursor)query=query.startAfter(cursor);
  const rows=await query.get();
  const users=kind==='account'&&rows.size?await db.getAll(...rows.docs.map(d=>db.doc('users/'+d.id))):[];
  const sources:DirectorySource[]=[];
  for(let i=0;i<rows.size;i++){
    const doc=rows.docs[i],data=doc.data();
    if(!active(data)||data.organizationId&&data.organizationId!==org)continue;
    const user=users[i]?.data();
    if(kind==='account'&&!active(user))continue;
    const name=String(kind==='account'?user?.displayName||data.displayName||data.name||'':data.name||'').trim();
    if(name.length<2||name.length>160)continue;
    const contactKeys=[contactKey('email',String(user?.email||'')),contactKey('phone',String(kind==='journey'&&data.consent===true?data.phone||'':''))].filter(Boolean);
    sources.push({kind,id:doc.id,name,contactKeys,...(kind==='journey'?{unitId:data.congregationId}:{})});
  }
  await db.runTransaction(async tx=>{
    await assertDirectoryAdmin(tx,db,org,actor);
    const plans=[];
    for(const source of sources)plans.push(await planSource(tx,db,org,source,actor));
    plans.forEach(p=>p.apply());
  });
  return {processed:sources.length,nextCursor:rows.size===60?rows.docs.at(-1)!.id:null};
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
  return {people:rows.docs.filter(x=>!x.data().mergedInto).map(x=>({id:x.id,name:x.data().name,hasAccount:Boolean(x.data().accountUid),unitIds:x.data().unitIds||[],revision:x.data().revision})),nextCursor:rows.size===60?rows.docs.at(-1)!.id:null};
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
