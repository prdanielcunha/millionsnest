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
  dashboard,
  /organizationId=\{String\(activeContextOrgId \|\| ''\)\}/,
  'Dashboard must pass the canonical active organization id to adaptive Home'
);
assert.match(
  home,
  /organizationId,\s*\n\s*appExperiences,/,
  'adaptive Home must use the explicit canonical organization id instead of relying on an embedded organization.id'
);
assert.equal(
  home.includes("organizationId: String(organization?.id || '')"),
  false,
  'adaptive Home must not reconstruct tenant identity from an optional organization object'
);
assert.match(
  adaptive,
  /filterActionsByAppEntitlement/,
  'Adaptive workspace must filter app-owned claims by product entitlement before My Today'
);
assert.match(
  currentBridge,
  /buildCurrentContextGraph\s*\(\{/,
  'current Hub bridge must resolve entitlements and authority through the canonical Context Graph'
);
assert.match(
  currentBridge,
  /contextGraph\.authorizedDomains/,
  'adaptive authorization must consume Context Graph domain authority'
);
assert.match(
  currentBridge,
  /contextGraph\.entitledAppIds/,
  'adaptive product access must consume Context Graph operational entitlements'
);
assert.match(
  currentBridge,
  /contextGraph\.responsibilities/,
  'adaptive Lens preference must consume canonical Context Graph responsibilities'
);
assert.equal(
  currentBridge.includes('availableAppIds'),
  false,
  'adaptive runtime must not equate catalog availability with paid/entitled products'
);

console.log('Adaptive Home entitlement integration checks passed.');
