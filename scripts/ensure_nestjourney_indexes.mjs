import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';

// Existing WIF + gcloud CLI, additive only: never deploy a full index manifest
// because deleting indices owned by other ecosystem products is forbidden.
const project='millionsnest';
const specs=[
  {collectionGroup:'personBirthdays',fields:[['congregationId','ASCENDING'],['shareWithTeam','ASCENDING']]},
  {collectionGroup:'nestjourney_calendar_feeds',fields:[['organizationId','ASCENDING'],['active','ASCENDING']]},
];
const declared=JSON.parse(readFileSync('firestore.indexes.json','utf8')).indexes;
for(const spec of specs){
  if(!declared.some(index=>index.collectionGroup===spec.collectionGroup&&
    index.queryScope==='COLLECTION'&&
    JSON.stringify(index.fields.map(f=>[f.fieldPath,f.order]))===JSON.stringify(spec.fields)))
    throw Error('REVIEWED_INDEX_NOT_DECLARED:'+spec.collectionGroup);
}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function command(args){
  try {
    return execFileSync('gcloud',args,{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:45000,maxBuffer:4*1024*1024});
  } catch(error){
    // stderr carries error metadata, never credentials. Do not print response bodies.
    const details=String(error.stderr||'').replace(/\s+/g,' ').slice(0,280);
    throw Error('GCLOUD_INDEX_COMMAND_FAILED:'+args.slice(0,4).join(':')+':'+details);
  }
}
function list(){
  const raw=command(['firestore','indexes','composite','list',
    '--project='+project,'--database=(default)','--format=json']);
  const j=JSON.parse(raw);
  if(!Array.isArray(j))throw Error('INDEX_LIST_INVALID');
  return j;
}
function matching(index,spec){
  const fields=(index.fields||[]).filter(field=>field.fieldPath!=='__name__');
  return String(index.name||'').includes('/collectionGroups/'+spec.collectionGroup+'/')
    && String(index.queryScope||'').toUpperCase()==='COLLECTION'
    && JSON.stringify(fields.map(x=>[x.fieldPath,String(x.order).toUpperCase()]))===JSON.stringify(spec.fields);
}
for(const spec of specs){
  let existing=list().find(index=>matching(index,spec));
  if(!existing){
    const args=['firestore','indexes','composite','create',
      '--project='+project,'--database=(default)','--collection-group='+spec.collectionGroup,
      '--query-scope=collection','--async','--quiet',
      ...spec.fields.map(([fieldPath])=>'--field-config=field-path='+fieldPath+',order=ascending')];
    command(args);
    console.log('NESTJOURNEY_INDEX_ADD_ONLY_REQUESTED='+spec.collectionGroup);
  }
  let ready=false;
  for(let attempt=0;attempt<80;attempt++){
    existing=list().find(index=>matching(index,spec));
    if(existing?.state==='READY'){ready=true;break}
    if(existing?.state&&!['CREATING','READY'].includes(existing.state))
      throw Error('INDEX_UNHEALTHY:'+spec.collectionGroup+':'+existing.state);
    await sleep(10000);
  }
  if(!ready)throw Error('INDEX_NOT_READY:'+spec.collectionGroup);
  console.log('NESTJOURNEY_INDEX_READY='+spec.collectionGroup);
}
