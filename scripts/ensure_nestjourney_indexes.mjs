import { readFileSync } from 'node:fs';

// Add-only: never use firebase deploy --only firestore:indexes here because that
// could delete indexes owned by unrelated ecosystem products.
const token=process.env.FIRESTORE_INDEX_ACCESS_TOKEN;
if(!token)throw Error('INDEX_AUTH_UNAVAILABLE');
const project='millionsnest',database='(default)';
const declared=JSON.parse(readFileSync('firestore.indexes.json','utf8')).indexes;
const specs=[
  {collectionGroup:'personBirthdays',fields:[['congregationId','ASCENDING'],['shareWithTeam','ASCENDING']]},
  {collectionGroup:'nestjourney_calendar_feeds',fields:[['organizationId','ASCENDING'],['active','ASCENDING']]},
];
for(const spec of specs){
  if(!declared.some(index=>index.collectionGroup===spec.collectionGroup&&
      index.queryScope==='COLLECTION'&&
      JSON.stringify(index.fields.map(field=>[field.fieldPath,field.order]))===JSON.stringify(spec.fields)))
    throw Error('REVIEWED_INDEX_NOT_DECLARED:'+spec.collectionGroup);
}
const headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function match(index,spec){
  const fields=(index.fields||[]).filter(field=>field.fieldPath!=='__name__');
  return index.queryScope==='COLLECTION'&&
    JSON.stringify(fields.map(field=>[field.fieldPath,field.order]))===JSON.stringify(spec.fields);
}
async function list(spec){
  const origin='https://firestore.googleapis.com/v1/projects/'+project+
    '/databases/'+encodeURIComponent(database)+'/collectionGroups/'+spec.collectionGroup+'/indexes';
  let found=[],pageToken='';
  do{
    const url=origin+'?pageSize=100'+(pageToken?'&pageToken='+encodeURIComponent(pageToken):'');
    const resp=await fetch(url,{headers,signal:AbortSignal.timeout(30000)});
    if(!resp.ok)throw Error('INDEX_LIST_DENIED:'+spec.collectionGroup+':HTTP_'+resp.status);
    const page=await resp.json();
    found.push(...(page.indexes||[]));pageToken=page.nextPageToken||'';
  }while(pageToken);
  return found;
}
for(const spec of specs){
  const origin='https://firestore.googleapis.com/v1/projects/'+project+
    '/databases/'+encodeURIComponent(database)+'/collectionGroups/'+spec.collectionGroup+'/indexes';
  let existing=(await list(spec)).find(index=>match(index,spec));
  if(!existing){
    const body={queryScope:'COLLECTION',fields:spec.fields.map(([fieldPath,order])=>({fieldPath,order}))};
    const resp=await fetch(origin,{method:'POST',headers,body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
    if(!resp.ok && resp.status!==409)throw Error('INDEX_CREATE_DENIED:'+spec.collectionGroup+':HTTP_'+resp.status);
    console.log('NESTJOURNEY_INDEX_ADD_ONLY_REQUESTED='+spec.collectionGroup);
  }
  let ready=false;
  for(let attempt=0;attempt<80;attempt++){
    existing=(await list(spec)).find(index=>match(index,spec));
    if(existing?.state==='READY'){ready=true;break}
    if(existing?.state && !['CREATING','READY'].includes(existing.state))
      throw Error('INDEX_UNHEALTHY:'+spec.collectionGroup+':'+existing.state);
    await wait(10000);
  }
  if(!ready)throw Error('INDEX_NOT_READY:'+spec.collectionGroup);
  console.log('NESTJOURNEY_INDEX_READY='+spec.collectionGroup);
}
