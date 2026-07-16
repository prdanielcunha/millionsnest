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

  // 3. Dashboard reading query param
  const dashboardContent = fs.readFileSync(path.join(root, 'src/pages/Dashboard.tsx'), 'utf8');
  if (!dashboardContent.includes('searchParams.get(\'section\')')) logError('Dashboard doesn\'t read section query param');
  if (!dashboardContent.includes('validSections.includes')) logError('Dashboard doesn\'t validate sections');
  if (!dashboardContent.includes('scrollIntoView')) {
    // scrollIntoView should not be there for tab === apps
    if (dashboardContent.includes("tab === 'apps'")) {
       if(dashboardContent.match(/tab === 'apps'.*scrollIntoView/s)) {
          logError('Legacy scrollIntoView for apps tab not removed');
       }
    }
  }

  const workspaceHomeContent = fs.readFileSync(path.join(root, 'src/components/dashboard/EcosystemWorkspaceHome.tsx'), 'utf8');
  if (workspaceHomeContent.includes("Conhecer recursos' } &rarr;")) logError('Card Conhecer recursos navigates poorly');
  if (workspaceHomeContent.includes("Aprender a usar &rarr;") && !workspaceHomeContent.includes("getting-started")) logError('Card Aprender a usar doesn\'t navigate correctly');
  if (!workspaceHomeContent.includes('onSelectMusicScaleSection(\'resources\')')) logError('Conhecer recursos action not found');

  if (hasErrors) {
    console.error("Test Failed:\n", errors.join('\n'));
    process.exit(1);
  }
  
  console.log("All static tests passed for UX-FOUNDATION-1B.1");
}

runTests();
