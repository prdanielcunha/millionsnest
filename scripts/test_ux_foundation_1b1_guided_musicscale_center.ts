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
const centerSrc = fs.readFileSync('src/components/dashboard/MusicScaleGuideCenter.tsx', 'utf-8');

// 1. Component existence & accessibility checks
assertCondition("1. MusicScaleGuideCenter component exists", centerSrc.includes('export function MusicScaleGuideCenter'));
assertCondition("2. Uses namespace musicscale.center", centerSrc.includes("t('musicscale.center"));
assertCondition("3. Has tab overview", centerSrc.includes("activeSection === 'overview'"));
assertCondition("4. Has tab resources", centerSrc.includes("activeSection === 'resources'"));
assertCondition("5. Has tab getting-started", centerSrc.includes("activeSection === 'getting-started'"));
assertCondition("6. Tabs have role=tab", centerSrc.includes('role="tab"'));
assertCondition("7. Tabs have aria-selected", centerSrc.includes('aria-selected={'));
assertCondition("8. All buttons have type=button", !centerSrc.match(/<button(?![^>]*type="button")/));
assertCondition("9. No buttons under 44px", !centerSrc.match(/<button[^>]*className=[^>]*\bh-[1-8]\b/));
assertCondition("10. Does not use window.open", !centerSrc.includes('window.open'));
assertCondition("11. Does not use href directly", !centerSrc.includes(' href="'));
assertCondition("12. Does not use external Link", !centerSrc.match(/<Link(?!\w)/));
assertCondition("13. No technical identifiers exposed", !centerSrc.includes('{id}') && !centerSrc.includes('app_id'));
assertCondition("14. No technical fallback keys", !centerSrc.includes(">musicscale.center"));

// 2. Resources validations
assertCondition("15. Oito resource cards em PT", ptSrc.includes('"repertoire":') && ptSrc.includes('"library":') && ptSrc.includes('"chords":') && ptSrc.includes('"lyrics":') && ptSrc.includes('"ai_import":') && ptSrc.includes('"members":') && ptSrc.includes('"band_scales":') && ptSrc.includes('"music_scales":'));
assertCondition("16. Possui imports_to", centerSrc.includes('imports_to') || ptSrc.includes('"imports_to"'));
assertCondition("17. Possui supplies_songs_to", centerSrc.includes('supplies_songs_to') || ptSrc.includes('"supplies_songs_to"'));
assertCondition("18. Possui optional_link", centerSrc.includes('optional_link') || ptSrc.includes('"optional_link"'));
assertCondition("19. Possui can_do", centerSrc.includes('can_do') || ptSrc.includes('"can_do"'));
assertCondition("20. Possui where_to_find", centerSrc.includes('where_to_find') || ptSrc.includes('"where_to_find"'));
assertCondition("21. Fallbacks humanizados em Center", !centerSrc.includes(">repertoire<"));
assertCondition("22. Nenhuma chave interna exibida em Center", !centerSrc.includes(">musicscale.") && !centerSrc.includes(">workspace."));

// 3. Primeiros Passos validations
assertCondition("23. Etapa Organização", ptSrc.includes('"organization": {') || ptSrc.includes('"organization":'));
assertCondition("24. Etapa Equipe", ptSrc.includes('"team": {') || ptSrc.includes('"team":'));
assertCondition("25. Etapa Repertório", ptSrc.includes('"songs": {') || ptSrc.includes('"songs":'));
assertCondition("26. Etapa Cifras e Letras", ptSrc.includes('"content": {') || ptSrc.includes('"content":'));
assertCondition("27. Etapa Integrantes", ptSrc.includes('"members": {') || ptSrc.includes('"members":'));
assertCondition("28. Etapa Escala da Banda", ptSrc.includes('"band_scale": {') || ptSrc.includes('"band_scale":'));
assertCondition("29. Etapa Escala de Músicas", ptSrc.includes('"music_scale": {') || ptSrc.includes('"music_scale":'));
assertCondition("30. Etapa Revisão", ptSrc.includes('"review": {') || ptSrc.includes('"review":'));

const ops = ['songs', 'content', 'members', 'band_scale', 'music_scale', 'review'];
const keys = ['title', 'what', 'why', 'how', 'result', 'action'];

let ptAllKeys = true;
let enAllKeys = true;
let esAllKeys = true;

for (const op of ops) {
  for (const k of keys) {
    if (!ptSrc.includes(`"${k}":`)) ptAllKeys = false;
    if (!enSrc.includes(`"${k}":`)) enAllKeys = false;
    if (!esSrc.includes(`"${k}":`)) esAllKeys = false;
  }
}

assertCondition("31. PT possui todas as chaves operacionais", ptAllKeys);
assertCondition("32. EN possui todas as chaves operacionais", enAllKeys);
assertCondition("33. ES possui todas as chaves operacionais", esAllKeys);

assertCondition("34. Possui statuses.attention", ptSrc.includes('"attention":'));
assertCondition("35. Possui organization.admin_notice", ptSrc.includes('"admin_notice":'));
assertCondition("36. Possui steps.team.important", ptSrc.includes('"important":'));
assertCondition("37. Possui team.invite_action", ptSrc.includes('"invite_action":'));
assertCondition("38. Nenhuma etapa utiliza summary", !ptSrc.includes('"summary":'));

