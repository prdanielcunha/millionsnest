import {applicationDefault,initializeApp} from 'firebase-admin/app';
import {FieldPath,FieldValue,getFirestore} from 'firebase-admin/firestore';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {active,assertSourceSnapshot,keyFor,rootFor} from '../src/server/services/PeopleDirectory.js';
import {synchronizeDirectory} from '../src/server/services/PeopleDirectoryService.js';

// Existing project/ADC only. This creates no service, trigger, paid backup or index.
// Source records, permissions and historical facts are NEVER edited by this job.
const manifest=JSON.parse(readFileSync('ops/people-directory-activation.json','utf8'));
if(!['plan','apply'].includes(manifest.mode)||process.env.FIRESTORE_EMULATOR_HOST)throw Error('EXPLICIT_PRODUCTION_PLAN_REQUIRED');
const apply=manifest.mode==='apply';
initializeApp({projectId:'millionsnest',credential:applicationDefault()});
const db=getFirestore();
const organizations=await db.collection('organizations').orderBy(FieldPath.documentId()).limit(201).get();
if(organizations.size>200)throw Error('ORGANIZATION_BUDGET_EXCEEDED');
const work:Array<{org:string;actor:string;journey:boolean}>=[];
let accounts=0,journeyPeople=0,skipped=0,allJourneyPeople=0,skippedJourneyPeople=0,unresolvedActiveJourneyPeople=0;
for(const org of organizations.docs){
  const data=org.data();
  const [a,j]=await Promise.all([org.ref.collection('members').count().get(),db.collection(rootFor(org.id)+'/products/raiz_e_mesa/people').count().get()]);
  allJourneyPeople+=j.data().count;
  if(!active(data)){skipped++;skippedJourneyPeople+=j.data().count;continue;}
  let actor=data.ownerUid||data.ownerId||data.ownerUserId;
  if(typeof actor!=='string'||!active((await db.doc('users/'+actor).get()).data())){
    actor='';
    // A pre-existing local administrator may reconcile; never invent a role or
    // use a global SaaS privilege to get access to church records.
    const members=await org.ref.collection('members').limit(1001).get();
    if(members.size<=1000)for(const member of members.docs){const m=member.data();if(active(m)&&(!m.organizationId||m.organizationId===org.id)&&['owner','admin','pastor','data_admin'].includes(String(m.organizationRole||m.role||'').trim().toLowerCase())&&active((await db.doc('users/'+member.id).get()).data())){actor=member.id;break;}}
  }
  if(!actor){skipped++;skippedJourneyPeople+=j.data().count;unresolvedActiveJourneyPeople+=j.data().count;continue;}
  accounts+=a.data().count;journeyPeople+=j.data().count;
  const journey=['active','trialing'].includes(String((data.apps?.nestjourney||data.apps?.raiz_e_mesa)?.status||'').toLowerCase());
  work.push({org:org.id,actor,journey});
}
const sources=accounts+journeyPeople;
// Conservative bounded rollout. Do not silently spend unbounded reads/writes.
if(sources>2000)throw Error('INITIAL_SOURCE_BUDGET_EXCEEDED');
console.log(JSON.stringify({mode:manifest.mode,organizations:work.length,skipped,accountSources:accounts,journeySources:journeyPeople,allJourneySources:allJourneyPeople,skippedJourneySources:skippedJourneyPeople,unresolvedActiveJourneySources:unresolvedActiveJourneyPeople,projectedInitialWritesUpperBound:sources*5}));
const token=execFileSync('gcloud',['auth','print-access-token'],{encoding:'utf8'}).trim();
// Read existing provider telemetry; never enable APIs or expand IAM to obtain it.
async function usage(metric:string,gauge=false):Promise<number|null>{
  try{
    const url=new URL('https://monitoring.googleapis.com/v3/projects/millionsnest/timeSeries');
    url.searchParams.set('filter','metric.type="firestore.googleapis.com/'+metric+'"');
    url.searchParams.set('interval.startTime',new Date(Date.now()-86400000).toISOString());
    url.searchParams.set('interval.endTime',new Date().toISOString());
    url.searchParams.set('aggregation.alignmentPeriod','86400s');
    url.searchParams.set('aggregation.perSeriesAligner',gauge?'ALIGN_MAX':'ALIGN_SUM');
    url.searchParams.set('pageSize','1000');
    const r=await fetch(url,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(30000)});
    if(!r.ok)return null;
    const data=await r.json();
    if(!data.timeSeries?.length||data.nextPageToken)return null;
    const values=data.timeSeries.flatMap((s:any)=>s.points.map((p:any)=>Number(p.value.int64Value??p.value.doubleValue)));
    if(values.some((n:number)=>!Number.isFinite(n)||n<0))return null;
    return gauge?Math.max(...values):values.reduce((sum:number,n:number)=>sum+n,0);
  }catch{return null;}
}
const [reads24h,writes24h,storageBytes]=await Promise.all([usage('document/read_ops_count'),usage('document/write_ops_count'),usage('storage/data_and_index_storage_bytes',true)]);
// A generous reserve covers telemetry lag and normal traffic; this is a preflight,
// not a billing cap or a promise about future tenant traffic.
const freeQuotaHeadroom=reads24h!==null&&writes24h!==null&&storageBytes!==null&&reads24h+sources*30+5000<50000&&writes24h+sources*5+5000<20000&&storageBytes+sources*20000<800000000;
console.log(JSON.stringify({usagePreflight:{reads24h,writes24h,storageBytes,freeQuotaHeadroom}}));
// Read-only preflight for the failed 19-Oct activation. Do not copy private journal data
// into job logs. If any recovery state exists, require explicit inspection first.
const previousRelease=db.doc('people_directory_releases/1efb6939e7ed5525d9eed7378811df6928a3c752');
const [previousJournal,previousChildren]=await Promise.all([
  previousRelease.get(),previousRelease.collection('organizations').limit(1).get()
]);
console.log(JSON.stringify({previousActivationJournalPresent:previousJournal.exists,
  previousActivationRecoveryEntriesPresent:!previousChildren.empty}));
