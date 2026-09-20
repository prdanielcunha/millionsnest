import {
  fingerprintNestJourneyQueue
} from './actionSignals.js';
import type {
  ActionResolutionRecord,
  ResolvableNestJourneySignal
} from './actionResolution.js';
import type {
  ActionOutcomeCode,
  ActionOutcomeResult
} from './outcomeEngine.js';
import type {
  NestJourneyQueueSummary,
  NestJourneyWorkspaceProjection
} from './nestJourneyWorkspaceProjection.js';

export type JourneyOutcomeAttestationReason =
  | 'JOURNEY_OUTCOME_PROJECTION_NOT_READY'
  | 'JOURNEY_OUTCOME_SOURCE_STILL_ACTIVE'
  | 'JOURNEY_OUTCOME_SOURCE_CLEARED_NOT_UPDATED'
  | 'JOURNEY_OUTCOME_SOURCE_UNCHANGED'
  | 'JOURNEY_OUTCOME_NOT_SUPPORTED';

export type JourneyOutcomeAttestation =
  | {
      attested: true;
      queueId:
        | 'assigned:first_contact'
        | 'unassigned:first_contact';
      observedAtMs: number;
      currentCount: number;
      currentFingerprint: string | null;
    }
  | {
      attested: false;
      reasonCode:
        JourneyOutcomeAttestationReason;
    };

const RESOLVED_CODE_BY_SIGNAL: Record<
  ResolvableNestJourneySignal,
  Extract<
    ActionOutcomeCode,
    | 'nestjourney_assigned_first_contacts_cleared'
    | 'nestjourney_unassigned_first_contacts_cleared'
  >
> = {
  nestjourney_assigned_first_contacts:
    'nestjourney_assigned_first_contacts_cleared',
  nestjourney_unassigned_first_contacts:
    'nestjourney_unassigned_first_contacts_cleared'
};

function queueForSignal(
  projection: NestJourneyWorkspaceProjection,
  signalType: ResolvableNestJourneySignal
): {
  queueId:
    | 'assigned:first_contact'
    | 'unassigned:first_contact';
  queue: NestJourneyQueueSummary;
} {
  if (
    signalType ===
    'nestjourney_assigned_first_contacts'
  ) {
    return {
      queueId: 'assigned:first_contact',
      queue:
        projection.assignedFirstContacts
    };
  }

  return {
    queueId: 'unassigned:first_contact',
    queue:
      projection.unassignedFirstContacts
  };
}

export function attestNestJourneyOutcome(input: {
  resolution: Pick<
    ActionResolutionRecord,
    | 'organizationId'
    | 'sourceApp'
    | 'signalType'
    | 'fingerprint'
  >;
  result: ActionOutcomeResult;
  code: ActionOutcomeCode;
  projection: NestJourneyWorkspaceProjection;
}): JourneyOutcomeAttestation {
  const {
    resolution,
    result,
    code,
    projection
  } = input;

  if (
    resolution.sourceApp !== 'nestjourney' ||
    (
      resolution.signalType !==
        'nestjourney_assigned_first_contacts' &&
      resolution.signalType !==
        'nestjourney_unassigned_first_contacts'
    )
  ) {
    return {
      attested: false,
      reasonCode:
        'JOURNEY_OUTCOME_NOT_SUPPORTED'
    };
  }

  if (
    projection.organizationId !==
      resolution.organizationId ||
    projection.accessible !== true ||
    projection.isGlobalAccess === true ||
    projection.decisionState !== 'granted' ||
    projection.canReadJourneyOperational !== true ||
    projection.ready !== true
  ) {
    return {
      attested: false,
      reasonCode:
        'JOURNEY_OUTCOME_PROJECTION_NOT_READY'
    };
  }

  const signalType =
    resolution.signalType as
      ResolvableNestJourneySignal;
  const { queueId, queue } =
    queueForSignal(
      projection,
      signalType
    );

  if (
    result === 'resolved' &&
    code ===
      RESOLVED_CODE_BY_SIGNAL[signalType]
  ) {
    if (queue.count > 0) {
      return {
        attested: false,
        reasonCode:
          'JOURNEY_OUTCOME_SOURCE_STILL_ACTIVE'
      };
    }

    return {
      attested: true,
      queueId,
      observedAtMs:
        projection.observedAtMs,
      currentCount: 0,
      currentFingerprint: null
    };
  }

  if (
    result === 'superseded' &&
    code === 'source_signal_updated'
  ) {
    if (queue.count <= 0) {
      return {
        attested: false,
        reasonCode:
          'JOURNEY_OUTCOME_SOURCE_CLEARED_NOT_UPDATED'
      };
    }

    const currentFingerprint =
      fingerprintNestJourneyQueue({
        signalType,
        queue
      });

    if (
      currentFingerprint ===
      resolution.fingerprint
    ) {
      return {
        attested: false,
        reasonCode:
          'JOURNEY_OUTCOME_SOURCE_UNCHANGED'
      };
    }

    return {
      attested: true,
      queueId,
      observedAtMs:
        projection.observedAtMs,
      currentCount: queue.count,
      currentFingerprint
    };
  }

  return {
    attested: false,
    reasonCode:
      'JOURNEY_OUTCOME_NOT_SUPPORTED'
  };
}
