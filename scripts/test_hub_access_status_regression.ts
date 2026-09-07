import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workspace = readFileSync('src/components/dashboard/EcosystemWorkspaceHome.tsx', 'utf8');
const server = readFileSync('server.ts', 'utf8');
const resolver = readFileSync('src/server/services/EcosystemAccessResolver.ts', 'utf8');
const locales = {
  pt: readFileSync('src/packages/i18n/locales/pt.ts', 'utf8'),
  en: readFileSync('src/packages/i18n/locales/en.ts', 'utf8'),
  es: readFileSync('src/packages/i18n/locales/es.ts', 'utf8')
};

for (const [lang, locale] of Object.entries(locales)) {
  for (const key of ['active', 'cancel_scheduled', 'administrative', 'error']) {
    assert.match(locale, new RegExp("\\b" + key + ":\\s*[\\\"']"), lang + ' must translate MusicScale status ' + key);
  }
  assert.match(locale, /plan_administrative:\s*["']/, lang + ' must translate administrative Pro plan');
}

assert.match(workspace, /const planLabelFor = \(experience: HubAppExperience\)[\s\S]*isGlobalAdmin[\s\S]*plan_administrative/, 'global users must have a dedicated per-app administrative plan label');
assert.match(workspace, /plan_administrative/, 'global plan label must not fall back to an unknown subscription');
assert.match(workspace, /administrative'[\s\S]*isReadyToOpen/, 'administrative access must remain ready to open');

assert.match(
  resolver,
  /if \(hasGlobalRole\)[\s\S]*accessible:\s*true[\s\S]*isGlobalAccess:\s*true[\s\S]*accessSource:\s*'global_system_role'/,
  'canonical global roles must continue to bypass organization membership/subscription gates'
);

assert.match(server, /tenant\.context\.owner_membership_repaired/, 'legacy owner repair must be audited');
assert.match(server, /org\.ownerUserId === uid[\s\S]*org\.ownerUid === uid[\s\S]*org\.ownerId === uid/, 'legacy repair must require authoritative owner metadata');
assert.match(server, /collection\('organizations'\)\.doc\(orgId\)\.collection\('members'\)\.doc\(uid\)/, 'repair must restore the canonical member document');
assert.match(server, /collection\('organization_members'\)\.doc\(\`\$\{uid\}_\$\{orgId\}\`\)/, 'repair must preserve the legacy projection during migration');
assert.match(server, /permissions:\s*getDefaultPermissions\('owner'\)/, 'repaired owner must receive canonical owner permissions');
assert.equal(
  /ownerMatches\s*=\s*orgId\s*===\s*uid/.test(server),
  false,
  'repair must never infer ownership merely because organizationId equals uid'
);

console.log('PASS Hub access status: global roles render correctly and legacy owners are repaired without weakening authorization');
