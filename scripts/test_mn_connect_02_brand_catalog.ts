import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { ECOSYSTEM_APPS, getAvailableApps, getInstalledApps } from '../src/lib/apps.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('--- TEST MN CONNECT 02 BRAND CATALOG ---');

let pass = true;

const assertCondition = (condition: boolean, passMsg: string, failMsg: string) => {
  if (!condition) {
    console.error(`❌ [FAIL] ${failMsg}`);
    pass = false;
  } else {
    console.log(`✅ [PASS] ${passMsg}`);
  }
};

// 1. Check connect entry in ECOSYSTEM_APPS
const checkConnectEntry = () => {
  const connectApp = ECOSYSTEM_APPS.find(app => app.id === 'connect');
  assertCondition(!!connectApp, 'App connect is defined in ECOSYSTEM_APPS', 'App connect not found in ECOSYSTEM_APPS');
  if (connectApp) {
    assertCondition(
      connectApp.iconAsset === '/brand/connect/v2/connect-mark-color.svg',
      `App connect has correct iconAsset: ${connectApp.iconAsset}`,
      `App connect does not have correct iconAsset: ${connectApp.iconAsset}`
    );
    assertCondition(
      connectApp.name === 'MillionsNest Connect',
      'App name is MillionsNest Connect',
      `App name is incorrect: ${connectApp.name}`
    );
  }
};

// 2. Check physical existence of the brand SVG asset and its structure
const checkPhysicalSVGAsset = () => {
  const svgPath = path.join(__dirname, '../public/brand/connect/v2/connect-mark-color.svg');
  const exists = fs.existsSync(svgPath);
  assertCondition(exists, 'Official SVG asset exists at /public/brand/connect/v2/connect-mark-color.svg', 'SVG asset not found on filesystem');
  if (exists) {
    const content = fs.readFileSync(svgPath, 'utf-8');
    assertCondition(content.startsWith('<svg'), 'SVG file starts with <svg', `SVG file starts with incorrect text: ${content.substring(0, 10)}`);
    assertCondition(content.includes('connect-gradient'), 'SVG file contains gradient id "connect-gradient"', 'SVG file missing required linear gradient definition');
    assertCondition(content.includes('viewBox="0 0 1000 1000"'), 'SVG has correct 1000x1000 viewBox', 'SVG viewBox is incorrect');
  }
};

// 3. Verify component usage of EcosystemAppIcon
const checkComponentUsage = () => {
  const navbarPath = path.join(__dirname, '../src/components/Navbar.tsx');
  const dashboardPath = path.join(__dirname, '../src/pages/Dashboard.tsx');
  const workspacePath = path.join(__dirname, '../src/components/dashboard/EcosystemWorkspaceHome.tsx');

  if (fs.existsSync(navbarPath)) {
    const content = fs.readFileSync(navbarPath, 'utf-8');
    assertCondition(content.includes('EcosystemAppIcon'), 'Navbar.tsx imports/uses EcosystemAppIcon', 'Navbar.tsx does not use EcosystemAppIcon');
    assertCondition(!content.includes("app.icon === 'Music' ? Music :"), 'Navbar.tsx removed old manual icon-to-lucide mapping logic', 'Navbar.tsx still contains deprecated manual mapping logic');
  } else {
    console.error(`Navbar.tsx not found at: ${navbarPath}`);
    pass = false;
  }

  if (fs.existsSync(dashboardPath)) {
    const content = fs.readFileSync(dashboardPath, 'utf-8');
    assertCondition(content.includes('EcosystemAppIcon'), 'Dashboard.tsx imports/uses EcosystemAppIcon', 'Dashboard.tsx does not use EcosystemAppIcon');
    assertCondition(!content.includes("app.icon === 'Music' ? Music :"), 'Dashboard.tsx removed old manual icon-to-lucide mapping logic', 'Dashboard.tsx still contains deprecated manual mapping logic');
  } else {
    console.error(`Dashboard.tsx not found at: ${dashboardPath}`);
    pass = false;
  }

  if (fs.existsSync(workspacePath)) {
    const content = fs.readFileSync(workspacePath, 'utf-8');
    assertCondition(content.includes('EcosystemAppIcon'), 'EcosystemWorkspaceHome.tsx imports/uses EcosystemAppIcon', 'EcosystemWorkspaceHome.tsx does not use EcosystemAppIcon');
  } else {
    console.error(`EcosystemWorkspaceHome.tsx not found at: ${workspacePath}`);
    pass = false;
  }
};

// 4. Verify component source structure of EcosystemAppIcon.tsx
const checkIconComponentImplementation = () => {
  const iconCompPath = path.join(__dirname, '../src/components/apps/EcosystemAppIcon.tsx');
  const exists = fs.existsSync(iconCompPath);
  assertCondition(exists, 'EcosystemAppIcon.tsx exists', 'EcosystemAppIcon.tsx is missing');
  if (exists) {
    const content = fs.readFileSync(iconCompPath, 'utf-8');
    assertCondition(content.includes('app.iconAsset'), 'EcosystemAppIcon uses iconAsset condition', 'EcosystemAppIcon missing iconAsset support');
    assertCondition(content.includes('<img'), 'EcosystemAppIcon renders <img /> tag when iconAsset is present', 'EcosystemAppIcon does not render <img /> tag');
    assertCondition(content.includes('draggable={false}'), 'EcosystemAppIcon configures draggable={false} on img', 'EcosystemAppIcon is missing draggable={false}');
    assertCondition(content.includes('aria-hidden="true"'), 'EcosystemAppIcon configures aria-hidden="true" on image', 'EcosystemAppIcon missing aria-hidden');
  }
};

checkConnectEntry();
checkPhysicalSVGAsset();
checkComponentUsage();
checkIconComponentImplementation();

console.log('\nFinal Result:', pass ? '✅ PASSED' : '❌ FAILED');

if (!pass) {
  process.exit(1);
} else {
  process.exit(0);
}
