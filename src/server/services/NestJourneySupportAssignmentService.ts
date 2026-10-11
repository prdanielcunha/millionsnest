import type { Request, Response } from 'express';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { canManageTenantMembers } from '../../lib/permissionService.js';
import {
  parseJourneyServiceTeam, JOURNEY_SERVICE_AREAS, type JourneyServiceArea, type JourneyServiceTeam,
} from './NestJourneyServiceTeam.js';

const AREAS = new Set<string>(JOURNEY_SERVICE_AREAS.filter(area => area !== 'support'));
const ACTIVE = new Set(['active', 'ativo', '']);
const INVALID_ID = /[\/\\]/;
type Front = Exclude<JourneyServiceArea, 'support'>;
type AssignmentStatus = 'offered' | 'accepted' | 'completed' | 'cancelled';
type Actor = {uid:string; global:boolean; administrator:boolean; leaderFront:Front|null};
const normalize = (s:unknown) => typeof s === 'string' ? s.trim() : '';
const safeId = (s:unknown) => typeof s === 'string' && s.length > 0 && s.length <= 128 && !INVALID_ID.test(s);
const isActive = (record:Record<string,any>|undefined) => Boolean(record) &&
  record.disabled !== true && !['inactive','suspended','revoked','deleted','removed','archived'].includes(normalize(record.status).toLowerCase()) &&
  ACTIVE.has(normalize(record.status).toLowerCase());

function canLead(actor:Actor, area:Front) {
  return actor.administrator || actor.leaderFront === area;
}
export function canSupportInFront(team:JourneyServiceTeam|null, area:Front) {
  return Boolean(team && (
    (team.primaryArea === area && team.teamRole !== 'leader') ||
    team.supportAreas.includes(area) ||
    (team.primaryArea === 'support' && team.supportAreas.length === 0)
  ));
}
export function canAdvanceSupportTask(from:AssignmentStatus, to:AssignmentStatus, actorIsAssignee:boolean, actorIsManager:boolean) {
  if (to === 'accepted') return from === 'offered' && actorIsAssignee;
  if (to === 'completed') return from === 'accepted' && actorIsAssignee;
  if (to === 'cancelled') return ['offered','accepted'].includes(from) && actorIsManager;
  return false;
}

async function context(req:Request) {
  const orgId = req.params.organizationId;
  if (!safeId(orgId)) return {error:400,reason:'INVALID_ORGANIZATION_ID'} as const;
  const bearer = req.headers.authorization || '';
  if (!bearer.startsWith('Bearer ')) return {error:401,reason:'UNAUTHENTICATED'} as const;
  let uid = '';
  try { uid = (await getAuth().verifyIdToken(bearer.slice(7))).uid; } catch {}
  if (!safeId(uid)) return {error:401,reason:'UNAUTHENTICATED'} as const;
  const db=getFirestore();
  const [orgSnap,userSnap,memberSnap]=await Promise.all([
    db.doc(`organizations/${orgId}`).get(),
    db.doc(`users/${uid}`).get(),
    db.doc(`organizations/${orgId}/members/${uid}`).get(),
  ]);
  const org=orgSnap.data()||{};
  if (!orgSnap.exists || org.archived === true || ['inactive','suspended','disabled','archived'].includes(normalize(org.status).toLowerCase()))
    return {error:404,reason:'ORGANIZATION_UNAVAILABLE'} as const;
  const global=canManageTenantMembers(userSnap.data()?.systemRole);
  const member=memberSnap.data();
  const owner=org.ownerUid === uid || org.ownerId === uid;
  if (!global && !owner && !isActive(member)) return {error:403,reason:'MEMBERSHIP_REQUIRED'} as const;
  const orgRole=normalize(member?.organizationRole || member?.role).toLowerCase();
  const administrator=global || owner || orgRole === 'owner' || orgRole === 'admin';
  const team=parseJourneyServiceTeam(member?.nestJourneyTeam);
  const role=normalize(member?.journeyRole).toLowerCase();
  const oldLeader:Record<string,Front>={
    presence_host:'presence', mesa_team:'table', caregiver:'care',
    group_leader:'house', discipler:'discipleship',
  };
  const leaderFront:Front|null=team?.teamRole==='leader' && team.primaryArea!=='support'
    ? team.primaryArea
    : !team && oldLeader[role] ? oldLeader[role] : null;
  const actor:Actor={uid,global,administrator,leaderFront};
  return {db,orgId,actor} as const;
}
type ValidContext=Extract<Awaited<ReturnType<typeof context>>,{db:any}>;
async function requireContext(req:Request,res:Response):Promise<ValidContext|null>{
  try {
    const result=await context(req);
    if ('error' in result) {res.status(result.error).json({success:false,reasonCode:result.reason});return null;}
    return result;
  } catch {
    res.status(500).json({success:false,reasonCode:'INTERNAL_ERROR'});
    return null;
  }
}

