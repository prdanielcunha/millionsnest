import assert from 'node:assert/strict';
import { assertConnectGrantsRelease } from './connect_grants_release_guard.mjs';
const hashes={'src/lib/connectSessionContext.ts':'803408bc6bb4276afe8060b64239ceccc26714a8','src/server/services/ConnectSessionContextService.ts':'04c67f8851da4ae4b0772abe92bce636e141dde9'};
const good=['src/lib/connectSessionContext.ts','src/server/services/ConnectSessionContextService.ts'];
assert.doesNotThrow(()=>assertConnectGrantsRelease(good,hashes));
for(const path of ['server.ts','firestore.rules','package.json','src/server/services/EcosystemAccessResolver.ts','.github/workflows/other.yml','../src/lib/connectSessionContext.ts']) assert.throws(()=>assertConnectGrantsRelease([...good,path],hashes),/SCOPE_INVALID/);
assert.throws(()=>assertConnectGrantsRelease([],hashes),/SCOPE_INVALID/);
assert.throws(()=>assertConnectGrantsRelease(good,{...hashes,'src/server/services/ConnectSessionContextService.ts':'tampered'}),/SOURCE_MISMATCH/);
console.log('Connect grants release guard: scope injection, billing/auth/rules edits, missing/tampered reviewed source denied');

// Execute the actual checked-in jq fingerprints, including scaling/ingress preservation.
const { readFileSync } = await import('node:fs');
const { execFileSync } = await import('node:child_process');
const workflow=readFileSync('.github/workflows/connect-grants-preserving-release.yml','utf8');
const queries=[...workflow.matchAll(/jq -S '(\{runtime:[^']+)'/g)].map(x=>x[1]);
assert.equal(queries.length,3);
const original={metadata:{labels:{app:'synthetic'},annotations:{'run.googleapis.com/ingress':'all','run.googleapis.com/operation-id':'before'}},spec:{template:{metadata:{labels:{app:'synthetic'},annotations:{'autoscaling.knative.dev/maxScale':'3','client.knative.dev/user-image':'before'}},spec:{serviceAccountName:'synthetic-runtime',containers:[{image:'synthetic-before',env:[{name:'STRIPE_PRICE_SYNTHETIC',value:'synthetic-price'},{name:'SECRET_REF',valueFrom:{secretKeyRef:{name:'synthetic-secret',key:'1'}}}]}]}}}};
for(const query of queries){
 const fingerprint=value=>execFileSync('jq',['-Sc',query],{input:JSON.stringify(value),encoding:'utf8'});
 const imageOnly=structuredClone(original);imageOnly.spec.template.spec.containers[0].image='synthetic-after';imageOnly.spec.template.metadata.annotations['client.knative.dev/user-image']='after';imageOnly.metadata.annotations['run.googleapis.com/operation-id']='after';
 assert.equal(fingerprint(imageOnly),fingerprint(original),'image/provider metadata may change');
 for(const change of [v=>v.spec.template.spec.containers[0].env[0].value='changed',v=>v.spec.template.spec.containers[0].env[1].valueFrom.secretKeyRef.key='2',v=>v.spec.template.spec.serviceAccountName='other',v=>v.spec.template.metadata.annotations['autoscaling.knative.dev/maxScale']='9',v=>v.metadata.annotations['run.googleapis.com/ingress']='internal',v=>v.metadata.labels.app='other']){
  const altered=structuredClone(imageOnly);change(altered);assert.notEqual(fingerprint(altered),fingerprint(original),'billing, credentials, identity, scaling, ingress and labels must remain invariant');
 }
}
console.log('Actual jq fingerprints: image-only accepted; billing, secret binding, identity, scaling, ingress and label mutations detected');
