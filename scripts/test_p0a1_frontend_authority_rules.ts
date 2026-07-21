import fs from 'fs';
import path from 'path';

let passed = 0;
let failed = 0;

function assertCondition(name: string, condition: boolean) {
  if (condition) {
    console.log(`[PASS] ${name}`);
    passed++;
  } else {
    console.error(`[FAIL] ${name}`);
    failed++;
  }
}

const rootDir = process.cwd();

// Load files
const rules = fs.readFileSync(path.join(rootDir, 'firestore.rules'), 'utf-8');
const authCtx = fs.readFileSync(path.join(rootDir, 'src/contexts/AuthContext.tsx'), 'utf-8');
const login = fs.readFileSync(path.join(rootDir, 'src/pages/Login.tsx'), 'utf-8');

// 1. firestore.rules não contém create de organization_members baseado no próprio uid
const orgMembersCreateMatch = rules.match(/match \/organization_members\/[^\{]*\{[^\}]*allow create:[^\n]*/s);
if (orgMembersCreateMatch) {
  const createRule = orgMembersCreateMatch[0];
  assertCondition("1. organization_members create blocks self UID", 
    !createRule.includes("request.auth.uid") || !createRule.includes("request.resource.data.get('uid'"));
} else {
  const badOrgMemberRule = rules.includes("request.resource.data.get('uid', '') == request.auth.uid");
  assertCondition("1. organization_members create blocks self UID", !badOrgMemberRule);
}

// 2. organizations update não contém orgId == request.auth.uid
const orgsMatch = rules.match(/match \/organizations\/\{orgId\} \{[^\}]*allow update:[^\;]*;/s);
if (orgsMatch) {
  const updateRule = orgsMatch[0];
  assertCondition("2. organizations update blocks orgId == request.auth.uid", !updateRule.includes("orgId == request.auth.uid"));
} else {
  assertCondition("2. organizations update blocks orgId == request.auth.uid", !rules.includes("orgId == request.auth.uid"));
}

// 3. users update bloqueia todos os campos sensíveis listados
const usersMatch = rules.match(/match \/users\/\{userId\} \{[^\}]*allow update:[^\;]*;/s);
const sensitiveFields = ['organizationId', 'activeOrganizationId', 'primaryOrganizationId', 'defaultOrganizationId', 'lastOrganizationId', 'organizations', 'organizationIds', 'memberships', 'organizationRole', 'systemRole', 'globalRole', 'capabilities', 'appsAccess', 'products', 'lifetimeAccess'];
if (usersMatch) {
  const updateRule = usersMatch[0];
  const allBlocked = sensitiveFields.every(field => updateRule.includes(`'${field}'`));
  assertCondition("3. users update blocks all sensitive fields", allBlocked);
} else {
  assertCondition("3. users update blocks all sensitive fields", false);
}

// 4. & 5. isSystemAdmin
const sysAdminMatch = rules.match(/function isSystemAdmin\(\) \{[^\}]*\}/s);
if (sysAdminMatch) {
  const sysAdminFn = sysAdminMatch[0];
  const hasCanonical = ['ceo', 'global_admin', 'ecosystem_owner', 'founder'].every(role => sysAdminFn.includes(`== '${role}'`));
  const noProhibited = !['admin', 'owner', 'support', 'suporte', 'ecosystem_support'].some(role => sysAdminFn.includes(`== '${role}'`));
  assertCondition("4. isSystemAdmin does not include admin and other prohibited roles", noProhibited);
  assertCondition("5. isSystemAdmin includes canonical global roles", hasCanonical);
} else {
  assertCondition("4. isSystemAdmin does not include admin and other prohibited roles", false);
  assertCondition("5. isSystemAdmin includes canonical global roles", false);
}

// 6. AuthContext não usa setDoc para gravar contexto organizacional
assertCondition("6. AuthContext does not setDoc organizational context", !authCtx.includes("mergeData.organizationId =") && !authCtx.includes("mergeData.activeOrganizationId ="));

// 7. AuthContext systemRole check
const systemRoleMatch = authCtx.match(/systemRole\?\s*:\s*([^;]+);/);
let systemRoles = new Set<string>();
if (systemRoleMatch) {
  const rolesStr = systemRoleMatch[1];
  const roleRegex = /'([^']+)'/g;
  let match;
  while ((match = roleRegex.exec(rolesStr)) !== null) {
    systemRoles.add(match[1]);
  }
}

assertCondition("7.1 AuthContext systemRole was found", systemRoles.size > 0);
assertCondition("7.2 AuthContext systemRole includes ceo", systemRoles.has("ceo"));
assertCondition("7.3 AuthContext systemRole includes global_admin", systemRoles.has("global_admin"));
assertCondition("7.4 AuthContext systemRole includes ecosystem_owner", systemRoles.has("ecosystem_owner"));
assertCondition("7.5 AuthContext systemRole includes founder", systemRoles.has("founder"));
assertCondition("7.6 AuthContext systemRole includes ecosystem_support", systemRoles.has("ecosystem_support"));
assertCondition("7.7 AuthContext systemRole includes user", systemRoles.has("user"));
assertCondition("7.8 AuthContext systemRole does not include admin", !systemRoles.has("admin"));
assertCondition("7.9 AuthContext systemRole does not include owner", !systemRoles.has("owner"));
assertCondition("7.10 AuthContext systemRole does not include support", !systemRoles.has("support"));
assertCondition("7.11 AuthContext systemRole does not include suporte", !systemRoles.has("suporte"));

