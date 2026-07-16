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

  if (hasErrors) {
    console.error("Test Failed:\n", errors.join('\n'));
    process.exit(1);
  }

  console.log("All static tests passed for UX-FOUNDATION-1B.2");
}

runTests();
