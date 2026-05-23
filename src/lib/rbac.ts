export interface AppPermissions {
  'organization.manageMembers': boolean;
  'organization.manageRoles': boolean;
  'organization.manageBilling': boolean;
  'organization.manageOrganization': boolean;
  'musicScale.manageSongs': boolean;
  'musicScale.manageScales': boolean;
  'musicScale.manageTeams': boolean;
  [key: string]: boolean;
}

export const CURRENT_PERMISSIONS_VERSION = 1;

export function getDefaultPermissions(role: string): AppPermissions {
  switch (role) {
    case 'owner':
      return {
        'organization.manageMembers': true,
        'organization.manageRoles': true,
        'organization.manageBilling': true,
        'organization.manageOrganization': true,
        'musicScale.manageSongs': true,
        'musicScale.manageScales': true,
        'musicScale.manageTeams': true,
      };
    case 'admin':
      return {
        'organization.manageMembers': true,
        'organization.manageRoles': true,
        'organization.manageBilling': false,
        'organization.manageOrganization': false,
        'musicScale.manageSongs': true,
        'musicScale.manageScales': true,
        'musicScale.manageTeams': true,
      };
    case 'secretary':
      return {
        'organization.manageMembers': true,
        'organization.manageRoles': false,
        'organization.manageBilling': false,
        'organization.manageOrganization': false,
        'musicScale.manageSongs': true,
        'musicScale.manageScales': true,
        'musicScale.manageTeams': true,
      };
    case 'member':
    case 'guest':
    default:
      return {
        'organization.manageMembers': false,
        'organization.manageRoles': false,
        'organization.manageBilling': false,
        'organization.manageOrganization': false,
        'musicScale.manageSongs': false,
        'musicScale.manageScales': false,
        'musicScale.manageTeams': false,
      };
  }
}

export function normalizePermissions(permissions: any, role: string, version?: number): AppPermissions {
  if (version === CURRENT_PERMISSIONS_VERSION && permissions) {
    if (role === 'owner') return getDefaultPermissions('owner');
    return permissions as AppPermissions;
  }
  
  const defaultPerms = getDefaultPermissions(role);

  // If old version lacking version
  if (permissions && typeof permissions === 'object') {
     // Overwrite namespaces with old boolean formats
     if (permissions.manageMembers !== undefined) defaultPerms['organization.manageMembers'] = permissions.manageMembers;
     if (permissions.manageRoles !== undefined) defaultPerms['organization.manageRoles'] = permissions.manageRoles;
     if (permissions.manageBilling !== undefined) defaultPerms['organization.manageBilling'] = permissions.manageBilling;
     if (permissions.manageOrganization !== undefined) defaultPerms['organization.manageOrganization'] = permissions.manageOrganization;
     
     if (permissions.manageSongs !== undefined) defaultPerms['musicScale.manageSongs'] = permissions.manageSongs;
     if (permissions.manageSchedules !== undefined) defaultPerms['musicScale.manageScales'] = permissions.manageSchedules;
  }
  
  if (role === 'owner') {
     // enforce owner full access
     return getDefaultPermissions('owner');
  }

  return defaultPerms;
}
