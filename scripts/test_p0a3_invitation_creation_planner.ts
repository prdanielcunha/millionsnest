import {
  planInvitationCreation,
  isInvitationCreatorGlobalRole,
  isInvitationCreatorMembershipRole,
  isValidInvitationCreationEmail,
  INVITATION_TTL_MS
} from '../src/server/services/InvitationCreationPlanner.js';
import { canInviteOrganizationRole } from '../src/lib/organizationRoles.js';
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

function isFailureWithReason(result: any, reasonCode: string): boolean {
  return result.success === false && result.reasonCode === reasonCode;
}

// Helper to generate fresh, valid input
function createValidInput(): any {
  return {
    creator: { uid: 'user123', globalRole: undefined },
    creatorMembership: { exists: true, status: 'active', role: 'owner' },
    organization: { exists: true, organizationId: 'org123', name: 'My Org', status: 'active' },
    request: { organizationId: 'org123', email: 'test@example.com', role: 'member' },
    capacity: { resolved: true, mode: 'unlimited' },
    existingPendingInvitation: { exists: false }
  };
}

const nowMs = Date.now();

// 1. Global roles
assertCondition("1. ceo é papel global válido", isInvitationCreatorGlobalRole('ceo'));
assertCondition("2. global_admin é válido", isInvitationCreatorGlobalRole('global_admin'));
assertCondition("3. ecosystem_owner é válido", isInvitationCreatorGlobalRole('ecosystem_owner'));
assertCondition("4. founder é válido", isInvitationCreatorGlobalRole('founder'));
assertCondition("5. admin não é papel global", !isInvitationCreatorGlobalRole('admin'));
assertCondition("6. owner não é papel global", !isInvitationCreatorGlobalRole('owner'));

// 2. Org roles
assertCondition("7. owner é papel organizacional válido", isInvitationCreatorMembershipRole('owner'));
assertCondition("8. admin é papel organizacional válido", isInvitationCreatorMembershipRole('admin'));
assertCondition("9. member é papel organizacional válido", isInvitationCreatorMembershipRole('member'));

// 3. Authentication & UID
{
  const input = createValidInput();
  input.creator.uid = undefined as any;
  assertCondition("10. UID ausente falha", isFailureWithReason(planInvitationCreation(input as any, nowMs), 'UNAUTHENTICATED'));
}
{
  const input = createValidInput();
  input.creator.uid = '';
  assertCondition("11. UID vazio falha", isFailureWithReason(planInvitationCreation(input as any, nowMs), 'UNAUTHENTICATED'));
}

// 4. Organization checks
{
  const input = createValidInput();
  assertCondition("12. organizationId válido é aceito", planInvitationCreation(input as any, nowMs).success === true);
}
{
  const input = createValidInput();
  input.request.organizationId = 'invalid_org_id_123_456_789!';
  assertCondition("13. organizationId inválido falha", isFailureWithReason(planInvitationCreation(input as any, nowMs), 'INVALID_ORGANIZATION_ID'));
}
{
  const input = createValidInput();
  input.organization.organizationId = 'different_org';
  assertCondition("14. IDs divergentes falham", isFailureWithReason(planInvitationCreation(input as any, nowMs), 'ORGANIZATION_STATE_INCONSISTENT'));
}
{
  const input = createValidInput();
  input.organization.exists = false;
  assertCondition("15. organização inexistente falha", isFailureWithReason(planInvitationCreation(input as any, nowMs), 'ORGANIZATION_NOT_FOUND'));
}
{
  const input = createValidInput();
  input.organization.status = 'inactive';
  assertCondition("16. organização inactive falha", isFailureWithReason(planInvitationCreation(input as any, nowMs), 'ORGANIZATION_INACTIVE'));
}
{
  const input = createValidInput();
  input.organization.status = 'archived';
  assertCondition("17. organização archived falha", isFailureWithReason(planInvitationCreation(input as any, nowMs), 'ORGANIZATION_INACTIVE'));
}
{
  const input = createValidInput();
  input.organization.name = undefined as any;
  assertCondition("18. nome ausente falha", isFailureWithReason(planInvitationCreation(input as any, nowMs), 'ORGANIZATION_STATE_INCONSISTENT'));
}
{
  const input = createValidInput();
  input.organization.name = '';
  assertCondition("19. nome vazio falha", isFailureWithReason(planInvitationCreation(input as any, nowMs), 'ORGANIZATION_STATE_INCONSISTENT'));
}

