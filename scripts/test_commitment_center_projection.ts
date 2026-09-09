import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { deriveReadOnlyHubCommitments } from '../src/lib/commitmentCenter.js';

const now = Date.parse('2026-09-09T10:00:00Z');
const future = now + 3 * 24 * 60 * 60 * 1000;

assert.deepEqual(
  deriveReadOnlyHubCommitments({
    musicScale: {
      ready: false,
      nextPersonalScale: {
        id: 'scale-1',
        date: '2026-09-12',
        time: '19:00',
        startsAtMs: future,
        songCount: 4,
        functionNames: ['Teclado']
      }
    }
  }, now),
  [],
  'an unavailable app must not project a commitment'
);

const projected = deriveReadOnlyHubCommitments({
  musicScale: {
    ready: true,
    nextPersonalScale: {
      id: 'scale-1',
      date: '2026-09-12',
      time: '19:00',
      startsAtMs: future,
      songCount: 4,
      functionNames: ['Teclado', 'Teclado', '  Direção  ']
    }
  }
}, now);

assert.equal(projected.length, 1);
assert.equal(projected[0]?.sourceApp, 'musicscale');
assert.equal(projected[0]?.sourceEntityType, 'scale');
assert.equal(projected[0]?.sourceEntityId, 'scale-1');
assert.equal(projected[0]?.songCount, 4);
assert.deepEqual(projected[0]?.functionNames, ['Teclado', 'Direção']);
assert.deepEqual(projected[0]?.destination, {
  kind: 'app',
  appId: 'musicscale',
  path: '/scales/scale-1'
});

const alreadyEnded = deriveReadOnlyHubCommitments({
  musicScale: {
    ready: true,
    nextPersonalScale: {
      id: 'scale-old',
      date: '2026-09-08',
      time: '10:00',
      startsAtMs: now - 7 * 60 * 60 * 1000,
      songCount: 3,
      functionNames: ['Vocal']
    }
  }
}, now);

assert.deepEqual(
  alreadyEnded,
  [],
  'old commitments must not remain on the Hub'
);

const negativeSongs = deriveReadOnlyHubCommitments({
  musicScale: {
    ready: true,
    nextPersonalScale: {
      id: 'scale-normalized',
      date: '2026-09-12',
      startsAtMs: future,
      songCount: -3,
      functionNames: []
    }
  }
}, now);

assert.equal(
  negativeSongs[0]?.songCount,
  0,
  'display counts must be normalized before reaching the UI'
);

// Structural contract: the Hub must derive a personal commitment from the
// current user's active event assignment, not from the organization's global
// next scale. This prevents leaders from seeing somebody else's participation
// as their own commitment.
const dashboardSource = readFileSync(
  resolve('src/pages/Dashboard.tsx'),
  'utf8'
);

assert.match(
  dashboardSource,
  /assignment\?\.userId === user\.uid/,
  'Dashboard must scope the personal MusicScale commitment to the authenticated user'
);

assert.match(
  dashboardSource,
  /nextPersonalScale/,
  'Dashboard summary must expose the personal commitment separately from nextScale'
);

const workspaceSource = readFileSync(
  resolve('src/components/dashboard/EcosystemWorkspaceHome.tsx'),
  'utf8'
);

assert.match(
  workspaceSource,
  /deriveReadOnlyHubCommitments/,
  'Hub workspace must project commitments through the dedicated domain layer'
);

assert.match(
  workspaceSource,
  /<EcosystemCommitments/,
  'Hub workspace must render commitments separately from Today actions'
);

for (const language of ['pt', 'en', 'es']) {
  const localeSource = readFileSync(
    resolve(`src/packages/i18n/locales/${language}.ts`),
    'utf8'
  );

  assert.match(
    localeSource,
    /commitments:\s*\{/,
    `${language} locale must include the commitment experience`
  );
}

console.log('Commitment Center projection and UI contract checks passed.');
