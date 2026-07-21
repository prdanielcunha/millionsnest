import { 
  normalizeInvitationEmail, 
  planInvitationAcceptance, 
  InvitationAcceptanceInput,
  InvitationAcceptanceSuccess,
  InvitationAcceptanceFailure 
} from '../src/server/services/InvitationAcceptancePlanner.js';

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

const nowMs = 1000000;

function createBaseInput(): InvitationAcceptanceInput {
  return {
    identity: { uid: 'user123', email: 'user@example.com' },
    organization: { exists: true, status: 'active' },
    invitation: { 
      exists: true, 
      organizationId: 'org1', 
      status: 'pending', 
      email: 'user@example.com',
      role: 'member',
      expiresAtMs: nowMs + 10000,
      maxUses: 1,
      useCount: 0
    },
    existingMembership: { exists: false },
    capacity: { resolved: true, mode: 'unlimited' }
  };
}

// 1. normalização de e-mail;
assertCondition('1. normalização de e-mail', normalizeInvitationEmail(' USER@Example.COM  ') === 'user@example.com');

// 2. identidade sem e-mail;
const i2 = createBaseInput();
i2.identity.email = undefined;
assertCondition('2. identidade sem e-mail', (planInvitationAcceptance(i2, nowMs) as InvitationAcceptanceFailure).reasonCode === 'AUTHENTICATED_EMAIL_REQUIRED');

// 3. organização inexistente;
const i3 = createBaseInput();
i3.organization.exists = false;
assertCondition('3. organização inexistente', (planInvitationAcceptance(i3, nowMs) as InvitationAcceptanceFailure).reasonCode === 'ORGANIZATION_NOT_FOUND');

// 4. organização inativa;
const i4 = createBaseInput();
i4.organization.status = 'suspended';
assertCondition('4. organização inativa', (planInvitationAcceptance(i4, nowMs) as InvitationAcceptanceFailure).reasonCode === 'ORGANIZATION_INACTIVE');

// 5. convite inexistente;
const i5 = createBaseInput();
i5.invitation.exists = false;
assertCondition('5. convite inexistente', (planInvitationAcceptance(i5, nowMs) as InvitationAcceptanceFailure).reasonCode === 'INVITE_NOT_FOUND');

// 6. convite sem organizationId;
const i6 = createBaseInput();
i6.invitation.organizationId = undefined;
assertCondition('6. convite sem organizationId', (planInvitationAcceptance(i6, nowMs) as InvitationAcceptanceFailure).reasonCode === 'INVITE_STATE_INCONSISTENT');

// 7. convite revogado por status;
const i7 = createBaseInput();
i7.invitation.status = 'revoked';
assertCondition('7. convite revogado por status', (planInvitationAcceptance(i7, nowMs) as InvitationAcceptanceFailure).reasonCode === 'INVITE_REVOKED');

// 8. convite revogado por revokedAtMs;
const i8 = createBaseInput();
i8.invitation.revokedAtMs = nowMs - 100;
assertCondition('8. convite revogado por revokedAtMs', (planInvitationAcceptance(i8, nowMs) as InvitationAcceptanceFailure).reasonCode === 'INVITE_REVOKED');

// 9. status desconhecido;
const i9 = createBaseInput();
i9.invitation.status = 'something_else';
assertCondition('9. status desconhecido', (planInvitationAcceptance(i9, nowMs) as InvitationAcceptanceFailure).reasonCode === 'INVITE_STATE_INCONSISTENT');

// 10. expiresAtMs ausente;
const i10 = createBaseInput();
i10.invitation.expiresAtMs = undefined;
assertCondition('10. expiresAtMs ausente', (planInvitationAcceptance(i10, nowMs) as InvitationAcceptanceFailure).reasonCode === 'INVITE_STATE_INCONSISTENT');

// 11. convite expirado;
const i11 = createBaseInput();
i11.invitation.expiresAtMs = nowMs - 100;
assertCondition('11. convite expirado', (planInvitationAcceptance(i11, nowMs) as InvitationAcceptanceFailure).reasonCode === 'INVITE_EXPIRED');

