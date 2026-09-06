import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const home = readFileSync('src/pages/Home.tsx', 'utf8');
const hero = readFileSync('src/components/Hero.tsx', 'utf8');
const problem = readFileSync('src/components/Problem.tsx', 'utf8');
const flagship = readFileSync('src/components/Flagship.tsx', 'utf8');
const ecosystem = readFileSync('src/components/Ecosystem.tsx', 'utf8');
const vision = readFileSync('src/components/Vision.tsx', 'utf8');
const guarantee = readFileSync('src/components/Guarantee.tsx', 'utf8');
const salesChat = readFileSync('src/components/SalesChat.tsx', 'utf8');
const navbar = readFileSync('src/components/Navbar.tsx', 'utf8');
const index = readFileSync('index.html', 'utf8');
const locales = [
  readFileSync('src/packages/i18n/locales/pt.ts', 'utf8'),
  readFileSync('src/packages/i18n/locales/en.ts', 'utf8'),
  readFileSync('src/packages/i18n/locales/es.ts', 'utf8')
];

for (const source of locales) {
  for (const key of [
    'hero_trust_identity',
    'hero_canvas_label',
    'thesis_solution_title',
    'flagship_secondary',
    'eco_next_label',
    'vision_p4_title',
    'guarantee_secondary',
    'chat_response_channel',
    'nav_try_musicscale'
  ]) {
    assert.match(source, new RegExp(`\\b${key}\\b`), `missing authority/i18n key: ${key}`);
  }
}

const expectedOrder = [
  '<SocialProof />',
  '<Problem />',
  '<Flagship />',
  '<Ecosystem />',
  '<Vision />',
  '<FAQ />',
  '<Guarantee />'
];
let last = -1;
for (const marker of expectedOrder) {
  const pos = home.indexOf(marker);
  assert.ok(pos > last, `home authority section order is wrong around ${marker}`);
  last = pos;
}

assert.match(hero, /DashboardMockup/, 'hero must show a real product/system visual');
assert.match(hero, /hero_trust_release/, 'hero must expose release-quality trust signal');
assert.match(problem, /thesis_solution_title/, 'brand thesis must explain the MillionsNest operating model');
assert.match(flagship, /EscalasMockup/, 'flagship must show real MusicScale UI instead of a video placeholder');
assert.equal(flagship.includes('flagship_watch_action'), false, 'unfinished video placeholder must not return to flagship');
assert.equal(flagship.includes("t('soon'"), false, 'flagship must not advertise unfinished demo content');
assert.match(ecosystem, /activeProduct/, 'live product must receive distinct hierarchy');
assert.match(ecosystem, /futureProducts/, 'future products must remain visibly subordinate to the live product');
assert.match(vision, /vision_p4_title/, 'engineering trust section must include release QA');
assert.equal(guarantee.includes('guarantee_badge_days'), false, 'generic giant 7-day badge must not return');
assert.equal(salesChat.includes('animate-ping'), false, 'sales contact must not fake urgency/presence animation');
assert.equal(salesChat.includes("t('chat_online')"), false, 'sales contact must not claim real-time online presence');
assert.match(navbar, /#principios/, 'public nav must lead to the MillionsNest thesis instead of generic feature navigation');
assert.match(navbar, /nav_try_musicscale/, 'navbar CTA must name the live product');
assert.match(index, /Software para quem não pode operar no improviso/, 'SEO title must communicate the authority positioning');

for (const synthetic of ['+250', 'Mais vendido', 'Mais Popular', 'consultor online']) {
  assert.equal(locales.join('\n').toLowerCase().includes(synthetic.toLowerCase()), false, `synthetic authority marker must not exist: ${synthetic}`);
}

console.log('PASS Hub authority landing, visual hierarchy, trust, and i18n contract');
