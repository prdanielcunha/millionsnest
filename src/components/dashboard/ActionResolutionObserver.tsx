import React from 'react';
import type { ReadOnlyHubAction } from '../../lib/actionCenter.js';
import {
  deriveClearedActionResolutions,
  type ActionResolutionRecord,
  type MusicScaleResolutionProjectionReadiness
} from '../../lib/actionResolution.js';

interface ActionResolutionObserverProps {
  resolutions: readonly ActionResolutionRecord[];
  sourceActions: readonly ReadOnlyHubAction[];
  musicScaleReadiness: MusicScaleResolutionProjectionReadiness;
  onClearedObserved: (
    resolution: ActionResolutionRecord
  ) => void | Promise<void>;
}

export function ActionResolutionObserver({
  resolutions,
  sourceActions,
  musicScaleReadiness,
  onClearedObserved
}: ActionResolutionObserverProps) {
  const submittedRef = React.useRef(new Set<string>());

  React.useEffect(() => {
    const candidates = deriveClearedActionResolutions({
      resolutions,
      sourceActions,
      musicScaleReadiness
    });

    for (const resolution of candidates) {
      const key =
        `${resolution.dedupeKey}\u0000${resolution.fingerprint}`;

      if (submittedRef.current.has(key)) continue;
      submittedRef.current.add(key);

      void Promise.resolve(
        onClearedObserved(resolution)
      );
    }
  }, [
    resolutions,
    sourceActions,
    musicScaleReadiness.scalesReady,
    musicScaleReadiness.songsReady,
    musicScaleReadiness.nextScaleId,
    musicScaleReadiness.responseSummaryAvailable,
    onClearedObserved
  ]);

  return null;
}
