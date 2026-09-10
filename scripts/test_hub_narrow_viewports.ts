import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const dashboard = readFileSync('src/pages/Dashboard.tsx', 'utf8');
const organization = readFileSync('src/components/OrganizationManager.tsx', 'utf8');
const invite = readFileSync('src/components/InviteModal.tsx', 'utf8');
const shell = readFileSync('src/components/EcosystemShell.tsx', 'utf8');

assert.ok(dashboard.includes('break-words [overflow-wrap:anywhere]\">{user.email}'), 'account email must wrap naturally instead of breaking character-by-character');
assert.ok(dashboard.includes('min-w-0 flex-1 w-full'), 'profile editing must let the input shrink beside save/cancel actions');
assert.ok(dashboard.includes('break-words\">{profileNameInput'), 'long display names must wrap instead of overflowing');
assert.ok(dashboard.includes('md:hidden fixed inset-x-0 bottom-0'), 'mobile navigation must remain fixed and independent from desktop tabs');
assert.ok(organization.includes('data-hub-member-row'), 'member rows must expose the visual release-gate marker');
assert.ok(organization.includes('flex flex-col gap-5 p-4 sm:p-5'), 'member identity and controls must stay in separate vertical regions');
assert.ok(organization.includes('flex w-full min-w-0 items-start gap-3'), 'member identity must own the full available row width');
assert.ok(organization.includes('data-hub-member-controls'), 'member controls must be isolated from identity');
assert.ok(organization.includes('border-t border-white/[0.06] pt-4'), 'member controls need clear hierarchy below identity');
assert.equal(organization.includes('text-xs text-[#A0A7B5] break-all\">{member.email}'), false, 'human member email must never use break-all');
assert.ok(organization.includes('min-w-[160px] max-w-full flex-1'), 'organization role selector must preserve usable width');
assert.ok(organization.includes('min-w-[220px] max-w-full flex-1'), 'ecosystem role selector must preserve usable width');
assert.ok(organization.includes('lg:flex-row lg:items-center lg:justify-between'), 'invite/access rows must wait for a genuinely wide content area');
assert.ok(organization.includes('authoritativeOwnerUid'), 'authoritative owner protection must remain');
assert.ok(organization.includes('getMemberRoleManagementOptions'), 'member role selector must use canonical policy');
assert.equal(organization.includes('<option value=\"leader\">'), false, 'legacy leader role must not return');
assert.equal(organization.includes('<option value=\"secretary\">'), false, 'legacy secretary role must not return');
assert.equal(organization.includes('<option value=\"guest\">'), false, 'legacy guest role must not return');
assert.ok(invite.includes('max-h-[calc(100dvh'), 'invite modal must remain bounded by dynamic viewport');
assert.ok(shell.includes('w-[min(22rem,calc(100vw-1rem))]'), 'app launcher must remain viewport-bounded');
assert.ok(shell.includes('max-w-[92px] min-[390px]:max-w-[128px]'), 'organization context must adapt around phone widths');

console.log('PASS Hub narrow viewport polish: human identity cannot collapse into vertical characters; admin controls wrap independently');