if(previousJournal.exists||!previousChildren.empty)throw Error('PREVIOUS_DIRECTORY_RECOVERY_JOURNAL_REQUIRES_PRIVATE_REVIEW');

// Independent read-only completion proof of the successful production apply.
const completedRelease=db.doc('people_directory_releases/88365d3941ba7cb4b0ca4f16a334ffb82ad10f2b');
const [completedJournal,completedOrgRecoveries]=await Promise.all([
  completedRelease.get(),completedRelease.collection('organizations').get()
]);
const proof=completedJournal.data()||{};
const completedRecoveries=completedOrgRecoveries.docs.filter(doc=>!!doc.data().completedAt).length;
console.log(JSON.stringify({completionJournalStatus:proof.status||'absent',
  sourcesAtApply:proof.sourceCount??null,identitiesAtApply:proof.identityCount??null,
  organizationRecoveries:completedOrgRecoveries.size,completedRecoveries,
  automaticMerges:0,originalRecordsDeleted:0}));
if(!completedJournal.exists||proof.status!=='completed'||proof.sourceCount!==36||
    proof.identityCount!==36||completedOrgRecoveries.size!==26||completedRecoveries!==26||
    !proof.completedAt)throw Error('PEOPLE_DIRECTORY_APPLY_JOURNAL_INCOMPLETE_OR_CHANGED');

// Check the exact Workload Identity principal's project-level authority without
// granting a role or writing any document. Missing privileges stop both plan and apply.
const expectedPermissions=['datastore.databases.get','datastore.entities.get',
  'datastore.entities.list','datastore.entities.create','datastore.entities.update'];
const iamCheck=await fetch('https://cloudresourcemanager.googleapis.com/v1/projects/millionsnest:testIamPermissions',{
  method:'POST',
  headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
  body:JSON.stringify({permissions:expectedPermissions}),
  signal:AbortSignal.timeout(30000)
});
if(!iamCheck.ok)throw Error('FIRESTORE_IAM_READONLY_CHECK_UNAVAILABLE_'+iamCheck.status);
const granted=new Set<string>((await iamCheck.json()).permissions||[]);
const missing=expectedPermissions.filter(permission=>!granted.has(permission));
console.log(JSON.stringify({authorityCheck:'PROJECT_IAM_READONLY',
  requiredPermissionCount:expectedPermissions.length,grantedPermissionCount:expectedPermissions.length-missing.length,
  missingPermissions:missing}));
// Planning stays read-only and valid after the temporary migration role is revoked.
// Actual production apply still fails closed if any write permission is missing.
if(missing.length && apply)throw Error('FIRESTORE_WRITER_IAM_NOT_YET_AUTHORIZED');

