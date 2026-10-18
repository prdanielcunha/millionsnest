import type {Request, Response} from 'express';
import {createHash, randomBytes} from 'node:crypto';
import {getAuth} from 'firebase-admin/auth';
import {FieldValue, getFirestore, type Firestore} from 'firebase-admin/firestore';
import {canManageTenantMembers} from '../../lib/permissionService.js';

/** A public link never creates a member or grants access to the Hub. */
const LINKS = 'nestjourney_public_intake_links';
const DAYS = 7 * 86400 * 1000;
const MAX_SUBMISSIONS = 30;
const ID = /^[a-zA-Z0-9_-]{1,128}$/;
const TOKEN = /^[a-zA-Z0-9_-]{32,80}$/;
const INACTIVE = new Set(['inactive','suspended','disabled','archived','deleted']);
const ADMIN = new Set(['owner','admin','pastor','data_admin']);
const trim = (v:unknown)=>typeof v==='string'?v.trim():'';
const digest=(token:string)=>createHash('sha256').update('nestjourney-intake-v1:'+token).digest('hex');
const cleanName=(s:unknown)=>trim(s).replace(/\s+/g,' ').slice(0,160);
const phoneDigits=(s:unknown)=>trim(s).replace(/[^\d]/g,'');
export function validJourneyIntakeContact(name:unknown,phone:unknown){
  const n=cleanName(name),p=phoneDigits(phone);
  return n.length>=2&&!/[<>\u0000-\u001f]/.test(n)&&p.length>=10&&p.length<=15;
}
const paths=(org:string)=>'organizations/'+org+'/products/raiz_e_mesa';

export async function authAdmin(req:Request,res:Response,db:Firestore){
  const orgId=trim(req.params.organizationId);
  if(!ID.test(orgId)){res.status(400).json({success:false,reasonCode:'INVALID_ORGANIZATION'});return null;}
  const header=trim(req.headers.authorization);
  if(!header.startsWith('Bearer ')){res.status(401).json({success:false,reasonCode:'UNAUTHENTICATED'});return null;}
  let uid='';
  try{uid=(await getAuth().verifyIdToken(header.slice(7))).uid}catch{}
  if(!uid){res.status(401).json({success:false,reasonCode:'UNAUTHENTICATED'});return null;}
  const [orgDoc,memberDoc,userDoc]=await Promise.all([
    db.doc('organizations/'+orgId).get(),
    db.doc('organizations/'+orgId+'/members/'+uid).get(),
    db.doc('users/'+uid).get(),
  ]);
  const org=orgDoc.data()||{},member=memberDoc.data()||{};
  if(!orgDoc.exists||INACTIVE.has(trim(org.status).toLowerCase())){
    res.status(404).json({success:false,reasonCode:'ORGANIZATION_UNAVAILABLE'});return null;
  }
  const apps=org.apps||{}, product=apps.nestjourney||apps.raiz_e_mesa||{};
  if(product && INACTIVE.has(trim(product.status).toLowerCase())){
    res.status(403).json({success:false,reasonCode:'PRODUCT_UNAVAILABLE'});return null;
  }
  const active=memberDoc.exists&&member.disabled!==true&&['','active','ativo'].includes(trim(member.status).toLowerCase());
  const owner=org.ownerUid===uid||org.ownerId===uid;
  const role=trim(member.organizationRole||member.role).toLowerCase();
  const systemAdmin=canManageTenantMembers(userDoc.data()?.systemRole);
  if(!owner&&!systemAdmin&&(!active||!ADMIN.has(role))){
    res.status(403).json({success:false,reasonCode:'ADMIN_REQUIRED'});return null;
  }
  return {uid,orgId,org};
}

export async function createJourneyIntakeLink(req:Request,res:Response) {
  try{
    const db=getFirestore(),actor=await authAdmin(req,res,db);
    if(!actor)return;
    const congregationId=trim(req.body?.congregationId);
    if(!ID.test(congregationId))return res.status(400).json({success:false,reasonCode:'INVALID_UNIT'});
    const unit=await db.doc(paths(actor.orgId)+'/congregations/'+congregationId).get();
    if(!unit.exists||unit.data()?.active===false)return res.status(404).json({success:false,reasonCode:'UNIT_UNAVAILABLE'});
    const token=randomBytes(32).toString('base64url'),id=digest(token);
    const expiresAt=Date.now()+DAYS;
    await db.doc(LINKS+'/'+id).create({
      organizationId:actor.orgId,congregationId,
      organizationName:trim(actor.org.name).slice(0,120)||'Organização',
      congregationName:trim(unit.data()?.name).slice(0,120)||'Unidade',
      active:true,expiresAtMs:expiresAt,submissionsCount:0,maxSubmissions:MAX_SUBMISSIONS,
      createdBy:actor.uid,createdAt:FieldValue.serverTimestamp(),
    });
    return res.status(201).json({success:true,
      url:'https://nestjourney.millionsnest.com/cadastro/'+token,
      expiresAtMs:expiresAt,maxSubmissions:MAX_SUBMISSIONS,
    });
  }catch{return res.status(500).json({success:false,reasonCode:'INTERNAL_ERROR'});}
}