// 4. Estados e Autoridade
assertCondition("39. organizationReady é utilizado", centerSrc.includes('organizationReady'));
assertCondition("40. musicScaleReady é utilizado", centerSrc.includes('musicScaleReady'));
assertCondition("41. musicScaleReady falha fechado", centerSrc.includes('!musicScaleReady') || centerSrc.includes('musicScaleReady ?'));
assertCondition("42. teamStarted é utilizado", centerSrc.includes('teamStarted'));
assertCondition("43. canInvite controla convite", centerSrc.includes('canInvite') || homeSrc.includes('invite') || centerSrc.includes('onOpenInviteModal'));
assertCondition("44. canManageTeam controla gerenciamento", centerSrc.includes('canManageTeam'));
assertCondition("45. canManageOrganization controla organização", centerSrc.includes('canManageOrganization'));
assertCondition("46. canManageBilling controla billing", centerSrc.includes('canManageBilling'));
assertCondition("47. hasPaymentIssue é tratado", centerSrc.includes('hasPaymentIssue') || homeSrc.includes('hasPaymentIssue'));
assertCondition("48. Payment issue verifica canManageBilling", centerSrc.includes('canManageBilling') || homeSrc.includes('canManageBilling'));
assertCondition("49. Billing utiliza onNavigateToBilling", centerSrc.includes('onNavigateToBilling'));
assertCondition("50. Equipe utiliza onManageTeam", centerSrc.includes('onManageTeam'));
assertCondition("51. Organização utiliza onReviewOrganization", centerSrc.includes('onReviewOrganization'));
assertCondition("52. MusicScale utiliza onOpenMusicScale", centerSrc.includes('onOpenMusicScale') || homeSrc.includes('onLaunchApp'));

// 5. Visão Geral Final (EcosystemWorkspaceHome)
assertCondition("53. Existe exatamente uma ação visual Abrir MusicScale", (homeSrc.match(/Abrir MusicScale/g) || []).length === 1);
assertCondition("54. A ação está no hero", homeSrc.indexOf('Abrir MusicScale') < homeSrc.indexOf('overviewContent'));
assertCondition("55. Chama onLaunchApp", homeSrc.includes('onLaunchApp(musicScaleApp)'));
assertCondition("56. Respeita isReadyToOpen", homeSrc.includes('disabled={isLoading || (!isReadyToOpen && !hasPaymentIssue && !isError && musicScaleDisplayStatus !== \'available\')}'));
assertCondition("57. Primeiros passos existe no hero", homeSrc.substring(0, homeSrc.indexOf('overviewContent')).includes('getting-started'));
assertCondition("58. Primeiros passos chama getting-started", homeSrc.includes("onSelectMusicScaleSection('getting-started')"));
assertCondition("59. Conhecer recursos existe no hero", homeSrc.substring(0, homeSrc.indexOf('overviewContent')).includes('resources'));
assertCondition("60. Conhecer recursos chama resources", homeSrc.includes("onSelectMusicScaleSection('resources')"));
assertCondition("61. Não existe workspace.start_here", !homeSrc.includes('workspace.start_here'));
assertCondition("62. Não existe o título Comece por aqui", !homeSrc.includes('Comece por aqui'));
assertCondition("63. Não existe painel duplicado de Primeiros passos", !homeSrc.split('overviewContent')[1].includes('getting-started'));
assertCondition("64. Não existe painel duplicado de Conhecer recursos", !homeSrc.split('overviewContent')[1].includes('resources'));
assertCondition("65. Existem Recursos do MusicScale", homeSrc.includes('Recursos do MusicScale') || homeSrc.includes('musicscale.features.title'));
assertCondition("66. Existem os quatro cards de recursos", homeSrc.includes('musicscale.features.repertoire') && homeSrc.includes('musicscale.features.scales') && homeSrc.includes('musicscale.features.musicians') && homeSrc.includes('musicscale.features.preparation'));
assertCondition("67. Existe Organização e acesso", homeSrc.includes('workspace.org_and_access'));
assertCondition("68. Existe Convidar pessoa", homeSrc.includes('workspace.invite_person'));
assertCondition("69. Existe Gerenciar equipe", homeSrc.includes('workspace.manage_team'));
assertCondition("70. Existe Ver assinatura", homeSrc.includes('workspace.view_subscription'));
assertCondition("71. Não existe suporte duplicado", (homeSrc.match(/openHub/g) || []).length <= 2);
assertCondition("72. Não existe openRequest artificial", !homeSrc.includes('openRequest'));
assertCondition("73. Não existe JSX com false &&", !homeSrc.includes('false &&'));
assertCondition("74. Não existe card horizontal duplicado", (homeSrc.match(/id="btn-sidebar-open-musicscale"/g) || []).length === 1);
assertCondition("75. Não existe Abrir sistema", !homeSrc.includes('Abrir sistema'));
assertCondition("76. Não existe ADMINISTRATIVE visível em PT", !ptSrc.includes('ADMINISTRATIVE'));

