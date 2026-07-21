import { planBootstrap, BootstrapDecisionCode, normalizeLegacyOrganizationRole, resolveLegacyMembershipCandidates } from '../src/server/services/TenantBootstrapPlanner.js';
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

const nowMs = 1000000000000;

// planBootstrap tests
const tc1 = planBootstrap([{ organizationId: 'org1', status: 'active', role: 'member' }], [], [], {}, { exists: false, completed: false }, 'user@example.com', nowMs);
assertCondition('1. membership canônica ativa é reutilizada', tc1.code === BootstrapDecisionCode.REUSE_CANONICAL_MEMBERSHIP && tc1.organizationId === 'org1');

const tc2 = planBootstrap([{ organizationId: 'org1', status: 'active', role: 'member' }, { organizationId: 'org2', status: 'active', role: 'member' }], [], [], { activeOrganizationId: 'org2' }, { exists: false, completed: false }, 'user@example.com', nowMs);
assertCondition('2. activeOrganizationId válido tem prioridade', tc2.organizationId === 'org2');

const tc3 = planBootstrap([{ organizationId: 'org1', status: 'active', role: 'member' }, { organizationId: 'org2', status: 'active', role: 'member' }], [], [], { primaryOrganizationId: 'org1' }, { exists: false, completed: false }, 'user@example.com', nowMs);
assertCondition('3. primaryOrganizationId válido tem prioridade quando active é inválido', tc3.organizationId === 'org1');

const tc4 = planBootstrap([{ organizationId: 'org1', status: 'active', role: 'member' }, { organizationId: 'org2', status: 'active', role: 'member' }], [], [], { organizationId: 'org2' }, { exists: false, completed: false }, 'user@example.com', nowMs);
assertCondition('4. organizationId legado do perfil é terceira prioridade', tc4.organizationId === 'org2');

const tc5a = planBootstrap([{ organizationId: 'orgB', status: 'active', role: 'member' }, { organizationId: 'orgA', status: 'active', role: 'member' }], [], [], {}, { exists: false, completed: false }, 'user@example.com', nowMs);
const tc5b = planBootstrap([{ organizationId: 'orgA', status: 'active', role: 'member' }, { organizationId: 'orgB', status: 'active', role: 'member' }], [], [], {}, { exists: false, completed: false }, 'user@example.com', nowMs);
assertCondition('5. seleção canônica por ordem alfabética é determinística', tc5a.organizationId === 'orgA' && tc5b.organizationId === 'orgA');

const tc6 = planBootstrap([], [{ organizationId: 'leg1', sourcePath: 'p1', sanitizedRole: 'member' }], [], {}, { exists: false, completed: false }, 'user@example.com', nowMs);
assertCondition('6. legado único gera REPAIR_LEGACY_MEMBERSHIP', tc6.code === BootstrapDecisionCode.REPAIR_LEGACY_MEMBERSHIP && tc6.organizationId === 'leg1');

const tc7 = planBootstrap([], [{ organizationId: 'leg1', sourcePath: 'p1', sanitizedRole: 'member' }, { organizationId: 'leg2', sourcePath: 'p2', sanitizedRole: 'member' }], [], {}, { exists: false, completed: false }, 'user@example.com', nowMs);
assertCondition('7. duas organizações legadas geram AMBIGUOUS_LEGACY_MEMBERSHIP', tc7.code === BootstrapDecisionCode.AMBIGUOUS_LEGACY_MEMBERSHIP);

const tc8 = planBootstrap([], [], [{ email: 'user@example.com', status: 'pending', expiresAtMs: nowMs + 10000 }], {}, { exists: false, completed: false }, 'user@example.com', nowMs);
assertCondition('8. convite pendente e futuro gera WAIT_FOR_INVITATION', tc8.code === BootstrapDecisionCode.WAIT_FOR_INVITATION);

const tc9 = planBootstrap([], [], [{ email: 'user@example.com', status: 'pending', expiresAtMs: nowMs - 10000 }], {}, { exists: false, completed: false }, 'user@example.com', nowMs);
assertCondition('9. convite expirado é ignorado', tc9.code === BootstrapDecisionCode.CREATE_PERSONAL_ORGANIZATION);

const tc10 = planBootstrap([], [], [], {}, { exists: false, completed: false }, 'user@example.com', nowMs);
assertCondition('10. ausência de contexto gera CREATE_PERSONAL_ORGANIZATION', tc10.code === BootstrapDecisionCode.CREATE_PERSONAL_ORGANIZATION);

