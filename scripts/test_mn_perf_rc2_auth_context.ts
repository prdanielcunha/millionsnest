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
    '55. nenhum arquivo é escrito pelo teste'
  );


  console.log(`\nTests completed: ${passed} passed, ${failed} failed.`);
  
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
