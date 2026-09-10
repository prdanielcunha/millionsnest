import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const hero = readFileSync('src/components/Hero.tsx', 'utf8');
const navbar = readFileSync('src/components/Navbar.tsx', 'utf8');
const actionDemo = readFileSync('src/components/ActionOsShowcase.tsx', 'utf8');
const home = readFileSync('src/pages/Home.tsx', 'utf8');
const shell = readFileSync('src/components/EcosystemShell.tsx', 'utf8');
const workspace = readFileSync('src/components/dashboard/EcosystemWorkspaceHome.tsx', 'utf8');
const organization = readFileSync('src/components/OrganizationManager.tsx', 'utf8');

assert.match(hero, /max-w-\[1440px\]/, 'public hero must use the wider Design 3 canvas');
assert.match(hero, /max-w-6xl/, 'product workflow must become the dominant full-width hero visual');
assert.match(hero, /millionsnest\.com/, 'hero product stage must be presented like a premium product window');
assert.equal(hero.includes('xl:grid-cols-[1.08fr_.92fr]'), false, 'hero must no longer use the old split layout');
assert.equal(hero.includes('<video'), false, 'visible redesign must stay lightweight without background video');

assert.match(navbar, /fixed inset-x-0 top-3/, 'public navigation must use a floating shell');
assert.match(navbar, /rounded-\[24px\]/, 'public navigation must use the current premium glass radius');
assert.match(navbar, /backdrop-blur-\[28px\]/, 'public navigation must use a real high-fidelity glass blur');
assert.match(navbar, /backdrop-saturate-150/, 'public navigation glass must preserve saturation instead of reading as an opaque dark bar');

assert.match(home, /ActionOsShowcase/, 'public home must lazy-load the real Action OS showcase');
assert.match(hero, /#action-os-demo/, 'secondary hero CTA must lead directly to the current product demo');
assert.match(actionDemo, /type DemoDevice = "desktop" \| "tablet" \| "mobile"/, 'public demo must expose explicit desktop, tablet and mobile states');
assert.match(actionDemo, /action_demo_lane_today/, 'public demo must show the Today action lane');
assert.match(actionDemo, /action_demo_lane_changes/, 'public demo must show the Changes lane');
assert.match(actionDemo, /action_demo_lane_commitments/, 'public demo must show the preparation/commitments lane');
assert.match(actionDemo, /useReducedMotion/, 'public demo motion must respect reduced-motion accessibility');
assert.match(actionDemo, /matchMedia\("\(max-width: 639px\)"\)/, 'real phone viewport must explicitly force the mobile demo state');
assert.match(actionDemo, /effectiveDevice: DemoDevice = isNarrowViewport \? "mobile" : device/, 'hidden device selector must never leave a desktop sidebar active on a phone');

assert.match(shell, /sticky top-2/, 'Hub topbar must visibly float inside the workspace');
assert.match(shell, /rounded-\[20px\]/, 'Hub topbar must have the Design 3 rounded shell');

assert.match(workspace, /rounded-\[2rem\]/, 'Hub Home must use the large command deck');
assert.match(workspace, /onOpenInviteModal/, 'command deck must expose a direct team action');
assert.match(workspace, /onNavigateToOrganizationSettings/, 'command deck must expose organization management');
assert.match(workspace, /onNavigateToBilling/, 'command deck must expose billing when permitted');
assert.match(workspace, /MusicScale/, 'command deck must make the flagship app immediately visible');

assert.match(organization, /rounded-\[1\.75rem\]/, 'organization administration must use the new premium frame');
assert.match(organization, /bg-\[#08111D\]/, 'CEO administration mode must be visually distinct');
assert.match(organization, /bg-black\/15/, 'organization sidebar must read as a separate navigation surface');

console.log('PASS MillionsNest Design 3 visible overhaul: real responsive Action OS demo, premium glass navigation, Hub command deck and premium organization administration');
