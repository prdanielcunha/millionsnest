import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const dashboard = readFileSync('src/pages/Dashboard.tsx', 'utf8');
const organization = readFileSync('src/components/OrganizationManager.tsx', 'utf8');
const invite = readFileSync('src/components/InviteModal.tsx', 'utf8');
const shell = readFileSync('src/components/EcosystemShell.tsx', 'utf8');

assert.ok(dashboard.includes('break-all">{user.email}'), 'long account emails must wrap on narrow screens');
assert.ok(dashboard.includes('min-w-0 flex-1 w-full'), 'profile editing must let the input shrink beside save/cancel actions');
assert.ok(dashboard.includes('break-words">{profileNameInput'), 'long display names must wrap instead of overflowing');
assert.ok(dashboard.includes("break-words'>"), false, 'guard against malformed responsive class edits');
assert.ok(dashboard.includes('break-words">\n                                 {org.name || \'Organização\'}') || dashboard.includes('break-words">\r\n                                 {org.name || \'Organização\'}'), 'long organization names must wrap in the account switcher');
assert.ok(dashboard.includes('md:hidden fixed inset-x-0 bottom-0'), 'mobile navigation must remain fixed and independent from desktop tabs');

assert.ok(organization.includes('flex flex-col sm:flex-row items-start gap-4 sm:gap-5'), 'logo settings must stack on narrow screens');
assert.ok(organization.includes('max-w-full w-full'), 'file upload control must stay within the viewport');
assert.ok(organization.includes('flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2'), 'public-page actions must stack on narrow screens');
assert.ok(organization.includes('flex flex-wrap sm:flex-nowrap items-center gap-2'), 'public URL editor must wrap safely below small widths');
assert.ok(organization.includes('min-w-[110px]'), 'public slug input must retain usable touch width');
assert.ok(organization.includes('break-all inline-block max-w-full'), 'technical IDs must never overflow even for global admins');

assert.ok(invite.includes('max-h-[calc(100dvh'), 'invite bottom sheet must remain bounded by the dynamic viewport');
assert.ok(shell.includes('w-[min(22rem,calc(100vw-1rem))]'), 'app launcher must remain viewport-bounded');
assert.ok(shell.includes('max-w-[92px] min-[390px]:max-w-[128px]'), 'organization context must adapt around 320–390px widths');

console.log('PASS Hub narrow viewport polish: 320px-safe account, organization, invite, launcher and long-content layouts');