const tc11 = planBootstrap([], [], [], {}, { exists: true, completed: true, organizationId: 'lockOrg', orgExists: true, orgActive: true, memberExists: true, memberActive: true }, 'user@example.com', nowMs);
assertCondition('11. trava válida gera REUSE_BOOTSTRAP_LOCK', tc11.code === BootstrapDecisionCode.REUSE_BOOTSTRAP_LOCK && tc11.organizationId === 'lockOrg');

const tc12 = planBootstrap([{ organizationId: 'org1', status: 'suspended', role: 'member' }], [], [], {}, { exists: false, completed: false }, 'user@example.com', nowMs);
assertCondition('12. membership suspensa não é reutilizada', tc12.code === BootstrapDecisionCode.CREATE_PERSONAL_ORGANIZATION);

// resolveLegacyMembershipCandidates tests
const r1 = resolveLegacyMembershipCandidates([
  { organizationId: 'org1', sourcePath: 'b', role: 'member', status: 'active' },
  { organizationId: 'org1', sourcePath: 'a', role: 'member', status: 'active' }
]);
assertCondition('13. dois ativos com papel member consolidam deterministicamente', r1.ok && r1.memberships[0].sourcePath === 'a');

const r2 = resolveLegacyMembershipCandidates([
  { organizationId: 'org1', sourcePath: 'a', role: 'member', status: 'active' },
  { organizationId: 'org1', sourcePath: 'b', role: 'member', status: 'active' }
]);
assertCondition('14. resultado não muda quando a ordem de entrada é invertida', r2.ok && r2.memberships[0].sourcePath === 'a');

const r3 = resolveLegacyMembershipCandidates([
  { organizationId: 'org1', sourcePath: 'a', role: 'ceo', status: 'active' },
  { organizationId: 'org1', sourcePath: 'b', role: 'member', status: 'active' }
]);
assertCondition('15. ativo ceo mais ativo member gera inconsistência', !r3.ok);

const r4 = resolveLegacyMembershipCandidates([
  { organizationId: 'org1', sourcePath: 'a', role: 'owner', status: 'active' },
  { organizationId: 'org1', sourcePath: 'b', role: 'member', status: 'active' }
]);
assertCondition('16. ativo owner mais ativo member gera inconsistência', !r4.ok);

const r5 = resolveLegacyMembershipCandidates([
  { organizationId: 'org1', sourcePath: 'a', role: 'member', status: 'active' },
  { organizationId: 'org1', sourcePath: 'b', role: 'member', status: 'suspended' }
]);
assertCondition('17. ativo member mais suspenso member gera inconsistência', !r5.ok);

const r6 = resolveLegacyMembershipCandidates([
  { organizationId: 'org1', sourcePath: 'a', role: 'member', status: 'unknown_status' }
]);
assertCondition('18. status desconhecido gera inconsistência', !r6.ok);

const r7 = resolveLegacyMembershipCandidates([
  { organizationId: 'org1', sourcePath: 'a', role: 'member', status: 'suspended' }
]);
assertCondition('19. somente documentos suspensos são ignorados', r7.ok && r7.memberships.length === 0);

const r8 = resolveLegacyMembershipCandidates([
  { organizationId: 'org1', sourcePath: 'a', status: 'active' }
]);
assertCondition('20. documento ativo sem papel gera inconsistência', !r8.ok);

const r9 = resolveLegacyMembershipCandidates([
  { organizationId: 'org1', sourcePath: 'org1/members/a', role: 'member', status: 'active' },
  { organizationId: 'org2', sourcePath: 'org2/members/a', role: 'member', status: 'active' }
]);
assertCondition('21. dois documentos com mesmo ID de arquivo em organizações diferentes permanecem separados pelo sourcePath completo', r9.ok && r9.memberships.length === 2 && r9.memberships[0].organizationId !== r9.memberships[1].organizationId);

const r10 = resolveLegacyMembershipCandidates([
  { organizationId: 'org1', sourcePath: 'a', role: 'member', status: 'active', extraField: 'test' } as any
]);
assertCondition('22. resultado contém apenas campos sanitizados', r10.ok && Object.keys(r10.memberships[0]).every(k => ['organizationId', 'sourcePath', 'sanitizedRole', 'createdAtMs'].includes(k)));

