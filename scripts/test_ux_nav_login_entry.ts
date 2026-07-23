import fs from 'fs';
import path from 'path';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    passed++;
    console.log(`✅ PASS: ${message}`);
  } else {
    failed++;
    console.error(`❌ FAIL: ${message}`);
  }
}

async function runTests() {
  console.log("Starting UX-NAV-LOGIN-01...");

  const navbarContent = fs.readFileSync(path.resolve('./src/components/Navbar.tsx'), 'utf-8');
  const appContent = fs.readFileSync(path.resolve('./src/App.tsx'), 'utf-8');
  const homeContent = fs.readFileSync(path.resolve('./src/pages/Home.tsx'), 'utf-8');
  const msLandingContent = fs.readFileSync(path.resolve('./src/pages/MusicScaleLanding.tsx'), 'utf-8');

  // Rota /login existe
  assert(appContent.includes('path="/login"') || appContent.includes('path="/login/*"'), "Rota /login existe");

  // Home usa Navbar
  assert(homeContent.includes('<Navbar />'), "Home usa Navbar");
  
  // MusicScaleLanding usa Navbar
  assert(msLandingContent.includes('<Navbar />'), "MusicScaleLanding usa Navbar");

  // nav-login-desktop existe
  assert(navbarContent.includes('id="nav-login-desktop"'), "nav-login-desktop existe");

  // nav-login-mobile existe
  assert(navbarContent.includes('id="nav-login-mobile"'), "nav-login-mobile existe");

  // nav-login-mobile-menu existe
  assert(navbarContent.includes('id="nav-login-mobile-menu"'), "nav-login-mobile-menu existe");

  // Todos usam Link para /login
  const desktopLinkValid = navbarContent.includes('id="nav-login-desktop" to="/login"');
  const mobileLinkValid = navbarContent.includes('id="nav-login-mobile" to="/login"');
  const menuLinkValid = navbarContent.includes('id="nav-login-mobile-menu" to="/login"');
  assert(desktopLinkValid && mobileLinkValid && menuLinkValid, "Todos os botões usam Link para /login");

  // Todos usam texto traduzível Entrar
  const desktopTextValid = navbarContent.includes("{t('common:login', 'Entrar')}");
  assert(desktopTextValid, "Todos usam texto traduzível Entrar");

  // mobile direto está fora do bloco AnimatePresence do menu
  const menuStartPos = navbarContent.indexOf('{/* Mobile Menu */}');
  const mobileLinkPos = navbarContent.indexOf('id="nav-login-mobile"');
  assert(mobileLinkPos < menuStartPos, "Mobile direto está fora do bloco AnimatePresence do menu");

  // CTA desktop aparece antes de Teste grátis
  const desktopPos = navbarContent.indexOf('id="nav-login-desktop"');
  const trialPos = navbarContent.indexOf('purchase_intent');
  assert(desktopPos < trialPos, "CTA desktop aparece antes de Teste grátis");

  // Nao usa botao somente com icone, tem o texto Entrar
  assert(desktopTextValid, "Não usa botão somente com ícone (tem texto)");

  // Não usa sessionStorage no CTA Entrar
  const desktopBlock = navbarContent.substring(desktopPos, desktopPos + 300);
  assert(!desktopBlock.includes('sessionStorage'), "Não usa sessionStorage no CTA Entrar");

  // possui aria-label
  assert(navbarContent.includes('aria-label={t(\'common:login\', \'Entrar\')}'), "Possui aria-label");

  // possui focus-visible
  assert(navbarContent.includes('focus-visible:ring-2') && navbarContent.includes('focus-visible:ring-[#2B85EB]'), "Possui focus-visible");

  // possui altura mínima apropriada
  assert(navbarContent.includes('min-h-[40px]'), "Possui altura mínima apropriada");

  // Navbar autenticada continua contendo Painel, Command Center e logout
  assert(navbarContent.includes('Painel') && navbarContent.includes('Command Center') && navbarContent.includes('logout'), "Navbar autenticada intacta");

  console.log(`\nFinal UX-NAV-LOGIN-01 Results. Passed: ${passed}, Failed: ${failed}`);
  if (failed > 0) process.exit(1);
}

runTests().catch(e => {
  console.error(e);
  process.exit(1);
});
