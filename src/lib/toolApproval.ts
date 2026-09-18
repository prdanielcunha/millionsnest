import type {
  EcosystemToolId,
  ToolAvailability,
  ToolRiskLevel
} from './toolGateway.js';

export type ToolApprovalStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'expired';

export interface ToolApprovalRecord {
  organizationId: string;
  approvalId: string;
  toolId: EcosystemToolId;
  risk: ToolRiskLevel;
  availabilityAtRequest: ToolAvailability;
  status: ToolApprovalStatus;
  requesterUid: string;
  approverUid?: string | null;
  idempotencyKey: string;
  requestFingerprint: string;
  input: Record<string, unknown>;
  source?: Record<string, string> | null;
  requestedAtMs: number;
  expiresAtMs: number;
  decidedAtMs?: number | null;
  decisionNote?: string | null;
}

export type ToolApprovalExecutionDecision =
  | { allowed: true }
  | {
      allowed: false;
      reasonCode:
        | 'TOOL_APPROVAL_MISSING'
        | 'TOOL_APPROVAL_TENANT_MISMATCH'
        | 'TOOL_APPROVAL_TOOL_MISMATCH'
        | 'TOOL_APPROVAL_REQUEST_MISMATCH'
        | 'TOOL_APPROVAL_NOT_APPROVED'
        | 'TOOL_APPROVAL_EXPIRED';
    };

export const DEFAULT_TOOL_APPROVAL_TTL_MS =
  30 * 60 * 1000;

export function isToolApprovalExpired(
  approval: Pick<ToolApprovalRecord, 'expiresAtMs'>,
  nowMs: number
): boolean {
  return (
    !Number.isFinite(approval.expiresAtMs) ||
    approval.expiresAtMs <= nowMs
  );
}

/**
 * Approval authorizes one exact request, never a broad capability.
 * Runtime authorization must still be revalidated separately.
 */
export function validateToolApprovalForExecution(input: {
  approval: ToolApprovalRecord | null | undefined;
  organizationId: string;
  toolId: EcosystemToolId;
  requestFingerprint: string;
  nowMs: number;
}): ToolApprovalExecutionDecision {
  const {
    approval,
    organizationId,
    toolId,
    requestFingerprint,
    nowMs
  } = input;

  if (!approval) {
    return {
      allowed: false,
      reasonCode: 'TOOL_APPROVAL_MISSING'
    };
  }

  if (approval.organizationId !== organizationId) {
    return {
      allowed: false,
      reasonCode:
        'TOOL_APPROVAL_TENANT_MISMATCH'
    };
  }

  if (approval.toolId !== toolId) {
    return {
      allowed: false,
      reasonCode: 'TOOL_APPROVAL_TOOL_MISMATCH'
    };
  }

  if (
    approval.requestFingerprint !==
    requestFingerprint
  ) {
    return {
      allowed: false,
      reasonCode:
        'TOOL_APPROVAL_REQUEST_MISMATCH'
    };
  }

  if (approval.status !== 'approved') {
    return {
      allowed: false,
      reasonCode: 'TOOL_APPROVAL_NOT_APPROVED'
    };
  }

  if (isToolApprovalExpired(approval, nowMs)) {
    return {
      allowed: false,
      reasonCode: 'TOOL_APPROVAL_EXPIRED'
    };
  }

  return { allowed: true };
}
