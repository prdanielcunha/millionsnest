import {
  normalizeInvitationEmail,
  isInvitationRole,
  InvitationRole
} from './InvitationAcceptancePlanner.js';
import { isValidInvitationOrganizationId } from '../../lib/InvitationRedirectPolicy.js';
import { canInviteOrganizationRole } from '../../lib/organizationRoles.js';

export const INVITATION_TTL_MS = 604800000;

export type InvitationCreatorGlobalRole =
  | 'ceo'
  | 'global_admin'
  | 'ecosystem_owner'
  | 'founder';

export type InvitationCreatorMembershipRole =
  | 'owner'
  | 'admin'
  | 'manager'
  | 'member'
  | 'viewer';

export type InvitationCreatorIdentity = {
  uid?: string;
  globalRole?: string;
};

export type InvitationCreatorMembership = {
  exists: boolean;
  status?: string;
  role?: string;
};

export type InvitationCreationOrganization = {
  exists: boolean;
  organizationId?: string;
  name?: string;
  status?: string;
};

export type InvitationCreationRequest = {
  organizationId?: string;
  email?: string;
  role?: string;
};

export type InvitationCreationCapacity = {
  resolved: boolean;
  mode?: 'limited' | 'unlimited';
  occupiedSlots?: number;
  maxMembers?: number;
};

export type ExistingPendingInvitationState = {
  exists: boolean;
  status?: string;
  emailNormalized?: string;
  expiresAtMs?: number;
  revokedAtMs?: number;
};

export type InvitationCreationInput = {
  creator: InvitationCreatorIdentity;
  creatorMembership: InvitationCreatorMembership;
  organization: InvitationCreationOrganization;
  request: InvitationCreationRequest;
  capacity: InvitationCreationCapacity;
  existingPendingInvitation: ExistingPendingInvitationState;
};

export type InvitationCreationFailureReason =
  | 'UNAUTHENTICATED'
  | 'INVALID_ORGANIZATION_ID'
  | 'ORGANIZATION_NOT_FOUND'
  | 'ORGANIZATION_INACTIVE'
  | 'ORGANIZATION_STATE_INCONSISTENT'
  | 'ACTOR_MEMBERSHIP_REQUIRED'
  | 'ACTOR_MEMBERSHIP_INACTIVE'
  | 'ACTOR_MEMBERSHIP_STATE_INCONSISTENT'
  | 'PERMISSION_DENIED'
  | 'INVALID_INVITE_EMAIL'
  | 'INVALID_INVITE_ROLE'
  | 'INVITE_ALREADY_PENDING'
  | 'INVITE_STATE_INCONSISTENT'
  | 'MEMBER_LIMIT_UNAVAILABLE'
  | 'MEMBER_LIMIT_INVALID'
  | 'MEMBER_LIMIT_REACHED';

export type InvitationCreationSuccess = {
  success: true;
  reasonCode: 'INVITATION_CAN_BE_CREATED';
  organizationId: string;
  organizationName: string;
  email: string;
  emailNormalized: string;
  role: InvitationRole;
  status: 'pending';
  maxUses: 1;
  useCount: 0;
  expiresAtMs: number;
};

export type InvitationCreationFailure = {
  success: false;
  reasonCode: InvitationCreationFailureReason;
};

export type InvitationCreationResult =
  | InvitationCreationSuccess
  | InvitationCreationFailure;

export function isInvitationCreatorGlobalRole(value: unknown): value is InvitationCreatorGlobalRole {
  return value === 'ceo' || value === 'global_admin' || value === 'ecosystem_owner' || value === 'founder';
}

export function isInvitationCreatorMembershipRole(value: unknown): value is InvitationCreatorMembershipRole {
  return value === 'owner' || value === 'admin' || value === 'manager' || value === 'member' || value === 'viewer';
}

function normalizeValidInvitationCreationEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const norm = normalizeInvitationEmail(value);
  if (norm === null) return null;
  
  if (norm.length > 254) return null;
  
  const parts = norm.split('@');
  if (parts.length !== 2) return null;
  
  const localPart = parts[0];
  const domainPart = parts[1];
  
  if (localPart === undefined || domainPart === undefined) return null;
  if (localPart.length === 0) return null;
  if (domainPart.length === 0) return null;
  
  if (!domainPart.includes('.')) return null;
  if (domainPart.startsWith('.') || domainPart.endsWith('.')) return null;
  
  if (/\s/.test(norm) || norm.includes('\u200B')) return null;
  if (/[\x00-\x1F\x7F]/.test(norm)) return null;
  if (norm.includes('/')) return null;
  if (norm.includes('\\')) return null;
  if (norm.includes('#')) return null;
  if (norm.includes('?')) return null;
  if (norm.includes('&')) return null;
  
  return norm;
}

export function isValidInvitationCreationEmail(value: unknown): value is string {
  return normalizeValidInvitationCreationEmail(value) !== null;
}

