from pathlib import Path


def replace_exact(path: str, old: str, new: str, expected: int = 1):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    actual = text.count(old)
    if actual != expected:
        raise SystemExit(f'{path}: expected {expected} occurrences, found {actual}: {old[:120]!r}')
    p.write_text(text.replace(old, new), encoding='utf-8')


org = 'src/components/OrganizationManager.tsx'
replace_exact(
    org,
    "<div key={member.id} className={`flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between ${i !== members.length - 1 ? 'border-b border-white/5' : ''}`}>",
    "<div key={member.id} data-hub-member-row className={`flex flex-col gap-5 p-4 sm:p-5 ${i !== members.length - 1 ? 'border-b border-white/5' : ''}`}>",
)
replace_exact(
    org,
    '<div className="flex w-full min-w-0 items-start gap-3 sm:flex-1">',
    '<div className="flex w-full min-w-0 items-start gap-3">',
)
replace_exact(
    org,
    '<span className="text-xs text-[#A0A7B5] break-all">{member.email}</span>',
    '<span title={member.email || \'\'} className="block max-w-full truncate text-xs text-[#A0A7B5]">{member.email}</span>',
)
replace_exact(
    org,
    '<div className="flex w-full min-w-0 flex-wrap items-center gap-2.5 sm:w-auto sm:justify-end">',
    '<div data-hub-member-controls className="flex w-full min-w-0 flex-wrap items-end gap-3 border-t border-white/[0.06] pt-4">',
)
replace_exact(
    org,
    'className={`h-8 px-3 rounded-full border inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.08em] transition-all ${',
    'className={`min-h-[40px] px-3.5 rounded-xl border inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.08em] transition-all ${',
)
replace_exact(
    org,
    'className="min-w-0 max-w-full flex-1 sm:flex-none bg-[#0B0F19] border border-white/10 text-[#F5F7FA] text-xs font-medium rounded-lg px-3 py-2 outline-none focus:border-[#2B85EB] disabled:opacity-50 disabled:cursor-not-allowed"',
    'className="min-h-[40px] min-w-[160px] max-w-full flex-1 bg-[#0B0F19] border border-white/10 text-[#F5F7FA] text-xs font-medium rounded-xl px-3 py-2 outline-none focus:border-[#2B85EB] disabled:opacity-50 disabled:cursor-not-allowed"',
)
replace_exact(
    org,
    '<div className="flex w-full min-w-0 items-center gap-2 rounded-xl border border-[#2B85EB]/15 bg-[#2B85EB]/[0.045] px-2.5 py-2 sm:w-auto">',
    '<div className="flex min-h-[40px] min-w-[220px] max-w-full flex-1 items-center gap-2 rounded-xl border border-[#2B85EB]/15 bg-[#2B85EB]/[0.045] px-2.5 py-2">',
)
replace_exact(
    org,
    'className="min-w-0 flex-1 rounded-lg border border-white/[0.08] bg-[#080B10] px-2.5 py-1.5 text-[11px] font-semibold text-[#F5F7FA] outline-none focus:border-[#2B85EB] disabled:cursor-not-allowed disabled:opacity-60 sm:min-w-[170px]"',
    'className="min-w-[150px] flex-1 rounded-lg border border-white/[0.08] bg-[#080B10] px-2.5 py-1.5 text-[11px] font-semibold text-[#F5F7FA] outline-none focus:border-[#2B85EB] disabled:cursor-not-allowed disabled:opacity-60"',
)
replace_exact(
    org,
    'onClick={() => onEditMember(member)}\n                                   className="text-xs text-[#A0A7B5] hover:text-[#F5F7FA] font-medium p-1.5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed rounded bg-white/5 hover:bg-white/10"',
    'onClick={() => onEditMember(member)}\n                                   aria-label={`Editar ${member.displayName || member.email || \'membro\'}`}\n                                   title="Editar pessoa"\n                                   className="min-h-[40px] min-w-[40px] text-xs text-[#A0A7B5] hover:text-[#F5F7FA] font-medium p-2 transition-colors disabled:opacity-30 disabled:cursor-not-allowed rounded-xl bg-white/5 hover:bg-white/10"',
)
replace_exact(
    org,
    'className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border border-[#2B85EB]/25 bg-[#2B85EB]/10 text-[#6EAFFF] hover:bg-[#2B85EB]/15 transition-colors"',
    'className="min-h-[40px] text-[11px] font-semibold px-3 py-2 rounded-xl border border-[#2B85EB]/25 bg-[#2B85EB]/10 text-[#6EAFFF] hover:bg-[#2B85EB]/15 transition-colors"',
)
replace_exact(
    org,
    'className="text-xs text-red-500/70 hover:text-red-500 font-medium px-2 py-1.5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"',
    'className="min-h-[40px] text-xs text-red-400/80 hover:text-red-300 font-medium px-3 py-2 rounded-xl hover:bg-red-500/[0.06] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"',
)
replace_exact(
    org,
    "className={`flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between ${i !== pendingInvites.length - 1 ? 'border-b border-white/5' : ''}`}",
    "className={`flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between ${i !== pendingInvites.length - 1 ? 'border-b border-white/5' : ''}`}",
)
replace_exact(
    org,
    '<span className="text-xs text-[#A0A7B5] break-all">{invite.email || invite.emailNormalized || \'E-mail protegido\'}</span>',
    '<span className="text-xs text-[#A0A7B5] break-words [overflow-wrap:anywhere]">{invite.email || invite.emailNormalized || \'E-mail protegido\'}</span>',
)
replace_exact(
    org,
    'className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end"',
    'className="flex w-full flex-wrap gap-2 lg:w-auto lg:justify-end"',
    expected=2,
)
replace_exact(
    org,
    "className={`flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between ${i !== joinRequests.length - 1 ? 'border-b border-white/5' : ''}`}",
    "className={`flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between ${i !== joinRequests.length - 1 ? 'border-b border-white/5' : ''}`}",
)
replace_exact(
    org,
    '<span className="text-xs text-[#A0A7B5] break-all">{req.email || req.id}</span>',
    '<span className="text-xs text-[#A0A7B5] break-words [overflow-wrap:anywhere]">{req.email || req.id}</span>',
)
replace_exact(
    org,
    '<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">',
    '<div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">',
)
replace_exact(
    org,
    '<div className="flex flex-col sm:flex-row gap-2 shrink-0">',
    '<div className="flex flex-col lg:flex-row gap-2 shrink-0">',
)