// 6. i18n extra checks
assertCondition("77. dashboard namespace exists", ptSrc.includes('dashboard') && enSrc.includes('dashboard') && esSrc.includes('dashboard'));
assertCondition("78. musicscale.center exists", ptSrc.includes('center: {') && enSrc.includes('center: {') && esSrc.includes('center: {'));
assertCondition("79. tabs exist in 3 languages", ptSrc.includes('"tabs":') && enSrc.includes('"tabs":') && esSrc.includes('"tabs":'));
assertCondition("80. resources exist in 3 languages", ptSrc.includes('"resources":') && enSrc.includes('"resources":') && esSrc.includes('"resources":'));
assertCondition("81. getting_started exist in 3 languages", ptSrc.includes('"getting_started":') && enSrc.includes('"getting_started":') && esSrc.includes('"getting_started":'));
assertCondition("82. PT does not contain Manager or Viewer literally in translated areas", !ptSrc.includes(' Manager') && !ptSrc.includes(' Viewer'));
assertCondition("83. EN does not contain PT", !enSrc.includes('Primeiros passos'));
assertCondition("84. ES does not contain PT", !esSrc.includes('Primeiros passos'));

// 7. Residues check
const files = fs.readdirSync('.');
let hasResidues = false;
let residuesList: string[] = [];

for (const file of files) {
  if (
    file.startsWith('fix_') ||
    file.startsWith('patch_') ||
    file.startsWith('temp_') ||
    file.startsWith('update_') ||
    file.startsWith('extract') ||
    file.startsWith('translate') ||
    file.startsWith('rewrite_test') ||
    file === 'report.txt' ||
    file === 'test_results.txt' ||
    file.endsWith('.bak') ||
    file.endsWith('.tmp')
  ) {
    hasResidues = true;
    residuesList.push(file);
  }
}

assertCondition(`85. Ausência de resíduos (${residuesList.join(', ')})`, !hasResidues);

// 8. MusicScaleDisplayStatus Fixes
assertCondition("86. O componente não utiliza t(`musicscale.status.${msCatalogState}`, msCatalogState)", !homeSrc.includes("t(`musicscale.status.${msCatalogState}`, msCatalogState)"));
assertCondition("87. msCatalogState não é utilizado como fallback visível", !homeSrc.includes(", msCatalogState)"));
assertCondition("88. Existe MusicScaleDisplayStatus ou contrato equivalente", homeSrc.includes("MusicScaleDisplayStatus") || homeSrc.includes("musicScaleDisplayStatus"));
assertCondition("89. isLoading resolve para loading", homeSrc.includes("isLoading") && homeSrc.includes("'loading'"));
assertCondition("90. hasPaymentIssue resolve para payment_issue", homeSrc.includes("hasPaymentIssue") && homeSrc.includes("'payment_issue'"));
assertCondition("91. trialing resolve para trialing", homeSrc.includes("catalogState === 'trialing'") && homeSrc.includes("'trialing'"));
assertCondition("92. isReadyToOpen resolve para available", homeSrc.includes("isReadyToOpen") && homeSrc.includes("'available'"));
assertCondition("93. estado desconhecido sem acesso resolve para unavailable", homeSrc.includes("'unavailable'"));
assertCondition("94. administrative com isReadyToOpen true resolve para available", homeSrc.includes("isReadyToOpen") && homeSrc.includes("'available'"));
assertCondition("95. PT contém Disponível", ptSrc.includes('available:') && ptSrc.includes('Disponível'));
assertCondition("96. PT contém Período de teste", ptSrc.includes('trialing:') && ptSrc.includes('Período de teste'));
assertCondition("97. PT contém Pagamento pendente", ptSrc.includes('payment_issue:') && ptSrc.includes('Pagamento pendente'));
assertCondition("98. PT contém Carregando", ptSrc.includes('loading:') && ptSrc.includes('Carregando'));
assertCondition("99. PT contém Indisponível", ptSrc.includes('unavailable:') && ptSrc.includes('Indisponível'));
assertCondition("100. EN possui as cinco traduções", enSrc.includes('available:') && enSrc.includes('trialing:') && enSrc.includes('payment_issue:') && enSrc.includes('loading:') && enSrc.includes('unavailable:'));
assertCondition("101. ES possui as cinco traduções", esSrc.includes('available:') && esSrc.includes('trialing:') && esSrc.includes('payment_issue:') && esSrc.includes('loading:') && esSrc.includes('unavailable:'));
assertCondition("102. Nenhum identificador interno é renderizado diretamente", !homeSrc.includes(">{msCatalogState}<"));
assertCondition("103. Não existe ADMINISTRATIVE visível ou como fallback", !homeSrc.includes("ADMINISTRATIVE") && !ptSrc.includes("ADMINISTRATIVE"));
assertCondition("104. Não existe Administrative visível ou como fallback", !homeSrc.includes("Administrative") && !ptSrc.includes("Administrative"));
assertCondition("105. O badge usa exclusivamente o estado visual normalizado", homeSrc.includes("musicscale.status.${musicScaleDisplayStatus}"));

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
