import assert from 'node:assert/strict';
import fs from 'fs';

const navSrc = fs.readFileSync('src/components/Navbar.tsx', 'utf-8');
const homeSrc = fs.readFileSync('src/pages/Home.tsx', 'utf-8');
const landingSrc = fs.readFileSync('src/pages/MusicScaleLanding.tsx', 'utf-8');

try {
  // Routes and imports
  assert.ok(homeSrc.includes('Navbar'), 'Home uses Navbar');
  assert.ok(landingSrc.includes('Navbar'), 'Landing uses Navbar');

  // Desktop link
  assert.ok(navSrc.includes('id="nav-login-desktop"'), 'nav-login-desktop exists');
  assert.ok(navSrc.includes('id="nav-login-desktop" to="/login"'), 'desktop link points to /login');
  assert.ok(navSrc.match(/id="nav-login-desktop"[\s\S]*?aria-label={t\('common:login', 'Entrar'\)}/), 'desktop link has aria-label');
  assert.ok(navSrc.match(/id="nav-login-desktop"[\s\S]*?>[\s\S]*?\{t\('common:login', 'Entrar'\)\}[\s\S]*?<\/Link>/), 'desktop link has translated text Entrar');

  // Mobile direct link
  assert.ok(navSrc.includes('id="nav-login-mobile"'), 'nav-login-mobile exists');
  assert.ok(navSrc.includes('id="nav-login-mobile" to="/login"'), 'mobile link points to /login');
  assert.ok(navSrc.match(/id="nav-login-mobile"[\s\S]*?aria-label={t\('common:login', 'Entrar'\)}/), 'mobile link has aria-label');
  assert.ok(navSrc.match(/id="nav-login-mobile"[\s\S]*?>\s*\{t\('common:login', 'Entrar'\)\}\s*<\/Link>/), 'mobile link has translated text Entrar');
  
  // Menu mobile link
  assert.ok(navSrc.includes('id="nav-login-mobile-menu"'), 'nav-login-mobile-menu exists');
  assert.ok(navSrc.includes('id="nav-login-mobile-menu" to="/login"'), 'mobile menu link points to /login');
  assert.ok(navSrc.match(/id="nav-login-mobile-menu"[\s\S]*?aria-label={t\('common:login', 'Entrar'\)}/), 'mobile menu link has aria-label');
  assert.ok(navSrc.match(/id="nav-login-mobile-menu"[\s\S]*?>\{t\('common:login', 'Entrar'\)\}<\/Link>/), 'mobile menu link has translated text Entrar');

  // Mobile direct link is outside AnimatePresence of menu
  const animatePresenceStart = navSrc.indexOf('<AnimatePresence>', navSrc.indexOf('Mobile Menu'));
  const navLoginMobile = navSrc.indexOf('id="nav-login-mobile"');
  if (animatePresenceStart !== -1) {
    assert.ok(navLoginMobile < animatePresenceStart, 'Mobile direct link is outside AnimatePresence menu');
  }

  // MusicScale neutral shortcut
  assert.ok(navSrc.includes('Destaque'), 'MusicScale has neutral shortcut section');
  assert.ok(navSrc.includes("if (app.id === 'musicscale') return false;"), 'MusicScale is not marked as installed generally');
  assert.ok(navSrc.includes("navigate('/dashboard/apps/musicscale')"), 'Navigates to /dashboard/apps/musicscale');
  
  // does not trigger handoff
  assert.ok(!navSrc.includes("handleLaunch(app)") || navSrc.match(/handleLaunch\(app\)[\s\S]*?app\.id === 'musicscale'[\s\S]*?navigate\('\/dashboard\/apps\/musicscale'\)/) || !navSrc.match(/handleLaunch.*?musicscale/), 'Does not trigger handoff for MusicScale in Navbar');

} catch (e) {
  console.error("UX-NAV-LOGIN-01 failed:", e);
  process.exit(1);
}
