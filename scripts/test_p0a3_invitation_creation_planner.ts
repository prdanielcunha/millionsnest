import {
  planInvitationCreation,
  isInvitationCreatorGlobalRole,
  isInvitationCreatorMembershipRole,
  isValidInvitationCreationEmail,
  INVITATION_TTL_MS,
  InvitationCreationInput
} from '../src/server/services/InvitationCreationPlanner.js';
import * as fs from 'fs';
import * as path from 'path';

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

function runTests() {
  return new Promise<void>((resolve) => {
    // Global Roles
    assertCondition('1. ceo é papel global válido', isInvitationCreatorGlobalRole('ceo'));
    assertCondition('2. global_admin é válido', isInvitationCreatorGlobalRole('global_admin'));
    assertCondition('3. ecosystem_owner é válido', isInvitationCreatorGlobalRole('ecosystem_owner'));
    assertCondition('4. founder é válido', isInvitationCreatorGlobalRole('founder'));
    assertCondition('5. admin não é papel global', !isInvitationCreatorGlobalRole('admin'));
    assertCondition('6. owner não é papel global', !isInvitationCreatorGlobalRole('owner'));
    
    // Org Roles
    assertCondition('7. owner é papel organizacional válido', isInvitationCreatorMembershipRole('owner'));
    assertCondition('8. admin é papel organizacional válido', isInvitationCreatorMembershipRole('admin'));
    assertCondition('9. member é papel organizacional válido', isInvitationCreatorMembershipRole('member'));
    
    const nowMs = 1700000000000;
    
    function createBaseInput(): InvitationCreationInput {
      return {
        creator: { uid: 'user123' },
        creatorMembership: { exists: true, status: 'active', role: 'admin' },
        organization: { exists: true, organizationId: 'org123', name: 'My Org', status: 'active' },
        request: { organizationId: 'org123', email: 'test@example.com', role: 'member' },
        capacity: { resolved: true, mode: 'unlimited' },
        existingPendingInvitation: { exists: false }
      };
    }

    // Auth
    let input = createBaseInput();
    input.creator.uid = undefined;
    assertCondition('10. UID ausente falha', planInvitationCreation(input, nowMs).success === false && !planInvitationCreation(input, nowMs).success && (planInvitationCreation(input, nowMs) as any).reasonCode === 'UNAUTHENTICATED');
    
    input = createBaseInput();
    input.creator.uid = '   ';
    assertCondition('11. UID vazio falha', planInvitationCreation(input, nowMs).success === false && (planInvitationCreation(input, nowMs) as any).reasonCode === 'UNAUTHENTICATED');

    // Org ID
    input = createBaseInput();
    assertCondition('12. organizationId válido é aceito', planInvitationCreation(input, nowMs).success === true);
    
    input = createBaseInput();
    input.request.organizationId = 'invalid id!';
    assertCondition('13. organizationId inválido falha', planInvitationCreation(input, nowMs).success === false && (planInvitationCreation(input, nowMs) as any).reasonCode === 'INVALID_ORGANIZATION_ID');
    
    input = createBaseInput();
    input.request.organizationId = 'org123';
    input.organization.organizationId = 'org456';
    assertCondition('14. IDs divergentes falham', planInvitationCreation(input, nowMs).success === false && (planInvitationCreation(input, nowMs) as any).reasonCode === 'ORGANIZATION_STATE_INCONSISTENT');
    
    // Org State
    input = createBaseInput();
    input.organization.exists = false;
    assertCondition('15. organização inexistente falha', planInvitationCreation(input, nowMs).success === false && (planInvitationCreation(input, nowMs) as any).reasonCode === 'ORGANIZATION_NOT_FOUND');
    
    input = createBaseInput();
    input.organization.status = 'inactive';
    assertCondition('16. organização inactive falha', planInvitationCreation(input, nowMs).success === false && (planInvitationCreation(input, nowMs) as any).reasonCode === 'ORGANIZATION_INACTIVE');
    
    input = createBaseInput();
    input.organization.status = 'archived';
    assertCondition('17. organização archived falha', planInvitationCreation(input, nowMs).success === false && (planInvitationCreation(input, nowMs) as any).reasonCode === 'ORGANIZATION_INACTIVE');
    
    input = createBaseInput();
    input.organization.name = undefined;
    assertCondition('18. nome ausente falha', planInvitationCreation(input, nowMs).success === false && (planInvitationCreation(input, nowMs) as any).reasonCode === 'ORGANIZATION_STATE_INCONSISTENT');
    
    input = createBaseInput();
    input.organization.name = '   ';
    assertCondition('19. nome vazio falha', planInvitationCreation(input, nowMs).success === false && (planInvitationCreation(input, nowMs) as any).reasonCode === 'ORGANIZATION_STATE_INCONSISTENT');

    // Roles & Memberships
    input = createBaseInput();
    input.creatorMembership.exists = false;
    input.creator.globalRole = 'ceo';
    assertCondition('20. global canônico cria sem membership', planInvitationCreation(input, nowMs).success === true);
    
    input = createBaseInput();
    input.creatorMembership.role = 'owner';
    assertCondition('21. owner ativo cria', planInvitationCreation(input, nowMs).success === true);
    
    input = createBaseInput();
    input.creatorMembership.role = 'admin';
    assertCondition('22. admin ativo cria', planInvitationCreation(input, nowMs).success === true);
    
    input = createBaseInput();
    input.creatorMembership.role = 'member';
    assertCondition('23. member ativo é negado', planInvitationCreation(input, nowMs).success === false && (planInvitationCreation(input, nowMs) as any).reasonCode === 'PERMISSION_DENIED');
    
    input = createBaseInput();
    input.creatorMembership.exists = false;
    assertCondition('24. membership inexistente falha', planInvitationCreation(input, nowMs).success === false && (planInvitationCreation(input, nowMs) as any).reasonCode === 'ACTOR_MEMBERSHIP_REQUIRED');
    
    input = createBaseInput();
    input.creatorMembership.status = 'suspended';
    assertCondition('25. membership suspensa falha', planInvitationCreation(input, nowMs).success === false && (planInvitationCreation(input, nowMs) as any).reasonCode === 'ACTOR_MEMBERSHIP_INACTIVE');
    
    input = createBaseInput();
    input.creatorMembership.status = 'inactive';
    assertCondition('26. membership inactive falha', planInvitationCreation(input, nowMs).success === false && (planInvitationCreation(input, nowMs) as any).reasonCode === 'ACTOR_MEMBERSHIP_INACTIVE');
    
    input = createBaseInput();
    input.creatorMembership.status = 'pending';
    assertCondition('27. membership com status desconhecido falha', planInvitationCreation(input, nowMs).success === false && (planInvitationCreation(input, nowMs) as any).reasonCode === 'ACTOR_MEMBERSHIP_STATE_INCONSISTENT');
    
    input = createBaseInput();
    input.creatorMembership.role = undefined;
    assertCondition('28. membership ativa sem papel falha', planInvitationCreation(input, nowMs).success === false && (planInvitationCreation(input, nowMs) as any).reasonCode === 'ACTOR_MEMBERSHIP_STATE_INCONSISTENT');
    
    input = createBaseInput();
    input.creatorMembership.role = 'unknown_role';
    assertCondition('29. membership ativa com papel desconhecido falha', planInvitationCreation(input, nowMs).success === false && (planInvitationCreation(input, nowMs) as any).reasonCode === 'ACTOR_MEMBERSHIP_STATE_INCONSISTENT');

    // Email
    assertCondition('30. e-mail válido é aceito', isValidInvitationCreationEmail('test@example.com'));
    
    input = createBaseInput();
    input.request.email = '  UPPER@EXAMPLE.COM  ';
    let res = planInvitationCreation(input, nowMs);
    assertCondition('31. e-mail é normalizado para lowercase', res.success && res.email === 'upper@example.com');
    assertCondition('32. espaços externos são normalizados', res.success && res.email === 'upper@example.com');
    
    assertCondition('33. e-mail sem @ falha', !isValidInvitationCreationEmail('testexample.com'));
    assertCondition('34. e-mail com dois @ falha', !isValidInvitationCreationEmail('test@@example.com'));
    assertCondition('35. parte local vazia falha', !isValidInvitationCreationEmail('@example.com'));
    assertCondition('36. domínio vazio falha', !isValidInvitationCreationEmail('test@'));
    assertCondition('37. domínio sem ponto falha', !isValidInvitationCreationEmail('test@example'));
    assertCondition('38. e-mail com espaço interno falha', !isValidInvitationCreationEmail('test @example.com'));
    assertCondition('39. e-mail com controle falha', !isValidInvitationCreationEmail('test\x00@example.com'));
    assertCondition('40. e-mail acima de 254 falha', !isValidInvitationCreationEmail('a'.repeat(250) + '@example.com'));

    // Request Role
    input = createBaseInput();
    input.request.role = 'member';
    assertCondition('41. role member é aceita', planInvitationCreation(input, nowMs).success === true);
    
    input = createBaseInput();
    input.request.role = 'admin';
    assertCondition('42. role admin é aceita', planInvitationCreation(input, nowMs).success === true);
    
    input = createBaseInput();
    input.request.role = 'owner';
    assertCondition('43. role owner é rejeitada', planInvitationCreation(input, nowMs).success === false && (planInvitationCreation(input, nowMs) as any).reasonCode === 'INVALID_INVITE_ROLE');
    
    input = createBaseInput();
    input.request.role = 'ceo';
    assertCondition('44. role ceo é rejeitada', planInvitationCreation(input, nowMs).success === false && (planInvitationCreation(input, nowMs) as any).reasonCode === 'INVALID_INVITE_ROLE');

    // Existing Pending
    input = createBaseInput();
    input.existingPendingInvitation = {
      exists: true,
      status: 'pending',
      emailNormalized: 'test@example.com',
      expiresAtMs: nowMs + 1000
    };
    assertCondition('45. convite pendente futuro igual bloqueia', planInvitationCreation(input, nowMs).success === false && (planInvitationCreation(input, nowMs) as any).reasonCode === 'INVITE_ALREADY_PENDING');
    
    input.existingPendingInvitation.expiresAtMs = undefined;
    assertCondition('46. convite pending malformado falha', planInvitationCreation(input, nowMs).success === false && (planInvitationCreation(input, nowMs) as any).reasonCode === 'INVITE_STATE_INCONSISTENT');
    
    input.existingPendingInvitation.expiresAtMs = nowMs - 1000;
    assertCondition('47. convite expirado não bloqueia', planInvitationCreation(input, nowMs).success === true);
    
    input.existingPendingInvitation.expiresAtMs = nowMs + 1000;
    input.existingPendingInvitation.revokedAtMs = nowMs - 1000;
    assertCondition('48. convite revogado não bloqueia', planInvitationCreation(input, nowMs).success === true);
    
    input = createBaseInput();
    input.existingPendingInvitation = { exists: true, status: 'accepted' };
    assertCondition('49. convite accepted não bloqueia', planInvitationCreation(input, nowMs).success === true);

    // Capacity
    input = createBaseInput();
    input.capacity.resolved = false;
    assertCondition('50. capacidade unresolved falha fechada', planInvitationCreation(input, nowMs).success === false && (planInvitationCreation(input, nowMs) as any).reasonCode === 'MEMBER_LIMIT_UNAVAILABLE');
    
    input = createBaseInput();
    input.capacity.mode = 'unlimited';
    assertCondition('51. unlimited permite', planInvitationCreation(input, nowMs).success === true);
    
    input = createBaseInput();
    input.capacity.mode = 'limited';
    input.capacity.occupiedSlots = 5;
    input.capacity.maxMembers = 10;
    assertCondition('52. limited com vaga permite', planInvitationCreation(input, nowMs).success === true);
    
    input.capacity.occupiedSlots = 10;
    assertCondition('53. limited no limite bloqueia', planInvitationCreation(input, nowMs).success === false && (planInvitationCreation(input, nowMs) as any).reasonCode === 'MEMBER_LIMIT_REACHED');
    
    input.capacity.occupiedSlots = 11;
    assertCondition('54. limited acima do limite é inválido', planInvitationCreation(input, nowMs).success === false && (planInvitationCreation(input, nowMs) as any).reasonCode === 'MEMBER_LIMIT_INVALID');
    
    input.capacity.occupiedSlots = 5.5;
    assertCondition('55. occupiedSlots fracionário é inválido', planInvitationCreation(input, nowMs).success === false && (planInvitationCreation(input, nowMs) as any).reasonCode === 'MEMBER_LIMIT_INVALID');
    
    input.capacity.occupiedSlots = 0;
    input.capacity.maxMembers = 0;
    assertCondition('56. maxMembers zero é inválido', planInvitationCreation(input, nowMs).success === false && (planInvitationCreation(input, nowMs) as any).reasonCode === 'MEMBER_LIMIT_INVALID');
    
    input.capacity.mode = 'unknown' as any;
    assertCondition('57. mode desconhecido é inválido', planInvitationCreation(input, nowMs).success === false && (planInvitationCreation(input, nowMs) as any).reasonCode === 'MEMBER_LIMIT_INVALID');

    // nowMs
    input = createBaseInput();
    assertCondition('58. nowMs NaN falha', planInvitationCreation(input, NaN).success === false && (planInvitationCreation(input, NaN) as any).reasonCode === 'INVITE_STATE_INCONSISTENT');
    assertCondition('59. nowMs negativo falha', planInvitationCreation(input, -1).success === false && (planInvitationCreation(input, -1) as any).reasonCode === 'INVITE_STATE_INCONSISTENT');
    assertCondition('60. nowMs fracionário falha', planInvitationCreation(input, 100.5).success === false && (planInvitationCreation(input, 100.5) as any).reasonCode === 'INVITE_STATE_INCONSISTENT');
    assertCondition('61. overflow da expiração falha', planInvitationCreation(input, Number.MAX_SAFE_INTEGER).success === false && (planInvitationCreation(input, Number.MAX_SAFE_INTEGER) as any).reasonCode === 'INVITE_STATE_INCONSISTENT');

    // Success Object
    input = createBaseInput();
    res = planInvitationCreation(input, nowMs);
    if (res.success) {
      assertCondition('62. sucesso possui maxUses 1', res.maxUses === 1);
      assertCondition('63. sucesso possui useCount 0', res.useCount === 0);
      assertCondition('64. sucesso não possui usedCount', !('usedCount' in res));
      assertCondition('65. sucesso não possui invitedEmail', !('invitedEmail' in res));
      assertCondition('66. sucesso não possui token', !('token' in res));
      assertCondition('67. sucesso não possui tokenHash', !('tokenHash' in res));
      assertCondition('68. expiresAtMs é exatamente nowMs + 604800000', res.expiresAtMs === nowMs + 604800000);
    } else {
      assertCondition('62. sucesso possui maxUses 1', false);
      assertCondition('63. sucesso possui useCount 0', false);
      assertCondition('64. sucesso não possui usedCount', false);
      assertCondition('65. sucesso não possui invitedEmail', false);
      assertCondition('66. sucesso não possui token', false);
      assertCondition('67. sucesso não possui tokenHash', false);
      assertCondition('68. expiresAtMs é exatamente nowMs + 604800000', false);
    }

    const plannerPath = path.resolve(process.cwd(), 'src/server/services/InvitationCreationPlanner.ts');
    const plannerContent = fs.readFileSync(plannerPath, 'utf-8');
    
    assertCondition('69. planner não usa Math.random', !plannerContent.includes('Math.random'));
    assertCondition('70. planner não usa crypto', !plannerContent.includes('crypto.') && !plannerContent.includes('randomBytes') && !plannerContent.includes('randomUUID'));
    assertCondition('71. planner não usa Date', !plannerContent.includes('Date.now') && !plannerContent.includes('new Date'));
    assertCondition('72. planner não usa Firebase', !plannerContent.includes('firebase') && !plannerContent.includes('firestore') && !plannerContent.includes('admin.'));
    assertCondition('73. planner não usa browser globals', !plannerContent.includes('window.') && !plannerContent.includes('document.') && !plannerContent.includes('navigator.') && !plannerContent.includes('sessionStorage') && !plannerContent.includes('localStorage'));
    assertCondition('74. planner não usa any', !plannerContent.includes(' any ') && !plannerContent.includes(': any'));
    assertCondition('75. planner não usa as ' + 'any', !plannerContent.includes('as ' + 'any'));
    assertCondition('76. planner não usa unknown ' + 'as', !plannerContent.includes('unknown ' + 'as'));
    assertCondition('77. planner não contém logs', !plannerContent.includes('console.log') && !plannerContent.includes('console.error') && !plannerContent.includes('console.warn'));

    const rootDir = process.cwd();
    const prohibitedFiles = [
      'report.txt',
      'test_results.txt',
      'results.txt',
      'validation-report.txt',
      'validation_report.txt',
      'test-output.txt',
      'test_output.txt',
      'build-output.txt',
      'lint-output.txt'
    ];
    assertCondition('78. report.txt não existe', !fs.existsSync(path.join(rootDir, 'report.txt')));
    assertCondition('79. nenhum arquivo de relatório proibido existe', prohibitedFiles.every(f => !fs.existsSync(path.join(rootDir, f))));

    console.log(`\nResults: ${passed} passed, ${failed} failed`);
    if (failed > 0) {
      process.exitCode = 1;
    }
    resolve();
  });
}

runTests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
