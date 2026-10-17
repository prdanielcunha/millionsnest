import assert from 'node:assert/strict';
import { proveSourceRecoveryImage } from './prove-source-recovery-image.mjs';
import { sourceProfiles, verifySourceServingRelease } from './source-recovery-image-policy.mjs';
const sha = 'a'.repeat(40), digest = 'sha256:' + 'b'.repeat(64);
let checks = 0;
for (const [source, profile] of Object.entries(sourceProfiles)) {
  const image = 'us-central1-docker.pkg.dev/millionsnest/millionsnest-web/' + profile.service;
  const name = profile.service + '-synthetic';
  const service = { status: { conditions: [{ type: 'Ready', status: 'True' }], latestReadyRevisionName: name,
    latestCreatedRevisionName: name, traffic: [{ percent: 100, revisionName: name }] },
    spec: { template: { spec: { containers: [{ image: `${image}:${sha}`, env: [] }] } } } };
  const revision = { metadata: { name }, status: { conditions: [{ type: 'Ready', status: 'True' }], imageDigest: `${image}@${digest}` },
    spec: { serviceAccountName: profile.runtime + '@millionsnest.iam.gserviceaccount.com', containers: [{ image: `${image}:${sha}`, env: [] }] } };
  const calls = [];
  let smoke = { event: 'connect_source_recovery', source, enabled: false, tenants: 0, failures: 0, scanned: 0 };
  const run = (command, args, options) => {
    calls.push({ command, args });
    assert.equal(options.stdio[2], 'pipe');
    if (command === 'gcloud') {
      assert(args.includes('describe')); assert(!args.some(x => ['update', 'replace', 'execute', 'deploy', 'add-iam-policy-binding'].includes(x)));
      if (args[0] === 'artifacts') return digest + '\n';
      return JSON.stringify(args[1] === 'services' ? service : revision);
    }
    assert.equal(command, 'docker');
    if (args[0] === 'run') {
      for (const guard of ['--network=none', '--read-only', '--cap-drop=ALL', '--security-opt=no-new-privileges', '--user=65532:65532']) assert(args.includes(guard));
      assert(args.includes(`${profile.flag}=false`)); assert(args.includes(`${image}@${digest}`)); assert(args.includes(profile.bundle));
      assert(!args.some(x => /token|secret|credential|volume|mount/i.test(x)));
      return JSON.stringify(smoke) + '\n';
    }
    return '';
  };
  assert.equal(proveSourceRecoveryImage(source, sha, run).offlineSmoke, 'PASS'); checks++;
  for (const env of [[{ name: profile.flag, value: 'true' }], [{ name: profile.flag, valueFrom: { secretKeyRef: { name: 'not-read' } } }],
    [{ name: profile.flag, value: 'false' }, { name: profile.flag, value: 'false' }]]) {
    revision.spec.containers[0].env = env; calls.length = 0;
    assert.throws(() => proveSourceRecoveryImage(source, sha, run));
    assert(!calls.some(c => c.command === 'docker'), 'active/unknown/ambiguous runtime never pulls or executes worker'); checks++;
  }
  revision.spec.containers[0].env = [];
  service.spec.template.spec.containers[0].env = [{ name: profile.flag, value: 'true' }];
  assert.throws(() => proveSourceRecoveryImage(source, sha, run)); checks++;
  service.spec.template.spec.containers[0].env = [];
  revision.spec.serviceAccountName = 'wrong-runtime@millionsnest.iam.gserviceaccount.com';
  assert.throws(() => verifySourceServingRelease(service, revision, sha, digest, source)); checks++;
  revision.spec.serviceAccountName = profile.runtime + '@millionsnest.iam.gserviceaccount.com';
  for (const patch of [{ tenants: 1 }, { enabled: true }, { source: 'other' }, { completed: 1 }]) {
    const previous = smoke; smoke = { ...smoke, ...patch }; calls.length = 0;
    assert.throws(() => proveSourceRecoveryImage(source, sha, run));
    assert(calls.some(c => c.command === 'docker' && c.args[0] === 'rm'), 'failed offline proof cleans local container');
    smoke = previous; checks++;
  }
}
for (const source of ['__proto__', 'constructor', 'unknown', undefined]) {
  assert.throws(() => proveSourceRecoveryImage(source, sha, () => assert.fail('no process for unknown source'))); checks++;
}
assert.throws(() => proveSourceRecoveryImage('musicscale', 'invalid', () => assert.fail('no process for invalid SHA'))); checks++;
console.log(`Source image proof: ${checks} assertions PASS, all three profiles, activation/secret-reference/runtime/side-effect/cleanup guards. Synthetic processes only.`);
