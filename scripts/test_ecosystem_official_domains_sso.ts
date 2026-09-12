import assert from 'node:assert/strict';
import { ECOSYSTEM_APPS } from '../src/lib/apps.js';
import {
  ECOSYSTEM_APP_DOMAINS,
  getEcosystemAppDomain,
  getSafeLiveLaunchPaths,
} from '../src/lib/ecosystemAppDomains.js';
import {
  buildEcosystemLoginPath,
  resolveSafeEcosystemPostLoginPath,
} from '../src/lib/ecosystemLaunchPolicy.js';

const expectedIds = ['hub', 'musicscale', 'connect', 'nestfinance', 'nestjourney', 'nestlocal'];
assert.deepEqual(
  ECOSYSTEM_APP_DOMAINS.map((entry) => entry.id),
  expectedIds,
  'every ecosystem product must have a canonical domain record',
);

for (const entry of ECOSYSTEM_APP_DOMAINS) {
  assert.match(entry.canonicalOrigin, /^https:\/\/[a-z0-9.-]+\.millionsnest\.com$|^https:\/\/www\.millionsnest\.com$/);
  assert.equal(entry.canonicalOrigin.includes('.web.app'), false, `${entry.id} must not expose web.app as official origin`);
  if (entry.id !== 'hub') {
    assert.ok(entry.hubLaunchPath?.startsWith(`/${entry.id}/`), `${entry.id} must reserve its own Hub launch namespace`);
  }
}

const musicScale = getEcosystemAppDomain('musicscale');
const connect = getEcosystemAppDomain('connect');
assert.equal(musicScale?.canonicalOrigin, 'https://musicscale.millionsnest.com');
assert.equal(musicScale?.ssoStatus, 'live');
assert.equal(connect?.canonicalOrigin, 'https://connect.millionsnest.com');
assert.equal(connect?.ssoStatus, 'live');

const musicScaleCatalog = ECOSYSTEM_APPS.find((app) => app.id === 'musicscale');
const connectCatalog = ECOSYSTEM_APPS.find((app) => app.id === 'connect');
assert.ok(musicScaleCatalog?.url?.startsWith(`${musicScale?.canonicalOrigin}/`));
assert.equal(connectCatalog?.url, connect?.canonicalOrigin);

const liveLaunchPaths = getSafeLiveLaunchPaths();
assert.ok(liveLaunchPaths.includes('/connect/launch'));
assert.ok(liveLaunchPaths.includes('/musicscale/launch'));
assert.equal(liveLaunchPaths.includes('/nestfinance/launch'), false, 'planned SSO must not become a login redirect allowlist');
assert.equal(liveLaunchPaths.includes('/nestjourney/launch'), false, 'planned SSO must not become a login redirect allowlist');
assert.equal(liveLaunchPaths.includes('/nestlocal/launch'), false, 'repo-missing SSO must not become a login redirect allowlist');

assert.equal(resolveSafeEcosystemPostLoginPath('?next=%2Fconnect%2Flaunch'), '/connect/launch');
assert.equal(resolveSafeEcosystemPostLoginPath('?next=%2Fmusicscale%2Flaunch'), '/musicscale/launch');
assert.equal(resolveSafeEcosystemPostLoginPath('?next=https%3A%2F%2Fevil.example'), null);
assert.equal(resolveSafeEcosystemPostLoginPath('?next=%2Fnestfinance%2Flaunch'), null);
assert.equal(buildEcosystemLoginPath('musicscale'), '/login?next=%2Fmusicscale%2Flaunch');
assert.throws(() => buildEcosystemLoginPath('nestfinance'));

console.log('Ecosystem official domains + SSO contract: OK');
