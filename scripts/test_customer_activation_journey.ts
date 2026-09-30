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
const dashboard = readFileSync(
  'src/pages/Dashboard.tsx',
  'utf8'
);
const workspaceHome = readFileSync(
  'src/components/dashboard/EcosystemWorkspaceHome.tsx',
  'utf8'
);
const login = readFileSync(
  'src/pages/Login.tsx',
  'utf8'
);
const authContext = readFileSync(
  'src/contexts/AuthContext.tsx',
  'utf8'
);
const tenantBootstrapService = readFileSync(
  'src/server/services/TenantContextMutationService.ts',
  'utf8'
);

assert.match(
  login,
  /purchase_flow_title/,
  'plan-selected sign-in must explain that the customer can continue instead of showing only a returning-user message'
);
assert.match(
  login,
  /sessionStorage\.getItem\('purchase_intent'\)/,
  'login must preserve and detect the selected purchase intent'
);
assert.match(
  login,
  /!Boolean\(sessionStorage\.getItem\('purchase_intent'\)\)/,
  'first-time purchase flow must default the email form to account creation while Google remains seamless for both new and existing users'
);
assert.match(
  authContext,
  /\/api\/v1\/onboarding\/bootstrap/,
  'first-time authenticated users must be completed through the canonical onboarding bootstrap'
);
assert.match(
  authContext,
  /bootstrapAttempt\.payload\?\.activeOrganizationId/,
  'first-time signup must be able to continue from the authoritative bootstrap payload if the immediate Firestore reread is delayed'
);

const bootstrapStart = tenantBootstrapService.indexOf('export async function bootstrapUserContext');
const bootstrapEnd = tenantBootstrapService.indexOf('export async function acceptInvitation');
const bootstrapBlock = tenantBootstrapService.slice(bootstrapStart, bootstrapEnd);
assert.equal(
  bootstrapBlock.includes("collectionGroup('invites')"),
  false,
  'generic Google sign-in must not be blocked by implicit invitation discovery; explicit invitations stay in /join'
);
assert.match(
  bootstrapBlock,
  /if \(userSnap\.exists\)[\s\S]*collectionGroup\('members'\)/,
  'a truly first-time identity must not depend on a members collection-group query before checkout'
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
  workspaceHome,
  /choose_plan_action/,
  'Hub Home must keep a visible choose-plan next step before purchase'
);
assert.match(
  workspaceHome,
  /onNavigateToBilling/,
  'choose-plan next step must lead to subscription management'
);
assert.match(
  dashboard,
  /onNavigateToBilling=\{\(\) => setActiveTab\('billing'\)\}/,
  'Hub next-step billing CTA must open the billing tab directly'
);
assert.match(
  dashboard,
  /const handleSubscribe = async/,
  'billing page must retain a canonical subscription action'
);
assert.match(
  dashboard,
  /navigate\(\`\/checkout\?plan=\$\{lookupKey\}\`\)/,
  'plan purchase must move directly from billing to checkout'
);
assert.match(
  dashboard,
  /Assinar MusicScale Starter/,
  'billing page must expose a plain-language subscription CTA'
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
