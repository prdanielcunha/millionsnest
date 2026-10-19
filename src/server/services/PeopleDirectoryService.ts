import type {Request,Response} from 'express';
import {getAuth} from 'firebase-admin/auth';
import {FieldValue,Timestamp,getFirestore,type Firestore} from 'firebase-admin/firestore';
import {createHash} from 'node:crypto';
import {resolveEcosystemAppAccess} from './EcosystemAccessResolver.js';
import {active,assertNoDirectoryConflict,contactKey,DirectoryError,journeyFor,keyFor,linkDirectoryPeople,listDirectory,nameKey,planSource,resolvePerson,rootFor,safeId,sourcesForPerson,synchronizeDirectoryPage,unlinkDirectoryPeople} from './PeopleDirectory.js';

type Actor={org:string;uid:string;admin:boolean;units:string[]};
type Dependencies={db?:Firestore;verify?:(token:string)=>Promise<{uid:string}>;access?:(uid:string,org:string)=>Promise<boolean>};
type Row={name:string;preferredName:string;personId:string;distinctReason:string;phone:string;consent:boolean;channel:string};
const clean=(v:unknown)=>typeof v==='string'?v.trim().replace(/\s+/g,' '):'';
const isAdmin=(org:any,member:any,uid:string)=>org?.ownerUid===uid||org?.ownerId===uid||org?.ownerUserId===uid||active(member)&&['owner','admin','pastor','data_admin'].includes(String(member.organizationRole||member.role||'').trim().toLowerCase());
export async function synchronizeDirectory(db:Firestore,org:string,uid:string){
  for(const kind of ['account','journey'] as const){
    let cursor:string|undefined;
    for(let page=0;page<100;page++){
      const result=await synchronizeDirectoryPage(db,org,uid,kind,cursor);
      if(!result.nextCursor)break;
      cursor=result.nextCursor;
      if(page===99)throw new DirectoryError('DIRECTORY_SYNC_PAGE_LIMIT');
    }
  }
}

async function authorize(req:Request,db:Firestore,deps:Dependencies):Promise<Actor>{
  const org=req.params.organizationId;
  if(!safeId(org))throw new DirectoryError('INVALID_ORGANIZATION',400);
  const bearer=req.headers.authorization;
  let uid='';
  try{if(!bearer?.startsWith('Bearer '))throw Error();uid=(await (deps.verify??(token=>getAuth().verifyIdToken(token,true)))(bearer.slice(7))).uid;}catch{throw new DirectoryError('UNAUTHENTICATED',401);}
  if(!safeId(uid))throw new DirectoryError('UNAUTHENTICATED',401);
  const [o,m,u]=await Promise.all([db.doc(rootFor(org)).get(),db.doc(rootFor(org)+'/members/'+uid).get(),db.doc('users/'+uid).get()]);
  const orgData=o.data(),member=m.data();
  if(!active(orgData)||!active(u.data())||member?.organizationId&&member.organizationId!==org)throw new DirectoryError('ACCESS_DENIED',403);
  const admin=isAdmin(orgData,member,uid);
  // A global SaaS role alone never grants access to church person records.
  if(!admin){
    if(!active(member)||!(member.permissions?.canManagePeople===true||member.journeyRole==='presence_host'))throw new DirectoryError('PEOPLE_PERMISSION_REQUIRED',403);
    const accessible=deps.access?await deps.access(uid,org):(await resolveEcosystemAppAccess({uid,organizationId:org,appId:'nestjourney',db})).accessible;
    if(!accessible)throw new DirectoryError('PRODUCT_ACCESS_DENIED',403);
  }
  return {org,uid,admin,units:Array.isArray(member?.congregationIds)?member.congregationIds.filter(safeId):[]};
}
function parseRow(row:any):Row{
  if(!row||Object.keys(row).some(k=>!['name','preferredName','personId','distinctReason','phone','consent','channel'].includes(k)))throw new DirectoryError('INVALID_PERSON',400);
  const result:Row={name:clean(row.name),preferredName:clean(row.preferredName),personId:clean(row.personId),distinctReason:clean(row.distinctReason),phone:clean(row.phone),consent:row.consent===true,channel:clean(row.channel)};
  if(result.name.length<2||result.name.length>160||result.preferredName.length>120||/[<>\u0000-\u001f]/.test(result.name+result.preferredName)||result.personId&&!safeId(result.personId)||result.distinctReason.length>300||result.phone.length>40||row.consent!==undefined&&typeof row.consent!=='boolean')throw new DirectoryError('INVALID_PERSON',400);
  if(result.consent&&(!['phone','whatsapp'].includes(result.channel)||!/^\+?[\d ()-]+$/.test(result.phone)||result.phone.replace(/\D/g,'').length<10||result.phone.replace(/\D/g,'').length>15))throw new DirectoryError('INVALID_CONTACT',400);
  return result;
}

