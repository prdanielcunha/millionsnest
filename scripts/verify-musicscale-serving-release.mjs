import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
export function verifyServingRelease(service, revision, sha, digest) {
  const fail = () => { throw Error('MUSICSCALE_SERVING_RELEASE_PROOF_FAILED'); };
  const image = 'us-central1-docker.pkg.dev/millionsnest/millionsnest-web/musicscale-api';
  if (!/^[a-f0-9]{40}$/.test(sha) || !/^sha256:[a-f0-9]{64}$/.test(digest)) fail();
  const ready = x => x?.status?.conditions?.some(c => c.type === 'Ready' && c.status === 'True');
  const status = service?.status || {};
  const traffic = (status.traffic || []).filter(t => Number(t.percent) > 0);
  const name = revision?.metadata?.name;
  if (!ready(service) || !ready(revision) || !name?.startsWith('musicscale-api-') ||
      status.latestReadyRevisionName !== name || status.latestCreatedRevisionName !== name ||
      traffic.length !== 1 || Number(traffic[0].percent) !== 100 || traffic[0].revisionName !== name) fail();
  const container = revision?.spec?.containers?.[0];
  if (revision.spec.containers.length !== 1 ||
      ![`${image}:${sha}`, `${image}@${digest}`].includes(container.image) ||
      service?.spec?.template?.spec?.containers?.[0]?.image !== `${image}:${sha}` ||
      revision.status.imageDigest !== `${image}@${digest}`) fail();
  const flag = container.env?.find(e => e.name === 'MUSICSCALE_CONNECT_SCALE_PUBLISHED_EVENTS_ENABLED');
  if (flag && (flag.valueFrom || !['false', '0', ''].includes(flag.value))) fail();
  return { sha, revision: name, digest, sourceBridge: 'OFF' };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [service, revision, sha, digest] = process.argv.slice(2);
  const proof = verifyServingRelease(JSON.parse(readFileSync(service)), JSON.parse(readFileSync(revision)), sha, digest);
  console.log('MUSICSCALE_ACTUAL_SERVING_RELEASE_PROOF_OK=' + JSON.stringify(proof));
}