if(!apply)process.exit(0);
if(unresolvedActiveJourneyPeople)throw Error('ACTIVE_JOURNEY_SOURCES_REQUIRE_VALID_LOCAL_ADMINISTRATOR');
if(!freeQuotaHeadroom)throw Error('ZERO_COST_HEADROOM_UNVERIFIED_OR_INSUFFICIENT');
for(const key of ['hubReleaseSha','journeyReleaseSha'])if(!/^[a-f0-9]{40}$/.test(manifest[key]||''))throw Error('EXACT_RELEASE_REQUIRED');
if(process.env.GITHUB_REF!=='refs/heads/production'||!/^[a-f0-9]{40}$/.test(process.env.GITHUB_SHA||''))throw Error('PRODUCTION_REF_REQUIRED');
const service=JSON.parse(execFileSync('gcloud',['run','services','describe','millionsnest-api','--project=millionsnest','--region=us-central1','--format=json'],{encoding:'utf8'}));
const image=service.spec?.template?.spec?.containers?.[0]?.image||'';
if(!image.endsWith(':'+manifest.hubReleaseSha)||service.status.latestCreatedRevisionName!==service.status.latestReadyRevisionName||!service.status.traffic?.some((t:any)=>t.percent===100&&(t.revisionName===service.status.latestReadyRevisionName||t.latestRevision===true)))throw Error('HUB_EXACT_SERVING_RELEASE_REQUIRED');
const release=await fetch('https://nestjourney.millionsnest.com/connect-release.json?people='+manifest.journeyReleaseSha,{signal:AbortSignal.timeout(30000)});
if(!release.ok||(await release.json()).releaseSha!==manifest.journeyReleaseSha)throw Error('JOURNEY_EXACT_SERVING_RELEASE_REQUIRED');
const authProbe=await fetch('https://www.millionsnest.com/api/v1/organizations/release-smoke-synthetic/people-directory',{signal:AbortSignal.timeout(30000)});
if(authProbe.status!==401||(await authProbe.json()).reasonCode!=='UNAUTHENTICATED')throw Error('DIRECTORY_RUNTIME_GATEWAY_REQUIRED');
const authorized=async(url:string)=>{const r=await fetch(url,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('PUBLISHED_RULES_READ_FAILED');return r.json();};
const live=await authorized('https://firebaserules.googleapis.com/v1/projects/millionsnest/releases/cloud.firestore');
const ruleSet=await authorized('https://firebaserules.googleapis.com/v1/'+live.rulesetName);
const source=ruleSet.source?.files?.find((x:any)=>x.name==='firestore.rules')?.content;
if(typeof source!=='string'||createHash('sha256').update(source).digest('hex')!==manifest.rulesSha256)throw Error('EXACT_PUBLISHED_RULES_REQUIRED');

// Recovery journal exists before any rollout policy. All source data remains intact.
const releaseRef=db.doc('people_directory_releases/'+process.env.GITHUB_SHA);
await releaseRef.set({schemaVersion:1,hubReleaseSha:manifest.hubReleaseSha,journeyReleaseSha:manifest.journeyReleaseSha,rulesSha256:manifest.rulesSha256,status:'started',sourceCount:sources,startedAt:FieldValue.serverTimestamp()},{merge:true});
let identities=0,policies=0,possibleDuplicateNameGroups=0;
for(const item of work){
  const policyRef=db.doc('people_directory_policies/'+item.org),before=await policyRef.get();
  const recoveryRef=releaseRef.collection('organizations').doc(keyFor('organization',item.org));
  if(!(await recoveryRef.get()).exists)await recoveryRef.create({organizationId:item.org,hadPolicy:before.exists,previousPolicy:before.data()||null,sourceRecordsPreserved:true,createdAt:FieldValue.serverTimestamp()});
  const snapshot=await synchronizeDirectory(db,item.org,item.actor);
  await db.runTransaction(async tx=>{
    await assertSourceSnapshot(tx,db,item.org,snapshot);
    const current=await tx.get(policyRef);
    if(item.journey&&!current.exists)tx.create(policyRef,{schemaVersion:1,releaseId:releaseRef.id,enabled:true,createdAt:FieldValue.serverTimestamp()});
  });
  const directory=await db.collection(rootFor(item.org)+'/peopleDirectory').get(),names=new Map<string,number>();
  identities+=directory.size;
  for(const person of directory.docs){const p=person.data();if(!p.mergedInto&&p.searchName)names.set(p.searchName,(names.get(p.searchName)||0)+1);}
  possibleDuplicateNameGroups+=[...names.values()].filter(n=>n>1).length;
  if(item.journey&&(await policyRef.get()).exists)policies++;
  await recoveryRef.update({completedAt:FieldValue.serverTimestamp(),identityCount:directory.size,policyEnabled:item.journey});
}
await releaseRef.update({status:'completed',identityCount:identities,policyCount:policies,possibleDuplicateNameGroups,completedAt:FieldValue.serverTimestamp()});
// Aggregate counts only. Never log names, organizations, e-mails, phones or tokens.
console.log(JSON.stringify({result:'PEOPLE_DIRECTORY_PRODUCTION_RECONCILED',organizations:work.length,identities,policies,possibleDuplicateNameGroups,automaticMerges:0,originalRecordsDeleted:0}));
