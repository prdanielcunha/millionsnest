import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const dashboard = readFileSync('src/pages/Dashboard.tsx', 'utf8');
const home = readFileSync('src/components/dashboard/EcosystemWorkspaceHome.tsx', 'utf8');
const adaptive = readFileSync('src/lib/adaptiveWorkspaceModel.ts', 'utf8');
const currentBridge = readFileSync('src/lib/currentAdaptiveWorkspace.ts', 'utf8');

assert.match(
  home,
  /buildCurrentAdaptiveWorkspace/,
  'Hub Home must consume the canonical adaptive workspace bridge'
);
assert.match(
  home,
  /<HubLensSwitcher/,
  'Hub Home must expose the resolved Lens selector'
);
assert.match(
  home,
  /actionsForActiveLens/,
  'Today actions must come from the active permission-safe Lens'
);
assert.equal(
  home.includes('deriveReadOnlyHubActions'),
  false,
  'visible Hub Home must no longer bypass the evidence-first adaptive projector'
);
assert.match(
  home,
  /appExperiences,/,
  'Hub Home must pass canonical app experiences into the adaptive entitlement resolver'
);
assert.match(
  dashboard,
  /musicScaleAuthority=\{musicScaleProjection\s+\?\s+\{/,
  'Dashboard must pass the backend-authoritative MusicScale capability projection to Home'
);
assert.match(
  adaptive,
  /filterActionsByAppEntitlement/,
  'Adaptive workspace must filter app-owned claims by product entitlement before My Today'
);
assert.match(
  currentBridge,
  /resolveEntitledAppIds(input.appExperiences)/,
  'current Hub bridge must derive entitlements from canonical Hub app experience'
);
assert.match(
  currentBridge,
  /decisionState === 'granted'/,
  'server authority must be able to fail closed over stale catalog state'
);
assert.equal(
  currentBridge.includes('availableAppIds'),
  false,
  'adaptive runtime must not equate catalog availability with paid/entitled products'
);

console.log('Adaptive Home entitlement integration checks passed.');
