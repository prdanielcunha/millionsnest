import fs from 'fs';
let code = fs.readFileSync('src/components/dashboard/EcosystemWorkspaceHome.tsx', 'utf-8');

code = code.replace(
  /const msActive = musicScaleAccess\?\.accessible === true \|\| musicScaleAccess\?\.catalogState === 'trialing';/,
  `const isReadyToOpen = musicScaleDisplayStatus !== 'loading' && musicScaleDisplayStatus !== 'unavailable';
    const msActive = musicScaleAccess?.accessible === true || musicScaleAccess?.catalogState === 'trialing';`
);

fs.writeFileSync('src/components/dashboard/EcosystemWorkspaceHome.tsx', code);
