import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveHubAppCatalog, resolveHubAppExperience } from '../src/lib/hubAppExperience.js';
import { ECOSYSTEM_APPS } from '../src/lib/apps.js';

const dashboard = readFileSync('src/pages/Dashboard.tsx', 'utf8');
const workspace = readFileSync('src/components/dashboard/EcosystemWorkspaceHome.tsx', 'utf8');
const shell = readFileSync('src/components/EcosystemShell.tsx', 'utf8');
const organization = readFileSync('src/components/OrganizationManager.tsx', 'utf8');
const invite = readFileSync('src/components/InviteModal.tsx', 'utf8');
const support = readFileSync('src/components/support/SupportHub.tsx', 'utf8');
const supportContext = readFileSync('src/components/support/SupportHubContext.tsx', 'utf8');
const css = readFileSync('src/index.css', 'utf8');
const locales = ['pt', 'en', 'es'].map(lang => readFileSync('src/packages/i18n/locales/' + lang + '.ts', 'utf8'));

const musicScale = ECOSYSTEM_APPS.find(app => app.id === 'musicscale');
assert.ok(musicScale, 'MusicScale must exist in the app catalog');

const activeMusicScale = resolveHubAppExperience({
  app: musicScale!,
  organization: { apps: { musicscale: { plan: 'pro' } } },
  subscription: { plan: 'pro' },
  musicScaleAccess: { accessible: true, catalogState: 'active' },
  isGlobalAdmin: false
});
assert.equal(activeMusicScale.installed, true);
assert.equal(activeMusicScale.canOpen, true);
assert.equal(activeMusicScale.plan, 'pro');

const fakeFutureApp = {
  id: 'future-app',
  name: 'Future App',
  description: 'Future',
  icon: 'Grid',
  status: 'coming_soon',
  primaryAction: 'disabled',
  category: 'beta',
  requiredPlan: 'free'
} as any;
const futureExperience = resolveHubAppExperience({
  app: fakeFutureApp,
  organization: { enabledApps: ['future-app'], apps: { 'future-app': { enabled: true, status: 'active' } } },
  musicScaleAccess: null
});
assert.equal(futureExperience.installed, false, 'catalog coming-soon state must prevent accidental activation');

const secondActiveApp = {
  ...fakeFutureApp,
  id: 'second-active',
  name: 'Second Active',
  status: 'active',
  category: 'core',
  primaryAction: 'open'
} as any;
const secondExperience = resolveHubAppExperience({
  app: secondActiveApp,
  organization: { enabledApps: ['second-active'], apps: { 'second-active': { enabled: true, status: 'active', plan: 'starter' } } },
  musicScaleAccess: null
});
assert.equal(secondExperience.installed, true);
assert.equal(secondExperience.plan, 'starter');

const catalog = resolveHubAppCatalog([musicScale!, secondActiveApp], {
  organization: {
    enabledApps: ['second-active'],
    apps: {
      musicscale: { plan: 'pro' },
      'second-active': { enabled: true, status: 'active', plan: 'starter' }
    }
  },
  subscription: { plan: 'pro' },
  musicScaleAccess: { accessible: true, catalogState: 'active' },
  isGlobalAdmin: false
});
assert.equal(catalog.filter(item => item.installed).length, 2, 'Hub must support multiple active apps simultaneously');

