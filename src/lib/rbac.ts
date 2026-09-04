import { ROLE_KEYS, PERMISSION_KEYS } from "./constants.js";
import { normalizeExistingOrganizationRole } from "./organizationRoles.js";

export interface AppPermissions {
  [PERMISSION_KEYS.ORG_UPDATE_SETTINGS]: boolean;
  [PERMISSION_KEYS.ORG_MANAGE_MEMBERS]: boolean;
  [PERMISSION_KEYS.ORG_INVITE_MEMBERS]: boolean;
  [PERMISSION_KEYS.ORG_MANAGE_ROLES]: boolean;
  [PERMISSION_KEYS.ORG_MANAGE_BILLING]: boolean;
  [PERMISSION_KEYS.ORG_MANAGE_APPS]: boolean;
  [PERMISSION_KEYS.ORG_VIEW_AUDIT]: boolean;
  [PERMISSION_KEYS.MUSIC_MANAGE_SONGS]: boolean;
  [PERMISSION_KEYS.MUSIC_EDIT_SONGS]: boolean;
  [PERMISSION_KEYS.MUSIC_MANAGE_SCALES]: boolean;
  [PERMISSION_KEYS.MUSIC_MANAGE_TEAMS]: boolean;
  [PERMISSION_KEYS.MUSIC_LIVE_CONDUCT]: boolean;
  [key: string]: boolean;
}

export { CURRENT_PERMISSIONS_VERSION, ROLE_KEYS, PERMISSION_KEYS } from "./constants.js";
import { CURRENT_PERMISSIONS_VERSION } from "./constants.js";

export function getDefaultPermissions(role: string): AppPermissions {
  const normalized = normalizeExistingOrganizationRole(role);
  
  // Custom check for legacy "leader" role since it has its own legacy permissions
  if (role === 'leader') {
    return {
      'organization.settings.update': false,
      'organization.members.manage': false,
      'organization.members.invite': false,
      'organization.roles.manage': false,
      'organization.billing.manage': false,
      'organization.apps.manage': false,
      'organization.audit.view': false,
      'musicscale.songs.manage': false,
      'musicscale.songs.edit': true,
      'musicscale.scales.manage': true,
      'musicscale.teams.manage': true,
      'musicscale.live.conduct': true,
    };
  }

  switch (normalized) {
    case 'owner':
      return {
        'organization.settings.update': true,
        'organization.members.manage': true,
        'organization.members.invite': true,
        'organization.roles.manage': true,
        'organization.billing.manage': true,
        'organization.apps.manage': true,
        'organization.audit.view': true,
        'musicscale.songs.manage': true,
        'musicscale.songs.edit': true,
        'musicscale.scales.manage': true,
        'musicscale.teams.manage': true,
        'musicscale.live.conduct': true,
      };
    case 'admin':
      return {
        'organization.settings.update': true,
        'organization.members.manage': true,
        'organization.members.invite': true,
        'organization.roles.manage': true,
        'organization.billing.manage': false,
        'organization.apps.manage': false,
        'organization.audit.view': true,
        'musicscale.songs.manage': false,
        'musicscale.songs.edit': false,
        'musicscale.scales.manage': false,
        'musicscale.teams.manage': false,
        'musicscale.live.conduct': true,
      };
    case 'manager':
      return {
        'organization.settings.update': false,
        'organization.members.manage': true,
        'organization.members.invite': true,
        'organization.roles.manage': false,
        'organization.billing.manage': false,
        'organization.apps.manage': false,
        'organization.audit.view': false,
        'musicscale.songs.manage': false,
        'musicscale.songs.edit': false,
        'musicscale.scales.manage': false,
        'musicscale.teams.manage': false,
        'musicscale.live.conduct': false,
      };
    case 'member':
    case 'viewer':
    default:
      return {
        'organization.settings.update': false,
        'organization.members.manage': false,
        'organization.members.invite': false,
        'organization.roles.manage': false,
        'organization.billing.manage': false,
        'organization.apps.manage': false,
        'organization.audit.view': false,
        'musicscale.songs.manage': false,
        'musicscale.songs.edit': false,
        'musicscale.scales.manage': false,
        'musicscale.teams.manage': false,
        'musicscale.live.conduct': false,
      };
  }
}

export function normalizePermissions(permissions: any, role: string, version?: number): AppPermissions {
  const normRole = normalizeExistingOrganizationRole(role);
  if (version === CURRENT_PERMISSIONS_VERSION && permissions) {
    if (normRole === 'owner') return getDefaultPermissions('owner');
    return permissions as AppPermissions;
  }
  
  const defaultPerms = getDefaultPermissions(role);

  // Preserve every canonical permission from older schema versions before
  // applying legacy aliases. Version bumps must never erase custom access.
  if (permissions && typeof permissions === 'object') {
     for (const [key, value] of Object.entries(permissions)) {
       if (typeof value === 'boolean') {
         defaultPerms[key] = value;
       }
     }

     if (permissions['organization.manageMembers'] !== undefined) defaultPerms['organization.members.manage'] = permissions['organization.manageMembers'];
     if (permissions['organization.manageRoles'] !== undefined) defaultPerms['organization.roles.manage'] = permissions['organization.manageRoles'];
     if (permissions['organization.manageBilling'] !== undefined) defaultPerms['organization.billing.manage'] = permissions['organization.manageBilling'];
     if (permissions['organization.manageOrganization'] !== undefined) defaultPerms['organization.settings.update'] = permissions['organization.manageOrganization'];
     
     if (permissions['musicScale.manageSongs'] !== undefined) {
         defaultPerms['musicscale.songs.manage'] = permissions['musicScale.manageSongs'];
         defaultPerms['musicscale.songs.edit'] = permissions['musicScale.manageSongs'];
     }
     if (permissions['musicScale.manageScales'] !== undefined) defaultPerms['musicscale.scales.manage'] = permissions['musicScale.manageScales'];
     if (permissions['musicScale.manageTeams'] !== undefined) defaultPerms['musicscale.teams.manage'] = permissions['musicScale.manageTeams'];
  }
  
  if (normRole === 'owner') {
     // enforce owner full access
     return getDefaultPermissions('owner');
  }

  return defaultPerms;
}
