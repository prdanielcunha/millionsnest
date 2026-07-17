import { execSync } from 'child_process';
import * as fs from 'fs';

console.log('Testing Support Hub and WhatsApp logic...\n');

let pass = true;

const assertCondition = (condition: boolean, passMsg: string, failMsg: string) => {
  if (!condition) {
    console.error(`❌ [FAIL] ${failMsg}`);
    pass = false;
  } else {
    console.log(`✅ [PASS] ${passMsg}`);
  }
};

const checkWhatsAppHardcodedNumber = () => {
  const files = [
    'src/components/support/SupportWhatsAppModal.tsx',
    'src/components/support/SupportHub.tsx',
    'src/services/supportClient.ts',
    'src/lib/supportContracts.ts',
    'src/packages/i18n/locales/pt.ts'
  ];

  for (const f of files) {
    if (fs.existsSync(f)) {
      const content = fs.readFileSync(f, 'utf-8');
      assertCondition(!content.includes('5543999907071'), `${f} does not contain hardcoded number`, `${f} contains hardcoded number 5543999907071`);
    }
  }
};

const checkCentralConfig = () => {
  const content = fs.readFileSync('src/server/config/supportConfig.ts', 'utf-8');
  assertCondition(content.includes('process.env.SUPPORT_WHATSAPP_NUMBER'), 'Central config uses env var', 'Central config missing env var mapping');
};

const checkRouteAdded = () => {
  const content = fs.readFileSync('server.ts', 'utf-8');
  assertCondition(content.includes('/api/v1/support/whatsapp-link'), 'WhatsApp route present', 'WhatsApp route missing');
};

const checkDashboardGlobalMount = () => {
  const content = fs.readFileSync('src/pages/Dashboard.tsx', 'utf-8');
  assertCondition(content.includes('import { SupportHubProvider } from "../components/support/SupportHubContext.js";'), 'Dashboard imports SupportHubProvider', 'Dashboard missing SupportHubProvider import');
  assertCondition(content.includes('import { SupportHub } from "../components/support/SupportHub.js";'), 'Dashboard imports SupportHub', 'Dashboard missing SupportHub import');
  
  const providerMatches = content.match(/<SupportHubProvider/g) || [];
  assertCondition(providerMatches.length === 1, 'Dashboard renders SupportHubProvider exactly once', 'Dashboard renders SupportHubProvider multiple times or not at all');
  
  const hubMatches = content.match(/<SupportHub \/>/g) || [];
  assertCondition(hubMatches.length === 1, 'Dashboard renders SupportHub exactly once', 'Dashboard renders SupportHub multiple times or not at all');
  
  const correctNesting = content.includes('<SupportHub />\n    </SupportHubProvider>') || content.includes('<SupportHub />\r\n    </SupportHubProvider>');
  assertCondition(correctNesting, 'SupportHub is inside SupportHubProvider', 'SupportHub is NOT properly inside SupportHubProvider');
};

const checkContextControl = () => {
  const context = fs.readFileSync('src/components/support/SupportHubContext.tsx', 'utf-8');
  assertCondition(context.includes('hubOpen: boolean;'), 'Context has hubOpen', 'Context missing hubOpen');
  assertCondition(context.includes('openHub: () => void;'), 'Context has openHub', 'Context missing openHub');
  assertCondition(context.includes('closeHub: () => void;'), 'Context has closeHub', 'Context missing closeHub');
  assertCondition(context.includes('toggleHub: () => void;'), 'Context has toggleHub', 'Context missing toggleHub');
  
  assertCondition(context.includes('setHubOpen(false)') && context.includes('setRequestOpen(false)') && context.includes('setWhatsappOpen(false)') && context.includes('setGuideOpen(false)'), 'closeSupport closes hub', 'closeSupport does not close all');
  
  assertCondition(context.includes('const openRequest = () => {\n    setHubOpen(false);'), 'openRequest closes hubOpen', 'openRequest does not close hubOpen');
  assertCondition(context.includes('const openWhatsApp = () => {\n    setHubOpen(false);'), 'openWhatsApp closes hubOpen', 'openWhatsApp does not close hubOpen');
  assertCondition(context.includes('const openCurrentGuide = () => {\n    setHubOpen(false);'), 'openCurrentGuide closes hubOpen', 'openCurrentGuide does not close hubOpen');
  
  const hub = fs.readFileSync('src/components/support/SupportHub.tsx', 'utf-8');
  assertCondition(!hub.includes('const [isOpen, setIsOpen]'), 'SupportHub does not have local isOpen state', 'SupportHub has local isOpen state');
  assertCondition(hub.includes('const { hubOpen, openHub, closeHub, toggleHub') || hub.includes('hubOpen'), 'SupportHub uses hubOpen from context', 'SupportHub does not use hubOpen');
  assertCondition(hub.includes("if (e.key === 'Escape') closeHub();"), 'Escape calls closeHub', 'Escape does not call closeHub');
  assertCondition(hub.includes("closeHub();") && hub.includes('mousedown'), 'Click outside calls closeHub', 'Click outside does not call closeHub');
};