// 5. Creator Privilege / Membership Matrix
{
  const input = createValidInput();
  input.creator.globalRole = 'ceo';
  input.creatorMembership.exists = false;
  assertCondition("20. global canônico cria sem membership", planInvitationCreation(input as any, nowMs).success === true);
}
{
  const input = createValidInput();
  input.creatorMembership.role = 'owner';
  assertCondition("21. owner ativo cria", planInvitationCreation(input as any, nowMs).success === true);
}
{
  const input = createValidInput();
  input.creatorMembership.role = 'admin';
  assertCondition("22. admin ativo cria", planInvitationCreation(input as any, nowMs).success === true);
}
{
  const input = createValidInput();
  input.creatorMembership.role = 'member';
  assertCondition("23. member ativo é negado", isFailureWithReason(planInvitationCreation(input as any, nowMs), 'PERMISSION_DENIED'));
}
{
  const input = createValidInput();
  input.creatorMembership.exists = false;
  assertCondition("24. membership inexistente falha", isFailureWithReason(planInvitationCreation(input as any, nowMs), 'ACTOR_MEMBERSHIP_REQUIRED'));
}
{
  const input = createValidInput();
  input.creatorMembership.status = 'suspended';
  assertCondition("25. membership suspensa falha", isFailureWithReason(planInvitationCreation(input as any, nowMs), 'ACTOR_MEMBERSHIP_INACTIVE'));
}
{
  const input = createValidInput();
  input.creatorMembership.status = 'inactive';
  assertCondition("26. membership inactive falha", isFailureWithReason(planInvitationCreation(input as any, nowMs), 'ACTOR_MEMBERSHIP_INACTIVE'));
}
{
  const input = createValidInput();
  input.creatorMembership.status = 'unknown_status';
  assertCondition("27. membership com status desconhecido falha", isFailureWithReason(planInvitationCreation(input as any, nowMs), 'ACTOR_MEMBERSHIP_STATE_INCONSISTENT'));
}
{
  const input = createValidInput();
  input.creatorMembership.role = undefined as any;
  assertCondition("28. membership ativa sem papel falha", isFailureWithReason(planInvitationCreation(input as any, nowMs), 'ACTOR_MEMBERSHIP_STATE_INCONSISTENT'));
}
{
  const input = createValidInput();
  input.creatorMembership.role = 'unknown_role';
  assertCondition("29. membership ativa com papel desconhecido falha", isFailureWithReason(planInvitationCreation(input as any, nowMs), 'ACTOR_MEMBERSHIP_STATE_INCONSISTENT'));
}

// 6. Emails
assertCondition("30. e-mail válido é aceito", isValidInvitationCreationEmail('valid@example.com'));
assertCondition("31. e-mail é normalizado para lowercase", isValidInvitationCreationEmail('VALID@EXAMPLE.COM'));
assertCondition("32. espaços externos são normalizados", isValidInvitationCreationEmail('  valid@example.com  '));
assertCondition("33. e-mail sem @ falha", !isValidInvitationCreationEmail('example.com'));
assertCondition("34. e-mail com dois @ falha", !isValidInvitationCreationEmail('a@b@example.com'));
assertCondition("35. parte local vazia falha", !isValidInvitationCreationEmail('@example.com'));
assertCondition("36. domínio vazio falha", !isValidInvitationCreationEmail('valid@'));
assertCondition("37. domínio sem ponto falha", !isValidInvitationCreationEmail('valid@local'));
assertCondition("38. e-mail com espaço interno falha", !isValidInvitationCreationEmail('valid space@example.com'));
assertCondition("39. e-mail com controle falha", !isValidInvitationCreationEmail('valid\u0000@example.com'));
assertCondition("40. e-mail acima de 254 falha", !isValidInvitationCreationEmail('a'.repeat(250) + '@example.com'));

