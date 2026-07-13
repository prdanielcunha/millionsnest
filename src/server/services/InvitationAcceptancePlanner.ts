export function normalizeInvitationEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  return trimmed;
}

export type InvitationRole = 'admin' | 'member';
export type ExistingMembershipRole = 'owner' | 'admin' | 'member';

export function isInvitationRole(value: unknown): value is InvitationRole {
  return value === 'admin' || value === 'member';
}

export function isExistingMembershipRole(value: unknown): value is ExistingMembershipRole {
  return value === 'owner' || value === 'admin' || value === 'member';
}

export type AuthenticatedInvitationIdentity = {
  uid?: string;
  email?: string;
};

export type InvitationOrganizationState = {
  exists: boolean;
  status?: string;
};

export type InvitationState = {
  exists: boolean;
  organizationId?: string;
  status?: string;
  email?: string;
  emailNormalized?: string;
  role?: string;
  expiresAtMs?: number;
  revokedAtMs?: number;
  maxUses?: number;
  useCount?: number;
  acceptedBy?: string;
};

export type ExistingInvitationMembership = {
  exists: boolean;
  status?: string;
  role?: string;
};

export type InvitationMemberCapacity = {
  resolved: boolean;
  mode?: 'limited' | 'unlimited';
  currentActiveMembers?: number;
  maxMembers?: number;
};

export type InvitationAcceptanceInput = {
  identity: AuthenticatedInvitationIdentity;
  organization: InvitationOrganizationState;
  invitation: InvitationState;
  existingMembership: ExistingInvitationMembership;
  capacity: InvitationMemberCapacity;
};

export type InvitationAcceptanceSuccess = {
  success: true;
  action: 'CREATE_MEMBERSHIP' | 'ALREADY_MEMBER';
  membershipRole: 'admin' | 'member' | 'owner';
  consumeInviteUse: boolean;
  reasonCode: 'INVITATION_CAN_BE_ACCEPTED' | 'ALREADY_MEMBER';
};

export type InvitationAcceptanceFailureReason =
  | 'AUTHENTICATED_EMAIL_REQUIRED'
  | 'ORGANIZATION_NOT_FOUND'
  | 'ORGANIZATION_INACTIVE'
  | 'INVITE_NOT_FOUND'
  | 'INVITE_STATE_INCONSISTENT'
  | 'INVITE_REVOKED'
  | 'INVITE_EXPIRED'
  | 'INVITE_IDENTITY_MISMATCH'
  | 'INVALID_INVITE_ROLE'
  | 'INVITE_MAX_USES_REACHED'
  | 'MEMBERSHIP_INACTIVE'
  | 'MEMBERSHIP_STATE_INCONSISTENT'
  | 'INVITE_ALREADY_CONSUMED'
  | 'MEMBER_LIMIT_UNAVAILABLE'
  | 'MEMBER_LIMIT_INVALID'
  | 'MEMBER_LIMIT_REACHED';

export type InvitationAcceptanceFailure = {
  success: false;
  reasonCode: InvitationAcceptanceFailureReason;
};

export type InvitationAcceptanceResult = InvitationAcceptanceSuccess | InvitationAcceptanceFailure;

