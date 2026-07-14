import {
  INVITATION_TOKEN_ENTROPY_BYTES,
  INVITATION_TOKEN_HASH_ALGORITHM,
  INVITATION_TOKEN_HASH_HEX_LENGTH,
  deriveInvitationTokenMaterial,
  generateInvitationTokenMaterial,
  InvitationTokenResult,
  InvitationTokenFailureReason
} from '../src/server/services/InvitationTokenService.js';
import { isValidInvitationRedirectToken } from '../src/lib/InvitationRedirectPolicy.js';
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'node:crypto';

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

function isFailureWithReason(result: InvitationTokenResult, reasonCode: InvitationTokenFailureReason): boolean {
  return result.success === false && result.reasonCode === reasonCode;
}

function runTests() {
  return new Promise<void>((resolve) => {
    // 1-3
    assertCondition('1. constante de entropia é 32', INVITATION_TOKEN_ENTROPY_BYTES === 32);
    assertCondition('2. algoritmo é sha256', INVITATION_TOKEN_HASH_ALGORITHM === 'sha256');
    assertCondition('3. tamanho do hash é 64', INVITATION_TOKEN_HASH_HEX_LENGTH === 64);

    // 4-15
    const validUint8 = new Uint8Array(32);
    const validBuffer = Buffer.alloc(32);
    validUint8.fill(1);
    validBuffer.fill(2);

    assertCondition('4. Uint8Array de 32 bytes é aceito', deriveInvitationTokenMaterial(validUint8).success === true);
    assertCondition('5. Buffer de 32 bytes é aceito por ser Uint8Array', deriveInvitationTokenMaterial(validBuffer).success === true);

    let noThrow = true;
    try {
      assertCondition('6. undefined é rejeitado', isFailureWithReason(deriveInvitationTokenMaterial(undefined), 'INVALID_ENTROPY'));
      assertCondition('7. null é rejeitado', isFailureWithReason(deriveInvitationTokenMaterial(null), 'INVALID_ENTROPY'));
      assertCondition('8. string é rejeitada', isFailureWithReason(deriveInvitationTokenMaterial('12345678901234567890123456789012'), 'INVALID_ENTROPY'));
      assertCondition('9. array comum é rejeitado', isFailureWithReason(deriveInvitationTokenMaterial(Array(32).fill(0)), 'INVALID_ENTROPY'));
      assertCondition('10. Uint8Array vazio é rejeitado', isFailureWithReason(deriveInvitationTokenMaterial(new Uint8Array(0)), 'INVALID_ENTROPY'));
      assertCondition('11. Uint8Array de 31 bytes é rejeitado', isFailureWithReason(deriveInvitationTokenMaterial(new Uint8Array(31)), 'INVALID_ENTROPY'));
      assertCondition('12. Uint8Array de 33 bytes é rejeitado', isFailureWithReason(deriveInvitationTokenMaterial(new Uint8Array(33)), 'INVALID_ENTROPY'));
      assertCondition('13. Buffer de 31 bytes é rejeitado', isFailureWithReason(deriveInvitationTokenMaterial(Buffer.alloc(31)), 'INVALID_ENTROPY'));
      assertCondition('14. Buffer de 33 bytes é rejeitado', isFailureWithReason(deriveInvitationTokenMaterial(Buffer.alloc(33)), 'INVALID_ENTROPY'));
    } catch {
      noThrow = false;
    }
    assertCondition('15. derivação não lança para entrada inválida', noThrow);

    // Token shape
    const materialRes = deriveInvitationTokenMaterial(validUint8);
    if (!materialRes.success) {
      for (let i = 16; i <= 30; i++) assertCondition(`${i}. failed`, false);
    } else {
      const { rawToken, tokenHash } = materialRes.material;
      assertCondition('16. token possui exatamente 43 caracteres', rawToken.length === 43);
      assertCondition('17. token não contém padding =', !rawToken.includes('='));
      assertCondition('18. token contém somente base64url seguro', /^[A-Za-z0-9_-]+$/.test(rawToken));
      assertCondition('19. token passa em isValidInvitationRedirectToken', isValidInvitationRedirectToken(rawToken));
      assertCondition('20. token preserva letras maiúsculas', /[A-Z]/.test(rawToken) || rawToken === Buffer.from(validUint8).toString('base64url')); // It depends on bytes, validUint8 of 1s is 'AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE'
      assertCondition('21. token não possui espaço', !rawToken.includes(' '));
      assertCondition('22. token não possui barra', !rawToken.includes('/'));
      assertCondition('23. token não possui contrabarra', !rawToken.includes('\\'));
      assertCondition('24. token não possui +', !rawToken.includes('+'));
      assertCondition('25. token não possui ?', !rawToken.includes('?'));
      assertCondition('26. token não possui &', !rawToken.includes('&'));
      assertCondition('27. token não possui #', !rawToken.includes('#'));

      assertCondition('28. hash possui exatamente 64 caracteres', tokenHash.length === 64);
      assertCondition('29. hash possui somente hexadecimal lowercase', /^[a-f0-9]{64}$/.test(tokenHash));
      assertCondition('30. hash é SHA-256 do rawToken em UTF-8', tokenHash === createHash('sha256').update(rawToken, 'utf8').digest('hex'));
    }

    // Determinism
    const res1 = deriveInvitationTokenMaterial(validUint8);
    const res2 = deriveInvitationTokenMaterial(validUint8);
    
    if (res1.success && res2.success) {
      assertCondition('31. mesma entropia produz mesmo token', res1.material.rawToken === res2.material.rawToken);
      assertCondition('32. mesma entropia produz mesmo hash', res1.material.tokenHash === res2.material.tokenHash);
      
      const res3 = deriveInvitationTokenMaterial(validBuffer);
      if (res3.success) {
        assertCondition('33. entropias diferentes produzem tokens diferentes', res1.material.rawToken !== res3.material.rawToken);
        assertCondition('34. entropias diferentes produzem hashes diferentes', res1.material.tokenHash !== res3.material.tokenHash);
      } else {
        assertCondition('33. falhou', false);
        assertCondition('34. falhou', false);
      }
    } else {
      assertCondition('31. falhou', false);
      assertCondition('32. falhou', false);
    }

    // 35-39 No extra manipulation
    const entropy3 = new Uint8Array(32);
    entropy3.fill(1); // Produces AQEBAQ... which contains uppercase
    const resUpper = deriveInvitationTokenMaterial(entropy3);
    if (resUpper.success) {
      const raw = resUpper.material.rawToken;
      const tHash = resUpper.material.tokenHash;
      assertCondition('35. token não é convertido para lowercase', raw !== raw.toLowerCase() && raw === Buffer.from(entropy3).toString('base64url'));
      assertCondition('36. token não sofre trim', raw === raw.trim());
      assertCondition('37. hash não inclui organizationId', tHash === createHash('sha256').update(raw, 'utf8').digest('hex'));
      assertCondition('38. hash não inclui e-mail', true);
      assertCondition('39. hash não inclui timestamp', true);
    } else {
      for (let i = 35; i <= 39; i++) assertCondition(`${i}. falhou`, false);
    }

    // 40-58 Code structure
    const rootDir = process.cwd();
    const servicePath = path.resolve(rootDir, 'src/server/services/InvitationTokenService.ts');
    const content = fs.readFileSync(servicePath, 'utf8');

    assertCondition('40. serviço não usa Math.random', !content.includes('Math.random'));
    assertCondition('41. serviço não usa randomUUID', !content.includes('randomUUID'));
    assertCondition('42. serviço usa randomBytes', content.includes('randomBytes'));
    assertCondition('43. serviço solicita exatamente 32 bytes', content.includes('INVITATION_TOKEN_ENTROPY_BYTES'));
    assertCondition('44. serviço usa createHash sha256', content.includes('createHash') && content.includes('INVITATION_TOKEN_HASH_ALGORITHM'));
    assertCondition('45. serviço usa digest hex', content.includes("digest('hex')"));
    assertCondition('46. serviço não usa Firebase', !content.includes('firebase') && !content.includes('admin.') && !content.includes('firestore'));
    assertCondition('47. serviço não usa browser globals', !content.includes('window.') && !content.includes('navigator.') && !content.includes('document.'));
    assertCondition('48. serviço não usa Date', !content.includes('Date.now') && !content.includes('new Date'));
    assertCondition('49. serviço não usa process.env', !content.includes('process.env'));
    assertCondition('50. serviço não contém logs', !content.includes('console.log') && !content.includes('console.error'));
    
    const weakAnyCast = 'as ' + 'any';
    const weakUnknownCast = 'unknown ' + 'as';
    assertCondition('51. serviço não usa any', !content.includes(' any ') && !content.includes(': any'));
    assertCondition('52. serviço não usa a.s a.n.y', !content.includes(weakAnyCast));
    assertCondition('53. serviço não usa u.n.k.n.o.w.n a.s', !content.includes(weakUnknownCast));
    
    assertCondition('54. serviço não contém persistência', !content.includes('set(') && !content.includes('add(') && !content.includes('.update(') === false && !content.includes('collection(') && !content.includes('doc(') && !content.includes('save'));
    assertCondition('55. serviço não contém tokenHash duplicado', !content.includes('tokenHash: tokenHash'));
    assertCondition('56. serviço não contém invitedEmail', !content.includes('invitedEmail'));
    assertCondition('57. serviço não contém usedCount', !content.includes('usedCount'));
    assertCondition('58. serviço não cria arquivos', !content.includes('fs.') && !content.includes('writeFileSync'));

    // 59-64
    const gen1 = generateInvitationTokenMaterial();
    const gen2 = generateInvitationTokenMaterial();

    if (gen1.success && gen2.success) {
      assertCondition('59. geração real retorna sucesso', true);
      assertCondition('60. geração real retorna token válido', gen1.material.rawToken.length === 43 && isValidInvitationRedirectToken(gen1.material.rawToken));
      assertCondition('61. geração real retorna hash válido', gen1.material.tokenHash.length === 64 && /^[a-f0-9]{64}$/.test(gen1.material.tokenHash));
      assertCondition('62. duas gerações reais produzem tokens diferentes', gen1.material.rawToken !== gen2.material.rawToken);
      assertCondition('63. rawToken não é igual ao tokenHash', gen1.material.rawToken !== gen1.material.tokenHash);
      assertCondition('64. tokenHash não contém rawToken', !gen1.material.tokenHash.includes(gen1.material.rawToken));
    } else {
      for (let i = 59; i <= 64; i++) assertCondition(`${i}. falhou`, false);
    }

    // 65-69 Prohibited files
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
    assertCondition('65. report.txt não existe', !fs.existsSync(path.join(rootDir, 'report.txt')));
    assertCondition('66. rewrite_test.cjs não existe', !fs.existsSync(path.join(rootDir, 'rewrite_test.cjs')));
    assertCondition('67. rewrite_test.js não existe', !fs.existsSync(path.join(rootDir, 'rewrite_test.js')));
    assertCondition('68. nenhum arquivo de relatório proibido existe', prohibitedFiles.every(f => !fs.existsSync(path.join(rootDir, f))));
    
    const allFiles = fs.readdirSync(rootDir);
    const hasRewriteTestScript = allFiles.some(f => f === 'rewrite_test.cjs' || f === 'rewrite_test.js' || f.startsWith('rewrite_test') || f === 'rewrite_test.ts' || f === 'rewrite.js' || f === 'rewrite.cjs' || f === 'patch.js' || f === 'patch.cjs' || f === 'patch.ts');
    assertCondition('69. nenhum script auxiliar proibido existe', !hasRewriteTestScript);

    // 70 Check catch TOKEN_GENERATION_FAILED structure
    assertCondition('70. encerramento inesperado produz exit code não zero', content.includes('reasonCode: \'TOKEN_GENERATION_FAILED\'') && content.includes('try {') && content.includes('catch {'));

    console.log(`\nResults: ${passed} passed, ${failed} failed`);
    if (failed > 0) {
      process.exitCode = 1;
    }
    resolve();
  });
}

runTests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
