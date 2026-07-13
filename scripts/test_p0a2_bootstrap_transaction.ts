import { planBootstrap, BootstrapDecisionCode, normalizeLegacyOrganizationRole } from '../src/server/services/TenantBootstrapPlanner.js';
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

assertCondition('1. role member e organizationRole member retorna member', normalizeLegacyOrganizationRole('member', 'member') === 'member');
assertCondition('2. role ceo retorna null', normalizeLegacyOrganizationRole('ceo') === null);
assertCondition('3. organizationRole global_admin retorna null', normalizeLegacyOrganizationRole(undefined, 'global_admin') === null);
assertCondition('4. role ceo com organizationRole member retorna null', normalizeLegacyOrganizationRole('ceo', 'member') === null);
assertCondition('5. role owner com organizationRole member retorna null', normalizeLegacyOrganizationRole('owner', 'member') === null);
assertCondition('6. ausência dos dois papéis retorna null', normalizeLegacyOrganizationRole() === null);

const tc7 = planBootstrap([], [], [], {}, { exists: true, completed: true, organizationId: 'lockOrg', orgExists: true, orgActive: true, memberExists: true, memberActive: false }, 'user@example.com', nowMs);
assertCondition('7. trava com memberActive false retorna INCONSISTENT_BOOTSTRAP_STATE', tc7.code === BootstrapDecisionCode.INCONSISTENT_BOOTSTRAP_STATE);

const tc8 = planBootstrap([], [], [], {}, { exists: true, completed: true, organizationId: 'lockOrg', orgExists: true, orgActive: false, memberExists: true, memberActive: true }, 'user@example.com', nowMs);
assertCondition('8. trava com orgActive false retorna INCONSISTENT_BOOTSTRAP_STATE', tc8.code === BootstrapDecisionCode.INCONSISTENT_BOOTSTRAP_STATE);


const svcStr = fs.readFileSync(path.join(process.cwd(), 'src/server/services/TenantContextMutationService.ts'), 'utf8');

assertCondition('9. documento canônico exige d.id === uid', svcStr.includes('d.id === uid'));
assertCondition('10. organização canônica é derivada do caminho', svcStr.includes('d.ref.parent.parent!.id') || svcStr.includes('d.ref.parent.parent?.id'));
assertCondition('11. reparo usa sanitizedRole nos dois campos', svcStr.includes('role: legacyData?.sanitizedRole') && svcStr.includes('organizationRole: legacyData?.sanitizedRole'));
assertCondition('12. reparo não usa legacyData.role como papel final', !svcStr.includes('role: legacyData?.role'));
assertCondition('13. auth.getUser ocorre antes de runTransaction', svcStr.indexOf('auth.getUser') < svcStr.indexOf('db.runTransaction'));
assertCondition('14. falha de auth.getUser impede iniciar a transação', svcStr.includes("return res.status(500).json({ success: false, reasonCode: 'INTERNAL_ERROR' });") && svcStr.indexOf('catch (e)') < svcStr.indexOf('db.runTransaction'));
assertCondition('15. displayName do Auth é usado no perfil novo', svcStr.includes('displayName: userDisplayName'));
assertCondition('16. photoURL do Auth é usado no perfil novo', svcStr.includes('photoURL: userPhotoURL'));
assertCondition('17. bootstrapNowMs é criado antes de runTransaction', svcStr.indexOf('const bootstrapNowMs = Date.now();') < svcStr.indexOf('db.runTransaction'));

const bootstrapStr = svcStr.substring(svcStr.indexOf('export async function bootstrapUserContext'), svcStr.indexOf('export async function acceptInvitation'));
const transactionStr = bootstrapStr.substring(bootstrapStr.indexOf('db.runTransaction'));
assertCondition('18. callback da transação não contém Date.now()', !transactionStr.includes('Date.now()'));

assertCondition('19. convites são deduplicados por d.ref.path', svcStr.includes('inviteMap.set(d.ref.path'));

const hasBools = svcStr.match(/createdOrganization: (true|false)/g)!.length >= 3 && 
                 svcStr.match(/reusedExistingContext: (true|false)/g)!.length >= 3 &&
                 svcStr.match(/repairedLegacyMembership: (true|false)/g)!.length >= 3;
assertCondition('20. cada uma das três respostas de sucesso contém separadamente createdOrganization, reusedExistingContext, repairedLegacyMembership', hasBools);

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
