import {
  isValidInvitationOrganizationId,
  isValidInvitationRedirectToken,
  buildInvitationRedirectPath,
  parseInvitationRedirectPath
} from '../src/lib/InvitationRedirectPolicy';
import * as fs from 'fs';
import * as path from 'path';

async function runTests() {
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

  assertCondition('1. organizationId alfanumérico válido', isValidInvitationOrganizationId('org123XYZ'));
  assertCondition('2. organizationId com hífen válido', isValidInvitationOrganizationId('my-org-123'));
  assertCondition('3. organizationId com underscore válido', isValidInvitationOrganizationId('my_org_123'));
  assertCondition('4. organizationId vazio inválido', !isValidInvitationOrganizationId(''));
  assertCondition('5. organizationId com espaços inválido', !isValidInvitationOrganizationId('my org'));
  assertCondition('6. organizationId com barra inválido', !isValidInvitationOrganizationId('my/org'));
  assertCondition('7. organizationId com ponto inválido', !isValidInvitationOrganizationId('my.org'));
  assertCondition('8. organizationId Unicode inválido', !isValidInvitationOrganizationId('myórgação'));
  assertCondition('9. organizationId acima de 128 inválido', !isValidInvitationOrganizationId('a'.repeat(129)));
  assertCondition('10. token mínimo válido', isValidInvitationRedirectToken('a'.repeat(16)));
  assertCondition('11. token com hífen válido', isValidInvitationRedirectToken('a-b-c-d-e-f-g-h-'));
  assertCondition('12. token com underscore válido', isValidInvitationRedirectToken('a_b_c_d_e_f_g_h_'));
  assertCondition('13. token com ponto válido', isValidInvitationRedirectToken('a.b.c.d.e.f.g.h.'));
  assertCondition('14. token com til válido', isValidInvitationRedirectToken('a~b~c~d~e~f~g~h~'));
  assertCondition('15. token abaixo de 16 inválido', !isValidInvitationRedirectToken('a'.repeat(15)));
  assertCondition('16. token com espaço inválido', !isValidInvitationRedirectToken('a '.repeat(10)));
  assertCondition('17. token com quebra de linha inválido', !isValidInvitationRedirectToken('a\nbcdefghijklmnop'));
  assertCondition('18. token com & inválido', !isValidInvitationRedirectToken('abcdefghijklmnop&'));
  assertCondition('19. token com ? inválido', !isValidInvitationRedirectToken('abcdefghijklmnop?'));
  assertCondition('20. token com # inválido', !isValidInvitationRedirectToken('abcdefghijklmnop#'));
  assertCondition('21. token com barra inválido', !isValidInvitationRedirectToken('abcdefghijklmnop/'));
  assertCondition('22. token com contrabarra inválido', !isValidInvitationRedirectToken('abcdefghijklmnop\\'));
  assertCondition('23. token acima de 2048 inválido', !isValidInvitationRedirectToken('a'.repeat(2049)));
  
  const build1 = buildInvitationRedirectPath('org', 'abcdefghijklmnop');
  assertCondition('24. builder produz caminho canônico', build1.valid && build1.data.path === '/join/org?token=abcdefghijklmnop');
  assertCondition('25. builder preserva organizationId', build1.valid && build1.data.organizationId === 'org');
  assertCondition('26. builder preserva token', build1.valid && build1.data.token === 'abcdefghijklmnop');
  assertCondition('27. builder rejeita organizationId inválido', !buildInvitationRedirectPath('o r g', 'abcdefghijklmnop').valid);
  assertCondition('28. builder rejeita token inválido', !buildInvitationRedirectPath('org', 'short').valid);
  
  const parse1 = parseInvitationRedirectPath('/join/org?token=abcdefghijklmnop');
  assertCondition('29. parser aceita caminho canônico', parse1.valid);
  assertCondition('30. parser preserva organizationId', parse1.valid && parse1.data.organizationId === 'org');
  assertCondition('31. parser preserva token', parse1.valid && parse1.data.token === 'abcdefghijklmnop');
  assertCondition('32. parser rejeita valor não string', !parseInvitationRedirectPath(123).valid);
  assertCondition('33. parser rejeita string vazia', !parseInvitationRedirectPath('').valid);
  assertCondition('34. parser rejeita URL absoluta', !parseInvitationRedirectPath('https://millionsnest.com/join/org?token=abcdefghijklmnop').valid);
  assertCondition('35. parser rejeita protocolo', !parseInvitationRedirectPath('http:///join/org?token=abcdefghijklmnop').valid);
  assertCondition('36. parser rejeita domínio', !parseInvitationRedirectPath('millionsnest.com/join/org?token=abcdefghijklmnop').valid);
  assertCondition('37. parser rejeita //join', !parseInvitationRedirectPath('//join/org?token=abcdefghijklmnop').valid);
  assertCondition('38. parser rejeita /join', !parseInvitationRedirectPath('/join').valid);
  assertCondition('39. parser rejeita /join/', !parseInvitationRedirectPath('/join/').valid);
  assertCondition('40. parser rejeita caminho sem token', !parseInvitationRedirectPath('/join/org').valid);
  assertCondition('41. parser rejeita barra final', !parseInvitationRedirectPath('/join/org?token=abcdefghijklmnop/').valid);
  assertCondition('42. parser rejeita prefixo /join-malformado', !parseInvitationRedirectPath('/join-malformado/org?token=abcdefghijklmnop').valid);
  assertCondition('43. parser rejeita token vazio', !parseInvitationRedirectPath('/join/org?token=').valid);
  assertCondition('44. parser rejeita parâmetro diferente de token', !parseInvitationRedirectPath('/join/org?foo=abcdefghijklmnop').valid);
  assertCondition('45. parser rejeita parâmetro extra', !parseInvitationRedirectPath('/join/org?token=abcdefghijklmnop&foo=bar').valid);
  assertCondition('46. parser rejeita token duplicado', !parseInvitationRedirectPath('/join/org?token=abcdefghijklmnop&token=abcdefghijklmnop').valid);
  assertCondition('47. parser rejeita fragmento', !parseInvitationRedirectPath('/join/org?token=abcdefghijklmnop#fragment').valid);
  assertCondition('48. parser rejeita organizationId percent-encoded', !parseInvitationRedirectPath('/join/org%201?token=abcdefghijklmnop').valid);
  assertCondition('49. parser rejeita token percent-encoded não canônico', !parseInvitationRedirectPath('/join/org?token=abc%20defghijklmnop').valid);
  assertCondition('50. parser rejeita traversal', !parseInvitationRedirectPath('/join/../org?token=abcdefghijklmnop').valid);
  assertCondition('51. parser rejeita segmento adicional', !parseInvitationRedirectPath('/join/org/other?token=abcdefghijklmnop').valid);
  assertCondition('52. parser exige igualdade com caminho reconstruído', !parseInvitationRedirectPath('/join/org?token=abcdefghijklmnop&').valid);
  
  const policyContent = fs.readFileSync(path.resolve(process.cwd(), 'src/lib/InvitationRedirectPolicy.ts'), 'utf-8');
  
  assertCondition('53. política não usa any', !policyContent.includes(' any ') && !policyContent.includes(': any'));
  assertCondition('54. política não usa as any', !policyContent.includes('as any'));
  assertCondition('55. política não usa unknown as', !policyContent.includes('unknown as'));
  assertCondition('56. política não usa browser globals', !policyContent.includes('window.') && !policyContent.includes('document.') && !policyContent.includes('navigator.'));
  assertCondition('57. política não usa URL', !policyContent.includes('new URL(') && !policyContent.includes(' URL('));
  assertCondition('58. política não usa URLSearchParams', !policyContent.includes('URLSearchParams'));
  assertCondition('59. política não usa encodeURIComponent', !policyContent.includes('encodeURIComponent'));
  assertCondition('60. política não usa decodeURIComponent', !policyContent.includes('decodeURIComponent'));
  assertCondition('61. política não usa fetch', !policyContent.includes('fetch('));
  assertCondition('62. política não usa Firebase', !policyContent.includes('firebase') && !policyContent.includes('firestore'));
  assertCondition('63. política não usa storage', !policyContent.includes('localStorage') && !policyContent.includes('sessionStorage'));
  assertCondition('64. política não usa Date', !policyContent.includes('Date.now()') && !policyContent.includes('new Date('));
  assertCondition('65. política não contém logs', !policyContent.includes('console.'));
  
  const rootDir = process.cwd();
  const prohibitedFiles = [
    'report.txt',
    'test_results.txt',
    'results.txt',
    'validation-report.txt',
    'validation_report.txt',
    'test-output.txt',
    'test_output.txt',
    'build-output.txt',
    'lint-output.txt'
  ];

  assertCondition('66. arquivo report.txt não existe', !fs.existsSync(path.join(rootDir, 'report.txt')));
  assertCondition('67. nenhum relatório de validação proibido existe na raiz', prohibitedFiles.every(f => !fs.existsSync(path.join(rootDir, f))));

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exitCode = 1;
  }
}

runTests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
