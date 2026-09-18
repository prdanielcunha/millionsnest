import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  deriveNextScaleRepertoireContentSnapshot,
  hasRepertoireContentGaps
} from '../src/lib/musicScaleRepertoireIntelligence.js';
import { projectCurrentMusicScaleFacts } from '../src/lib/musicScaleFactProjection.js';
import { collectMusicScaleSignalsFromFacts } from '../src/lib/factSignalAdapter.js';
import { projectEvidenceBackedSignalToAction } from '../src/lib/actionCenter.js';

const songs = [
  {
    id: 'song-ready-lyrics',
    title: 'Com Letra',
    lyrics: 'Conteúdo da letra',
    chords: ''
  },
  {
    id: 'song-ready-chords',
    title: 'Com Cifra',
    lyrics: '',
    chords: 'C  G  Am  F'
  },
  {
    id: 'song-empty-a',
    title: 'Sem Conteúdo A',
    lyrics: '   ',
    chords: ''
  },
  {
    id: 'song-empty-b',
    title: 'Sem Conteúdo B',
    lyrics: null,
    chords: null
  },
  // Duplicate library record: first canonical record wins.
  {
    id: 'song-empty-b',
    title: 'Duplicata que não deve alterar o resultado',
    lyrics: 'texto tardio',
    chords: 'D'
  }
];

const snapshot = deriveNextScaleRepertoireContentSnapshot(
  [
    'song-ready-lyrics',
    'song-ready-chords',
    'song-empty-a',
    'song-empty-b',
    'song-missing',
    'song-empty-a',
    '   '
  ],
  songs
);

assert.deepEqual(snapshot, {
  totalSongRefs: 5,
  resolvedSongCount: 4,
  missingLibrarySongIds: ['song-missing'],
  emptyContentSongIds: ['song-empty-a', 'song-empty-b'],
  emptyContentTitles: ['Sem Conteúdo A', 'Sem Conteúdo B'],
  gapCount: 3
});

assert.equal(hasRepertoireContentGaps(snapshot), true);
assert.equal(
  hasRepertoireContentGaps(
    deriveNextScaleRepertoireContentSnapshot(
      ['song-ready-lyrics', 'song-ready-chords'],
      songs
    )
  ),
  false,
  'lyrics OR chords is sufficient to avoid a factual content gap'
);

const organizationId = 'org-repertoire';
const observedAtMs = 1_800_000_000_000;
const startsAtMs = observedAtMs + 3_600_000;

const facts = projectCurrentMusicScaleFacts({
  organizationId,
  ready: true,
  observedAtMs,
  nextScale: {
    id: 'scale-repertoire',
    startsAtMs,
    responseSummaryAvailable: true,
    pendingResponses: 0,
    pendingByFunction: [],
    declinedResponses: 0,
    declinedByFunction: [],
    repertoireContent: snapshot
  },
  nextPersonalScale: null
});

const responseFact = facts.find(
  fact => fact.eventType === 'musicscale.scale.response_summary_observed'
);
const repertoireFact = facts.find(
  fact => fact.eventType === 'musicscale.scale.repertoire_content_observed'
);

assert.ok(responseFact);
assert.ok(repertoireFact);
assert.equal(
  responseFact!.idempotencyKey,
  `musicscale:${organizationId}:scale:scale-repertoire:response-summary:pending-0:declined-0`,
  'repertoire intelligence must not mutate the response-summary fact identity'
);
assert.equal(repertoireFact!.metadata.gapCount, 3);
assert.deepEqual(
  repertoireFact!.metadata.missingLibrarySongIds,
  ['song-missing']
);
assert.deepEqual(
  repertoireFact!.metadata.emptyContentSongIds,
  ['song-empty-a', 'song-empty-b']
);
assert.deepEqual(
  repertoireFact!.metadata.emptyContentTitles,
  ['Sem Conteúdo A', 'Sem Conteúdo B']
);
assert.equal(
  repertoireFact!.source.sourceRef,
  'musicscale.read_model.next_schedule_repertoire_content'
);
assert.deepEqual(repertoireFact!.source.fieldPaths, [
  'songIds',
  'songs.id',
  'songs.title',
  'songs.lyrics',
  'songs.chords'
]);

const signals = collectMusicScaleSignalsFromFacts(facts);
const repertoireSignal = signals.find(
  signal => signal.signalType === 'musicscale_repertoire_content_gaps'
);
assert.ok(repertoireSignal);
assert.equal(repertoireSignal!.payload.gapCount, 3);
assert.equal(repertoireSignal!.payload.missingLibrarySongCount, 1);
assert.equal(repertoireSignal!.payload.emptyContentSongCount, 2);
assert.deepEqual(
  repertoireSignal!.payload.emptyContentTitles,
  ['Sem Conteúdo A', 'Sem Conteúdo B']
);

