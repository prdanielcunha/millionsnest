export type Membership = {
  id?: string;
  organizationId: string;
  status?: string;
  role?: string;
  organizationRole?: string;
};

export type Invite = {
  id?: string;
  email?: string;
  emailNormalized?: string;
  status?: string;
  expiresAtMs?: number;
};

export type UserContext = {
  activeOrganizationId?: string;
  primaryOrganizationId?: string;
  organizationId?: string;
};

export type LockStatus = {
  exists: boolean;
  completed: boolean;
  organizationId?: string;
  orgExists?: boolean;
  orgActive?: boolean;
  memberExists?: boolean;
  memberActive?: boolean;
};

export enum BootstrapDecisionCode {
  REUSE_CANONICAL_MEMBERSHIP = 'REUSE_CANONICAL_MEMBERSHIP',
  REPAIR_LEGACY_MEMBERSHIP = 'REPAIR_LEGACY_MEMBERSHIP',
  WAIT_FOR_INVITATION = 'WAIT_FOR_INVITATION',
  REUSE_BOOTSTRAP_LOCK = 'REUSE_BOOTSTRAP_LOCK',
  CREATE_PERSONAL_ORGANIZATION = 'CREATE_PERSONAL_ORGANIZATION',
  AMBIGUOUS_LEGACY_MEMBERSHIP = 'AMBIGUOUS_LEGACY_MEMBERSHIP',
  INCONSISTENT_BOOTSTRAP_STATE = 'INCONSISTENT_BOOTSTRAP_STATE',
}

export type BootstrapDecision = {
  code: BootstrapDecisionCode;
  organizationId?: string;
  reasonCode: string;
};

export function planBootstrap(
  canonicalMemberships: Membership[],
  legacyMemberships: Membership[],
  pendingInvites: Invite[],
  userContext: UserContext,
  lockStatus: LockStatus,
  userEmail: string | null,
  nowMs: number
): BootstrapDecision {

  if (lockStatus.exists) {
    if (lockStatus.completed && lockStatus.organizationId && lockStatus.orgExists && lockStatus.orgActive && lockStatus.memberExists && lockStatus.memberActive) {
      return {
        code: BootstrapDecisionCode.REUSE_BOOTSTRAP_LOCK,
        organizationId: lockStatus.organizationId,
        reasonCode: 'EXISTING_CONTEXT_REUSED'
      };
    }
    return {
      code: BootstrapDecisionCode.INCONSISTENT_BOOTSTRAP_STATE,
      reasonCode: 'BOOTSTRAP_STATE_INCONSISTENT'
    };
  }

  const activeCanonical = canonicalMemberships.filter(m => 
    !m.status || m.status === 'active'
  );

  if (activeCanonical.length > 0) {
    let targetOrgId = userContext.activeOrganizationId;
    if (!targetOrgId || !activeCanonical.find(m => m.organizationId === targetOrgId)) {
      targetOrgId = userContext.primaryOrganizationId;
    }
    if (!targetOrgId || !activeCanonical.find(m => m.organizationId === targetOrgId)) {
      targetOrgId = userContext.organizationId;
    }
    if (!targetOrgId || !activeCanonical.find(m => m.organizationId === targetOrgId)) {
      const sorted = [...activeCanonical].sort((a, b) => a.organizationId.localeCompare(b.organizationId));
      targetOrgId = sorted[0].organizationId;
    }

    return {
      code: BootstrapDecisionCode.REUSE_CANONICAL_MEMBERSHIP,
      organizationId: targetOrgId,
      reasonCode: 'EXISTING_CONTEXT_REUSED'
    };
  }

  const uniqueLegacyOrgs = new Set<string>();
  const validLegacyMemberships = [];
  for (const m of legacyMemberships) {
    if (m.organizationId && !uniqueLegacyOrgs.has(m.organizationId)) {
      uniqueLegacyOrgs.add(m.organizationId);
      validLegacyMemberships.push(m);
    }
  }

  if (validLegacyMemberships.length === 1) {
    return {
      code: BootstrapDecisionCode.REPAIR_LEGACY_MEMBERSHIP,
      organizationId: validLegacyMemberships[0].organizationId,
      reasonCode: 'LEGACY_REPAIRED'
    };
  }

  if (validLegacyMemberships.length > 1) {
    return {
      code: BootstrapDecisionCode.AMBIGUOUS_LEGACY_MEMBERSHIP,
      reasonCode: 'AMBIGUOUS_LEGACY_MEMBERSHIP'
    };
  }

  if (userEmail) {
    const normalizedEmail = userEmail.toLowerCase().trim();
    const activeInvites = pendingInvites.filter(i => {
      const em = i.emailNormalized || i.email;
      const emailMatches = em && em.toLowerCase().trim() === normalizedEmail;
      const isPending = i.status === 'pending';
      const notExpired = !i.expiresAtMs || i.expiresAtMs > nowMs;
      return emailMatches && isPending && notExpired;
    });

    if (activeInvites.length > 0) {
      return {
        code: BootstrapDecisionCode.WAIT_FOR_INVITATION,
        reasonCode: 'INVITATION_PENDING'
      };
    }
  }

  return {
    code: BootstrapDecisionCode.CREATE_PERSONAL_ORGANIZATION,
    reasonCode: 'CREATED_NEW_ORGANIZATION'
  };
}
