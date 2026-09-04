export const CANONICAL_GLOBAL_ROLES = ['ceo', 'global_admin', 'ecosystem_owner', 'founder'];
export const ECOSYSTEM_SUPPORT_ROLES = ['ecosystem_support'] as const;

export const NESTFINANCE_DEVELOPMENT_SYSTEM_ROLES = [
  'ceo',
  'global_admin',
  'ecosystem_owner'
] as const;

export function canAccessNestFinanceDevelopment(
  systemRole: string | undefined | null
): boolean {
  if (!systemRole) return false;
  return NESTFINANCE_DEVELOPMENT_SYSTEM_ROLES.includes(
    systemRole as (typeof NESTFINANCE_DEVELOPMENT_SYSTEM_ROLES)[number]
  );
}


export function isCanonicalGlobalRole(systemRole: string | undefined | null): boolean {
  if (!systemRole) return false;
  return CANONICAL_GLOBAL_ROLES.includes(systemRole);
}

export function isCEO(userProfile: any) {
  return typeof userProfile?.systemRole === 'string' && userProfile.systemRole === 'ceo';
}

export function isGlobalAdmin(userProfile: any) {
  if (!userProfile?.systemRole || typeof userProfile.systemRole !== 'string') return false;
  return isCanonicalGlobalRole(userProfile.systemRole);
}

export function isGlobalPrivilegedUser(userProfile: any) {
  return isGlobalAdmin(userProfile);
}

export interface EcosystemPrivilegePolicy {
  isCanonicalGlobalRole: boolean;
  isEcosystemSupportStaff: boolean;
  hasFullProductEntitlements: boolean;
  hasPrioritySupport: boolean;
  canBypassSupportMembership: boolean;
  canManageGlobalGovernance: boolean;
}

export function resolveEcosystemPrivilegePolicy(systemRole: string | undefined | null): EcosystemPrivilegePolicy {
  const role = systemRole || '';
  const isCanonical = CANONICAL_GLOBAL_ROLES.includes(role);
  const isSupport = ECOSYSTEM_SUPPORT_ROLES.includes(role as any);

  if (isCanonical) {
    return {
      isCanonicalGlobalRole: true,
      isEcosystemSupportStaff: false,
      hasFullProductEntitlements: true,
      hasPrioritySupport: true,
      canBypassSupportMembership: true,
      canManageGlobalGovernance: true
    };
  }

  if (isSupport) {
    return {
      isCanonicalGlobalRole: false,
      isEcosystemSupportStaff: true,
      hasFullProductEntitlements: true,
      hasPrioritySupport: true,
      canBypassSupportMembership: true,
      canManageGlobalGovernance: false
    };
  }

  return {
    isCanonicalGlobalRole: false,
    isEcosystemSupportStaff: false,
    hasFullProductEntitlements: false,
    hasPrioritySupport: false,
    canBypassSupportMembership: false,
    canManageGlobalGovernance: false
  };
}

function getSystemRole(profileOrRole: any): string | null {
  if (!profileOrRole) return null;
  if (typeof profileOrRole === 'string') return profileOrRole;
  return profileOrRole?.systemRole || null;
}

export function hasFullEcosystemEntitlements(profileOrRole: any): boolean {
  const role = getSystemRole(profileOrRole);
  return resolveEcosystemPrivilegePolicy(role).hasFullProductEntitlements;
}

export function hasPrioritySupportAccess(profileOrRole: any): boolean {
  const role = getSystemRole(profileOrRole);
  return resolveEcosystemPrivilegePolicy(role).hasPrioritySupport;
}

export function canBypassSupportMembership(profileOrRole: any): boolean {
  const role = getSystemRole(profileOrRole);
  return resolveEcosystemPrivilegePolicy(role).canBypassSupportMembership;
}