// Structural tests
const svcStr = fs.readFileSync(path.join(process.cwd(), 'src/server/services/TenantContextMutationService.ts'), 'utf8');
const bootstrapStr = svcStr.substring(svcStr.indexOf('export async function bootstrapUserContext'), svcStr.indexOf('export async function acceptInvitation'));

assertCondition('23. bootstrap usa runTransaction', bootstrapStr.includes('db.runTransaction'));
assertCondition('24. tenantBootstrapLocks continua presente', svcStr.includes('tenantBootstrapLocks'));
assertCondition('25. não existe const db = getFirestore() no topo do módulo', !svcStr.match(/^const db = getFirestore\(\);$/m));
assertCondition('26. acceptInvitation continua exportado', svcStr.includes('export async function acceptInvitation'));
assertCondition('27. setActiveOrganization continua exportado', svcStr.includes('export async function setActiveOrganization'));

const hasForbidden = ['plan:', 'products:', 'appsAccess:', 'enabledApps:', 'entitlements:', 'subscription:', 'subscriptionStatus:', 'lifetimeAccess:'].some(f => bootstrapStr.includes(f));
assertCondition('28. bootstrap não cria campos proibidos (plan, products, appsAccess, enabledApps, entitlements, subscription, subscriptionStatus, lifetimeAccess)', !hasForbidden);

assertCondition('29. não existe ...legacyData', !bootstrapStr.includes('...legacyData'));
assertCondition('30. consultas legadas incluem uid e user_id', bootstrapStr.includes("where('uid', '==', uid)") && bootstrapStr.includes("where('user_id', '==', uid)"));

const hasBools = bootstrapStr.match(/createdOrganization: (true|false)/g)!.length >= 3 && 
                 bootstrapStr.match(/reusedExistingContext: (true|false)/g)!.length >= 3 &&
                 bootstrapStr.match(/repairedLegacyMembership: (true|false)/g)!.length >= 3;
assertCondition('31. respostas de sucesso possuem os três booleanos', hasBools);

assertCondition('32. role member e organizationRole member retorna member', normalizeLegacyOrganizationRole('member', 'member') === 'member');
assertCondition('33. role ceo retorna null', normalizeLegacyOrganizationRole('ceo') === null);
assertCondition('34. organizationRole global_admin retorna null', normalizeLegacyOrganizationRole(undefined, 'global_admin') === null);
assertCondition('35. role ceo com organizationRole member retorna null', normalizeLegacyOrganizationRole('ceo', 'member') === null);
assertCondition('36. role owner com organizationRole member retorna null', normalizeLegacyOrganizationRole('owner', 'member') === null);
assertCondition('37. ausência dos dois papéis retorna null', normalizeLegacyOrganizationRole() === null);

const tc38 = planBootstrap([], [], [], {}, { exists: true, completed: true, organizationId: 'lockOrg', orgExists: true, orgActive: true, memberExists: true, memberActive: false }, 'user@example.com', nowMs);
assertCondition('38. trava com memberActive false retorna INCONSISTENT_BOOTSTRAP_STATE', tc38.code === BootstrapDecisionCode.INCONSISTENT_BOOTSTRAP_STATE);

const tc39 = planBootstrap([], [], [], {}, { exists: true, completed: true, organizationId: 'lockOrg', orgExists: true, orgActive: false, memberExists: true, memberActive: true }, 'user@example.com', nowMs);
assertCondition('39. trava com orgActive false retorna INCONSISTENT_BOOTSTRAP_STATE', tc39.code === BootstrapDecisionCode.INCONSISTENT_BOOTSTRAP_STATE);

const r40a = resolveLegacyMembershipCandidates([
  { organizationId: 'orgA', sourcePath: 'a', role: 'member', status: 'active' },
  { organizationId: 'orgB', sourcePath: 'b', role: 'member', status: 'active' }
]);
const r40b = resolveLegacyMembershipCandidates([
  { organizationId: 'orgB', sourcePath: 'b', role: 'member', status: 'active' },
  { organizationId: 'orgA', sourcePath: 'a', role: 'member', status: 'active' }
]);
assertCondition('40. a ordem do resultado de resolveLegacyMembershipCandidates é idêntica independentemente da ordem de entrada', r40a.ok && r40b.ok && JSON.stringify(r40a.memberships) === JSON.stringify(r40b.memberships) && r40a.memberships[0].organizationId === 'orgA' && r40a.memberships[1].organizationId === 'orgB');

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

