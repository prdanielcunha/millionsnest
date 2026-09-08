import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const hero = readFileSync('src/components/Hero.tsx', 'utf8');
const productStage = readFileSync('src/components/ProductMotionStage.tsx', 'utf8');
const proof = readFileSync('src/components/SocialProof.tsx', 'utf8');
const flagship = readFileSync('src/components/Flagship.tsx', 'utf8');
const ecosystem = readFileSync('src/components/Ecosystem.tsx', 'utf8');
const shell = readFileSync('src/components/EcosystemShell.tsx', 'utf8');
const workspace = readFileSync('src/components/dashboard/EcosystemWorkspaceHome.tsx', 'utf8');
const css = readFileSync('src/index.css', 'utf8');
const locales = ['pt', 'en', 'es'].map(locale =>
  readFileSync(`src/packages/i18n/locales/${locale}.ts`, 'utf8')
);

assert.match(hero, /ProductMotionStage/, 'hero must use the lightweight product workflow stage');
assert.match(hero, /\/musicscale#musicscale-demo/, 'primary hero CTA must open the concrete MusicScale demo');
assert.equal(hero.includes('<video'), false, 'hero must not use a background video');
assert.equal(productStage.includes('<video'), false, 'product workflow must stay media-light');
assert.match(productStage, /useReducedMotion/, 'product motion must respect reduced-motion preferences');
assert.match(productStage, /hero_demo_sample/, 'demo UI must be explicitly labeled as a sample');
assert.match(proof, /proof_tag/, 'proof section must explain concrete product proof instead of fabricated social proof');
assert.match(proof, /proof_scope_title/, 'proof section must explain organization-level subscription scope');
assert.match(flagship, /flagship_flow_1_title/, 'flagship must present the product workflow');
assert.match(flagship, /subscription_scope_badge/, 'flagship must preserve organization subscription clarity');
assert.match(ecosystem, /ProductPreview/, 'ecosystem must present visual product previews');
assert.match(ecosystem, /snap-x snap-mandatory/, 'mobile ecosystem must use user-controlled scroll snapping');
assert.equal(ecosystem.includes('autoPlay'), false, 'ecosystem gallery must not auto-advance media');
assert.match(shell, /mn-shell/, 'Hub must use the Design 2.0 shell');
assert.match(shell, /mn-topbar/, 'Hub topbar must use the Design 2.0 surface');
assert.match(shell, /mn-dashboard-grid/, 'Hub workspace must use the lightweight visual grid');
assert.match(workspace, /mn-surface-strong/, 'Hub primary cards must use the premium surface system');
assert.match(css, /MillionsNest Design 2\.0/, 'Design 2.0 visual tokens must be centralized in CSS');
assert.match(css, /@media \(hover: hover\) and \(pointer: fine\)/, 'hover lift must only apply to precise pointing devices');

for (const source of locales) {
  for (const key of [
    'hero_scope_note',
    'hero_demo_label',
    'hero_demo_sample',
    'hero_demo_scale',
    'hero_demo_confirmations',
    'hero_demo_conduct',
    'proof_tag',
    'proof_scope_title',
    'proof_devices_title',
    'proof_languages_title',
    'proof_focus_title',
    'flagship_flow_1_title',
    'flagship_flow_2_title',
    'flagship_flow_3_title',
    'eco_gallery_hint'
  ]) {
    assert.match(source, new RegExp(`\\b${key}\\b`), `missing Design 2.0 i18n key: ${key}`);
  }
}

console.log('PASS MillionsNest Design 2.0 product storytelling, performance, responsive gallery, Hub surfaces and PT/EN/ES contract');
