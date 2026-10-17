import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { sourceProfiles, verifySourceServingRelease } from './source-recovery-image-policy.mjs';

// No shell, customer query, credential mount, provider request or mutating GCP command.
export function proveSourceRecoveryImage(source, sha, run = execFileSync) {
  if (!Object.hasOwn(sourceProfiles, source) || !/^[a-f0-9]{40}$/.test(sha)) throw Error('SOURCE_IMAGE_PIN_INVALID');
  const profile = sourceProfiles[source], options = { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000, maxBuffer: 4 * 1024 * 1024 };
  const describe = args => run('gcloud', args, options);
  const image = `us-central1-docker.pkg.dev/millionsnest/millionsnest-web/${profile.service}`;
  const digest = describe(['artifacts', 'docker', 'images', 'describe', `${image}:${sha}`, '--project', 'millionsnest', '--format=value(image_summary.digest)']).trim();
  const service = JSON.parse(describe(['run', 'services', 'describe', profile.service, '--project', 'millionsnest', '--region', 'us-central1', '--format=json']));
  const revisionName = service?.status?.latestReadyRevisionName;
  if (typeof revisionName !== 'string' || !new RegExp('^' + profile.service + '-[a-z0-9-]+$').test(revisionName)) throw Error('SOURCE_REVISION_INVALID');
  const revision = JSON.parse(describe(['run', 'revisions', 'describe', revisionName, '--project', 'millionsnest', '--region', 'us-central1', '--format=json']));
  const proof = verifySourceServingRelease(service, revision, sha, digest, source);
  const pinned = `${image}@${digest}`, name = `source-image-proof-${source}-${process.pid}`;
  run('docker', ['pull', pinned], options);
  let output;
  try {
    output = run('docker', ['run', '--rm', '--name', name, '--network=none', '--read-only', '--cap-drop=ALL',
      '--security-opt=no-new-privileges', '--pids-limit=64', '--memory=512m', '--cpus=1', '--user=65532:65532',
      '-e', `${profile.flag}=false`, '-e', 'FIREBASE_PROJECT_ID=demo-connect-off-proof',
      '--entrypoint=node', pinned, profile.bundle], options);
  } finally {
    try { run('docker', ['rm', '-f', name], options); } catch { /* --rm already cleaned a successful container */ }
  }
  const rows = output.split('\n').flatMap(line => { try { return [JSON.parse(line)]; } catch { return []; } });
  const events = rows.filter(row => row.event === 'connect_source_recovery');
  if (events.length !== 1 || events[0].source !== source || events[0].enabled !== false ||
      events[0].tenants !== 0 || events[0].failures !== 0 ||
      Object.values(events[0]).some(value => typeof value === 'number' && value !== 0)) throw Error('SOURCE_IMAGE_OFF_SMOKE_FAILED');
  return { source, ...proof, bundle: profile.bundle, offlineSmoke: 'PASS', network: 'NONE', credentialsPassed: false };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.env.GITHUB_REF !== 'refs/heads/production' || process.env.GITHUB_REPOSITORY !== 'prdanielcunha/millionsnest') throw Error('PRODUCTION_REF_REQUIRED');
    const source = process.argv[2], pins = JSON.parse(readFileSync('ops/source-recovery-image-proof.json'));
    const proof = proveSourceRecoveryImage(source, pins[source]);
    console.log('SOURCE_PRODUCTION_IMAGE_OFF_PROOF_OK=' + JSON.stringify(proof));
  } catch {
    // Do not print raw Cloud Run env, Docker output or credential diagnostics.
    console.error('SOURCE_PRODUCTION_IMAGE_OFF_PROOF_FAILED'); process.exitCode = 1;
  }
}