/** Registration is atomic across directory, app participation, audit and replay receipt. */
export async function registerDirectory(db:Firestore,actor:Actor,input:{unitId:string;requestId:string;kind:'member'|'visitor';rows:Row[]}){
  const {unitId,requestId,kind,rows}=input;
  if(!safeId(unitId)||!safeId(requestId)||requestId.length<8||!rows.length||rows.length>60||kind==='visitor'&&rows.length!==1)throw new DirectoryError('INVALID_REGISTRATION',400);
  if(!actor.admin&&(kind!=='visitor'||!actor.units.includes(unitId)))throw new DirectoryError('SCOPE_DENIED',403);
  if(new Set(rows.map(r=>nameKey(r.name))).size!==rows.length)throw new DirectoryError('IMPORT_NAMES_REQUIRE_INDIVIDUAL_REVIEW');
  const receiptRef=db.doc(rootFor(actor.org)+'/peopleDirectoryRequests/'+keyFor('request',actor.uid+':'+requestId));
  const payloadHash=createHash('sha256').update(JSON.stringify(input)).digest('hex');
  return db.runTransaction(async tx=>{
    const [receipt,org,member,user,unit]=await Promise.all([
      tx.get(receiptRef),tx.get(db.doc(rootFor(actor.org))),tx.get(db.doc(rootFor(actor.org)+'/members/'+actor.uid)),tx.get(db.doc('users/'+actor.uid)),tx.get(db.doc(journeyFor(actor.org)+'/congregations/'+unitId)),
    ]);
    // Revalidate authority in the same transaction that commits the records.
    if(!active(org.data())||!active(user.data())||actor.admin&&!isAdmin(org.data(),member.data(),actor.uid)||!actor.admin&&(!active(member.data())||!member.data()?.congregationIds?.includes(unitId)||!(member.data()?.permissions?.canManagePeople===true||member.data()?.journeyRole==='presence_host')))throw new DirectoryError('ACCESS_CHANGED',403);
    if(!unit.exists||unit.data()?.active===false||unit.data()?.organizationId&&unit.data()?.organizationId!==actor.org)throw new DirectoryError('UNIT_UNAVAILABLE',404);
    if(receipt.exists){if(receipt.data()?.payloadHash!==payloadHash)throw new DirectoryError('REQUEST_ID_REUSED');return receipt.data()!.result;}
    const plans:Array<()=>void>=[],people:Array<{id:string;personId:string;reused:boolean;name:string}>=[];
    for(let i=0;i<rows.length;i++){
      const row=rows[i],normalized=nameKey(row.name),lock=db.doc(rootFor(actor.org)+'/peopleDirectoryNameLocks/'+keyFor('name',normalized));
      await tx.get(lock);
      const phoneKey=row.consent?contactKey('phone',row.phone):'';
      if(!row.personId&&(!actor.admin||row.distinctReason.length<15))await assertNoDirectoryConflict(tx,db,actor.org,row.name,phoneKey);
      let canonicalId=row.personId;
      let selected:Awaited<ReturnType<typeof resolvePerson>>|null=null;
      if(canonicalId){if(!actor.admin)throw new DirectoryError('ADMIN_REQUIRED',403);selected=await resolvePerson(tx,db,actor.org,canonicalId);canonicalId=selected.ref.id;}
      const localId=keyFor('participation',unitId+':'+(canonicalId||actor.uid+':'+requestId+':'+i));
      const localRef=db.doc(journeyFor(actor.org)+'/people/'+localId);
      const existing=await tx.get(localRef);
      const sources=canonicalId?await sourcesForPerson(tx,db,actor.org,canonicalId):null;
      if(sources&&sources.size>100)throw new DirectoryError('PERSON_PARTICIPATION_REVIEW_REQUIRED');
      const prior=sources?.docs.find(d=>d.data().kind==='journey'&&d.data().unitId===unitId);
      if(prior){const p=await tx.get(db.doc(journeyFor(actor.org)+'/people/'+prior.data().sourceId));if(p.exists&&!p.data()?.deletedAt){people.push({id:p.id,personId:canonicalId,name:p.data()!.name,reused:true});continue;}}
      const identity=canonicalId?null:await planSource(tx,db,actor.org,{kind:'journey',id:localId,name:row.name,unitId,contactKeys:phoneKey?[phoneKey]:[]},actor.uid);
      canonicalId=canonicalId||identity!.id;
      const name=selected?.data.name||row.name;
      people.push({id:localId,personId:canonicalId,name,reused:existing.exists});
      const personId=canonicalId;
      plans.push(()=>{
        identity?.apply();
        if(selected){tx.update(selected.ref,{unitIds:FieldValue.arrayUnion(unitId),updatedAt:FieldValue.serverTimestamp()});tx.set(db.doc(rootFor(actor.org)+'/peopleDirectorySources/'+keyFor('journey',localId)),{organizationId:actor.org,kind:'journey',sourceId:localId,personId,unitId,createdAt:FieldValue.serverTimestamp()});}
        if(!existing.exists){
          tx.create(localRef,{organizationId:actor.org,congregationId:unitId,centralPersonId:personId,name,preferredName:row.preferredName,communityStatus:kind,phone:kind==='visitor'&&row.consent?row.phone:'',consent:kind==='visitor'&&row.consent,preferredContactChannel:kind==='visitor'&&row.consent?row.channel:'',visits:kind==='visitor'?1:0,stage:kind==='visitor'&&row.consent?'contact_authorized':'new',createdBy:actor.uid,createdAt:FieldValue.serverTimestamp(),dataSource:'central_directory_v1',...(kind==='visitor'?{firstVisit:new Date().toISOString().slice(0,10),ownerRef:null,contactStatus:row.consent?'pending':'closed',consentGrantedAt:row.consent?FieldValue.serverTimestamp():null,nextActionCode:row.consent?'FIRST_CONTACT':'WELCOME_ON_NEXT_VISIT'}:{})});
          if(kind==='visitor')writeVisitorFacts(tx,db,actor,unitId,localId,row.consent);
        }
      });
    }
    const result={people,created:people.filter(p=>!p.reused).length,batchId:receiptRef.id};
    plans.forEach(apply=>apply());
    tx.create(receiptRef,{organizationId:actor.org,actorId:actor.uid,payloadHash,result,createdAt:FieldValue.serverTimestamp()});
    tx.create(db.collection(rootFor(actor.org)+'/peopleDirectoryEvents').doc(),{organizationId:actor.org,actorId:actor.uid,action:'people.registered',count:rows.length,created:result.created,requestRef:receiptRef.id,createdAt:FieldValue.serverTimestamp()});
    return result;
  });
}
function writeVisitorFacts(tx:FirebaseFirestore.Transaction,db:Firestore,actor:Actor,unit:string,id:string,consent:boolean){
  const root=journeyFor(actor.org),now=FieldValue.serverTimestamp();
  const fact=(fid:string,type:string,ref:string,payload:any)=>tx.create(db.doc(root+'/facts/'+fid),{eventId:fid,eventType:type,occurredAt:now,recordedAt:now,organizationId:actor.org,actorId:actor.uid,subjectRef:'person:'+id,sourceApp:'nestjourney',scope:'congregation:'+unit,evidenceRef:ref,sensitivity:'confidential',version:1,payload});
  fact('visitor-'+id,'VISITOR_REGISTERED','person:'+id,{personId:id,consent});
  if(consent){const careId='first_'+id;tx.create(db.doc(root+'/careRequests/'+careId),{organizationId:actor.org,congregationId:unit,personId:id,careType:'first_contact',source:'visitor_registration',summary:'',status:'open',requestedAt:now,requestedBy:actor.uid,promiseHours:48,dueAt:Timestamp.fromMillis(Date.now()+48*3600000),ownerRef:'',assignedAt:null,assignedBy:'',resolvedAt:null,resolvedBy:'',resolutionCode:'',resolutionNote:''});fact('care-requested-'+careId,'CARE_REQUESTED','careRequest:'+careId,{careRequestId:careId,personId:id,careType:'first_contact',source:'visitor_registration'});}
}

