import assert from 'node:assert/strict';
import { ECOSYSTEM_APPS } from '../src/lib/apps.ts';
import { resolveSafePostLoginPath } from '../src/lib/connectLaunchPolicy.ts';
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
}

assert.equal(byId.get('nestlocal')?.directEntrySso, false, 'NestLocal must not be launchable before a real app/site exists');
assert.equal(byId.get('nestfinance')?.domainStatus, 'setup_required');
assert.equal(byId.get('nestjourney')?.domainStatus, 'setup_required');

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

const now = Date.now();
const user = { uid: 'user-123' };
const organization = { id: 'org-123' };

async function captureLaunch(appId: 'nestfinance' | 'musicscale', destinationPath: string) {
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
  );

  return new URL(assigned);
}

const nestFinanceLaunch = await captureLaunch('nestfinance', '/finance/reports');
assert.equal(nestFinanceLaunch.pathname, '/auth/handoff');
assert.equal(nestFinanceLaunch.searchParams.get('returnTo'), '/finance/reports');
assert.ok(nestFinanceLaunch.searchParams.get('ecosystem_ctx'));

const musicScaleLaunch = await captureLaunch('musicscale', '/songs');
assert.equal(musicScaleLaunch.pathname, '/songs');
assert.equal(musicScaleLaunch.searchParams.get('returnTo'), null);
assert.ok(musicScaleLaunch.searchParams.get('ecosystem_ctx'));

console.log('ecosystem domains + SSO contract: ok');
