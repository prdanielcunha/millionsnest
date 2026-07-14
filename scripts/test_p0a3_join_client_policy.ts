import {
  normalizeInvitationJoinLanguage,
  parseInvitationJoinPayload,
  getInvitationJoinMessage,
  getInvitationJoinSuccessCopy,
  InvitationJoinFailureReason
} from '../src/lib/InvitationJoinClientPolicy.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let passed = 0;
let failed = 0;

function assertCondition(desc: string, condition: boolean) {
  if (condition) {
    console.log(`[PASS] ${desc}`);
    passed++;
  } else {
    console.error(`[FAIL] ${desc}`);
    failed++;
  }
}

async function runTests() {
  console.log('Starting P0-A.3.3.1 tests...\n');

  // Policy Tests
  assertCondition('1. pt retorna pt', normalizeInvitationJoinLanguage('pt') === 'pt');
  assertCondition('2. pt-BR retorna pt', normalizeInvitationJoinLanguage('pt-BR') === 'pt');
  assertCondition('3. en retorna en', normalizeInvitationJoinLanguage('en') === 'en');
  assertCondition('4. en-US retorna en', normalizeInvitationJoinLanguage('en-US') === 'en');
  assertCondition('5. es retorna es', normalizeInvitationJoinLanguage('es') === 'es');
  assertCondition('6. es-MX retorna es', normalizeInvitationJoinLanguage('es-MX') === 'es');
  assertCondition('7. idioma desconhecido retorna pt', normalizeInvitationJoinLanguage('fr') === 'pt');
  assertCondition('8. valor não string retorna pt', normalizeInvitationJoinLanguage(123) === 'pt');

  const validSuccessNew = {
    success: true,
    organizationId: 'org1',
    organizationName: 'Org 1',
    activeOrganizationId: 'org1',
    membershipRole: 'owner',
    alreadyMember: false,
    legacyTokenMigrated: false,
    reasonCode: 'INVITATION_CAN_BE_ACCEPTED'
  };
  const parsedNew = parseInvitationJoinPayload(validSuccessNew);
  assertCondition('9. sucesso de nova membership é aceito', parsedNew.success === true && (parsedNew as any).reasonCode === 'INVITATION_CAN_BE_ACCEPTED');

  const validSuccessAm = {
    ...validSuccessNew,
    alreadyMember: true,
    reasonCode: 'ALREADY_MEMBER'
  };
  const parsedAm = parseInvitationJoinPayload(validSuccessAm);
  assertCondition('10. sucesso ALREADY_MEMBER é aceito', parsedAm.success === true && (parsedAm as any).reasonCode === 'ALREADY_MEMBER');

  assertCondition('11. role owner é aceito', parseInvitationJoinPayload(validSuccessNew).success === true);
  assertCondition('12. role admin é aceito', parseInvitationJoinPayload({ ...validSuccessNew, membershipRole: 'admin' }).success === true);
  assertCondition('13. role member é aceito', parseInvitationJoinPayload({ ...validSuccessNew, membershipRole: 'member' }).success === true);
  assertCondition('14. role desconhecida vira INVALID_RESPONSE', parseInvitationJoinPayload({ ...validSuccessNew, membershipRole: 'guest' }).success === false && (parseInvitationJoinPayload({ ...validSuccessNew, membershipRole: 'guest' }) as any).reasonCode === 'INVALID_RESPONSE');
  
  assertCondition('15. organizationId vazio vira INVALID_RESPONSE', parseInvitationJoinPayload({ ...validSuccessNew, organizationId: ' ' }).success === false);
  assertCondition('16. activeOrganizationId divergente vira INVALID_RESPONSE', parseInvitationJoinPayload({ ...validSuccessNew, activeOrganizationId: 'org2' }).success === false);
  assertCondition('17. legacyTokenMigrated true vira INVALID_RESPONSE', parseInvitationJoinPayload({ ...validSuccessNew, legacyTokenMigrated: true }).success === false);
  
  assertCondition('18. alreadyMember true com reason incorreto vira INVALID_RESPONSE', parseInvitationJoinPayload({ ...validSuccessAm, reasonCode: 'INVITATION_CAN_BE_ACCEPTED' }).success === false);
  assertCondition('19. alreadyMember false com reason incorreto vira INVALID_RESPONSE', parseInvitationJoinPayload({ ...validSuccessNew, reasonCode: 'ALREADY_MEMBER' }).success === false);

  assertCondition('20. falha conhecida é aceita', parseInvitationJoinPayload({ success: false, reasonCode: 'INVITE_EXPIRED' }).success === false && (parseInvitationJoinPayload({ success: false, reasonCode: 'INVITE_EXPIRED' }) as any).reasonCode === 'INVITE_EXPIRED');
  assertCondition('21. falha desconhecida vira INVALID_RESPONSE', parseInvitationJoinPayload({ success: false, reasonCode: 'UNKNOWN_ERROR' }).success === false && (parseInvitationJoinPayload({ success: false, reasonCode: 'UNKNOWN_ERROR' }) as any).reasonCode === 'INVALID_RESPONSE');
  
  assertCondition('22. null vira INVALID_RESPONSE', parseInvitationJoinPayload(null).success === false);
  assertCondition('23. array vira INVALID_RESPONSE', parseInvitationJoinPayload([]).success === false);
  assertCondition('24. texto vira INVALID_RESPONSE', parseInvitationJoinPayload("error").success === false);

  const reasons: InvitationJoinFailureReason[] = [
      'UNAUTHENTICATED', 'INVALID_TOKEN', 'AUTHENTICATED_EMAIL_REQUIRED', 'INVALID_INVITE_ROLE',
      'INVITE_IDENTITY_MISMATCH', 'INVITE_NOT_FOUND', 'ORGANIZATION_NOT_FOUND', 'ORGANIZATION_INACTIVE',
      'INVITE_STATE_INCONSISTENT', 'INVITE_REVOKED', 'INVITE_EXPIRED', 'INVITE_MAX_USES_REACHED',
      'MEMBERSHIP_INACTIVE', 'MEMBERSHIP_STATE_INCONSISTENT', 'INVITE_ALREADY_CONSUMED',
      'MEMBER_LIMIT_UNAVAILABLE', 'MEMBER_LIMIT_INVALID', 'MEMBER_LIMIT_REACHED',
      'INTERNAL_ERROR', 'NETWORK_ERROR', 'INVALID_RESPONSE'
  ];

  assertCondition('25. cada reasonCode possui mensagem em pt', reasons.every(r => getInvitationJoinMessage(r, 'pt')));
  assertCondition('26. cada reasonCode possui mensagem em en', reasons.every(r => getInvitationJoinMessage(r, 'en')));
  assertCondition('27. cada reasonCode possui mensagem em es', reasons.every(r => getInvitationJoinMessage(r, 'es')));

  let noEmptyTitle = true;
  let noEmptyDesc = true;
  let correctRetryables = true;
  const retryableSet = new Set(['MEMBER_LIMIT_UNAVAILABLE', 'INTERNAL_ERROR', 'NETWORK_ERROR', 'INVALID_RESPONSE']);

  for (const r of reasons) {
    for (const l of ['pt', 'en', 'es'] as const) {
      const msg = getInvitationJoinMessage(r, l);
      if (!msg.title.trim()) noEmptyTitle = false;
      if (!msg.description.trim()) noEmptyDesc = false;
      if (msg.retryable !== retryableSet.has(r)) correctRetryables = false;
    }
  }

  assertCondition('28. nenhuma mensagem possui title vazio', noEmptyTitle);
  assertCondition('29. nenhuma mensagem possui description vazia', noEmptyDesc);
  assertCondition('30. somente os quatro erros definidos são retryable', correctRetryables);

  assertCondition('31. sucesso de membro novo possui copy nos três idiomas', 
    !!getInvitationJoinSuccessCopy(false, 'Org', 'pt').title &&
    !!getInvitationJoinSuccessCopy(false, 'Org', 'en').title &&
    !!getInvitationJoinSuccessCopy(false, 'Org', 'es').title
  );
  
  assertCondition('32. sucesso already member possui copy nos três idiomas', 
    !!getInvitationJoinSuccessCopy(true, 'Org', 'pt').title &&
    !!getInvitationJoinSuccessCopy(true, 'Org', 'en').title &&
    !!getInvitationJoinSuccessCopy(true, 'Org', 'es').title
  );

  const ptCopy = getInvitationJoinSuccessCopy(false, 'SuperOrg', 'pt');
  assertCondition('33. organizationName é preservado na descrição', ptCopy.description.includes('SuperOrg'));

  const policyContent = fs.readFileSync(path.join(__dirname, '../src/lib/InvitationJoinClientPolicy.ts'), 'utf-8');
  assertCondition('34. política não contém any', !policyContent.includes(' any ') && !policyContent.includes(' any;') && !policyContent.includes('<any>'));
  assertCondition('35. política não usa browser globals', !policyContent.includes('window.') && !policyContent.includes('document.') && !policyContent.includes('navigator.'));
  assertCondition('36. política não usa fetch', !policyContent.includes('fetch('));
  assertCondition('37. política não usa Firebase', !policyContent.includes('firebase') && !policyContent.includes('firestore'));
  assertCondition('38. política não usa Date.now', !policyContent.includes('Date.now') && !policyContent.includes('new Date'));
  assertCondition('39. política não contém logs', !policyContent.includes('console.'));

  const joinContent = fs.readFileSync(path.join(__dirname, '../src/pages/Join.tsx'), 'utf-8');
  assertCondition('40. Join importa InvitationJoinClientPolicy', joinContent.includes('InvitationJoinClientPolicy.js'));
  assertCondition('41. Join não contém any', !joinContent.includes(' any ') && !joinContent.includes(': any'));
  assertCondition('42. Join valida token antes do fetch', joinContent.includes("if (!trimmedToken)") || joinContent.includes("if (!token"));
  assertCondition('43. Join valida orgId antes do fetch', joinContent.includes("if (!orgId)"));
  assertCondition('44. Join possui useRef para trava', joinContent.includes("useRef(false)") || joinContent.includes("requestFiredRef"));
  assertCondition('45. Join usa AbortController', joinContent.includes("new AbortController()"));
  assertCondition('46. Join aborta no cleanup', joinContent.includes("abort()"));
  assertCondition('47. Join limpa temporizador', joinContent.includes("clearTimeout"));
  assertCondition('48. Join usa parseInvitationJoinPayload', joinContent.includes("parseInvitationJoinPayload("));
  assertCondition('49. Join usa normalizeInvitationJoinLanguage', joinContent.includes("normalizeInvitationJoinLanguage("));
  assertCondition('50. Join usa getInvitationJoinMessage', joinContent.includes("getInvitationJoinMessage("));
  assertCondition('51. Join usa getInvitationJoinSuccessCopy', joinContent.includes("getInvitationJoinSuccessCopy("));
  assertCondition('52. Join não possui cadeia manual de reasonCode', !joinContent.includes("data.reasonCode === 'INVITE_EXPIRED'"));
  assertCondition('53. Join não registra token', !joinContent.includes('console.log') || !joinContent.includes('token'));
  assertCondition('54. Join possui aria-live', joinContent.includes('aria-live="polite"'));
  assertCondition('55. Join possui aria-busy', joinContent.includes('aria-busy={'));
  assertCondition('56. retry somente aparece para erro retryable', joinContent.includes('errorMessage.retryable ?'));
  assertCondition('57. sucesso remove mn_invite_redirect', joinContent.includes("removeItem('mn_invite_redirect')"));
  assertCondition('58. sucesso redireciona para /dashboard', joinContent.includes("window.location.href = '/dashboard'"));
  assertCondition('59. requestLoading foi removido', !joinContent.includes("setRequestLoading"));
  assertCondition('60. profile e switchOrganization não são desestruturados', !joinContent.includes("switchOrganization") && !joinContent.includes(" profile"));


  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(console.error);
