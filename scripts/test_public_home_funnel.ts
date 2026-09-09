import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const helper = readFileSync('src/lib/publicFunnelAnalytics.ts', 'utf8');
const home = readFileSync('src/pages/Home.tsx', 'utf8');
const hero = readFileSync('src/components/Hero.tsx', 'utf8');
const flagship = readFileSync('src/components/Flagship.tsx', 'utf8');
const ecosystem = readFileSync('src/components/Ecosystem.tsx', 'utf8');
const guarantee = readFileSync('src/components/Guarantee.tsx', 'utf8');
const navbar = readFileSync('src/components/Navbar.tsx', 'utf8');
const server = readFileSync('server.ts', 'utf8');
const rules = readFileSync('firestore.rules', 'utf8');

const sources = [
  'hero_primary',
  'nav_product',
  'nav_pricing',
  'nav_trial',
  'flagship_primary',
  'flagship_pricing',
  'ecosystem_live',
  'guarantee_primary',
  'guarantee_pricing',
];

assert.match(home, /trackPublicHomeView/, 'public home must record one anonymous view per session');
assert.match(helper, /mn_public_home_view_tracked/, 'home view tracking must be session-deduplicated');
assert.match(helper, /\/api\/v1\/public\/analytics\/home/, 'public funnel must use the hardened backend endpoint');
assert.match(helper, /keepalive:\s*true/, 'CTA analytics should survive same-origin navigation');
assert.equal(helper.includes("from \"./analytics.js\""), false, 'public home analytics must not require anonymous Firestore writes');

for (const source of sources) {
  assert.match(helper, new RegExp(source), `client helper missing source: ${source}`);
}

assert.match(hero, /hero_primary/, 'hero CTA must be attributable');
assert.match(flagship, /flagship_primary/, 'flagship CTA must be attributable');
assert.match(ecosystem, /ecosystem_live/, 'live ecosystem product CTA must be attributable');
assert.match(guarantee, /guarantee_primary/, 'final CTA must be attributable');
assert.match(navbar, /nav_trial/, 'navbar trial CTA must be attributable');

assert.equal(
  navbar.includes("sessionStorage.setItem('purchase_intent', 'musicscale_starter_monthly')"),
  false,
  'generic navbar CTA must never silently preselect Starter'
);
assert.match(
  navbar,
  /navigate\('\/musicscale#pricing-section'\)/,
  'generic trial CTA must take the visitor to explicit plan selection'
);

assert.match(server, /parsePublicHomeAnalyticsPayload/, 'backend must validate public analytics before writing');
assert.match(server, /public_home_/, 'backend must use a deterministic dedupe document id');
assert.match(server, /createHash\('sha256'\)/, 'session/source dedupe key must be hashed');
assert.match(server, /limit:\s*'2kb'/, 'public analytics request body must stay tightly bounded');
assert.match(server, /Cache-Control', 'no-store'/, 'public analytics endpoint must not be cacheable');

const publicAnalyticsStart = rules.indexOf(
  'function isValidPublicMusicScaleAnalytics()'
);
const publicAnalyticsEnd = rules.indexOf(
  'function isValidAuthenticatedAnalytics()',
  publicAnalyticsStart
);
assert.ok(
  publicAnalyticsStart >= 0 && publicAnalyticsEnd > publicAnalyticsStart,
  'public analytics validator must remain explicit'
);
const publicAnalyticsBlock = rules.slice(
  publicAnalyticsStart,
  publicAnalyticsEnd
);

assert.equal(
  publicAnalyticsBlock.includes("data.app == 'millionsnest_core'"),
  false,
  'public-home funnel must not broaden anonymous Firestore Rules'
);
assert.match(
  publicAnalyticsBlock,
  /data\.app == 'musicscale'/,
  'anonymous Firestore analytics must remain limited to the explicit MusicScale public funnel'
);

console.log('PASS public home funnel attribution, explicit-plan routing, and backend-mediated analytics security');
