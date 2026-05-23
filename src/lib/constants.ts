export const CURRENT_PERMISSIONS_VERSION = 1;

export const ROLE_KEYS = {
  OWNER: 'owner',
  ADMIN: 'admin',
  SECRETARY: 'secretary',
  MEMBER: 'member',
  GUEST: 'guest',
} as const;

export type RoleKey = typeof ROLE_KEYS[keyof typeof ROLE_KEYS];

export const PERMISSION_KEYS = {
  ORG_MANAGE_MEMBERS: 'organization.manageMembers',
  ORG_MANAGE_ROLES: 'organization.manageRoles',
  ORG_MANAGE_BILLING: 'organization.manageBilling',
  ORG_MANAGE_ORGANIZATION: 'organization.manageOrganization',
  MUSIC_MANAGE_SONGS: 'musicScale.manageSongs',
  MUSIC_MANAGE_SCALES: 'musicScale.manageScales',
  MUSIC_MANAGE_TEAMS: 'musicScale.manageTeams',
} as const;

export type PermissionKey = typeof PERMISSION_KEYS[keyof typeof PERMISSION_KEYS];

export const FEATURE_KEYS = {
  TEAMS: 'teams',
  REPERTOIRE: 'repertoire',
  AUTOMATIZATIONS: 'automatizations',
  METRICS: 'metrics',
  WHATSAPP_NOTIFICATIONS: 'whatsapp_notifications',
} as const;

export type FeatureKey = typeof FEATURE_KEYS[keyof typeof FEATURE_KEYS];
