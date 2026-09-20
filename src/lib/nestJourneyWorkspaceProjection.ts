import type { FactEvidenceReference } from '../packages/events/factContract.js';

export type NestJourneyResponsibility =
  | 'member'
  | 'presence_host'
  | 'mesa_team'
  | 'caregiver'
  | 'group_leader'
  | 'discipler'
  | 'coordinator'
  | 'pastor';

export interface NestJourneyOperationalCapabilities {
  canManagePresence: boolean;
  canManageMesa: boolean;
  canManagePeople: boolean;
  canManageCare: boolean;
  canManageGroups: boolean;
  canManageDiscipleship: boolean;
  canManageImplementation: boolean;
  canManagePastoral: boolean;
  canViewGovernance: boolean;
  canCoordinateJourney: boolean;
}

export interface NestJourneyQueueSummary {
  count: number;
  overdueCount: number;
  dueSoonCount: number;
  earliestDueAtMs: number | null;
  evidence: readonly FactEvidenceReference[];
}

export interface NestJourneyWorkspaceProjection {
  appId: 'nestjourney';
  organizationId: string;
  accessible: boolean;
  isGlobalAccess: boolean;
  decisionState: 'granted' | 'denied';
  denialReason: string | null;
  responsibility: NestJourneyResponsibility;
  canReadJourneyOperational: boolean;
  capabilities: NestJourneyOperationalCapabilities;
  congregationIds: readonly string[];
  ready: boolean;
  observedAtMs: number;
  assignedFirstContacts: NestJourneyQueueSummary;
  unassignedFirstContacts: NestJourneyQueueSummary;
}

export const EMPTY_NESTJOURNEY_CAPABILITIES: NestJourneyOperationalCapabilities = {
  canManagePresence: false,
  canManageMesa: false,
  canManagePeople: false,
  canManageCare: false,
  canManageGroups: false,
  canManageDiscipleship: false,
  canManageImplementation: false,
  canManagePastoral: false,
  canViewGovernance: false,
  canCoordinateJourney: false
};

export function hasNestJourneyOperationalCapability(
  capabilities: NestJourneyOperationalCapabilities
): boolean {
  return Object.values(capabilities).some(Boolean);
}

export function emptyNestJourneyQueue(): NestJourneyQueueSummary {
  return {
    count: 0,
    overdueCount: 0,
    dueSoonCount: 0,
    earliestDueAtMs: null,
    evidence: []
  };
}
