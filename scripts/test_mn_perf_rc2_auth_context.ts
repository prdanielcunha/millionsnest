import fs from 'fs';
import path from 'path';

function runTests() {
  console.log("Starting AuthContext performance tests (MN-PERF-RC-2.1-AUTH-ABORT-VALIDATION)...");
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

  const filePath = 'src/contexts/AuthContext.tsx';
  const fullPath = path.join(process.cwd(), filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }
  
  const content = fs.readFileSync(fullPath, 'utf8');

  // 1
  assert(content.includes('/api/user/organization-context'), "1. endpoint /api/user/organization-context permanece");
  // 2
  assert(content.includes('new AbortController()'), "2. AbortController existe");
  // 3
  assert(content.includes('signal: controller.signal'), "3. signal do controller é enviado ao fetch");
  // 4
  assert(content.includes('6000'), "4. timeout de 6000 existe");
  // 5
  assert(content.includes('controller.abort()'), "5. controller.abort() existe");
  // 6
  assert(content.includes('clearTimeout'), "6. clearTimeout existe");
  // 7
  assert(content.includes('finally') && content.indexOf('clearTimeout') > content.indexOf('finally'), "7. clearTimeout ocorre em finally");
  // 8
  assert(content.includes('catch (ctxErr)') && content.includes('setCanonicalContext(null)'), "8. AbortError/Network error tratado e define canonicalContext(null)");
  // 9
  assert(content.includes('setCanonicalContext(null)'), "9. canonicalContext pode ser definido como null");
  // 10
  assert(!content.substring(content.indexOf('catch (ctxErr)'), content.indexOf('// Automatic promotion')).includes('logout()'), "10. erro da API não chama logout");
  // 11
  assert(!content.substring(content.indexOf('catch (ctxErr)'), content.indexOf('// Automatic promotion')).includes('signOut('), "11. erro da API não chama signOut");
  // 12
  assert(!content.substring(content.indexOf('catch (ctxErr)'), content.indexOf('// Automatic promotion')).includes('organizationId:'), "12. erro da API não fabrica organizationId");
  // 13
  assert(!content.substring(content.indexOf('catch (ctxErr)'), content.indexOf('// Automatic promotion')).includes('role:'), "13. erro da API não fabrica role");
  // 14
  assert(!content.substring(content.indexOf('catch (ctxErr)'), content.indexOf('// Automatic promotion')).includes('appAccess:'), "14. erro da API não fabrica appAccess");
  // 15
  assert(!content.substring(content.indexOf('catch (ctxErr)'), content.indexOf('// Automatic promotion')).includes('entitlements:'), "15. erro da API não fabrica entitlements");
  // 16
  assert(content.includes('currentUser.getIdToken()'), "16. login normal continua usando getIdToken()");
  // 17
  assert(!content.substring(0, content.indexOf('/api/user/organization-context')).includes('getIdToken(true)'), "17. login normal não foi trocado para getIdToken(true)");
  // 18
  assert(content.includes('/api/v1/onboarding/bootstrap'), "18. fluxo específico anterior de novo usuário não foi removido");
  // 19
  assert(content.includes('doc(db, "users", currentUser.uid)'), "19. documento users/{uid} continua sendo lido");
  // 20
  assert(content.includes('setProfile('), "20. perfil continua sendo atualizado");
  // 21
  assert(content.includes('lastLoginAt:'), "21. lastLoginAt permanece");
  // 22
  assert(content.includes('analytics.track('), "22. analytics permanece");
  // 23
  assert(content.includes('onAuthStateChanged('), "23. onAuthStateChanged permanece");
  // 24
  assert(content.includes('const unsubscribe = onAuthStateChanged') && content.includes('unsubscribe()'), "24. unsubscribe permanece");
  // 25
  assert(content.includes('let active = true'), "25. active existe");
  // 26
  assert(content.includes('active = false'), "26. cleanup define active como false");
  // 27
  assert(content.includes('setLoading(false)'), "27. loading é liberado");
  // 28
  assert(!content.includes('setInterval('), "28. não existe setInterval");
  // 29
  assert(!content.includes('retry') && !content.includes('attempts'), "29. não existe retry automático");
  // 30
  assert(!content.includes('for (') && !content.includes('while ('), "30. não existe loop de tentativa");
  
  const fetchContextCount = (content.match(/\/api\/user\/organization-context/g) || []).length;
  // 31
  assert(fetchContextCount === 2, "31. apenas um fetch do contexto canônico ocorre por processamento (total de 2 ocorrências no arquivo mantido)");
  
  // 32
  assert(content.includes('/api/user/organization-context'), "32. nenhum endpoint foi alterado");
  // 33
  assert(!content.includes('systemRole: "admin"') && !content.includes("systemRole: 'admin'"), "33. nenhum papel global foi adicionado");

  // Dynamically create regex for the unconditional asserts so they don't trigger the test
  const assertTrueStr = ['assert', '(', 'true'].join('');
  const booleanTrueStr = ['Boolean', '(', 'true', ')'].join('');
  const orTrueStr = ['|', '|', ' true'].join('');
  const andTrueStr = ['&', '&', ' true'].join('');

  // 36
  const useEffectBlock = content.substring(content.indexOf('useEffect(() => {'), content.indexOf('return unsubscribe;') !== -1 ? content.indexOf('return unsubscribe;') : content.indexOf('  }, []);'));
  assert(useEffectBlock.includes('let canonicalContextController'), "36. canonicalContextController é declarado no escopo do useEffect");

  // 37
  const fetchBlock = content.substring(content.indexOf('const controller = new AbortController()') - 100, content.indexOf('const controller = new AbortController()'));
  assert(fetchBlock.includes('canonicalContextController?.abort()'), "37. o controller anterior é abortado antes de nova requisição");

  // 38
  const authStateBlock = content.substring(content.indexOf('onAuthStateChanged(auth, async (currentUser) => {'), content.indexOf('setUser(currentUser)'));
  assert(authStateBlock.includes('canonicalContextController?.abort()'), "38. o callback de onAuthStateChanged aborta requisição anterior");

  // 39
  const cleanupBlock = content.substring(content.indexOf('return () => {'), content.indexOf('  }, []);'));
  assert(cleanupBlock.includes('canonicalContextController?.abort()'), "39. o cleanup aborta canonicalContextController");

  // 40
  assert(cleanupBlock.includes('canonicalContextController = null'), "40. o cleanup define canonicalContextController como null");

  // 41
  const finallyBlock = content.substring(content.indexOf('finally {'), content.indexOf('} catch (ctxErr)'));
  assert(finallyBlock.includes('clearTimeout'), "41. o finally preserva clearTimeout");

  // 42
  assert(finallyBlock.includes('canonicalContextController === controller') && finallyBlock.includes('canonicalContextController = null'), "42. o finally limpa o controller somente quando corresponde ao controller atual");

  // 43
  assert(content.includes('typeof canonicalCtx === \'object\'') || content.includes('typeof canonicalCtx === "object"'), "43. canonicalCtx é validado como objeto");

  // 44
  assert(content.includes('canonicalCtx !== null'), "44. canonicalCtx null é rejeitado");

  // 45
  assert(content.includes('!Array.isArray(canonicalCtx)'), "45. arrays são rejeitados com Array.isArray");

  // 46
  assert(content.includes('canonicalCtx.activeOrganizationId === undefined') && content.includes('canonicalCtx.activeOrganizationId === null') && content.includes('typeof canonicalCtx.activeOrganizationId === \'string\''), "46. activeOrganizationId aceita somente undefined, null ou string");

  // 47
  assert(content.includes('canonicalCtx.primaryOrganizationId === undefined') && content.includes('canonicalCtx.primaryOrganizationId === null') && content.includes('typeof canonicalCtx.primaryOrganizationId === \'string\''), "47. primaryOrganizationId aceita somente undefined, null ou string");

  // 48
  const validationIfBlock = content.substring(content.indexOf('if (isCanonicalContextValid) {'), content.indexOf('} else {', content.indexOf('if (isCanonicalContextValid) {')) + 200);
  assert(validationIfBlock.includes('setCanonicalContext(null)'), "48. resposta inválida define canonicalContext como null");

  // 49
  assert(!validationIfBlock.includes('userData =') && !validationIfBlock.substring(validationIfBlock.indexOf('else {')).includes('userData'), "49. resposta inválida não atualiza userData");

  // 50
  assert(validationIfBlock.includes('setCanonicalContext(canonicalCtx)'), "50. resposta validada pode atualizar canonicalContext");

  // 51
  const warnBlock = validationIfBlock.substring(validationIfBlock.indexOf('else {'));
  assert(warnBlock.includes('console.warn') && !warnBlock.includes('canonicalCtx'), "51. nenhum conteúdo da resposta inválida é enviado ao console");

  // 52
  assert(!content.includes('retry') && !content.includes('attempts'), "52. nenhum retry foi adicionado");

  // 53
  assert(!content.includes('setInterval('), "53. nenhum setInterval foi adicionado");

  // No external files written check
  const testSourcePath = path.join(process.cwd(), 'scripts/test_mn_perf_rc2_auth_context.ts');
  const testSource = fs.readFileSync(testSourcePath, 'utf8');

  const lines = testSource.split('\n');
  const hasAssertTrue = lines.some(line => line.includes(assertTrueStr) && !line.includes('assertTrueStr'));
  const hasBooleanTrue = lines.some(line => line.includes(booleanTrueStr) && !line.includes('booleanTrueStr'));
  const hasOrTrue = lines.some(line => line.includes(orTrueStr) && !line.includes('orTrueStr'));
  const hasAndTrue = lines.some(line => line.includes(andTrueStr) && !line.includes('andTrueStr'));

  assert(!hasAssertTrue && !hasBooleanTrue && !hasOrTrue && !hasAndTrue, `54. nenhum assert incondicional existe`);

  const forbiddenWriteApis = [
    ['write', 'File', 'Sync'].join(''),
    ['write', 'File'].join(''),
    ['append', 'File', 'Sync'].join(''),
    ['append', 'File'].join(''),
    ['create', 'Write', 'Stream'].join('')
  ];

  assert(
    forbiddenWriteApis.every(api => !testSource.includes(`fs.${api}(`)),
    '55. nenhum arquivo é escrito pelo teste (anterior)'
  );

  // 56
  assert(useEffectBlock.includes('let authEventSequence = 0'), "56. authEventSequence existe no escopo do useEffect");

  // 57
  assert(authStateBlock.includes('const eventSequence = ++authEventSequence') || authStateBlock.includes('const eventSequence = authEventSequence + 1') || authStateBlock.includes('authEventSequence += 1'), "57. eventSequence incrementa authEventSequence");

  // 58
  const isCurrentFnBlock = authStateBlock.substring(authStateBlock.indexOf('isCurrentAuthEvent'));
  assert(isCurrentFnBlock.includes('active'), "58. isCurrentAuthEvent verifica active");

  // 59
  assert(isCurrentFnBlock.includes('eventSequence === authEventSequence'), "59. isCurrentAuthEvent compara eventSequence com authEventSequence");

  // 60
  const afterGetDoc = content.substring(content.indexOf('const userSnap = await withTimeout(getDoc(userRef)'), content.indexOf('if (userSnap.exists())'));
  assert(afterGetDoc.includes('if (!isCurrentAuthEvent()) return'), "60. existe verificação após getDoc(userRef)");

  // 61
  const afterIdToken = content.substring(content.indexOf('const idToken = await currentUser.getIdToken();'), content.indexOf('const controller = new AbortController();'));
  assert(afterIdToken.includes('if (!isCurrentAuthEvent()) return'), "61. existe verificação imediatamente após getIdToken normal");

  // 62
  assert(afterIdToken.indexOf('if (!isCurrentAuthEvent()) return') < afterIdToken.indexOf('canonicalContextController?.abort()'), "62. essa verificação aparece antes do abort usado para criar nova requisição");

  // 63
  const afterFetchCtx = content.substring(content.indexOf('const res = await fetch(\'/api/user/organization-context\''), content.indexOf('if (res.ok) {'));
  assert(afterFetchCtx.includes('if (!isCurrentAuthEvent()) return'), "63. existe verificação após fetch do contexto canônico");

  // 64
  const afterResJson = content.substring(content.indexOf('const canonicalCtx = await res.json();'), content.indexOf('const isCanonicalContextValid'));
  assert(afterResJson.includes('if (!isCurrentAuthEvent()) return'), "64. existe verificação após res.json()");

  // 65
  const catchCtxBlock = content.substring(content.indexOf('} catch (ctxErr) {'), content.indexOf('if (!isCurrentAuthEvent()) return;', content.indexOf('} catch (ctxErr) {')));
  assert(catchCtxBlock.includes('if (isCurrentAuthEvent()) setCanonicalContext(null)'), "65. catch do contexto verifica isCurrentAuthEvent antes de setCanonicalContext(null)");

  // 66
  assert(!content.includes('if (active) setProfile') && content.includes('if (isCurrentAuthEvent()) setProfile'), "66. perfil só é atualizado pelo evento atual");

  // 67
  assert(content.includes("if (isCurrentAuthEvent()) {\n          setProfile(null);\n          localStorage.removeItem('mn_user_profile');"), "67. localStorage só é atualizado pelo evento atual");

  // 68
  const analyticsBlocks = authStateBlock.split('analytics.track(').slice(1);
  const analyticsProtected = analyticsBlocks.every(block => {
      // Check if it's wrapped in `isCurrentAuthEvent()`
      const prev = authStateBlock.substring(0, authStateBlock.lastIndexOf(block));
      return prev.includes('if (isCurrentAuthEvent()) {');
  });
  assert(analyticsProtected, "68. analytics só é executado pelo evento atual");

  // 69
  const afterIdTokenTrue = content.substring(content.indexOf('getIdToken(true)'), content.indexOf('fetch(\'/api/v1/onboarding/bootstrap\''));
  assert(afterIdTokenTrue.includes('if (!isCurrentAuthEvent()) return'), "69. bootstrap valida o evento depois de getIdToken(true)");

  // 70
  const afterBootFetch = content.substring(content.indexOf('fetch(\'/api/v1/onboarding/bootstrap\''), content.indexOf('if (bootRes.ok)'));
  assert(afterBootFetch.includes('if (!isCurrentAuthEvent()) return'), "70. bootstrap valida o evento depois do fetch");

  // 71
  const afterNewUserDoc = content.substring(content.indexOf('const newUserSnap = await getDoc(userRef);', content.indexOf('bootRes.ok')), content.indexOf('if (newUserSnap.exists())'));
  assert(afterNewUserDoc.includes('if (!isCurrentAuthEvent()) return'), "71. novo perfil valida o evento depois de getDoc");

  // 72
  const loadingBlock = content.substring(content.lastIndexOf('setLoading(false)') - 50, content.lastIndexOf('setLoading(false)'));
  assert(loadingBlock.includes('if (isCurrentAuthEvent())'), "72. loading usa isCurrentAuthEvent");

  // 73
  assert(!loadingBlock.includes('if (active)'), "73. evento antigo não executa setLoading(false)");

  // 74
  assert(cleanupBlock.includes('authEventSequence += 1'), "74. cleanup incrementa authEventSequence");

  // 75
  assert(cleanupBlock.includes('canonicalContextController?.abort()'), "75. cleanup continua abortando controller");

  // 76
  assert(!content.includes('retry') && !content.includes('attempts'), "76. nenhum retry foi adicionado");

  // 77
  assert(!content.includes('setInterval('), "77. nenhum setInterval foi adicionado");

  // 78
  assert(!hasAssertTrue && !hasBooleanTrue && !hasOrTrue && !hasAndTrue, `78. nenhum assert incondicional existe`);

  // 79
  assert(
    forbiddenWriteApis.every(api => !testSource.includes(`fs.${api}(`)),
    '79. nenhum arquivo é escrito pelo teste'
  );

  console.log(`\nTests completed: ${passed} passed, ${failed} failed.`);
  
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