dashboard = 'src/pages/Dashboard.tsx'
replace_exact(
    dashboard,
    '<p className="text-base font-semibold text-[#F5F7FA] break-all">{user.email}</p>',
    '<p className="text-base font-semibold text-[#F5F7FA] break-words [overflow-wrap:anywhere]">{user.email}</p>',
)

Path('scripts/test_hub_narrow_viewports.ts').write_text("""import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const dashboard = readFileSync('src/pages/Dashboard.tsx', 'utf8');
const organization = readFileSync('src/components/OrganizationManager.tsx', 'utf8');
const invite = readFileSync('src/components/InviteModal.tsx', 'utf8');
const shell = readFileSync('src/components/EcosystemShell.tsx', 'utf8');

assert.ok(dashboard.includes('break-words [overflow-wrap:anywhere]\\\">{user.email}'), 'account email must wrap naturally instead of breaking character-by-character');
assert.ok(dashboard.includes('min-w-0 flex-1 w-full'), 'profile editing must let the input shrink beside save/cancel actions');
assert.ok(dashboard.includes('break-words\\\">{profileNameInput'), 'long display names must wrap instead of overflowing');
assert.ok(dashboard.includes('md:hidden fixed inset-x-0 bottom-0'), 'mobile navigation must remain fixed and independent from desktop tabs');
assert.ok(organization.includes('data-hub-member-row'), 'member rows must expose the visual release-gate marker');
assert.ok(organization.includes('flex flex-col gap-5 p-4 sm:p-5'), 'member identity and controls must stay in separate vertical regions');
assert.ok(organization.includes('flex w-full min-w-0 items-start gap-3'), 'member identity must own the full available row width');
assert.ok(organization.includes('data-hub-member-controls'), 'member controls must be isolated from identity');
assert.ok(organization.includes('border-t border-white/[0.06] pt-4'), 'member controls need clear hierarchy below identity');
assert.equal(organization.includes('text-xs text-[#A0A7B5] break-all\\\">{member.email}'), false, 'human member email must never use break-all');
assert.ok(organization.includes('min-w-[160px] max-w-full flex-1'), 'organization role selector must preserve usable width');
assert.ok(organization.includes('min-w-[220px] max-w-full flex-1'), 'ecosystem role selector must preserve usable width');
assert.ok(organization.includes('lg:flex-row lg:items-center lg:justify-between'), 'invite/access rows must wait for a genuinely wide content area');
assert.ok(organization.includes('authoritativeOwnerUid'), 'authoritative owner protection must remain');
assert.ok(organization.includes('getMemberRoleManagementOptions'), 'member role selector must use canonical policy');
assert.equal(organization.includes('<option value=\\\"leader\\\">'), false, 'legacy leader role must not return');
assert.equal(organization.includes('<option value=\\\"secretary\\\">'), false, 'legacy secretary role must not return');
assert.equal(organization.includes('<option value=\\\"guest\\\">'), false, 'legacy guest role must not return');
assert.ok(invite.includes('max-h-[calc(100dvh'), 'invite modal must remain bounded by dynamic viewport');
assert.ok(shell.includes('w-[min(22rem,calc(100vw-1rem))]'), 'app launcher must remain viewport-bounded');
assert.ok(shell.includes('max-w-[92px] min-[390px]:max-w-[128px]'), 'organization context must adapt around phone widths');

console.log('PASS Hub narrow viewport polish: human identity cannot collapse into vertical characters; admin controls wrap independently');
""", encoding='utf-8')