// 12. email e emailNormalized conflitantes;
const i12 = createBaseInput();
i12.invitation.email = 'a@test.com';
i12.invitation.emailNormalized = 'b@test.com';
assertCondition('12. email e emailNormalized conflitantes', (planInvitationAcceptance(i12, nowMs) as InvitationAcceptanceFailure).reasonCode === 'INVITE_STATE_INCONSISTENT');

// 13. e-mail diferente do autenticado;
const i13 = createBaseInput();
i13.identity.email = 'other@example.com';
assertCondition('13. e-mail diferente do autenticado', (planInvitationAcceptance(i13, nowMs) as InvitationAcceptanceFailure).reasonCode === 'INVITE_IDENTITY_MISMATCH');

// 14. papel member válido;
const i14 = createBaseInput();
i14.invitation.role = 'member';
const r14 = planInvitationAcceptance(i14, nowMs) as InvitationAcceptanceSuccess;
assertCondition('14. papel member válido', r14.success && r14.membershipRole === 'member');

// 15. papel admin válido;
const i15 = createBaseInput();
i15.invitation.role = 'admin';
const r15 = planInvitationAcceptance(i15, nowMs) as InvitationAcceptanceSuccess;
assertCondition('15. papel admin válido', r15.success && r15.membershipRole === 'admin');

// 16. papel owner rejeitado;
const i16 = createBaseInput();
i16.invitation.role = 'owner';
assertCondition('16. papel owner rejeitado', (planInvitationAcceptance(i16, nowMs) as InvitationAcceptanceFailure).reasonCode === 'INVALID_INVITE_ROLE');

// 17. papel ceo rejeitado;
const i17 = createBaseInput();
i17.invitation.role = 'ceo';
assertCondition('17. papel ceo rejeitado', (planInvitationAcceptance(i17, nowMs) as InvitationAcceptanceFailure).reasonCode === 'INVALID_INVITE_ROLE');

// 18. maxUses ausente;
const i18 = createBaseInput();
i18.invitation.maxUses = undefined;
assertCondition('18. maxUses ausente', (planInvitationAcceptance(i18, nowMs) as InvitationAcceptanceFailure).reasonCode === 'INVITE_STATE_INCONSISTENT');

// 19. useCount inválido;
const i19 = createBaseInput();
i19.invitation.useCount = -1;
assertCondition('19. useCount inválido', (planInvitationAcceptance(i19, nowMs) as InvitationAcceptanceFailure).reasonCode === 'INVITE_STATE_INCONSISTENT');

// 20. useCount maior que maxUses;
const i20 = createBaseInput();
i20.invitation.useCount = 2;
assertCondition('20. useCount maior que maxUses', (planInvitationAcceptance(i20, nowMs) as InvitationAcceptanceFailure).reasonCode === 'INVITE_STATE_INCONSISTENT');

// 21. limite de usos atingido;
const i21 = createBaseInput();
i21.invitation.useCount = 1;
assertCondition('21. limite de usos atingido', (planInvitationAcceptance(i21, nowMs) as InvitationAcceptanceFailure).reasonCode === 'INVITE_MAX_USES_REACHED');

// 22. membership ativa gera ALREADY_MEMBER;
const i22 = createBaseInput();
i22.existingMembership = { exists: true, status: 'active', role: 'member' };
const r22 = planInvitationAcceptance(i22, nowMs) as InvitationAcceptanceSuccess;
assertCondition('22. membership ativa gera ALREADY_MEMBER', r22.success && r22.reasonCode === 'ALREADY_MEMBER');

// 23. membership legada sem status gera ALREADY_MEMBER;
const i23 = createBaseInput();
i23.existingMembership = { exists: true, role: 'member' };
const r23 = planInvitationAcceptance(i23, nowMs) as InvitationAcceptanceSuccess;
assertCondition('23. membership legada sem status gera ALREADY_MEMBER', r23.success && r23.reasonCode === 'ALREADY_MEMBER');

