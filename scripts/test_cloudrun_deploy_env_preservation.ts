import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
const workflow = readFileSync('.github/workflows/cloudrun-private-deploy.yml', 'utf8');
assert.match(workflow, /--update-env-vars\s+"/, 'Hub deployment must update, not replace, Cloud Run environment');
assert.match(workflow, /--update-secrets\s+"/, 'Hub deployment must preserve unrelated Secret Manager bindings');
assert.doesNotMatch(workflow, /--set-env-vars|--clear-env-vars|--set-secrets|--clear-secrets/);
assert.match(workflow, /STRIPE_PRICE_MUSICSCALE_PRO_MONTHLY=/);
assert.match(workflow, /NODE_ENV=production/);
assert.match(workflow, /--no-allow-unauthenticated/);
assert(workflow.indexOf('Capture serving Hub revision before deploy') < workflow.indexOf('- name: Deploy private Cloud Run revision'));
assert.match(workflow, /if: failure\(\) && env\.PREVIOUS_HUB_REVISION != ''/);
assert.match(workflow, /--to-revisions="\$PREVIOUS_HUB_REVISION=100"/);
assert.match(workflow, /echo HUB_JOURNEY_CONTACT_AUTHORITY_OK/);
assert.match(workflow, /--revision-suffix "r\$\{GITHUB_RUN_ID\}"/);
assert.match(workflow, /--no-traffic/);
assert.match(workflow, /--to-revisions="\$EXPECTED_HUB_REVISION=100"/);
assert.match(workflow, /actions: read/);
assert(workflow.indexOf('Require matching shared Rules publication before new trial issuance') <
  workflow.indexOf('Route traffic to exact new Hub revision'));
assert.match(workflow, /\.head_sha == \$sha/);
assert.match(workflow, /completed:success/);
assert.match(workflow, /HUB_SHARED_RULES_PUBLICATION_TIMEOUT__OLD_TRAFFIC_PRESERVED/);
const guard = workflow.match(/node - <<'NODE'\n([\s\S]*?)\n\s+NODE/);
assert(guard, 'actual serving image/traffic guard must be present');
function verify(fixture: any) {
  runInNewContext(guard[1], {
    require: () => fixture,
    process: { env: { IMAGE: 'registry/hub:release-sha', GITHUB_SHA: 'release-sha', SERVICE: 'hub', GITHUB_RUN_ID: '123' }, exit: () => { throw new Error('RELEASE_REJECTED'); } },
    console: { log() {} },
  });
}
const serving = {
  spec: { template: { spec: { containers: [{ image: 'registry/hub:release-sha' }] } } },
  status: { conditions: [{ type: 'Ready', status: 'True' }], latestReadyRevisionName: 'hub-r123', latestCreatedRevisionName: 'hub-r123', traffic: [{ revisionName: 'hub-r123', percent: 100 }] },
};
assert.doesNotThrow(() => verify(serving));
for (const mutate of [
  (x: typeof serving) => { x.spec.template.spec.containers[0].image='registry/hub:old'; },
  (x: typeof serving) => { x.status.conditions[0].status='False'; },
  (x: typeof serving) => { x.status.latestCreatedRevisionName='revision-pending'; },
  (x: typeof serving) => { x.status.traffic[0].revisionName='revision-old'; },
  (x: typeof serving) => { x.status.traffic[0].percent=50; },
]) {
  const candidate=structuredClone(serving); mutate(candidate);
  assert.throws(() => verify(candidate), /RELEASE_REJECTED/);
}
console.log('PASS Hub Cloud Run env/secret preservation and deployed production safety keys');
