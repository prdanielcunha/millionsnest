import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const checkout = readFileSync(
  'src/pages/Checkout.tsx',
  'utf8'
);
const success = readFileSync(
  'src/pages/BillingSuccess.tsx',
  'utf8'
);
const launchpad = readFileSync(
  'src/components/dashboard/HubAppLaunchpad.tsx',
  'utf8'
);
const hubExperience = readFileSync(
  'src/lib/hubAppExperience.ts',
  'utf8'
);

for (const key of [
  'purchase_journey.choose_title',
  'purchase_journey.pay_title',
  'purchase_journey.open_title',
  'purchase_journey.cta',
  'purchase_journey.trial_note',
  'purchase_journey.recurring_note'
]) {
  assert.equal(
    checkout.includes(key),
    true,
    `Checkout must render ${key}`
  );
}

assert.equal(
  checkout.includes("t('cta', 'Iniciar Teste de 7 Dias')"),
  false,
  'checkout CTA must not promise a trial to every organization'
);
assert.equal(
  checkout.includes("t('starts_after_trial'"),
  false,
  'recurring subscription summary must not claim every purchase starts after a trial'
);
assert.equal(
  checkout.includes("t('cancel_info'"),
  false,
  'checkout must not present unconditional trial cancellation microcopy'
);
assert.match(
  checkout,
  /\/api\/v1\/billing\/unified-checkout/,
  'purchase journey must still use canonical unified checkout'
);
assert.match(
  checkout,
  /selectedPlanLookup/,
  'customer must explicitly select a plan'
);
assert.match(
  checkout,
  /organizationId:\s*activeOrganizationId/,
  'checkout must stay bound to the active organization'
);
assert.match(
  checkout,
  /checkout\.stripe\.com|endsWith\('stripe\.com'\)/,
  'checkout redirect must remain constrained to Stripe'
);

assert.match(
  success,
  /\/api\/v1\/billing\/checkout\/confirm/,
  'post-purchase experience must confirm the checkout server-side'
);
assert.match(
  success,
  /activation\.activated_title/,
  'successful purchase must clearly confirm activation'
);
assert.match(
  success,
  /activation\.next_title/,
  'successful purchase must explain what to do next'
);
assert.match(
  success,
  /activation\.open_app/,
  'successful purchase must offer a direct app-open CTA'
);
assert.match(
  success,
  /\/dashboard\/apps\/musicscale\?section=getting-started/,
  'MusicScale activation must offer a direct getting-started path'
);
assert.match(
  success,
  /activation\.access_note/,
  'activation screen must explain how to find the app again later'
);
assert.match(
  success,
  /manualRetryCount/,
  'activation recovery must have an explicit retry trigger independent from provisioning polling'
);
assert.match(
  success,
  /setManualRetryCount\([\s\S]*current => current \+ 1/,
  'manual retry must always force a new checkout confirmation attempt'
);
assert.equal(
  /setTimeout\([^)]*launchPurchasedApp|launchPurchasedApp\([^)]*\)[\s\S]{0,200}1200/.test(success),
  false,
  'post-checkout success must not auto-launch before the customer can understand the next steps'
);

assert.match(
  launchpad,
  /experience\.installed === true[\s\S]*experience\.canOpen === true[\s\S]*experience\.isOperational === true/,
  'Hub launchpad must only expose operational, entitled apps'
);
assert.match(
  launchpad,
  /onboarding\.access_note/,
  'Hub must tell users where they can always reopen their apps'
);
assert.match(
  launchpad,
  /onboarding\.open_app/,
  'Hub must retain a direct app-open CTA'
);
assert.match(
  launchpad,
  /onboarding\.view_start/,
  'Hub must retain getting-started guidance'
);

assert.match(
  hubExperience,
  /isOperational:\s*false/,
  'development previews must remain distinct from operational commercial access'
);

for (const language of ['pt', 'en', 'es']) {
  const locale = readFileSync(
    `src/packages/i18n/locales/${language}.ts`,
    'utf8'
  );
  for (const key of [
    'purchase_journey',
    'activation',
    'trial_note',
    'open_app',
    'guide_action',
    'access_note'
  ]) {
    assert.equal(
      locale.includes(key),
      true,
      `${language} checkout locale must include ${key}`
    );
  }

  const intelligence = readFileSync(
    `src/packages/i18n/intelligence/${language}.ts`,
    'utf8'
  );
  assert.equal(
    intelligence.includes('access_note'),
    true,
    `${language} intelligence locale must explain permanent Hub access`
  );
}

console.log(
  'Customer purchase-to-first-use activation journey checks passed.'
);