const action = projectEvidenceBackedSignalToAction(
  repertoireSignal!,
  {
    canManageOrganization: false,
    canManageMembers: false,
    canReadManagedMusicScaleResponses: true
  }
);
assert.ok(action);
assert.equal(action!.priority, 'normal');
assert.equal(
  action!.titleKey,
  'workspace.actions.musicscale_repertoire_content_gaps.title'
);
assert.equal(
  action!.descriptionKey,
  'workspace.actions.musicscale_repertoire_content_gaps.description_with_titles'
);
assert.deepEqual(action!.translationParams, {
  count: 3,
  missing: 1,
  empty: 2,
  songs: 'Sem Conteúdo A · Sem Conteúdo B'
});
assert.deepEqual(action!.destination, {
  kind: 'app',
  appId: 'musicscale',
  path: '/scales/scale-repertoire'
});
assert.equal(action!.dueAtMs, startsAtMs);

assert.equal(
  projectEvidenceBackedSignalToAction(
    repertoireSignal!,
    {
      canManageOrganization: true,
      canManageMembers: true,
      canReadManagedMusicScaleResponses: false
    }
  ),
  null,
  'global/organization administration must not substitute for worship content authority'
);

const changedSnapshot = deriveNextScaleRepertoireContentSnapshot(
  ['song-empty-a', 'song-missing-2'],
  songs
);
const changedFact = projectCurrentMusicScaleFacts({
  organizationId,
  ready: true,
  observedAtMs,
  nextScale: {
    id: 'scale-repertoire',
    startsAtMs,
    responseSummaryAvailable: true,
    pendingResponses: 0,
    repertoireContent: changedSnapshot
  },
  nextPersonalScale: null
}).find(
  fact => fact.eventType === 'musicscale.scale.repertoire_content_observed'
)!;
const changedSignal = collectMusicScaleSignalsFromFacts([changedFact]).find(
  signal => signal.signalType === 'musicscale_repertoire_content_gaps'
)!;

assert.notEqual(
  repertoireFact!.idempotencyKey,
  changedFact.idempotencyKey,
  'materially changed repertoire gaps must create a new canonical fact identity'
);
assert.notEqual(
  repertoireSignal!.fingerprint,
  changedSignal.fingerprint,
  'dismissed repertoire action must reappear when the concrete gaps change'
);

const cleanSnapshot = deriveNextScaleRepertoireContentSnapshot(
  ['song-ready-lyrics', 'song-ready-chords'],
  songs
);
const cleanFacts = projectCurrentMusicScaleFacts({
  organizationId,
  ready: true,
  observedAtMs,
  nextScale: {
    id: 'scale-clean',
    startsAtMs,
    responseSummaryAvailable: true,
    pendingResponses: 0,
    repertoireContent: cleanSnapshot
  },
  nextPersonalScale: null
});
assert.ok(
  cleanFacts.some(
    fact => fact.eventType === 'musicscale.scale.repertoire_content_observed'
  ),
  'clean repertoire may still have an evidence fact'
);
assert.equal(
  collectMusicScaleSignalsFromFacts(cleanFacts).some(
    signal => signal.signalType === 'musicscale_repertoire_content_gaps'
  ),
  false,
  'zero factual gaps must not create an action'
);

const dashboard = readFileSync('src/pages/Dashboard.tsx', 'utf8');
assert.match(
  dashboard,
  /deriveNextScaleRepertoireContentSnapshot/,
  'Dashboard must derive repertoire gaps from the already-loaded songs read model'
);
assert.match(
  dashboard,
  /Array\.isArray\(nextScale\.songIds\) \? nextScale\.songIds : \[\]/,
  'Dashboard must use the actual next-scale song references'
);
assert.match(
  dashboard,
  /repertoireContent:\s*canReadWorshipDistribution/,
  'repertoire intelligence must stay behind worship authority'
);

const home = readFileSync(
  'src/components/dashboard/EcosystemWorkspaceHome.tsx',
  'utf8'
);
assert.match(
  home,
  /repertoireContent:\s*musicScaleSummary\.nextScale\.repertoireContent/,
  'adaptive Home must pass repertoire evidence into the canonical Fact Stream'
);

const helperSource = readFileSync(
  'src/lib/musicScaleRepertoireIntelligence.ts',
  'utf8'
);
for (const forbiddenField of [
  'readinessScore',
  'performanceScore',
  'wellbeingScore',
  'spiritualScore'
]) {
  assert.equal(
    helperSource.includes(forbiddenField),
    false,
    `repertoire projector must not invent ${forbiddenField}`
  );
}

for (const language of ['pt', 'en', 'es']) {
  const locale = readFileSync(
    `src/packages/i18n/locales/${language}.ts`,
    'utf8'
  );
  assert.match(
    locale,
    /musicscale_repertoire_content_gaps:\s*\{/,
    `${language} must include repertoire content-gap guidance`
  );
}

console.log('MusicScale repertoire content intelligence checks passed.');