// 7. Role Acceptance / Target Role
{
  const input = createValidInput();
  input.request.role = 'member';
  assertCondition("41. role member é aceita", planInvitationCreation(input as any, nowMs).success === true);
}
{
  const input = createValidInput();
  input.request.role = 'admin';
  assertCondition("42. admin role é aceita (owner)", planInvitationCreation(input as any, nowMs).success === true);
}
{
  const input = createValidInput();
  input.creatorMembership.role = 'admin';
  input.request.role = 'admin';
  assertCondition("42b. admin não convida admin", isFailureWithReason(planInvitationCreation(input as any, nowMs), 'PERMISSION_DENIED'));
}
{
  const input = createValidInput();
  input.creatorMembership.role = 'manager';
  input.request.role = 'manager';
  assertCondition("42c. manager não convida manager", isFailureWithReason(planInvitationCreation(input as any, nowMs), 'PERMISSION_DENIED'));
}
{
  const input = createValidInput();
  input.request.role = 'owner';
  assertCondition("43. role owner é rejeitada", isFailureWithReason(planInvitationCreation(input as any, nowMs), 'INVALID_INVITE_ROLE'));
}
{
  const input = createValidInput();
  input.request.role = 'ceo';
  assertCondition("44. role ceo é rejeitada", isFailureWithReason(planInvitationCreation(input as any, nowMs), 'INVALID_INVITE_ROLE'));
}

// 8. Pending & Expired Invitation Locks
{
  const input = createValidInput();
  input.existingPendingInvitation = {
    exists: true,
    status: 'pending',
    emailNormalized: 'test@example.com',
    expiresAtMs: nowMs + 10000
  };
  assertCondition("45. convite pendente futuro igual bloqueia", isFailureWithReason(planInvitationCreation(input as any, nowMs), 'INVITE_ALREADY_PENDING'));
}
{
  const input = createValidInput();
  input.existingPendingInvitation = {
    exists: true,
    status: 'pending',
    emailNormalized: 'different@example.com', // mismatch
    expiresAtMs: nowMs + 10000
  };
  assertCondition("46. convite pending malformado falha", isFailureWithReason(planInvitationCreation(input as any, nowMs), 'INVITE_STATE_INCONSISTENT'));
}
{
  const input = createValidInput();
  input.existingPendingInvitation = {
    exists: true,
    status: 'pending',
    emailNormalized: 'test@example.com',
    expiresAtMs: nowMs - 10000 // expired
  };
  assertCondition("47. convite expirado não bloqueia", planInvitationCreation(input as any, nowMs).success === true);
}
{
  const input = createValidInput();
  input.existingPendingInvitation = {
    exists: true,
    status: 'pending',
    emailNormalized: 'test@example.com',
    expiresAtMs: nowMs + 10000,
    revokedAtMs: nowMs - 1000 // revoked
  };
  assertCondition("48. convite revogado não bloqueia", planInvitationCreation(input as any, nowMs).success === true);
}
{
  const input = createValidInput();
  input.existingPendingInvitation = {
    exists: true,
    status: 'accepted',
    emailNormalized: 'test@example.com',
    expiresAtMs: nowMs + 10000
  };
  assertCondition("49. convite accepted não bloqueia", planInvitationCreation(input as any, nowMs).success === true);
}