export async function describeJourneyIntakeLink(req:Request,res:Response){
  const token=trim(req.params.token);
  if(!TOKEN.test(token))return res.status(404).json({success:false,reasonCode:'LINK_UNAVAILABLE'});
  try{
    const doc=await getFirestore().doc(LINKS+'/'+digest(token)).get();
    const data=doc.data()||{};
    if(!doc.exists||data.active!==true||Date.now()>=data.expiresAtMs||data.submissionsCount>=data.maxSubmissions)
      return res.status(404).json({success:false,reasonCode:'LINK_UNAVAILABLE'});
    res.setHeader('Cache-Control','no-store');
    return res.status(200).json({success:true,organizationName:data.organizationName,congregationName:data.congregationName});
  }catch{return res.status(500).json({success:false,reasonCode:'INTERNAL_ERROR'});}
}

export async function submitJourneyIntake(req:Request,res:Response){
  const token=trim(req.params.token);
  if(!TOKEN.test(token))return res.status(404).json({success:false,reasonCode:'LINK_UNAVAILABLE'});
  const name=cleanName(req.body?.name),phone=phoneDigits(req.body?.phone);
  const consent=req.body?.consentContact===true,privacy=req.body?.privacyAcknowledged===true;
  // Hidden honeypot field; requests with autofilled bot field remain silent.
  if(trim(req.body?.website))return res.status(202).json({success:true});
  if(!validJourneyIntakeContact(name,phone)||!privacy)
    return res.status(400).json({success:false,reasonCode:'INVALID_CONTACT_OR_NOTICE'});
  try{
    const db=getFirestore(),linkRef=db.doc(LINKS+'/'+digest(token));
    const intakeRef=db.collection('nestjourney_intake_requests').doc();
    const status=await db.runTransaction(async tx=>{
      const snapshot=await tx.get(linkRef),link=snapshot.data()||{};
      if(!snapshot.exists||link.active!==true||Date.now()>=link.expiresAtMs||link.submissionsCount>=link.maxSubmissions)
        return false;
      const org=trim(link.organizationId),unit=trim(link.congregationId);
      if(!ID.test(org)||!ID.test(unit))return false;
      tx.update(linkRef,{submissionsCount:FieldValue.increment(1)});
      tx.set(intakeRef,{
        organizationId:org,congregationId:unit,name,phone,consentContact:consent,
        privacyAcknowledged:true,status:'pending_review',
        createdAt:FieldValue.serverTimestamp(),approvedPersonId:null,
        linkHash:digest(token),
      });
      return true;
    });
    if(!status)return res.status(410).json({success:false,reasonCode:'LINK_EXPIRED'});
    res.setHeader('Cache-Control','no-store');
    return res.status(201).json({success:true,status:'pending_review'});
  }catch{return res.status(500).json({success:false,reasonCode:'INTERNAL_ERROR'});}
}

export async function listJourneyIntakeRequests(req:Request,res:Response){
  try{
    const db=getFirestore(),actor=await authAdmin(req,res,db);
    if(!actor)return;
    const rows=await db.collection('nestjourney_intake_requests')
      .where('organizationId','==',actor.orgId).limit(100).get();
    const requests=rows.docs.map(x=>({id:x.id,...x.data()})).filter((x:any)=>x.status==='pending_review')
      .map((x:any)=>({
        id:x.id,name:x.name,phone:x.phone,congregationId:x.congregationId,
        consentContact:x.consentContact,createdAtMs:x.createdAt?.toMillis?.()||null,
      }));
    res.setHeader('Cache-Control','private,no-store');
    return res.status(200).json({success:true,requests});
  }catch{return res.status(500).json({success:false,reasonCode:'INTERNAL_ERROR'});}
}

/** Can only integrate a reviewed intake into its original tenant + campus.
 * Do not infer attendance or create Hub login from this flow. */
