import { canInviteOrganizationRole } from '../src/lib/organizationRoles.js';
import { planInvitationCreation } from '../src/server/services/InvitationCreationPlanner.js';
import * as fs from 'fs';

let passed = 0;
let failed = 0;

function assertCondition(message: string, condition: boolean) {
  if (condition) {
    passed++;
    console.log(`[PASS] ${message}`);
  } else {
    failed++;
    console.error(`[FAIL] ${message}`);
  }
}

assertCondition("1. owner convida admin.", canInviteOrganizationRole({ organizationRole: 'owner' }, 'admin'));
assertCondition("2. owner convida manager.", canInviteOrganizationRole({ organizationRole: 'owner' }, 'manager'));
assertCondition("3. admin não convida admin.", !canInviteOrganizationRole({ organizationRole: 'admin' }, 'admin'));
assertCondition("4. admin convida manager.", canInviteOrganizationRole({ organizationRole: 'admin' }, 'manager'));
assertCondition("5. manager não convida manager.", !canInviteOrganizationRole({ organizationRole: 'manager' }, 'manager'));
assertCondition("6. manager convida member.", canInviteOrganizationRole({ organizationRole: 'manager' }, 'member'));
assertCondition("7. manager convida viewer.", canInviteOrganizationRole({ organizationRole: 'manager' }, 'viewer'));
assertCondition("8. member não convida.", !canInviteOrganizationRole({ organizationRole: 'member' }, 'member') && !canInviteOrganizationRole({ organizationRole: 'member' }, 'viewer'));
assertCondition("9. viewer não convida.", !canInviteOrganizationRole({ organizationRole: 'viewer' }, 'viewer'));
assertCondition("10. ecosystem_support não recebe matriz de owner.", !canInviteOrganizationRole({ systemRole: 'ecosystem_support' }, 'admin'));

function createBaseInput() {
  return {
    creator: { uid: 'user123' },
    creatorMembership: { exists: true, status: 'active', role: 'admin' },
    organization: { exists: true, organizationId: 'org123', name: 'My Org', status: 'active' },
    request: { organizationId: 'org123', email: 'test@example.com', role: 'member' },
    capacity: { resolved: true, mode: 'unlimited' },
    existingPendingInvitation: { exists: false }
  } as any;
}

const nowMs = Date.now();
let input = createBaseInput();
input.creatorMembership.role = 'admin';
input.request.role = 'admin';
let res = planInvitationCreation(input, nowMs);
assertCondition('11. planner reprova admin -> admin.', res.success === false && res.reasonCode === 'PERMISSION_DENIED');

input = createBaseInput();
input.creatorMembership.role = 'manager';
input.request.role = 'manager';
res = planInvitationCreation(input, nowMs);
assertCondition('12. planner reprova manager -> manager.', res.success === false && res.reasonCode === 'PERMISSION_DENIED');

const ecoHomeSrc = fs.readFileSync('src/components/dashboard/EcosystemWorkspaceHome.tsx', 'utf-8');
assertCondition("13. card Abrir MusicScale existe.", ecoHomeSrc.includes('workspace.open_musicscale_title') || ecoHomeSrc.includes('Abrir MusicScale'));
assertCondition("14. card principal ocupa o topo.", ecoHomeSrc.indexOf('Abrir MusicScale') < ecoHomeSrc.indexOf('workspace.org_and_access') || ecoHomeSrc.indexOf('open_musicscale_title') < ecoHomeSrc.indexOf('workspace.org_and_access'));
assertCondition("15. não existe Abrir sistema.", !ecoHomeSrc.includes('Abrir sistema'));
assertCondition("16. existe Primeiros passos.", ecoHomeSrc.includes('Primeiros passos') || ecoHomeSrc.includes('workspace.getting_started'));
assertCondition("17. existe Conhecer recursos.", ecoHomeSrc.includes('Conhecer recursos') || ecoHomeSrc.includes('workspace.know_resources'));
assertCondition("18. não existe Preciso de ajuda nessa Central.", !ecoHomeSrc.includes('Preciso de ajuda') && !ecoHomeSrc.includes('workspace.need_help'));
assertCondition("19. não existe Falar com Suporte nessa Central.", !ecoHomeSrc.includes('Falar com Suporte') && !ecoHomeSrc.includes('workspace.talk_to_support'));

const hasTeam = ecoHomeSrc.includes('Gerenciar equipe') || ecoHomeSrc.includes('workspace.manage_team');
const hasInvite = ecoHomeSrc.includes('Convidar pessoa') || ecoHomeSrc.includes('workspace.invite_person');
const hasSub = ecoHomeSrc.includes('Ver assinatura') || ecoHomeSrc.includes('workspace.view_subscription') || ecoHomeSrc.includes('plans_and_sub');
assertCondition("20. existem três cards de organização.", hasTeam && hasInvite && hasSub);

const ptSrc = fs.readFileSync('src/packages/i18n/locales/pt.ts', 'utf-8');
assertCondition("21. não existe ADMINISTRATIVE no PT.", !ptSrc.includes('ADMINISTRATIVE'));

assertCondition("22. PT, EN e ES possuem as novas chaves.", ptSrc.includes('open_musicscale_title') && fs.readFileSync('src/packages/i18n/locales/en.ts', 'utf-8').includes('open_musicscale_title') && fs.readFileSync('src/packages/i18n/locales/es.ts', 'utf-8').includes('open_musicscale_title'));

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