export function planInvitationAcceptance(input: InvitationAcceptanceInput, nowMs: number): InvitationAcceptanceResult {
  const uid = input.identity.uid;
  if (!uid || typeof uid !== 'string' || uid.trim() === '') {
    return { success: false, reasonCode: 'AUTHENTICATED_EMAIL_REQUIRED' };
  }
  const authEmail = normalizeInvitationEmail(input.identity.email);
  if (!authEmail) {
    return { success: false, reasonCode: 'AUTHENTICATED_EMAIL_REQUIRED' };
  }

  if (!input.organization.exists) {
    return { success: false, reasonCode: 'ORGANIZATION_NOT_FOUND' };
  }
  if (input.organization.status !== 'active') {
    return { success: false, reasonCode: 'ORGANIZATION_INACTIVE' };
  }

  const inv = input.invitation;
  if (!inv.exists) {
    return { success: false, reasonCode: 'INVITE_NOT_FOUND' };
  }
  
  const orgId = inv.organizationId;
  if (typeof orgId !== 'string' || orgId.trim() === '') {
    return { success: false, reasonCode: 'INVITE_STATE_INCONSISTENT' };
  }

  if (inv.status === 'revoked' || typeof inv.revokedAtMs === 'number') {
    return { success: false, reasonCode: 'INVITE_REVOKED' };
  }

  if (inv.status !== 'pending' && inv.status !== 'accepted') {
    return { success: false, reasonCode: 'INVITE_STATE_INCONSISTENT' };
  }

  if (typeof nowMs !== 'number' || !Number.isFinite(nowMs) || nowMs < 0) {
    return { success: false, reasonCode: 'INVITE_STATE_INCONSISTENT' };
  }

  if (typeof inv.expiresAtMs !== 'number' || !Number.isFinite(inv.expiresAtMs) || inv.expiresAtMs <= 0) {
    return { success: false, reasonCode: 'INVITE_STATE_INCONSISTENT' };
  }
  if (inv.expiresAtMs <= nowMs) {
    return { success: false, reasonCode: 'INVITE_EXPIRED' };
  }

  const invE1 = normalizeInvitationEmail(inv.email);
  const invE2 = normalizeInvitationEmail(inv.emailNormalized);
  if (!invE1 && !invE2) {
    return { success: false, reasonCode: 'INVITE_STATE_INCONSISTENT' };
  }
  if (invE1 && invE2 && invE1 !== invE2) {
    return { success: false, reasonCode: 'INVITE_STATE_INCONSISTENT' };
  }
  const targetEmail = invE1 || invE2;
  if (targetEmail !== authEmail) {
    return { success: false, reasonCode: 'INVITE_IDENTITY_MISMATCH' };
  }

  const inviteRole = inv.role;
  if (!isInvitationRole(inviteRole)) {
    return { success: false, reasonCode: 'INVALID_INVITE_ROLE' };
  }

  const maxUses = inv.maxUses;
  const useCount = inv.useCount;
  if (typeof maxUses !== 'number' || !Number.isInteger(maxUses) || maxUses <= 0 ||
      typeof useCount !== 'number' || !Number.isInteger(useCount) || useCount < 0) {
    return { success: false, reasonCode: 'INVITE_STATE_INCONSISTENT' };
  }
  if (useCount > maxUses) {
    return { success: false, reasonCode: 'INVITE_STATE_INCONSISTENT' };
  }

  const existing = input.existingMembership;
  let isActiveMembership = false;
  let activeRole: ExistingMembershipRole | undefined = undefined;

  if (existing.exists) {
    if (!existing.status || existing.status === 'active') {
      if (isExistingMembershipRole(existing.role)) {
        isActiveMembership = true;
        activeRole = existing.role;
      } else {
        return { success: false, reasonCode: 'MEMBERSHIP_STATE_INCONSISTENT' };
      }
    } else if (['suspended', 'inactive', 'removed', 'revoked', 'deleted'].includes(existing.status)) {
      return { success: false, reasonCode: 'MEMBERSHIP_INACTIVE' };
    } else {
      return { success: false, reasonCode: 'MEMBERSHIP_STATE_INCONSISTENT' };
    }
  }

  if (inv.status === 'accepted') {
    if (inv.acceptedBy !== uid) {
      return { success: false, reasonCode: 'INVITE_ALREADY_CONSUMED' };
    }
    if (!isActiveMembership) {
      return { success: false, reasonCode: 'INVITE_ALREADY_CONSUMED' };
    }
  } else {
    if (useCount === maxUses && !isActiveMembership) {
      return { success: false, reasonCode: 'INVITE_MAX_USES_REACHED' };
    }
  }

  if (isActiveMembership && activeRole) {
    return {
      success: true,
      action: 'ALREADY_MEMBER',
      membershipRole: activeRole,
      consumeInviteUse: false,
      reasonCode: 'ALREADY_MEMBER'
    };
  }

  if (!input.capacity.resolved) {
    return { success: false, reasonCode: 'MEMBER_LIMIT_UNAVAILABLE' };
  }

  if (input.capacity.mode === 'unlimited') {
     // allowed
  } else if (input.capacity.mode === 'limited') {
    const cur = input.capacity.currentActiveMembers;
    const max = input.capacity.maxMembers;
    if (typeof cur !== 'number' || typeof max !== 'number' || !Number.isInteger(cur) || !Number.isInteger(max) || cur < 0 || max < 0) {
      return { success: false, reasonCode: 'MEMBER_LIMIT_INVALID' };
    }
    if (cur > max) {
      return { success: false, reasonCode: 'MEMBER_LIMIT_INVALID' };
    }
    if (cur === max) {
      return { success: false, reasonCode: 'MEMBER_LIMIT_REACHED' };
    }
  } else {
    return { success: false, reasonCode: 'MEMBER_LIMIT_INVALID' };
  }

  return {
    success: true,
    action: 'CREATE_MEMBERSHIP',
    membershipRole: inviteRole,
    consumeInviteUse: true,
    reasonCode: 'INVITATION_CAN_BE_ACCEPTED'
  };
}
