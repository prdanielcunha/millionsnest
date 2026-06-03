export function isCEO(userProfile: any) {
  return typeof userProfile?.systemRole === 'string' && userProfile.systemRole === 'ceo';
}

export function isGlobalAdmin(userProfile: any) {
  if (!userProfile?.systemRole || typeof userProfile.systemRole !== 'string') return false;
  return userProfile.systemRole === 'ceo' || userProfile.systemRole === 'admin' || userProfile.systemRole === 'global_admin';
}

export function isGlobalPrivilegedUser(userProfile: any) {
  return isGlobalAdmin(userProfile);
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
         'musicscale.unlimitedImports': true
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
