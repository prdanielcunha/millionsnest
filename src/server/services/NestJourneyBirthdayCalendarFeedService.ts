import type {Request,Response} from 'express';
import {createHash,randomBytes} from 'node:crypto';
import {getFirestore,FieldValue} from 'firebase-admin/firestore';
import {authAdmin} from './NestJourneyPublicIntakeService.js';

const COLLECTION='nestjourney_calendar_feeds';
const SECRET=/^[A-Za-z0-9_-]{40,80}$/;
const safeId=(x:unknown)=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(x);
const hash=(token:string)=>createHash('sha256').update('nestjourney-calendar-v1:'+token).digest('hex');
const active=(status:unknown)=>!['inactive','suspended','disabled','archived','deleted','removed','revoked'].includes(String(status||'').toLowerCase());
const activeMembership=(m:Record<string,unknown>)=>m.disabled!==true&&['','active','ativo'].includes(String(m.status||'').toLowerCase());
const adminRole=(role:unknown)=>['owner','admin','pastor','data_admin'].includes(String(role||'').toLowerCase());
const personRoot=(id:string)=>'organizations/'+id+'/products/raiz_e_mesa';
const iso=(date:Date)=>date.toISOString().slice(0,10).replace(/-/g,'');
const nextDay=(date:Date)=>new Date(date.getTime()+86400000);
const safeName=(s:unknown)=>String(s||'').replace(/[\r\n\x00-\x1f]/g,' ').replace(/\s+/g,' ').slice(0,120).trim();
const escapeIcs=(s:string)=>s.replace(/\\/g,'\\\\').replace(/[,;]/g,v=>'\\'+v);
export function dateForYear(month:number,day:number,year:number){
  if(!Number.isInteger(month)||!Number.isInteger(day)||month<1||month>12||day<1||day>new Date(Date.UTC(2024,month,0)).getUTCDate())throw new Error('INVALID_DATE');
  const isLeap=new Date(Date.UTC(year,1,29)).getUTCMonth()===1;
  return new Date(Date.UTC(year,month-1,month===2&&day===29&&!isLeap?28:day));
}
export function renderBirthdaySubscription(events:Array<{id:string;name:string;month:number;day:number}>,now=new Date()):string{
  const startYear=now.getUTCFullYear();
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','CALSCALE:GREGORIAN','METHOD:PUBLISH',
    'PRODID:-//MillionsNest//NestJourney Calendar//PT-BR','X-WR-CALNAME:Datas para celebrar'];
  for(const person of events){
    if(!safeId(person.id)||!safeName(person.name))continue;
    let first:Date;
    try{first=dateForYear(person.month,person.day,startYear)}catch{continue}
    if(first.getTime()<Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()))first=dateForYear(person.month,person.day,startYear+1);
    const title=escapeIcs('Aniversário de '+safeName(person.name));
    const uid=hash(person.id).slice(0,32)+'@nestjourney.millionsnest.com';
    const add=(day:Date,unique:string,repeat:boolean)=>{
      lines.push('BEGIN:VEVENT','UID:'+unique+uid,'DTSTAMP:'+iso(now)+'T000000Z',
        'DTSTART;VALUE=DATE:'+iso(day),'DTEND;VALUE=DATE:'+iso(nextDay(day)),
        ...(repeat?['RRULE:FREQ=YEARLY']:[]),
        'SUMMARY:'+title,'CLASS:PRIVATE','TRANSP:TRANSPARENT',
        'DESCRIPTION:Aniversário compartilhado com a equipe mediante autorização. Não divulgar este calendário.',
        'END:VEVENT');
    };
    if(person.month===2&&person.day===29){
      // RRULE for Feb 29 skips normal years. Explicit 40-year series observes Feb 28.
      for(let y=first.getUTCFullYear();y<first.getUTCFullYear()+40;y++)add(dateForYear(2,29,y),String(y)+'-',false);
    }else add(first,'',true);
  }
  lines.push('END:VCALENDAR','');
  // Fold long ICS content lines at 75 UTF-8 octets without splitting Unicode code points.
  return lines.map(line=>{
    let rows=[''],size=0;
    for(const point of line){
      const bytes=Buffer.byteLength(point,'utf8');
      if(size+bytes>75){rows.push(' ');size=1}
      rows[rows.length-1]+=point;size+=bytes;
    }
    return rows.join('\r\n');
  }).join('\r\n');
}
export async function createJourneyCalendarFeed(req:Request,res:Response){
  try{
    const db=getFirestore(),actor=await authAdmin(req,res,db);
    if(!actor)return;
    const congregationId=req.body?.congregationId;
    if(!safeId(congregationId)||req.body?.calendarDisclosureAccepted!==true)
      return res.status(400).json({success:false,reasonCode:'INVALID_SCOPE_OR_DISCLOSURE'});
    const unit=await db.doc(personRoot(actor.orgId)+'/congregations/'+congregationId).get();
    if(!unit.exists||unit.data()?.active===false)
      return res.status(404).json({success:false,reasonCode:'UNIT_UNAVAILABLE'});
    const token=randomBytes(32).toString('base64url'),id=hash(token);
    await db.doc(COLLECTION+'/'+id).create({
      organizationId:actor.orgId,congregationId,createdBy:actor.uid,
      active:true,shareWithTeamOnly:true,
      createdAt:FieldValue.serverTimestamp(),revokedAt:null
    });
    res.setHeader('Cache-Control','private,no-store');
    return res.status(201).json({success:true,feedId:id,url:'https://www.millionsnest.com/api/public/nestjourney/calendar/'+token+'.ics'});
  }catch{return res.status(500).json({success:false,reasonCode:'INTERNAL_ERROR'});}
}
export async function listJourneyCalendarFeeds(req:Request,res:Response){
  try{
    const db=getFirestore(),actor=await authAdmin(req,res,db);
    if(!actor)return;
    const docs=await db.collection(COLLECTION).where('organizationId','==',actor.orgId).limit(100).get();
    res.setHeader('Cache-Control','private,no-store');
    return res.status(200).json({success:true,feeds:docs.docs.filter(s=>s.data().active===true).map(s=>({
      id:s.id,congregationId:s.data().congregationId,
      createdAtMs:s.data().createdAt?.toMillis?.()||null,createdBy:s.data().createdBy,
    }))});
  }catch{return res.status(500).json({success:false,reasonCode:'INTERNAL_ERROR'});}
}

