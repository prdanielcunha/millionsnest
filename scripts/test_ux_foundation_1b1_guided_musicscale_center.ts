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
  
  checkFileExists('fix_i18n.py', false);
  checkFileExists('patch_dashboard.py', false);
  checkFileExists('patch_i18n.py', false);
  checkFileExists('patch_invitemodal.py', false);
  checkFileExists('update_dashboard.patch', false);

  if (hasErrors) {
    console.error(errors.join('\n'));
    process.exit(1);
  }

  // 2. Component rules
  const compContent = fs.readFileSync(path.join(root, compPath), 'utf8');
  if (compContent.includes('firebase')) logError('Component imports firebase');
  if (compContent.includes('fetch(')) logError('Component uses fetch');
  if (compContent.includes('localStorage')) logError('Component uses localStorage');
  if (compContent.includes('sessionStorage')) logError('Component uses sessionStorage');
  if (compContent.includes('AuthContext')) logError('Component imports AuthContext');
  if (compContent.includes('OrganizationContext')) logError('Component imports OrganizationContext');
  if (compContent.includes('ecosystemLauncher')) logError('Component calls ecosystemLauncher');
  
  if (!compContent.includes("activeSection === 'overview'")) logError('Missing overview section logic');
  if (!compContent.includes("activeSection === 'resources'")) logError('Missing resources section logic');
  if (!compContent.includes("activeSection === 'getting-started'")) logError('Missing getting-started section logic');

  // Validate the 8 steps
  const steps = [
    'Confira sua organização',
    'Convide sua equipe',
    'Adicione músicas ao Repertório',
    'Confira cifras e letras',
    'Organize os integrantes',
    'Monte uma Escala da Banda',
    'Crie uma Escala de Músicas',
    'Revise a preparação'
  ];
  for (const step of steps) {
    if (!compContent.includes(step)) logError(`Missing step: ${step}`);
  }

  // Validate the canonical resources names
  const resources = [
    'Repertório de músicas',
    'Biblioteca Viva',
    'Importação inteligente',
    'Cifras',
    'Letras',
    'Escalas de Músicas',
    'Escalas da Banda',
    'Integrantes'
  ];
  for (const resource of resources) {
    if (!compContent.includes(resource)) logError(`Missing resource card: ${resource}`);
  }

  // Validate visual map terms
  if (!compContent.includes('Como o Repertório funciona')) logError('Missing visual map instruction');

  // 3. WorkspaceHome rules
  const workspaceHomeContent = fs.readFileSync(path.join(root, 'src/components/dashboard/EcosystemWorkspaceHome.tsx'), 'utf8');
  if (workspaceHomeContent.includes("Conhecer recursos' } &rarr;")) logError('Card Conhecer recursos navigates poorly');
  if (workspaceHomeContent.includes("Aprender a usar &rarr;") && !workspaceHomeContent.includes("getting-started")) logError('Card Aprender a usar doesn\'t navigate correctly');
  if (!workspaceHomeContent.includes('onSelectMusicScaleSection(\'resources\')')) logError('Conhecer recursos action not found');
  
  // Checking new Home card requirement: "Abrir MusicScale" / "Conhecer recursos" / "Novo por aqui"
  if (!workspaceHomeContent.includes('dashboard.musicscale.home.new_here')) logError('Missing contextual link "Novo por aqui?"');
  if (!workspaceHomeContent.includes('onSelectMusicScaleSection(\'getting-started\')')) logError('Getting started action not found on home card');

  if (hasErrors) {
    console.error("Test Failed:\n", errors.join('\n'));
    process.exit(1);
  }
  
  console.log("All static tests passed for UX-FOUNDATION-1B.2");
}

runTests();
