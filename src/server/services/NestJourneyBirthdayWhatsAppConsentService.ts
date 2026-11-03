import type {Request,Response} from 'express';
import {randomBytes} from 'node:crypto';
import {FieldValue,getFirestore} from 'firebase-admin/firestore';
import {authAdmin} from './NestJourneyPublicIntakeService.js';

const safeId=(x:unknown)=>typeof x==='string'&&/^[a-zA-Z0-9_-]{1,128}$/.test(x);
const root=(org:string)=>'organizations/'+org+'/products/raiz_e_mesa';
const consentRef=(org:string,person:string)=>root(org)+'/personBirthdayWhatsAppConsents/'+person;
export function mayEnableBirthdayGreeting(person:Record<string,unknown>,birthday:Record<string,unknown>,orgId:string){
  return person.organizationId===orgId&&birthday.organizationId===orgId
    &&person.congregationId===birthday.congregationId
    &&person.deletedAt==null&&birthday.month!==undefined&&birthday.day!==undefined
    &&person.consent===true&&/^\d{10,15}$/.test(String(person.phone||'').replace(/\D/g,''));
}
export async function getJourneyBirthdayWhatsAppConsent(req:Request,res:Response){
  try{
    const db=getFirestore(),actor=await authAdmin(req,res,db);
    if(!actor)return;
    const personId=req.params.personId;
    if(!safeId(personId))return res.status(400).json({success:false,reasonCode:'INVALID_PERSON'});
    const person=await db.doc(root(actor.orgId)+'/people/'+personId).get();
    if(!person.exists||person.data()?.organizationId!==actor.orgId)
      return res.status(404).json({success:false,reasonCode:'PERSON_NOT_FOUND'});
    const record=await db.doc(consentRef(actor.orgId,personId)).get();
    res.setHeader('Cache-Control','private,no-store');
    return res.status(200).json({success:true,
      optedIn:record.exists&&record.data()?.optedIn===true,
      updatedAtMs:record.data()?.updatedAt?.toMillis?.()||null,
    });
  }catch{return res.status(500).json({success:false,reasonCode:'INTERNAL_ERROR'});}
}
export async function setJourneyBirthdayWhatsAppConsent(req:Request,res:Response){
  try{
    const db=getFirestore(),actor=await authAdmin(req,res,db);
    if(!actor)return;
    const personId=req.params.personId;
    if(!safeId(personId)||typeof req.body?.optedIn!=='boolean')
      return res.status(400).json({success:false,reasonCode:'INVALID_INPUT'});
    if(req.body.optedIn===true&&req.body.permissionConfirmed!==true)
      return res.status(400).json({success:false,reasonCode:'EXPLICIT_BIRTHDAY_WHATSAPP_OPTIN_REQUIRED'});
    const pRef=db.doc(root(actor.orgId)+'/people/'+personId),
      bRef=db.doc(root(actor.orgId)+'/personBirthdays/'+personId),
      cRef=db.doc(consentRef(actor.orgId,personId));
    const result=await db.runTransaction(async tx=>{
      const [p,b,prev]=await Promise.all([tx.get(pRef),tx.get(bRef),tx.get(cRef)]);
      if(!p.exists||p.data()?.organizationId!==actor.orgId)
        return {status:404,reasonCode:'PERSON_NOT_FOUND'};
      const current=prev.data()||{};
      if(req.body.optedIn===true&&!mayEnableBirthdayGreeting(p.data()||{},b.data()||{},actor.orgId))
        return {status:409,reasonCode:'BIRTHDAY_OR_WHATSAPP_CONTACT_NOT_AUTHORIZED'};
      if(current.optedIn===req.body.optedIn)
        return {status:200,optedIn:req.body.optedIn};
      tx.set(cRef,{
        organizationId:actor.orgId,congregationId:p.data()?.congregationId,personId,
        optedIn:req.body.optedIn,scope:'birthday_whatsapp_greeting_only',
        // This opaque proof is never a substitute for a fresh tenant/contact check.
        consentEvidenceRef:req.body.optedIn===true?
          'birthday_whatsapp_optin_v1:'+randomBytes(16).toString('hex'):null,
        updatedBy:actor.uid,updatedAt:FieldValue.serverTimestamp(),
        ...(req.body.optedIn===true?{grantedAt:FieldValue.serverTimestamp(),grantedBy:actor.uid}:{
          revokedAt:FieldValue.serverTimestamp(),revokedBy:actor.uid,
        }),
      });
      tx.set(db.collection(root(actor.orgId)+'/audit').doc(),{
        organizationId:actor.orgId,congregationId:p.data()?.congregationId,
        actorId:actor.uid,action:req.body.optedIn?'person.birthday_whatsapp_opted_in':'person.birthday_whatsapp_revoked',
        targetRef:'person:'+personId,createdAt:FieldValue.serverTimestamp(),
      });
      return {status:200,optedIn:req.body.optedIn};
    });
    if(result.status!==200)return res.status(result.status).json({success:false,reasonCode:result.reasonCode});
    return res.status(200).json({success:true,optedIn:result.optedIn});
  }catch{return res.status(500).json({success:false,reasonCode:'INTERNAL_ERROR'});}
}
