import assert from 'node:assert/strict';
import { ECOSYSTEM_APPS } from '../src/lib/apps.js';
import { resolveHubAppCatalog, resolveHubAppExperience } from '../src/lib/hubAppExperience.js';
import { isAllowedAppDestinationPath, resolveAppDestination } from '../src/lib/appExperienceRegistry.js';

const connect = ECOSYSTEM_APPS.find(app => app.id === 'connect');
assert.ok(connect, 'Connect must remain registered exactly once in the ecosystem catalog');
assert.equal(connect.status, 'beta', 'Connect public catalog state must remain beta during founder pilot');
assert.equal(connect.primaryAction, 'disabled', 'Connect must not become generally launchable from public catalog metadata');
assert.equal(connect.url, 'https://mn-connect-555464791734.web.app', 'Connect must use the canonical Firebase Hosting origin');
assert.equal(connect.operationalUrl, connect.url, 'Connect operational origin must match the canonical pilot origin');

const organization = { id: 'org-1', apps: {}, enabledApps: [] as string[] };

const normalExperience = resolveHubAppExperience({
  app: connect,
  organization,
  isGlobalAdmin: false,
});
assert.equal(normalExperience.installed, false, 'normal organization users must not receive the founder pilot');
assert.equal(normalExperience.canOpen, false, 'normal organization users must not open beta Connect');
assert.equal(normalExperience.state, 'development', 'normal users must continue seeing beta/development semantics');

const normalCatalogOrganization = { id: 'org-normal', apps: {}, enabledApps: [] as string[] };
resolveHubAppCatalog(ECOSYSTEM_APPS, {
  organization: normalCatalogOrganization,
  isGlobalAdmin: false,
});
assert.deepEqual(
  normalCatalogOrganization.enabledApps,
  [],
  'normal users must not receive an in-memory Connect enablement projection',
);

const adminExperience = resolveHubAppExperience({
  app: connect,
  organization,
  isGlobalAdmin: true,
});
assert.equal(adminExperience.installed, true, 'canonical global admins must receive the private pilot workspace');
assert.equal(adminExperience.canOpen, true, 'canonical global admins must be able to launch the private pilot');
assert.equal(adminExperience.state, 'administrative', 'private pilot must be visibly administrative');
assert.equal(adminExperience.isOperational, true, 'founder pilot surface must be treated as operational only for global admins');

const adminCatalogOrganization = { id: 'org-admin', apps: {}, enabledApps: ['musicscale'] as string[] };
const adminCatalog = resolveHubAppCatalog(ECOSYSTEM_APPS, {
  organization: adminCatalogOrganization,
  isGlobalAdmin: true,
});
const adminConnect = adminCatalog.find(experience => experience.app.id === 'connect');
assert.equal(adminConnect?.canOpen, true, 'admin catalog keeps Connect launchable');
assert.deepEqual(
  adminCatalogOrganization.enabledApps,
  ['musicscale', 'connect'],
  'admin founder pilot projects Connect into the current in-memory Hub launch session',
);
assert.equal(
  adminCatalogOrganization.enabledApps.filter(appId => appId === 'connect').length,
  1,
  'repeated founder-pilot projection must never duplicate Connect',
);
resolveHubAppCatalog(ECOSYSTEM_APPS, {
  organization: adminCatalogOrganization,
  isGlobalAdmin: true,
});
assert.equal(
  adminCatalogOrganization.enabledApps.filter(appId => appId === 'connect').length,
  1,
  'repeated catalog resolution keeps the projection idempotent',
);

assert.equal(resolveAppDestination('connect', 'home'), '/', 'Connect home must resolve through the app experience registry');
assert.equal(isAllowedAppDestinationPath('connect', '/'), true, 'Connect home destination must be allow-listed');
assert.equal(isAllowedAppDestinationPath('connect', '/admin'), false, 'unpublished Connect destinations must remain denied');
assert.equal(isAllowedAppDestinationPath('connect', 'https://evil.example'), false, 'absolute external destinations must remain denied');

console.log('Connect founder/admin pilot contract: OK');