// 24. membership owner existente é preservada;
const i24 = createBaseInput();
i24.invitation.role = 'member';
i24.existingMembership = { exists: true, status: 'active', role: 'owner' };
const r24 = planInvitationAcceptance(i24, nowMs) as InvitationAcceptanceSuccess;
assertCondition('24. membership owner existente é preservada', r24.success && r24.membershipRole === 'owner');

// 25. membership suspensa é rejeitada;
const i25 = createBaseInput();
i25.existingMembership = { exists: true, status: 'suspended', role: 'member' };
assertCondition('25. membership suspensa é rejeitada', (planInvitationAcceptance(i25, nowMs) as InvitationAcceptanceFailure).reasonCode === 'MEMBERSHIP_INACTIVE');

// 26. membership com status desconhecido é rejeitada;
const i26 = createBaseInput();
i26.existingMembership = { exists: true, status: 'unknown_status', role: 'member' };
assertCondition('26. membership com status desconhecido é rejeitada', (planInvitationAcceptance(i26, nowMs) as InvitationAcceptanceFailure).reasonCode === 'MEMBERSHIP_STATE_INCONSISTENT');

// 27. convite accepted pelo mesmo UID com membership ativa é idempotente;
const i27 = createBaseInput();
i27.invitation.status = 'accepted';
i27.invitation.acceptedBy = 'user123';
i27.existingMembership = { exists: true, status: 'active', role: 'member' };
const r27 = planInvitationAcceptance(i27, nowMs) as InvitationAcceptanceSuccess;
assertCondition('27. convite accepted pelo mesmo UID com membership ativa é idempotente', r27.success && r27.reasonCode === 'ALREADY_MEMBER');

// 28. convite accepted por outro UID é rejeitado;
const i28 = createBaseInput();
i28.invitation.status = 'accepted';
i28.invitation.acceptedBy = 'other_user';
assertCondition('28. convite accepted por outro UID é rejeitado', (planInvitationAcceptance(i28, nowMs) as InvitationAcceptanceFailure).reasonCode === 'INVITE_ALREADY_CONSUMED');

// 29. convite accepted sem membership é rejeitado;
const i29 = createBaseInput();
i29.invitation.status = 'accepted';
i29.invitation.acceptedBy = 'user123';
assertCondition('29. convite accepted sem membership é rejeitado', (planInvitationAcceptance(i29, nowMs) as InvitationAcceptanceFailure).reasonCode === 'INVITE_ALREADY_CONSUMED');

// 30. capacidade não resolvida falha fechada;
const i30 = createBaseInput();
i30.capacity = { resolved: false };
assertCondition('30. capacidade não resolvida falha fechada', (planInvitationAcceptance(i30, nowMs) as InvitationAcceptanceFailure).reasonCode === 'MEMBER_LIMIT_UNAVAILABLE');

// 31. capacidade unlimited permite criação;
const i31 = createBaseInput();
i31.capacity = { resolved: true, mode: 'unlimited' };
const r31 = planInvitationAcceptance(i31, nowMs) as InvitationAcceptanceSuccess;
assertCondition('31. capacidade unlimited permite criação', r31.success && r31.reasonCode === 'INVITATION_CAN_BE_ACCEPTED');

// 32. capacidade limited disponível permite criação;
const i32 = createBaseInput();
i32.capacity = { resolved: true, mode: 'limited', currentActiveMembers: 5, maxMembers: 10 };
const r32 = planInvitationAcceptance(i32, nowMs) as InvitationAcceptanceSuccess;
assertCondition('32. capacidade limited disponível permite criação', r32.success && r32.reasonCode === 'INVITATION_CAN_BE_ACCEPTED');

