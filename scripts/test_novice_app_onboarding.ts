import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const home = readFileSync('src/components/dashboard/EcosystemWorkspaceHome.tsx', 'utf8');
const launchpad = readFileSync('src/components/dashboard/HubAppLaunchpad.tsx', 'utf8');

assert.match(
  home,
  /<HubAppLaunchpad/,
  'Hub Home must show a start-here surface for active products'
);

assert.match(
  home,
  /primaryOperationalExperience/,
  'top-level quick action must resolve from the current operational product set'
);

assert.match(
  home,
  /onClick=\{\(\) => onLaunchApp\(primaryOperationalExperience\.app\)\}/,
  'the primary quick action must open the actual active app directly'
);

assert.match(
  launchpad,
  /experience\.installed === true[\s\S]*experience\.canOpen === true[\s\S]*experience\.isOperational === true/,
  'launchpad must only present products that are truly installed, openable and operational'
);

assert.match(
  launchpad,
  /onOpenApp\(single\)/,
  'single-app customers must get a direct open-app action'
);

assert.match(
  launchpad,
  /onViewApp\(single\)/,
  'single-app customers must also have an explicit how-to-start path'
);

assert.match(
  launchpad,
  /operational\.map\(experience =>/,
  'multi-app customers must receive a scalable app chooser rather than a hardcoded MusicScale path'
);

assert.equal(
  launchpad.includes("experience.app.id === 'nestfinance'"),
  false,
  'novice onboarding must remain product-generic for future apps'
);

assert.equal(
  launchpad.includes("experience.app.id === 'nestjourney'"),
  false,
  'novice onboarding must not special-case unbuilt future apps'
);

console.log('Novice app onboarding and launch clarity checks passed.');