export async function peopleDirectoryHandler(req:Request,res:Response,deps:Dependencies={}){
  res.setHeader('Cache-Control','private,no-store');
  try{
    const db=deps.db??getFirestore(),actor=await authorize(req,db,deps);
    if(req.method==='GET'){
      if(!actor.admin)throw new DirectoryError('ADMIN_REQUIRED',403);
      const q=clean(req.query.q),cursor=clean(req.query.cursor);
      if(q.length>160||cursor&&!safeId(cursor))throw new DirectoryError('INVALID_SEARCH',400);
      return res.json({success:true,...await listDirectory(db,actor.org,q,cursor)});
    }
    if(req.method!=='POST')return res.status(405).json({success:false});
    const b=req.body||{};
    if(b.action==='register'){
      if(!['member','visitor'].includes(b.kind)||!Array.isArray(b.rows)||Object.keys(b).some(k=>!['action','kind','unitId','requestId','rows'].includes(k)))throw new DirectoryError('INVALID_REGISTRATION',400);
      const rows=b.rows.map(parseRow);
      if(actor.admin)await synchronizeDirectory(db,actor.org,actor.uid);
      return res.json({success:true,...await registerDirectory(db,actor,{unitId:b.unitId,requestId:b.requestId,kind:b.kind,rows})});
    }
    if(!actor.admin)throw new DirectoryError('ADMIN_REQUIRED',403);
    if(b.action==='sync'){
      if(!['account','journey'].includes(b.kind)||b.cursor&&!safeId(b.cursor)||Object.keys(b).some(k=>!['action','kind','cursor'].includes(k)))throw new DirectoryError('INVALID_SYNC',400);
      return res.json({success:true,...await synchronizeDirectoryPage(db,actor.org,actor.uid,b.kind,b.cursor)});
    }
    const reason=clean(b.reason);
    if(!['link','unlink'].includes(b.action)||!safeId(b.fromId)||b.action==='link'&&!safeId(b.toId)||reason.length<15||reason.length>300||!Number.isSafeInteger(b.revision)||b.revision<1||Object.keys(b).some(k=>!['action','fromId','toId','reason','revision'].includes(k)))throw new DirectoryError('IDENTITY_CONFIRMATION_REQUIRED',400);
    const result=b.action==='link'?await linkDirectoryPeople(db,actor.org,actor.uid,b.fromId,b.toId,reason,b.revision):await unlinkDirectoryPeople(db,actor.org,actor.uid,b.fromId,reason,b.revision);
    return res.json({success:true,...result});
  }catch(error){if(error instanceof DirectoryError)return res.status(error.status).json({success:false,reasonCode:error.code});return res.status(500).json({success:false,reasonCode:'DIRECTORY_UNAVAILABLE'});}
}
