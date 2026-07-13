export type Membership = {
  id?: string;
  organizationId: string;
  status?: string;
  role?: string;
  organizationRole?: string;
  sanitizedRole?: string | null;
};

export type LegacyCandidate = {
  organizationId: string;
  sourcePath: string;
  status?: string;
  role?: string;
  organizationRole?: string;
  createdAtMs?: number;
};

export type ConsolidatedLegacy = {
  organizationId: string;
  sourcePath: string;
  sanitizedRole: 'owner' | 'admin' | 'member';
  createdAtMs?: number;
};

export type ResolveLegacyResult = {
  ok: true;
  memberships: ConsolidatedLegacy[];
} | {
  ok: false;
  reasonCode: 'BOOTSTRAP_STATE_INCONSISTENT';
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

export function normalizeLegacyOrganizationRole(role?: any, organizationRole?: any): 'owner' | 'admin' | 'member' | null {
  const hasRole = typeof role === 'string' && role.length > 0;
  const hasOrgRole = typeof organizationRole === 'string' && organizationRole.length > 0;

  if (hasRole && hasOrgRole && role !== organizationRole) {
    return null;
  }

  const candidate = hasRole ? role : (hasOrgRole ? organizationRole : null);
  
  if (candidate === 'owner' || candidate === 'admin' || candidate === 'member') {
    return candidate;
  }
  
  return null;
}

export function resolveLegacyMembershipCandidates(candidates: LegacyCandidate[]): ResolveLegacyResult {
  const grouped = new Map<string, LegacyCandidate[]>();
  for (const c of candidates) {
    const list = grouped.get(c.organizationId) || [];
    list.push(c);
    grouped.set(c.organizationId, list);
  }

  const resultMemberships: ConsolidatedLegacy[] = [];
  const excludedStatuses = ['removed', 'revoked', 'suspended', 'inactive', 'deleted'];

  const organizationIds = [...grouped.keys()].sort((a, b) => a.localeCompare(b));

  for (const orgId of organizationIds) {
    const list = grouped.get(orgId)!;
    list.sort((a, b) => a.sourcePath.localeCompare(b.sourcePath));

    let activeFound = false;
    let excludedFound = false;
    let inconsistent = false;
    let firstValidRole: 'owner' | 'admin' | 'member' | null = null;
    let selectedDoc: LegacyCandidate | null = null;

    for (const data of list) {
      const st = data.status;
      const isActive = !st || st === 'active';
      const isExcluded = st && excludedStatuses.includes(st);

      if (!isActive && !isExcluded) {
        inconsistent = true;
        break;
      }

      if (isActive) {
        activeFound = true;
        const normalized = normalizeLegacyOrganizationRole(data.role, data.organizationRole);
        if (normalized === null) {
          inconsistent = true;
          break;
        }
        if (firstValidRole === null) {
          firstValidRole = normalized;
          if (!selectedDoc) {
             selectedDoc = data;
          }
        } else if (firstValidRole !== normalized) {
          inconsistent = true;
          break;
        }
      } else if (isExcluded) {
        excludedFound = true;
      }
    }

    if (inconsistent || (activeFound && excludedFound)) {
      return { ok: false, reasonCode: 'BOOTSTRAP_STATE_INCONSISTENT' };
    }

    if (activeFound && selectedDoc && firstValidRole) {
      resultMemberships.push({
        organizationId: selectedDoc.organizationId,
        sourcePath: selectedDoc.sourcePath,
        sanitizedRole: firstValidRole,
        createdAtMs: selectedDoc.createdAtMs
      });
    }
  }

  return { ok: true, memberships: resultMemberships };
}

export function planBootstrap(
  canonicalMemberships: Membership[],
  legacyMemberships: ConsolidatedLegacy[],
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
