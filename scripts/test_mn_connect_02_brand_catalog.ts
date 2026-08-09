import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { fileURLToPath } from 'url';
import { ECOSYSTEM_APPS, getAvailableApps, getInstalledApps, EcosystemApp } from '../src/lib/apps.js';
import { openEcosystemModule, EcosystemLauncherDependencies } from '../src/lib/ecosystemLauncher.js';
import { EcosystemAppIcon } from '../src/components/apps/EcosystemAppIcon.js';
import { ShieldCheck, CreditCard, LayoutGrid } from 'lucide-react';
import type { User } from 'firebase/auth';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let testCount = 0;
let passCount = 0;
let failCount = 0;
let skipCount = 0;
let assertionCount = 0;

function assert(condition: boolean, message: string) {
  assertionCount++;
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTest(name: string, testFn: () => void | Promise<void>) {
  testCount++;
  try {
    await testFn();
    passCount++;
    console.log(`[PASS] ${name}`);
  } catch (error: unknown) {
    failCount++;
    if (error instanceof Error) {
      console.error(`[FAIL] ${name} - ${error.message}`);
    } else {
      console.error(`[FAIL] ${name} - ${String(error)}`);
    }
  }
}

class MockDependencies implements EcosystemLauncherDependencies {
  loadedApps: EcosystemApp[] = ECOSYSTEM_APPS;
  idTokenCalls = 0;
  fetchCalls = 0;
  assignCalls = 0;
  
  now = () => Date.now();
  sleep = async (ms: number) => {};
  assign = (url: string) => { this.assignCalls++; };
  readSupportSession = () => null;
  markPerformance = (name: string) => {};
  loadApps = async () => this.loadedApps;
  
  async getIdToken(): Promise<string> {
    this.idTokenCalls++;
    return 'mock-token';
  }
  
  async fetchFn(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    this.fetchCalls++;
    return new Response();
  }
}

async function runAll() {
  console.log('--- TEST MN CONNECT 02 BRAND CATALOG ---');

  // A. CATÁLOGO
  await runTest('A. CATÁLOGO', () => {
    const connectApps = ECOSYSTEM_APPS.filter(app => app.id === 'connect');
    assert(connectApps.length === 1, 'exatamente um app connect cadastrado');
    
    const connectApp = connectApps[0];
    assert(connectApp.icon === 'LayoutGrid', 'icon is LayoutGrid');
    assert(connectApp.iconAsset === '/brand/connect/v2/connect-mark-color.svg', 'iconAsset is correct');
    assert(connectApp.status === 'coming_soon', 'status is coming_soon');
    assert(connectApp.primaryAction === 'disabled', 'primaryAction is disabled');
    
    assert(!connectApp.url || connectApp.url.trim() === '', 'url is empty or undefined');
    assert(!connectApp.operationalUrl || connectApp.operationalUrl.trim() === '', 'operationalUrl is empty or undefined');
    assert(!connectApp.internalRoute || connectApp.internalRoute.trim() === '', 'internalRoute is empty or undefined');
    assert(!connectApp.landingRoute || connectApp.landingRoute.trim() === '', 'landingRoute is empty or undefined');
    
    assert(connectApp.url !== '#', 'url cannot be #');

    // Comprovar ausência de contratos de acesso no Connect (enabledApps, appAccess, entitlement, entitlements, requiredEntitlement)
    assert(!('enabledApps' in connectApp), 'Connect must not have enabledApps property');
    assert(!('appAccess' in connectApp), 'Connect must not have appAccess property');
    assert(!('entitlement' in connectApp), 'Connect must not have entitlement property');
    assert(!('entitlements' in connectApp), 'Connect must not have entitlements property');
    assert(!('requiredEntitlement' in connectApp), 'Connect must not have requiredEntitlement property');
    
    assert(!Object.prototype.hasOwnProperty.call(connectApp, 'enabledApps'), 'Connect must not possess enabledApps');
    assert(!Object.prototype.hasOwnProperty.call(connectApp, 'appAccess'), 'Connect must not possess appAccess');
    assert(!Object.prototype.hasOwnProperty.call(connectApp, 'entitlement'), 'Connect must not possess entitlement');
    assert(!Object.prototype.hasOwnProperty.call(connectApp, 'entitlements'), 'Connect must not possess entitlements');
    assert(!Object.prototype.hasOwnProperty.call(connectApp, 'requiredEntitlement'), 'Connect must not possess requiredEntitlement');

    // Fortalecer a validação de destinos
    const forbiddenDestinations = ['#', 'javascript:', 'localhost', '127.0.0.1', 'example.com', 'placeholder'];
    const fieldsToTest = ['url', 'operationalUrl', 'internalRoute', 'landingRoute'] as const;
    
    for (const field of fieldsToTest) {
      const val = connectApp[field];
      const valStr = typeof val === 'string' ? val : (val === null || val === undefined ? '' : String(val));
      const valLower = valStr.toLowerCase();
      
      for (const pattern of forbiddenDestinations) {
        assert(!valLower.includes(pattern), `Field ${field} contains forbidden pattern: ${pattern}`);
      }
      
      assert(valStr.trim() === '', `Field ${field} must be empty or undefined, got: ${val}`);
    }
  });

  // B. ORDEM E INSTALAÇÃO
  await runTest('B. ORDEM E INSTALAÇÃO', () => {
    const available = getAvailableApps([]);
    assert(available.length >= 6, 'catálogo possui pelo menos 6 apps');
    assert(available[0].id === 'musicscale', 'primeiro é musicscale');
    assert(available[1].id === 'connect', 'segundo é connect');
    assert(available[2].id === 'nestfinance', 'terceiro é nestfinance');
    assert(available[3].id === 'services', 'quarto é services');
    assert(available[4].id === 'cells', 'quinto é cells');
    assert(available[5].id === 'members', 'sexto é members');

    const installed = getInstalledApps([]);
    assert(!installed.some(app => app.id === 'connect'), 'connect não é retornado como instalado');
  });

  // C. INTEGRIDADE DO SVG
  await runTest('C. INTEGRIDADE DO SVG', () => {
    const masterPath = path.join(__dirname, '../MillionsNest_Connect_Brand_Kit_v2.0/01_master_vector/connect-mark-color.svg');
    const publicPath = path.join(__dirname, '../public/brand/connect/v2/connect-mark-color.svg');
    
    assert(fs.existsSync(masterPath), 'master SVG existe');
    assert(fs.existsSync(publicPath), 'public SVG existe');
    
    const masterBuf = fs.readFileSync(masterPath);
    const publicBuf = fs.readFileSync(publicPath);
    
    // Prova de igualdade byte a byte
    assert(Buffer.compare(masterBuf, publicBuf) === 0, 'arquivos de SVG são idênticos byte a byte');
    
    // Cálculo independente dos dois hashes
    const EXPECTED_SHA256 = '2834f7fcf586a6f3465034df31cba32eb09bdf7dbedfad78f4d39048c062446c';
    const masterSha256 = crypto.createHash('sha256').update(masterBuf).digest('hex');
    const publicSha256 = crypto.createHash('sha256').update(publicBuf).digest('hex');
    
    console.log(`  - Master SVG SHA-256: ${masterSha256}`);
    console.log(`  - Public SVG SHA-256: ${publicSha256}`);
    
    assert(masterSha256 === EXPECTED_SHA256, `master SVG hash matches expected SHA-256`);
    assert(publicSha256 === EXPECTED_SHA256, `public SVG hash matches expected SHA-256`);
    assert(masterSha256 === publicSha256, `calculated hashes are identical`);
    
    const svgStr = publicBuf.toString('utf-8');
    assert(svgStr.startsWith('<svg'), 'inicia com a tag <svg');
    assert(svgStr.includes('viewBox="0 0 1000 1000"'), 'possui viewBox correto');
    assert(svgStr.includes('connect-gradient'), 'contém ID de gradiente connect-gradient');
    assert(!svgStr.includes('data:image'), 'não contém data:image');
    assert(!svgStr.includes('<image'), 'não contém tags <image');
    assert(!svgStr.includes('base64'), 'não contém referências a base64');
    
    // Check no external http/https URLs except the standard xmlns namespace
    const matches = svgStr.match(/https?:\/\/[^\s">]+/g);
    if (matches) {
      for (const url of matches) {
        assert(url === 'http://www.w3.org/2000/svg', `URL permitida apenas namespace da w3: ${url}`);
      }
    }
  });

  // D. RENDERIZADOR GENÉRICO
  await runTest('D. RENDERIZADOR GENÉRICO', () => {
    const compPath = path.join(__dirname, '../src/components/apps/EcosystemAppIcon.tsx');
    assert(fs.existsSync(compPath), 'EcosystemAppIcon.tsx existe');
    
    const content = fs.readFileSync(compPath, 'utf-8');
    assert(content.includes('app.iconAsset'), 'utiliza a propriedade app.iconAsset');
    assert(content.includes('src={app.iconAsset}'), 'injeta o src corretamente');
    assert(content.includes('alt=""'), 'possui alt vazio para acessibilidade');
    assert(content.includes('aria-hidden'), 'possui atributo aria-hidden');
    assert(content.includes('draggable={false}'), 'impede arrastar a imagem');
    assert(content.includes('object-contain'), 'possui object-contain');
    assert(content.includes('aspect-square'), 'garante aspect-square');
    
    assert(!content.includes('object-cover'), 'não deve usar object-cover');
    assert(!content.includes('grayscale'), 'não deve forçar grayscale no componente');
    assert(!content.includes('filter'), 'não deve usar filtros no componente');
    assert(!content.includes('fetch('), 'não faz requisições HTTP internas');
    assert(!content.includes('firebase'), 'não importa pacotes Firebase');
    assert(!content.includes("app.id === 'connect'"), 'não possui hardcode para Connect');
    assert(!content.includes('app.id === "connect"'), 'não possui hardcode para Connect');
    
    // Verificar mapeamento de ícones existentes
    assert(content.includes('Music'), 'suporta Music');
    assert(content.includes('Calendar'), 'suporta Calendar');
    assert(content.includes('Users'), 'suporta Users');
    assert(content.includes('QrCode'), 'suporta QrCode');
    assert(content.includes('Wallet'), 'suporta Wallet');
    assert(content.includes('ShieldCheck'), 'suporta ShieldCheck');
    assert(content.includes('CreditCard'), 'suporta CreditCard');
    assert(content.includes('LayoutGrid'), 'suporta LayoutGrid');
    
    // Testar as propriedades diretamente chamando a função de componente
    const mockAppWithAsset = {
      id: 'connect',
      name: 'MillionsNest Connect',
      description: 'Test',
      icon: 'LayoutGrid',
      iconAsset: '/brand/connect/v2/connect-mark-color.svg',
      category: 'beta'
    } as unknown as EcosystemApp;

    const renderAsset = EcosystemAppIcon({ app: mockAppWithAsset });
    assert(renderAsset.type === 'img', 'deve renderizar tag img quando possuir iconAsset');
    assert(renderAsset.props.src === '/brand/connect/v2/connect-mark-color.svg', 'injeta src correto');
    assert(renderAsset.props.draggable === false, 'desabilita arrasto');
    assert(renderAsset.props['aria-hidden'] === 'true', 'oculta do leitor de tela');
    
    const mockAppShield = {
      id: 'test',
      name: 'Test',
      description: 'Test',
      icon: 'ShieldCheck',
      category: 'beta'
    } as unknown as EcosystemApp;
    
    const renderShield = EcosystemAppIcon({ app: mockAppShield });
    assert(renderShield.type === ShieldCheck, 'mapeia e renderiza o ShieldCheck corretamente');
    
    const mockAppCreditCard = {
      id: 'test2',
      name: 'Test',
      description: 'Test',
      icon: 'CreditCard',
      category: 'beta'
    } as unknown as EcosystemApp;
    
    const renderCreditCard = EcosystemAppIcon({ app: mockAppCreditCard });
    assert(renderCreditCard.type === CreditCard, 'mapeia e renderiza o CreditCard corretamente');
    
    const mockAppFallback = {
      id: 'test3',
      name: 'Test',
      description: 'Test',
      icon: 'UnknownIconThatDoesNotExists',
      category: 'beta'
    } as unknown as EcosystemApp;
    
    const renderFallback = EcosystemAppIcon({ app: mockAppFallback });
    assert(renderFallback.type === LayoutGrid, 'cai suavemente em LayoutGrid como fallback final');
  });

  // E. CONSUMIDORES E ESCALAS
  await runTest('E. CONSUMIDORES E ESCALAS', () => {
    const navbarPath = path.join(__dirname, '../src/components/Navbar.tsx');
    const dashboardPath = path.join(__dirname, '../src/pages/Dashboard.tsx');
    const workspacePath = path.join(__dirname, '../src/components/dashboard/EcosystemWorkspaceHome.tsx');
    
    assert(fs.existsSync(navbarPath), 'Navbar.tsx existe');
    assert(fs.existsSync(dashboardPath), 'Dashboard.tsx existe');
    assert(fs.existsSync(workspacePath), 'EcosystemWorkspaceHome.tsx existe');
    
    const navbarStr = fs.readFileSync(navbarPath, 'utf-8');
    const dashboardStr = fs.readFileSync(dashboardPath, 'utf-8');
    const workspaceStr = fs.readFileSync(workspacePath, 'utf-8');
    
    // Uso do EcosystemAppIcon
    assert(navbarStr.includes('EcosystemAppIcon'), 'Navbar importa e utiliza EcosystemAppIcon');
    assert(dashboardStr.includes('EcosystemAppIcon'), 'Dashboard importa e utiliza EcosystemAppIcon');
    assert(workspaceStr.includes('EcosystemAppIcon'), 'Workspace importa e utiliza EcosystemAppIcon');
    
    // Sem caminhos hardcoded para o Connect SVG
    assert(!navbarStr.includes('/brand/connect/v2/'), 'Navbar não possui caminhos do SVG hardcoded');
    assert(!dashboardStr.includes('/brand/connect/v2/'), 'Dashboard não possui caminhos do SVG hardcoded');
    assert(!workspaceStr.includes('/brand/connect/v2/'), 'Workspace não possui caminhos do SVG hardcoded');
    
    // Sem hardcode para o ID connect para renderização de imagem de marca nos consumidores
    assert(!navbarStr.includes("app.id === 'connect'"), 'Navbar não faz checagem hardcoded de id para connect');
    assert(!dashboardStr.includes("app.id === 'connect'"), 'Dashboard não faz checagem hardcoded de id para connect');
    assert(!workspaceStr.includes("app.id === 'connect'"), 'Workspace não faz checagem hardcoded de id para connect');
    
    // Escalas de contêineres e assets nos consumidores
    assert(navbarStr.includes('assetClassName="w-10 h-10"'), 'Navbar usa asset w-10 h-10');
    assert(dashboardStr.includes('assetClassName="w-10 h-10"'), 'Dashboard usa asset w-10 h-10');
    
    assert(workspaceStr.includes('w-9 h-9'), 'Workspace compacto usa contêiner w-9 h-9');
    assert(workspaceStr.includes('assetClassName="w-8 h-8"'), 'Workspace compacto usa asset w-8 h-8');
    assert(workspaceStr.includes('w-16 h-16'), 'Workspace grande usa contêiner w-16 h-16');
    assert(workspaceStr.includes('assetClassName="w-12 h-12"'), 'Workspace grande usa asset w-12 h-12');
    
    // MusicScale preserva seu asset legítimo
    assert(navbarStr.includes('/LogoIconMusicScale-1.png'), 'Navbar preserva logo png do MusicScale');
    assert(dashboardStr.includes('/LogoIconMusicScale-1.png'), 'Dashboard preserva logo png do MusicScale');
    assert(workspaceStr.includes('/LogoIconMusicScale-1.png'), 'Workspace preserva logo png do MusicScale');
    
    // Nova Validação Robusta de PNG do Connect (Substitui checagem frágil)
    const verifyConsumerAssets = (source: string, fileLabel: string) => {
      const lowercase = source.toLowerCase();
      
      // Look for any string that contains 'connect' and ends with '.png' as a path/filename
      const connectPngPattern = /[\w\-\.\/]*connect[\w\-\.\/]*\.png/gi;
      const matches = lowercase.match(connectPngPattern);
      assert(!matches || matches.length === 0, `${fileLabel} has forbidden Connect PNG references: ${matches ? matches.join(', ') : ''}`);
      
      // Explicit independent checks for forbidden PNG patterns
      assert(!lowercase.includes('connect-mark-color.png'), `${fileLabel} has forbidden connect-mark-color.png`);
      assert(!lowercase.includes('connect-mark-white.png'), `${fileLabel} has forbidden connect-mark-white.png`);
      assert(!lowercase.includes('connect-mark.png'), `${fileLabel} has forbidden connect-mark.png`);
      assert(!lowercase.includes('connect-logo-color.png'), `${fileLabel} has forbidden connect-logo-color.png`);
      assert(!lowercase.includes('connect-logo.png'), `${fileLabel} has forbidden connect-logo.png`);
      
      // Explicit independent checks for forbidden Brand paths pointing to any PNG
      const brandConnectPngPattern = /\/brand\/connect\/[^\s'">]*\.png/gi;
      const brandMatches = lowercase.match(brandConnectPngPattern);
      assert(!brandMatches || brandMatches.length === 0, `${fileLabel} has forbidden /brand/connect/ PNG: ${brandMatches ? brandMatches.join(', ') : ''}`);
      
      // Proibição Explícita de Wordmarks
      assert(!lowercase.includes('connect-logo-horizontal'), `${fileLabel} contains connect-logo-horizontal`);
      assert(!lowercase.includes('connect-logo-stacked'), `${fileLabel} contains connect-logo-stacked`);
      assert(!lowercase.includes('connect-wordmark'), `${fileLabel} contains connect-wordmark`);
      assert(!lowercase.includes('connect-logo-horiz'), `${fileLabel} contains connect-logo-horiz`);
      assert(!lowercase.includes('connect_logo_horizontal'), `${fileLabel} contains connect_logo_horizontal`);
      assert(!lowercase.includes('connect_logo_stacked'), `${fileLabel} contains connect_logo_stacked`);
      assert(!lowercase.includes('connect_wordmark'), `${fileLabel} contains connect_wordmark`);
      
      // Confirm template PNG for MusicScale remains allowed and present
      assert(source.includes('/LogoIconMusicScale-1.png'), `${fileLabel} must preserve the legitimate MusicScale PNG asset`);
    };
    
    verifyConsumerAssets(navbarStr, 'Navbar.tsx');
    verifyConsumerAssets(dashboardStr, 'Dashboard.tsx');
    verifyConsumerAssets(workspaceStr, 'EcosystemWorkspaceHome.tsx');
  });

  // F. CONNECT NÃO EXECUTÁVEL
  await runTest('F. CONNECT NÃO EXECUTÁVEL', async () => {
    const deps = new MockDependencies();
    const mockUser = { uid: 'u1' } as unknown as User;
    const mockProfile = { systemRole: 'user' };
    const mockOrg = { id: 'org1' };
    const mockUserData = {};
    
    let rejected = false;
    let errorMessage = '';
    
    try {
      await openEcosystemModule('connect', mockUser, mockProfile, mockOrg, mockUserData, deps);
    } catch (e: unknown) {
      rejected = true;
      if (e instanceof Error) errorMessage = e.message;
    }
    
    assert(rejected, 'tentativa de abertura do connect deve rejeitar');
    assert(errorMessage.includes('não encontrado'), `esperar erro amigável de destino inválido: ${errorMessage}`);
    
    assert(deps.idTokenCalls === 0, 'getIdToken recebeu zero chamadas');
    assert(deps.fetchCalls === 0, 'fetchFn recebeu zero chamadas');
    assert(deps.assignCalls === 0, 'assign recebeu zero chamadas');
  });

  // G. REGRESSÃO
  await runTest('G. REGRESSÃO', async () => {
    const musicscale = ECOSYSTEM_APPS.find(a => a.id === 'musicscale')!;
    assert(musicscale.status === 'active', 'musicscale continua active');
    assert(musicscale.primaryAction === 'open', 'musicscale continua com primaryAction open');
    assert(typeof musicscale.url === 'string' && musicscale.url.length > 0, 'musicscale possui URL ativa');
    
    const nestfinance = ECOSYSTEM_APPS.find(a => a.id === 'nestfinance')!;
    assert(nestfinance.status === 'coming_soon', 'nestfinance continua coming_soon');
    
    assert(nestfinance.primaryAction === 'disabled', 'nestfinance continua disabled');
    assert(nestfinance.iconAsset === '/brand/nestfinance/nest-flow-signature/v1/symbols/nestfinance-symbol-vector-gradient-compact.svg', 'catálogo usa o asset compacto');
    
    // Check SVGs
    const fsMod = await import('fs');
    const path = await import('path');
    const compactPath = path.resolve(process.cwd(), 'public' + nestfinance.iconAsset);
    assert(fsMod.existsSync(compactPath), 'SVG compacto existe');
    
    const compactContent = fsMod.readFileSync(compactPath, 'utf8');
    assert(compactContent.includes('viewBox="133 90 366 366"'), 'o viewBox é exatamente 133 90 366 366');
    
    const origPath = compactPath.replace('-compact.svg', '.svg');
    assert(fsMod.existsSync(origPath), 'o SVG original continua existindo');
    
    const origContent = fsMod.readFileSync(origPath, 'utf8');
    assert(origContent.includes('viewBox="0 0 512 512"'), 'SVG original intacto');
    
    assert(nestfinance.icon === 'Wallet', 'Wallet permanece fallback');
    
    const connectApp = ECOSYSTEM_APPS.find(a => a.id === 'connect')!;
    assert(connectApp.status === 'coming_soon', 'Connect permanece intacto');
    assert(connectApp.primaryAction === 'disabled', 'Connect action permanece disabled');

    
    // Testar se os identificadores ShieldCheck e CreditCard não caem silenciosamente em LayoutGrid
    const renderShield = EcosystemAppIcon({
      app: {
        id: 'mock-shield',
        name: 'Mock',
        description: 'Mock',
        icon: 'ShieldCheck',
        category: 'beta'
      } as unknown as EcosystemApp
    });
    assert(renderShield.type === ShieldCheck, 'ShieldCheck não cai silenciosamente no fallback');
    
    const renderCredit = EcosystemAppIcon({
      app: {
        id: 'mock-credit',
        name: 'Mock',
        description: 'Mock',
        icon: 'CreditCard',
        category: 'beta'
      } as unknown as EcosystemApp
    });
    assert(renderCredit.type === CreditCard, 'CreditCard não cai silenciosamente no fallback');
  });

  console.log('--- SUMMARY ---');
  console.log(`Total: ${testCount}`);
  console.log(`Passed: ${passCount}`);
  console.log(`Failed: ${failCount}`);
  console.log(`Skipped: ${skipCount}`);
  console.log(`Assertions: ${assertionCount}`);
  
  if (failCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAll().catch(err => {
  console.error(err);
  process.exit(1);
});
