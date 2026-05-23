export interface AppPermissions {
  manageMembers: boolean;
  manageSchedules: boolean;
  manageSongs: boolean;
  manageBilling: boolean;
  manageOrganization: boolean;
  manageRoles: boolean;
}

export function getDefaultPermissions(role: string): AppPermissions {
  switch (role) {
    case 'owner':
      return {
        manageMembers: true,
        manageSchedules: true,
        manageSongs: true,
        manageBilling: true,
        manageOrganization: true,
        manageRoles: true,
      };
    case 'admin':
      return {
        manageMembers: true,
        manageSchedules: true,
        manageSongs: true,
        manageBilling: false,
        manageOrganization: false,
        manageRoles: true,
      };
    case 'secretary':
      return {
        manageMembers: true,
        manageSchedules: true,
        manageSongs: true,
        manageBilling: false,
        manageOrganization: false,
        manageRoles: false,
      };
    case 'member':
    case 'guest':
    default:
      return {
        manageMembers: false,
        manageSchedules: false,
        manageSongs: false,
        manageBilling: false,
        manageOrganization: false,
        manageRoles: false,
      };
  }
}
