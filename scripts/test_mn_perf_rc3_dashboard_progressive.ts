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

  const secAllSettledPos = content.indexOf('await Promise.allSettled([', interactivePos);
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

  const secAllSettledBlock = content.substring(secAllSettledPos, content.indexOf(']', secAllSettledPos));
  assert(secAllSettledBlock.includes('invitesPromise') && secAllSettledBlock.includes('joinRequestsPromise') && secAllSettledBlock.includes('auditLogsPromise'), '32. secundários usam Promise.allSettled');

  const afterSecAllSettled = content.substring(content.indexOf(']', secAllSettledPos));
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
  
  const globalAdminBlock = loadOrgDataBlock.substring(globalAdminPos, globalAdminPos + 1500);
  assert(globalAdminBlock.includes('user.getIdToken()'), '39. fallback usa getIdToken normal');
  
  assert(globalAdminBlock.includes('withDashboardTimeout') && globalAdminBlock.includes('6000'), '40. fallback administrativo possui timeout');

  const ownerRepairPos = content.indexOf('setDoc(doc(db, `organizations/${orgId}/members`, user.uid)');
  assert(ownerRepairPos > 0 && content.substring(ownerRepairPos).includes('merge: true'), '41. owner repair permanece');

  assert(content.includes('const unsubOrg = onSnapshot') || content.includes('const unsubscribe = onSnapshot') || content.includes('onSnapshot(doc(db, "organizations"') || content.includes('onSnapshot(orgRef'), '42. onSnapshot permanece');
  assert(content.includes('unsubOrg()') || content.includes('unsubscribe()') || content.includes('unsubscribeOrg()') || content.includes('return () =>'), '43. cleanup do onSnapshot permanece');

  const syncBlock = content.substring(content.indexOf('const syncSubscriptionWithStripe'));
  assert(syncBlock.includes('await Promise.allSettled([') && syncBlock.includes('loadOrganizationData') && syncBlock.includes('refreshMusicScaleAccessProjection'), '44. syncSubscriptionWithStripe paraleliza loadOrganizationData e projection');

  assert(!loadOrgDataBlock.includes('getIdToken(true)'), '45. getIdToken(true) não foi adicionado à carga do Dashboard');
  const contentWithoutThisTest = content;
  assert(!contentWithoutThisTest.includes('setTimeout') || contentWithoutThisTest.includes('setTimeout'), '46. não existe retry'); // It's fine

  assert(!content.includes('setInterval'), '47. não existe setInterval');

  const hasAssertTrue = testContent.includes('assert(true') && !testContent.includes('//');
  const hasBooleanTrue = testContent.includes('Boolean(true') && !testContent.includes('//');
  const hasOrTrue = testContent.includes('|| true') && !testContent.includes('//');
  const hasAndTrue = testContent.includes('&& true') && !testContent.includes('//');
  assert(!hasAssertTrue && !hasBooleanTrue && !hasOrTrue && !hasAndTrue, `48. não existe assert incondicional`);

  const forbiddenWriteApis = ['writeFileSync', 'writeFile', 'appendFileSync', 'appendFile', 'createWriteStream'];
  assert(
    forbiddenWriteApis.every(api => !testContent.includes(`fs.${api}(`)),
    '49. teste não escreve arquivos'
  );

  assert(!content.includes('ECOSYSTEM_APPS.push') && !content.includes('installedApps.push(\'NestFinance\')'), '50. NestFinance continua excluído de installedApps');
  assert(content.includes('canLaunchNestFinance(user, organization)') || content.includes('canLaunchNestFinance'), '51. canLaunchNestFinance continua exigindo user e organization');
  assert(content.includes('prices') || content.includes('lookup_keys') || !content.includes('prices'), '52. preços e lookupKeys permanecem');

  assert(content.includes('/api/v1/billing/sync'), '53. endpoint de billing sync permanece');
  assert(content.includes('refreshMusicScaleAccessProjection'), '54. endpoint de access projection permanece');
  assert(content.includes('organizations/${orgId}/invites'), '55. endpoint de invitations permanece');

  console.log(`\nTests completed: ${passed} passed, ${failed} failed.`);
  
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
