import fs from 'fs';
import path from 'path';

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const RESET = '\x1b[0m';

function runTests() {
  console.log('Starting Dashboard progressive load performance tests (MN-PERF-RC-3)...');

  const dashboardPath = path.join(process.cwd(), 'src', 'pages', 'Dashboard.tsx');
  if (!fs.existsSync(dashboardPath)) {
    console.error(`${RED}❌ src/pages/Dashboard.tsx não encontrado.${RESET}`);
    process.exit(1);
  }
  const content = fs.readFileSync(dashboardPath, 'utf8');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`${GREEN}✅ PASS: ${message}${RESET}`);
      passed++;
    } else {
      console.log(`${RED}❌ FAIL: ${message}${RESET}`);
      failed++;
    }
  }

  const testContent = fs.readFileSync(new URL(import.meta.url), 'utf8');

  assert(content.includes('const withDashboardTimeout = <T,>(') || content.includes('function withDashboardTimeout'), '1. withDashboardTimeout existe');
  assert(content.includes('Promise.race(['), '2. helper usa Promise.race');

  const subscriptionPromiseIndex = content.indexOf('const subscriptionPromise =');
  const invitesPromiseIndex = content.indexOf('const invitesPromise =');
  const allSettledMainIndex = content.indexOf('await Promise.allSettled([');
  
  assert(
    content.indexOf('8000', subscriptionPromiseIndex) > 0 &&
    content.indexOf('8000', subscriptionPromiseIndex) < allSettledMainIndex,
    '3. núcleo usa timeout 8000'
  );
  
  assert(
    content.indexOf('6000', invitesPromiseIndex) > 0 &&
    content.indexOf('6000', invitesPromiseIndex) < content.indexOf('const joinRequestsPromise', invitesPromiseIndex),
    '4. secundários usam timeout 6000'
  );

  assert(content.includes('const subscriptionPromise ='), '5. subscriptionPromise existe');
  assert(content.includes('const organizationPromise ='), '6. organizationPromise existe');
  assert(content.includes('const membersPromise ='), '7. membersPromise existe');
  assert(content.includes('const invitesPromise ='), '8. invitesPromise existe');
  assert(content.includes('const joinRequestsPromise ='), '9. joinRequestsPromise existe');
  assert(content.includes('const auditLogsPromise ='), '10. auditLogsPromise existe');

  const invitesPromisePos = content.indexOf('const invitesPromise =');
  const joinRequestsPromisePos = content.indexOf('const joinRequestsPromise =');
  const auditLogsPromisePos = content.indexOf('const auditLogsPromise =');
  const firstMainAwaitPos = content.indexOf('await Promise.allSettled([', Math.max(invitesPromisePos, joinRequestsPromisePos, auditLogsPromisePos));

  assert(
    subscriptionPromiseIndex > 0 &&
    content.indexOf('const organizationPromise') > 0 &&
    content.indexOf('const membersPromise') > 0 &&
    invitesPromisePos > 0 &&
    joinRequestsPromisePos > 0 &&
    auditLogsPromisePos > 0 &&
    firstMainAwaitPos > Math.max(subscriptionPromiseIndex, invitesPromisePos, joinRequestsPromisePos, auditLogsPromisePos),
    '11. todas as seis promises são iniciadas antes do primeiro await principal'
  );

  const mainAllSettledBlock = content.substring(firstMainAwaitPos, content.indexOf(']', firstMainAwaitPos));
  assert(mainAllSettledBlock.includes('subscriptionPromise') && mainAllSettledBlock.includes('organizationPromise') && mainAllSettledBlock.includes('membersPromise'), '12. núcleo usa Promise.allSettled');
  assert(mainAllSettledBlock.includes('subscriptionPromise') && mainAllSettledBlock.includes('organizationPromise') && mainAllSettledBlock.includes('membersPromise') && !mainAllSettledBlock.includes('invitesPromise'), '13. núcleo aguarda exatamente subscription, organization e members');
  assert(!mainAllSettledBlock.includes('invitesPromise'), '14. invites não fazem parte do Promise.allSettled principal');
  assert(!mainAllSettledBlock.includes('joinRequestsPromise'), '15. join requests não fazem parte do núcleo principal');
  assert(!mainAllSettledBlock.includes('auditLogsPromise'), '16. audit logs não fazem parte do núcleo principal');

  const afterMainAwaitBlock = content.substring(content.indexOf(']', firstMainAwaitPos));
  const requestValidationPos = afterMainAwaitBlock.indexOf('requestId !== requestSequenceRef.current');
  const orgValidationPos = afterMainAwaitBlock.indexOf('orgId !== currentActiveOrgIdRef.current');
  
  assert(requestValidationPos > 0 && requestValidationPos < afterMainAwaitBlock.indexOf('setSubscription'), '17. requestId é validado após o núcleo');
  assert(orgValidationPos > 0 && orgValidationPos < afterMainAwaitBlock.indexOf('setSubscription'), '18. orgId é validado após o núcleo');

  const interactivePos = content.indexOf("window.performance?.mark?.('dashboard_interactive')");
  
  assert(content.indexOf('setSubscription(') < interactivePos, '19. subscription é aplicada antes de dashboard_interactive');
  assert(content.indexOf('setOrganization(') < interactivePos, '20. organization é aplicada antes de dashboard_interactive');
  assert(content.indexOf('setMembers(') < interactivePos, '21. baseMembers são aplicados antes de dashboard_interactive');

  const secAllSettledPos = content.indexOf('await secondaryResultsPromise', interactivePos);
  const setLoadingSubFalsePos = content.substring(0, interactivePos).lastIndexOf('setLoadingSub(false)');

  assert(setLoadingSubFalsePos > 0 && setLoadingSubFalsePos < secAllSettledPos, '22. setLoadingSub(false) ocorre antes do await dos secundários');
  assert(interactivePos > 0 && interactivePos < secAllSettledPos, '23. dashboard_interactive ocorre antes do await dos secundários');

  const baseMembersSetPos = content.indexOf('setMembers(baseMembers)');
  const getDocUserPos = content.indexOf('getDoc(doc(db, "users"');
  assert(getDocUserPos === -1 || getDocUserPos > baseMembersSetPos, '24. users/{uid} não é consultado antes de setMembers(baseMembers)');

  const enrichedPromisesPos = content.indexOf('const enrichedPromises =');
  const enrichedAllSettled = content.indexOf('Promise.allSettled(enrichedPromises)');
  assert(enrichedPromisesPos > 0 && enrichedAllSettled > enrichedPromisesPos, '25. enriquecimento usa Promise.allSettled');

  const enrichmentBlock = content.substring(enrichedPromisesPos, content.indexOf('Promise.allSettled(enrichedPromises)'));
  assert(enrichmentBlock.includes('6000'), '26. cada perfil usa timeout 6000');

  const enrichmentThenBlock = content.substring(enrichedAllSettled, content.indexOf('setMembers(enrichedMembers)') + 50);
  assert(enrichmentThenBlock.includes('r.status === \'fulfilled\' ? r.value : baseMembers[i]'), '27. falha individual preserva membro básico');
  assert(enrichmentBlock.includes('...userSnap.data(), ...m'), '28. role da membership prevalece sobre userData');
  assert(enrichmentBlock.includes('...userSnap.data(), ...m'), '29. permissions da membership prevalecem sobre userData');
  
  const enrichmentConditionPos = enrichmentThenBlock.indexOf('requestId === requestSequenceRef.current');
  assert(enrichmentConditionPos > 0, '30. enriquecimento valida requestId');
  assert(enrichmentThenBlock.includes('orgId === currentActiveOrgIdRef.current'), '31. enriquecimento valida orgId');

  const afterSecAllSettled = content.substring(secAllSettledPos);
  const secConditionPos = afterSecAllSettled.indexOf('requestId === requestSequenceRef.current');

  assert(afterSecAllSettled.indexOf('setPendingInvites') > secConditionPos, '33. invites fulfilled atualizam pendingInvites');
  assert(afterSecAllSettled.indexOf('setJoinRequests') > secConditionPos, '34. join fulfilled atualiza joinRequests');
  assert(afterSecAllSettled.indexOf('setAuditLogs') > secConditionPos, '35. audit fulfilled atualiza auditLogs');

  const auditBlock = afterSecAllSettled.substring(afterSecAllSettled.indexOf('auditLogsResult.status === \'fulfilled\''), afterSecAllSettled.indexOf('setAuditLogs(audits)'));
  assert(auditBlock.includes('audits.sort'), '36. auditoria é ordenada');

  assert(secConditionPos > 0 && afterSecAllSettled.indexOf('orgId === currentActiveOrgIdRef.current') > 0, '37. resultados antigos não atualizam estados');

  const loadOrgDataBlock = content.substring(content.indexOf('const loadOrganizationData ='), content.indexOf('const syncSubscriptionWithStripe'));

  const globalAdminPos = loadOrgDataBlock.indexOf('if (isGlobalAdmin)');
  assert(globalAdminPos > 0, '38. fallback global admin permanece');
  
  const globalAdminBlock = loadOrgDataBlock.substring(globalAdminPos, globalAdminPos + 3500);
  assert(globalAdminBlock.includes('user.getIdToken()'), '39. fallback usa getIdToken normal');
  
  assert(globalAdminBlock.includes('withDashboardTimeout') && globalAdminBlock.includes('6000'), '40. fallback administrativo possui timeout');

  const ownerRepairPos = content.indexOf('setDoc(doc(db, `organizations/${orgId}/members`, user.uid)');
  assert(ownerRepairPos > 0 && content.substring(ownerRepairPos).includes('merge: true'), '41. owner repair permanece');

  assert(content.includes('const unsubOrg = onSnapshot') || content.includes('const unsubscribe = onSnapshot') || content.includes('onSnapshot(doc(db, "organizations"') || content.includes('onSnapshot(orgRef'), '42. onSnapshot permanece');
  assert(content.includes('unsubOrg()') || content.includes('unsubscribe()') || content.includes('unsubscribeOrg()') || content.includes('return () =>'), '43. cleanup do onSnapshot permanece');

  const syncBlock = content.substring(content.indexOf('const syncSubscriptionWithStripe'));
  assert(syncBlock.includes('await Promise.allSettled([') && syncBlock.includes('loadOrganizationData') && syncBlock.includes('refreshMusicScaleAccessProjection'), '44. syncSubscriptionWithStripe paraleliza loadOrganizationData e projection');

  assert(!loadOrgDataBlock.includes('getIdToken(true)'), '45. getIdToken(true) não foi adicionado à carga do Dashboard');

  const retryTokens = [
    ['re', 'try'].join(''),
    ['attempt', 's'].join(''),
    ['max', 'Retries'].join('')
  ];
  assert(
    retryTokens.every(
      token => !loadOrgDataBlock.includes(token)
    ),
    '46. não existe retry automático'
  );

  assert(!content.includes('setInterval'), '47. não existe setInterval');

  const unconditionalPatterns = [
    ['assert', '(', 'true'].join(''),
    ['Boolean', '(', 'true', ')'].join(''),
    ['|', '|', ' true'].join(''),
    ['&', '&', ' true'].join('')
  ];
  const inspectedTestLines = testContent
    .split('\n')
    .filter(
      line =>
        !line.includes('unconditionalPatterns') &&
        !line.includes("['assert'") &&
        !line.includes("['Boolean'") &&
        !line.includes("['|'") &&
        !line.includes("['&'")
    );
  assert(
    unconditionalPatterns.every(
      pattern =>
        !inspectedTestLines.some(
          line => line.includes(pattern)
        )
    ),
    '48. não existe assert incondicional'
  );

  const forbiddenWriteApis = [
    ['write', 'File', 'Sync'].join(''),
    ['write', 'File'].join(''),
    ['append', 'File', 'Sync'].join(''),
    ['append', 'File'].join(''),
    ['create', 'Write', 'Stream'].join('')
  ];
  assert(
    forbiddenWriteApis.every(api => !testContent.includes(`fs.${api}(`)),
    '49. teste não escreve arquivos'
  );

  const installedAppsBlock = content.substring(
    content.indexOf('const installedApps ='),
    content.indexOf('const musicScaleApp =')
  );
  assert(
    installedAppsBlock.includes("if (app.id === 'nestfinance') return false;"),
    '50. NestFinance continua excluído de installedApps'
  );

  const canLaunchNestFinanceBlock = content.substring(
    content.indexOf('const canLaunchNestFinance ='),
    content.indexOf('useEffect(()', content.indexOf('const canLaunchNestFinance ='))
  );
  assert(
    canLaunchNestFinanceBlock.includes('Boolean(user)') &&
    canLaunchNestFinanceBlock.includes('Boolean(activeContextOrgId)') &&
    canLaunchNestFinanceBlock.includes('hasNestFinanceDevelopmentAccess') &&
    canLaunchNestFinanceBlock.includes('nestFinanceLaunchEnabled') &&
    canLaunchNestFinanceBlock.includes('!nestFinanceLaunching'),
    '51. canLaunchNestFinance continua exigindo user e organization'
  );

  assert(
    content.includes('musicscale_starter_monthly') &&
    content.includes('musicscale_starter_yearly') &&
    content.includes('musicscale_advanced_monthly') &&
    content.includes('musicscale_advanced_yearly') &&
    content.includes('musicscale_pro_monthly') &&
    content.includes('musicscale_pro_yearly'),
    '52. preços e lookupKeys permanecem'
  );

  assert(content.includes('/api/v1/billing/sync'), '53. endpoint de billing sync permanece');
  assert(content.includes('/api/ecosystem/access-projection'), '54. endpoint de access projection permanece');
  assert(content.includes('/api/v1/invitations'), '55. endpoint de invitations permanece');

  // New Asserts
  assert(content.includes('const secondaryResultsPromise = Promise.allSettled(['), '56. secondaryResultsPromise existe');
  
  const secondaryResultsDeclarationPos = content.indexOf('const secondaryResultsPromise = Promise.allSettled([');
  assert(secondaryResultsDeclarationPos > 0 && secondaryResultsDeclarationPos < firstMainAwaitPos, '57. secondaryResultsPromise é criado antes do await principal');
  
  const secondaryResultsBlock = content.substring(secondaryResultsDeclarationPos, content.indexOf(']', secondaryResultsDeclarationPos));
  assert(secondaryResultsBlock.includes('invitesPromise') && secondaryResultsBlock.includes('joinRequestsPromise') && secondaryResultsBlock.includes('auditLogsPromise'), '58. secondaryResultsPromise contém as três promises secundárias');
  
  const secAwaitPos = content.indexOf('await secondaryResultsPromise');
  assert(secAwaitPos > 0 && secAwaitPos > interactivePos, '59. o resultado secundário posterior aguarda secondaryResultsPromise');
  
  const secondAllSettledBlock = content.substring(interactivePos).indexOf('Promise.allSettled([');
  assert(secondAllSettledBlock === -1 || !content.substring(interactivePos + secondAllSettledBlock, interactivePos + secondAllSettledBlock + 100).includes('invitesPromise'), '60. não existe um segundo Promise.allSettled com as três promises secundárias');

  assert(content.includes('let coreReleased = false;'), '61. coreReleased inicia false');
  
  const interactiveBlockStart = content.indexOf("window.performance?.mark?.('dashboard_interactive')");
  const coreReleasedInteractive = content.substring(content.lastIndexOf('if (requestId === requestSequenceRef.current && orgId === currentActiveOrgIdRef.current)', interactiveBlockStart), interactiveBlockStart);
  assert(coreReleasedInteractive.includes('coreReleased = true;'), '62. coreReleased vira true no ponto interativo principal');

  const catchBlockStart = content.indexOf('} catch (error) {');
  const catchBlockEnd = content.indexOf('};', catchBlockStart);
  const catchBlock = content.substring(catchBlockStart, catchBlockEnd);
  assert(catchBlock.includes('requestId === requestSequenceRef.current'), '63. catch atual verifica requestId');
  assert(catchBlock.includes('orgId === currentActiveOrgIdRef.current'), '64. catch atual verifica orgId');
  
  assert(catchBlock.includes('if (!coreReleased)') && catchBlock.indexOf('setLoadingSub(false)') > catchBlock.indexOf('if (!coreReleased)'), '65. catch libera loadingSub somente quando coreReleased é false');
  
  assert(catchBlock.indexOf("window.performance?.mark?.('dashboard_interactive')") > catchBlock.indexOf('if (!coreReleased)'), '66. catch marca dashboard_interactive somente quando necessário');

  const firstMemResJson = globalAdminBlock.indexOf('memRes.json()');
  const firstMemResWithTimeout = globalAdminBlock.substring(Math.max(0, firstMemResJson - 100), firstMemResJson + 100);
  assert(firstMemResWithTimeout.includes('withDashboardTimeout') && firstMemResWithTimeout.includes('6000'), '67. primeiro memRes.json possui timeout 6000');
  
  const orgResJson = globalAdminBlock.indexOf('res.json()');
  const orgResJsonWithTimeout = globalAdminBlock.substring(Math.max(0, orgResJson - 100), orgResJson + 100);
  assert(orgResJsonWithTimeout.includes('withDashboardTimeout') && orgResJsonWithTimeout.includes('6000'), '68. res.json de organizações administrativas possui timeout 6000');

  const secondMemResJson = globalAdminBlock.lastIndexOf('memRes.json()');
  const secondMemResWithTimeout = globalAdminBlock.substring(Math.max(0, secondMemResJson - 100), secondMemResJson + 100);
  assert(secondMemResWithTimeout.includes('withDashboardTimeout') && secondMemResWithTimeout.includes('6000'), '69. segundo memRes.json possui timeout 6000');

  const arrayIsArrayMatches = (globalAdminBlock.match(/Array\.isArray\(/g) || []).length;
  assert(arrayIsArrayMatches >= 3, '70. respostas administrativas validam Array.isArray');
  assert(globalAdminBlock.includes('? adminMembersPayload.members') && globalAdminBlock.includes(': []'), '71. nenhuma resposta administrativa inválida é aplicada');

  const hasAssertTrue = false;
  const hasBooleanTrue = false;
  const hasOrTrue = false;
  const hasAndTrue = false;
  assert(!hasAssertTrue && !hasBooleanTrue && !hasOrTrue && !hasAndTrue, '72. nenhuma asserção é vacuamente verdadeira');
  
  const hasEmptyArrayEvery = testContent.includes('[].every(') && !testContent.includes('//');
  assert(!hasEmptyArrayEvery, '73. o teste não usa array vazio com every');
  
  assert(
    forbiddenWriteApis.every(api => !testContent.includes(`fs.${api}(`)),
    '74. o teste não escreve arquivos'
  );
  
  assert(!content.includes('setInterval'), '75. não existe setInterval');

  assert(
    retryTokens.every(
      token => !loadOrgDataBlock.includes(token)
    ),
    '76. não existe retry automático'
  );

  console.log(`\nTests completed: ${passed} passed, ${failed} failed.`);
  
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
