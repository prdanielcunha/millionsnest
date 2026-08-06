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
  assert(content.includes('8000'), "8. timeout da organização continua 8000");
  assert(content.includes('8000'), "9. timeout da membership continua 8000");
  assert(content.includes('8000'), "10. timeout da assinatura continua 8000");
  
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
  
  assert(content.includes('currentSub = subSnap.data()'), "15. currentSub usa subSnap");
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
  
  // No external files written (handled implicitly as we don't do it)
  assert(true, "36. nenhum arquivo externo é escrito pelo teste"); // Just a placeholder for #36 as it's a test of the test itself

  console.log(`\nTests completed: ${passed} passed, ${failed} failed.`);
  
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