export async function approveJourneyIntake(req:Request,res:Response){
  try{
    const db=getFirestore(),actor=await authAdmin(req,res,db);
    if(!actor)return;
    const intakeId=trim(req.params.intakeId);
    if(!ID.test(intakeId))return res.status(400).json({success:false,reasonCode:'INVALID_REQUEST'});
    const requestRef=db.doc('nestjourney_intake_requests/'+intakeId);
    const inputPersonId=trim(req.body?.existingPersonId);
    if(inputPersonId&&!ID.test(inputPersonId))return res.status(400).json({success:false,reasonCode:'INVALID_PERSON'});
    const response=await db.runTransaction(async tx=>{
      const record=await tx.get(requestRef);
      if(!record.exists)return {status:404,reasonCode:'NOT_FOUND'};
      const data=record.data()||{};
      if(data.organizationId!==actor.orgId)return {status:404,reasonCode:'NOT_FOUND'};
      if(data.status!=='pending_review')return {status:409,reasonCode:'ALREADY_PROCESSED'};
      const personId=inputPersonId||'intake_'+intakeId;
      const ref=db.doc(paths(actor.orgId)+'/people/'+personId),before=await tx.get(ref);
      if(inputPersonId){
        if(!before.exists||before.data()?.congregationId!==data.congregationId)return {status:409,reasonCode:'PERSON_SCOPE_MISMATCH'};
      }else{
        if(before.exists)return {status:409,reasonCode:'PERSON_EXISTS'};
        const candidates=await tx.get(db.collection(paths(actor.orgId)+'/people')
          .where('congregationId','==',data.congregationId)
          .where('phone','==',data.phone).limit(1));
        if(!candidates.empty)return {status:409,reasonCode:'POSSIBLE_DUPLICATE'};
        // Phones intentionally absent from non-consented profiles still require a human duplicate check.
        const sameName=await tx.get(db.collection(paths(actor.orgId)+'/people')
          .where('name','==',data.name).limit(25));
        if(sameName.docs.some(x=>x.data()?.congregationId===data.congregationId))
          return {status:409,reasonCode:'POSSIBLE_DUPLICATE'};
        tx.create(ref,{
          organizationId:actor.orgId,congregationId:data.congregationId,
          name:data.name,preferredName:'',communityStatus:'visitor',
          phone:data.consentContact?data.phone:'',consent:data.consentContact===true,
          preferredContactChannel:data.consentContact?'whatsapp':'',
          visits:0,stage:'new',dataSource:'approved_public_intake',
          createdBy:actor.uid,createdAt:FieldValue.serverTimestamp(),
        });
      }
      tx.update(requestRef,{
        status:'integrated',approvedPersonId:personId,
        approvedBy:actor.uid,approvedAt:FieldValue.serverTimestamp(),
      });
      tx.set(db.collection(paths(actor.orgId)+'/audit').doc(),{
        organizationId:actor.orgId,congregationId:data.congregationId,
        actorId:actor.uid,action:'person.intake_integrated',
        targetRef:'person:'+personId,createdAt:FieldValue.serverTimestamp(),
      });
      return {status:200,personId};
    });
    if(response.status!==200)return res.status(response.status).json({success:false,reasonCode:response.reasonCode});
    return res.status(200).json({success:true,personId:response.personId});
  }catch{return res.status(500).json({success:false,reasonCode:'INTERNAL_ERROR'});}
}


export async function revokeJourneyIntakeLink(req:Request,res:Response){
  try{
    const db=getFirestore(),actor=await authAdmin(req,res,db);
    if(!actor)return;
    const token=trim(req.body?.token);
    if(!TOKEN.test(token))return res.status(400).json({success:false,reasonCode:'INVALID_LINK'});
    const ref=db.doc(LINKS+'/'+digest(token)),snap=await ref.get();
    if(!snap.exists||snap.data()?.organizationId!==actor.orgId)
      return res.status(404).json({success:false,reasonCode:'LINK_UNAVAILABLE'});
    await ref.update({active:false,revokedAt:FieldValue.serverTimestamp(),revokedBy:actor.uid});
    return res.status(200).json({success:true});
  }catch{return res.status(500).json({success:false,reasonCode:'INTERNAL_ERROR'});}
}

