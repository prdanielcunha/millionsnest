import fs from 'fs';
let code = fs.readFileSync('src/components/dashboard/EcosystemWorkspaceHome.tsx', 'utf-8');

// Remove from line 408
code = code.replace(/const isReadyToOpen = musicScaleDisplayStatus !== 'loading' && musicScaleDisplayStatus !== 'unavailable';\n/, '');

// Add after line 146
code = code.replace(
  /const musicScaleDisplayStatus: MusicScaleDisplayStatus =\n\s*\(musicScaleAccess\?\.catalogState as MusicScaleDisplayStatus\) \?\? 'unavailable';/,
  `const musicScaleDisplayStatus: MusicScaleDisplayStatus =
      (musicScaleAccess?.catalogState as MusicScaleDisplayStatus) ?? 'unavailable';
      
    const isReadyToOpen = musicScaleDisplayStatus !== 'loading' && musicScaleDisplayStatus !== 'unavailable';`
);

fs.writeFileSync('src/components/dashboard/EcosystemWorkspaceHome.tsx', code);
