import assert from 'node:assert/strict';
import {canExtendHubTrial,canManageTenantBilling} from '../src/lib/permissionService.js';
for(const role of ['ceo','global_admin','ecosystem_owner','founder','admin','ecosystem_support']) {
  assert.equal(canExtendHubTrial(role),true,role);
}
for(const role of ['user','owner','organization_admin','pastor','manager','member','']) {
  assert.equal(canExtendHubTrial(role),false,role);
}
assert.equal(canManageTenantBilling('ecosystem_support'),false,
  'support can grant a limited extension, but never inherit Stripe billing authority');
assert.equal(canExtendHubTrial({systemRole:'ecosystem_support'}),true);
assert.equal(canExtendHubTrial({systemRole:'user',organizationRole:'owner'}),false);
console.log('PASS: CEO/global-admin/ecosystem-support only; tenant owners excluded; Stripe RBAC intact');
