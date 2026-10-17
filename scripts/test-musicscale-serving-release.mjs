import assert from 'node:assert/strict';
import { verifyServingRelease } from './verify-musicscale-serving-release.mjs';
const sha='a'.repeat(40), digest='sha256:'+'b'.repeat(64), image='us-central1-docker.pkg.dev/millionsnest/millionsnest-web/musicscale-api';
const service={status:{conditions:[{type:'Ready',status:'True'}],latestReadyRevisionName:'musicscale-api-good',latestCreatedRevisionName:'musicscale-api-good',traffic:[{revisionName:'musicscale-api-good',percent:100}]},spec:{template:{spec:{containers:[{image:`${image}:${sha}`}]}}}};
const revision={metadata:{name:'musicscale-api-good'},status:{conditions:[{type:'Ready',status:'True'}],imageDigest:`${image}@${digest}`},spec:{containers:[{image:`${image}:${sha}`,env:[]}]}};
revision.spec.serviceAccountName='mn-musicscale-runtime@millionsnest.iam.gserviceaccount.com';
assert.equal(verifyServingRelease(service,revision,sha,digest).sha,sha);
const pinned=structuredClone(revision);pinned.spec.containers[0].image=`${image}@${digest}`;assert.equal(verifyServingRelease(service,pinned,sha,digest).digest,digest);
for (const mutate of [
 s=>s.status.traffic=[{revisionName:'musicscale-api-old',percent:100}],
 s=>s.status.traffic=[{revisionName:'musicscale-api-good',percent:90},{revisionName:'musicscale-api-old',percent:10}],
 s=>s.status.latestCreatedRevisionName='musicscale-api-pending',
 s=>s.status.conditions[0].status='False',
 s=>s.spec.template.spec.containers[0].image=`${image}:old`,
]){const x=structuredClone(service);mutate(x);assert.throws(()=>verifyServingRelease(x,revision,sha,digest));}
for(const mutate of [r=>r.status.imageDigest=`${image}@sha256:${'c'.repeat(64)}`,r=>r.spec.containers[0].image=`${image}:old`,r=>r.status.conditions[0].status='False',r=>r.spec.containers[0].env=[{name:'MUSICSCALE_CONNECT_SCALE_PUBLISHED_EVENTS_ENABLED',value:'true'}],r=>r.spec.containers[0].env=[{name:'MUSICSCALE_CONNECT_SCALE_PUBLISHED_EVENTS_ENABLED',valueFrom:{secretKeyRef:{name:'never-read'}}}]]){const x=structuredClone(revision);mutate(x);assert.throws(()=>verifyServingRelease(service,x,sha,digest));}
assert.throws(()=>verifyServingRelease(service,revision,sha,''));
assert.throws(()=>verifyServingRelease(service,revision,'invalid',digest));
console.log('MusicScale serving proof: 14 stale/split-traffic/digest/readiness/activation guards PASS; synthetic only.');
