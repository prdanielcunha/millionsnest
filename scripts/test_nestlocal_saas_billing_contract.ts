import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath: string) => fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
const catalog = read('src/lib/pricingCatalog.ts');
const billing = read('src/server/services/BillingService.ts');
const eligibility = read('src/server/services/SubscriptionEligibility.ts');
const access = read('src/server/services/EcosystemAccessResolver.ts');
const handoff = read('src/server/services/MusicScaleHandoffService.ts');
const server = read('server.ts');
const checkout = read('src/pages/Checkout.tsx');

for (const lookupKey of [
  'nestlocal_essential_monthly',
  'nestlocal_growth_monthly',
  'nestlocal_pro_monthly',
]) {
  assert.ok(catalog.includes(lookupKey), `catalog missing ${lookupKey}`);
}

assert.ok(billing.includes('getOrCreatePriceByLookupKey'), 'Stripe catalog provisioning must be idempotent');
assert.ok(server.includes("const appId: 'musicscale' | 'nestlocal'"), 'checkout and webhook must resolve the purchased app');
assert.ok(server.includes('[`apps.${appId}`]'), 'canonical subscription must keep one app projection per organization');
assert.ok(server.includes("[`apps.${appId}.status`]"), 'organization entitlement must be app-scoped');
assert.ok(server.includes("integration_identifier: 'millionsnest_kxqvjzpt'"), 'Checkout Sessions must be tagged with the required random-letter suffix');
assert.equal(server.includes("payment_method_types: ['card']"), false, 'dynamic payment methods must remain enabled');
assert.ok(eligibility.includes("appId: 'musicscale' | 'nestlocal' = 'musicscale'"), 'duplicate prevention must be app-scoped');
assert.ok(access.includes("if (appId === 'nestlocal')"), 'NestLocal access must be server resolved');
assert.ok(access.includes("memberAccess?.enabled !== true"), 'NestLocal non-owner seats must require explicit activation');
assert.ok(handoff.includes("'nestlocal'"), 'NestLocal must support short-lived Hub handoff');
assert.ok(checkout.includes("checkoutApp: 'musicscale' | 'nestlocal'"), 'checkout must filter products by app');
assert.ok(checkout.includes("app: checkoutApp"), 'checkout request must bind the selected app');

for (const locale of ['pt', 'en', 'es']) {
  const source = read(`src/packages/i18n/locales/${locale}.ts`);
  assert.ok(source.includes('nestlocal: {'), `${locale} checkout copy missing NestLocal`);
}

console.log('PASS: NestLocal SaaS billing, entitlement, handoff, and i18n contracts are app-scoped.');
