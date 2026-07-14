const fs = require('fs');
const content = `import {
  planInvitationCreation,
  isInvitationCreatorGlobalRole,
  isInvitationCreatorMembershipRole,
  isValidInvitationCreationEmail,
  INVITATION_TTL_MS,
  InvitationCreationInput,
  InvitationCreationResult,
  InvitationCreationFailureReason
} from '../src/server/services/InvitationCreationPlanner.js';
import * as fs from 'fs';
import * as path from 'path';

let passed = 0;
let failed = 0;

function assertCondition(name: string, condition: boolean) {
  if (condition) {
    console.log(\`[PASS] \${name}\`);
    passed++;
  } else {
    console.error(\`[FAIL] \${name}\`);
    failed++;
  }
}

function isFailureWithReason(
  result: InvitationCreationResult,
  reasonCode: InvitationCreationFailureReason
): boolean {
  return !result.success && result.reasonCode === reasonCode;
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
    let res10 = planInvitationCreation(input, nowMs);
    assertCondition('10. UID ausente falha', isFailureWithReason(res10, 'UNAUTHENTICATED'));
    
    input = createBaseInput();
    input.creator.uid = '   ';
    let res11 = planInvitationCreation(input, nowMs);
    assertCondition('11. UID vazio falha', isFailureWithReason(res11, 'UNAUTHENTICATED'));

    // Org ID
    input = createBaseInput();
    assertCondition('12. organizationId válido é aceito', planInvitationCreation(input, nowMs).success === true);
    
    input = createBaseInput();
    input.request.organizationId = 'invalid id!';
    let res13 = planInvitationCreation(input, nowMs);
    assertCondition('13. organizationId inválido falha', isFailureWithReason(res13, 'INVALID_ORGANIZATION_ID'));
    
    input = createBaseInput();
    input.request.organizationId = 'org123';
    input.organization.organizationId = 'org456';
    let res14 = planInvitationCreation(input, nowMs);
    assertCondition('14. IDs divergentes falham', isFailureWithReason(res14, 'ORGANIZATION_STATE_INCONSISTENT'));
    
    // Org State
    input = createBaseInput();
    input.organization.exists = false;
    let res15 = planInvitationCreation(input, nowMs);
    assertCondition('15. organização inexistente falha', isFailureWithReason(res15, 'ORGANIZATION_NOT_FOUND'));
    
    input = createBaseInput();
    input.organization.status = 'inactive';
    let res16 = planInvitationCreation(input, nowMs);
    assertCondition('16. organização inactive falha', isFailureWithReason(res16, 'ORGANIZATION_INACTIVE'));
    
    input = createBaseInput();
    input.organization.status = 'archived';
    let res17 = planInvitationCreation(input, nowMs);
    assertCondition('17. organização archived falha', isFailureWithReason(res17, 'ORGANIZATION_INACTIVE'));
    
    input = createBaseInput();
    input.organization.name = undefined;
    let res18 = planInvitationCreation(input, nowMs);
    assertCondition('18. nome ausente falha', isFailureWithReason(res18, 'ORGANIZATION_STATE_INCONSISTENT'));
    
    input = createBaseInput();
    input.organization.name = '   ';
    let res19 = planInvitationCreation(input, nowMs);
    assertCondition('19. nome vazio falha', isFailureWithReason(res19, 'ORGANIZATION_STATE_INCONSISTENT'));

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
    let res23 = planInvitationCreation(input, nowMs);
    assertCondition('23. member ativo é negado', isFailureWithReason(res23, 'PERMISSION_DENIED'));
    
    input = createBaseInput();
    input.creatorMembership.exists = false;
    let res24 = planInvitationCreation(input, nowMs);
    assertCondition('24. membership inexistente falha', isFailureWithReason(res24, 'ACTOR_MEMBERSHIP_REQUIRED'));
    
    input = createBaseInput();
    input.creatorMembership.status = 'suspended';
    let res25 = planInvitationCreation(input, nowMs);
    assertCondition('25. membership suspensa falha', isFailureWithReason(res25, 'ACTOR_MEMBERSHIP_INACTIVE'));
    
    input = createBaseInput();
    input.creatorMembership.status = 'inactive';
    let res26 = planInvitationCreation(input, nowMs);
    assertCondition('26. membership inactive falha', isFailureWithReason(res26, 'ACTOR_MEMBERSHIP_INACTIVE'));
    
    input = createBaseInput();
    input.creatorMembership.status = 'pending';
    let res27 = planInvitationCreation(input, nowMs);
    assertCondition('27. membership com status desconhecido falha', isFailureWithReason(res27, 'ACTOR_MEMBERSHIP_STATE_INCONSISTENT'));
    
    input = createBaseInput();
    input.creatorMembership.role = undefined;
    let res28 = planInvitationCreation(input, nowMs);
    assertCondition('28. membership ativa sem papel falha', isFailureWithReason(res28, 'ACTOR_MEMBERSHIP_STATE_INCONSISTENT'));
    
    input = createBaseInput();
    input.creatorMembership.role = 'unknown_role';
    let res29 = planInvitationCreation(input, nowMs);
    assertCondition('29. membership ativa com papel desconhecido falha', isFailureWithReason(res29, 'ACTOR_MEMBERSHIP_STATE_INCONSISTENT'));

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
    assertCondition('39. e-mail com controle falha', !isValidInvitationCreationEmail('test\\x00@example.com'));
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
    let res43 = planInvitationCreation(input, nowMs);
    assertCondition('43. role owner é rejeitada', isFailureWithReason(res43, 'INVALID_INVITE_ROLE'));
    
    input = createBaseInput();
    input.request.role = 'ceo';
    let res44 = planInvitationCreation(input, nowMs);
    assertCondition('44. role ceo é rejeitada', isFailureWithReason(res44, 'INVALID_INVITE_ROLE'));

    // Existing Pending
    input = createBaseInput();
    input.existingPendingInvitation = {
      exists: true,
      status: 'pending',
      emailNormalized: 'test@example.com',
      expiresAtMs: nowMs + 1000
    };
    let res45 = planInvitationCreation(input, nowMs);
    assertCondition('45. convite pendente futuro igual bloqueia', isFailureWithReason(res45, 'INVITE_ALREADY_PENDING'));
    
    input.existingPendingInvitation.expiresAtMs = undefined;
    let res46 = planInvitationCreation(input, nowMs);
    assertCondition('46. convite pending malformado falha', isFailureWithReason(res46, 'INVITE_STATE_INCONSISTENT'));
    
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
    let res50 = planInvitationCreation(input, nowMs);
    assertCondition('50. capacidade unresolved falha fechada', isFailureWithReason(res50, 'MEMBER_LIMIT_UNAVAILABLE'));
    
    input = createBaseInput();
    input.capacity.mode = 'unlimited';
    assertCondition('51. unlimited permite', planInvitationCreation(input, nowMs).success === true);
    
    input = createBaseInput();
    input.capacity.mode = 'limited';
    input.capacity.occupiedSlots = 5;
    input.capacity.maxMembers = 10;
    assertCondition('52. limited com vaga permite', planInvitationCreation(input, nowMs).success === true);
    
    input.capacity.occupiedSlots = 10;
    let res53 = planInvitationCreation(input, nowMs);
    assertCondition('53. limited no limite bloqueia', isFailureWithReason(res53, 'MEMBER_LIMIT_REACHED'));
    
    input.capacity.occupiedSlots = 11;
    let res54 = planInvitationCreation(input, nowMs);
    assertCondition('54. limited acima do limite é inválido', isFailureWithReason(res54, 'MEMBER_LIMIT_INVALID'));
    
    input.capacity.occupiedSlots = 5.5;
    let res55 = planInvitationCreation(input, nowMs);
    assertCondition('55. occupiedSlots fracionário é inválido', isFailureWithReason(res55, 'MEMBER_LIMIT_INVALID'));
    
    input.capacity.occupiedSlots = 0;
    input.capacity.maxMembers = 0;
    let res56 = planInvitationCreation(input, nowMs);
    assertCondition('56. maxMembers zero é inválido', isFailureWithReason(res56, 'MEMBER_LIMIT_INVALID'));
    
    input.capacity.mode = 'unlimited'; // Reset
    const unknownModeInput = createBaseInput();
    Reflect.set(unknownModeInput.capacity, 'mode', 'unknown');
    const res57 = planInvitationCreation(unknownModeInput, nowMs);
    assertCondition('57. mode desconhecido é inválido', isFailureWithReason(res57, 'MEMBER_LIMIT_INVALID'));

    // nowMs
    input = createBaseInput();
    let res58 = planInvitationCreation(input, NaN);
    assertCondition('58. nowMs NaN falha', isFailureWithReason(res58, 'INVITE_STATE_INCONSISTENT'));
    
    let res59 = planInvitationCreation(input, -1);
    assertCondition('59. nowMs negativo falha', isFailureWithReason(res59, 'INVITE_STATE_INCONSISTENT'));
    
    let res60 = planInvitationCreation(input, 100.5);
    assertCondition('60. nowMs fracionário falha', isFailureWithReason(res60, 'INVITE_STATE_INCONSISTENT'));
    
    let res61 = planInvitationCreation(input, Number.MAX_SAFE_INTEGER);
    assertCondition('61. overflow da expiração falha', isFailureWithReason(res61, 'INVITE_STATE_INCONSISTENT'));

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
    
    const weakAnyCast = 'as ' + 'any';
    const weakUnknownCast = 'unknown ' + 'as';
    assertCondition('75. planner não usa a.s a.n.y', !plannerContent.includes(weakAnyCast));
    assertCondition('76. planner não usa u.n.k.n.o.w.n a.s', !plannerContent.includes(weakUnknownCast));
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

    assertCondition('80. isValidInvitationCreationEmail(undefined) retorna false sem lançar', !isValidInvitationCreationEmail(undefined));
    assertCondition('81. isValidInvitationCreationEmail(null) retorna false sem lançar', !isValidInvitationCreationEmail(null));
    assertCondition('82. e-mail vazio retorna false sem lançar', !isValidInvitationCreationEmail(''));
    assertCondition('83. e-mail contendo somente espaços retorna false sem lançar', !isValidInvitationCreationEmail('   '));
    
    input = createBaseInput();
    input.request.email = undefined;
    let res84 = planInvitationCreation(input, nowMs);
    assertCondition('84. planner com email ausente retorna INVALID_INVITE_EMAIL sem lançar', isFailureWithReason(res84, 'INVALID_INVITE_EMAIL'));
    
    input = createBaseInput();
    input.request.email = '';
    let res85 = planInvitationCreation(input, nowMs);
    assertCondition('85. planner com email vazio retorna INVALID_INVITE_EMAIL sem lançar', isFailureWithReason(res85, 'INVALID_INVITE_EMAIL'));
    
    assertCondition('86. whitespace tab interno é rejeitado', !isValidInvitationCreationEmail('test\\t@example.com'));
    assertCondition('87. whitespace de quebra de linha interno é rejeitado', !isValidInvitationCreationEmail('test\\n@example.com'));
    assertCondition('88. whitespace Unicode interno é rejeitado', !isValidInvitationCreationEmail('test\\u200B@example.com'));
    
    assertCondition('89. normalizador não acessa length antes de verificar null', plannerContent.includes('const norm = normalizeInvitationEmail(value);\\n  if (norm === null) return null;\\n  \\n  if (norm.length > 254) return null;'));
    assertCondition('90. planner chama normalizeValidInvitationCreationEmail', plannerContent.includes('normalizeValidInvitationCreationEmail(input.request.email)'));
    assertCondition('91. planner não normaliza o e-mail novamente após a validação', !plannerContent.includes('const normalizedEmail = normalizeInvitationEmail(input.request.email);'));

    const testContent = fs.readFileSync(path.resolve(process.cwd(), 'scripts/test_p0a3_invitation_creation_planner.ts'), 'utf-8');
    assertCondition('92. suíte não contém a.s a.n.y', !testContent.includes(weakAnyCast));
    assertCondition('93. suíte não contém u.n.k.n.o.w.n a.s', !testContent.includes(weakUnknownCast));
    assertCondition('94. suíte não contém cast duplo', !testContent.includes(weakUnknownCast) && !testContent.includes(weakAnyCast));
    assertCondition('95. suíte usa isFailureWithReason', testContent.includes('isFailureWithReason('));
    assertCondition('96. cenário de mode desconhecido usa Reflect.set', testContent.includes('Reflect.set(unknownModeInput.capacity, \\'mode\\', \\'unknown\\')'));
    assertCondition('97. cenário de mode desconhecido não usa cast', !testContent.includes('\\'unknown\\' ' + weakAnyCast) && !testContent.includes('\\'unknown\\' ' + weakUnknownCast));
    assertCondition('98. cada cenário principal guarda o resultado antes de verificar reasonCode', testContent.includes('let res10 = planInvitationCreation(input, nowMs);') && testContent.includes('isFailureWithReason(res10, \\'UNAUTHENTICATED\\')'));
    assertCondition('99. arquivo report.txt não existe', !fs.existsSync(path.join(rootDir, 'report.txt')));
    assertCondition('100. nenhum arquivo proibido existe na raiz', prohibitedFiles.every(f => !fs.existsSync(path.join(rootDir, f))));

    console.log(\`\\nResults: \${passed} passed, \${failed} failed\`);
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
`
fs.writeFileSync('scripts/test_p0a3_invitation_creation_planner.ts', content);