// 33. capacidade limited atingida bloqueia;
const i33 = createBaseInput();
i33.capacity = { resolved: true, mode: 'limited', currentActiveMembers: 10, maxMembers: 10 };
assertCondition('33. capacidade limited atingida bloqueia', (planInvitationAcceptance(i33, nowMs) as InvitationAcceptanceFailure).reasonCode === 'MEMBER_LIMIT_REACHED');

// 34. capacidade inválida bloqueia;
const i34 = createBaseInput();
i34.capacity = { resolved: true, mode: 'limited', currentActiveMembers: 15, maxMembers: 10 };
assertCondition('34. capacidade inválida bloqueia', (planInvitationAcceptance(i34, nowMs) as InvitationAcceptanceFailure).reasonCode === 'MEMBER_LIMIT_INVALID');

// 35. criação retorna consumeInviteUse true;
const i35 = createBaseInput();
const r35 = planInvitationAcceptance(i35, nowMs) as InvitationAcceptanceSuccess;
assertCondition('35. criação retorna consumeInviteUse true', r35.success && r35.consumeInviteUse === true);

// 36. idempotência retorna consumeInviteUse false;
const i36 = createBaseInput();
i36.existingMembership = { exists: true, status: 'active', role: 'member' };
const r36 = planInvitationAcceptance(i36, nowMs) as InvitationAcceptanceSuccess;
assertCondition('36. idempotência retorna consumeInviteUse false', r36.success && r36.consumeInviteUse === false);

// 37. planejador não usa Date.now;
import fs from 'fs';
const content = fs.readFileSync('src/server/services/InvitationAcceptancePlanner.ts', 'utf8');
assertCondition('37. planejador não usa Date.now', !content.includes('Date.now'));

// 38. planejador não usa new Date;
assertCondition('38. planejador não usa new Date', !content.includes('new Date'));

// 39. não existe fallback de papel para member;
assertCondition('39. não existe fallback de papel para member', !content.includes("inviteRole = 'member'"));

// 40. resultado não muda com o mesmo nowMs e mesma entrada.
const i40a = createBaseInput();
const i40b = createBaseInput();
const r40a = planInvitationAcceptance(i40a, nowMs);
const r40b = planInvitationAcceptance(i40b, nowMs);
assertCondition('40. resultado não muda com o mesmo nowMs e mesma entrada', JSON.stringify(r40a) === JSON.stringify(r40b));

// 41. normalizeInvitationEmail recebe número e retorna null
assertCondition('41. normalizeInvitationEmail recebe número e retorna null', normalizeInvitationEmail(123) === null);

// 42. normalizeInvitationEmail recebe string vazia e retorna null
assertCondition('42. normalizeInvitationEmail recebe string vazia e retorna null', normalizeInvitationEmail('   ') === null);

// 43. organizationId contendo somente espaços gera INVITE_STATE_INCONSISTENT
const i43 = createBaseInput();
i43.invitation.organizationId = '   ';
assertCondition('43. organizationId contendo somente espaços gera INVITE_STATE_INCONSISTENT', (planInvitationAcceptance(i43, nowMs) as InvitationAcceptanceFailure).reasonCode === 'INVITE_STATE_INCONSISTENT');

// 44. nowMs NaN gera INVITE_STATE_INCONSISTENT
const i44 = createBaseInput();
assertCondition('44. nowMs NaN gera INVITE_STATE_INCONSISTENT', (planInvitationAcceptance(i44, NaN) as InvitationAcceptanceFailure).reasonCode === 'INVITE_STATE_INCONSISTENT');

// 45. nowMs negativo gera INVITE_STATE_INCONSISTENT
const i45 = createBaseInput();
assertCondition('45. nowMs negativo gera INVITE_STATE_INCONSISTENT', (planInvitationAcceptance(i45, -1) as InvitationAcceptanceFailure).reasonCode === 'INVITE_STATE_INCONSISTENT');

