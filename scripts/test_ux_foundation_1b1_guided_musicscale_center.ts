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
  if (!compContent.includes('dashboard.musicscale.center.')) logError('Component does not use new i18n keys');

  // Verify visual map
  if (!compContent.includes("dashboard.musicscale.center.resources.flow.imports_to")) logError('Map missing imports_to');
  if (!compContent.includes("dashboard.musicscale.center.resources.flow.supplies_songs_to")) logError('Map missing supplies_songs_to');
  if (!compContent.includes("dashboard.musicscale.center.resources.flow.optional_link")) logError('Map missing optional_link');

  // Validate the 8 steps exist via keys
  const stepsKeys = [
    'dashboard.musicscale.center.getting_started.steps.organization.title',
    'dashboard.musicscale.center.getting_started.steps.team.title',
    'dashboard.musicscale.center.getting_started.steps.songs.title',
    'dashboard.musicscale.center.getting_started.steps.content.title',
    'dashboard.musicscale.center.getting_started.steps.members.title',
    'dashboard.musicscale.center.getting_started.steps.band_scale.title',
    'dashboard.musicscale.center.getting_started.steps.music_scale.title',
    'dashboard.musicscale.center.getting_started.steps.review.title'
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

  if (hasErrors) {
    console.error("Test Failed:\n", errors.join('\n'));
    process.exit(1);
  }

  console.log("All static tests passed for UX-FOUNDATION-1B.2");
}

runTests();
