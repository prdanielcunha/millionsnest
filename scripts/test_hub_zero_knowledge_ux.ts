import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const dashboard = readFileSync('src/pages/Dashboard.tsx', 'utf8');
const workspace = readFileSync('src/components/dashboard/EcosystemWorkspaceHome.tsx', 'utf8');
const guide = readFileSync('src/components/dashboard/MusicScaleGuideCenter.tsx', 'utf8');
const shell = readFileSync('src/components/EcosystemShell.tsx', 'utf8');
const locales = [
  readFileSync('src/packages/i18n/locales/pt.ts', 'utf8'),
  readFileSync('src/packages/i18n/locales/en.ts', 'utf8'),
  readFileSync('src/packages/i18n/locales/es.ts', 'utf8')
];

for (const locale of locales) {
  for (const key of [
    'public_page_label',
    'next_step',
    'payment_title',
    'invite_title',
    'open_title',
    'guidance_title',
    'guidance_ready',
    'guidance_org',
    'guidance_team',
    'do_in_ms'
  ]) {
    assert.match(locale, new RegExp('\\b' + key + '\\b'), 'missing zero-knowledge/i18n key: ' + key);
  }
}

assert.match(workspace, /nextStep/, 'hub home must derive a contextual next action');
assert.match(workspace, /Próximo passo/, 'hub home must make the next action explicit');
assert.match(workspace, /selectedWorkspace === 'home' && installedApps.length <= 1/, 'single-app customers should not get redundant workspace navigation');
assert.equal(workspace.includes('slug:'), false, 'customer UI must not expose the slug jargon');
assert.equal(workspace.includes('Vagas preenchidas'), false, 'seat usage must be described in human terms');

assert.match(dashboard, /humanizeAuditAction/, 'customer activity must translate internal audit events');
assert.equal(dashboard.includes('{log.action}'), false, 'raw audit action names must not be rendered');
assert.equal(dashboard.includes('Stripe Gateway'), false, 'billing recovery must not expose provider plumbing');
assert.equal(dashboard.includes('Validação em Tempo Real'), false, 'billing recovery must not use technical validation language');
assert.equal(dashboard.includes('Foto do Membro (URL)'), false, 'photo URL must not be the primary member-edit experience');
assert.equal(dashboard.includes('Painel Central do Sistema'), false, 'hub subtitle must be customer-oriented');

assert.equal(shell.includes('>Ecosystem<'), false, 'customer breadcrumb must use the MillionsNest brand');
assert.equal(shell.includes('Módulos do Ecossistema'), false, 'app launcher must use plain language');
assert.match(shell, /to="\/dashboard\/account"/, 'profile menu must open the actual account page');
assert.match(shell, /Atualize a página; se continuar, fale com o suporte/, 'non-admin repair guidance must stay human and safe');

const gettingStartedPosition = guide.indexOf("onSelectSection('getting-started')");
const resourcesPosition = guide.indexOf("onSelectSection('resources')");
assert.ok(gettingStartedPosition > -1 && resourcesPosition > -1 && gettingStartedPosition < resourcesPosition, 'Getting Started should appear before Resources for first-time users');
assert.match(guide, /Próxima etapa/, 'guide should identify the next step');
assert.match(guide, /Faça no MusicScale/, 'guide should use action language instead of vague continuation');

console.log('PASS Hub zero-knowledge UX, plain language, guided actions, and i18n contract');