assert.match(dashboard, /resolveHubAppCatalog/, 'Dashboard must use the canonical multi-app resolver');
assert.equal(dashboard.includes("if (app.id === 'nestfinance') return false"), false, 'Dashboard must not hardcode-exclude NestFinance');
assert.match(dashboard, /appExperiences=\{hubAppCatalog\}/, 'Home must receive canonical app experiences');
assert.match(dashboard, /installedAppIds=\{installedAppExperiences\.map/, 'Shell must receive canonical installed apps');
assert.match(dashboard, /Por aplicativo/, 'Billing must show an app-by-app overview');
assert.match(dashboard, /Planos e assinaturas/, 'Billing copy must describe plural app subscriptions');
assert.equal(dashboard.includes('ID Central</p>'), false, 'regular account UI must not expose raw central IDs');
assert.equal(dashboard.includes('Org ID:'), false, 'organization fallback must not expose raw IDs');
assert.match(dashboard, /Detalhes técnicos da conta/, 'technical IDs may remain progressively disclosed for global admins');
assert.match(dashboard, /md:hidden fixed inset-x-0 bottom-0/, 'Hub must have a mobile-native bottom navigation');
assert.match(dashboard, /hidden md:block bg-\[#050505\]/, 'desktop secondary navigation must not be compressed onto mobile');
assert.equal((dashboard.match(/Catálogo de Aplicativos/g) || []).length, 0, 'legacy duplicate app catalog must be removed from Dashboard Home');

assert.match(workspace, /operationalApps/, 'Home must aggregate operational apps');
assert.match(workspace, /Central de gestão/, 'Home must expose shared administration');
assert.match(workspace, /renderGenericAppWorkspace/, 'non-MusicScale apps must receive a full management workspace');
assert.match(workspace, /hubSummary/, 'generic apps must support bounded live summary projections');
assert.match(workspace, /installedApps\.length <= 1/, 'single-app users should avoid unnecessary navigation chrome');
assert.match(workspace, /installedApps\.map/, 'multi-app users must get a scalable quick-access selector');

assert.match(shell, /installedAppIds\?: string\[\]/, 'Shell must accept canonical installed app IDs');
assert.match(shell, /launcherApps = ECOSYSTEM_APPS\.filter/, 'launcher must derive visible apps from canonical installed IDs');
assert.equal(shell.includes('{ECOSYSTEM_APPS.map(app =>'), false, 'launcher must not display the whole catalog as disabled clutter');
assert.match(shell, /w-\[min\(22rem,calc\(100vw-1rem\)\)\]/, 'app launcher must remain inside narrow viewports');
assert.match(shell, /sm:hidden w-9 h-9/, 'mobile topbar must use compact search action');
assert.match(shell, /to="\/dashboard\/overview"/, 'shell home action must return directly to Hub Home');

assert.match(organization, /HubAppExperience/, 'organization app administration must use canonical app experience');
assert.match(organization, /appExperiences as HubAppExperience/, 'organization apps tab must render app experiences');
assert.equal(organization.includes('A disponibilidade deste aplicativo é controlada pelo seu plano.'), false, 'raw generic enabled-app placeholder must be removed');
assert.match(organization, /overflow-x-auto md:overflow-visible no-scrollbar/, 'organization management tabs must work on small screens');

assert.match(invite, /100dvh/, 'invite dialog must respect dynamic mobile viewport height');
assert.match(invite, /aria-modal="true"/, 'invite dialog must expose modal semantics');
assert.match(invite, /items-end sm:items-center/, 'invite flow must use bottom-sheet behavior on small screens');

assert.match(support, /env\(safe-area-inset-bottom\)\+76px/, 'support trigger must clear mobile bottom navigation');
assert.match(supportContext, /ECOSYSTEM_APPS\.some/, 'support context must resolve any registered app');

assert.match(css, /min-width: 320px/, 'Hub must support narrow phone widths');
assert.match(css, /100dvh/, 'Hub must use dynamic viewport units');
assert.match(css, /prefers-reduced-motion/, 'Hub must respect reduced-motion settings');
assert.match(css, /font-size: 16px/, 'mobile form controls must avoid iOS focus zoom');

for (const locale of locales) {
  for (const key of [
    'home_eyebrow',
    'apps_kicker',
    'app_state',
    'management_title',
    'activity_title',
    'manage_this_app',
    'app_payment_title',
    'all_good_title'
  ]) {
    assert.ok(locale.includes(key + ':'), 'missing premium multi-app i18n key: ' + key);
  }
}

console.log('PASS premium multi-app Hub: canonical app access, novice UX, app-specific billing, responsive navigation and cross-platform safety');
