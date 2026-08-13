import { readFileSync } from 'fs';

const server = readFileSync('server.ts', 'utf8');
let passed = 0;
function check(name: string, condition: boolean) {
  if (!condition) throw new Error(`FAIL: ${name}`);
  passed += 1;
  console.log(`PASS ${String(passed).padStart(2, '0')}: ${name}`);
}

const legacyRoute = "app.post('/api/organizations/:orgId/members/:memberId/role', express.json({ limit: '8kb' }), (req: any, res) => updateOrganizationMemberRole(req, res));";
const legacyRouteIndex = server.indexOf(legacyRoute);
const nextRouteIndex = legacyRouteIndex >= 0 ? server.indexOf('\n\n  app.', legacyRouteIndex + legacyRoute.length) : -1;
const legacyRouteBlock = legacyRouteIndex >= 0
  ? server.slice(legacyRouteIndex, nextRouteIndex >= 0 ? nextRouteIndex : legacyRouteIndex + legacyRoute.length)
  : '';

check('canonical PATCH role route is registered', server.includes("app.patch('/api/v1/organizations/:organizationId/members/:memberId/role'"));
check('legacy role route delegates to canonical handler', legacyRouteIndex >= 0);
check('legacy role route block is delegation-only', legacyRouteBlock.trim() === legacyRoute);
check('legacy role route block contains no old ORG_RANK mutation logic', !legacyRouteBlock.includes('ORG_RANK'));
check('legacy role route block contains no direct canonical or legacy writes', !/\.(set|update|delete)\s*\(/.test(legacyRouteBlock) && !legacyRouteBlock.includes('organization_members'));
check('profile endpoint rejects role/appRole mutation', server.includes("reasonCode: 'ROLE_MUTATION_REQUIRES_CANONICAL_COMMAND'"));
check('profile endpoint gate checks both role and appRole', server.includes('if (role !== undefined || appRole !== undefined)'));
check('canonical organization role command is imported', server.includes("import { updateOrganizationMemberRole } from './src/server/services/OrganizationRoleCommandService.js';"));

console.log(`ROLE_ROUTE_HARDENING_PASS=${passed}`);
