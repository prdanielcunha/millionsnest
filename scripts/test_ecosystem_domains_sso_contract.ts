import assert from 'node:assert/strict';
import { ECOSYSTEM_APPS } from '../src/lib/apps.ts';
import {
  buildEcosystemLoginPath,
  resolveSafePostLoginPath,
  resolveTrustedEcosystemReturnOrigin,
} from '../src/lib/connectLaunchPolicy.ts';
import { openEcosystemModule } from '../src/lib/ecosystemLauncher.ts';

const byId = new Map(ECOSYSTEM_APPS.map(app => [app.id, app]));

for (const id of ['musicscale', 'connect', 'nestfinance', 'nestjourney', 'nestlocal']) {
  assert.ok(byId.has(id), `missing canonical app registry entry: ${id}`);
}

for (const id of ['musicscale', 'connect', 'nestfinance', 'nestjourney']) {
  const app = byId.get(id)!;
  assert.match(app.canonicalOrigin || '', /^https:\/\/[a-z0-9-]+\.millionsnest\.com$/);
  assert.equal(app.authMode, 'hub_handoff');
  assert.ok(app.hubLaunchRoute?.startsWith('/'));
  assert.ok(app.firebaseHostingSite?.startsWith('mn-'));
  assert.equal(app.domainStatus, 'configured', `${id} must use a certified official domain`);
}

assert.equal(byId.get('nestlocal')?.directEntrySso, false, 'NestLocal must not be launchable before a real app/site exists');
assert.equal(byId.get('nestlocal')?.domainStatus, 'reserved');
assert.equal(byId.get('nestfinance')?.url, 'https://nestfinance.millionsnest.com/auth/handoff');
assert.equal(byId.get('nestjourney')?.url, 'https://nestjourney.millionsnest.com/');

assert.equal(
  resolveSafePostLoginPath('?next=%2Fapps%2Fmusicscale%2Flaunch'),
  '/apps/musicscale/launch'
);
assert.equal(
  resolveSafePostLoginPath('?next=%2Fapps%2Fnestfinance%2Flaunch%3FreturnTo%3D%252Ffinance%252Freports'),
  '/apps/nestfinance/launch?returnTo=%2Ffinance%2Freports'
);
assert.equal(resolveSafePostLoginPath('?next=https%3A%2F%2Fevil.example'), null);
assert.equal(resolveSafePostLoginPath('?next=%2Fapps%2Fnestlocal%2Flaunch'), null);

const previewOrigin = 'https://mn-musicscale-555464791734--main-review-kwai2lc4.web.app';
assert.equal(resolveTrustedEcosystemReturnOrigin('musicscale', previewOrigin), previewOrigin);
assert.equal(resolveTrustedEcosystemReturnOrigin('musicscale', 'http://mn-musicscale-555464791734--main-review-kwai2lc4.web.app'), null);
assert.equal(resolveTrustedEcosystemReturnOrigin('musicscale', 'https://evil.example'), null);
assert.equal(resolveTrustedEcosystemReturnOrigin('nestfinance', previewOrigin), null);

const previewLoginPath = buildEcosystemLoginPath('musicscale', '/start', previewOrigin);
const previewNext = new URLSearchParams(previewLoginPath.split('?')[1]).get('next');
assert.ok(previewNext);
assert.equal(resolveSafePostLoginPath(`?next=${encodeURIComponent(previewNext!)}`), previewNext);
assert.match(previewNext!, /returnOrigin=https%3A%2F%2Fmn-musicscale-555464791734--main-review-kwai2lc4\.web\.app/);

const evilLoginPath = buildEcosystemLoginPath('musicscale', '/start', 'https://evil.example');
const evilNext = new URLSearchParams(evilLoginPath.split('?')[1]).get('next') || '';
assert.equal(new URL(evilNext, 'https://www.millionsnest.com').searchParams.get('returnOrigin'), null);

const now = Date.now();
const user = { uid: 'user-123' };
const organization = { id: 'org-123' };

async function captureLaunch(
  appId: 'nestfinance' | 'musicscale',
  destinationPath: string,
  returnOrigin?: string,
) {
  let assigned = '';
  const app = byId.get(appId)!;

  await openEcosystemModule(
    appId,
    user,
    { systemRole: 'user' },
    organization,
    {},
    {
      loadApps: async () => [app],
      getIdToken: async () => 'hub-id-token',
      fetchFn: async () => new Response(JSON.stringify({
        appId,
        protocolVersion: '1.0.0',
        orgId: organization.id,
        uid: user.uid,
        customToken: 'custom-token',
        expiresAt: now + 300_000,
        supportMode: false,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
      sleep: async () => {},
      assign: (url) => { assigned = url; },
      now: () => now,
      readSupportSession: () => null,
      markPerformance: () => {},
    },
    destinationPath,
    returnOrigin,
  );

  return new URL(assigned);
}

const nestFinanceLaunch = await captureLaunch('nestfinance', '/finance/reports');
assert.equal(nestFinanceLaunch.origin, 'https://nestfinance.millionsnest.com');
assert.equal(nestFinanceLaunch.pathname, '/auth/handoff');
assert.equal(nestFinanceLaunch.searchParams.get('returnTo'), '/finance/reports');
assert.ok(nestFinanceLaunch.searchParams.get('ecosystem_ctx'));

const musicScaleLaunch = await captureLaunch('musicscale', '/songs');
assert.equal(musicScaleLaunch.origin, 'https://musicscale.millionsnest.com');
assert.equal(musicScaleLaunch.pathname, '/songs');
assert.equal(musicScaleLaunch.searchParams.get('returnTo'), null);
assert.ok(musicScaleLaunch.searchParams.get('ecosystem_ctx'));

const musicScalePreviewLaunch = await captureLaunch('musicscale', '/start', previewOrigin);
assert.equal(musicScalePreviewLaunch.origin, previewOrigin);
assert.equal(musicScalePreviewLaunch.pathname, '/start');
assert.ok(musicScalePreviewLaunch.searchParams.get('ecosystem_ctx'));

const musicScaleEvilLaunch = await captureLaunch('musicscale', '/start', 'https://evil.example');
assert.equal(musicScaleEvilLaunch.origin, 'https://musicscale.millionsnest.com');

const nestFinancePreviewAttempt = await captureLaunch('nestfinance', '/finance/reports', previewOrigin);
assert.equal(nestFinancePreviewAttempt.origin, 'https://nestfinance.millionsnest.com');

console.log('ecosystem domains + SSO contract: ok');