export function planInvitationCreation(input: InvitationCreationInput, nowMs: number): InvitationCreationResult {
  if (typeof nowMs !== 'number' || !Number.isFinite(nowMs) || !Number.isInteger(nowMs) || nowMs < 0 || nowMs + INVITATION_TTL_MS > Number.MAX_SAFE_INTEGER) {
    return { success: false, reasonCode: 'INVITE_STATE_INCONSISTENT' };
  }

  if (typeof input.creator.uid !== 'string' || input.creator.uid.trim() === '') {
    return { success: false, reasonCode: 'UNAUTHENTICATED' };
  }

  if (!isValidInvitationOrganizationId(input.request.organizationId)) {
    return { success: false, reasonCode: 'INVALID_ORGANIZATION_ID' };
  }

  if (input.request.organizationId !== input.organization.organizationId) {
    return { success: false, reasonCode: 'ORGANIZATION_STATE_INCONSISTENT' };
  }

  if (!input.organization.exists) {
    return { success: false, reasonCode: 'ORGANIZATION_NOT_FOUND' };
  }

  if (input.organization.status !== 'active') {
    return { success: false, reasonCode: 'ORGANIZATION_INACTIVE' };
  }
  if (typeof input.organization.name !== 'string' || input.organization.name.trim() === '') {
    return { success: false, reasonCode: 'ORGANIZATION_STATE_INCONSISTENT' };
  }

  if (!isInvitationCreatorGlobalRole(input.creator.globalRole)) {
    if (!input.creatorMembership.exists) {
      return { success: false, reasonCode: 'ACTOR_MEMBERSHIP_REQUIRED' };
    }
    const status = input.creatorMembership.status;
    if (status === 'suspended' || status === 'inactive' || status === 'removed' || status === 'revoked' || status === 'deleted') {
      return { success: false, reasonCode: 'ACTOR_MEMBERSHIP_INACTIVE' };
    }
    if (status !== undefined && status !== 'active') {
      return { success: false, reasonCode: 'ACTOR_MEMBERSHIP_STATE_INCONSISTENT' };
    }
    const role = input.creatorMembership.role;
    const requestRole = input.request.role;
    
    if (role === 'member' || role === 'viewer') {
      return { success: false, reasonCode: 'PERMISSION_DENIED' };
    }
    if (role !== 'owner' && role !== 'admin' && role !== 'manager') {
      return { success: false, reasonCode: 'ACTOR_MEMBERSHIP_STATE_INCONSISTENT' };
    }
    
    if (!canInviteOrganizationRole(input.creator.globalRole || '', role || '', requestRole || '')) {
      return { success: false, reasonCode: 'PERMISSION_DENIED' };
    }
  }

  const normalizedEmail = normalizeValidInvitationCreationEmail(input.request.email);
  if (normalizedEmail === null) {
    return { success: false, reasonCode: 'INVALID_INVITE_EMAIL' };
  }

  const requestRole = input.request.role;
  if (!isInvitationRole(requestRole)) {
    return { success: false, reasonCode: 'INVALID_INVITE_ROLE' };
  }

  if (input.existingPendingInvitation.exists) {
    if (input.existingPendingInvitation.status === 'pending') {
      if (typeof input.existingPendingInvitation.emailNormalized !== 'string' || !isValidInvitationCreationEmail(input.existingPendingInvitation.emailNormalized)) {
        return { success: false, reasonCode: 'INVITE_STATE_INCONSISTENT' };
      }
      if (input.existingPendingInvitation.emailNormalized !== normalizedEmail) {
        return { success: false, reasonCode: 'INVITE_STATE_INCONSISTENT' };
      }
      if (typeof input.existingPendingInvitation.expiresAtMs !== 'number' || !Number.isFinite(input.existingPendingInvitation.expiresAtMs) || !Number.isInteger(input.existingPendingInvitation.expiresAtMs)) {
        return { success: false, reasonCode: 'INVITE_STATE_INCONSISTENT' };
      }
      
      let isRevoked = false;
      if (input.existingPendingInvitation.revokedAtMs !== undefined) {
        if (typeof input.existingPendingInvitation.revokedAtMs !== 'number' || !Number.isFinite(input.existingPendingInvitation.revokedAtMs) || !Number.isInteger(input.existingPendingInvitation.revokedAtMs)) {
          return { success: false, reasonCode: 'INVITE_STATE_INCONSISTENT' };
        }
        isRevoked = true;
      }
      
      if (!isRevoked && input.existingPendingInvitation.expiresAtMs > nowMs) {
        return { success: false, reasonCode: 'INVITE_ALREADY_PENDING' };
      }
    } else if (input.existingPendingInvitation.status !== 'accepted' && input.existingPendingInvitation.status !== 'revoked' && input.existingPendingInvitation.status !== 'expired') {
      return { success: false, reasonCode: 'INVITE_STATE_INCONSISTENT' };
    }
  }

  if (!input.capacity.resolved) {
    return { success: false, reasonCode: 'MEMBER_LIMIT_UNAVAILABLE' };
  }
  if (input.capacity.mode === 'unlimited') {
    // allow
  } else if (input.capacity.mode === 'limited') {
    const occupied = input.capacity.occupiedSlots;
    const max = input.capacity.maxMembers;
    if (typeof occupied !== 'number' || !Number.isFinite(occupied) || !Number.isInteger(occupied) || occupied < 0) {
      return { success: false, reasonCode: 'MEMBER_LIMIT_INVALID' };
    }
    if (typeof max !== 'number' || !Number.isFinite(max) || !Number.isInteger(max) || max <= 0) {
      return { success: false, reasonCode: 'MEMBER_LIMIT_INVALID' };
    }
    if (occupied > max) {
      return { success: false, reasonCode: 'MEMBER_LIMIT_INVALID' };
    }
    if (occupied === max) {
      return { success: false, reasonCode: 'MEMBER_LIMIT_REACHED' };
    }
  } else {
    return { success: false, reasonCode: 'MEMBER_LIMIT_INVALID' };
  }

  return {
    success: true,
    reasonCode: 'INVITATION_CAN_BE_CREATED',
    organizationId: input.request.organizationId,
    organizationName: input.organization.name,
    email: normalizedEmail,
    emailNormalized: normalizedEmail,
    role: requestRole,
    status: 'pending',
    maxUses: 1,
    useCount: 0,
    expiresAtMs: nowMs + INVITATION_TTL_MS
  };
}
