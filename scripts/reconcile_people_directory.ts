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
const work:Array<{org:string;owner:string;journey:boolean}>=[];
let accounts=0,journeyPeople=0,skipped=0;
for(const org of organizations.docs){
  const data=org.data(),owner=data.ownerUid||data.ownerId||data.ownerUserId;
  if(!active(data)||typeof owner!=='string'||!active((await db.doc('users/'+owner).get()).data())){skipped++;continue;}
  const [a,j]=await Promise.all([org.ref.collection('members').count().get(),db.collection(rootFor(org.id)+'/products/raiz_e_mesa/people').count().get()]);
  accounts+=a.data().count;journeyPeople+=j.data().count;
  const journey=['active','trialing'].includes(String((data.apps?.nestjourney||data.apps?.raiz_e_mesa)?.status||'').toLowerCase());
  work.push({org:org.id,owner,journey});
}
const sources=accounts+journeyPeople;
// Conservative bounded rollout. Do not silently spend unbounded reads/writes.
if(sources>2000)throw Error('INITIAL_SOURCE_BUDGET_EXCEEDED');
console.log(JSON.stringify({mode:manifest.mode,organizations:work.length,skipped,accountSources:accounts,journeySources:journeyPeople,projectedInitialWritesUpperBound:sources*5}));
if(!apply)process.exit(0);
for(const key of ['hubReleaseSha','journeyReleaseSha'])if(!/^[a-f0-9]{40}$/.test(manifest[key]||''))throw Error('EXACT_RELEASE_REQUIRED');
if(process.env.GITHUB_REF!=='refs/heads/production')throw Error('PRODUCTION_REF_REQUIRED');
const service=JSON.parse(execFileSync('gcloud',['run','services','describe','millionsnest-api','--project=millionsnest','--region=us-central1','--format=json'],{encoding:'utf8'}));
const image=service.spec?.template?.spec?.containers?.[0]?.image||'';
if(!image.endsWith(':'+manifest.hubReleaseSha)||service.status.latestCreatedRevisionName!==service.status.latestReadyRevisionName||!service.status.traffic?.some((t:any)=>t.percent===100&&(t.revisionName===service.status.latestReadyRevisionName||t.latestRevision===true)))throw Error('HUB_EXACT_SERVING_RELEASE_REQUIRED');
const release=await fetch('https://nestjourney.millionsnest.com/connect-release.json?people='+manifest.journeyReleaseSha,{signal:AbortSignal.timeout(30000)});
if(!release.ok||(await release.json()).releaseSha!==manifest.journeyReleaseSha)throw Error('JOURNEY_EXACT_SERVING_RELEASE_REQUIRED');
const authProbe=await fetch('https://www.millionsnest.com/api/v1/organizations/release-smoke-synthetic/people-directory',{signal:AbortSignal.timeout(30000)});
if(authProbe.status!==401||(await authProbe.json()).reasonCode!=='UNAUTHENTICATED')throw Error('DIRECTORY_RUNTIME_GATEWAY_REQUIRED');
const token=execFileSync('gcloud',['auth','print-access-token'],{encoding:'utf8'}).trim();
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
  const snapshot=await synchronizeDirectory(db,item.org,item.owner);
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
