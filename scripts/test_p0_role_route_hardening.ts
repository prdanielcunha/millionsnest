import { readFileSync } from 'fs';

const server = readFileSync('server.ts', 'utf8');
let passed = 0;
function check(name: string, condition: boolean) {
  if (!condition) throw new Error(`FAIL: ${name}`);
  passed += 1;
  console.log(`PASS ${String(passed).padStart(2, '0')}: ${name}`);
}

check('canonical PATCH role route is registered', server.includes("app.patch('/api/v1/organizations/:organizationId/members/:memberId/role'"));
check('legacy role route delegates to canonical handler', server.includes("app.post('/api/organizations/:orgId/members/:memberId/role', express.json({ limit: '8kb' }), (req: any, res) => updateOrganizationMemberRole(req, res));"));
check('legacy route no longer contains old ORG_RANK role mutation implementation', !server.includes("const ORG_RANK: Record<string, number> = { guest: 5, member: 10, secretary: 20, leader: 30, admin: 70, owner: 100 };"));
check('legacy role route no longer directly writes canonical role', !server.includes("targetNewRole: newRole,\n        scope: 'organization',\n        organizationId: orgId,\n        action: isSelfDemotion ? 'role.self_downgraded' : 'role.updated'"));
check('profile endpoint rejects role/appRole mutation', server.includes("reasonCode: 'ROLE_MUTATION_REQUIRES_CANONICAL_COMMAND'"));
check('profile endpoint gate checks both role and appRole', server.includes('if (role !== undefined || appRole !== undefined)'));
check('canonical organization role command is imported', server.includes("import { updateOrganizationMemberRole } from './src/server/services/OrganizationRoleCommandService.js';"));

console.log(`ROLE_ROUTE_HARDENING_PASS=${passed}`);