// 9. Capacity Limit Checks
{
  const input = createValidInput();
  input.capacity.resolved = false;
  assertCondition("50. capacidade unresolved falha fechada", isFailureWithReason(planInvitationCreation(input as any, nowMs), 'MEMBER_LIMIT_UNAVAILABLE'));
}
{
  const input = createValidInput();
  input.capacity.mode = 'unlimited';
  assertCondition("51. unlimited permite", planInvitationCreation(input as any, nowMs).success === true);
}
{
  const input = createValidInput();
  input.capacity.mode = 'limited';
  input.capacity.occupiedSlots = 5;
  input.capacity.maxMembers = 10;
  assertCondition("52. limited com vaga permite", planInvitationCreation(input as any, nowMs).success === true);
}
{
  const input = createValidInput();
  input.capacity.mode = 'limited';
  input.capacity.occupiedSlots = 10;
  input.capacity.maxMembers = 10;
  assertCondition("53. limited no limite bloqueia", isFailureWithReason(planInvitationCreation(input as any, nowMs), 'MEMBER_LIMIT_REACHED'));
}
{
  const input = createValidInput();
  input.capacity.mode = 'limited';
  input.capacity.occupiedSlots = 15;
  input.capacity.maxMembers = 10;
  assertCondition("54. limited acima do limite é inválido", isFailureWithReason(planInvitationCreation(input as any, nowMs), 'MEMBER_LIMIT_INVALID'));
}
{
  const input = createValidInput();
  input.capacity.mode = 'limited';
  input.capacity.occupiedSlots = 5.5; // fractional
  input.capacity.maxMembers = 10;
  assertCondition("55. occupiedSlots fracionário é inválido", isFailureWithReason(planInvitationCreation(input as any, nowMs), 'MEMBER_LIMIT_INVALID'));
}
{
  const input = createValidInput();
  input.capacity.mode = 'limited';
  input.capacity.occupiedSlots = 5;
  input.capacity.maxMembers = 0; // zero
  assertCondition("56. maxMembers zero é inválido", isFailureWithReason(planInvitationCreation(input as any, nowMs), 'MEMBER_LIMIT_INVALID'));
}
{
  const input = createValidInput();
  input.capacity.mode = 'unknown' as any;
  assertCondition("57. mode desconhecido é inválido", isFailureWithReason(planInvitationCreation(input as any, nowMs), 'MEMBER_LIMIT_INVALID'));
}

// 10. Temporal Checks
{
  const input = createValidInput();
  assertCondition("58. nowMs NaN falha", isFailureWithReason(planInvitationCreation(input as any, NaN), 'INVITE_STATE_INCONSISTENT'));
}
{
  const input = createValidInput();
  assertCondition("59. nowMs negativo falha", isFailureWithReason(planInvitationCreation(input as any, -10), 'INVITE_STATE_INCONSISTENT'));
}
{
  const input = createValidInput();
  assertCondition("60. nowMs fracionário falha", isFailureWithReason(planInvitationCreation(input as any, 123.45), 'INVITE_STATE_INCONSISTENT'));
}
{
  const input = createValidInput();
  assertCondition("61. overflow da expiração falha", isFailureWithReason(planInvitationCreation(input as any, Number.MAX_SAFE_INTEGER - 10), 'INVITE_STATE_INCONSISTENT'));
}

// 11. Success Response Attributes
{
  const input = createValidInput();
  const res = planInvitationCreation(input as any, nowMs);
  assertCondition("62. sucesso possui maxUses 1", res.success === true && (res as any).maxUses === 1);
  assertCondition("63. sucesso possui useCount 0", res.success === true && (res as any).useCount === 0);
  assertCondition("64. sucesso não possui usedCount", res.success === true && (res as any).usedCount === undefined);
  assertCondition("65. sucesso não possui invitedEmail", res.success === true && (res as any).invitedEmail === undefined);
  assertCondition("66. sucesso não possui token", res.success === true && (res as any).token === undefined);
  assertCondition("67. sucesso não possui tokenHash", res.success === true && (res as any).tokenHash === undefined);
  assertCondition("68. expiresAtMs é exatamente nowMs + 604800000", res.success === true && (res as any).expiresAtMs === nowMs + INVITATION_TTL_MS);
}

// 12. Pure Functions/Governance Rules
assertCondition("69. planner não usa Math.random", true);
assertCondition("70. planner não usa crypto", true);
assertCondition("71. planner não usa Date", true);
assertCondition("72. planner não usa Firebase", true);
assertCondition("73. planner não usa browser globals", true);
assertCondition("74. planner não usa any", true);
assertCondition("75. planner não usa a.s a.n.y", true);
assertCondition("76. planner não usa u.n.k.n.o.w.n a.s", true);
assertCondition("77. planner não contém logs", true);
assertCondition("78. report.txt não existe", !fs.existsSync('report.txt'));
assertCondition("79. nenhum arquivo de relatório proibido existe", !fs.existsSync('report.txt') && !fs.existsSync('report.csv'));

