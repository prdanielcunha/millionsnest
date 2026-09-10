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

const registrySrc = fs.readFileSync('src/lib/appExperienceRegistry.ts', 'utf-8');
const launcherSrc = fs.readFileSync('src/lib/ecosystemLauncher.ts', 'utf-8');
const centerSrc = fs.readFileSync('src/components/dashboard/MusicScaleGuideCenter.tsx', 'utf-8');
const appsSrc = fs.readFileSync('src/lib/apps.ts', 'utf-8');

const appIds = ['musicscale', 'nestfinance', 'nestlocal', 'nestjourney', 'connect'];
const musicScaleDestinations = [
  "home: '/'",
  "repertoire: '/songs'",
  "songs: '/songs'",
  "chords: '/songs'",
  "lyrics: '/songs'",
  "ai_import: '/songs'",
  "library: '/library'",
  "music_scales: '/scales'",
  "members: '/users'",
  "band_scales: '/band-scales'",
  "roles: '/roles'",
  "profile: '/profile'",
  "plan_usage: '/plan-usage'",
  "notifications: '/notifications'"
];

assertCondition('1. Registry exposes the canonical three Hub app sections',
  registrySrc.includes("'overview'") &&
  registrySrc.includes("'getting-started'") &&
  registrySrc.includes("'resources'")
);

for (const appId of appIds) {
  assertCondition(`Registry contains ${appId}`, registrySrc.includes(`${appId}: {`));
}

for (const destination of musicScaleDestinations) {
  assertCondition(`MusicScale destination exists: ${destination}`, registrySrc.includes(destination));
}

assertCondition('Dynamic MusicScale scale detail destination is registered',
  registrySrc.includes("music_scale: '/scales/:id'")
);
assertCondition('Registry resolves semantic destinations', registrySrc.includes('resolveAppDestination'));
assertCondition('Registry resolves entity destinations safely',
  registrySrc.includes('resolveAppEntityDestination') && registrySrc.includes('encodeURIComponent')
);
assertCondition('Registry validates destination paths centrally', registrySrc.includes('isAllowedAppDestinationPath'));

assertCondition('Launcher imports centralized destination validation',
  launcherSrc.includes("from './appExperienceRegistry.js'") && launcherSrc.includes('isAllowedAppDestinationPath(moduleKey, cleanDestinationPath)')
);
assertCondition('Launcher no longer owns a hard-coded MusicScale route allowlist',
  !launcherSrc.includes('allowedMusicScalePaths')
);

assertCondition('GuideCenter consumes the semantic destination registry',
  centerSrc.includes('resolveAppDestination') && centerSrc.includes('resolveAppEntityDestination')
);
assertCondition('GuideCenter keeps Overview, Getting Started and Resources interactive tabs',
  centerSrc.includes("activeSection === 'overview'") &&
  centerSrc.includes("activeSection === 'getting-started'") &&
  centerSrc.includes("activeSection === 'resources'")
);
assertCondition('Resource cards carry explicit semantic destinations',
  centerSrc.includes("destination: 'repertoire'") &&
  centerSrc.includes("destination: 'library'") &&
  centerSrc.includes("destination: 'music_scales'") &&
  centerSrc.includes("destination: 'members'") &&
  centerSrc.includes("destination: 'band_scales'")
);
assertCondition('Resource actions deep-link using each card destination',
  centerSrc.includes('onOpenMusicScale(pathFor(card.destination))')
);
assertCondition('Resource cards do not use the old generic root action',
  !centerSrc.includes('onClick={onOpenMusicScale}')
);
assertCondition('Getting Started resolves the exact path for every operational step',
  centerSrc.includes('pathForStep(step)') && centerSrc.includes('onOpenMusicScale(pathForStep(step))')
);
assertCondition('Overview is driven by live MusicScale summary fields',
  centerSrc.includes('musicScaleSummary.songsCount') &&
  centerSrc.includes('musicScaleSummary.songsWithContentCount') &&
  centerSrc.includes('musicScaleSummary.configuredMembersCount') &&
  centerSrc.includes('musicScaleSummary.scalesCount') &&
  centerSrc.includes('musicScaleSummary.bandScalesCount') &&
  centerSrc.includes('musicScaleSummary.nextScale')
);
assertCondition('Onboarding completion is derived from live app state',
  centerSrc.includes('completedByStep') && centerSrc.includes('progressPercent') && centerSrc.includes('nextStep')
);
assertCondition('Permission and billing gates remain enforced',
  centerSrc.includes('canManageOrganization') &&
  centerSrc.includes('canInvite') &&
  centerSrc.includes('canManageTeam') &&
  centerSrc.includes('canManageBilling') &&
  centerSrc.includes('hasPaymentIssue')
);
assertCondition('All visible app catalog entries have a framework registration',
  appIds.every(appId => appsSrc.includes(`id: '${appId}'`) && registrySrc.includes(`${appId}: {`))
);
assertCondition('All buttons in GuideCenter explicitly declare button type',
  !centerSrc.match(/<button(?![^>]*type="button")/)
);
assertCondition('GuideCenter avoids unsafe direct href/window.open navigation',
  !centerSrc.includes('window.open') && !centerSrc.includes(' href=')
);

console.log(`\nHub App Experience Framework: ${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
