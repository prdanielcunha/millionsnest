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
const server = readFileSync(
  'server.ts',
  'utf8'
);
const accessProjectionService = readFileSync(
  'src/server/services/EcosystemAccessProjectionService.ts',
  'utf8'
);

const ecosystemShell = readFileSync(
  'src/components/EcosystemShell.tsx',
  'utf8'
);
const invitationCreationPlanner = readFileSync(
  'src/server/services/InvitationCreationPlanner.ts',
  'utf8'
);
const invitationAcceptancePlanner = readFileSync(
  'src/server/services/InvitationAcceptancePlanner.ts',
  'utf8'
);
const organizationLifecycle = readFileSync(
  'src/lib/organizationLifecycle.ts',
  'utf8'
);

assert.match(
  login,
  /purchase_flow_title/,
  'plan-selected sign-in must explain that the customer can continue instead of showing only a returning-user message'
);
assert.match(
  login,
  /createUserWithEmailAndPassword/,
  'new customers must be able to create a MillionsNest account with email and password'
);
assert.match(
  login,
  /signInWithEmailAndPassword/,
  'returning customers must be able to sign in with email and password'
);
assert.match(
  login,
  /signInWithPopup\(auth, googleProvider\)/,
  'Google must remain a first-class sign-in/sign-up path'
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
  bootstrapBlock.includes("db.collectionGroup('invites')"),
  false,
  'generic Google sign-in must not be blocked by implicit invitation discovery; explicit invitations stay in /join'
);
assert.match(
  bootstrapBlock,
  /if \(userSnap\.exists\)[\s\S]*collectionGroup\('members'\)/,
  'a truly first-time identity must not depend on a members collection-group query before checkout'
);
assert.match(
  tenantBootstrapService,
  /isOrganizationLifecycleActive/,
  'tenant bootstrap must not treat a trialing Stripe subscription status as an inactive organization'
);
assert.match(
  invitationCreationPlanner,
  /isOrganizationLifecycleActive\(input\.organization\.status\)/,
  'creating invitations must use tenant lifecycle semantics instead of requiring organization.status === active'
);
assert.match(
  invitationAcceptancePlanner,
  /isOrganizationLifecycleActive\(input\.organization\.status\)/,
  'accepting invitations must use tenant lifecycle semantics instead of billing status'
);
assert.match(
  organizationLifecycle,
  /'trialing'/,
  'legacy billing-derived trialing state must be recognized as an operational tenant lifecycle'
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
  /recoverOnly:\s*true/,
  'Hub must self-heal a paid MusicScale entitlement without destructive downgrade'
);
assert.match(
  dashboard,
  /organizationLifecycleRepairAttemptRef/,
  'Hub must automatically repair organizations whose lifecycle status was historically overwritten by billing'
);
assert.match(
  dashboard,
  /shouldRepairOrganizationLifecycleStatus\(organization\.status\)/,
  'Hub must detect legacy billing-derived organization lifecycle states'
);
assert.match(
  dashboard,
  /SUBSCRIPTION_NOT_FOUND[\s\S]*ENTITLEMENT_NOT_CONFIGURED[\s\S]*ENTITLEMENT_INACTIVE[\s\S]*SUBSCRIPTION_INACTIVE/,
  'Hub entitlement recovery must cover the recoverable stale-projection states'
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
  /\/api\/ecosystem\/access-projection/,
  'post-purchase success must verify canonical app access before declaring activation complete'
);
assert.match(
  success,
  /\/api\/v1\/billing\/sync/,
  'post-purchase activation must have a bounded canonical reconciliation path'
);
assert.match(
  success,
  /recoverOnly:\s*true/,
  'post-purchase reconciliation must be non-destructive while recovering a paid entitlement'
);
assert.match(
  success,
  /appId:\s*purchasedApp/,
  'post-purchase access verification must target the app that was actually purchased'
);
assert.match(
  success,
  /app:\s*purchasedApp/,
  'post-purchase Stripe reconciliation must target the purchased app instead of assuming MusicScale'
);
assert.match(
  success,
  /accessPayload\?\.apps\?\.\[purchasedApp\]/,
  'activation success must read the canonical access projection for the purchased app'
);
assert.match(
  success,
  /const accessReady =[\s\S]*verifyPurchasedAccess[\s\S]*if \(!accessReady\)[\s\S]*setStatus\('success'\)/,
  'activation success must only render after purchased access is actually usable'
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
  server,
  /requestedAppRaw[\s\S]*'nestlocal'[\s\S]*'musicscale'/,
  'billing reconciliation must explicitly whitelist the sellable app being repaired'
);
assert.match(
  server,
  /sessionApp !== requestedApp/,
  'checkout-session recovery must bind Stripe metadata to the requested app'
);
assert.match(
  server,
  /s\.metadata\?\.app === requestedApp/,
  'Stripe recovery must never cross-wire subscriptions between ecosystem apps'
);
assert.match(
  server,
  /appId:\s*confirmedApp/,
  'checkout confirmation must resolve canonical access for the app that was purchased'
);
assert.equal(
  server.includes("status: subscription.status"),
  false,
  'Stripe subscription status must never overwrite organizations/{id}.status'
);
assert.match(
  server,
  /shouldRepairOrganizationLifecycleStatus\(existingOrganizationStatus\)/,
  'billing reconciliation must repair historical organization lifecycle values that were overwritten by billing'
);
assert.match(
  accessProjectionService,
  /rawAppId === 'nestlocal' \? 'nestlocal' : 'musicscale'/,
  'canonical access projection must support each sellable app without trusting arbitrary app ids'
);

assert.match(
  ecosystemShell,
  /appSubscriptionStatus[\s\S]*\['active', 'trialing'\]/,
  'app switcher must recognize active and trialing purchases while canonical access projection is completing'
);
assert.match(
  ecosystemShell,
  /effectiveInstalledAppIds = Array\.from\(new Set\(/,
  'app switcher must merge canonical installed apps with safe billing fallback instead of showing a false empty state'
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
