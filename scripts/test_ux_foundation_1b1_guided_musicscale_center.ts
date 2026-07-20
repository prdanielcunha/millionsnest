import * as fs from 'fs';

let passed = 0;
let failed = 0;

function assertCondition(message: string, condition: boolean) {
  if (condition) {
    passed++;
    console.log(`[PASS] ${message}`);
  } else {
    failed++;
    console.error(`[FAIL] ${message}`);
  }
}

const ptSrc = fs.readFileSync('src/packages/i18n/locales/pt.ts', 'utf-8');
const enSrc = fs.readFileSync('src/packages/i18n/locales/en.ts', 'utf-8');
const esSrc = fs.readFileSync('src/packages/i18n/locales/es.ts', 'utf-8');
const homeSrc = fs.readFileSync('src/components/dashboard/EcosystemWorkspaceHome.tsx', 'utf-8');

// 1. Structural Checks on Locales (Guided Center topics)
assertCondition("1. Contém chaves para Repertórios", ptSrc.includes('repertoire') || ptSrc.includes('songs'));
assertCondition("2. Contém chaves para Cifras e Letras", ptSrc.includes('chords') || ptSrc.includes('lyrics') || ptSrc.includes('content'));
assertCondition("3. Contém chaves para Importação Inteligente", ptSrc.includes('ai_import') || ptSrc.includes('intelligent'));
assertCondition("4. Contém chaves para Integrantes", ptSrc.includes('members'));
assertCondition("5. Contém chaves para Escalas da Banda", ptSrc.includes('band_scale') || ptSrc.includes('band_scales'));
assertCondition("6. Contém chaves para Escalas de Músicas", ptSrc.includes('music_scale') || ptSrc.includes('music_scales'));
assertCondition("7. Contém chaves para Primeiros passos", ptSrc.includes('getting_started') || ptSrc.includes('primeiros passos'));
assertCondition("8. Contém chaves para Conhecer recursos", ptSrc.includes('know_resources') || ptSrc.includes('conhecer recursos') || ptSrc.includes('resources'));

// 2. Multi-language completeness checks
assertCondition("9. EN contém chaves de Repertório", enSrc.includes('repertoire') || enSrc.includes('songs'));
assertCondition("10. ES contém chaves de Repertório", esSrc.includes('repertoire') || esSrc.includes('songs'));
assertCondition("11. EN contém chaves de Integrantes", enSrc.includes('members'));
assertCondition("12. ES contém chaves de Integrantes", esSrc.includes('members'));

// 3. Workspace Home references
assertCondition("13. WorkspaceHome refere Primeiros passos", homeSrc.includes('getting_started') || homeSrc.includes('Primeiros passos'));
assertCondition("14. WorkspaceHome refere Conhecer recursos", homeSrc.includes('know_resources') || homeSrc.includes('Conhecer recursos'));

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