Path('scripts/test_hub_visual_release_gate.ts').write_text("""import assert from 'node:assert/strict';
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

assert.equal(organization.includes('break-all\\\">{member.email}'), false, 'member email cannot use break-all');
assert.ok(organization.includes('data-hub-member-row'), 'member rows must remain structurally identifiable');
assert.ok(organization.includes('data-hub-member-controls'), 'member controls must remain separated from identity');
assert.equal(organization.includes('data-hub-member-row className={`flex flex-col gap-4 p-4 sm:flex-row'), false, 'member rows cannot switch horizontal at viewport sm');
assert.ok(dashboard.includes('[overflow-wrap:anywhere]\\\">{user.email}'), 'account email must stay readable');
assert.ok(invite.includes('max-h-[calc(100dvh'), 'invite modal must use dynamic viewport height');
assert.ok(invite.includes('w-full sm:max-w-md'), 'invite modal must fit phones');
assert.ok(shell.includes('w-[min(22rem,calc(100vw-1rem))]'), 'launcher must not overflow viewport');
assert.ok(shell.includes('w-[min(18rem,calc(100vw-1rem))]'), 'organization switcher must not overflow viewport');
const tableCount = (admin.match(/<table\\b/g) || []).length;
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
""", encoding='utf-8')

qa = '.github/workflows/millionsnest-qa.yml'
replace_exact(
    qa,
    "      - name: Hub narrow viewport polish\n        run: npx tsx scripts/test_hub_narrow_viewports.ts\n",
    "      - name: Hub narrow viewport polish\n        run: npx tsx scripts/test_hub_narrow_viewports.ts\n\n      - name: Hub visual release gate\n        run: npx tsx scripts/test_hub_visual_release_gate.ts\n",
)