function eligible(membership:Record<string,any>|undefined,front:Front) {
  return isActive(membership) && canSupportInFront(parseJourneyServiceTeam(membership?.nestJourneyTeam),front);
}
const pathFor=(orgId:string)=>`organizations/${orgId}/nestjourney_support_assignments`;
function publicTask(doc:{id:string;data:()=>any}) {
  const data=doc.data();
  return {
    id:doc.id,front:data.front,title:data.title,note:data.note||'',
    assigneeId:data.assigneeId,status:data.status,createdBy:data.createdBy,
    createdAtMs:typeof data.createdAt?.toMillis === 'function'?data.createdAt.toMillis():null,
  };
}

export async function listNestJourneySupportAssignments(req:Request,res:Response){
  const c=await requireContext(req,res);if(!c)return;
  try{
    const collection=c.db.collection(pathFor(c.orgId));
    const q=c.actor.administrator ? collection.limit(100) :
      c.actor.leaderFront ? collection.where('front','==',c.actor.leaderFront).limit(100) :
      collection.where('assigneeId','==',c.actor.uid).limit(100);
    const snapshot=await q.get();
    return res.status(200).json({success:true,assignments:snapshot.docs.map(publicTask)});
  }catch{return res.status(500).json({success:false,reasonCode:'INTERNAL_ERROR'});}
}
export async function listNestJourneySupportCandidates(req:Request,res:Response){
  const c=await requireContext(req,res);if(!c)return;
  const front=normalize(req.query.front) as Front;
  if(!AREAS.has(front))return res.status(400).json({success:false,reasonCode:'INVALID_FRONT'});
  if(!canLead(c.actor,front))return res.status(403).json({success:false,reasonCode:'PERMISSION_DENIED'});
  try {
    const snapshot=await c.db.collection(`organizations/${c.orgId}/members`).limit(250).get();
    const candidates=snapshot.docs.filter((d:any)=>eligible(d.data(),front)).map((d:any)=>({
      uid:d.id,
      name:normalize(d.data().displayName||d.data().name)||'Voluntário',
    }));
    return res.status(200).json({success:true,candidates});
  }catch{return res.status(500).json({success:false,reasonCode:'INTERNAL_ERROR'});}
}
export async function createNestJourneySupportAssignment(req:Request,res:Response){
  const c=await requireContext(req,res);if(!c)return;
  const front=normalize(req.body?.front) as Front;
  const assigneeId=normalize(req.body?.assigneeId);
  const title=normalize(req.body?.title);
  const note=normalize(req.body?.note);
  if(!AREAS.has(front)||!safeId(assigneeId)||title.length<3||title.length>120||note.length>300){
    return res.status(400).json({success:false,reasonCode:'INVALID_ASSIGNMENT'});
  }
  if(!canLead(c.actor,front))return res.status(403).json({success:false,reasonCode:'PERMISSION_DENIED'});
  try{
    const memberSnap=await c.db.doc(`organizations/${c.orgId}/members/${assigneeId}`).get();
    if(!eligible(memberSnap.data(),front))return res.status(409).json({success:false,reasonCode:'ASSIGNEE_NOT_AVAILABLE'});
    const ref=c.db.collection(pathFor(c.orgId)).doc();
    await ref.create({
      organizationId:c.orgId,front,assigneeId,title,note,
      status:'offered',createdBy:c.actor.uid,
      createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp(),
    });
    return res.status(201).json({success:true,id:ref.id});
  }catch{return res.status(500).json({success:false,reasonCode:'INTERNAL_ERROR'});}
}
export async function changeNestJourneySupportAssignment(req:Request,res:Response){
  const c=await requireContext(req,res);if(!c)return;
  const taskId=req.params.taskId;
  const desired=normalize(req.body?.status) as AssignmentStatus;
  if(!safeId(taskId)||!['accepted','completed','cancelled'].includes(desired))
    return res.status(400).json({success:false,reasonCode:'INVALID_STATUS'});
  try{
    const ref=c.db.doc(`${pathFor(c.orgId)}/${taskId}`);
    const result=await c.db.runTransaction(async(t:any)=>{
      const snap=await t.get(ref);
      if(!snap.exists)return {ok:false,status:404,reason:'NOT_FOUND'};
      const d=snap.data()||{};
      const manager=canLead(c.actor,d.front as Front) && (c.actor.administrator||d.createdBy===c.actor.uid||c.actor.leaderFront===d.front);
      if(!canAdvanceSupportTask(d.status,desired,d.assigneeId===c.actor.uid,manager))
        return {ok:false,status:403,reason:'TRANSITION_DENIED'};
      t.update(ref,{status:desired,updatedAt:FieldValue.serverTimestamp(),[desired+'At']:FieldValue.serverTimestamp()});
      const audit=c.db.collection(`organizations/${c.orgId}/audit_logs`).doc();
      t.set(audit,{action:'nestjourney.support_assignment.'+desired,actorUid:c.actor.uid,
        assignmentId:taskId,organizationId:c.orgId,front:d.front,timestamp:FieldValue.serverTimestamp()});
      return {ok:true};
    });
    if(!result.ok)return res.status(result.status).json({success:false,reasonCode:result.reason});
    return res.status(200).json({success:true,status:desired});
  }catch{return res.status(500).json({success:false,reasonCode:'INTERNAL_ERROR'});}
}
