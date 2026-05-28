export function isCEO(userProfile: any) {
  return userProfile?.systemRole === 'ceo';
}

export function isGlobalAdmin(userProfile: any) {
  return userProfile?.systemRole === 'ceo' || userProfile?.systemRole === 'admin' || userProfile?.systemRole === 'global_admin';
}

export function canManageAnyOrganization(userProfile: any) {
  return isGlobalAdmin(userProfile);
}

export function canManageOrganization(userProfile: any, orgId: string) {
  if (isGlobalAdmin(userProfile)) return true;
  return userProfile?.organizationId === orgId && (userProfile?.organizationRole === 'owner' || userProfile?.organizationRole === 'admin');
}

export function canInviteToOrganization(userProfile: any, orgId: string) {
  return canManageOrganization(userProfile, orgId);
}

export function canEditOrganization(userProfile: any, orgId: string) {
  if (isGlobalAdmin(userProfile)) return true;
  return userProfile?.organizationId === orgId && (userProfile?.organizationRole === 'owner' || userProfile?.organizationRole === 'admin');
}
