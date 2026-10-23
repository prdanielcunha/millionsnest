import assert from 'node:assert/strict';
import { officialSupportDestination } from '../src/server/services/OfficialSupportDestination.js';
import { officialSupportUrl } from '../src/lib/officialSupport.js';
const input = { product: 'musicscale', source: 'website' as const, topic: 'sales' as const, locale: 'en' };
let requests = 0;
const valid: typeof fetch = async (url, options) => {
  requests++; const endpoint = new URL(String(url));
  assert.equal(endpoint.origin, 'https://connect.millionsnest.com');
  assert.equal(endpoint.searchParams.get('locale'), 'en-US');
  assert.equal(options?.redirect, 'manual'); assert.equal(options?.body, undefined);
  assert(!String(url).includes('synthetic customer message'));
  return new Response(null, { status: 302, headers: { location: 'https://wa.me/16505550100?text=' + encodeURIComponent('[mn-support:v1:musicscale:website:sales]') } });
};
const result = new URL(await officialSupportDestination(input, 'synthetic customer message', valid));
assert.equal(result.pathname, '/16505550100'); assert.equal(requests, 1);
assert.equal(result.searchParams.get('text'), 'synthetic customer message\n\n[mn-support:v1:musicscale:website:sales]');
for (const location of ['https://evil.test/16505550100', 'https://wa.me.evil.test/16505550100', 'https://wa.me/16505550100#secret', 'https://wa.me/16505550100?text=wrong-marker', 'https://wa.me/16505550100?token=private']) {
 await assert.rejects(() => officialSupportDestination(input, 'synthetic', async () => new Response(null, { status: 302, headers: { location } })), /OFFICIAL_SUPPORT_UNAVAILABLE/);
}
await assert.rejects(() => officialSupportDestination(input, 'synthetic', async () => new Response(null, { status: 503 })), /OFFICIAL_SUPPORT_UNAVAILABLE/);
for (const [language, locale] of [['en-US', 'en-US'], ['es-ES', 'es-ES'], ['pt-BR', 'pt-BR']]) {
 const url = new URL(officialSupportUrl(language, 'core', 'hub')); assert.equal(url.searchParams.get('product'), 'hub'); assert.equal(url.searchParams.get('locale'), locale);
}
console.log('Official support destination: fixed central GET-only provider resolution, safe redirect/marker validation, preserved message, no private request data and three locales passed.');
