import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const apps = readFileSync('src/lib/apps.ts', 'utf8');
const ecosystem = readFileSync('src/components/Ecosystem.tsx', 'utf8');
const testimonials = readFileSync('src/components/Testimonials.tsx', 'utf8');
const home = readFileSync('src/pages/Home.tsx', 'utf8');
const index = readFileSync('index.html', 'utf8');
const locales = [
  readFileSync('src/packages/i18n/locales/pt.ts', 'utf8'),
  readFileSync('src/packages/i18n/locales/en.ts', 'utf8'),
  readFileSync('src/packages/i18n/locales/es.ts', 'utf8')
].join('\n');

for (const productId of ['musicscale', 'nestfinance', 'nestlocal', 'nestjourney', 'connect']) {
  assert.match(apps, new RegExp(`id: ['"]${productId}['"]`), `${productId} must exist in the ecosystem catalog`);
}

for (const staleId of ['services', 'cells', 'members']) {
  assert.equal(new RegExp(`id: ['"]${staleId}['"]`).test(apps), false, `stale generic app ${staleId} must not remain in the catalog`);
}

assert.match(ecosystem, /ECOSYSTEM_APPS/, 'public ecosystem section must use the canonical app catalog');
assert.match(ecosystem, /nestlocal/, 'NestLocal must be visible in the public ecosystem');
assert.match(ecosystem, /nestjourney/, 'NestJourney must be visible in the public ecosystem');

for (const fabricatedMarker of ['+250', 'Marcos Paulo', 'Sarah Fernandes', 'Pr. Diego Silva', 'unsplash.com']) {
  assert.equal(locales.includes(fabricatedMarker) || testimonials.includes(fabricatedMarker), false, `fabricated social-proof marker must not exist: ${fabricatedMarker}`);
}

for (const stalePromise of ['AI management assistance', 'Integrated corporate chat', 'Acordes generados automáticamente']) {
  assert.equal(locales.includes(stalePromise), false, `stale product promise must not return: ${stalePromise}`);
}

assert.equal(home.includes('<Testimonials'), false, 'Home must not publish testimonials before verified customer stories exist');
assert.match(testimonials, /no synthetic testimonials/i, 'Testimonials component must document the trust policy');
assert.match(index, /<html lang="pt-BR">/, 'Brazilian Portuguese must be the default document language');
assert.match(index, /name="description"/, 'SEO description must exist');
assert.match(index, /MusicScale/, 'SEO must make the live flagship product explicit');

console.log('PASS Hub product positioning and trust contract');
