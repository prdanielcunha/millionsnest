import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const helper = readFileSync('src/lib/publicFunnelAnalytics.ts', 'utf8');
const analytics = readFileSync('src/lib/analytics.ts', 'utf8');
const home = readFileSync('src/pages/Home.tsx', 'utf8');
const hero = readFileSync('src/components/Hero.tsx', 'utf8');
const flagship = readFileSync('src/components/Flagship.tsx', 'utf8');
const ecosystem = readFileSync('src/components/Ecosystem.tsx', 'utf8');
const guarantee = readFileSync('src/components/Guarantee.tsx', 'utf8');
const navbar = readFileSync('src/components/Navbar.tsx', 'utf8');
const rules = readFileSync('firestore.rules', 'utf8');
const ruleTests = readFileSync('tests/firestore/analytics_events.rules.test.ts', 'utf8');

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
assert.match(helper, /action:\s*'product_interest'/, 'home product-interest event must use the canonical action');
assert.match(helper, /product:\s*'musicscale'/, 'home funnel must identify the live product without PII');

for (const source of sources) {
  assert.match(helper, new RegExp(source), `helper missing source: ${source}`);
  assert.match(analytics, new RegExp(source), `client allowlist missing source: ${source}`);
  assert.match(rules, new RegExp(source), `Firestore allowlist missing source: ${source}`);
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

assert.match(rules, /function isValidPublicHomeAnalytics\(\)/, 'public home analytics must have a dedicated Rules validator');
assert.match(rules, /data\.app == 'millionsnest_core'/, 'home analytics validator must bind the app identity');
assert.match(rules, /data\.userId == 'none'/, 'anonymous home analytics must not claim a user');
assert.match(ruleTests, /untrusted_source/, 'Rules tests must deny arbitrary marketing sources');
assert.match(ruleTests, /another_product/, 'Rules tests must deny arbitrary products');
assert.match(ruleTests, /should-not-be-accepted@example\.com/, 'Rules tests must prove arbitrary PII metadata is rejected');

console.log('PASS public home funnel attribution, explicit-plan routing, and anonymous analytics security');
