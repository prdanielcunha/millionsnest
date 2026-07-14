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
  assertCondition("4. isSystemAdmin does not include admin", !sysAdminFn.includes("== 'admin'"));
  const hasCanonical = ['ceo', 'global_admin', 'ecosystem_owner', 'founder'].every(role => sysAdminFn.includes(`== '${role}'`));
  assertCondition("5. isSystemAdmin includes canonical global roles", hasCanonical);
} else {
  assertCondition("4. & 5. isSystemAdmin", false);
}

// 6. AuthContext não usa setDoc para gravar contexto organizacional
assertCondition("6. AuthContext does not setDoc organizational context", !authCtx.includes("mergeData.organizationId =") && !authCtx.includes("mergeData.activeOrganizationId ="));

// 7. AuthContext não contém admin no tipo systemRole
assertCondition("7. AuthContext systemRole does not include admin", authCtx.includes("systemRole?: 'ceo' | 'global_admin' | 'ecosystem_owner' | 'founder' | 'user';"));

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

// 10. Nenhum arquivo patch_*.py existe na raiz
const files = fs.readdirSync(rootDir);
const tempFiles = files.filter(f => (f.startsWith('patch_') || f.startsWith('fix_') || f.startsWith('temp_') || f.startsWith('update_')) && f.endsWith('.py'));
assertCondition("10. No temp python files in root", tempFiles.length === 0);

// 11. test_results.txt não existe
assertCondition("11. test_results.txt does not exist", !files.includes('test_results.txt'));

// 12. bloco timeline restaurado
assertCondition("12. Timeline wildcard block exists", rules.includes("match /timeline/{document=**} {"));

// 13. bloco app restaurado
assertCondition("13. App wildcard block exists", rules.includes("match /{app}/{document=**} {"));

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