const expectedRoles = new Set(['ceo', 'global_admin', 'ecosystem_owner', 'founder', 'ecosystem_support', 'user']);
const hasUnexpected = Array.from(systemRoles).some(r => !expectedRoles.has(r));
assertCondition("7.12 AuthContext systemRole has no unexpected roles", !hasUnexpected);

// permissionService checks
const permSvc = fs.readFileSync(path.join(rootDir, 'src/lib/permissionService.ts'), 'utf-8');
const canRolesMatch = permSvc.match(/CANONICAL_GLOBAL_ROLES = \[([^\]]+)\]/);
let canRoles = new Set<string>();
if (canRolesMatch) {
  const rRegex = /'([^']+)'/g;
  let m;
  while ((m = rRegex.exec(canRolesMatch[1])) !== null) {
    canRoles.add(m[1]);
  }
}
assertCondition("P1. CANONICAL_GLOBAL_ROLES contains exactly 4 canonical roles", canRoles.has('ceo') && canRoles.has('global_admin') && canRoles.has('ecosystem_owner') && canRoles.has('founder') && canRoles.size === 4);
assertCondition("P2. CANONICAL_GLOBAL_ROLES does not contain prohibited roles", !canRoles.has('admin') && !canRoles.has('owner') && !canRoles.has('support') && !canRoles.has('suporte') && !canRoles.has('ecosystem_support'));

const ecoRolesMatch = permSvc.match(/ECOSYSTEM_SUPPORT_ROLES = \[([^\]]+)\]/);
let ecoRoles = new Set<string>();
if (ecoRolesMatch) {
  const rRegex = /'([^']+)'/g;
  let m;
  while ((m = rRegex.exec(ecoRolesMatch[1])) !== null) {
    ecoRoles.add(m[1]);
  }
}
assertCondition("P3. ECOSYSTEM_SUPPORT_ROLES contains exactly ecosystem_support", ecoRoles.has('ecosystem_support') && ecoRoles.size === 1);

const ecoPolMatch = permSvc.match(/if \(isSupport\)\s*\{\s*return\s*\{([^\}]+)\}/);
let ecoPolStr = ecoPolMatch ? ecoPolMatch[1] : '';
assertCondition("P4. ecosystem_support hasFullProductEntitlements: true", /hasFullProductEntitlements:\s*true/.test(ecoPolStr));
assertCondition("P5. ecosystem_support hasPrioritySupport: true", /hasPrioritySupport:\s*true/.test(ecoPolStr));
assertCondition("P6. ecosystem_support canBypassSupportMembership: true", /canBypassSupportMembership:\s*true/.test(ecoPolStr));
assertCondition("P7. ecosystem_support canManageGlobalGovernance: false", /canManageGlobalGovernance:\s*false/.test(ecoPolStr));

assertCondition("P8. isGlobalPrivilegedUser remains based on canonical roles", permSvc.includes('return isGlobalAdmin(userProfile);') && permSvc.includes('isCanonicalGlobalRole(userProfile.systemRole)'));

// 8. Login processa mn_invite_redirect sem exigir profile
assertCondition("8. Login processes invite redirect without profile", login.includes("if (user) {") && login.indexOf("inviteRedirect") < login.indexOf("if (profile) {"));

// 9. Login restringe redirect a /join
assertCondition("9. Login restricts redirect through canonical policy", 
  login.includes("InvitationRedirectPolicy") &&
  login.includes("parseInvitationRedirectPath(inviteRedirect)") &&
  login.includes("navigate(parsedRedirect.data.path)") &&
  login.includes("sessionStorage.removeItem('mn_invite_redirect')") &&
  login.includes("if (inviteRedirect !== null)") &&
  !login.includes("new URL(") &&
  !login.includes("pathname.startsWith") &&
  !login.includes("startsWith('/join')")
);

// 10. Nenhum arquivo de script residual existe na raiz
const files = fs.readdirSync(rootDir);
const tempFiles = files.filter(f => (f.startsWith('patch_') || f.startsWith('fix_') || f.startsWith('temp_') || f.startsWith('update_')) && (f.endsWith('.py') || f.endsWith('.js') || f.endsWith('.ts') || f.endsWith('.cjs') || f.endsWith('.mjs')));
assertCondition("10. No residual script files in root", tempFiles.length === 0);

// 11. test_results.txt não existe
assertCondition("11. test_results.txt does not exist", !files.includes('test_results.txt'));

// 12. bloco timeline restaurado
assertCondition("12. Timeline wildcard block exists", rules.includes("match /timeline/{document=**} {"));

// 13. bloco app restaurado
assertCondition("13. App wildcard block exists", rules.includes("match /{app}/{document=**} {"));

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
