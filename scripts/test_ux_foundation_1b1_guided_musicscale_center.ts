import fs from 'fs';
import path from 'path';
import pt from '../src/packages/i18n/locales/pt.ts';
import en from '../src/packages/i18n/locales/en.ts';
import es from '../src/packages/i18n/locales/es.ts';

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
  if (!workspaceHomeContent.includes("workspace.pending_invites") || !workspaceHomeContent.includes("Convites e Equipe")) {
    logError('Convites e Equipe action missing in EcosystemWorkspaceHome.');
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
    'extract.cjs', 'extract.js', 'fix_alert.py', 'fix_arrays.cjs', 'fix_content_key.cjs', 
    'fix_map_again.cjs', 'fix_mess.cjs', 'fix_props.py', 'fix_syntax.cjs', 'fix_workspace.cjs', 
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

  // UX-RECOVERY-2B Tests
  if (compContent.includes('ya posee')) {
    logError('Found mixed language "ya posee" in component fallback');
  }
  if (compContent.includes('ya') || compContent.includes('posee') || compContent.includes('personas') || compContent.includes('equipo') || compContent.includes('invitación') || compContent.includes('organización')) {
    logError('Found potential mixed language or wrong Spanish words in Portuguese fallbacks');
  }

  // Resource card counts (8 cards)
  const cardsCount = (compContent.match(/\{ key: '[^']+', icon: /g) || []).length;
  if (cardsCount !== 8) {
    logError(`Expected 8 resource cards, found ${cardsCount}`);
  }

  if (!compContent.includes('musicscale.center.common.can_do') || !compContent.includes('can_do`, { returnObjects: true')) {
    logError('Missing can_do list rendering');
  }
  if (!compContent.includes('musicscale.center.common.where_to_find') || !compContent.includes('.where`,')) {
    logError('Missing where_to_find path rendering');
  }

  if (!compContent.includes('!musicScaleReady ? (')) {
    logError('Missing check for !musicScaleReady in resources action');
  }
  if (!compContent.includes('onClick={onNavigateToBilling}')) {
    logError('Missing onNavigateToBilling in resources action');
  }
  if (compContent.match(/hasPaymentIssue \? \(\s*canManageBilling \? \(/) === null) {
    logError('Payment issue condition is not checking canManageBilling properly');
  }

  if (compContent.includes('min-h-[36px]')) {
    logError('Found a button with min-h-[36px], expected min-h-[44px]');
  }

  if (!compContent.includes("aria-label={t('musicscale.center.resources.view_aria'") ||
      !compContent.includes("aria-label={t('musicscale.center.resources.unavailable_aria'") ||
      !compContent.includes("aria-label={t('musicscale.center.resources.billing_aria'")) {
    logError('Missing contextual aria-labels in resource buttons');
  }

  if (compContent.includes('window.open')) {
    logError('Found window.open which is forbidden');
  }
  if (compContent.includes('href=') || compContent.includes('to=')) {
    logError('Found potential link or URL inside component');
  }

  if (!compContent.includes('onClick={onManageTeam}') || !compContent.includes('canManageTeam && (')) {
    logError('Missing onManageTeam usage or not controlled by canManageTeam');
  }


  // ==========================================
  // UX-RECOVERY-2C PROGRAMMATIC LOCALE TESTS
  // ==========================================

  // Resolve dashboard objects for all three languages
  const ptDash = (pt as any).dashboard;
  const enDash = (en as any).dashboard;
  const esDash = (es as any).dashboard;

  if (!ptDash || !enDash || !esDash) {
    logError('Missing dashboard key in locales');
  } else {
    const ptCenter = ptDash.musicscale?.center;
    const enCenter = enDash.musicscale?.center;
    const esCenter = esDash.musicscale?.center;

    if (!ptCenter || !enCenter || !esCenter) {
      logError('Missing musicscale.center key in locales');
    } else {
      const ptGS = ptCenter.getting_started;
      const enGS = enCenter.getting_started;
      const esGS = esCenter.getting_started;

      if (!ptGS || !enGS || !esGS) {
        logError('Missing getting_started key in locales');
      } else {
        // 1. Os três idiomas possuem statuses.attention.
        if (!ptGS.statuses?.attention) logError('PT missing statuses.attention');
        if (!enGS.statuses?.attention) logError('EN missing statuses.attention');
        if (!esGS.statuses?.attention) logError('ES missing statuses.attention');

        // 2. Os três idiomas possuem organization.admin_notice.
        if (!ptGS.organization?.admin_notice) logError('PT missing organization.admin_notice');
        if (!enGS.organization?.admin_notice) logError('EN missing organization.admin_notice');
        if (!esGS.organization?.admin_notice) logError('ES missing organization.admin_notice');

        // 3. Os três idiomas possuem steps.team.important.
        if (!ptGS.steps?.team?.important) logError('PT missing steps.team.important');
        if (!enGS.steps?.team?.important) logError('EN missing steps.team.important');
        if (!esGS.steps?.team?.important) logError('ES missing steps.team.important');

        // 4. Os três idiomas possuem team.invite_action.
        if (!ptGS.team?.invite_action) logError('PT missing team.invite_action');
        if (!enGS.team?.invite_action) logError('EN missing team.invite_action');
        if (!esGS.team?.invite_action) logError('ES missing team.invite_action');

        // 5. As seis etapas possuem: title, what, why, how, result, action
        const steps = ['songs', 'content', 'members', 'band_scale', 'music_scale', 'review'];
        const fields = ['title', 'what', 'why', 'how', 'result', 'action'];

        for (const s of steps) {
          const ptStep = ptGS.steps?.[s];
          const enStep = enGS.steps?.[s];
          const esStep = esGS.steps?.[s];

          if (!ptStep) logError(`PT missing step: ${s}`);
          if (!enStep) logError(`EN missing step: ${s}`);
          if (!esStep) logError(`ES missing step: ${s}`);

          for (const f of fields) {
            if (ptStep && !ptStep[f]) logError(`PT step ${s} missing field ${f}`);
            if (enStep && !enStep[f]) logError(`EN step ${s} missing field ${f}`);
            if (esStep && !esStep[f]) logError(`ES step ${s} missing field ${f}`);
          }

          // 6. Nenhuma etapa usa summary.
          if (ptStep && ptStep.summary) logError(`PT step ${s} should not use summary`);
          if (enStep && enStep.summary) logError(`EN step ${s} should not use summary`);
          if (esStep && esStep.summary) logError(`ES step ${s} should not use summary`);
        }

        // 7. PT, EN e ES possuem a mesma estrutura.
        const checkParity = (obj1: any, obj2: any, pathName: string) => {
          if (typeof obj1 !== typeof obj2) {
            logError(`Type mismatch at ${pathName}: ${typeof obj1} vs ${typeof obj2}`);
            return;
          }
          if (typeof obj1 === 'object' && obj1 !== null && obj2 !== null) {
            const keys1 = Object.keys(obj1).sort();
            const keys2 = Object.keys(obj2).sort();
            for (const k of keys1) {
              if (!(k in obj2)) {
                logError(`Key "${k}" missing in second object at ${pathName}`);
              } else {
                checkParity(obj1[k], obj2[k], `${pathName}.${k}`);
              }
            }
            for (const k of keys2) {
              if (!(k in obj1)) {
                logError(`Key "${k}" missing in first object at ${pathName}`);
              }
            }
          }
        };
        checkParity(ptGS, enGS, 'getting_started(pt vs en)');
        checkParity(ptGS, esGS, 'getting_started(pt vs es)');

        // 8. EN não contém “workflow”.
        const checkForbiddenWords = (obj: any, words: string[], lang: string, pathName: string) => {
          if (typeof obj === 'string') {
            for (const w of words) {
              if (obj.toLowerCase().includes(w.toLowerCase())) {
                logError(`Forbidden word "${w}" found in ${lang} at ${pathName}: "${obj}"`);
              }
            }
          } else if (typeof obj === 'object' && obj !== null) {
            for (const k of Object.keys(obj)) {
              checkForbiddenWords(obj[k], words, lang, `${pathName}.${k}`);
            }
          }
        };
        checkForbiddenWords(enGS, ['workflow'], 'EN', 'getting_started');

        // 9. ES não contém “trabalho”.
        // 10. ES não contém “flujo de trabalho”.
        checkForbiddenWords(esGS, ['trabalho', 'flujo de trabalho'], 'ES', 'getting_started');

        // 11. EN usa “Check everything before the service”.
        if (enGS.steps?.review?.title !== 'Check everything before the service') {
          logError(`EN review title expected "Check everything before the service", got "${enGS.steps?.review?.title}"`);
        }

        // 12. ES usa “Revisa todo antes del servicio”.
        if (esGS.steps?.review?.title !== 'Revisa todo antes del servicio') {
          logError(`ES review title expected "Revisa todo antes del servicio", got "${esGS.steps?.review?.title}"`);
        }

        // 13. PT usa “Confira tudo antes do culto”.
        if (ptGS.steps?.review?.title !== 'Confira tudo antes do culto') {
          logError(`PT review title expected "Confira tudo antes do culto", got "${ptGS.steps?.review?.title}"`);
        }
      }
    }
  }

  // 14. musicScaleReady não é opcional.
  if (compContent.includes('musicScaleReady?: boolean')) {
    logError('musicScaleReady is still optional in component properties');
  }

  // 15. musicScaleReady não possui default true.
  if (compContent.includes('musicScaleReady = true')) {
    logError('musicScaleReady still has a default parameter value in component');
  }

  // 16. invite_title não é usado como texto do botão.
  if (compContent.includes('invite_title :') || compContent.includes('invite_title}')) {
    logError('invite_title seems to be used directly in button or expression');
  }

  // 17. pendingInviteCount > 0 utiliza invite_another_action.
  // 18. memberCount > 1 utiliza invite_another_action.
  // 19. estado vazio utiliza invite_action.
  const teamInviteRegex = /memberCount\s*>\s*1\s*\|\|\s*pendingInviteCount\s*>\s*0\s*\?\s*t\(\s*['"]musicscale\.center\.getting_started\.team\.invite_another_action['"][\s\S]*?\:\s*t\(\s*['"]musicscale\.center\.getting_started\.team\.invite_action['"]/;
  if (!teamInviteRegex.test(compContent)) {
    logError('Component does not implement the exact team invite conditional buttons logic');
  }

  if (hasErrors) {
    console.error("Test Failed:\n", errors.join('\n'));
    process.exit(1);
  }

  console.log("All static tests passed for UX-RECOVERY-2C");
}

runTests();
