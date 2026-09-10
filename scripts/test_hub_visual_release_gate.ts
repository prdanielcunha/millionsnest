import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');
const dashboard = read('src/pages/Dashboard.tsx');
const organization = read('src/components/OrganizationManager.tsx');
const shell = read('src/components/EcosystemShell.tsx');
const invite = read('src/components/InviteModal.tsx');
const admin = read('src/pages/EcosystemAdmin.tsx');
const landing = read('src/pages/MusicScaleLanding.tsx');
const guidedDemo = read('src/components/MusicScaleGuidedDemo.tsx');
const checkout = read('src/pages/Checkout.tsx');

assert.equal(organization.includes('break-all\">{member.email}'), false, 'member email cannot use break-all');
assert.ok(organization.includes('data-hub-member-row'), 'member rows must remain structurally identifiable');
assert.ok(organization.includes('data-hub-member-controls'), 'member controls must remain separated from identity');
assert.equal(organization.includes('data-hub-member-row className={`flex flex-col gap-4 p-4 sm:flex-row'), false, 'member rows cannot switch horizontal at viewport sm');
assert.ok(dashboard.includes('[overflow-wrap:anywhere]\">{user.email}'), 'account email must stay readable');
assert.ok(invite.includes('max-h-[calc(100dvh'), 'invite modal must use dynamic viewport height');
assert.ok(invite.includes('w-full sm:max-w-md'), 'invite modal must fit phones');
assert.ok(shell.includes('w-[min(22rem,calc(100vw-1rem))]'), 'launcher must not overflow viewport');
assert.ok(shell.includes('w-[min(18rem,calc(100vw-1rem))]'), 'organization switcher must not overflow viewport');
const tableCount = (admin.match(/<table\b/g) || []).length;
const overflowTableCount = (admin.match(/overflow-x-auto/g) || []).length;
assert.ok(tableCount > 0, 'ecosystem admin must still expose data tables');
assert.ok(overflowTableCount >= 2, 'ecosystem admin tables must be protected by horizontal overflow');
assert.ok(landing.includes('overflow-x-hidden'), 'MusicScale landing must guard page-level horizontal overflow');
assert.ok(landing.includes('<MusicScaleGuidedDemo'), 'sales landing must include guided product proof');
for (const visual of ['CreateScaleVisual', 'RepertoireVisual', 'NotificationsVisual', 'ConfirmationsVisual', 'PerformanceVisual']) {
  assert.ok(guidedDemo.includes(`function ${visual}`), `guided demo must contain ${visual}`);
}
assert.ok(checkout.includes('max-w-'), 'checkout must retain bounded content width');
console.log('PASS Hub visual release gate: structural overflow, identity and product-proof protections are present');