const checkCentralPanel = () => {
  const content = fs.readFileSync('src/components/dashboard/EcosystemWorkspaceHome.tsx', 'utf-8');
  assertCondition(content.includes('openHub') && content.includes('useSupportHub()'), 'EcosystemWorkspaceHome uses openHub', 'EcosystemWorkspaceHome does not use openHub');
  assertCondition(content.includes('support.hub.central_action.title'), 'Exists central action title', 'Missing central action title');
  assertCondition(content.includes('support.hub.central_action.aria'), 'Exists central action aria', 'Missing central action aria');
  assertCondition(content.includes('onClick={openHub}'), 'Central action calls openHub', 'Central action does not call openHub');
  assertCondition(content.includes('onClick={openRequest}'), 'Preciso de ajuda calls openRequest', 'Preciso de ajuda does not call openRequest');
};

const checkRoutesDetection = () => {
  const context = fs.readFileSync('src/components/support/SupportHubContext.tsx', 'utf-8');
  assertCondition(context.includes("resolveSupportAppId"), 'resolveSupportAppId present', 'resolveSupportAppId missing');
  assertCondition(context.includes("pathname.startsWith('/dashboard/apps/musicscale')"), 'Recognizes musicscale route', 'Does not recognize musicscale route');
  assertCondition(context.includes("pathname.startsWith('/dashboard/apps/nestfinance')"), 'Recognizes nestfinance route', 'Does not recognize nestfinance route');
  assertCondition(context.includes("return 'core'"), 'Other routes return core', 'Other routes do not return core');
  assertCondition(!context.includes("if (location.pathname.startsWith('/musicscale')) currentAppId = 'musicscale'"), 'Removed incorrect route startswith musicscale', 'Incorrect route musicscale still present');
};

const checkGuidesRoutes = () => {
  const registry = fs.readFileSync('src/lib/supportGuideRegistry.ts', 'utf-8');
  assertCondition(registry.includes("pathname === '/dashboard/apps/musicscale' && searchParams.get('section') === 'resources'"), 'Resources uses section=resources', 'Resources match incorrect');
  assertCondition(registry.includes("pathname === '/dashboard/apps/musicscale' && searchParams.get('section') === 'getting-started'"), 'Getting started uses section=getting-started', 'Getting started match incorrect');
  assertCondition(registry.includes("pathname === '/dashboard/organization/members'"), 'Team uses /dashboard/organization/members', 'Team match incorrect');
  assertCondition(registry.includes("pathname === '/dashboard/billing'"), 'Billing uses /dashboard/billing', 'Billing match incorrect');
  assertCondition(registry.includes("params.pathname === '/dashboard/overview'"), 'Overview returns null', 'Overview does not return null');
  assertCondition(!registry.includes("pathname.includes('/musicscale/resources')"), 'Removed /musicscale/resources', 'Still has /musicscale/resources');
  assertCondition(!registry.includes("pathname.includes('/settings/team')"), 'Removed /settings/team', 'Still has /settings/team');
  assertCondition(!registry.includes("pathname.includes('/settings/billing')"), 'Removed /settings/billing', 'Still has /settings/billing');
};

const checkI18n = () => {
  const pt = fs.readFileSync('src/packages/i18n/locales/pt.ts', 'utf-8');
  const en = fs.readFileSync('src/packages/i18n/locales/en.ts', 'utf-8');
  const es = fs.readFileSync('src/packages/i18n/locales/es.ts', 'utf-8');
  
  assertCondition(pt.includes('central_action'), 'PT has central_action', 'PT missing central_action');
  assertCondition(en.includes('central_action'), 'EN has central_action', 'EN missing central_action');
  assertCondition(es.includes('central_action'), 'ES has central_action', 'ES missing central_action');
};

console.log('--- Static Checks ---');
checkWhatsAppHardcodedNumber();
checkCentralConfig();
checkRouteAdded();
checkDashboardGlobalMount();
checkContextControl();
checkCentralPanel();
checkRoutesDetection();
checkGuidesRoutes();
checkI18n();

console.log('\nFinal Result:', pass ? '✅ PASSED' : '❌ FAILED');

if (!pass) {
  process.exit(1);
}
