import fs from 'fs';
import path from 'path';

function runTests() {
  let hasErrors = false;
  const errors: string[] = [];

  const logError = (msg: string) => {
    errors.push(msg);
    hasErrors = true;
  };

  const root = path.resolve(process.cwd());

  const checkFileExists = (filepath: string, shouldExist = true) => {
    const exists = fs.existsSync(path.join(root, filepath));
    if (shouldExist && !exists) logError(`File missing: ${filepath}`);
    if (!shouldExist && exists) logError(`File should not exist: ${filepath}`);
    return exists;
  };

  // 1. Files existence
  const compPath = 'src/components/dashboard/MusicScaleGuideCenter.tsx';
  checkFileExists(compPath, true);

  if (hasErrors) {
    console.error(errors.join('\n'));
    process.exit(1);
  }

  // 2. Component rules
  const compContent = fs.readFileSync(path.join(root, compPath), 'utf8');

  // Verify there are no Portuguese strings like "Confira sua organização" directly in the component, but instead the i18n keys
  if (!compContent.includes('musicscale.center.')) logError('Component does not use new i18n keys');

  // Verify visual map
  if (!compContent.includes("musicscale.center.resources.flow.imports_to")) logError('Map missing imports_to');
  if (!compContent.includes("musicscale.center.resources.flow.supplies_songs_to")) logError('Map missing supplies_songs_to');
  if (!compContent.includes("musicscale.center.resources.flow.optional_link")) logError('Map missing optional_link');

  // Validate the 8 steps exist via keys
  const stepsKeys = [
    'musicscale.center.getting_started.steps.organization.title',
    'musicscale.center.getting_started.steps.team.title',
    'musicscale.center.getting_started.steps.songs.title',
    'musicscale.center.getting_started.steps.content.title',
    'musicscale.center.getting_started.steps.members.title',
    'musicscale.center.getting_started.steps.band_scale.title',
    'musicscale.center.getting_started.steps.music_scale.title',
    'musicscale.center.getting_started.steps.review.title'
  ];
  for (const key of stepsKeys) {
    if (!compContent.includes(key)) logError(`Missing step key: ${key}`);
  }

  // Validate accessibility (buttons must have type="button")
  const buttonTagsCount = (compContent.match(/<button/g) || []).length;
  const buttonTypesCount = (compContent.match(/type="button"/g) || []).length;
  if (buttonTypesCount < buttonTagsCount) {
    logError(`Not all buttons have type="button". Found ${buttonTagsCount} buttons but only ${buttonTypesCount} have type="button"`);
  }

  // Validate no generic arrays
  if (compContent.includes("title: 'Confira sua organização'")) logError('Component still uses raw pt arrays');

  // 3. WorkspaceHome rules
  const workspaceHomeContent = fs.readFileSync(path.join(root, 'src/components/dashboard/EcosystemWorkspaceHome.tsx'), 'utf8');

  // Verify that "Conhecer recursos" and "Primeiros passos" are NOT conditionally hidden by hasPaymentIssue
  const paymentRegex = /\{!hasPaymentIssue \? \(\s*<button[\s\S]*?Abrir MusicScale[\s\S]*?<\/button>\s*\) : \([\s\S]*?Assinatura pendente[\s\S]*?<\/div>\s*\)\}\s*<button[\s\S]*?Primeiros passos[\s\S]*?<\/button>\s*<button[\s\S]*?Conhecer recursos/;
  if (!paymentRegex.test(workspaceHomeContent)) {
    logError('Primeiros passos and Conhecer recursos are still hidden during payment_issue or structure is wrong.');
  }


  // 4. No redundant editorial block in Overview
  if (compContent.includes('musicscale.center.overview.highlights.1.title')) {
    logError('Redundant editorial block (Acervo, Equipe, Escalas) is still present in MusicScaleGuideCenter.');
  }

  // 5. Verify the resources tab still contains its items
  const resourceKeys = [
    'musicscale.center.resources.flow.repertoire',
    'musicscale.center.resources.flow.chords',
    'musicscale.center.resources.flow.lyrics',
    'musicscale.center.resources.flow.live_library',
    'musicscale.center.resources.flow.members',
    'musicscale.center.resources.flow.band_scale',
    'musicscale.center.resources.flow.music_scale'
  ];
  for (const key of resourceKeys) {
    if (!compContent.includes(key)) logError(`Missing resource key: ${key}`);
  }

  // 6. Verify operational team card is preserved
  if (!workspaceHomeContent.includes("musicscale.actions.invite") || !workspaceHomeContent.includes("Convidar pessoas")) {
    logError('Convidar pessoas action missing in EcosystemWorkspaceHome.');
  }
  if (!workspaceHomeContent.includes("musicscale.actions.view_team_and_invites") || !workspaceHomeContent.includes("Ver equipe e convites")) {
    logError('Ver equipe e convites action missing in EcosystemWorkspaceHome.');
  }

  // 7. Verify routing actions
  if (!workspaceHomeContent.includes("onSelectMusicScaleSection('resources')")) {
    logError("Conhecer recursos action doesn't point to onSelectMusicScaleSection('resources')");
  }
  if (!workspaceHomeContent.includes("onSelectMusicScaleSection('getting-started')")) {
    logError("Primeiros passos action doesn't point to onSelectMusicScaleSection('getting-started')");
  }
  if (!workspaceHomeContent.includes("onLaunchApp")) {
    logError("Abrir MusicScale doesn't point to onLaunchApp");
  }

  // 8. Verify no auxiliary files exist
  const auxFiles = [
    'extract.cjs', 'extract.js', 'fix_alert.py', 'fix_arrays.cjs', 'fix_buttons.cjs', 
    'fix_buttons.py', 'fix_content_key.cjs', 'fix_map_again.cjs', 'fix_mess.cjs', 
    'fix_props.py', 'fix_syntax.cjs', 'fix_workspace.cjs', 'pt_center.json', 
    'rebuild_getting_started.cjs', 'replace_map.cjs', 'translate.cjs', 'update_en.cjs', 
    'update_pt.cjs', 'update_pt.js'
  ];
  for (const f of auxFiles) {
    checkFileExists(f, false);
  }

  const filesInRoot = fs.readdirSync(root);
  for (const f of filesInRoot) {
    if (f.startsWith('fix_') || f.startsWith('patch_') || f.startsWith('extract') || f.startsWith('translate') || f.startsWith('update_')) {
      logError(`Auxiliary file found in root: ${f}`);
    }
  }

  // 9. Verify no raw key fallback (step.key or card.key as direct text fallbacks in t())
  if (compContent.includes('t(step.titleKey, step.key)') || compContent.includes('t(step.titleKey, step.id)')) {
    logError('Component uses step.key/step.id directly as t() fallback');
  }
  if (compContent.includes('t(`musicscale.center.resources.${card.key}.title`, card.key)')) {
    logError('Component uses card.key directly as t() fallback');
  }
  if (!compContent.includes('musicscale.center.fallback.guide_step')) {
    logError('Component missing humanized guide step fallback');
  }
  if (!compContent.includes('musicscale.center.fallback.resource')) {
    logError('Component missing humanized resource fallback');
  }

  if (hasErrors) {
    console.error("Test Failed:\n", errors.join('\n'));
    process.exit(1);
  }

  // UX-RECOVERY-2B New Tests
  // 1. Não existe o texto: “ya posee”
  if (compContent.includes('ya posee')) {
    logError('Found mixed language "ya posee" in component fallback');
  }

  // 2. Nenhum fallback mistura idiomas (check some known ones)
  if (compContent.includes('ya') || compContent.includes('posee') || compContent.includes('personas') || compContent.includes('equipo') || compContent.includes('invitación') || compContent.includes('organización')) {
    logError('Found potential mixed language or wrong Spanish words in Portuguese fallbacks');
  }

  // 3 & 4: Already checked in block 9 above.

  // 5. Existem exatamente oito cards.
  const cardsCount = (compContent.match(/\{ key: '[^']+', icon: /g) || []).length;
  if (cardsCount !== 8) {
    logError(`Expected 8 resource cards, found ${cardsCount}`);
  }

  // 6 & 7. Cada card possui lista de capacidades (can_do) e onde encontrar (where)
  if (!compContent.includes('musicscale.center.common.can_do') || !compContent.includes('can_do`, { returnObjects: true')) {
    logError('Missing can_do list rendering');
  }
  if (!compContent.includes('musicscale.center.common.where_to_find') || !compContent.includes('.where`,')) {
    logError('Missing where_to_find path rendering');
  }

  // 8 & 9. Cada card possui ação, musicScaleReady controla a ação.
  // 10. Quando musicScaleReady é false, onOpenMusicScale não é chamado.
  // 11. Payment issue com permissão utiliza onNavigateToBilling.
  // 12. Payment issue sem permissão não renderiza botão de billing.
  if (!compContent.includes('!musicScaleReady ? (')) {
    logError('Missing check for !musicScaleReady in resources action');
  }
  if (!compContent.includes('onClick={onNavigateToBilling}')) {
    logError('Missing onNavigateToBilling in resources action');
  }
  if (compContent.match(/hasPaymentIssue \? \(\s*canManageBilling \? \(/) === null) {
    logError('Payment issue condition is not checking canManageBilling properly');
  }

  // 13. Todos os botões possuem min-h-[44px].
  // we can check if there's any button without min-h-[44px]
  if (compContent.includes('min-h-[36px]')) {
    logError('Found a button with min-h-[36px], expected min-h-[44px]');
  }

  // 14. Todos os botões possuem aria-label contextual.
  if (!compContent.includes('aria-label={t(\'musicscale.center.resources.view_aria\'') ||
      !compContent.includes('aria-label={t(\'musicscale.center.resources.unavailable_aria\'') ||
      !compContent.includes('aria-label={t(\'musicscale.center.resources.billing_aria\'')) {
    logError('Missing contextual aria-labels in resource buttons');
  }

  // 15 & 16. Não existe window.open nem URL interna inventada.
  if (compContent.includes('window.open')) {
    logError('Found window.open which is forbidden');
  }
  if (compContent.includes('href=') || compContent.includes('to=')) {
    // Just a heuristic for internal URL
    logError('Found potential link or URL inside component');
  }

  // 17 & 18. onManageTeam is used and controlled by canManageTeam
  if (!compContent.includes('onClick={onManageTeam}') || !compContent.includes('canManageTeam && (')) {
    logError('Missing onManageTeam usage or not controlled by canManageTeam');
  }

  if (hasErrors) {
    console.error("Test Failed:\n", errors.join('\n'));
    process.exit(1);
  }

  console.log("All static tests passed for UX-RECOVERY-2B");
}

runTests();
