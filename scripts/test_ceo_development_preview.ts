import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ECOSYSTEM_APPS, type EcosystemApp } from '../src/lib/apps.js';
import {
  resolveHubAppExperience,
  type HubAppExperience
} from '../src/lib/hubAppExperience.js';
import { resolveEntitledAppIds } from '../src/lib/adaptiveEntitlements.js';
import { canAccessEcosystemDevelopment } from '../src/lib/permissionService.js';

const nestFinance = ECOSYSTEM_APPS.find(app => app.id === 'nestfinance');
const nestJourney = ECOSYSTEM_APPS.find(app => app.id === 'nestjourney');
assert.ok(nestFinance);
assert.ok(nestJourney);
assert.equal(nestFinance!.status, 'coming_soon');
assert.equal(nestJourney!.status, 'coming_soon');

assert.equal(canAccessEcosystemDevelopment('ceo'), true);
assert.equal(canAccessEcosystemDevelopment('founder'), true);
assert.equal(canAccessEcosystemDevelopment('ecosystem_owner'), true);
assert.equal(canAccessEcosystemDevelopment('global_admin'), true);
assert.equal(canAccessEcosystemDevelopment('ecosystem_support'), false);
assert.equal(canAccessEcosystemDevelopment('user'), false);
assert.equal(canAccessEcosystemDevelopment('admin'), false);

function preview(app: EcosystemApp, role: string): HubAppExperience {
  return resolveHubAppExperience({
    app,
    organization: {
      id: 'org-dev-preview',
      enabledApps: [],
      apps: {}
    },
    isGlobalAdmin: role === 'ceo',
    canAccessDevelopmentPreviews: canAccessEcosystemDevelopment(role)
  });
}

const ordinaryFinance = preview(nestFinance!, 'user');
assert.equal(ordinaryFinance.installed, false);
assert.equal(ordinaryFinance.canOpen, false);
assert.equal(ordinaryFinance.state, 'coming_soon');
assert.equal(ordinaryFinance.isOperational, false);

const ceoFinance = preview(nestFinance!, 'ceo');
const ceoJourney = preview(nestJourney!, 'ceo');

for (const experience of [ceoFinance, ceoJourney]) {
  assert.equal(experience.installed, true);
  assert.equal(experience.canOpen, true);
  assert.equal(experience.state, 'development');
  assert.equal(
    experience.isOperational,
    false,
    'CEO preview access must never turn an unfinished product into an operational/customer entitlement'
  );
  assert.equal(experience.plan, null);
}

assert.deepEqual(
  resolveEntitledAppIds([ceoFinance, ceoJourney]),
  [],
  'internal development previews must never enter adaptive/commercial entitlement resolution'
);

const disabledApp: EcosystemApp = {
  id: 'disabled-preview-test',
  name: 'Disabled Preview Test',
  description: 'disabled',
  icon: 'Grid',
  status: 'disabled',
  category: 'beta',
  url: 'https://example.invalid/'
};

const disabledForCeo = preview(disabledApp, 'ceo');
assert.equal(disabledForCeo.installed, false);
assert.equal(disabledForCeo.canOpen, false);

const dashboard = readFileSync('src/pages/Dashboard.tsx', 'utf8');
assert.match(
  dashboard,
  /canAccessDevelopmentPreviews\s*=\s*canAccessEcosystemDevelopment\(profile\?\.systemRole\)/,
  'Dashboard must derive preview access from the canonical global development capability'
);
assert.match(
  dashboard,
  /canAccessDevelopmentPreviews\s*\n\s*\}\);/,
  'Hub app catalog must receive the development-preview capability'
);
assert.match(
  dashboard,
  /!organization\?\.enabledApps\?\.includes\(app\.id\)[\s\S]{0,180}!canAccessDevelopmentPreviews/,
  'client enabledApps gate may be bypassed only by the canonical development-preview capability'
);

const home = readFileSync('src/components/dashboard/EcosystemWorkspaceHome.tsx', 'utf8');
assert.match(home, /Preview interno/);
assert.match(home, /Em desenvolvimento · acesso interno/);

console.log('CEO-only ecosystem development preview checks passed.');
