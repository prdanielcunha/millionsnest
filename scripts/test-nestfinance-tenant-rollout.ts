import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mayAttemptNestFinanceTenantAccess } from '../src/server/services/NestFinanceTenantRollout.js';

for (const role of [undefined, null, '', 'member', 'admin', 'treasurer']) {
  assert.equal(mayAttemptNestFinanceTenantAccess(role, undefined), false);
  assert.equal(mayAttemptNestFinanceTenantAccess(role, 'false'), false);
  assert.equal(mayAttemptNestFinanceTenantAccess(role, 'TRUE'), false);
  assert.equal(mayAttemptNestFinanceTenantAccess(role, 'true'), true);
}
for (const role of ['ceo', 'global_admin', 'ecosystem_owner', 'founder']) {
  assert.equal(mayAttemptNestFinanceTenantAccess(role, undefined), true,
    'Existing global developer access remains available');
}

const resolver = readFileSync('src/server/services/EcosystemAccessResolver.ts', 'utf8');
assert.ok(resolver.includes('mayAttemptNestFinanceTenantAccess(systemRole, process.env.NESTFINANCE_PUBLIC_ACCESS_ENABLED)'));
assert.ok(resolver.includes("memData.appAccess?.nestFinance?.enabled !== true"),
  'A public rollout must still require explicit member app access');
assert.ok(resolver.includes("entitlements?.nestfinance?.active === true"),
  'A public rollout must still require active organization entitlement');
assert.ok(resolver.includes("enabledApps.includes('nestfinance')"),
  'An org without NestFinance must remain denied');
console.log('✅ Public NestFinance tenant rollout remains flag-gated and preserves membership and billing checks');
