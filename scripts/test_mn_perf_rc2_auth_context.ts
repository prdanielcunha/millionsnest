import fs from 'fs';
import path from 'path';

function runTests() {
  console.log("Starting AuthContext performance tests (MN-PERF-RC-2-AUTH-CONTEXT-TIMEOUT)...");
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
  // The original file had 2 occurrences (one in switchOrganization, one in useEffect). We just need to verify we didn't add more.
  assert(fetchContextCount === 2, "31. apenas um fetch do contexto canônico ocorre por processamento (total de 2 ocorrências no arquivo mantido)");
  
  // 32
  assert(content.includes('/api/user/organization-context'), "32. nenhum endpoint foi alterado");
  // 33
  assert(!content.includes('systemRole: "admin"') && !content.includes("systemRole: 'admin'"), "33. nenhum papel global foi adicionado");

  // No external files written check
  const testSourcePath = path.join(process.cwd(), 'scripts/test_mn_perf_rc2_auth_context.ts');
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
    '34. nenhum arquivo é escrito pelo teste'
  );

  // Dynamically create regex for the unconditional asserts so they don't trigger the test
  const assertTrueStr = ['assert', '(', 'true'].join('');
  const booleanTrueStr = ['Boolean', '(', 'true', ')'].join('');
  const orTrueStr = ['|', '|', ' true'].join('');
  const andTrueStr = ['&', '&', ' true'].join('');

  // We have to ignore the very line where we check this in the testSource
  const lines = testSource.split('\n');
  
  const hasAssertTrue = lines.some(line => line.includes(assertTrueStr) && !line.includes('assertTrueStr'));
  const hasBooleanTrue = lines.some(line => line.includes(booleanTrueStr) && !line.includes('booleanTrueStr'));
  const hasOrTrue = lines.some(line => line.includes(orTrueStr) && !line.includes('orTrueStr'));
  const hasAndTrue = lines.some(line => line.includes(andTrueStr) && !line.includes('andTrueStr'));

  assert(!hasAssertTrue && !hasBooleanTrue && !hasOrTrue && !hasAndTrue, `35. não existe assert incondicional`);

  console.log(`\nTests completed: ${passed} passed, ${failed} failed.`);
  
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
