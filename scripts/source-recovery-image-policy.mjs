export const sourceProfiles = Object.freeze({
  musicscale: { service: 'musicscale-api', flag: 'MUSICSCALE_CONNECT_SCALE_PUBLISHED_EVENTS_ENABLED', runtime: 'mn-musicscale-runtime', bundle: 'dist/connect-recovery.mjs' },
  nestfinance: { service: 'nestfinance-api', flag: 'NESTFINANCE_CONNECT_PENDING_EVENTS_ENABLED', runtime: 'mn-nestfinance-runtime', bundle: 'server-dist/connect-recovery.mjs' },
  nestjourney: { service: 'millionsnest-api', flag: 'NESTJOURNEY_CONNECT_FOLLOWUP_EVENTS_ENABLED', runtime: 'mn-hub-runtime', bundle: 'dist/journey-recovery.mjs' },
});
export function verifySourceServingRelease(service, revision, sha, digest, source) {
  const fail = () => { throw Error('SOURCE_SERVING_RELEASE_PROOF_FAILED'); };
  const profile = Object.hasOwn(sourceProfiles, source) && sourceProfiles[source];
  if (!profile || !/^[a-f0-9]{40}$/.test(sha) || !/^sha256:[a-f0-9]{64}$/.test(digest)) fail();
  const image = `us-central1-docker.pkg.dev/millionsnest/millionsnest-web/${profile.service}`;
  const ready = x => x?.status?.conditions?.some(c => c.type === 'Ready' && c.status === 'True');
  const status = service?.status || {}, name = revision?.metadata?.name;
  const traffic = (status.traffic || []).filter(t => Number(t.percent) > 0);
  if (!ready(service) || !ready(revision) || !name?.startsWith(profile.service + '-') ||
      status.latestReadyRevisionName !== name || status.latestCreatedRevisionName !== name ||
      traffic.length !== 1 || Number(traffic[0].percent) !== 100 || traffic[0].revisionName !== name) fail();
  const containers = revision?.spec?.containers, template = service?.spec?.template?.spec;
  if (!Array.isArray(containers) || containers.length !== 1 ||
      ![`${image}:${sha}`, `${image}@${digest}`].includes(containers[0].image) ||
      template?.containers?.[0]?.image !== `${image}:${sha}` ||
      revision.status.imageDigest !== `${image}@${digest}` ||
      revision.spec.serviceAccountName !== profile.runtime + '@millionsnest.iam.gserviceaccount.com') fail();
  for (const container of [containers[0], template.containers[0]]) {
    const flags = (container.env || []).filter(e => e.name === profile.flag);
    if (flags.length > 1 || flags.some(e => e.valueFrom || !['false', '0', ''].includes(e.value))) fail();
  }
  return { sha, revision: name, digest, sourceBridge: 'OFF' };
}
