import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MUSIC_SCALE_PLANS } from '../src/lib/musicScalePlans.js';

const pricing = readFileSync('src/components/Pricing.tsx', 'utf8');
const landing = readFileSync('src/pages/MusicScaleLanding.tsx', 'utf8');
const guidedDemo = readFileSync('src/components/MusicScaleGuidedDemo.tsx', 'utf8');
const engine = readFileSync('src/packages/i18n/engine.ts', 'utf8');
const pt = readFileSync('src/packages/i18n/locales/pt.ts', 'utf8');
const en = readFileSync('src/packages/i18n/locales/en.ts', 'utf8');
const es = readFileSync('src/packages/i18n/locales/es.ts', 'utf8');
const locales = [pt, en, es].join('\n');

assert.equal(
  MUSIC_SCALE_PLANS.advanced.limits.libraryImportsPerMonth,
  10,
  'Advanced contract is 10 Live Library imports per month'
);
assert.equal(
  MUSIC_SCALE_PLANS.starter.limits.libraryImportsPerMonth,
  0,
  'Starter must not receive Live Library imports'
);
assert.equal(
  MUSIC_SCALE_PLANS.pro.limits.libraryImportsPerMonth,
  -1,
  'Paid Pro contract remains unlimited'
);

assert.match(engine, /['"]musicscale['"]/, 'musicscale namespace must be loaded by i18n');
for (const [lang, source] of [['pt', pt], ['en', en], ['es', es]] as const) {
  assert.match(source, /\n  musicscale: \{/, `${lang} must define the musicscale namespace`);
  assert.match(source, /pricing_advanced_f4: .*10/, `${lang} must communicate the Advanced 10-import limit`);
  assert.match(source, /pricing_pro_badge:/, `${lang} must define a factual Pro badge`);
}

assert.match(pricing, /pricing_advanced_f4/, 'Advanced sales card must use translated entitlement copy');
assert.match(pricing, /pricing_pro_f5/, 'Pro AI import benefit must be translated');
assert.match(pricing, /pricing_pro_f7/, 'Pro AI suggestions benefit must be translated');
assert.match(pricing, /pricing_compare_ai_suggestions/, 'Plan comparison must cover AI suggestions');
assert.match(pricing, /getProductByLookupKey\('musicscale_pro_monthly'\)/, 'Pro reference price must come from the canonical catalog');

for (const stale of [
  '⭐ Mais Escolhido',
  'Mais Escolhido',
  'Most Popular',
  'Más Popular',
  'Plan Hub Pro',
  'Hub Pro Plan',
  'Chat corporativo ilimitado',
  'Unlimited corporate chat',
  'Chat integrado (básico)',
  'Integrated chat (basic)',
  'pricing_plan1_price: "49"',
  'pricing_plan2_price: "97"',
  'Acesso premium liberado',
  'Full premium access unlocked',
  'Acceso premium completo'
]) {
  assert.equal(locales.includes(stale) || pricing.includes(stale), false, `stale sales claim must not return: ${stale}`);
}

assert.equal(landing.includes('app.millionsnest.com/musicscale'), false, 'old mock domain must not return');
assert.match(landing, /musicscale\.millionsnest\.com/, 'mock browser must show the operational MusicScale domain');
assert.equal(landing.includes('botão principal testa o Pro'), false, 'trial CTA must not force Pro');
assert.match(landing, /faq_a7/, 'trial-selection FAQ must remain translated');
assert.match(landing, /faq_q8/, 'pricing FAQ must explicitly answer whether each musician pays');
assert.match(pricing, /pricing_team_payment_title/, 'pricing must visibly state that the plan price is for the organization, not each musician');
assert.match(pricing, /pricing_organization_scope_label/, 'every pricing card must reinforce organization-level pricing');
for (const [lang, source] of [['pt', pt], ['en', en], ['es', es]] as const) {
  assert.match(source, /faq_q8:/, `${lang} must translate the per-musician pricing objection`);
  assert.match(source, /pricing_team_payment_title:/, `${lang} must translate the team-level pricing headline`);
}
assert.match(landing, /isGlobalPrivilegedUser\(profile\)/, 'landing global-role checks must use the canonical helper');
assert.match(landing, /MusicScaleGuidedDemo/, 'sales landing must use the step-specific guided product demo');
assert.equal(landing.includes('/* Premium Mockup Guided Demo */'), false, 'legacy guided demo shell that reused the same screenshot must be removed');
assert.equal(guidedDemo.includes('telas.png'), false, 'step-specific guided demo component must not reuse the generic landing screenshot');
for (const visual of ['CreateScaleVisual', 'RepertoireVisual', 'NotificationsVisual', 'ConfirmationsVisual', 'PerformanceVisual']) {
  assert.match(guidedDemo, new RegExp(`function ${visual}\\(`), `guided demo must include a distinct ${visual} product state`);
}
assert.match(guidedDemo, /lg:hidden/, 'guided demo must provide a dedicated compact mobile step navigator');
assert.match(guidedDemo, /overflow-x-auto/, 'mobile guided demo controls must scroll horizontally instead of overflowing the viewport');

console.log('PASS MusicScale sales truth and i18n contract');
