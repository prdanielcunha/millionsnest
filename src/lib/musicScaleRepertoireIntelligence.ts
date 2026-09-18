export interface MusicScaleRepertoireSongInput {
  id: string;
  title?: string | null;
  lyrics?: string | null;
  chords?: string | null;
}

export interface MusicScaleRepertoireContentSnapshot {
  totalSongRefs: number;
  resolvedSongCount: number;
  missingLibrarySongIds: string[];
  emptyContentSongIds: string[];
  emptyContentTitles: string[];
  gapCount: number;
}

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function hasContent(value: unknown): boolean {
  return clean(value).length > 0;
}

/**
 * Factual repertoire readiness for a single schedule.
 *
 * A gap means only one of two verifiable conditions:
 * 1) the scale references a song id that is absent from the loaded org library;
 * 2) the matching song has neither lyrics nor chords stored.
 *
 * It does NOT claim that a chart is musically correct, validated, rehearsed or
 * that a musician is prepared.
 */
export function deriveNextScaleRepertoireContentSnapshot(
  songIdsInput: readonly string[] | null | undefined,
  songs: readonly MusicScaleRepertoireSongInput[]
): MusicScaleRepertoireContentSnapshot {
  const songIds = Array.from(new Set(
    (Array.isArray(songIdsInput) ? songIdsInput : [])
      .map(clean)
      .filter(Boolean)
  ));

  const songById = new Map<string, MusicScaleRepertoireSongInput>();
  for (const song of songs) {
    const id = clean(song?.id);
    if (!id || songById.has(id)) continue;
    songById.set(id, song);
  }

  const missingLibrarySongIds: string[] = [];
  const emptyContentSongIds: string[] = [];
  const emptyContentTitles: string[] = [];
  let resolvedSongCount = 0;

  for (const songId of songIds) {
    const song = songById.get(songId);
    if (!song) {
      missingLibrarySongIds.push(songId);
      continue;
    }

    resolvedSongCount += 1;

    const hasLyrics = hasContent(song.lyrics);
    const hasChords = hasContent(song.chords);
    if (hasLyrics || hasChords) continue;

    emptyContentSongIds.push(songId);

    const title = clean(song.title);
    if (title && !emptyContentTitles.includes(title)) {
      emptyContentTitles.push(title);
    }
  }

  return {
    totalSongRefs: songIds.length,
    resolvedSongCount,
    missingLibrarySongIds,
    emptyContentSongIds,
    emptyContentTitles,
    gapCount:
      missingLibrarySongIds.length +
      emptyContentSongIds.length
  };
}

export function hasRepertoireContentGaps(
  snapshot: MusicScaleRepertoireContentSnapshot | null | undefined
): boolean {
  return Boolean(snapshot && snapshot.gapCount > 0);
}