const ADDRESS_FIELDS=['street','number','district','complement','city','region','postalCode'] as const;
type AddressField=typeof ADDRESS_FIELDS[number];
const MAX_LENGTH:Record<AddressField,number>={
  street:140,number:20,district:90,complement:120,city:90,region:60,postalCode:15
};
function sanitizeAddress(raw:unknown):Record<AddressField,string>|null{
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
  const obj=raw as Record<string,unknown>;
  if(Object.keys(obj).some(k=>!ADDRESS_FIELDS.includes(k as AddressField)))return null;
  const result={} as Record<AddressField,string>;
  for(const key of ADDRESS_FIELDS){
    const value=trim(obj[key]).replace(/\s+/g,' ');
    if(value.length>MAX_LENGTH[key]||/[<>\u0000-\u001f]/.test(value))return null;
    result[key]=value;
  }
  return result;
}
export async function readJourneyPersonAddress(req:Request,res:Response){
  try{
    const db=getFirestore(),actor=await authAdmin(req,res,db);
    if(!actor)return;
    const personId=trim(req.params.personId);
    if(!ID.test(personId))return res.status(400).json({success:false,reasonCode:'INVALID_PERSON'});
    const person=await db.doc(paths(actor.orgId)+'/people/'+personId).get();
    if(!person.exists||person.data()?.organizationId!==actor.orgId)
      return res.status(404).json({success:false,reasonCode:'PERSON_NOT_FOUND'});
    const snap=await db.doc(paths(actor.orgId)+'/personContactDetails/'+personId).get();
    res.setHeader('Cache-Control','private,no-store');
    return res.status(200).json({success:true,address:snap.exists?snap.data()?.address||null:null});
  }catch{return res.status(500).json({success:false,reasonCode:'INTERNAL_ERROR'});}
}
export async function saveJourneyPersonAddress(req:Request,res:Response){
  try{
    const db=getFirestore(),actor=await authAdmin(req,res,db);
    if(!actor)return;
    const personId=trim(req.params.personId);
    if(!ID.test(personId))return res.status(400).json({success:false,reasonCode:'INVALID_PERSON'});
    const address=sanitizeAddress(req.body?.address);
    if(!address||req.body?.permissionConfirmed!==true)
      return res.status(400).json({success:false,reasonCode:'INVALID_ADDRESS_OR_PERMISSION'});
    const ref=db.doc(paths(actor.orgId)+'/personContactDetails/'+personId);
    const personRef=db.doc(paths(actor.orgId)+'/people/'+personId);
    await db.runTransaction(async tx=>{
      const person=await tx.get(personRef);
      if(!person.exists||person.data()?.organizationId!==actor.orgId||person.data()?.deletedAt)
        throw Error('PERSON_NOT_FOUND');
      const audit=db.collection(paths(actor.orgId)+'/audit').doc();
      tx.set(ref,{
        organizationId:actor.orgId,personId,congregationId:person.data()?.congregationId,
        address,updatedBy:actor.uid,updatedAt:FieldValue.serverTimestamp(),
        permissionConfirmedBy:actor.uid,permissionConfirmedAt:FieldValue.serverTimestamp(),
      });
      tx.set(audit,{
        organizationId:actor.orgId,congregationId:person.data()?.congregationId,
        actorId:actor.uid,action:'person.address_saved',
        targetRef:'person:'+personId,createdAt:FieldValue.serverTimestamp(),
      });
    });
    return res.status(200).json({success:true});
  }catch{return res.status(500).json({success:false,reasonCode:'INTERNAL_ERROR'});}
}
export async function deleteJourneyPersonAddress(req:Request,res:Response){
  try{
    const db=getFirestore(),actor=await authAdmin(req,res,db);
    if(!actor)return;
    const personId=trim(req.params.personId);
    if(!ID.test(personId))return res.status(400).json({success:false,reasonCode:'INVALID_PERSON'});
    const person=await db.doc(paths(actor.orgId)+'/people/'+personId).get();
    if(!person.exists||person.data()?.organizationId!==actor.orgId)
      return res.status(404).json({success:false,reasonCode:'PERSON_NOT_FOUND'});
    const batch=db.batch(),ref=db.doc(paths(actor.orgId)+'/personContactDetails/'+personId);
    batch.delete(ref);
    batch.set(db.collection(paths(actor.orgId)+'/audit').doc(),{
      organizationId:actor.orgId,congregationId:person.data()?.congregationId,
      actorId:actor.uid,action:'person.address_removed',
      targetRef:'person:'+personId,createdAt:FieldValue.serverTimestamp(),
    });
    await batch.commit();
    return res.status(200).json({success:true});
  }catch{return res.status(500).json({success:false,reasonCode:'INTERNAL_ERROR'});}
}
