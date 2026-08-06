import fs from 'fs';
import path from 'path';

function runTests() {
  console.log("Starting OrganizationContext performance tests (MN-PERF-RC-1-ORG-CONTEXT)...");
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      failed++;
    }
  }

  const filePath = 'src/contexts/OrganizationContext.tsx';
  const fullPath = path.join(process.cwd(), filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }
  
  const content = fs.readFileSync(fullPath, 'utf8');

  assert(content.includes('Promise.all'), "1. Promise.all existe");
  assert(content.includes('orgPromise'), "2. orgPromise existe");
  assert(content.includes('memberPromise'), "3. memberPromise existe");
  assert(content.includes('subscriptionPromise'), "4. subscriptionPromise existe");
  assert(content.includes('const orgPromise = withTimeout(getDoc(orgRef), 8000, "Firestore timeout loading org")'), "5. organização usa withTimeout");
  assert(content.includes('const memberPromise = withTimeout(getDoc(memberRef), 8000, "Firestore timeout loading member")'), "6. membership usa withTimeout");
  assert(content.includes('const subscriptionPromise = withTimeout(getDoc(subRef), 8000, "Firestore timeout loading sub")'), "7. assinatura usa withTimeout");
  
  assert(
    content.includes('const orgPromise = withTimeout(getDoc(orgRef), 8000'), 
    "8. timeout da organização continua 8000"
  );
  assert(
    content.includes('const memberPromise = withTimeout(getDoc(memberRef), 8000'), 
    "9. timeout da membership continua 8000"
  );
  assert(
    content.includes('const subscriptionPromise = withTimeout(getDoc(subRef), 8000'), 
    "10. timeout da assinatura continua 8000"
  );
  
  assert(
    content.includes('await Promise.all([\n          orgPromise,\n          memberPromise,\n          subscriptionPromise\n        ])') || 
    content.match(/await\s+Promise\.all\(\s*\[\s*orgPromise\s*,\s*memberPromise\s*,\s*subscriptionPromise\s*\]\s*\)/) !== null, 
    "11. Promise.all aguarda as três promises"
  );
  
  assert(content.includes('legacyMemberRef'), "12. membership legada permanece");
  
  const memberSnapExistsIndex = content.indexOf('if (memberSnap.exists())');
  const legacyMemberRefIndex = content.indexOf('legacyMemberRef', memberSnapExistsIndex);
  assert(memberSnapExistsIndex > 0 && legacyMemberRefIndex > memberSnapExistsIndex, "13. membership legada aparece depois da verificação memberSnap.exists()");
  
  const promiseAllIndex = content.indexOf('Promise.all');
  const legacyInsidePromiseAll = content.substring(promiseAllIndex, promiseAllIndex + 150).includes('legacyMemberRef');
  assert(!legacyInsidePromiseAll, "14. membership legada não faz parte do Promise.all");
  
  assert(content.includes('currentSub = subSnap.data()') || content.includes('currentSub = subSnap.data();'), "15. currentSub usa subSnap");
  assert(content.includes('setSubscriptionData(currentSub)'), "16. setSubscriptionData(currentSub) existe");
  
  const setSubNullCount = (content.match(/setSubscriptionData\(null\)/g) || []).length;
  assert(setSubNullCount >= 2, "17. setSubscriptionData(null) existe (pelo menos 2 vezes)");
  
  assert(content.includes('useState<any>(cachedContext?.subscription ?? null)'), "18. subscriptionData inicia usando cachedContext?.subscription");
  assert(content.includes('subscription: currentSub'), "19. cache inclui subscription: currentSub");
  assert(content.includes('subscription: subscriptionData'), "20. contextValue continua expondo subscription: subscriptionData");
  assert(content.includes("window.addEventListener('mn_tenant_switched', handleTenantSwitch)"), "21. listener mn_tenant_switched permanece");
  assert(content.includes("window.removeEventListener('mn_tenant_switched', handleTenantSwitch)"), "22. cleanup do listener permanece");
  assert(content.includes('let active = true'), "23. active permanece");
  assert(content.includes('if (active) setLoadingOrg(false)'), "24. finally verifica active");
  assert(!content.includes("profile.systemRole === 'admin'"), "25. profile.systemRole === 'admin' não existe");
  assert(content.includes('isGlobalPrivilegedUser(profile)'), "26. isGlobalPrivilegedUser(profile) é usado no Support Mode");
  assert(content.includes('MUSIC_SCALE_PLANS'), "27. MUSIC_SCALE_PLANS permanece");
  assert(content.includes('resolveMusicScalePlan'), "28. resolveMusicScalePlan permanece");
  assert(content.includes('doc(db, "organizations"'), "29. coleção organizations permanece");
  assert(content.includes('doc(db, "subscriptions"'), "30. coleção subscriptions permanece");
  assert(content.includes("doc(db, 'organization_members'"), "31. coleção organization_members permanece");
  assert(!content.includes('setInterval'), "32. nenhum setInterval foi adicionado");
  assert(!content.match(/retry|attempts|maxRetries/i), "33. nenhum retry automático foi adicionado");
  assert(!content.includes('getIdToken(true)'), "34. nenhum getIdToken(true) foi adicionado");
  assert(!content.includes('fetch('), "35. nenhum fetch foi adicionado");
  
  // Test 36: test tenant switch block check
  const tenantSwitchStart = content.indexOf('const handleTenantSwitch');
  const tenantListenerStart = content.indexOf("window.addEventListener('mn_tenant_switched'", tenantSwitchStart);
  let tenantSwitchBlock = '';
  if (tenantSwitchStart >= 0 && tenantListenerStart > tenantSwitchStart) {
    tenantSwitchBlock = content.slice(tenantSwitchStart, tenantListenerStart);
  }
  
  assert(
    tenantSwitchStart >= 0 &&
    tenantListenerStart > tenantSwitchStart &&
    tenantSwitchBlock.includes("localStorage.removeItem('mn_org_context')"),
    '36. cache mn_org_context é removido no tenant switch'
  );

  // No external files written check
  const testSourcePath = path.join(process.cwd(), 'scripts/test_mn_perf_rc1_organization_context.ts');
  const testSource = fs.readFileSync(testSourcePath, 'utf8');

  const forbiddenWriteApis = [
    ['write', 'File', 'Sync'].join(''),
    ['write', 'File'].join(''),
    ['append', 'File', 'Sync'].join(''),
    ['append', 'File'].join(''),
    ['create', 'Write', 'Stream'].join('')
  ];

  assert(
    forbiddenWriteApis.every(api => !testSource.includes(`fs.${api}(`)),
    '37. nenhum arquivo externo é escrito pelo teste'
  );

  // Dynamically create regex for the unconditional asserts so they don't trigger the test
  const assertTrueStr = ['assert', '(', 'true'].join('');
  const booleanTrueStr = ['Boolean', '(', 'true', ')'].join('');
  const orTrueStr = ['|', '|', ' true'].join('');
  const andTrueStr = ['&', '&', ' true'].join('');

  // We have to ignore the very line where we check this in the testSource
  // To keep it simple, we split the source into lines and filter out lines matching 'testSource.includes'
  const lines = testSource.split('\n');
  
  const hasAssertTrue = lines.some(line => line.includes(assertTrueStr) && !line.includes('assertTrueStr'));
  const hasBooleanTrue = lines.some(line => line.includes(booleanTrueStr) && !line.includes('booleanTrueStr'));
  const hasOrTrue = lines.some(line => line.includes(orTrueStr) && !line.includes('orTrueStr'));
  const hasAndTrue = lines.some(line => line.includes(andTrueStr) && !line.includes('andTrueStr'));

  assert(!hasAssertTrue, `38. não existe ${assertTrueStr}`);
  assert(!hasBooleanTrue, `39. não existe ${booleanTrueStr}`);
  assert(!hasOrTrue, `40. não existe ${orTrueStr}`);
  assert(!hasAndTrue, `41. não existe ${andTrueStr}`);

  console.log(`\nTests completed: ${passed} passed, ${failed} failed.`);
  
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
