import { planBootstrap, BootstrapDecisionCode } from '../src/server/services/TenantBootstrapPlanner.js';
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

// Test cases
const tc1 = planBootstrap(
  [{ organizationId: 'org1', status: 'active', role: 'member' }],
  [],
  [],
  {},
  { exists: false, completed: false },
  'user@example.com'
);
assertCondition('1. membership canônica ativa é reutilizada', tc1.code === BootstrapDecisionCode.REUSE_CANONICAL_MEMBERSHIP && tc1.organizationId === 'org1');

const tc2 = planBootstrap(
  [{ organizationId: 'org1', status: 'active', role: 'member' }, { organizationId: 'org2', status: 'active', role: 'member' }],
  [],
  [],
  { activeOrganizationId: 'org2' },
  { exists: false, completed: false },
  'user@example.com'
);
assertCondition('2. activeOrganizationId válido tem prioridade', tc2.organizationId === 'org2');

const tc3 = planBootstrap(
  [{ organizationId: 'org1', status: 'active', role: 'member' }, { organizationId: 'org2', status: 'active', role: 'member' }],
  [],
  [],
  { primaryOrganizationId: 'org1' },
  { exists: false, completed: false },
  'user@example.com'
);
assertCondition('3. primaryOrganizationId válido é preservado', tc3.organizationId === 'org1');

const tc4 = planBootstrap(
  [],
  [{ organizationId: 'leg1', status: 'active', role: 'member' }],
  [],
  {},
  { exists: false, completed: false },
  'user@example.com'
);
assertCondition('4. legado único gera reparo', tc4.code === BootstrapDecisionCode.REPAIR_LEGACY_MEMBERSHIP && tc4.organizationId === 'leg1');

const tc5 = planBootstrap(
  [],
  [{ organizationId: 'leg1', status: 'active', role: 'member' }, { organizationId: 'leg2', status: 'active', role: 'member' }],
  [],
  {},
  { exists: false, completed: false },
  'user@example.com'
);
assertCondition('5. múltiplos legados geram ambiguidade', tc5.code === BootstrapDecisionCode.AMBIGUOUS_LEGACY_MEMBERSHIP);

const tc6 = planBootstrap(
  [],
  [],
  [{ email: 'user@example.com', status: 'pending', expiresAt: new Date(Date.now() + 10000) }],
  {},
  { exists: false, completed: false },
  'USER@EXAMPLE.COM'
);
assertCondition('6. convite pendente impede organização pessoal', tc6.code === BootstrapDecisionCode.WAIT_FOR_INVITATION);

const tc7 = planBootstrap(
  [],
  [],
  [],
  {},
  { exists: false, completed: false },
  'user@example.com'
);
assertCondition('7. ausência de contexto gera organização pessoal', tc7.code === BootstrapDecisionCode.CREATE_PERSONAL_ORGANIZATION);

const tc8 = planBootstrap(
  [],
  [],
  [],
  {},
  { exists: true, completed: true, organizationId: 'lockOrg', orgExists: true, memberExists: true },
  'user@example.com'
);
assertCondition('8. trava válida reutiliza a organização', tc8.code === BootstrapDecisionCode.REUSE_BOOTSTRAP_LOCK && tc8.organizationId === 'lockOrg');

const tc9 = planBootstrap(
  [],
  [],
  [],
  {},
  { exists: true, completed: false, organizationId: 'lockOrg' },
  'user@example.com'
);
assertCondition('9. trava inconsistente falha', tc9.code === BootstrapDecisionCode.INCONSISTENT_BOOTSTRAP_STATE);

const tc10 = planBootstrap(
  [{ organizationId: 'org1', status: 'suspended', role: 'member' }],
  [],
  [],
  {},
  { exists: false, completed: false },
  'user@example.com'
);
assertCondition('10. memberships suspensas não são escolhidas como ativas', tc10.code === BootstrapDecisionCode.CREATE_PERSONAL_ORGANIZATION);

const tc11a = planBootstrap(
  [{ organizationId: 'orgB', status: 'active', role: 'member' }, { organizationId: 'orgA', status: 'active', role: 'member' }],
  [],
  [],
  {},
  { exists: false, completed: false },
  'user@example.com'
);
const tc11b = planBootstrap(
  [{ organizationId: 'orgA', status: 'active', role: 'member' }, { organizationId: 'orgB', status: 'active', role: 'member' }],
  [],
  [],
  {},
  { exists: false, completed: false },
  'user@example.com'
);
assertCondition('11. a decisão é determinística', tc11a.organizationId === 'orgA' && tc11b.organizationId === 'orgA');

const svcStr = fs.readFileSync(path.join(process.cwd(), 'src/server/services/TenantContextMutationService.ts'), 'utf8');

assertCondition('12. nenhum plano, produto, app ou entitlement é criado', !svcStr.includes("subscriptionStatus: 'none'") && !svcStr.includes("products: []") && !svcStr.includes("plan:") && !svcStr.includes("entitlements:"));

assertCondition('13. bootstrap usa runTransaction', svcStr.includes('db.runTransaction'));
assertCondition('14. existe tenantBootstrapLocks', svcStr.includes('tenantBootstrapLocks'));
assertCondition('15. não existe const db = getFirestore() no topo do módulo', !svcStr.match(/^const db = getFirestore\(\);$/m));
assertCondition('16. acceptInvitation continua exportado', svcStr.includes('export async function acceptInvitation'));
assertCondition('17. setActiveOrganization continua exportado', svcStr.includes('export async function setActiveOrganization'));

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