export interface EffectiveSupportAccess {
  supportTier: 'standard' | 'basic_priority' | 'priority';
  accessSource: 'global_privilege' | 'ecosystem_support' | 'subscription' | 'organization' | 'fallback';
  hasFullProductEntitlements: boolean;
  hasPrioritySupport: boolean;
  canUseWhatsAppSupport: boolean;
}

export function resolveEffectiveSupportAccess({
  systemRole,
  subscription,
  organization
}: {
  systemRole: string | undefined | null;
  subscription?: any;
  organization?: any;
}): EffectiveSupportAccess {
  const privilegePolicy = resolveEcosystemPrivilegePolicy(systemRole);

  let supportTier: 'standard' | 'basic_priority' | 'priority' = 'standard';
  let accessSource: 'global_privilege' | 'ecosystem_support' | 'subscription' | 'organization' | 'fallback' = 'fallback';

  if (privilegePolicy.hasPrioritySupport) {
    supportTier = 'priority';
    if (privilegePolicy.isCanonicalGlobalRole) {
      accessSource = 'global_privilege';
    } else {
      accessSource = 'ecosystem_support';
    }
  } else {
    // Check subscription
    const subST = subscription?.supportTier;
    if (subST) {
      accessSource = 'subscription';
      if (subST === 'standard' || subST === 'basic_priority' || subST === 'priority') {
        supportTier = subST;
      } else if (subST === 'basic') {
        supportTier = 'basic_priority';
      } else {
        supportTier = 'standard';
        accessSource = 'fallback';
      }
    } else {
      // Check organization
      const orgST = organization?.apps?.musicscale?.supportTier;
      if (orgST) {
        accessSource = 'organization';
        if (orgST === 'standard' || orgST === 'basic_priority' || orgST === 'priority') {
          supportTier = orgST;
        } else if (orgST === 'basic') {
          supportTier = 'basic_priority';
        } else {
          supportTier = 'standard';
          accessSource = 'fallback';
        }
      } else {
        supportTier = 'standard';
        accessSource = 'fallback';
      }
    }
  }

  return {
    supportTier,
    accessSource,
    hasFullProductEntitlements: privilegePolicy.hasFullProductEntitlements,
    hasPrioritySupport: supportTier === 'priority',
    canUseWhatsAppSupport: supportTier === 'priority'
  };
}

export function getEffectiveCapabilities(userProfile: any, organization?: any, appKey?: string) {
  if (isGlobalPrivilegedUser(userProfile)) {
    return {
      canAccessAllApps: true,
      canManageAllOrganizations: true,
      canBypassBilling: true,
      canUseAllFeatures: true,
      lifetimeAccess: true,
      ...(appKey === 'musicscale' ? {
         'musicscale.access': true,
         'musicscale.manageSongs': true,
         'musicscale.manageScales': true,
         'musicscale.useAI': true,
         'musicscale.useGlobalLibrary': true,
         'musicscale.cloneScales': true,
         'musicscale.unlimitedUsers': true,
         'musicscale.unlimitedImports': true,
         'musicscale.live.conduct': true
      } : {})
    };
  }

  return {
    canAccessAllApps: false,
    canManageAllOrganizations: false,
    canBypassBilling: false,
    canUseAllFeatures: false,
    lifetimeAccess: false
  };
}

export function canManageAnyOrganization(userProfile: any) {
  return isGlobalPrivilegedUser(userProfile);
}

export function canManageOrganization(userProfile: any, orgId: string) {
  if (isGlobalPrivilegedUser(userProfile)) return true;
  return userProfile?.organizationId === orgId && (userProfile?.organizationRole === 'owner' || userProfile?.organizationRole === 'admin');
}

export function canInviteToOrganization(userProfile: any, orgId: string) {
  return canManageOrganization(userProfile, orgId);
}

export function canEditOrganization(userProfile: any, orgId: string) {
  if (isGlobalPrivilegedUser(userProfile)) return true;
  return userProfile?.organizationId === orgId && (userProfile?.organizationRole === 'owner' || userProfile?.organizationRole === 'admin');
}