// 46. membership ativa sem role gera MEMBERSHIP_STATE_INCONSISTENT
const i46 = createBaseInput();
i46.existingMembership = { exists: true, status: 'active', role: undefined };
assertCondition('46. membership ativa sem role gera MEMBERSHIP_STATE_INCONSISTENT', (planInvitationAcceptance(i46, nowMs) as InvitationAcceptanceFailure).reasonCode === 'MEMBERSHIP_STATE_INCONSISTENT');

// 47. membership ativa com role ceo gera MEMBERSHIP_STATE_INCONSISTENT
const i47 = createBaseInput();
i47.existingMembership = { exists: true, status: 'active', role: 'ceo' };
assertCondition('47. membership ativa com role ceo gera MEMBERSHIP_STATE_INCONSISTENT', (planInvitationAcceptance(i47, nowMs) as InvitationAcceptanceFailure).reasonCode === 'MEMBERSHIP_STATE_INCONSISTENT');

// 48. membership legada sem status e sem role gera MEMBERSHIP_STATE_INCONSISTENT
const i48 = createBaseInput();
i48.existingMembership = { exists: true, role: undefined };
assertCondition('48. membership legada sem status e sem role gera MEMBERSHIP_STATE_INCONSISTENT', (planInvitationAcceptance(i48, nowMs) as InvitationAcceptanceFailure).reasonCode === 'MEMBERSHIP_STATE_INCONSISTENT');

// 49. convite accepted pelo mesmo UID com membership ativa de role inválido gera MEMBERSHIP_STATE_INCONSISTENT
const i49 = createBaseInput();
i49.invitation.status = 'accepted';
i49.invitation.acceptedBy = 'user123';
i49.existingMembership = { exists: true, status: 'active', role: 'invalid_role' };
assertCondition('49. convite accepted pelo mesmo UID com membership ativa de role inválido gera MEMBERSHIP_STATE_INCONSISTENT', (planInvitationAcceptance(i49, nowMs) as InvitationAcceptanceFailure).reasonCode === 'MEMBERSHIP_STATE_INCONSISTENT');

// 50. membership ativa admin preserva admin
const i50 = createBaseInput();
i50.invitation.role = 'member';
i50.existingMembership = { exists: true, status: 'active', role: 'admin' };
const r50 = planInvitationAcceptance(i50, nowMs) as InvitationAcceptanceSuccess;
assertCondition('50. membership ativa admin preserva admin', r50.success && r50.membershipRole === 'admin');

// 51. membership ativa owner preserva owner
const i51 = createBaseInput();
i51.invitation.role = 'member';
i51.existingMembership = { exists: true, status: 'active', role: 'owner' };
const r51 = planInvitationAcceptance(i51, nowMs) as InvitationAcceptanceSuccess;
assertCondition('51. membership ativa owner preserva owner', r51.success && r51.membershipRole === 'owner');

// 52. papel do convite nunca substitui papel inválido da membership existente
const i52 = createBaseInput();
i52.invitation.role = 'member';
i52.existingMembership = { exists: true, status: 'active', role: 'invalid_role' };
assertCondition('52. papel do convite nunca substitui papel inválido da membership existente', (planInvitationAcceptance(i52, nowMs) as InvitationAcceptanceFailure).reasonCode === 'MEMBERSHIP_STATE_INCONSISTENT');

// 53. InvitationAcceptancePlanner.ts não contém a palavra de tipo any em declaração ou cast
// We use a regex to ensure it catches actual usages as type or cast, but not words containing any.
assertCondition('53. InvitationAcceptancePlanner.ts não contém a palavra de tipo any em declaração ou cast', !/\bany\b/.test(content));

// 54. InvitationAcceptanceFailure.reasonCode não é string
assertCondition('54. InvitationAcceptanceFailure.reasonCode não é string', !content.includes("reasonCode: string;"));

// 55. não existem casts as any
assertCondition('55. não existem casts as any', !content.includes("as any"));

// 56. não existe fallback de membershipRole para inviteRole quando a membership já existe
assertCondition('56. não existe fallback de membershipRole para inviteRole quando a membership já existe', !content.includes("existing.role || inv.role"));

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