export async function revokeJourneyCalendarFeed(req:Request,res:Response){
  try{
    const db=getFirestore(),actor=await authAdmin(req,res,db);
    if(!actor)return;
    const id=req.body?.feedId;
    if(typeof id!=='string'||!/^[0-9a-f]{64}$/.test(id))return res.status(400).json({success:false,reasonCode:'INVALID_FEED_ID'});
    const ref=db.doc(COLLECTION+'/'+id);
    const snap=await ref.get();
    if(!snap.exists||snap.data()?.organizationId!==actor.orgId)
      return res.status(404).json({success:false,reasonCode:'FEED_NOT_FOUND'});
    await ref.update({active:false,revokedBy:actor.uid,revokedAt:FieldValue.serverTimestamp()});
    return res.status(200).json({success:true});
  }catch{return res.status(500).json({success:false,reasonCode:'INTERNAL_ERROR'});}
}
export async function deliverJourneyCalendarFeed(req:Request,res:Response){
  const token=String(req.params.token||'');
  if(!SECRET.test(token))return res.status(404).send('Not found');
  try{
    const db=getFirestore(),feed=await db.doc(COLLECTION+'/'+hash(token)).get();
    const data=feed.data()||{};
    if(!feed.exists||data.active!==true||data.shareWithTeamOnly!==true||
       !safeId(data.organizationId)||!safeId(data.congregationId)||!safeId(data.createdBy)){
      return res.status(404).send('Not found');
    }
    const orgId=data.organizationId,unitId=data.congregationId;
    const [org,member,unit]=await Promise.all([
      db.doc('organizations/'+orgId).get(),
      db.doc('organizations/'+orgId+'/members/'+data.createdBy).get(),
      db.doc(personRoot(orgId)+'/congregations/'+unitId).get(),
    ]);
    const o=org.data()||{},m=member.data()||{};
    const owner=o.ownerUid===data.createdBy||o.ownerId===data.createdBy;
    if(!org.exists||!active(o.status)||!unit.exists||unit.data()?.active===false||
       (!owner&&(!member.exists||!activeMembership(m)||!adminRole(m.organizationRole||m.role)))){
      return res.status(404).send('Not found');
    }
    const birthdayDocs=await db.collection(personRoot(orgId)+'/personBirthdays')
      .where('congregationId','==',unitId).where('shareWithTeam','==',true).get();
    const events:Array<{id:string;name:string;month:number;day:number}>=[];
    // Read only people specifically consented to be visible to this team.
    for(let i=0;i<birthdayDocs.docs.length;i+=200){
      const part=birthdayDocs.docs.slice(i,i+200);
      const people=await db.getAll(...part.map(doc=>db.doc(personRoot(orgId)+'/people/'+doc.id)));
      people.forEach((person,index)=>{
        const p=person.data()||{},b=part[index].data();
        if(!person.exists||p.organizationId!==orgId||p.congregationId!==unitId||p.deletedAt)return;
        const name=safeName(p.preferredName||p.name),month=Number(b.month),day=Number(b.day);
        try{dateForYear(month,day,new Date().getUTCFullYear())}catch{return}
        if(name)events.push({id:person.id,name,month,day});
      });
    }
    res.setHeader('Cache-Control','private,no-store');
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Content-Disposition','inline; filename="nestjourney-aniversarios.ics"');
    res.type('text/calendar; charset=utf-8');
    return res.status(200).send(renderBirthdaySubscription(events));
  }catch{return res.status(503).send('Temporarily unavailable');}
}