design = 'docs/DESIGN_LANGUAGE.md'
replace_exact(
    design,
    '## 7. Overlays e Modais\n',
    '## 7. Responsividade e identidade humana\n\n- Breakpoints devem considerar a largura **útil do container**, não apenas a largura total da janela. Em áreas com sidebar, nunca compacte identidade humana para preservar controles administrativos na mesma linha.\n- Nome, e-mail, organização e outros identificadores humanos não usam `break-all`. Prefira `truncate` com `title`, `break-words` ou `overflow-wrap:anywhere`, conforme o contexto.\n- Listas administrativas com muitos controles devem separar visualmente **identidade** e **ações/permissões**, permitindo wrap independente.\n- Nenhuma superfície visível ao cliente é considerada pronta só porque TypeScript/build passaram; ela precisa cumprir o Visual Release Gate.\n\n## 8. Overlays e Modais\n',
)

blueprint = 'docs/MILLIONSNEST_ACTION_OS_BLUEPRINT_2026.md'
replace_exact(
    blueprint,
    '## 23. Immediate next step\n\n1. Promote the certified 7-day preparation / managed-response capability release through `main` and then `production` only after CI is clean.\n',
    '## 23. Immediate next step\n\n0. Complete the Hub Visual Release Gate before any new commercial promotion: members/roles, account, app launcher, invitations, sales landing, guided demo, checkout and admin data surfaces must be readable and bounded across narrow, tablet and desktop layouts. Human identity must never collapse to character-by-character vertical text.\n1. Promote the certified 7-day preparation / managed-response capability release through `main` and then `production` only after CI is clean and the Visual Release Gate is green.\n',
)

Path('docs/HUB_VISUAL_RELEASE_GATE.md').write_text("""# MillionsNest Hub — Visual Release Gate

Status: **required before commercial-ready certification**.

The Hub is not considered ready for sale merely because build, TypeScript and domain tests pass. Customer-facing UI must also survive realistic content and viewport pressure.

## Mandatory surfaces

- Public MillionsNest home and navigation.
- `/musicscale` sales landing, product proof and guided demo.
- Login / join / invitation flows.
- Checkout, billing success and payment/cancellation states.
- Hub overview, Actions/Hoje, Commitments and Changes.
- App launcher and organization switcher.
- Account/profile management.
- Organization administration: settings, members & invitations, roles & permissions, applications, subscription entry point, activity/security.
- Invite modal, member edit and ownership transfer states.
- Ecosystem admin data tables and diagnostics.

## Viewport matrix

Every release candidate must be checked at approximately 320, 390, 430, 768/834, 1024, 1280 and 1440 CSS pixels. Test long names, long e-mails, long organization names, PT/EN/ES, one item and many items.

## Non-negotiable rules

1. No unintended page-level horizontal scroll.
2. No clipped primary action.
3. Human identity never collapses into one-character-per-line text.
4. Controls wrap independently from identity.
5. Primary touch actions remain approximately 40–44 px high.
6. Modals are bounded by `100dvh` and safe-area aware on mobile.
7. Tables either adapt or live inside explicit horizontal overflow containers.
8. Destructive actions are visually distinct from routine role/settings controls.
9. Technical IDs may wrap aggressively only inside explicitly technical/admin detail areas.
10. A structural regression test accompanies every discovered visual failure.

## Current P0 regression

The Members & Invitations view previously changed to a horizontal member row at the viewport-level `sm` breakpoint while the administration sidebar had already consumed a large portion of the usable width. The identity column then shrank to only a few pixels and `break-all` rendered names/e-mails as vertical characters. The release gate now requires identity and controls to occupy separate regions and forbids `break-all` for member e-mail.

## Certification rule

Structural CI is necessary but not sufficient. Before promoting a visual release to production, review the affected surfaces in a real browser at the viewport matrix above. If any primary customer path looks improvised, crowded, clipped or materially inconsistent with `DESIGN_LANGUAGE.md`, the release remains blocked.
""", encoding='utf-8')
