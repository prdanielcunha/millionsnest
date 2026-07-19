import * as fs from 'fs';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

console.log("Starting static checks for MN-ORG-ROLES-SWITCH-PREMIUM-1...");

// 1. Verify AuthContext.tsx organization switching logic
const authContextFile = fs.readFileSync('src/contexts/AuthContext.tsx', 'utf-8');
assert(authContextFile.includes("switchOrganization"), "AuthContext.tsx must export switchOrganization");
assert(authContextFile.includes("mn_tenant_switched"), "AuthContext.tsx must dispatch mn_tenant_switched event");
assert(!authContextFile.includes("window.location.reload()"), "switchOrganization must not call window.location.reload() in AuthContext");
assert(authContextFile.includes("return { success: true }"), "switchOrganization must return success status object");

// 2. Verify OrganizationContext.tsx listener logic
const orgContextFile = fs.readFileSync('src/contexts/OrganizationContext.tsx', 'utf-8');
assert(orgContextFile.includes("mn_tenant_switched"), "OrganizationContext.tsx must listen to mn_tenant_switched event");
assert(orgContextFile.includes("setOrganization(null)"), "OrganizationContext.tsx must clear organization state immediately");
assert(orgContextFile.includes("setMemberRole(null)"), "OrganizationContext.tsx must clear memberRole state immediately");

// 3. Verify InviteModal.tsx role selection options
const inviteModalFile = fs.readFileSync('src/components/InviteModal.tsx', 'utf-8');
assert(inviteModalFile.includes("value: 'admin'"), "InviteModal must contain 'admin' role option");
assert(inviteModalFile.includes("value: 'manager'"), "InviteModal must contain 'manager' role option");
assert(inviteModalFile.includes("value: 'member'"), "InviteModal must contain 'member' role option");
assert(inviteModalFile.includes("value: 'viewer'"), "InviteModal must contain 'viewer' role option");
assert(!inviteModalFile.includes("value: 'leader'"), "InviteModal must not offer 'leader' in selection options");
assert(!inviteModalFile.includes("value: 'secretary'"), "InviteModal must not offer 'secretary' in selection options");
assert(!inviteModalFile.includes("value: 'guest'"), "InviteModal must not offer 'guest' in selection options");

// 4. Verify Dashboard.tsx organization switcher and reload prevention
const dashboardFile = fs.readFileSync('src/pages/Dashboard.tsx', 'utf-8');
assert(!dashboardFile.includes("switchOrganization(org.id).then(() => window.location.reload())") && 
       !dashboardFile.includes("switchOrganization(org.id).then(()=>window.location.reload())"), 
       "Dashboard.tsx organization switch must use the reload-free event flow");
assert(dashboardFile.includes("feedback.success"), "Dashboard.tsx must use non-blocking feedback toasts for switcher");

// 5. Verify EcosystemShell.tsx organization switcher and reload prevention
const shellFile = fs.readFileSync('src/components/EcosystemShell.tsx', 'utf-8');
assert(!shellFile.includes("switchOrganization(org.id).then(() => window.location.reload())"), "EcosystemShell.tsx organization switcher must not reload on switch");
assert(shellFile.includes("feedback.loading"), "EcosystemShell.tsx switcher must show loading toast");
assert(shellFile.includes("feedback.success"), "EcosystemShell.tsx switcher must show success toast");

// 6. Verify i18n entries
const ptLocalesFile = fs.readFileSync('src/packages/i18n/locales/pt.ts', 'utf-8');
assert(ptLocalesFile.includes("musicscale_group_title:"), "pt locales must contain musicscale_group_title");
assert(ptLocalesFile.includes("org_group_title:"), "pt locales must contain org_group_title");
assert(ptLocalesFile.includes("help_group_title:"), "pt locales must contain help_group_title");

const enLocalesFile = fs.readFileSync('src/packages/i18n/locales/en.ts', 'utf-8');
assert(enLocalesFile.includes("musicscale_group_title:"), "en locales must contain musicscale_group_title");
assert(enLocalesFile.includes("org_group_title:"), "en locales must contain org_group_title");
assert(enLocalesFile.includes("help_group_title:"), "en locales must contain help_group_title");

const esLocalesFile = fs.readFileSync('src/packages/i18n/locales/es.ts', 'utf-8');
assert(esLocalesFile.includes("musicscale_group_title:"), "es locales must contain musicscale_group_title");
assert(esLocalesFile.includes("org_group_title:"), "es locales must contain org_group_title");
assert(esLocalesFile.includes("help_group_title:"), "es locales must contain help_group_title");

console.log("SUCCESS: All MN-ORG-ROLES-SWITCH-PREMIUM-1 checks passed!");