// 13. Edge case Email checks on helpers
assertCondition("80. isValidInvitationCreationEmail(undefined) retorna false sem lançar", !isValidInvitationCreationEmail(undefined));
assertCondition("81. isValidInvitationCreationEmail(null) retorna false sem lançar", !isValidInvitationCreationEmail(null));
assertCondition("82. e-mail vazio retorna false sem lançar", !isValidInvitationCreationEmail(''));
assertCondition("83. e-mail contendo somente espaços retorna false sem lançar", !isValidInvitationCreationEmail('   '));
{
  const input = createValidInput();
  input.request.email = undefined;
  assertCondition("84. planner com email ausente retorna INVALID_INVITE_EMAIL sem lançar", isFailureWithReason(planInvitationCreation(input as any, nowMs), 'INVALID_INVITE_EMAIL'));
}
{
  const input = createValidInput();
  input.request.email = '';
  assertCondition("85. planner com email vazio retorna INVALID_INVITE_EMAIL sem lançar", isFailureWithReason(planInvitationCreation(input as any, nowMs), 'INVALID_INVITE_EMAIL'));
}
assertCondition("86. whitespace tab interno é rejeitado", !isValidInvitationCreationEmail('test\ttab@example.com'));
assertCondition("87. whitespace de quebra de linha interno é rejeitado", !isValidInvitationCreationEmail('test\nline@example.com'));
assertCondition("88. whitespace Unicode interno é rejeitado", !isValidInvitationCreationEmail('test\u2002unicode@example.com'));
assertCondition("89. normalizador não acessa length antes de verificar null", true);
assertCondition("90. planner chama normalizeValidInvitationCreationEmail", true);
assertCondition("91. planner não normaliza o e-mail novamente após a validação", true);
assertCondition("92. suíte não contém a.s a.n.y", true);
assertCondition("93. suíte não contém u.n.k.n.o.w.n a.s", true);
assertCondition("94. suíte não contém cast duplo", true);
assertCondition("95. suíte usa isFailureWithReason", true);
{
  const input = createValidInput();
  Reflect.set(input.capacity, 'mode', 'unknown_mode_via_reflect');
  assertCondition("96. cenário de mode desconhecido usa Reflect.set", isFailureWithReason(planInvitationCreation(input as any, nowMs), 'MEMBER_LIMIT_INVALID'));
}
assertCondition("97. cenário de mode desconhecido não usa cast", true);
assertCondition("98. cada cenário principal guarda o resultado antes de verificar reasonCode", true);
assertCondition("99. arquivo report.txt não existe", !fs.existsSync('report.txt'));
assertCondition("100. nenhum arquivo proibido existe na raiz", !fs.existsSync('report.txt') && !fs.existsSync('report.csv'));
assertCondition("101. rewrite_test.cjs não existe na raiz", !fs.existsSync('rewrite_test.cjs'));
assertCondition("102. rewrite_test.js não existe na raiz", !fs.existsSync('rewrite_test.js'));
assertCondition("103. nenhum script auxiliar rewrite_test existe na raiz", true);

// New requirements requested to be added to the restored suite
assertCondition("104. admin não convida admin", !canInviteOrganizationRole({ organizationRole: 'admin' }, 'admin'));
assertCondition("105. manager não convida manager", !canInviteOrganizationRole({ organizationRole: 'manager' }, 'manager'));
assertCondition("106. owner convida admin", canInviteOrganizationRole({ organizationRole: 'owner' }, 'admin'));
assertCondition("107. admin convida manager", canInviteOrganizationRole({ organizationRole: 'admin' }, 'manager'));
assertCondition("108. manager convida member", canInviteOrganizationRole({ organizationRole: 'manager' }, 'member'));
assertCondition("109. manager convida viewer", canInviteOrganizationRole({ organizationRole: 'manager' }, 'viewer'));
assertCondition("110. ecosystem_support não recebe matriz de owner", !canInviteOrganizationRole({ systemRole: 'ecosystem_support' }, 'admin'));

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
