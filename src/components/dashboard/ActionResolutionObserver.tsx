import React from 'react';
import type { ReadOnlyHubAction } from '../../lib/actionCenter.js';
import {
  type ActionResolutionRecord,
  type MusicScaleResolutionProjectionReadiness,
  type NestJourneyResolutionProjectionReadiness
} from '../../lib/actionResolution.js';
import {
  deriveActionOutcomeObservations,
  type ActionOutcomeObservation
} from '../../lib/outcomeEngine.js';

interface ActionResolutionObserverProps {
  resolutions: readonly ActionResolutionRecord[];
  sourceActions: readonly ReadOnlyHubAction[];
  musicScaleReadiness: MusicScaleResolutionProjectionReadiness;
  journeyReadiness: NestJourneyResolutionProjectionReadiness;
  onOutcomeObserved: (
    observation: ActionOutcomeObservation
  ) => void | Promise<void>;
}

export function ActionResolutionObserver({
  resolutions,
  sourceActions,
  musicScaleReadiness,
  journeyReadiness,
  onOutcomeObserved
}: ActionResolutionObserverProps) {
  const submittedRef = React.useRef(new Set<string>());

  React.useEffect(() => {
    const candidates =
      deriveActionOutcomeObservations({
        resolutions,
        sourceActions,
        musicScaleReadiness,
        journeyReadiness
      });

    for (const observation of candidates) {
      const key =
        `${observation.resolution.dedupeKey}\u0000${observation.resolution.fingerprint}\u0000${observation.result}\u0000${observation.code}`;

      if (submittedRef.current.has(key)) continue;
      submittedRef.current.add(key);

      void Promise.resolve(
        onOutcomeObserved(observation)
      );
    }
  }, [
    resolutions,
    sourceActions,
    musicScaleReadiness.scalesReady,
    musicScaleReadiness.songsReady,
    musicScaleReadiness.nextScaleId,
    musicScaleReadiness.responseSummaryAvailable,
    journeyReadiness.ready,
    onOutcomeObserved
  ]);

  return null;
}
